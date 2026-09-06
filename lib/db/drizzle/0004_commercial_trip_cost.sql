-- #6 commercial trip cost master + cost lookup provenance (LOCAL additive)
-- Does NOT alter calc_order_finance, route_prefix_rates, customers.phone UNIQUE,
-- or existing money columns. No DROP/DELETE/TRUNCATE.
CREATE TABLE "commercial_trip_cost_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"match_level" smallint NOT NULL,
	"origin_city" text,
	"origin_district" text,
	"destination_city" text,
	"destination_district" text,
	"vehicle_type" text NOT NULL,
	"service_type" text,
	"standard_driver_trip_cost" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"block_fallthrough" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ctcr_level_chk" CHECK ("match_level" IN (1, 2, 3)),
	CONSTRAINT "ctcr_cost_positive_chk" CHECK ("standard_driver_trip_cost" > 0),
	CONSTRAINT "ctcr_level_shape_chk" CHECK ((
		("match_level" = 1 AND "origin_city" IS NOT NULL AND "origin_district" IS NOT NULL
			AND "destination_city" IS NOT NULL AND "destination_district" IS NOT NULL)
		OR
		("match_level" = 2 AND "origin_city" IS NOT NULL AND "destination_city" IS NOT NULL
			AND "origin_district" IS NULL AND "destination_district" IS NULL)
		OR
		("match_level" = 3 AND "origin_city" IS NULL AND "origin_district" IS NULL
			AND "destination_city" IS NULL AND "destination_district" IS NULL)
	)),
	CONSTRAINT "ctcr_customer_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ctcr_l1_uidx" ON "commercial_trip_cost_rates" (
	"customer_id", "origin_city", "origin_district",
	"destination_city", "destination_district", "vehicle_type",
	(COALESCE("service_type", ''))
) WHERE "match_level" = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "ctcr_l2_uidx" ON "commercial_trip_cost_rates" (
	"customer_id", "origin_city", "destination_city", "vehicle_type",
	(COALESCE("service_type", ''))
) WHERE "match_level" = 2;
--> statement-breakpoint
CREATE UNIQUE INDEX "ctcr_l3_uidx" ON "commercial_trip_cost_rates" (
	"customer_id", "vehicle_type", (COALESCE("service_type", ''))
) WHERE "match_level" = 3;
--> statement-breakpoint
CREATE INDEX "ctcr_customer_level_idx" ON "commercial_trip_cost_rates" ("customer_id", "match_level") WHERE "active" = true;
--> statement-breakpoint
CREATE TABLE "order_cost_lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lookup_status" text NOT NULL,
	"matched_level" smallint,
	"rate_source" text,
	"rate_rule_id" integer,
	"standard_cost" numeric(12, 2),
	"customer_id" integer,
	"origin_city" text,
	"origin_district" text,
	"destination_city" text,
	"destination_district" text,
	"vehicle_type" text,
	"service_type" text,
	"error_class" text,
	"notes" text,
	CONSTRAINT "ocl_status_chk" CHECK ("lookup_status" IN ('MATCHED', 'MISS', 'QUERY_FAILURE')),
	CONSTRAINT "ocl_level_chk" CHECK ("matched_level" IS NULL OR "matched_level" IN (1, 2, 3)),
	CONSTRAINT "ocl_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "ocl_order_attempted_idx" ON "order_cost_lookups" ("order_id", "attempted_at");
