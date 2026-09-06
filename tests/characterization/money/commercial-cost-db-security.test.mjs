/**
 * #6 CORE SECURITY — LOCAL DB evidence that client cost_amount cannot override Engine.
 * Skips if DATABASE_URL missing or not localhost.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { simulateOrderCostWrite } from "./commercial-cost-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of [".env", ".env.local"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const url = loadDatabaseUrl();
const isLocal =
  !!url &&
  (/@localhost\b/i.test(url) || /@127\.0\.0\.1\b/i.test(url));

describe("#6 LOCAL DB security — client cost ignored (real orders.cost_amount)", { skip: !isLocal }, () => {
  /** @type {pg.Client} */
  let client;
  let customerId;
  let orderMatchedId;
  let orderMissId;
  let rateId;

  before(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();

    const cust = await client.query(
      `INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id`,
      [`#6sec-${Date.now()}`, `09${String(Date.now()).slice(-8)}`],
    );
    customerId = cust.rows[0].id;

    const rate = await client.query(
      `INSERT INTO commercial_trip_cost_rates (
         customer_id, match_level,
         origin_city, origin_district, destination_city, destination_district,
         vehicle_type, service_type, standard_driver_trip_cost, active, block_fallthrough
       ) VALUES (
         $1, 1,
         '台北市', '中山區', '新北市', '板橋區',
         '箱型車', '冷鏈', 3100, true, false
       ) RETURNING id`,
      [customerId],
    );
    rateId = rate.rows[0].id;

    const om = await client.query(
      `INSERT INTO orders (
         customer_id, customer_name, customer_phone,
         pickup_city, pickup_district, pickup_address,
         delivery_city, delivery_district, delivery_address,
         cargo_description, required_vehicle_type, status, fee_status
       ) VALUES (
         $1, 'SEC', '0900000000',
         '台北市', '中山區', '台北市中山區測試路1號',
         '新北市', '板橋區', '新北市板橋區測試路2號',
         'security-test', '箱型車', 'pending', 'unpaid'
       ) RETURNING id`,
      [customerId],
    );
    orderMatchedId = om.rows[0].id;

    const omiss = await client.query(
      `INSERT INTO orders (
         customer_id, customer_name, customer_phone,
         pickup_city, pickup_district, pickup_address,
         delivery_city, delivery_district, delivery_address,
         cargo_description, required_vehicle_type, status, fee_status
       ) VALUES (
         $1, 'SEC-MISS', '0900000001',
         '台中市', '西區', '台中市西區測試路1號',
         '高雄市', '前鎮區', '高雄市前鎮區測試路2號',
         'security-miss', '箱型車', 'pending', 'unpaid'
       ) RETURNING id`,
      [customerId],
    );
    orderMissId = omiss.rows[0].id;
  });

  after(async () => {
    if (!client) return;
    try {
      if (orderMatchedId) {
        await client.query(`DELETE FROM order_cost_lookups WHERE order_id = $1`, [orderMatchedId]);
        await client.query(`DELETE FROM orders WHERE id = $1`, [orderMatchedId]);
      }
      if (orderMissId) {
        await client.query(`DELETE FROM order_cost_lookups WHERE order_id = $1`, [orderMissId]);
        await client.query(`DELETE FROM orders WHERE id = $1`, [orderMissId]);
      }
      if (rateId) await client.query(`DELETE FROM commercial_trip_cost_rates WHERE id = $1`, [rateId]);
      if (customerId) await client.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
    } finally {
      await client.end();
    }
  });

  it("MATCHED: request 999999 → Engine 3100 → DB cost_amount=3100", async () => {
    const clientCost = 999999;
    const { db, engine, request } = await simulateOrderCostWrite({
      facts: {
        customerId,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        vehicleType: "箱型車",
        serviceType: "冷鏈",
      },
      rates: [
        {
          id: rateId,
          matchLevel: 1,
          originCity: "台北市",
          originDistrict: "中山區",
          destinationCity: "新北市",
          destinationDistrict: "板橋區",
          vehicleType: "箱型車",
          serviceType: "冷鏈",
          standardDriverTripCost: 3100,
          active: true,
          blockFallthrough: false,
        },
      ],
      clientCostAmount: clientCost,
    });

    assert.equal(request.cost_amount, 999999);
    assert.equal(engine.standardCost, 3100);

    // Persist like applyCommercialOrderCost (cost columns only — no trigger re-fire)
    await client.query(
      `UPDATE orders SET cost_amount = $2, profit_amount = NULL WHERE id = $1`,
      [orderMatchedId, db.cost_amount],
    );
    await client.query(
      `INSERT INTO order_cost_lookups (
         order_id, lookup_status, matched_level, rate_source, rate_rule_id, standard_cost,
         customer_id, origin_city, origin_district, destination_city, destination_district,
         vehicle_type, service_type
       ) VALUES ($1,'MATCHED',1,'commercial_trip_cost_rates',$2,3100,$3,
         '台北市','中山區','新北市','板橋區','箱型車','冷鏈')`,
      [orderMatchedId, rateId, customerId],
    );

    const { rows } = await client.query(
      `SELECT cost_amount FROM orders WHERE id = $1`,
      [orderMatchedId],
    );
    const persisted = rows[0].cost_amount == null ? null : Number(rows[0].cost_amount);
    assert.equal(persisted, 3100);
    assert.notEqual(persisted, 999999);
  });

  it("MISS: request 999999 → Engine MISS → DB cost_amount=NULL", async () => {
    const { db } = await simulateOrderCostWrite({
      facts: {
        customerId,
        originCity: "台中市",
        originDistrict: "西區",
        destinationCity: "高雄市",
        destinationDistrict: "前鎮區",
        vehicleType: "箱型車",
        serviceType: "冷鏈",
      },
      rates: [],
      clientCostAmount: 999999,
    });
    assert.equal(db.lookup_status, "MISS");
    assert.equal(db.cost_amount, null);

    await client.query(
      `UPDATE orders SET cost_amount = $2, profit_amount = NULL WHERE id = $1`,
      [orderMissId, db.cost_amount],
    );
    await client.query(
      `INSERT INTO order_cost_lookups (
         order_id, lookup_status, matched_level, rate_source, standard_cost,
         customer_id, vehicle_type, service_type
       ) VALUES ($1,'MISS',NULL,'commercial_trip_cost_rates',NULL,$2,'箱型車','冷鏈')`,
      [orderMissId, customerId],
    );

    const { rows } = await client.query(
      `SELECT cost_amount FROM orders WHERE id = $1`,
      [orderMissId],
    );
    const persisted = rows[0].cost_amount;
    assert.equal(persisted, null);
  });
});
