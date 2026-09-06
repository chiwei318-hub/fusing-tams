/**
 * commercialCostEngine — STANDARD_DRIVER_TRIP_COST lookup for commercial orders.
 *
 * Ladder: L1 district → L2 city → L3 customer+vehicle default → L4 NULL
 * service_type: exact → NULL-default within each level
 * block_fallthrough: only within applicable service precedence candidates
 * QUERY_FAILURE: stop immediately, no fallthrough
 * Ambiguous multi-row at a unique slot: QUERY_FAILURE (never LIMIT 1 silence)
 *
 * Does NOT modify calc_order_finance / Shopee path.
 */

export type LookupStatus = "MATCHED" | "MISS" | "QUERY_FAILURE";

export type CommercialCostFacts = {
  customerId: number | null;
  originCity: string | null;
  originDistrict: string | null;
  destinationCity: string | null;
  destinationDistrict: string | null;
  vehicleType: string | null;
  serviceType?: string | null;
};

export type RateRow = {
  id: number;
  matchLevel: 1 | 2 | 3;
  originCity: string | null;
  originDistrict: string | null;
  destinationCity: string | null;
  destinationDistrict: string | null;
  vehicleType: string;
  serviceType: string | null;
  standardDriverTripCost: number;
  active: boolean;
  blockFallthrough: boolean;
};

export type CommercialCostResult = {
  lookupStatus: LookupStatus;
  matchedLevel: 1 | 2 | 3 | null;
  rateRuleId: number | null;
  standardCost: number | null;
  rateSource: string | null;
  errorClass: string | null;
  notes: string | null;
  /** Levels attempted before stop (for audit / QF proof of no illegal fallthrough) */
  attemptedLevels: number[];
};

export type RateQueryFn = (args: {
  level: 1 | 2 | 3;
  facts: CommercialCostFacts;
}) => Promise<RateRow[]> | RateRow[];

