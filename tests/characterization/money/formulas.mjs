/**
 * CHARACTERIZATION FIXTURES — production money formulas as of tax REPAIR (exclusive VAT).
 * Business rule: total_fee = net; tax = net × 0.05; grand = net + tax.
 *
 * Source evidence:
 * - calc_order_finance: artifacts/api-server/src/routes/orders.ts (exclusive)
 * - auto_create_financials: financials.ts (~82-87) — still ×0.15 / ×1.05 commercial split
 * - calcFinancials (JS): financials.ts (~127-141) exclusive AR tax
 * - monthlyBilling generate: exclusive
 * - monthlyBilling invoice-from-bill: exclusive on order sum (tax_engine)
 * - autoInvoice: exclusive
 * - invoicePdf monthly: exclusive on order sum
 */

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Production: calc_order_finance trigger — exclusive VAT; #2dA unknown cost → null */
export function orderFinanceTrigger({ total_fee, driver_pay_rate, rate_per_trip = 0 }) {
  const rate = (() => {
    const d = Number(driver_pay_rate);
    if (driver_pay_rate != null && !Number.isNaN(d) && d > 0) return d;
    const t = Number(rate_per_trip);
    if (rate_per_trip != null && !Number.isNaN(t) && t > 0) return t;
    return null;
  })();

  if (total_fee == null || !(Number(total_fee) > 0)) {
    return { vat_amount: 0, cost_amount: rate, profit_amount: null };
  }
  const total = Number(total_fee);
  const vat = round2(total * 0.05);
  if (rate == null) {
    return { vat_amount: vat, cost_amount: null, profit_amount: null };
  }
  const profit = round2(total - rate);
  return { vat_amount: vat, cost_amount: rate, profit_amount: profit };
}

export function financialsAutoCreateTrigger({ total_fee }) {
  const t = Number(total_fee) || 0;
  return {
    ar_total: t,
    ar_grand_total: t * 1.05,
    ap_total: t * 0.8,
    platform_profit: t * 0.15,
    platform_revenue: t * 0.15,
    profit_margin_pct: 15,
  };
}

export function financialsCalcJs({ total_fee: ar_total, ap_base = 0, need_tailgate = false, need_hydraulic = false }) {
  const ar = Number(ar_total) || 0;
  const ar_tax = Math.round(ar * 0.05 * 100) / 100;
  const ar_grand = ar + ar_tax;
  const ap_tailgate = need_tailgate ? 500 : 0;
  const ap_other = need_hydraulic ? 800 : 0;
  let base = Number(ap_base) || 0;
  if (base <= 0) base = Math.round(ar * 0.8);
  const ap_total = base + ap_tailgate + ap_other;
  const platform_profit = ar - ap_total;
  const profit_margin_pct = ar > 0 ? Math.round((platform_profit / ar) * 1000) / 10 : 0;
  return { ar_total: ar, ar_tax, ar_grand_total: ar_grand, ap_base: base, ap_total, platform_profit, profit_margin_pct };
}

export function monthlyBillingGenerateExclusive(total) {
  const taxAmount = Math.round(Number(total) * 0.05);
  return { taxAmount, totalWithTax: Number(total) + taxAmount, basis: "exclusive" };
}

/** invoice-from-bill: exclusive on order net sum (yuan) */
export function monthlyBillingInvoiceExclusive(netSum) {
  const taxAmount = Math.round(Number(netSum) * 0.05);
  return { taxAmount, amount: Number(netSum), totalAmount: Number(netSum) + taxAmount, basis: "exclusive" };
}

export function autoInvoiceExclusive(rawAmount) {
  const taxRate = 5;
  const taxAmount = Math.round(Number(rawAmount) * (taxRate / 100));
  return { taxAmount, totalAmount: Number(rawAmount) + taxAmount, basis: "exclusive" };
}

export function invoicePdfExclusive(netSum) {
  const taxAmount = Math.round(Number(netSum) * 0.05);
  return { taxAmount, basis: "exclusive" };
}

