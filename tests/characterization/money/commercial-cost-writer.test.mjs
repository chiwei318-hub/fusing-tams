/**
 * #6 Writer — commercial cost engine + security + phone + provenance contracts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  normalizePhone,
  resolveCustomerIdFromMatches,
  resolveEnterpriseCustomerId,
  lookupCommercialTripCost,
  decidePersistedCostAmount,
  simulateOrderCostWrite,
} from "./commercial-cost-engine.mjs";
import { calcOrderFinanceCostLookup } from "./formulas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const ordersSrc = readFileSync(join(root, "artifacts/api-server/src/routes/orders.ts"), "utf8");
const engineSrc = readFileSync(
  join(root, "artifacts/api-server/src/lib/commercialCostEngine.ts"),
  "utf8",
);
const applySrc = readFileSync(
  join(root, "artifacts/api-server/src/lib/applyCommercialOrderCost.ts"),
  "utf8",
);
const qopSrc = readFileSync(
  join(root, "artifacts/logistics/src/components/QuickOrderPanel.tsx"),
  "utf8",
);
const twSrc = readFileSync(
  join(root, "artifacts/logistics/src/components/TaiwanAddressInput.tsx"),
  "utf8",
);
const enterpriseSrc = readFileSync(
  join(root, "artifacts/api-server/src/routes/enterprise.ts"),
  "utf8",
);

const BASE_FACTS = {
  customerId: 42,
  originCity: "台北市",
  originDistrict: "中山區",
  destinationCity: "新北市",
  destinationDistrict: "板橋區",
  vehicleType: "箱型車",
  serviceType: "冷鏈",
};

function rate(partial) {
  return {
    id: partial.id,
    matchLevel: partial.matchLevel,
    originCity: partial.originCity ?? null,
    originDistrict: partial.originDistrict ?? null,
    destinationCity: partial.destinationCity ?? null,
    destinationDistrict: partial.destinationDistrict ?? null,
    vehicleType: partial.vehicleType ?? "箱型車",
    serviceType: partial.serviceType ?? null,
    standardDriverTripCost: partial.standardDriverTripCost,
    active: partial.active ?? true,
    blockFallthrough: partial.blockFallthrough ?? false,
  };
}

describe("#6 commercial cost engine ladder", () => {
  it("1. L1 match → cost = L1 standard_cost", async () => {
    const rates = [
      rate({
        id: 1,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "冷鏈",
        standardDriverTripCost: 3100,
      }),
      rate({
        id: 2,
        matchLevel: 3,
        standardDriverTripCost: 999,
      }),
    ];
    const { db } = await simulateOrderCostWrite({ facts: BASE_FACTS, rates });
    assert.equal(db.lookup_status, "MATCHED");
    assert.equal(db.matched_level, 1);
    assert.equal(db.cost_amount, 3100);
    assert.equal(db.standard_cost, 3100);
    assert.equal(db.rate_rule_id, 1);
  });

  it("2. L1 miss, L2 match → cost = L2", async () => {
    const rates = [
      rate({
        id: 10,
        matchLevel: 2,
        originCity: "台北市",
        destinationCity: "新北市",
        serviceType: null,
        standardDriverTripCost: 2500,
      }),
      rate({
        id: 11,
        matchLevel: 3,
        standardDriverTripCost: 1800,
      }),
    ];
    const { db } = await simulateOrderCostWrite({ facts: BASE_FACTS, rates });
    assert.equal(db.matched_level, 2);
    assert.equal(db.cost_amount, 2500);
  });

  it("3. L1/L2 miss, L3 approved default → cost = fixture L3 (not average/%)", async () => {
    const approvedL3 = 1800;
    const rates = [
      rate({
        id: 20,
        matchLevel: 3,
        serviceType: null,
        standardDriverTripCost: approvedL3,
      }),
    ];
    const { db, engine } = await simulateOrderCostWrite({ facts: BASE_FACTS, rates });
    assert.equal(db.matched_level, 3);
    assert.equal(db.cost_amount, approvedL3);
    assert.equal(engine.standardCost, approvedL3);
    assert.notEqual(db.cost_amount, Math.round(approvedL3 * 0.7));
    assert.notEqual(db.cost_amount, Math.round(approvedL3 * 0.8));
  });

  it("4. L1/L2/L3 all miss → cost NULL, MISS", async () => {
    const { db } = await simulateOrderCostWrite({ facts: BASE_FACTS, rates: [] });
    assert.equal(db.lookup_status, "MISS");
    assert.equal(db.cost_amount, null);
    assert.equal(db.matched_level, null);
  });

  it("5. QUERY_FAILURE → NULL, no further fallback levels after failure", async () => {
    let calls = 0;
    const queryFn = async ({ level }) => {
      calls += 1;
      if (level === 1) throw new Error("db down");
      return [
        rate({
          id: 99,
          matchLevel: 3,
          standardDriverTripCost: 1800,
        }),
      ];
    };
    const engine = await lookupCommercialTripCost(BASE_FACTS, queryFn);
    assert.equal(engine.lookupStatus, "QUERY_FAILURE");
    assert.equal(engine.standardCost, null);
    assert.deepEqual(engine.attemptedLevels, [1]);
    assert.equal(calls, 1);
    const decided = decidePersistedCostAmount({
      engine,
      clientCostAmount: 999999,
      mode: "create",
    });
    assert.equal(decided.costAmount, null);
  });

  it("9. provenance fields recorded for MATCHED/MISS/QUERY_FAILURE", async () => {
    const matched = await simulateOrderCostWrite({
      facts: BASE_FACTS,
      rates: [
        rate({
          id: 1,
          matchLevel: 1,
          originCity: "台北市",
          originDistrict: "中山區",
          destinationCity: "新北市",
          destinationDistrict: "板橋區",
          serviceType: "冷鏈",
          standardDriverTripCost: 3100,
        }),
      ],
    });
    assert.equal(matched.db.lookup_status, "MATCHED");
    assert.ok(matched.db.rate_rule_id);

    const miss = await simulateOrderCostWrite({ facts: BASE_FACTS, rates: [] });
    assert.equal(miss.db.lookup_status, "MISS");

    const qf = await lookupCommercialTripCost(BASE_FACTS, async () => {
      throw new Error("boom");
    });
    assert.equal(qf.lookupStatus, "QUERY_FAILURE");
    assert.equal(qf.errorClass, "QUERY_FAILURE");
  });

  it("12. block_fallthrough scoped by service — 冷鏈 not blocked by 夜間", async () => {
    const rates = [
      rate({
        id: 50,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "夜間",
        active: false,
        blockFallthrough: true,
        standardDriverTripCost: 4000,
      }),
      rate({
        id: 51,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "冷鏈",
        active: true,
        blockFallthrough: false,
        standardDriverTripCost: 3100,
      }),
    ];
    const { db } = await simulateOrderCostWrite({
      facts: { ...BASE_FACTS, serviceType: "冷鏈" },
      rates,
    });
    assert.equal(db.lookup_status, "MATCHED");
    assert.equal(db.cost_amount, 3100);
    assert.equal(db.rate_rule_id, 51);
  });

  it("12b. block_fallthrough on requested service STOP — no L2 fallthrough", async () => {
    const rates = [
      rate({
        id: 60,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "冷鏈",
        active: false,
        blockFallthrough: true,
        standardDriverTripCost: 3100,
      }),
      rate({
        id: 61,
        matchLevel: 2,
        originCity: "台北市",
        destinationCity: "新北市",
        serviceType: null,
        standardDriverTripCost: 2500,
      }),
    ];
    const { db, engine } = await simulateOrderCostWrite({
      facts: { ...BASE_FACTS, serviceType: "冷鏈" },
      rates,
    });
    assert.equal(db.cost_amount, null);
    assert.equal(engine.errorClass, "BLOCK_FALLTHROUGH");
    assert.deepEqual(engine.attemptedLevels, [1]);
  });

  it("13. ambiguous multi-row at level → QUERY_FAILURE, not LIMIT 1 first row", async () => {
    const rates = [
      rate({
        id: 70,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "冷鏈",
        standardDriverTripCost: 3100,
      }),
      rate({
        id: 71,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "冷鏈",
        standardDriverTripCost: 3200,
      }),
    ];
    const { db, engine } = await simulateOrderCostWrite({ facts: BASE_FACTS, rates });
    assert.equal(db.lookup_status, "QUERY_FAILURE");
    assert.equal(db.cost_amount, null);
    assert.equal(engine.errorClass, "AMBIGUOUS_RATE_ROWS");
    assert.notEqual(db.cost_amount, 3100);
  });
});

describe("#6 CORE SECURITY — client cost_amount ignored (DB decision evidence)", () => {
  it("11. MATCHED: request cost_amount=999999 but DB gets engine 3100", async () => {
    const rates = [
      rate({
        id: 1,
        matchLevel: 1,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        serviceType: "冷鏈",
        standardDriverTripCost: 3100,
      }),
    ];
    const { request, db, engine } = await simulateOrderCostWrite({
      facts: BASE_FACTS,
      rates,
      clientCostAmount: 999999,
    });
    assert.equal(request.cost_amount, 999999);
    assert.equal(engine.standardCost, 3100);
    assert.equal(db.cost_amount, 3100);
    assert.notEqual(db.cost_amount, 999999);
    assert.equal(db.client_cost_ignored, true);
  });

  it("11b. MISS: request cost_amount=999999 but DB stays NULL", async () => {
    const { request, db } = await simulateOrderCostWrite({
      facts: BASE_FACTS,
      rates: [],
      clientCostAmount: 999999,
    });
    assert.equal(request.cost_amount, 999999);
    assert.equal(db.lookup_status, "MISS");
    assert.equal(db.cost_amount, null);
    assert.notEqual(db.cost_amount, 999999);
    assert.notEqual(db.cost_amount, 0);
  });
});

describe("#6 phone resolve + enterprise no-map", () => {
  it("6a. phone 0 matches → NONE", () => {
    const r = resolveCustomerIdFromMatches([]);
    assert.equal(r.status, "NONE");
    assert.equal(r.customerId, null);
  });

  it("6b. phone 1 match → ONE", () => {
    const r = resolveCustomerIdFromMatches([{ id: 7 }]);
    assert.equal(r.status, "ONE");
    assert.equal(r.customerId, 7);
  });

  it("6c. phone >1 → AMBIGUOUS NULL", () => {
    const r = resolveCustomerIdFromMatches([{ id: 1 }, { id: 2 }]);
    assert.equal(r.status, "AMBIGUOUS");
    assert.equal(r.customerId, null);
  });

  it("6d. normalize strips separators", () => {
    assert.equal(normalizePhone("0912-345-678"), "0912345678");
    assert.equal(normalizePhone("(02) 1234 5678"), "0212345678");
  });

  it("7. enterprise without explicit customer → NULL (no auto-map)", () => {
    assert.equal(resolveEnterpriseCustomerId(undefined), null);
    assert.equal(resolveEnterpriseCustomerId(null), null);
    assert.equal(resolveEnterpriseCustomerId(55), 55);
    // enterprise create path must not invent customerId from account
    assert.ok(!/customerId:\s*account/.test(enterpriseSrc));
    assert.ok(!/customer_id:\s*id/.test(enterpriseSrc));
    const createSlice = enterpriseSrc.slice(
      enterpriseSrc.indexOf("const [order] = await db.insert(ordersTable)"),
      enterpriseSrc.indexOf("const [order] = await db.insert(ordersTable)") + 800,
    );
    assert.ok(!/customerId:/.test(createSlice));
  });
});

describe("#6 Shopee regression + source wiring", () => {
  it("8. Shopee route_prefix cost path formulas unchanged", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: "FN",
      rate_row: { driver_pay_rate: 800, rate_per_trip: 1000 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);
  });

  it("8b. applyCommercialOrderCost skips when route_prefix present", () => {
    assert.ok(applySrc.includes("route_prefix_present_shopee_path"));
    assert.ok(applySrc.includes("if (routePrefix)"));
  });

  it("intake persists city/district/customerId and ignores client cost on CREATE", () => {
    assert.ok(ordersSrc.includes("pickupCity: body.pickupCity"));
    assert.ok(ordersSrc.includes("pickupDistrict: body.pickupDistrict"));
    assert.ok(ordersSrc.includes("deliveryCity: body.deliveryCity"));
    assert.ok(ordersSrc.includes("applyCommercialOrderCost"));
    assert.ok(ordersSrc.includes("clientCostAmount"));
    assert.ok(ordersSrc.includes("never trust client cost"));
    // G3: PATCH may write body.costAmount; CREATE path still ignores via omit + engine
    assert.ok(/updates\.costAmount = body\.costAmount/.test(ordersSrc));
  });

  it("Fast UX wires customerId + onLocationChange city/district", () => {
    assert.ok(qopSrc.includes("customerId: customerId"));
    assert.ok(qopSrc.includes("pickupCity: pickupCity"));
    assert.ok(qopSrc.includes("pickupDistrict: pickupDistrict"));
    assert.ok(qopSrc.includes("onLocationChange"));
    assert.ok(twSrc.includes("onLocationChange?.("));
    assert.ok(twSrc.includes("city: c"));
    assert.ok(twSrc.includes("district: d"));
    // submit body must not assign cost fields
    assert.ok(qopSrc.includes("never send cost_amount"));
    assert.ok(!/costAmount\s*:/.test(qopSrc));
    assert.ok(!/cost_amount\s*:/.test(qopSrc));
  });

  it("engine source forbids LIMIT 1 silence / parallel money invent", () => {
    assert.ok(engineSrc.includes("AMBIGUOUS"));
    // must not contain executable LIMIT 1 query pattern
    assert.ok(!/LIMIT\s+1\s*;/.test(engineSrc));
    assert.ok(!/\.limit\(1\)/.test(engineSrc));
    assert.ok(engineSrc.includes("never LIMIT 1"));
    assert.ok(!/0\.7|0\.8|0\.15/.test(engineSrc));
  });
});
