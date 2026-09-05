import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orderFinanceTrigger } from "./formulas.mjs";

describe("characterization: calc_order_finance (trigger mirror)", () => {
  it("total_fee=0 → vat 0, cost from rate, profit null", () => {
    const r = orderFinanceTrigger({ total_fee: 0, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 0);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, null);
  });

  it("total_fee=1000, driver_pay_rate=800", () => {
    const r = orderFinanceTrigger({ total_fee: 1000, driver_pay_rate: 800 });
    // 1000/1.05*0.05 = 47.619... → 47.62
    assert.equal(r.vat_amount, 47.62);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 152.38);
  });

  it("total_fee=10000, driver_pay_rate=800 (smoke verified earlier: 2100→800/100/1200 pattern)", () => {
    const r = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 476.19);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 8723.81);
  });

  it("total_fee=100000, driver_pay_rate=800", () => {
    const r = orderFinanceTrigger({ total_fee: 100000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 4761.9);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 94438.1);
  });

  it("NULL driver_pay_rate falls back to rate_per_trip", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: null, rate_per_trip: 1000 });
    assert.equal(r.cost_amount, 1000);
    assert.equal(r.vat_amount, 100);
    assert.equal(r.profit_amount, 1000);
  });

  it("driver_pay_rate=0 treated as missing → rate_per_trip", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 0, rate_per_trip: 900 });
    assert.equal(r.cost_amount, 900);
  });

  it("regression: total_fee=2100, driver_pay_rate=800 (live DB smoke)", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 800 });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.vat_amount, 100);
    assert.equal(r.profit_amount, 1200);
  });
});
