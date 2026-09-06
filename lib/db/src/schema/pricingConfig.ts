import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * pricing_config — key/value business & system configuration store.
 *
 * Canonical ownership: Drizzle schema + formal migrate (not runtime CREATE).
 * Settlement rates (default_commission_rate, insurance_rate, other_fee_rate,
 * other_fee_fixed) must be explicitly configured — do not invent business %.
 */
export const pricingConfigTable = pgTable(
  "pricing_config",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    label: text("label"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("pricing_config_key_uidx").on(t.key)],
);

export type PricingConfig = typeof pricingConfigTable.$inferSelect;
