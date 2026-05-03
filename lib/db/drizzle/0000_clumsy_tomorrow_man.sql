CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"license_plate" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
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
	"rating" real DEFAULT 5,
	"rating_count" integer DEFAULT 0,
	"can_cold_chain" boolean DEFAULT false,
	"franchisee_id" integer,
	"is_franchisee" boolean GENERATED ALWAYS AS (franchisee_id IS NOT NULL) STORED,
	"employee_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
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
	"status" text DEFAULT 'pending' NOT NULL,
	"order_status" text,
	"is_cold_chain" boolean DEFAULT false NOT NULL,
	"driver_id" integer,
	"notes" text,
	"base_price" real,
	"extra_fee" real,
	"total_fee" real,
	"quote_amount" real,
	"cost_amount" real,
	"profit_amount" real,
	"driver_pay" real,
	"fee_status" text DEFAULT 'unpaid' NOT NULL,
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
	"driver_payment_status" text DEFAULT 'unpaid' NOT NULL,
	"franchisee_payment_status" text DEFAULT 'unpaid' NOT NULL,
	"distance_km" real,
	"pricing_breakdown" text,
	"price_locked" boolean DEFAULT false NOT NULL,
	"price_locked_at" timestamp,
	"price_locked_by" text,
	"arrival_notified_at" timestamp,
	"wait_minutes" real DEFAULT 0,
	"surcharge_amount" real DEFAULT 0,
	"surcharge_reason" text,
	"custom_field_values" text,
	"operator_name" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
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
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
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
CREATE TABLE "vehicle_licenses" (
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_accounts" (
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
	"billing_type" text DEFAULT 'prepaid' NOT NULL,
	"payment_type" text,
	"credit_limit" real DEFAULT 0 NOT NULL,
	"credit_days" integer,
	"monthly_statement_day" integer,
	"discount_percent" real DEFAULT 0 NOT NULL,
	"price_level" text,
	"unit_price_fixed" real,
	"min_monthly_spend" real,
	"contract_type" text,
	"contract_start" text,
	"contract_end" text,
	"is_vip" boolean DEFAULT false NOT NULL,
	"priority_dispatch" boolean DEFAULT false NOT NULL,
	"exclusive_note" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enterprise_accounts_account_code_unique" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "enterprise_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" integer NOT NULL,
	"order_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_saved_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" integer NOT NULL,
	"nickname" text NOT NULL,
	"pickup_address" text NOT NULL,
	"delivery_address" text,
	"cargo_description" text,
	"vehicle_type" text,
	"special_requirements" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_sub_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" integer NOT NULL,
	"name" text NOT NULL,
	"sub_code" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'purchaser' NOT NULL,
	"email" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enterprise_sub_accounts_sub_code_unique" UNIQUE("sub_code")
);
--> statement-breakpoint
CREATE TABLE "auto_dispatch_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"self_fleet_first" boolean DEFAULT true NOT NULL,
	"auto_outsource_when_full" boolean DEFAULT false NOT NULL,
	"auto_outsource_low_profit" boolean DEFAULT false NOT NULL,
	"low_profit_threshold" real DEFAULT 15 NOT NULL,
	"default_profit_alert_threshold" real DEFAULT 10 NOT NULL,
	"preferred_fleet_id" integer,
	"line_notify_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outsourced_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"fleet_id" integer,
	"transfer_price" real DEFAULT 0 NOT NULL,
	"fleet_price" real DEFAULT 0 NOT NULL,
	"commission_type" text DEFAULT 'percent' NOT NULL,
	"commission_value" real DEFAULT 0 NOT NULL,
	"profit" real DEFAULT 0 NOT NULL,
	"profit_percent" real DEFAULT 0 NOT NULL,
	"profit_alert" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending_notify' NOT NULL,
	"fleet_driver_name" text,
	"fleet_driver_phone" text,
	"fleet_driver_plate" text,
	"notification_sent_at" timestamp,
	"fleet_accepted_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_fleets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text NOT NULL,
	"phone" text NOT NULL,
	"line_group_id" text,
	"regions" text,
	"vehicle_types" text,
	"rate_type" text DEFAULT 'flat' NOT NULL,
	"base_rate" real DEFAULT 0 NOT NULL,
	"commission_type" text DEFAULT 'percent' NOT NULL,
	"commission_value" real DEFAULT 0 NOT NULL,
	"profit_alert_threshold" real DEFAULT 10,
	"reliability_score" real DEFAULT 80,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"completed_orders" integer DEFAULT 0 NOT NULL,
	"auto_assign" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"amount" real NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"note" text,
	"collected_by" text,
	"receipt_number" text,
	"receipt_company_title" text,
	"receipt_tax_id" text,
	"is_voided" boolean DEFAULT false NOT NULL,
	"void_reason" text,
	"notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"permissions" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"email" varchar(200),
	"role_id" integer,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"operator_name" varchar(100) DEFAULT '系統' NOT NULL,
	"operator_role" varchar(100) DEFAULT 'system' NOT NULL,
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(100),
	"resource_label" varchar(500),
	"description" text,
	"ip_address" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_type" varchar(50) NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"field_label" varchar(200) NOT NULL,
	"field_type" varchar(50) NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_type" varchar(20) NOT NULL,
	"user_ref_id" text NOT NULL,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"picture_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "line_accounts_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"otp" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_location" text DEFAULT '桃園平鎮' NOT NULL,
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
CREATE TABLE "vehicle_costs" (
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
CREATE TABLE "customer_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"order_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"customer_id" integer,
	"stars" integer NOT NULL,
	"comment" text,
	"license_plate" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
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
	"status" text DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp,
	"converted_order_id" integer,
	"notes" text,
	"source" text DEFAULT 'web',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "quote_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "order_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_no" text,
	"driver_id" integer,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '15' NOT NULL,
	"commission_amount" numeric(12, 2) GENERATED ALWAYS AS (ROUND(total_amount * commission_rate / 100, 2)) STORED,
	"platform_revenue" numeric(12, 2) GENERATED ALWAYS AS (ROUND(total_amount * commission_rate / 100, 2)) STORED,
	"driver_payout" numeric(12, 2) GENERATED ALWAYS AS (ROUND(total_amount * (100 - commission_rate) / 100, 2)) STORED,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_ref" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ar_ap_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_no" text,
	"completed_at" timestamp,
	"customer_name" text,
	"pickup_address" text,
	"delivery_address" text,
	"vehicle_type" text,
	"distance_km" numeric,
	"ar_amount" numeric DEFAULT '0' NOT NULL,
	"ap_driver" numeric DEFAULT '0' NOT NULL,
	"ap_equipment" numeric DEFAULT '0' NOT NULL,
	"ap_total" numeric DEFAULT '0' NOT NULL,
	"net_profit" numeric DEFAULT '0' NOT NULL,
	"profit_margin_pct" numeric,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ar_ap_records_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_notifications" ADD CONSTRAINT "enterprise_notifications_enterprise_id_enterprise_accounts_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprise_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_saved_templates" ADD CONSTRAINT "enterprise_saved_templates_enterprise_id_enterprise_accounts_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprise_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_sub_accounts" ADD CONSTRAINT "enterprise_sub_accounts_enterprise_id_enterprise_accounts_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprise_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outsourced_orders" ADD CONSTRAINT "outsourced_orders_fleet_id_partner_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."partner_fleets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD CONSTRAINT "order_settlements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_settlements" ADD CONSTRAINT "order_settlements_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;