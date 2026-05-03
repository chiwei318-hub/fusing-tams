-- Initial schema migration: creates all tables defined in the Drizzle schema
-- This is idempotent — safe to run on an existing database

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_roles" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(50) NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "permissions" jsonb NOT NULL,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "admin_roles_name_unique" UNIQUE("name")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" varchar(100) NOT NULL,
  "password_hash" text NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "email" varchar(200),
  "role_id" integer,
  "is_super_admin" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_login_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_fields" (
  "id" serial PRIMARY KEY NOT NULL,
  "form_type" varchar(50) NOT NULL,
  "field_key" varchar(100) NOT NULL,
  "field_label" varchar(200) NOT NULL,
  "field_type" varchar(50) NOT NULL,
  "options" jsonb,
  "is_required" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "operator_name" varchar(100) NOT NULL DEFAULT '系統',
  "operator_role" varchar(100) NOT NULL DEFAULT 'system',
  "action" varchar(50) NOT NULL,
  "resource_type" varchar(100) NOT NULL,
  "resource_id" varchar(100),
  "resource_label" varchar(500),
  "description" text,
  "ip_address" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otps" (
  "id" serial PRIMARY KEY NOT NULL,
  "phone" varchar(20) NOT NULL,
  "otp" varchar(6) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "line_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_type" varchar(20) NOT NULL,
  "user_ref_id" text NOT NULL,
  "line_user_id" text NOT NULL,
  "display_name" text,
  "picture_url" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "line_accounts_line_user_id_unique" UNIQUE("line_user_id")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "username" text,
  "password" text,
  "address" text,
  "contact_person" text,
  "tax_id" text,
  "invoice_title" text,
  "email" text,
  "line_user_id" text,
  "line_linked_at" timestamp,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drivers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "vehicle_type" text NOT NULL,
  "license_plate" text NOT NULL,
  "status" text NOT NULL DEFAULT 'available',
  "driver_type" text,
  "username" text,
  "password" text,
  "line_user_id" text,
  "engine_cc" integer,
  "vehicle_year" integer,
  "vehicle_brand" text,
  "vehicle_tonnage" text,
  "vehicle_body_type" text,
  "has_tailgate" boolean DEFAULT false,
  "max_load_kg" real,
  "max_volume_cbm" real,
  "bank_name" text,
  "bank_branch" text,
  "bank_account" text,
  "bank_account_name" text,
  "credit_score" integer DEFAULT 100,
  "rating" real DEFAULT 5.0,
  "rating_count" integer DEFAULT 0,
  "can_cold_chain" boolean DEFAULT false,
  "franchisee_id" integer,
  "is_franchisee" boolean GENERATED ALWAYS AS (franchisee_id IS NOT NULL) STORED,
  "employee_id" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "length_m" real,
  "width_m" real,
  "height_m" real,
  "volume_m3" real,
  "max_weight_kg" real,
  "pallet_count" integer,
  "has_tailgate" boolean DEFAULT false,
  "has_refrigeration" boolean DEFAULT false,
  "has_dump_body" boolean DEFAULT false,
  "height_limit_m" real,
  "weight_limit_kg" real,
  "cargo_types" text,
  "notes" text,
  "base_fee" real
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_licenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "driver_id" integer,
  "license_type" text NOT NULL,
  "license_number" text,
  "owner_name" text,
  "owner_phone" text,
  "vehicle_plate" text,
  "issued_date" text,
  "expiry_date" text NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_no" text,
  "customer_id" integer,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_email" text,
  "pickup_date" text,
  "pickup_time" text,
  "required_license" text,
  "pickup_contact_name" text,
  "pickup_city" text,
  "pickup_district" text,
  "pickup_address" text NOT NULL,
  "pickup_contact_person" text,
  "delivery_date" text,
  "delivery_time" text,
  "delivery_contact_name" text,
  "delivery_city" text,
  "delivery_district" text,
  "delivery_address" text NOT NULL,
  "delivery_contact_person" text,
  "cargo_name" text,
  "cargo_description" text NOT NULL,
  "cargo_quantity" text,
  "qty" integer,
  "cargo_weight" real,
  "gross_weight" real,
  "cargo_length_m" real,
  "cargo_width_m" real,
  "cargo_height_m" real,
  "region" text,
  "required_vehicle_type" text,
  "vehicle_type" text,
  "need_tailgate" text,
  "need_hydraulic_pallet" text,
  "special_requirements" text,
  "route_id" text,
  "route_prefix" text,
  "station_count" integer,
  "shopee_driver_id" text,
  "dispatch_dock" text,
  "fleet_id" integer,
  "fleet_driver_id" integer,
  "fusingao_fleet_id" integer,
  "team_id" integer,
  "zone_id" integer,
  "monthly_bill_id" integer,
  "status" text NOT NULL DEFAULT 'pending',
  "order_status" text,
  "is_cold_chain" boolean NOT NULL DEFAULT false,
  "driver_id" integer,
  "notes" text,
  "base_price" real,
  "extra_fee" real,
  "total_fee" real,
  "quote_amount" real,
  "cost_amount" real,
  "profit_amount" real,
  "driver_pay" real,
  "fee_status" text NOT NULL DEFAULT 'unpaid',
  "payment_status" text,
  "invoice_status" text DEFAULT 'none',
  "source_channel" text,
  "assigned_method" varchar(20),
  "quick_order_token" text,
  "quick_order_token_key" text,
  "exception_code" text,
  "suggested_price" real,
  "driver_accepted_at" timestamp,
  "check_in_at" timestamp,
  "signature_photo_url" text,
  "completed_at" timestamp,
  "extra_pickup_addresses" text,
  "extra_delivery_addresses" text,
  "enterprise_id" integer,
  "order_group_id" text,
  "payment_note" text,
  "payment_confirmed_at" timestamp,
  "driver_payment_status" text NOT NULL DEFAULT 'unpaid',
  "franchisee_payment_status" text NOT NULL DEFAULT 'unpaid',
  "distance_km" real,
  "pricing_breakdown" text,
  "price_locked" boolean NOT NULL DEFAULT false,
  "price_locked_at" timestamp,
  "price_locked_by" text,
  "arrival_notified_at" timestamp,
  "wait_minutes" real DEFAULT 0,
  "surcharge_amount" real DEFAULT 0,
  "surcharge_reason" text,
  "custom_field_values" text,
  "operator_name" text,
  "settled_at" timestamptz,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "amount" real NOT NULL,
  "method" text NOT NULL DEFAULT 'cash',
  "note" text,
  "collected_by" text,
  "receipt_number" text,
  "receipt_company_title" text,
  "receipt_tax_id" text,
  "is_voided" boolean NOT NULL DEFAULT false,
  "void_reason" text,
  "notification_sent_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_name" text NOT NULL,
  "short_name" text,
  "account_code" text NOT NULL,
  "password_hash" text NOT NULL,
  "contact_person" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "tax_id" text,
  "invoice_title" text,
  "address" text,
  "postal_code" text,
  "industry" text,
  "billing_type" text NOT NULL DEFAULT 'prepaid',
  "payment_type" text,
  "credit_limit" real NOT NULL DEFAULT 0,
  "credit_days" integer,
  "monthly_statement_day" integer,
  "discount_percent" real NOT NULL DEFAULT 0,
  "price_level" text,
  "unit_price_fixed" real,
  "min_monthly_spend" real,
  "contract_type" text,
  "contract_start" text,
  "contract_end" text,
  "is_vip" boolean NOT NULL DEFAULT false,
  "priority_dispatch" boolean NOT NULL DEFAULT false,
  "exclusive_note" text,
  "notes" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "enterprise_accounts_account_code_unique" UNIQUE("account_code")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_saved_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "enterprise_id" integer NOT NULL,
  "nickname" text NOT NULL,
  "pickup_address" text NOT NULL,
  "delivery_address" text,
  "cargo_description" text,
  "vehicle_type" text,
  "special_requirements" text,
  "use_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_sub_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "enterprise_id" integer NOT NULL,
  "name" text NOT NULL,
  "sub_code" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'purchaser',
  "email" text,
  "phone" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "enterprise_sub_accounts_sub_code_unique" UNIQUE("sub_code")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "enterprise_id" integer NOT NULL,
  "order_id" integer,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_fleets" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "contact_person" text NOT NULL,
  "phone" text NOT NULL,
  "line_group_id" text,
  "regions" text,
  "vehicle_types" text,
  "rate_type" text NOT NULL DEFAULT 'flat',
  "base_rate" real NOT NULL DEFAULT 0,
  "commission_type" text NOT NULL DEFAULT 'percent',
  "commission_value" real NOT NULL DEFAULT 0,
  "profit_alert_threshold" real DEFAULT 10,
  "reliability_score" real DEFAULT 80,
  "total_orders" integer NOT NULL DEFAULT 0,
  "completed_orders" integer NOT NULL DEFAULT 0,
  "auto_assign" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active',
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outsourced_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "fleet_id" integer,
  "transfer_price" real NOT NULL DEFAULT 0,
  "fleet_price" real NOT NULL DEFAULT 0,
  "commission_type" text NOT NULL DEFAULT 'percent',
  "commission_value" real NOT NULL DEFAULT 0,
  "profit" real NOT NULL DEFAULT 0,
  "profit_percent" real NOT NULL DEFAULT 0,
  "profit_alert" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'pending_notify',
  "fleet_driver_name" text,
  "fleet_driver_phone" text,
  "fleet_driver_plate" text,
  "notification_sent_at" timestamp,
  "fleet_accepted_at" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auto_dispatch_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "self_fleet_first" boolean NOT NULL DEFAULT true,
  "auto_outsource_when_full" boolean NOT NULL DEFAULT false,
  "auto_outsource_low_profit" boolean NOT NULL DEFAULT false,
  "low_profit_threshold" real NOT NULL DEFAULT 15,
  "default_profit_alert_threshold" real NOT NULL DEFAULT 10,
  "preferred_fleet_id" integer,
  "line_notify_enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "route_prices" (
  "id" serial PRIMARY KEY NOT NULL,
  "from_location" text NOT NULL DEFAULT '桃園平鎮',
  "to_location" text NOT NULL,
  "vehicle_type" text NOT NULL,
  "base_price" integer NOT NULL,
  "waiting_fee_per_hour" integer DEFAULT 0,
  "elevator_fee" integer DEFAULT 0,
  "tax_rate" real DEFAULT 5,
  "heapmachine_only" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_costs" (
  "id" serial PRIMARY KEY NOT NULL,
  "vehicle_name" text NOT NULL,
  "vehicle_type" text,
  "plate_number" text,
  "vehicle_value" integer DEFAULT 0,
  "depreciation_years" integer DEFAULT 5,
  "residual_value" integer DEFAULT 0,
  "fuel_consumption_per_100km" real DEFAULT 10,
  "fuel_price_per_liter" real DEFAULT 32,
  "license_tax_yearly" integer DEFAULT 0,
  "fuel_tax_yearly" integer DEFAULT 0,
  "maintenance_monthly" integer DEFAULT 0,
  "wear_monthly" integer DEFAULT 0,
  "driver_salary_monthly" integer DEFAULT 0,
  "insurance_yearly" integer DEFAULT 0,
  "other_monthly" integer DEFAULT 0,
  "working_days_monthly" integer DEFAULT 25,
  "trips_per_day" integer DEFAULT 2,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_ratings" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "driver_id" integer NOT NULL,
  "customer_id" integer,
  "stars" integer NOT NULL,
  "comment" text,
  "license_plate" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "customer_id" integer,
  "order_id" integer,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "token" varchar(64) NOT NULL,
  "customer_name" text,
  "customer_phone" text,
  "customer_email" text,
  "company_name" text,
  "vehicle_type" text NOT NULL,
  "cargo_name" text,
  "cargo_weight" real,
  "cargo_length_m" real,
  "cargo_width_m" real,
  "cargo_height_m" real,
  "volume_cbm" real,
  "distance_km" real,
  "from_address" text,
  "to_address" text,
  "pickup_date" text,
  "pickup_time" text,
  "special_cargoes" text,
  "need_cold_chain" boolean DEFAULT false,
  "cold_chain_temp" text,
  "waiting_hours" real DEFAULT 0,
  "tolls_fixed" integer DEFAULT 0,
  "base_price" integer,
  "distance_charge" integer,
  "weight_surcharge" integer,
  "volume_surcharge" integer,
  "special_surcharge" integer,
  "cold_chain_fee" integer,
  "waiting_fee" integer,
  "tax_amount" integer,
  "profit_amount" integer,
  "total_amount" integer,
  "breakdown" text,
  "status" text NOT NULL DEFAULT 'draft',
  "expires_at" timestamp,
  "converted_order_id" integer,
  "notes" text,
  "source" text DEFAULT 'web',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "quote_requests_token_unique" UNIQUE("token")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_settlements" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "order_no" text,
  "driver_id" integer,
  "total_amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "commission_rate" numeric(5, 2) NOT NULL DEFAULT '15',
  "commission_amount" numeric(12, 2) GENERATED ALWAYS AS (ROUND(total_amount * commission_rate / 100, 2)) STORED,
  "platform_revenue" numeric(12, 2) GENERATED ALWAYS AS (ROUND(total_amount * commission_rate / 100, 2)) STORED,
  "driver_payout" numeric(12, 2) GENERATED ALWAYS AS (ROUND(total_amount * (100 - commission_rate) / 100, 2)) STORED,
  "payment_status" text NOT NULL DEFAULT 'unpaid',
  "paid_at" timestamptz,
  "payment_ref" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ar_ap_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "order_no" text,
  "completed_at" timestamp,
  "customer_name" text,
  "pickup_address" text,
  "delivery_address" text,
  "vehicle_type" text,
  "distance_km" numeric,
  "ar_amount" numeric NOT NULL DEFAULT '0',
  "ap_driver" numeric NOT NULL DEFAULT '0',
  "ap_equipment" numeric NOT NULL DEFAULT '0',
  "ap_total" numeric NOT NULL DEFAULT '0',
  "net_profit" numeric NOT NULL DEFAULT '0',
  "profit_margin_pct" numeric,
  "status" text NOT NULL DEFAULT 'pending',
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "ar_ap_records_order_id_unique" UNIQUE("order_id")
);

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_admin_roles_id_fk"
    FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_drivers_id_fk"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "enterprise_saved_templates" ADD CONSTRAINT "enterprise_saved_templates_enterprise_id_fk"
    FOREIGN KEY ("enterprise_id") REFERENCES "enterprise_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "enterprise_sub_accounts" ADD CONSTRAINT "enterprise_sub_accounts_enterprise_id_fk"
    FOREIGN KEY ("enterprise_id") REFERENCES "enterprise_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "enterprise_notifications" ADD CONSTRAINT "enterprise_notifications_enterprise_id_fk"
    FOREIGN KEY ("enterprise_id") REFERENCES "enterprise_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outsourced_orders" ADD CONSTRAINT "outsourced_orders_fleet_id_partner_fleets_id_fk"
    FOREIGN KEY ("fleet_id") REFERENCES "partner_fleets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_settlements" ADD CONSTRAINT "order_settlements_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_settlements" ADD CONSTRAINT "order_settlements_driver_id_drivers_id_fk"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
