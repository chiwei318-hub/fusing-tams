ALTER TABLE "order_settlements" ADD COLUMN "insurance_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "insurance_fee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "other_fee_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "other_handling_fee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "franchisee_id" integer;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "franchisee_payout" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "franchisee_payment_status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "franchisee_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "franchisee_payment_ref" text;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD COLUMN "atoms_pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD CONSTRAINT "order_settlements_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_settlements_order_id_uidx" ON "order_settlements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_settlements_franchisee_id" ON "order_settlements" USING btree ("franchisee_id");--> statement-breakpoint
CREATE INDEX "idx_order_settlements_franchisee_payment_status" ON "order_settlements" USING btree ("franchisee_payment_status");