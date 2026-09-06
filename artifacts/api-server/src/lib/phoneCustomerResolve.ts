/**
 * Phone normalize + customer resolve (Chair Phase 0).
 * Ambiguous (>1) → NULL customer_id; never guess.
 */

export function normalizePhone(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).replace(/[\s\-().]/g, "").trim();
}

export type PhoneResolveStatus = "NONE" | "ONE" | "AMBIGUOUS";

export type PhoneResolveResult = {
  status: PhoneResolveStatus;
  customerId: number | null;
};

/**
 * @param matches customer ids whose normalized phone equals the query
 */
export function resolveCustomerIdFromMatches(
  matches: ReadonlyArray<{ id: number }>,
): PhoneResolveResult {
  if (matches.length === 0) return { status: "NONE", customerId: null };
  if (matches.length === 1) return { status: "ONE", customerId: matches[0].id };
  return { status: "AMBIGUOUS", customerId: null };
}

/** Enterprise → customer auto-map is forbidden. */
export function resolveEnterpriseCustomerId(explicitCustomerId: number | null | undefined): number | null {
  if (explicitCustomerId == null) return null;
  const n = Number(explicitCustomerId);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
