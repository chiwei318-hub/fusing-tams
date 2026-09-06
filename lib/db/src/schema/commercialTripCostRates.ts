import {
  pgTable,
  serial,
  integer,
  smallint,
  text,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * commercial_trip_cost_rates — approved STANDARD_DRIVER_TRIP_COST master
 * for commercial (non-Shopee) orders.
 *
 * match_level:
 *   1 = customer + city/district OD + vehicle (+ optional service)
 *   2 = customer + city OD + vehicle (+ optional service)
 *   3 = customer + vehicle approved default (+ optional service)
 *
 * Lookup contracts (writer, not DDL):
 *   - Observe inactive blockers before active-only select
 *   - service_type: EXACT → NULL-default; never LIMIT 1 ambiguity
 *   - block_fallthrough only within applicable service precedence
 *   - QUERY_FAILURE never falls through
 *
 * cost must be > 0 (never use 0 as unknown / free-trip).
 */
export const commercialTripCostRatesTable = pgTable(
  "commercial_trip_cost_rates",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    matchLevel: smallint("match_level").notNull(),
    originCity: text("origin_city"),
    originDistrict: text("origin_district"),
    destinationCity: text("destination_city"),
    destinationDistrict: text("destination_district"),
    vehicleType: text("vehicle_type").notNull(),
    serviceType: text("service_type"),
    standardDriverTripCost: numeric("standard_driver_trip_cost", {
      precision: 12,
      scale: 2,
    }).notNull(),
    active: boolean("active").notNull().default(true),
    blockFallthrough: boolean("block_fallthrough").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("ctcr_level_chk", sql`${t.matchLevel} IN (1, 2, 3)`),
    check("ctcr_cost_positive_chk", sql`${t.standardDriverTripCost} > 0`),
    check(
      "ctcr_level_shape_chk",
      sql`(
        (${t.matchLevel} = 1 AND ${t.originCity} IS NOT NULL AND ${t.originDistrict} IS NOT NULL
          AND ${t.destinationCity} IS NOT NULL AND ${t.destinationDistrict} IS NOT NULL)
        OR
        (${t.matchLevel} = 2 AND ${t.originCity} IS NOT NULL AND ${t.destinationCity} IS NOT NULL
          AND ${t.originDistrict} IS NULL AND ${t.destinationDistrict} IS NULL)
        OR
        (${t.matchLevel} = 3 AND ${t.originCity} IS NULL AND ${t.originDistrict} IS NULL
          AND ${t.destinationCity} IS NULL AND ${t.destinationDistrict} IS NULL)
      )`,
    ),
    uniqueIndex("ctcr_l1_uidx")
      .on(
        t.customerId,
        t.originCity,
        t.originDistrict,
        t.destinationCity,
        t.destinationDistrict,
        t.vehicleType,
        sql`COALESCE(${t.serviceType}, '')`,
      )
      .where(sql`${t.matchLevel} = 1`),
    uniqueIndex("ctcr_l2_uidx")
      .on(
        t.customerId,
        t.originCity,
        t.destinationCity,
        t.vehicleType,
        sql`COALESCE(${t.serviceType}, '')`,
      )
      .where(sql`${t.matchLevel} = 2`),
    uniqueIndex("ctcr_l3_uidx")
      .on(t.customerId, t.vehicleType, sql`COALESCE(${t.serviceType}, '')`)
      .where(sql`${t.matchLevel} = 3`),
    index("ctcr_customer_level_idx")
      .on(t.customerId, t.matchLevel)
      .where(sql`${t.active} = true`),
  ],
);

export type CommercialTripCostRate = typeof commercialTripCostRatesTable.$inferSelect;
