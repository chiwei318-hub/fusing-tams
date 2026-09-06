/**
 * DB adapter + apply commercial cost after order create.
 * Shopee (route_prefix present): skip — leave calc_order_finance result.
 * Client cost_amount: always ignored.
 */

import { pool } from "@workspace/db";
import {
  lookupCommercialTripCost,
  decidePersistedCostAmount,
  computeProfitFromFee,
  type CommercialCostFacts,
  type CommercialCostResult,
  type RateRow,
  type RateQueryFn,
} from "./commercialCostEngine.js";

export type ApplyCommercialCostArgs = {
  orderId: number;
  facts: CommercialCostFacts;
  /** Ignored for money write — accepted only to prove strip/ignore */
  clientCostAmount?: number | null;
  totalFee?: number | null;
  routePrefix?: string | null;
  mode?: "create" | "update";
  priorCostAmount?: number | null;
  /** inject for tests */
  queryFn?: RateQueryFn;
};

export type ApplyCommercialCostResult = {
  skipped: boolean;
  skipReason: string | null;
  engine: CommercialCostResult | null;
  persistedCostAmount: number | null;
  persistedProfitAmount: number | null;
  ignoredClientCost: boolean;
  lookupRowId: number | null;
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Query commercial_trip_cost_rates for one ladder level (all service variants). */
export async function queryCommercialRatesAtLevel(args: {
  level: 1 | 2 | 3;
  facts: CommercialCostFacts;
}): Promise<RateRow[]> {
  const { level, facts } = args;
  const customerId = facts.customerId;
  const vehicleType = facts.vehicleType;
  if (customerId == null || !vehicleType) return [];

  let sqlText: string;
  let params: unknown[];

  if (level === 1) {
    sqlText = `
      SELECT id, match_level, origin_city, origin_district, destination_city, destination_district,
             vehicle_type, service_type, standard_driver_trip_cost, active, block_fallthrough
        FROM commercial_trip_cost_rates
       WHERE match_level = 1
         AND customer_id = $1
         AND vehicle_type = $2
         AND origin_city = $3
         AND origin_district = $4
         AND destination_city = $5
         AND destination_district = $6`;
    params = [
      customerId,
      vehicleType,
      facts.originCity,
      facts.originDistrict,
      facts.destinationCity,
      facts.destinationDistrict,
    ];
  } else if (level === 2) {
    sqlText = `
      SELECT id, match_level, origin_city, origin_district, destination_city, destination_district,
             vehicle_type, service_type, standard_driver_trip_cost, active, block_fallthrough
        FROM commercial_trip_cost_rates
       WHERE match_level = 2
         AND customer_id = $1
         AND vehicle_type = $2
         AND origin_city = $3
         AND destination_city = $4
         AND origin_district IS NULL
         AND destination_district IS NULL`;
    params = [customerId, vehicleType, facts.originCity, facts.destinationCity];
  } else {
    sqlText = `
      SELECT id, match_level, origin_city, origin_district, destination_city, destination_district,
             vehicle_type, service_type, standard_driver_trip_cost, active, block_fallthrough
        FROM commercial_trip_cost_rates
       WHERE match_level = 3
         AND customer_id = $1
         AND vehicle_type = $2
         AND origin_city IS NULL
         AND origin_district IS NULL
         AND destination_city IS NULL
         AND destination_district IS NULL`;
    params = [customerId, vehicleType];
  }

  const { rows } = await pool.query(sqlText, params);
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    matchLevel: Number(r.match_level) as 1 | 2 | 3,
    originCity: (r.origin_city as string) ?? null,
    originDistrict: (r.origin_district as string) ?? null,
    destinationCity: (r.destination_city as string) ?? null,
    destinationDistrict: (r.destination_district as string) ?? null,
    vehicleType: String(r.vehicle_type),
    serviceType: (r.service_type as string) ?? null,
    standardDriverTripCost: Number(r.standard_driver_trip_cost),
    active: Boolean(r.active),
    blockFallthrough: Boolean(r.block_fallthrough),
  }));
}

async function insertProvenance(args: {
  orderId: number;
  facts: CommercialCostFacts;
  engine: CommercialCostResult;
}): Promise<number | null> {
  const { orderId, facts, engine } = args;
  const { rows } = await pool.query(
    `INSERT INTO order_cost_lookups (
       order_id, lookup_status, matched_level, rate_source, rate_rule_id, standard_cost,
       customer_id, origin_city, origin_district, destination_city, destination_district,
       vehicle_type, service_type, error_class, notes
     ) VALUES (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,$11,
       $12,$13,$14,$15
     ) RETURNING id`,
    [
      orderId,
      engine.lookupStatus,
      engine.matchedLevel,
      engine.rateSource,
      engine.rateRuleId,
      engine.standardCost,
      facts.customerId,
      facts.originCity,
      facts.originDistrict,
      facts.destinationCity,
      facts.destinationDistrict,
      facts.vehicleType,
      facts.serviceType ?? null,
      engine.errorClass,
      engine.notes,
    ],
  );
  return rows[0]?.id != null ? Number(rows[0].id) : null;
}

/**
 * Apply commercial cost to orders.cost_amount AFTER insert trigger ran.
 * UPDATE only cost_amount/profit_amount so trg_order_finance does not re-fire.
 */
export async function applyCommercialOrderCost(
  args: ApplyCommercialCostArgs,
): Promise<ApplyCommercialCostResult> {
  const mode = args.mode ?? "create";
  const routePrefix = args.routePrefix?.trim() || null;

  // Shopee / route_prefix path: do not touch
  if (routePrefix) {
    return {
      skipped: true,
      skipReason: "route_prefix_present_shopee_path",
      engine: null,
      persistedCostAmount: null,
      persistedProfitAmount: null,
      ignoredClientCost:
        args.clientCostAmount !== undefined && args.clientCostAmount !== null,
      lookupRowId: null,
    };
  }

  const queryFn = args.queryFn ?? queryCommercialRatesAtLevel;
  const engine = await lookupCommercialTripCost(args.facts, queryFn);

  const decision = decidePersistedCostAmount({
    engine,
    clientCostAmount: args.clientCostAmount,
    priorCostAmount: args.priorCostAmount ?? null,
    mode,
  });

  const profit = computeProfitFromFee(args.totalFee ?? null, decision.costAmount);

  // QUERY_FAILURE on update: do not overwrite cost; still write provenance
  if (!(engine.lookupStatus === "QUERY_FAILURE" && mode === "update")) {
    await pool.query(
      `UPDATE orders
          SET cost_amount = $2,
              profit_amount = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [args.orderId, decision.costAmount, profit],
    );
  }

  const lookupRowId = await insertProvenance({
    orderId: args.orderId,
    facts: args.facts,
    engine,
  });

  return {
    skipped: false,
    skipReason: null,
    engine,
    persistedCostAmount: decision.costAmount,
    persistedProfitAmount: profit,
    ignoredClientCost: decision.ignoredClientCost,
    lookupRowId,
  };
}

export { num };
