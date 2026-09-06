/**
 * MONEY #3C REPAIR — stop fake ×15% profit (Option B-leaning).
 * Trigger inserts NULL profit/revenue/margin; Writer B AR−AP unchanged.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  orderFinanceTrigger,
  financialsAutoCreateTrigger,
  financialsAutoCreateTriggerLegacy15,
  financialsCalcJs,
  financialsMonthlyProfitSum,
  financialsPendingProfitCount,
  financialsFmtProfitCell,
  financialsFmtMarginCell,
} from "./formulas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const finSrc = readFileSync(join(root, "artifacts/api-server/src/routes/financials.ts"), "utf8");
const dashSrc = readFileSync(
  join(root, "artifacts/logistics/src/pages/admin/FinancialsDashboard.tsx"),
  "utf8"
);

describe("MONEY #3C REPAIR A: trigger inserts NULL profit (not ×15)", () => {
  it("fee=10000 → profit/revenue/margin NULL; ap still ×80", () => {
    const r = financialsAutoCreateTrigger({ total_fee: 10000 });
    assert.equal(r.platform_profit, null);
    assert.equal(r.platform_revenue, null);
    assert.equal(r.profit_margin_pct, null);
    assert.equal(r.ap_total, 8000);
    assert.equal(r.ar_total, 10000);
  });

  it("source: trigger VALUES use NULL; no * 0.15 into platform_profit", () => {
    const block = finSrc.slice(
      finSrc.indexOf("auto_create_financials"),
      finSrc.indexOf("async function calcFinancials")
    );
    assert.match(block, /NULL,\s*\n\s*NULL,\s*\n\s*NULL/);
    assert.doesNotMatch(block, /platform_profit[\s\S]*\*\s*0\.15|COALESCE\(NEW\.total_fee,\s*0\)\s*\*\s*0\.15/);
    assert.match(block, /ON CONFLICT \(order_id\) DO NOTHING/);
  });
});

describe("MONEY #3C REPAIR B: Writer B AR−AP unchanged", () => {
  it("recalc AR=10000 AP=8000 → profit 2000", () => {
    const r = financialsCalcJs({ total_fee: 10000 });
    assert.equal(r.platform_profit, 2000);
    assert.equal(r.profit_margin_pct, 20);
  });

  it("calcFinancials still AR−AP; still has AP ×80 fallback", () => {
    const start = finSrc.indexOf("async function calcFinancials");
    const calc = finSrc.slice(start, start + 2500);
    assert.match(calc, /platform_profit\s*=\s*ar_total\s*-\s*ap_total/);
    assert.match(calc, /Math\.round\(ar_total\s*\*\s*0\.80\)/);
  });
});

describe("MONEY #3C REPAIR C: UI NULL display policy", () => {
  it("fmt: null → 待計算 / —; zero stays numeric", () => {
    assert.equal(financialsFmtProfitCell(null), "待計算");
    assert.equal(financialsFmtProfitCell(0), "$0");
    assert.equal(financialsFmtMarginCell(null), "—");
    assert.equal(financialsFmtMarginCell(20), "20%");
  });

  it("dashboard uses fmtProfitCell / 待計算; not n(platform_profit) alone", () => {
    assert.match(dashSrc, /待計算/);
    assert.match(dashSrc, /fmtProfitCell/);
    assert.doesNotMatch(dashSrc, /\$\{n\(f\.platform_profit\)\}/);
    assert.doesNotMatch(dashSrc, /f\.profit_margin_pct \?\? 0/);
  });
});

describe("MONEY #3C REPAIR D: aggregate NULL behavior (record only)", () => {
  it("SUM skips NULL; mixed known+pending → AGGREGATE_COMPLETENESS_GAP", () => {
    const rows = [
      financialsAutoCreateTrigger({ total_fee: 10000 }), // pending
      financialsCalcJs({ total_fee: 10000 }), // 2000
    ];
    assert.equal(financialsPendingProfitCount(rows), 1);
    assert.equal(financialsMonthlyProfitSum(rows), 2000);
    // Would look complete if UI only shows $2000 without pending count
    assert.ok(financialsPendingProfitCount(rows) > 0);
  });
});

describe("MONEY #3C REPAIR E: historical ×15 rows unchanged (KEEP AS-IS)", () => {
  it("legacy fixture still documents old 1500; new trigger ≠ legacy", () => {
    const legacy = financialsAutoCreateTriggerLegacy15({ total_fee: 10000 });
    const neu = financialsAutoCreateTrigger({ total_fee: 10000 });
    assert.equal(legacy.platform_profit, 1500);
    assert.equal(neu.platform_profit, null);
    assert.notEqual(legacy.platform_profit, neu.platform_profit);
  });
});

describe("MONEY #3C isolation: canonical GP / Case D improved for NEW rows", () => {
  it("unknown cost → GP NULL; NEW trigger profit also NULL (no fake 1500)", () => {
    const gp = orderFinanceTrigger({
      total_fee: 10000,
      driver_pay_rate: 0,
      rate_per_trip: 0,
    });
    const fin = financialsAutoCreateTrigger({ total_fee: 10000 });
    assert.equal(gp.profit_amount, null);
    assert.equal(fin.platform_profit, null);
  });

  it("known cost GP 9200 still ≠ recalc 2000 (concepts remain separate)", () => {
    const gp = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 800 }).profit_amount;
    const b = financialsCalcJs({ total_fee: 10000 }).platform_profit;
    assert.equal(gp, 9200);
    assert.equal(b, 2000);
    assert.notEqual(gp, b);
  });
});
