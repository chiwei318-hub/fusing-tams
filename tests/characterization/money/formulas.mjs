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

/** Production: calc_order_finance trigger — exclusive */
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
  const vat = round2(total * 0.05);
  // LOCKED: profit = net - direct cost; VAT not subtracted
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
