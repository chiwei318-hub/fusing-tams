import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcOrderFinanceCostLookup,
  reportCountsCostZeroAsKnown,
  reportGrossMarginAggregate,
  orderFinanceTrigger,
} from "./formulas.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ordersSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/orders.ts"),
  "utf8"
);

describe("MONEY #2d characterization: cost unknown after #2dA writer repair", () => {
  it("A: valid rate 800 → known cost 800", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: "A1",
      rate_row: { driver_pay_rate: 800, rate_per_trip: 1000 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);
  });

  it("B: missing rate row → cost NULL (not 0)", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: "MISSING",
      rate_row: null,
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("C: missing prefix → cost NULL", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: null,
      rate_row: null,
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("D: both rates NULL → NULL", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: null, rate_per_trip: null },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
  });

  it("E: driver_pay 0 uses rate_per_trip", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: 0, rate_per_trip: 500 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, 500);
  });

  it("E2: both rates 0 → NULL unknown (not verified zero)", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: 0, rate_per_trip: 0 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("G: no false high profit on missing rate", () => {
    const r = calcOrderFinanceCostLookup({ rate_row: null, total_fee: 10000 });
    assert.equal(r.profit_amount, null);
    const mirror = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 0, rate_per_trip: 0 });
    assert.equal(mirror.cost_amount, null);
    assert.equal(mirror.profit_amount, null);
  });

  it("H: report NULL cost not COMPLETE", () => {
    const agg = reportGrossMarginAggregate([
      { total_fee: 10000, cost_amount: null, profit_amount: null },
    ]);
    assert.equal(agg.cost_data_complete, false);
    assert.equal(agg.driver_cost, null);
  });

  it("legacy historical zero still false-known if row unchanged", () => {
    const z = reportCountsCostZeroAsKnown(0);
    assert.equal(z.potential_false_known, true);
  });

  it("source forbids old COALESCE to 0 fallback", () => {
    assert.doesNotMatch(
      ordersSrc,
      /COALESCE\(NULLIF\(driver_pay_rate,\s*0\),\s*rate_per_trip,\s*0\)/
    );
  });
});
