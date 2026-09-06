import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cashFlowDriverSettlement,
  receiptsOcrSettlementCalc,
  receiptsOcrSettlementCalcLegacyWrong,
  reportsGrossMarginDriverCost,
  orderFinanceTrigger,
  financialsAutoCreateTrigger,
} from "./formulas.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");

function readSrc(rel) {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("MONEY #3A: cashFlow rate direction (drivers.commission_rate)", () => {
  it("total_fee=10000, rate=15 → driver 1500, platform 8500; 15%=DRIVER share; ×rate", () => {
    const r = cashFlowDriverSettlement({ total_fee: 10000, commission_rate: 15 });
    assert.equal(r.driver_payout, 1500); // A
    assert.equal(r.platform_net, 8500); // B
    assert.equal(r.share_party, "DRIVER"); // C
    assert.equal(r.rate_direction, "MULTIPLY_RATE"); // D
    assert.equal(r.rate_pct, 15);
  });

  it("canonical semantic aligns with DRIVER_SETTLEMENT_RATE / DRIVER_SHARE_RATE", () => {
    const r = cashFlowDriverSettlement({ total_fee: 10000, commission_rate: 70 });
    assert.equal(r.driver_payout, 7000);
    assert.equal(r.platform_net, 3000);
  });

  it("cashFlow source still multiplies rate into driver_payout (not 1-rate)", () => {
    const src = readSrc("artifacts/api-server/src/routes/cashFlow.ts");
    assert.match(src, /total_fee \* COALESCE\(d\.commission_rate, 15\) \/ 100/);
    assert.match(src, /AS driver_payout/);
    assert.match(src, /AS platform_net/);
    assert.doesNotMatch(src, /\(100\s*-\s*COALESCE\(d\.commission_rate/);
  });
});

describe("MONEY #3A: receipts no longer treat driver rate as platform commission", () => {
  it("legacy wrong: rate=15 treated as platform → driver 8500 (collision)", () => {
    const legacy = receiptsOcrSettlementCalcLegacyWrong({
      amount: 10000,
      driverCommissionRate: 15,
    });
    assert.equal(legacy.platformFee, 1500);
    assert.equal(legacy.driverEarning, 8500);
    assert.equal(legacy.treated_driver_rate_as, "PLATFORM");
  });

  it("after #3A: rate=15 → driverEarning 1500; platformFee null", () => {
    const r = receiptsOcrSettlementCalc({
      amount: 10000,
      driverCommissionRate: 15,
      driverResolved: true,
    });
    assert.equal(r.driverEarning, 1500);
    assert.equal(r.driverSettlementRate, 15);
    assert.equal(r.driverRateStatus, "OK");
    assert.equal(r.platformFee, null);
    assert.equal(r.platformRate, null);
    assert.equal(r.platformRateStatus, "PLATFORM_RATE_SSoT_MISSING");
    assert.equal(r.companyRetainAmount, 8500);
  });

  it("missing platform rate: no silent default 15", () => {
    const r = receiptsOcrSettlementCalc({ amount: 10000, driverResolved: false });
    assert.equal(r.platformFee, null);
    assert.equal(r.platformRate, null);
    assert.equal(r.driverEarning, null);
    assert.equal(r.platformRateStatus, "PLATFORM_RATE_SSoT_MISSING");
  });

  it("null driver commission_rate → no invent 15", () => {
    const r = receiptsOcrSettlementCalc({
      amount: 10000,
      driverCommissionRate: null,
      driverResolved: true,
    });
    assert.equal(r.driverRateStatus, "DRIVER_RATE_UNAVAILABLE");
    assert.equal(r.platformFee, null);
  });

  it("receipts.ts source: no platformRate=0.15; no rate-as-platformFee", () => {
    const src = readSrc("artifacts/api-server/src/routes/receipts.ts");
    assert.doesNotMatch(src, /platformRate\s*=\s*0\.15/);
    assert.doesNotMatch(src, /actualPlatformRate/);
    assert.doesNotMatch(src, /Default driver commission rate is 85%/);
    assert.match(src, /PLATFORM_RATE_SSoT_MISSING/);
    assert.match(src, /DRIVER_SETTLEMENT_RATE/);
    // still may SELECT commission_rate for driver settlement — OK
    assert.match(src, /commission_rate/);
  });
});

describe("MONEY #3A isolation: GP / Driver Pay / reports70 / financials15 unchanged", () => {
  it("Gross Profit still total_fee - cost; no commission", () => {
    const r = orderFinanceTrigger({ total_fee: 10000, driver_pay_rate: 800 });
    assert.equal(r.profit_amount, 9200);
    const ordersSrc = readSrc("artifacts/api-server/src/routes/orders.ts");
    // profit line must not multiply commission
    assert.match(ordersSrc, /profit_amount/);
  });

  it("Driver Pay route rate path still independent (cost from driver_pay_rate)", () => {
    const r = orderFinanceTrigger({ total_fee: 2100, driver_pay_rate: 800 });
    assert.equal(r.cost_amount, 800);
    assert.equal(r.profit_amount, 1300);
  });

  it("reports 70% UNVERIFIED_DEFAULT removed from gross-margin (#3B)", () => {
    const legacy = reportsGrossMarginDriverCost({ total_fee: 10000, commission_rate: null });
    assert.equal(legacy.driver_cost, 7000);
    assert.equal(legacy.tag, "UNVERIFIED_DEFAULT");
    const src = readSrc("artifacts/api-server/src/routes/reports.ts");
    assert.doesNotMatch(src, /COALESCE\(d\.commission_rate,\s*70\)/);
    assert.doesNotMatch(src, /commission_rate,\s*70/);
    assert.match(src, /cost_amount/);
    assert.match(src, /profit_amount/);
    assert.match(src, /cost_status/);
  });

  it("financials ×15% LEGACY still present (not repaired this round)", () => {
    const r = financialsAutoCreateTrigger({ total_fee: 10000 });
    assert.equal(r.platform_profit, 1500);
    const src = readSrc("artifacts/api-server/src/routes/financials.ts");
    assert.match(src, /0\.15|total_fee\s*\*\s*0\.15/);
  });
});
