import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orderFinanceTrigger } from "./formulas.mjs";

describe("characterization: calc_order_finance (exclusive trigger mirror)", () => {
  it("total_fee=0 → vat 0, cost from rate, profit null", () => {
    const r = orderFinanceTrigger({ total_fee: 0, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 0);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, null);
  });

  it("total_fee=1000, driver_pay_rate=800", () => {
    const r = orderFinanceTrigger({ total_fee: 1000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 50);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 150);
  });

  it("total_fee=10000, driver_pay_rate=800 → tax 500 grand path", () => {
    const r = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 500);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 8700);
  });

  it("total_fee=100000, driver_pay_rate=800", () => {
    const r = orderFinanceTrigger({ total_fee: 100000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 5000);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 94200);
  });

  it("NULL driver_pay_rate falls back to rate_per_trip", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: null, rate_per_trip: 1000 });
    assert.equal(r.cost_amount, 1000);
    assert.equal(r.vat_amount, 105);
    assert.equal(r.profit_amount, 995);
  });

  it("driver_pay_rate=0 treated as missing → rate_per_trip", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 0, rate_per_trip: 900 });
    assert.equal(r.cost_amount, 900);
  });

  it("total_fee=2100, driver_pay_rate=800 exclusive", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 800 });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.vat_amount, 105);
    assert.equal(r.profit_amount, 1195);
  });
});
