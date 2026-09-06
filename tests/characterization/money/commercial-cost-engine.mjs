/**
 * Mirror of artifacts/api-server/src/lib/commercialCostEngine.ts + phoneCustomerResolve.ts
 * for node:test characterization (no build step).
 */

export function normalizePhone(raw) {
  if (raw == null) return "";
  return String(raw).replace(/[\s\-().]/g, "").trim();
}

export function resolveCustomerIdFromMatches(matches) {
  if (matches.length === 0) return { status: "NONE", customerId: null };
  if (matches.length === 1) return { status: "ONE", customerId: matches[0].id };
  return { status: "AMBIGUOUS", customerId: null };
}

export function resolveEnterpriseCustomerId(explicitCustomerId) {
  if (explicitCustomerId == null) return null;
  const n = Number(explicitCustomerId);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function norm(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

function costPositive(n) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function resolveServicePrecedence(rows, requestedService) {
  const svc = norm(requestedService);
  const exactPool = svc ? rows.filter((r) => norm(r.serviceType) === svc) : [];
  const nullPool = rows.filter((r) => norm(r.serviceType) == null);

  const tryPool = (pool) => {
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
      if (exact.kind === "BLOCKED" || exact.kind === "AMBIGUOUS" || exact.kind === "MATCHED") {
        return exact;
      }
    }
  }
  const fallback = tryPool(nullPool);
  if (fallback) return fallback;
  return { kind: "MISS" };
}

function shapeOk(level, facts) {
  const oc = norm(facts.originCity);
  const od = norm(facts.originDistrict);
  const dc = norm(facts.destinationCity);
  const dd = norm(facts.destinationDistrict);
  const vt = norm(facts.vehicleType);
  if (!vt) return false;
  if (level === 1) return !!(oc && od && dc && dd);
  if (level === 2) return !!(oc && dc);
  return true;
}

export async function lookupCommercialTripCost(facts, queryFn) {
  const attemptedLevels = [];
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

  for (const level of [1, 2, 3]) {
    if (!shapeOk(level, facts)) continue;
    attemptedLevels.push(level);

    let rows;
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

export function decidePersistedCostAmount({ engine, clientCostAmount, priorCostAmount, mode }) {
  const ignoredClientCost = clientCostAmount !== undefined && clientCostAmount !== null;
  if (engine.lookupStatus === "MATCHED" && engine.standardCost != null) {
    return { costAmount: engine.standardCost, ignoredClientCost };
  }
  if (engine.lookupStatus === "QUERY_FAILURE") {
    if (mode === "update") {
      return { costAmount: priorCostAmount ?? null, ignoredClientCost };
    }
    return { costAmount: null, ignoredClientCost };
  }
  return { costAmount: null, ignoredClientCost };
}

/** Simulate writer: facts → engine → DB cost column (in-memory store). */
export function simulateOrderCostWrite({ facts, rates, clientCostAmount, totalFee = null }) {
  const byLevel = async ({ level }) => rates.filter((r) => r.matchLevel === level);
  return lookupCommercialTripCost(facts, byLevel).then((engine) => {
    const decision = decidePersistedCostAmount({
      engine,
      clientCostAmount,
      mode: "create",
    });
    const db = {
      cost_amount: decision.costAmount,
      lookup_status: engine.lookupStatus,
      matched_level: engine.matchedLevel,
      rate_rule_id: engine.rateRuleId,
      standard_cost: engine.standardCost,
      client_cost_ignored: decision.ignoredClientCost,
      attempted_levels: engine.attemptedLevels,
      error_class: engine.errorClass,
      total_fee: totalFee,
    };
    return { engine, db, request: { cost_amount: clientCostAmount ?? null, facts } };
  });
}
