/**
 * runSchemaMigration — idempotent base-table bootstrap
 *
 * Creates every table defined in the Drizzle schema using
 * `CREATE TABLE IF NOT EXISTS` so the app can start against a
 * freshly-provisioned PostgreSQL database without running
 * `drizzle-kit push` manually.
 *
 * This must be called before any `ensure*` helpers in app.ts,
 * because those helpers assume the base tables already exist.
 */

import pg from "pg";

const { Pool } = pg;

export async function runSchemaMigration(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query("BEGIN");

    // ── drivers ──────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id               SERIAL PRIMARY KEY,
        name             TEXT NOT NULL,
        phone            TEXT NOT NULL,
        vehicle_type     TEXT NOT NULL,
        license_plate    TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'available',
        driver_type      TEXT,
        username         TEXT,
        password         TEXT,
        line_user_id     TEXT,
        engine_cc        INTEGER,
        vehicle_year     INTEGER,
        vehicle_brand    TEXT,
        vehicle_tonnage  TEXT,
        vehicle_body_type TEXT,
        has_tailgate     BOOLEAN DEFAULT FALSE,
        max_load_kg      REAL,
        max_volume_cbm   REAL,
        bank_name        TEXT,
        bank_branch      TEXT,
        bank_account     TEXT,
        bank_account_name TEXT,
        credit_score     INTEGER DEFAULT 100,
        rating           REAL DEFAULT 5.0,
        rating_count     INTEGER DEFAULT 0,
        can_cold_chain   BOOLEAN DEFAULT FALSE,
        franchisee_id    INTEGER,
        is_franchisee    BOOLEAN GENERATED ALWAYS AS (franchisee_id IS NOT NULL) STORED,
        employee_id      TEXT,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── customers ─────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id               SERIAL PRIMARY KEY,
        name             TEXT NOT NULL,
        phone            TEXT NOT NULL,
        username         TEXT,
        password         TEXT,
        address          TEXT,
        contact_person   TEXT,
        tax_id           TEXT,
        invoice_title    TEXT,
        email            TEXT,
        line_user_id     TEXT,
        line_linked_at   TIMESTAMPTZ,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── orders ────────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id                        SERIAL PRIMARY KEY,
        order_no                  TEXT,
        customer_id               INTEGER,
        customer_name             TEXT NOT NULL,
        customer_phone            TEXT NOT NULL,
        customer_email            TEXT,
        pickup_date               TEXT,
        pickup_time               TEXT,
        required_license          TEXT,
        pickup_contact_name       TEXT,
        pickup_city               TEXT,
        pickup_district           TEXT,
        pickup_address            TEXT NOT NULL,
        pickup_contact_person     TEXT,
        delivery_date             TEXT,
        delivery_time             TEXT,
        delivery_contact_name     TEXT,
        delivery_city             TEXT,
        delivery_district         TEXT,
        delivery_address          TEXT NOT NULL,
        delivery_contact_person   TEXT,
        cargo_name                TEXT,
        cargo_description         TEXT NOT NULL,
        cargo_quantity            TEXT,
        qty                       INTEGER,
        cargo_weight              REAL,
        gross_weight              REAL,
        cargo_length_m            REAL,
        cargo_width_m             REAL,
        cargo_height_m            REAL,
        region                    TEXT,
        required_vehicle_type     TEXT,
        vehicle_type              TEXT,
        need_tailgate             TEXT,
        need_hydraulic_pallet     TEXT,
        special_requirements      TEXT,
        route_id                  TEXT,
        route_prefix              TEXT,
        station_count             INTEGER,
        shopee_driver_id          TEXT,
        dispatch_dock             TEXT,
        fleet_id                  INTEGER,
        fleet_driver_id           INTEGER,
        fusingao_fleet_id         INTEGER,
        team_id                   INTEGER,
        zone_id                   INTEGER,
        monthly_bill_id           INTEGER,
        status                    TEXT NOT NULL DEFAULT 'pending',
        order_status              TEXT,
        is_cold_chain             BOOLEAN NOT NULL DEFAULT FALSE,
        driver_id                 INTEGER REFERENCES drivers(id),
        notes                     TEXT,
        base_price                REAL,
        extra_fee                 REAL,
        total_fee                 REAL,
        quote_amount              REAL,
        cost_amount               REAL,
        profit_amount             REAL,
        driver_pay                REAL,
        fee_status                TEXT NOT NULL DEFAULT 'unpaid',
        payment_status            TEXT,
        invoice_status            TEXT DEFAULT 'none',
        source_channel            TEXT,
        assigned_method           VARCHAR(20),
        quick_order_token         TEXT,
        quick_order_token_key     TEXT,
        exception_code            TEXT,
        suggested_price           REAL,
        driver_accepted_at        TIMESTAMPTZ,
        check_in_at               TIMESTAMPTZ,
        signature_photo_url       TEXT,
        completed_at              TIMESTAMPTZ,
        extra_pickup_addresses    TEXT,
        extra_delivery_addresses  TEXT,
        enterprise_id             INTEGER,
        order_group_id            TEXT,
        payment_note              TEXT,
        payment_confirmed_at      TIMESTAMPTZ,
        driver_payment_status     TEXT NOT NULL DEFAULT 'unpaid',
        franchisee_payment_status TEXT NOT NULL DEFAULT 'unpaid',
        distance_km               REAL,
        pricing_breakdown         TEXT,
        price_locked              BOOLEAN NOT NULL DEFAULT FALSE,
        price_locked_at           TIMESTAMPTZ,
        price_locked_by           TEXT,
        arrival_notified_at       TIMESTAMPTZ,
        wait_minutes              REAL DEFAULT 0,
        surcharge_amount          REAL DEFAULT 0,
        surcharge_reason          TEXT,
        custom_field_values       TEXT,
        operator_name             TEXT,
        settled_at                TIMESTAMPTZ,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── vehicle_types ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_types (
        id                 SERIAL PRIMARY KEY,
        name               TEXT NOT NULL,
        length_m           REAL,
        width_m            REAL,
        height_m           REAL,
        volume_m3          REAL,
        max_weight_kg      REAL,
        pallet_count       INTEGER,
        has_tailgate       BOOLEAN DEFAULT FALSE,
        has_refrigeration  BOOLEAN DEFAULT FALSE,
        has_dump_body      BOOLEAN DEFAULT FALSE,
        height_limit_m     REAL,
        weight_limit_kg    REAL,
        cargo_types        TEXT,
        notes              TEXT,
        base_fee           REAL
      )
    `);

    // ── vehicle_licenses ──────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_licenses (
        id              SERIAL PRIMARY KEY,
        driver_id       INTEGER,
        license_type    TEXT NOT NULL,
        license_number  TEXT,
        owner_name      TEXT,
        owner_phone     TEXT,
        vehicle_plate   TEXT,
        issued_date     TEXT,
        expiry_date     TEXT NOT NULL,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── enterprise_accounts ───────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enterprise_accounts (
        id                    SERIAL PRIMARY KEY,
        company_name          TEXT NOT NULL,
        short_name            TEXT,
        account_code          TEXT NOT NULL UNIQUE,
        password_hash         TEXT NOT NULL,
        contact_person        TEXT NOT NULL,
        phone                 TEXT NOT NULL,
        email                 TEXT,
        tax_id                TEXT,
        invoice_title         TEXT,
        address               TEXT,
        postal_code           TEXT,
        industry              TEXT,
        billing_type          TEXT NOT NULL DEFAULT 'prepaid',
        payment_type          TEXT,
        credit_limit          REAL NOT NULL DEFAULT 0,
        credit_days           INTEGER,
        monthly_statement_day INTEGER,
        discount_percent      REAL NOT NULL DEFAULT 0,
        price_level           TEXT,
        unit_price_fixed      REAL,
        min_monthly_spend     REAL,
        contract_type         TEXT,
        contract_start        TEXT,
        contract_end          TEXT,
        is_vip                BOOLEAN NOT NULL DEFAULT FALSE,
        priority_dispatch     BOOLEAN NOT NULL DEFAULT FALSE,
        exclusive_note        TEXT,
        notes                 TEXT,
        status                TEXT NOT NULL DEFAULT 'active',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── enterprise_saved_templates ────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enterprise_saved_templates (
        id                   SERIAL PRIMARY KEY,
        enterprise_id        INTEGER NOT NULL REFERENCES enterprise_accounts(id),
        nickname             TEXT NOT NULL,
        pickup_address       TEXT NOT NULL,
        delivery_address     TEXT,
        cargo_description    TEXT,
        vehicle_type         TEXT,
        special_requirements TEXT,
        use_count            INTEGER NOT NULL DEFAULT 0,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── enterprise_sub_accounts ───────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enterprise_sub_accounts (
        id            SERIAL PRIMARY KEY,
        enterprise_id INTEGER NOT NULL REFERENCES enterprise_accounts(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        sub_code      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'purchaser',
        email         TEXT,
        phone         TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── enterprise_notifications ──────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enterprise_notifications (
        id            SERIAL PRIMARY KEY,
        enterprise_id INTEGER NOT NULL REFERENCES enterprise_accounts(id) ON DELETE CASCADE,
        order_id      INTEGER,
        type          TEXT NOT NULL,
        title         TEXT NOT NULL,
        body          TEXT NOT NULL,
        is_read       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── partner_fleets ────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS partner_fleets (
        id                     SERIAL PRIMARY KEY,
        name                   TEXT NOT NULL,
        contact_person         TEXT NOT NULL,
        phone                  TEXT NOT NULL,
        line_group_id          TEXT,
        regions                TEXT,
        vehicle_types          TEXT,
        rate_type              TEXT NOT NULL DEFAULT 'flat',
        base_rate              REAL NOT NULL DEFAULT 0,
        commission_type        TEXT NOT NULL DEFAULT 'percent',
        commission_value       REAL NOT NULL DEFAULT 0,
        profit_alert_threshold REAL DEFAULT 10,
        reliability_score      REAL DEFAULT 80,
        total_orders           INTEGER NOT NULL DEFAULT 0,
        completed_orders       INTEGER NOT NULL DEFAULT 0,
        auto_assign            BOOLEAN NOT NULL DEFAULT FALSE,
        status                 TEXT NOT NULL DEFAULT 'active',
        notes                  TEXT,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── outsourced_orders ─────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS outsourced_orders (
        id                   SERIAL PRIMARY KEY,
        order_id             INTEGER NOT NULL,
        fleet_id             INTEGER REFERENCES partner_fleets(id),
        transfer_price       REAL NOT NULL DEFAULT 0,
        fleet_price          REAL NOT NULL DEFAULT 0,
        commission_type      TEXT NOT NULL DEFAULT 'percent',
        commission_value     REAL NOT NULL DEFAULT 0,
        profit               REAL NOT NULL DEFAULT 0,
        profit_percent       REAL NOT NULL DEFAULT 0,
        profit_alert         BOOLEAN NOT NULL DEFAULT FALSE,
        status               TEXT NOT NULL DEFAULT 'pending_notify',
        fleet_driver_name    TEXT,
        fleet_driver_phone   TEXT,
        fleet_driver_plate   TEXT,
        notification_sent_at TIMESTAMPTZ,
        fleet_accepted_at    TIMESTAMPTZ,
        notes                TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── auto_dispatch_settings ────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auto_dispatch_settings (
        id                            SERIAL PRIMARY KEY,
        self_fleet_first              BOOLEAN NOT NULL DEFAULT TRUE,
        auto_outsource_when_full      BOOLEAN NOT NULL DEFAULT FALSE,
        auto_outsource_low_profit     BOOLEAN NOT NULL DEFAULT FALSE,
        low_profit_threshold          REAL NOT NULL DEFAULT 15,
        default_profit_alert_threshold REAL NOT NULL DEFAULT 10,
        preferred_fleet_id            INTEGER,
        line_notify_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── payments ──────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                    SERIAL PRIMARY KEY,
        order_id              INTEGER NOT NULL REFERENCES orders(id),
        amount                REAL NOT NULL,
        method                TEXT NOT NULL DEFAULT 'cash',
        note                  TEXT,
        collected_by          TEXT,
        receipt_number        TEXT,
        receipt_company_title TEXT,
        receipt_tax_id        TEXT,
        is_voided             BOOLEAN NOT NULL DEFAULT FALSE,
        void_reason           TEXT,
        notification_sent_at  TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── admin_roles ───────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        permissions  JSONB NOT NULL,
        is_system    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── admin_users ───────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name  VARCHAR(100) NOT NULL,
        email         VARCHAR(200),
        role_id       INTEGER REFERENCES admin_roles(id),
        is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── custom_fields ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id            SERIAL PRIMARY KEY,
        form_type     VARCHAR(50) NOT NULL,
        field_key     VARCHAR(100) NOT NULL,
        field_label   VARCHAR(200) NOT NULL,
        field_type    VARCHAR(50) NOT NULL,
        options       JSONB,
        is_required   BOOLEAN NOT NULL DEFAULT FALSE,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── audit_logs ────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id             SERIAL PRIMARY KEY,
        operator_name  VARCHAR(100) NOT NULL DEFAULT '系統',
        operator_role  VARCHAR(100) NOT NULL DEFAULT 'system',
        action         VARCHAR(50) NOT NULL,
        resource_type  VARCHAR(100) NOT NULL,
        resource_id    VARCHAR(100),
        resource_label VARCHAR(500),
        description    TEXT,
        ip_address     VARCHAR(100),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── otps ──────────────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id         SERIAL PRIMARY KEY,
        phone      VARCHAR(20) NOT NULL,
        otp        VARCHAR(6) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── line_accounts ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS line_accounts (
        id           SERIAL PRIMARY KEY,
        user_type    VARCHAR(20) NOT NULL,
        user_ref_id  TEXT NOT NULL,
        line_user_id TEXT NOT NULL UNIQUE,
        display_name TEXT,
        picture_url  TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── route_prices ──────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS route_prices (
        id                    SERIAL PRIMARY KEY,
        from_location         TEXT NOT NULL DEFAULT '桃園平鎮',
        to_location           TEXT NOT NULL,
        vehicle_type          TEXT NOT NULL,
        base_price            INTEGER NOT NULL,
        waiting_fee_per_hour  INTEGER DEFAULT 0,
        elevator_fee          INTEGER DEFAULT 0,
        tax_rate              REAL DEFAULT 5,
        heapmachine_only      BOOLEAN DEFAULT FALSE,
        notes                 TEXT,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── vehicle_costs ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_costs (
        id                        SERIAL PRIMARY KEY,
        vehicle_name              TEXT NOT NULL,
        vehicle_type              TEXT,
        plate_number              TEXT,
        vehicle_value             INTEGER DEFAULT 0,
        depreciation_years        INTEGER DEFAULT 5,
        residual_value            INTEGER DEFAULT 0,
        fuel_consumption_per_100km REAL DEFAULT 10,
        fuel_price_per_liter      REAL DEFAULT 32,
        license_tax_yearly        INTEGER DEFAULT 0,
        fuel_tax_yearly           INTEGER DEFAULT 0,
        maintenance_monthly       INTEGER DEFAULT 0,
        wear_monthly              INTEGER DEFAULT 0,
        driver_salary_monthly     INTEGER DEFAULT 0,
        insurance_yearly          INTEGER DEFAULT 0,
        other_monthly             INTEGER DEFAULT 0,
        working_days_monthly      INTEGER DEFAULT 25,
        trips_per_day             INTEGER DEFAULT 2,
        notes                     TEXT,
        created_at                TIMESTAMPTZ DEFAULT NOW(),
        updated_at                TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── driver_ratings ────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_ratings (
        id            SERIAL PRIMARY KEY,
        order_id      INTEGER NOT NULL,
        driver_id     INTEGER NOT NULL,
        customer_id   INTEGER,
        stars         INTEGER NOT NULL,
        comment       TEXT,
        license_plate TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── customer_notifications ────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_notifications (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER,
        order_id    INTEGER,
        type        TEXT NOT NULL,
        title       TEXT NOT NULL,
        message     TEXT NOT NULL,
        is_read     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── quote_requests ────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id                  SERIAL PRIMARY KEY,
        token               VARCHAR(64) NOT NULL UNIQUE,
        customer_name       TEXT,
        customer_phone      TEXT,
        customer_email      TEXT,
        company_name        TEXT,
        vehicle_type        TEXT NOT NULL,
        cargo_name          TEXT,
        cargo_weight        REAL,
        cargo_length_m      REAL,
        cargo_width_m       REAL,
        cargo_height_m      REAL,
        volume_cbm          REAL,
        distance_km         REAL,
        from_address        TEXT,
        to_address          TEXT,
        pickup_date         TEXT,
        pickup_time         TEXT,
        special_cargoes     TEXT,
        need_cold_chain     BOOLEAN DEFAULT FALSE,
        cold_chain_temp     TEXT,
        waiting_hours       REAL DEFAULT 0,
        tolls_fixed         INTEGER DEFAULT 0,
        base_price          INTEGER,
        distance_charge     INTEGER,
        weight_surcharge    INTEGER,
        volume_surcharge    INTEGER,
        special_surcharge   INTEGER,
        cold_chain_fee      INTEGER,
        waiting_fee         INTEGER,
        tax_amount          INTEGER,
        profit_amount       INTEGER,
        total_amount        INTEGER,
        breakdown           TEXT,
        status              TEXT NOT NULL DEFAULT 'draft',
        expires_at          TIMESTAMPTZ,
        converted_order_id  INTEGER,
        notes               TEXT,
        source              TEXT DEFAULT 'web',
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── order_settlements ─────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_settlements (
        id                SERIAL PRIMARY KEY,
        order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        order_no          TEXT,
        driver_id         INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
        total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        commission_rate   NUMERIC(5,2) NOT NULL DEFAULT 15,
        commission_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(total_amount * commission_rate / 100, 2)) STORED,
        platform_revenue  NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(total_amount * commission_rate / 100, 2)) STORED,
        driver_payout     NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(total_amount * (100 - commission_rate) / 100, 2)) STORED,
        payment_status    TEXT NOT NULL DEFAULT 'unpaid',
        paid_at           TIMESTAMPTZ,
        payment_ref       TEXT,
        notes             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── ar_ap_records ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ar_ap_records (
        id                SERIAL PRIMARY KEY,
        order_id          INTEGER NOT NULL UNIQUE,
        order_no          TEXT,
        completed_at      TIMESTAMPTZ,
        customer_name     TEXT,
        pickup_address    TEXT,
        delivery_address  TEXT,
        vehicle_type      TEXT,
        distance_km       NUMERIC,
        ar_amount         NUMERIC NOT NULL DEFAULT 0,
        ap_driver         NUMERIC NOT NULL DEFAULT 0,
        ap_equipment      NUMERIC NOT NULL DEFAULT 0,
        ap_total          NUMERIC NOT NULL DEFAULT 0,
        net_profit        NUMERIC NOT NULL DEFAULT 0,
        profit_margin_pct NUMERIC,
        status            TEXT NOT NULL DEFAULT 'pending',
        notes             TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── webhooks (referenced by app.ts ATOMS_WEBHOOK_URL logic) ──────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        url        TEXT NOT NULL,
        events     TEXT[] NOT NULL DEFAULT '{}',
        note       TEXT,
        status     TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query("COMMIT");
    console.log("[SchemaMigration] All base tables created/verified successfully");
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("[SchemaMigration] Failed to create base tables:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