/** tax_engine mirror */
export function calcExclusiveVat(netAmount, roundMode = "cent") {
  const net = Number(netAmount) || 0;
  const taxAmount = roundMode === "yuan" ? Math.round(net * 0.05) : Math.round(net * 0.05 * 100) / 100;
  return { net, taxAmount, grandTotal: net + taxAmount, basis: "exclusive", rateVersion: "TW-VAT-0.05-default" };
}

/**
 * cashFlow.ts — drivers.commission_rate as DRIVER_SETTLEMENT_RATE (driver share).
 * Evidence: driver_payout = total_fee * COALESCE(rate,15)/100; platform_net = total_fee - driver_payout
 */
export function cashFlowDriverSettlement({ total_fee, commission_rate, silentDefault = 15 }) {
  const fee = Number(total_fee) || 0;
  const rate =
    commission_rate == null || commission_rate === ""
      ? Number(silentDefault)
      : Number(commission_rate);
  const driver_payout = Math.round(fee * (rate / 100));
  const platform_net = Math.round(fee - fee * (rate / 100));
  return {
    driver_payout,
    platform_net,
    rate_direction: "MULTIPLY_RATE",
    share_party: "DRIVER",
    rate_pct: rate,
  };
}

/**
 * receipts OCR #3A — DRIVER_SETTLEMENT_RATE only; platform commission null (no silent 15).
 * Mirrors artifacts/api-server/src/routes/receipts.ts post-repair contract.
 */
export function receiptsOcrSettlementCalc({
  amount,
  driverCommissionRate = null,
  driverResolved = false,
}) {
  const amt = Number(amount);
  const base = {
    amount: amt,
    driverSettlementRate: null,
    driverRate: null,
    driverEarning: null,
    driverRateStatus: "DRIVER_RATE_UNAVAILABLE",
    platformRate: null,
    platformFee: null,
    platformRateStatus: "PLATFORM_RATE_SSoT_MISSING",
    companyRetainAmount: null,
  };
  if (!driverResolved) return base;
  if (driverCommissionRate == null || driverCommissionRate === "") return base;
  const parsed = Number(driverCommissionRate);
  if (Number.isNaN(parsed)) return base;
  const driverEarning = Math.round(amt * (parsed / 100));
  return {
    ...base,
    driverSettlementRate: parsed,
    driverRate: parsed,
    driverEarning,
    driverRateStatus: "OK",
    companyRetainAmount: Math.round(amt - driverEarning),
  };
}

/** LEGACY receipts (pre-#3A) — DO NOT USE; characterization of old collision */
export function receiptsOcrSettlementCalcLegacyWrong({ amount, driverCommissionRate }) {
  const amt = Number(amount);
  const actualPlatformRate = (Number(driverCommissionRate) || 15) / 100;
  return {
    platformRate: actualPlatformRate * 100,
    driverRate: (1 - actualPlatformRate) * 100,
    platformFee: Math.round(amt * actualPlatformRate),
    driverEarning: Math.round(amt * (1 - actualPlatformRate)),
    treated_driver_rate_as: "PLATFORM",
  };
}

/** reports gross-margin — UNVERIFIED_DEFAULT 70; LEGACY pre-#3B — do not use */
export function reportsGrossMarginDriverCost({ total_fee, commission_rate }) {
  const fee = Number(total_fee) || 0;
  const rate = commission_rate == null || commission_rate === "" ? 70 : Number(commission_rate);
  return { driver_cost: Math.round(fee * (rate / 100)), silent_default: 70, tag: "UNVERIFIED_DEFAULT" };
}

/**
 * MONEY #3B — report month aggregate from canonical order money fields.
 * UNKNOWN cost/profit → PARTIAL; known subtotal must not become full driver_cost.
 * cost_amount === 0 is known zero (not auto-null).
 */
