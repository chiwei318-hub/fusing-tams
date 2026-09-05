import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  numeric,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** 福興高合作車隊帳號（fusingao_fleets） */
export const fusingaoFleetsTable = pgTable(
  "fusingao_fleets",
  {
    id: serial("id").primaryKey(),
    fleetName: text("fleet_name").notNull(),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    username: text("username").notNull(),
    password: text("password"),
    vehicleTypes: text("vehicle_types"),
    notes: text("notes"),
    rateOverride: numeric("rate_override", { precision: 12, scale: 2 }),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).default("15"),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    fleetType: text("fleet_type").notNull().default("owner"),
    fusingaoCommissionRate: numeric("fusingao_commission_rate", { precision: 5, scale: 2 }).default("7"),
    monthlyAffiliationFee: numeric("monthly_affiliation_fee", { precision: 10, scale: 2 }).default("0"),
    platformFeeMonthly: numeric("platform_fee_monthly", { precision: 10, scale: 2 }).default("0"),
    contractStartDate: date("contract_start_date"),
    contractExpireDate: date("contract_expire_date"),
    notesInternal: text("notes_internal"),
    hasTaxId: boolean("has_tax_id").notNull().default(false),
    googleId: text("google_id"),
    avatarUrl: text("avatar_url"),
    email: text("email"),
    lineId: text("line_id"),
  },
  (t) => ({
    usernameUq: uniqueIndex("fusingao_fleets_username_uidx").on(t.username),
    googleIdUq: uniqueIndex("fusingao_fleets_google_id_uidx")
      .on(t.googleId)
      .where(sql`${t.googleId} IS NOT NULL`),
  }),
);
