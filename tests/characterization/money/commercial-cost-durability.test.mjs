/**
 * #12 COMMERCIAL_COST_OVERWRITE_ON_TRIGGER_REFIRE — durability characterization
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  calcOrderFinanceUpdate,
  calcOrderFinanceCostLookup,
  orderFinanceTrigger,
} from "./formulas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ordersSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/orders.ts"),
  "utf8",
);

describe("#12 commercial cost durability (calc_order_finance UPDATE)", () => {
  it("#12-1 COMMERCIAL + total_fee UPDATE preserves cost; profit = fee - cost", () => {
    const r = calcOrderFinanceUpdate({
      old_route_prefix: null,
      new_route_prefix: null,
      total_fee: 12000,
      existing_cost_amount: 3100,
      rate_row: null,
    });
    assert.equal(r.transition, "T1_NULL_TO_NULL_PRESERVE");
    assert.equal(r.cost_amount, 3100);
    assert.equal(r.profit_amount, 8900);
    assert.notEqual(r.cost_amount, null);
    assert.notEqual(r.profit_amount, 12000 * 0.15);
    assert.notEqual(r.cost_amount, 12000 * 0.7);
    assert.notEqual(r.cost_amount, 12000 * 0.8);
  });

  it("#12-2 COMMERCIAL + fusingao_fleet_id UPDATE (same T1) preserves cost", () => {
    // Trigger fires on fusingao_fleet_id; cost branch identical for NULL→NULL
    const r = calcOrderFinanceUpdate({
      old_route_prefix: null,
      new_route_prefix: null,
      total_fee: 10000,
      existing_cost_amount: 3100,
      rate_row: null,
    });
    assert.equal(r.cost_amount, 3100);
    assert.equal(r.profit_amount, 6900);
  });

  it("#12-3 UNKNOWN NULL stays NULL on total_fee UPDATE", () => {
    const r = calcOrderFinanceUpdate({
      old_route_prefix: null,
      new_route_prefix: null,
      total_fee: 12000,
      existing_cost_amount: null,
      rate_row: null,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
    assert.notEqual(r.cost_amount, 0);
  });

  it("#12-4 NULL → SHOPEE: route_prefix_rates owns cost", () => {
    const r = calcOrderFinanceUpdate({
      old_route_prefix: null,
      new_route_prefix: "FN",
      total_fee: 10000,
      existing_cost_amount: 3100, // prior commercial must yield to Shopee
      rate_row: { driver_pay_rate: 800, rate_per_trip: 1000 },
    });
    assert.equal(r.transition, "T2_NULL_TO_SHOPEE");
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);
    assert.notEqual(r.cost_amount, 3100);
  });

  it("#12-5 SHOPEE → SHOPEE: existing lookup unchanged", () => {
    const r = calcOrderFinanceUpdate({
      old_route_prefix: "FN",
      new_route_prefix: "FN",
      total_fee: 10000,
      existing_cost_amount: 800,
      rate_row: { driver_pay_rate: 800, rate_per_trip: 1000 },
    });
    assert.equal(r.transition, "T3_SHOPEE_TO_SHOPEE");
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);

    const insertLike = calcOrderFinanceCostLookup({
      route_prefix: "FN",
      rate_row: { driver_pay_rate: 800, rate_per_trip: 1000 },
      total_fee: 10000,
    });
    assert.equal(insertLike.cost_amount, 800);
    assert.equal(insertLike.profit_amount, 9200);
  });

  it("#12-6 SHOPEE → NULL: stale Shopee cost NOT retained", () => {
    const r = calcOrderFinanceUpdate({
      old_route_prefix: "FN",
      new_route_prefix: null,
      total_fee: 10000,
      existing_cost_amount: 800,
      rate_row: null,
    });
    assert.equal(r.transition, "T4_SHOPEE_TO_NULL");
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
    assert.notEqual(r.cost_amount, 800);
  });

  it("source: trigger implements T1 preserve / T4 clear / Shopee assign", () => {
    assert.ok(ordersSrc.includes("COMMERCIAL_COST_OVERWRITE_ON_TRIGGER_REFIRE"));
    assert.ok(ordersSrc.includes("T1: NULL → NULL stable"));
    assert.ok(ordersSrc.includes("T4: Shopee → NULL"));
    assert.ok(ordersSrc.includes("TG_OP = 'INSERT'"));
    assert.ok(ordersSrc.includes("OLD.route_prefix IS NOT NULL"));
    // profit uses final cost_amount
    assert.ok(ordersSrc.includes("NEW.total_fee - NEW.cost_amount"));
    // must not always assign v_rate unconditionally without branch
    assert.ok(ordersSrc.includes("ELSIF NEW.route_prefix IS NOT NULL THEN"));
  });

  it("gross profit formula remains fee - cost; VAT not deducted", () => {
    const r = calcOrderFinanceUpdate({
      old_route_prefix: null,
      new_route_prefix: null,
      total_fee: 10000,
      existing_cost_amount: 800,
    });
    assert.equal(r.vat_amount, 500);
    assert.equal(r.profit_amount, 9200);
    assert.notEqual(r.profit_amount, 10000 - 800 - 500);

    const shopee = orderFinanceTrigger({
      total_fee: 10000,
      driver_pay_rate: 800,
    });
    assert.equal(shopee.profit_amount, 9200);
  });
});
