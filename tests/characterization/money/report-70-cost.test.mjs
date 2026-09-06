import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  reportGrossMarginAggregate,
  reportsGrossMarginDriverCost,
  orderFinanceTrigger,
  financialsAutoCreateTrigger,
} from "./formulas.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const reportsSrc = readFileSync(join(repoRoot, "artifacts/api-server/src/routes/reports.ts"), "utf8");
const uiSrc = readFileSync(
  join(repoRoot, "artifacts/logistics/src/pages/admin/FinanceReportsTab.tsx"),
  "utf8"
);

describe("MONEY #3B: report gross-margin canonical cost (no 70%)", () => {
  it("source: no commission_rate / COALESCE 70 in gross-margin cost", () => {
    assert.doesNotMatch(reportsSrc, /COALESCE\(d\.commission_rate,\s*70\)/);
    const start = reportsSrc.indexOf('reportsRouter.get("/reports/gross-margin"');
    const end = reportsSrc.indexOf("reportsRouter.get", start + 1);
    const gm = end === -1 ? reportsSrc.slice(start) : reportsSrc.slice(start, end);
    assert.ok(gm.includes("gross-margin"));
    assert.doesNotMatch(gm, /JOIN\s+drivers/i);
    assert.doesNotMatch(gm, /d\.commission_rate/);
    assert.match(gm, /o\.cost_amount/);
    assert.match(gm, /o\.profit_amount/);
  });

  it("Case A: fee=10000 cost=800 profit=9200 → canonical report", () => {
    const r = reportGrossMarginAggregate([
      { total_fee: 10000, cost_amount: 800, profit_amount: 9200 },
    ]);
    assert.equal(r.gross_revenue, 10000);
    assert.equal(r.driver_cost, 800);
    assert.equal(r.gross_profit, 9200);
    assert.equal(r.gross_margin_pct, 92);
    assert.equal(r.cost_status, "COMPLETE");
    assert.equal(r.cost_data_complete, true);
    // old 70% would have been 7000
    const legacy = reportsGrossMarginDriverCost({ total_fee: 10000, commission_rate: null });
    assert.equal(legacy.driver_cost, 7000);
    assert.notEqual(r.driver_cost, legacy.driver_cost);
  });

  it("Case B: cost=NULL → not 7000 / not fake GP 3000; PARTIAL/UNKNOWN", () => {
    const r = reportGrossMarginAggregate([
      { total_fee: 10000, cost_amount: null, profit_amount: null },
    ]);
    assert.equal(r.driver_cost, null);
    assert.equal(r.gross_profit, null);
    assert.equal(r.gross_margin_pct, null);
    assert.notEqual(r.driver_cost, 7000);
    assert.notEqual(r.gross_profit, 3000);
    assert.ok(r.cost_status === "UNKNOWN" || r.cost_status === "PARTIAL");
    assert.equal(r.cost_data_complete, false);
  });

  it("Case C: cost=0 stays known zero (not auto-null)", () => {
    const r = reportGrossMarginAggregate([
      { total_fee: 10000, cost_amount: 0, profit_amount: 10000 },
    ]);
    assert.equal(r.driver_cost, 0);
    assert.equal(r.gross_profit, 10000);
    assert.equal(r.cost_status, "COMPLETE");
    assert.equal(r.cost_known_count, 1);
    assert.equal(r.cost_unknown_count, 0);
  });

  it("Case D: fee=0 cost=0 → margin null (no fake 0% as complete margin story if revenue 0)", () => {
    const r = reportGrossMarginAggregate([
      { total_fee: 0, cost_amount: 0, profit_amount: 0 },
    ]);
    assert.equal(r.gross_revenue, 0);
    assert.equal(r.driver_cost, 0);
    assert.equal(r.gross_profit, 0);
    assert.equal(r.gross_margin_pct, null);
    assert.equal(r.cost_status, "COMPLETE");
  });

  it("Case E MIXED: known subtotal must not masquerade as full driver_cost", () => {
    const r = reportGrossMarginAggregate([
      { total_fee: 10000, cost_amount: 800, profit_amount: 9200 },
      { total_fee: 5000, cost_amount: null, profit_amount: null },
    ]);
    assert.equal(r.gross_revenue, 15000);
    assert.equal(r.driver_cost_known_sum, 800);
    assert.equal(r.cost_known_count, 1);
    assert.equal(r.cost_unknown_count, 1);
    assert.equal(r.cost_status, "PARTIAL");
    assert.equal(r.cost_data_complete, false);
    // CRITICAL: full fields null — known 800 is NOT the reported driver_cost
    assert.equal(r.driver_cost, null);
    assert.equal(r.gross_profit, null);
    assert.equal(r.gross_margin_pct, null);
    assert.notEqual(r.driver_cost, r.driver_cost_known_sum);
  });

  it("UI handles null / PARTIAL without coercing ?? 0 for cost columns", () => {
    assert.match(uiSrc, /PARTIAL|部分資料|資料不足/);
    assert.match(uiSrc, /numOrNull|driver_cost_known_sum/);
    assert.doesNotMatch(
      uiSrc.slice(uiSrc.indexOf("GrossMarginPanel")),
      /driver_cost:\s*Number\(r\.driver_cost\s*\?\?\s*0\)/
    );
  });

  it("isolation: GP writer / financials×15 unchanged", () => {
    const gp = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 800 });
    assert.equal(gp.profit_amount, 9200);
    const fin = financialsAutoCreateTrigger({ total_fee: 10000 });
    assert.equal(fin.platform_profit, 1500);
  });
});
