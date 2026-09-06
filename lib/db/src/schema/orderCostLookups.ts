import {
  pgTable,
  serial,
  integer,
  smallint,
  text,
  numeric,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * order_cost_lookups — historical provenance for commercial cost lookups.
 *
 * Snapshot table: reconstruct history from these columns, NOT by joining
 * live commercial_trip_cost_rates. rate_rule_id is a soft id reference only
 * (no FK) so retiring rate rows does not invalidate audit evidence.
 *
 * Money SSoT remains orders.cost_amount / orders.profit_amount.
 */
export const orderCostLookupsTable = pgTable(
  "order_cost_lookups",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
    lookupStatus: text("lookup_status").notNull(),
    matchedLevel: smallint("matched_level"),
    rateSource: text("rate_source"),
    rateRuleId: integer("rate_rule_id"),
    standardCost: numeric("standard_cost", { precision: 12, scale: 2 }),
    customerId: integer("customer_id"),
    originCity: text("origin_city"),
    originDistrict: text("origin_district"),
    destinationCity: text("destination_city"),
    destinationDistrict: text("destination_district"),
    vehicleType: text("vehicle_type"),
    serviceType: text("service_type"),
    errorClass: text("error_class"),
    notes: text("notes"),
  },
  (t) => [
    check(
      "ocl_status_chk",
      sql`${t.lookupStatus} IN ('MATCHED', 'MISS', 'QUERY_FAILURE')`,
    ),
    check(
      "ocl_level_chk",
      sql`${t.matchedLevel} IS NULL OR ${t.matchedLevel} IN (1, 2, 3)`,
    ),
    index("ocl_order_attempted_idx").on(t.orderId, t.attemptedAt),
  ],
);

export type OrderCostLookup = typeof orderCostLookupsTable.$inferSelect;
