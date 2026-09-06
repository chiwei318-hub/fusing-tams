import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcOrderFinanceCostLookup,
  orderFinanceTrigger,
  reportGrossMarginAggregate,
  reportCountsCostZeroAsKnown,
} from "./formulas.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ordersSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/orders.ts"),
  "utf8"
);
const sheetsSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/sheetsExport.ts"),
  "utf8"
);
const firebaseSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/firebaseSync.ts"),
  "utf8"
);

describe("MONEY #2dA: cost unknown writer repair", () => {
  it("CASE A: driver_pay_rate=800 → cost=800 profit=fee-800", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: "A1",
      rate_row: { driver_pay_rate: 800, rate_per_trip: 1000 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);
  });

  it("CASE B: driver_pay NULL, rate_per_trip=800 → cost=800", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: null, rate_per_trip: 800 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 9200);
  });

  it("CASE C: prefix missing → cost=NULL profit=NULL", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: null,
      rate_row: null,
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("CASE D: rate row missing → cost=NULL profit=NULL", () => {
    const r = calcOrderFinanceCostLookup({
      route_prefix: "X",
      rate_row: null,
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("CASE E: both rates NULL → NULL", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: null, rate_per_trip: null },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("CASE F: both rates 0 → UNKNOWN NULL (not verified zero)", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: 0, rate_per_trip: 0 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, null);
    assert.equal(r.profit_amount, null);
  });

  it("CASE G: driver_pay=0 rate_per_trip=800 → cost=800", () => {
    const r = calcOrderFinanceCostLookup({
      rate_row: { driver_pay_rate: 0, rate_per_trip: 800 },
      total_fee: 10000,
    });
    assert.equal(r.cost_amount, 800);
  });

  it("CASE H: total_fee=NULL → profit=NULL", () => {
    const r = orderFinanceTrigger({
      total_fee: null,
      driver_pay_rate: 800,
    });
    assert.equal(r.profit_amount, null);
    assert.equal(r.cost_amount, 800);
  });

  it("CASE I: negative gross profit allowed", () => {
    const r = orderFinanceTrigger({
      total_fee: 10000,
      driver_pay_rate: 12000,
    });
    assert.equal(r.cost_amount, 12000);
    assert.equal(r.profit_amount, -2000);
  });

  it("FALSE HIGH PROFIT regression: missing rate → NULL not fee", () => {
    const before = { cost_amount: 0, profit_amount: 10000 };
    const after = calcOrderFinanceCostLookup({
      rate_row: null,
      total_fee: 10000,
    });
    assert.equal(before.profit_amount, 10000);
    assert.equal(after.cost_amount, null);
    assert.equal(after.profit_amount, null);
    assert.notEqual(after.profit_amount, 10000);
  });

  it("report: NULL cost → PARTIAL/UNKNOWN not COMPLETE with full profit", () => {
    const r = reportGrossMarginAggregate([
      { total_fee: 10000, cost_amount: null, profit_amount: null },
    ]);
    assert.equal(r.driver_cost, null);
    assert.equal(r.gross_profit, null);
    assert.equal(r.gross_margin_pct, null);
    assert.ok(r.cost_status === "UNKNOWN" || r.cost_status === "PARTIAL");
    assert.equal(r.cost_data_complete, false);
  });

  it("source: no COALESCE(..., 0) as unknown fallback in trigger lookup", () => {
    assert.match(ordersSrc, /MONEY #2dA/);
    assert.doesNotMatch(
      ordersSrc,
      /COALESCE\(NULLIF\(driver_pay_rate,\s*0\),\s*rate_per_trip,\s*0\)/
    );
    assert.match(
      ordersSrc,
      /COALESCE\(NULLIF\(driver_pay_rate,\s*0\),\s*NULLIF\(rate_per_trip,\s*0\)\)/
    );
    assert.match(ordersSrc, /NEW\.profit_amount := NULL/);
  });

  it("export: no COALESCE profit inventing full fee", () => {
    assert.doesNotMatch(
      sheetsSrc,
      /COALESCE\(profit_amount,\s*total_fee\s*-\s*COALESCE\(driver_pay/
    );
    assert.doesNotMatch(
      firebaseSrc,
      /COALESCE\(profit_amount,\s*total_fee\s*-\s*COALESCE\(driver_pay/
    );
  });

  it("historical cost=0 still counts known in report (unchanged rows) — documented risk", () => {
    const z = reportCountsCostZeroAsKnown(0);
    assert.equal(z.potential_false_known, true);
  });
});
