import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orderFinanceTrigger } from "./formulas.mjs";

describe("characterization: calc_order_finance (exclusive VAT; profit no VAT deduct)", () => {
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
    assert.equal(r.profit_amount, 200);
  });

  it("total_fee=10000, driver_pay_rate=800 → tax 500, profit 9200", () => {
    const r = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 500);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);
  });

  it("total_fee=100000, driver_pay_rate=800", () => {
    const r = orderFinanceTrigger({ total_fee: 100000, driver_pay_rate: 800 });
    assert.equal(r.vat_amount, 5000);
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 99200);
  });

  it("NULL driver_pay_rate falls back to rate_per_trip", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: null, rate_per_trip: 1000 });
    assert.equal(r.cost_amount, 1000);
    assert.equal(r.vat_amount, 105);
    assert.equal(r.profit_amount, 1100);
  });

  it("driver_pay_rate=0 treated as missing → rate_per_trip", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 0, rate_per_trip: 900 });
    assert.equal(r.cost_amount, 900);
  });

  it("both rates missing/0 → cost NULL profit NULL (#2dA)", () => {
    const r = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 0, rate_per_trip: 0 });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
    assert.equal(r.vat_amount, 500);
  });

  it("total_fee=2100, driver_pay_rate=800", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 800 });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.vat_amount, 105);
    assert.equal(r.profit_amount, 1300);
  });
});
