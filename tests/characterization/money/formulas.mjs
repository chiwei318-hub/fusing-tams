/**
 * CHARACTERIZATION FIXTURES — mirror of production formulas as of 2026-09-06.
 * These are NOT the production source of truth. They document observed behavior.
 * Do not "fix" production to match these; update fixtures when production changes.
 *
 * Source evidence (file:line):
 * - calc_order_finance: artifacts/api-server/src/routes/orders.ts (~97-105)
 * - auto_create_financials: artifacts/api-server/src/routes/financials.ts (~82-87)
 * - calcFinancials (JS path): financials.ts (~127-141)
 * - monthlyBilling generate: monthlyBilling.ts (~104-105) EXCLUSIVE
 * - monthlyBilling invoice from bill: monthlyBilling.ts (~193-195) INCLUSIVE
 * - autoInvoice: lib/autoInvoice.ts (~98-100) EXCLUSIVE
 * - invoicePdf: lib/invoicePdf.ts (~257) INCLUSIVE
 */

/** PostgreSQL ROUND(n::numeric, 2) equivalent for positive values used here. */
export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Production: calc_order_finance trigger
 * VAT inclusive reverse: total_fee / 1.05 * 0.05
 * cost = COALESCE(NULLIF(driver_pay_rate,0), rate_per_trip, 0)
 * profit = total_fee - cost - vat  (NULL if total_fee missing/<=0)
 */
export function orderFinanceTrigger({ total_fee, driver_pay_rate, rate_per_trip = 0 }) {
  const rate = (() => {
    const d = Number(driver_pay_rate);
    if (driver_pay_rate != null && !Number.isNaN(d) && d !== 0) return d;
    return Number(rate_per_trip) || 0;
  })();

  if (total_fee == null || !(Number(total_fee) > 0)) {
    return { vat_amount: 0, cost_amount: rate, profit_amount: null };
  }
  const total = Number(total_fee);
  const vat = round2(total / 1.05 * 0.05);
  const profit = round2(total - rate - vat);
  return { vat_amount: vat, cost_amount: rate, profit_amount: profit };
}

/**
 * Production: auto_create_financials trigger on delivered
 * ar_total = total_fee
 * ar_grand_total = total_fee * 1.05
 * ap_total = total_fee * 0.80
 * platform_profit = total_fee * 0.15
 * platform_revenue = total_fee * 0.15  (same expression in SQL VALUES)
 * profit_margin_pct = 15
 */
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

/**
 * Production: calcFinancials() JS path (financials.ts)
 * ar_tax = round(ar_total * 0.05, 2-ish via *100/100)
 * ar_grand = ar_total + ar_tax
 * ap_base fallback = Math.round(ar_total * 0.80)
 * platform_profit = ar_total - ap_total
 */
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

/** Production: monthlyBilling generate — exclusive VAT on sum of fees */
export function monthlyBillingGenerateExclusive(total) {
  const taxAmount = Math.round(Number(total) * 0.05);
  return { taxAmount, totalWithTax: Number(total) + taxAmount, basis: "exclusive" };
}

/** Production: monthlyBilling invoice-from-bill — inclusive reverse on bill.total_amount */
export function monthlyBillingInvoiceInclusive(totalAmount) {
  const taxAmount = Math.round(Number(totalAmount) / 1.05 * 0.05);
  const amount = Number(totalAmount) - taxAmount;
  return { taxAmount, amount, basis: "inclusive" };
}

/** Production: autoInvoice — exclusive */
export function autoInvoiceExclusive(rawAmount) {
  const taxRate = 5;
  const taxAmount = Math.round(Number(rawAmount) * (taxRate / 100));
  return { taxAmount, totalAmount: Number(rawAmount) + taxAmount, basis: "exclusive" };
}

/** Production: invoicePdf — inclusive reverse */
export function invoicePdfInclusive(totalAmount) {
  const taxAmt = Math.round(Number(totalAmount) / 1.05 * 0.05);
  return { taxAmount: taxAmt, basis: "inclusive" };
}