export function reportGrossMarginAggregate(orders, { franchise_cost = 0 } = {}) {
  const list = Array.isArray(orders) ? orders : [];
  let gross_revenue = 0;
  let cost_known_count = 0;
  let cost_unknown_count = 0;
  let profit_known_count = 0;
  let profit_unknown_count = 0;
  let driver_cost_known_sum = 0;
  let profit_known_sum = 0;

  for (const o of list) {
    gross_revenue += Number(o.total_fee) || 0;
    if (o.cost_amount == null) cost_unknown_count += 1;
    else {
      cost_known_count += 1;
      driver_cost_known_sum += Number(o.cost_amount);
    }
    if (o.profit_amount == null) profit_unknown_count += 1;
    else {
      profit_known_count += 1;
      profit_known_sum += Number(o.profit_amount);
    }
  }

  const complete = cost_unknown_count === 0 && profit_unknown_count === 0;
  const cost_status = complete
    ? "COMPLETE"
    : cost_known_count > 0 || profit_known_count > 0
      ? "PARTIAL"
      : "UNKNOWN";

  const driver_cost = complete ? driver_cost_known_sum : null;
  const gross_profit = complete ? profit_known_sum : null;
  const gross_margin_pct =
    complete && gross_revenue > 0
      ? Math.round((profit_known_sum / gross_revenue) * 1000) / 10
      : null;

  return {
    order_count: list.length,
    gross_revenue,
    franchise_cost: Number(franchise_cost) || 0,
    cost_known_count,
    cost_unknown_count,
    profit_known_count,
    profit_unknown_count,
    driver_cost_known_sum,
    profit_known_sum,
    cost_data_complete: complete,
    cost_status,
    driver_cost,
    gross_profit,
    gross_margin_pct,
  };
}

/**
 * MONEY #2dA — mirror of calc_order_finance cost lookup (AFTER repair).
 * Valid: driver_pay_rate > 0 else rate_per_trip > 0 else NULL (never COALESCE to 0).
 */
export function calcOrderFinanceCostLookup({
  route_prefix = null,
  rate_row = undefined,
  total_fee = null,
} = {}) {
  let v_rate = null;
  if (rate_row != null && rate_row !== false) {
    const dpr = rate_row.driver_pay_rate;
    const rpt = rate_row.rate_per_trip;
    if (dpr != null && Number(dpr) > 0) v_rate = Number(dpr);
    else if (rpt != null && Number(rpt) > 0) v_rate = Number(rpt);
    else v_rate = null;
  }

  const fee = total_fee == null ? null : Number(total_fee);
  let profit_amount = null;
  if (fee != null && fee > 0 && v_rate != null) {
    profit_amount = Math.round((fee - v_rate) * 100) / 100;
  }
  return {
    route_prefix: route_prefix ?? null,
    cost_amount: v_rate,
    profit_amount,
    used_coalesce_zero: false,
    semantic_if_zero:
      v_rate == null
        ? "UNKNOWN_NULL"
        : Number(v_rate) === 0
          ? "SHOULD_NOT_HAPPEN"
          : "KNOWN",
  };
}

/** #3B report: cost_amount=0 counts as known (IS NOT NULL) — CURRENT */
export function reportCountsCostZeroAsKnown(cost_amount) {
  const isNull = cost_amount == null;
  return {
    cost_unknown: isNull,
    cost_known: !isNull,
    potential_false_known: !isNull && Number(cost_amount) === 0,
  };
}

/** sheetsExport fmtMoneyNullable policy (#2dA display):
 * null → blank; numeric 0 → "0"; never !value / || 0
 */
export function sheetsFmtMoneyNullable(v) {
  if (v == null) return "";
  return Number(v).toFixed(0);
}

/** Legacy generic fmt used for COALESCE'd columns — null still "0" */
export function sheetsFmtLegacy(v) {
  if (v == null) return "0";
  return Number(v).toFixed(0);
}

/**
 * firebaseSync nullableMoney (#2dA): NULL stays null; never Number(null)→0 / NaN→0
 */
export function firebaseNullableMoney(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
