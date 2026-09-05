import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** 加盟主／加盟車行（franchisees） */
export const franchiseesTable = pgTable(
  "franchisees",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    ownerName: text("owner_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    zoneName: text("zone_name"),
    contractType: text("contract_type").notNull().default("revenue_share"),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).default("70"),
    platformCommissionRate: numeric("platform_commission_rate", { precision: 5, scale: 2 }).default("10"),
    monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).default("0"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    contractEndAt: timestamp("contract_end_at"),
    username: text("username").unique(),
    passwordHash: text("password_hash"),
    lastLoginAt: timestamp("last_login_at"),
    affiliationType: text("affiliation_type").notNull().default("affiliated"),
    lineUserId: text("line_user_id"),
    googleId: text("google_id"),
    avatarUrl: text("avatar_url"),
    contactPerson: text("contact_person"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    googleIdUq: uniqueIndex("franchisees_google_id_uidx")
      .on(t.googleId)
      .where(sql`${t.googleId} IS NOT NULL`),
  }),
);
