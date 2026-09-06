import { pgTable, serial, integer, text, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driversTable } from "./drivers";
import { ordersTable } from "./orders";
import { franchiseesTable } from "./franchisees";

export const paymentStatusEnum = ["unpaid", "processing", "paid", "cancelled"] as const;
export type SettlementPaymentStatus = typeof paymentStatusEnum[number];

/**
 * order_settlements — 每筆訂單的利潤拆分明細
 *
 * Business invariant: ONE order_id → maximum ONE canonical settlement row
 * (required for ON CONFLICT (order_id) upsert in franchiseSettlements writer).
 *
 * commission_rate = PLATFORM_DEDUCTION_RATE (%)
 * GENERATED: driver_payout = total_amount × (100 − commission_rate) / 100
 */
export const orderSettlementsTable = pgTable(
  "order_settlements",
  {
    id: serial("id").primaryKey(),

    orderId:   integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
    orderNo:   text("order_no"),
    driverId:  integer("driver_id").references(() => driversTable.id, { onDelete: "set null" }),

    totalAmount:    numeric("total_amount",    { precision: 12, scale: 2 }).notNull().default("0"),
    commissionRate: numeric("commission_rate", { precision: 5,  scale: 2 }).notNull().default("15"),

    commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 })
      .generatedAlwaysAs(sql`ROUND(total_amount * commission_rate / 100, 2)`),
    platformRevenue:  numeric("platform_revenue", { precision: 12, scale: 2 })
      .generatedAlwaysAs(sql`ROUND(total_amount * commission_rate / 100, 2)`),
    driverPayout:     numeric("driver_payout",    { precision: 12, scale: 2 })
      .generatedAlwaysAs(sql`ROUND(total_amount * (100 - commission_rate) / 100, 2)`),

    // Franchise settlement columns (writer contract / former orphan 002)
    insuranceRate:         numeric("insurance_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    insuranceFee:          numeric("insurance_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    otherFeeRate:          numeric("other_fee_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    otherHandlingFee:      numeric("other_handling_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    franchiseeId:          integer("franchisee_id").references(() => franchiseesTable.id, { onDelete: "set null" }),
    franchiseePayout:      numeric("franchisee_payout", { precision: 12, scale: 2 }).notNull().default("0"),
    franchiseePaymentStatus: text("franchisee_payment_status").notNull().default("unpaid"),
    franchiseePaidAt:      timestamp("franchisee_paid_at", { withTimezone: true }),
    franchiseePaymentRef:  text("franchisee_payment_ref"),
    atomsPushedAt:         timestamp("atoms_pushed_at", { withTimezone: true }),

    paymentStatus: text("payment_status").notNull().default("unpaid"),
    paidAt:        timestamp("paid_at", { withTimezone: true }),
    paymentRef:    text("payment_ref"),

    notes:     text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("order_settlements_order_id_uidx").on(t.orderId),
    index("idx_order_settlements_franchisee_id").on(t.franchiseeId),
    index("idx_order_settlements_franchisee_payment_status").on(t.franchiseePaymentStatus),
  ],
);

export const insertOrderSettlementSchema = createInsertSchema(orderSettlementsTable, {
  paymentStatus: z.enum(paymentStatusEnum).default("unpaid"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrderSettlement = z.infer<typeof insertOrderSettlementSchema>;
export type OrderSettlement = typeof orderSettlementsTable.$inferSelect;