function norm(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

function costPositive(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

/**
 * Within one match_level: apply service precedence exact → NULL-default.
 * Only rows for the requested service (or NULL service) are considered for blockers.
 */
export function resolveServicePrecedence(
  rows: RateRow[],
  requestedService: string | null,
): { kind: "MATCHED"; row: RateRow } | { kind: "BLOCKED" } | { kind: "MISS" } | { kind: "AMBIGUOUS" } {
  const svc = norm(requestedService);

  const exactPool = svc
    ? rows.filter((r) => norm(r.serviceType) === svc)
    : [];
  const nullPool = rows.filter((r) => norm(r.serviceType) == null);

  const tryPool = (pool: RateRow[]): ReturnType<typeof resolveServicePrecedence> | null => {
    if (pool.length === 0) return null;

    const blockers = pool.filter((r) => r.blockFallthrough === true && r.active === false);
    if (blockers.length > 0) return { kind: "BLOCKED" };

    const actives = pool.filter((r) => r.active === true);
    if (actives.length === 0) return { kind: "MISS" };
    if (actives.length > 1) return { kind: "AMBIGUOUS" };

    const row = actives[0];
    if (costPositive(row.standardDriverTripCost) == null) return { kind: "AMBIGUOUS" };
    return { kind: "MATCHED", row };
  };

  if (svc) {
    const exact = tryPool(exactPool);
    if (exact) {
      if (exact.kind === "BLOCKED") return exact;
      if (exact.kind === "AMBIGUOUS") return exact;
      if (exact.kind === "MATCHED") return exact;
      // exact MISS → try NULL-default
    }
  }

  const fallback = tryPool(nullPool);
  if (fallback) return fallback;
  return { kind: "MISS" };
}

function shapeOk(level: 1 | 2 | 3, facts: CommercialCostFacts): boolean {
  const oc = norm(facts.originCity);
  const od = norm(facts.originDistrict);
  const dc = norm(facts.destinationCity);
  const dd = norm(facts.destinationDistrict);
  const vt = norm(facts.vehicleType);
  if (!vt) return false;
  if (level === 1) return !!(oc && od && dc && dd);
  if (level === 2) return !!(oc && dc);
  return true; // L3 needs customer+vehicle only
}

/**
 * Pure ladder. Inject queryFn for tests / DB adapter.
 */
export async function lookupCommercialTripCost(
  facts: CommercialCostFacts,
  queryFn: RateQueryFn,
): Promise<CommercialCostResult> {
  const attemptedLevels: number[] = [];
  const customerId = facts.customerId;
  const vehicleType = norm(facts.vehicleType);

  if (customerId == null || customerId <= 0 || !vehicleType) {
    return {
      lookupStatus: "MISS",
      matchedLevel: null,
      rateRuleId: null,
      standardCost: null,
      rateSource: "commercial_trip_cost_rates",
      errorClass: null,
      notes: "missing customer_id or vehicle_type",
      attemptedLevels,
    };
  }

  const levels: Array<1 | 2 | 3> = [1, 2, 3];

  for (const level of levels) {
    if (!shapeOk(level, facts)) continue;
    attemptedLevels.push(level);

    let rows: RateRow[];
    try {
      rows = await queryFn({ level, facts: { ...facts, vehicleType, customerId } });
    } catch (err) {
      return {
        lookupStatus: "QUERY_FAILURE",
        matchedLevel: null,
        rateRuleId: null,
        standardCost: null,
        rateSource: "commercial_trip_cost_rates",
        errorClass: "QUERY_FAILURE",
        notes: err instanceof Error ? err.message : String(err),
        attemptedLevels,
      };
    }

    // Filter to geometric shape for this level (defense in depth)
    const shaped = rows.filter((r) => {
      if (r.matchLevel !== level) return false;
      if (r.vehicleType !== vehicleType) return false;
      if (level === 1) {
        return (
          norm(r.originCity) === norm(facts.originCity) &&
          norm(r.originDistrict) === norm(facts.originDistrict) &&
          norm(r.destinationCity) === norm(facts.destinationCity) &&
          norm(r.destinationDistrict) === norm(facts.destinationDistrict)
        );
      }
      if (level === 2) {
        return (
          norm(r.originCity) === norm(facts.originCity) &&
          norm(r.destinationCity) === norm(facts.destinationCity) &&
          norm(r.originDistrict) == null &&
          norm(r.destinationDistrict) == null
        );
      }
      return (
        norm(r.originCity) == null &&
        norm(r.originDistrict) == null &&
        norm(r.destinationCity) == null &&
        norm(r.destinationDistrict) == null
      );
    });

    const resolved = resolveServicePrecedence(shaped, facts.serviceType ?? null);

    if (resolved.kind === "AMBIGUOUS") {
      return {
        lookupStatus: "QUERY_FAILURE",
        matchedLevel: null,
        rateRuleId: null,
        standardCost: null,
        rateSource: "commercial_trip_cost_rates",
        errorClass: "AMBIGUOUS_RATE_ROWS",
        notes: `level ${level}: multiple active rows for same service slot`,
        attemptedLevels,
      };
    }

    if (resolved.kind === "BLOCKED") {
      return {
        lookupStatus: "MISS",
        matchedLevel: null,
        rateRuleId: null,
        standardCost: null,
        rateSource: "commercial_trip_cost_rates",
        errorClass: "BLOCK_FALLTHROUGH",
        notes: `level ${level}: block_fallthrough in applicable service scope`,
        attemptedLevels,
      };
    }

    if (resolved.kind === "MATCHED") {
      const cost = costPositive(resolved.row.standardDriverTripCost);
      if (cost == null) {
        return {
          lookupStatus: "QUERY_FAILURE",
          matchedLevel: null,
          rateRuleId: null,
          standardCost: null,
          rateSource: "commercial_trip_cost_rates",
          errorClass: "INVALID_COST",
          notes: `level ${level}: non-positive standard cost`,
          attemptedLevels,
        };
      }
      return {
        lookupStatus: "MATCHED",
        matchedLevel: level,
        rateRuleId: resolved.row.id,
        standardCost: cost,
        rateSource: "commercial_trip_cost_rates",
        errorClass: null,
        notes: null,
        attemptedLevels,
      };
    }

    // MISS at this level → fall through (unless we should not — BLOCKED already returned)
  }

  return {
    lookupStatus: "MISS",
    matchedLevel: null,
    rateRuleId: null,
    standardCost: null,
    rateSource: "commercial_trip_cost_rates",
    errorClass: null,
    notes: "L1/L2/L3 miss",
    attemptedLevels,
  };
}

/**
 * Client-supplied cost is NEVER authoritative.
 * Engine result alone decides persisted cost_amount.
 */
export function decidePersistedCostAmount(args: {
  engine: CommercialCostResult;
  clientCostAmount?: number | null;
  /** prior DB value — used only on QUERY_FAILURE for updates */
  priorCostAmount?: number | null;
  mode: "create" | "update";
}): { costAmount: number | null; ignoredClientCost: boolean } {
  const ignoredClientCost =
    args.clientCostAmount !== undefined && args.clientCostAmount !== null;

  if (args.engine.lookupStatus === "MATCHED" && args.engine.standardCost != null) {
    return { costAmount: args.engine.standardCost, ignoredClientCost };
  }

  if (args.engine.lookupStatus === "QUERY_FAILURE") {
    if (args.mode === "update") {
      return {
        costAmount: args.priorCostAmount ?? null,
        ignoredClientCost,
      };
    }
    return { costAmount: null, ignoredClientCost };
  }

  // MISS
  return { costAmount: null, ignoredClientCost };
}

export function computeProfitFromFee(
  totalFee: number | null | undefined,
  costAmount: number | null,
): number | null {
  if (totalFee == null || !Number.isFinite(Number(totalFee)) || Number(totalFee) <= 0) {
    return null;
  }
  if (costAmount == null || !Number.isFinite(costAmount)) return null;
  return Math.round((Number(totalFee) - costAmount) * 100) / 100;
}
