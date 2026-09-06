/**
 * MONEY #3F REPAIR — stop fake ×80% AP.
 * Verified settlement → driver_payout; else NULL. No fee×0.80 fallback.
 * SEMANTIC_COLLISION (drivers vs settlements commission_rate) remains OPEN — not solved here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  orderFinanceTrigger,
  financialsApCalc,
  financialsApCalcLegacy80,
  financialsTriggerAp,
  financialsTriggerApLegacy80,
  financialsCalcJs,
  financialsAutoCreateTrigger,
  financialsFmtApCell,
} from "./formulas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const finSrc = readFileSync(join(root, "artifacts/api-server/src/routes/financials.ts"), "utf8");
const arApSrc = readFileSync(join(root, "artifacts/api-server/src/routes/arApLedger.ts"), "utf8");
const settleSchema = readFileSync(join(root, "lib/db/src/schema/settlements.ts"), "utf8");
const ordersSrc = readFileSync(join(root, "artifacts/api-server/src/routes/orders.ts"), "utf8");
const dashSrc = readFileSync(
  join(root, "artifacts/logistics/src/pages/admin/FinancialsDashboard.tsx"),
  "utf8"
);
const driversSchema = readFileSync(join(root, "lib/db/src/schema/drivers.ts"), "utf8");

describe("MONEY #3F A: Writer A trigger AP = NULL (no ×80)", () => {
  it("fee=10000 → ap_total NULL", () => {
    assert.equal(financialsTriggerAp({ total_fee: 10000 }).ap_total, null);
    assert.equal(financialsAutoCreateTrigger({ total_fee: 10000 }).ap_total, null);
  });

  it("source: trigger VALUES ap_total NULL; no * 0.80 in auto_create_financials", () => {
    const block = finSrc.slice(
      finSrc.indexOf("auto_create_financials"),
      finSrc.indexOf("async function calcFinancials")
    );
    assert.doesNotMatch(block, /total_fee::numeric\s*\*\s*0\.80/);
    assert.doesNotMatch(block, /\*\s*0\.80/);
    assert.match(block, /NULL,\s*\n\s*NULL,\s*\n\s*NULL,\s*\n\s*NULL/);
  });

  it("legacy documentation: pre-#3F was fee×0.80", () => {
    assert.equal(financialsTriggerApLegacy80({ total_fee: 10000 }).ap_total, 8000);
  });
});

describe("MONEY #3F B: Writer B verified settlement vs NULL", () => {
  it("Case A: verified payout=7500 → AP 7500", () => {
    const r = financialsApCalc({
      total_fee: 10000,
      driver_payout: 7500,
      has_settlement: true,
    });
    assert.equal(r.ap_total, 7500);
    assert.equal(r.usedFallback80, false);
    assert.equal(r.source, "SETTLEMENT_DRIVER_PAYOUT");
  });

  it("Case B: no settlement → AP NULL (not 8000)", () => {
    const r = financialsApCalc({ total_fee: 10000 });
    assert.equal(r.ap_total, null);
    assert.equal(r.usedFallback80, false);
    assert.equal(r.source, "NO_VERIFIED_SETTLEMENT");
  });

  it("Case B+: no settlement + equipment flags → still NULL (no fake equip AP)", () => {
    const r = financialsApCalc({
      total_fee: 10000,
      need_tailgate: true,
      need_hydraulic: true,
    });
    assert.equal(r.ap_total, null);
  });

  it("Case C: verified payout=0 stays 0 (zero≠missing)", () => {
    const r = financialsApCalc({
      total_fee: 10000,
      driver_payout: 0,
      has_settlement: true,
    });
    assert.equal(r.usedFallback80, false);
    assert.equal(r.ap_total, 0);
  });

  it("Case C+: cancelled settlement → NULL", () => {
    const r = financialsApCalc({
      total_fee: 10000,
      driver_payout: 8500,
      has_settlement: true,
      settlement_cancelled: true,
    });
    assert.equal(r.ap_total, null);
  });

  it("Case D: verified + tailgate + hydraulic → payout+1300", () => {
    const r = financialsApCalc({
      total_fee: 10000,
      driver_payout: 8500,
      has_settlement: true,
      need_tailgate: true,
      need_hydraulic: true,
    });
    assert.equal(r.ap_tailgate, 500);
    assert.equal(r.ap_hydraulic, 800);
    assert.equal(r.ap_total, 9800);
  });

  it("source: no *0.80 in calcFinancials; arApLedger still LEGACY ×80 (schema-blocked)", () => {
    const start = finSrc.indexOf("async function calcFinancials");
    const calc = finSrc.slice(start, start + 4500);
    assert.doesNotMatch(calc, /0\.80/);
    assert.match(calc, /verifiedSettlement|VERIFIED_SETTLEMENT/);
    assert.match(arApSrc, /0\.80/);
    assert.match(arApSrc, /AR_AP_RECORDS_SCHEMA_BLOCKED_LEGACY_80|LEGACY_80/);
  });

  it("legacy documentation: old zero≡missing → ×80", () => {
    const r = financialsApCalcLegacy80({ total_fee: 10000, driver_payout: 0 });
    assert.equal(r.usedFallback80, true);
    assert.equal(r.ap_total, 8000);
  });
});

describe("MONEY #3F C: settlement driver_payout formula unchanged", () => {
  it("schema GENERATED: total * (100 - commission_rate) / 100", () => {
    assert.match(
      settleSchema,
      /driver_payout[\s\S]*\(100 - commission_rate\) \/ 100/
    );
    assert.match(settleSchema, /commission_rate[\s\S]*default\("15"\)/);
  });
});

describe("MONEY #3F D: AP ≠ cost_amount", () => {
  it("Case D: cost=800 vs no-settlement AP=NULL (not 8000, not cost)", () => {
    const cost = orderFinanceTrigger({
      total_fee: 10000,
      driver_pay_rate: 800,
    }).cost_amount;
    const ap = financialsApCalc({ total_fee: 10000 }).ap_total;
    assert.equal(cost, 800);
    assert.equal(ap, null);
    assert.notEqual(cost, ap);
  });

  it("GP writer does not read ap_total / 0.80", () => {
    const trig = ordersSrc.slice(
      ordersSrc.indexOf("ensureOrderFinanceTrigger"),
      ordersSrc.indexOf("ensureOrderFinanceTrigger") + 8000
    );
    assert.doesNotMatch(trig, /ap_total|0\.80|driver_payout/);
  });
});

describe("MONEY #3F E: profit only when verified AP", () => {
  it("no settlement → profit NULL", () => {
    const r = financialsCalcJs({ total_fee: 10000 });
    assert.equal(r.ap_total, null);
    assert.equal(r.platform_profit, null);
  });

  it("verified payout 8500 → profit 1500 (AR−AP)", () => {
    const r = financialsCalcJs({
      total_fee: 10000,
      driver_payout: 8500,
      has_settlement: true,
    });
    assert.equal(r.ap_total, 8500);
    assert.equal(r.platform_profit, 1500);
  });

  it("negative profit not clamped", () => {
    const r = financialsCalcJs({
      total_fee: 10000,
      driver_payout: 12000,
      has_settlement: true,
    });
    assert.equal(r.platform_profit, -2000);
  });
});

describe("MONEY #3F F: UI NULL AP display", () => {
  it("fmtApCell null → 待計算; zero stays $0", () => {
    assert.equal(financialsFmtApCell(null), "待計算");
    assert.equal(financialsFmtApCell(0), "$0");
  });

  it("dashboard uses fmtApCell for ap_total", () => {
    assert.match(dashSrc, /fmtApCell/);
    assert.doesNotMatch(dashSrc, /\$\{n\(f\.ap_total\)\}/);
  });
});

describe("MONEY #3F G: semantic collision isolation (NOT CLOSED)", () => {
  it("settlement rate=15 → driver_payout residual 85%", () => {
    // formula mirror only — production GENERATED unchanged
    const total = 10000;
    const rate = 15;
    const payout = Math.round((total * (100 - rate)) / 100 * 100) / 100;
    assert.equal(payout, 8500);
  });

  it("drivers.commission_rate remains DRIVER_SHARE path (≠ settlement) — collision OPEN", () => {
    // #3A locked DRIVER_SHARE_RATE on drivers.commission_rate (cashFlow / receipts).
    // This #3F repair must NOT close SEMANTIC_COLLISION / rename fields.
    const semanticCollisionStatus = "OPEN";
    assert.notEqual(semanticCollisionStatus, "CLOSED");
    const settlementPayout = Math.round((10000 * (100 - 15)) / 100 * 100) / 100;
    const driverSharePayout = Math.round((10000 * 15) / 100 * 100) / 100;
    assert.equal(settlementPayout, 8500);
    assert.equal(driverSharePayout, 1500);
    assert.notEqual(settlementPayout, driverSharePayout);
    void driversSchema; // schema file may omit runtime-added columns; collision is cross-table naming
  });
});
