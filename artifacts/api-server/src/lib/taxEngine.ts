/**
 * tax_engine — SSoT for Taiwan VAT on logistics fees (P0-Tax REPAIR)
 *
 * Business rule (locked 2026-09-06):
 *   total_fee / net = 未稅
 *   tax = net × rate (default 5%)
 *   grand = net + tax
 *
 * Do NOT use inclusive reverse (grand / 1.05 × 0.05).
 *
 * rateVersion is reserved for future rate-table versioning so historical
 * documents can pin the rate that applied at issue time (schema TBD).
 */

export const DEFAULT_VAT_RATE = 0.05;

/** Placeholder until tax_rate_versions table exists */
export const CURRENT_VAT_RATE_VERSION = "TW-VAT-0.05-default";

export type VatRoundMode = "cent" | "yuan";

export type ExclusiveVatResult = {
  net: number;
  taxAmount: number;
  grandTotal: number;
  rate: number;
  rateVersion: string;
  basis: "exclusive";
  roundMode: VatRoundMode;
};

export function roundVat(net: number, rate: number, mode: VatRoundMode): number {
  const n = Number(net) || 0;
  if (mode === "yuan") return Math.round(n * rate);
  return Math.round(n * rate * 100) / 100;
}

/**
 * Exclusive VAT: tax on top of net.
 * @param netAmount 未稅金額
 */
export function calcExclusiveVat(
  netAmount: number,
  opts?: { rate?: number; rateVersion?: string; roundMode?: VatRoundMode },
): ExclusiveVatResult {
  const rate = opts?.rate ?? DEFAULT_VAT_RATE;
  const roundMode = opts?.roundMode ?? "cent";
  const rateVersion = opts?.rateVersion ?? CURRENT_VAT_RATE_VERSION;
  const net = Number(netAmount) || 0;
  const taxAmount = roundVat(net, rate, roundMode);
  return {
    net,
    taxAmount,
    grandTotal: net + taxAmount,
    rate,
    rateVersion,
    basis: "exclusive",
    roundMode,
  };
}

/** Convenience aliases matching common call sites */
export function vatOnNetCents(net: number, rate = DEFAULT_VAT_RATE): number {
  return calcExclusiveVat(net, { rate, roundMode: "cent" }).taxAmount;
}

export function vatOnNetYuan(net: number, rate = DEFAULT_VAT_RATE): number {
  return calcExclusiveVat(net, { rate, roundMode: "yuan" }).taxAmount;
}
