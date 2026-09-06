/**
 * Apply #12 calc_order_finance durability repair to LOCAL DB only (CREATE OR REPLACE).
 * No DROP table / no DELETE business rows.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import pg from "pg";

const root = process.cwd();
function loadUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of [".env", ".env.local"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}
const url = loadUrl();
if (!url || !(/@localhost\b/i.test(url) || /@127\.0\.0\.1\b/i.test(url))) {
  console.error("REFUSE: not LOCAL DATABASE_URL");
  process.exit(2);
}
const masked = url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
const c = new pg.Client({ connectionString: url });
await c.connect();

await c.query(`
CREATE OR REPLACE FUNCTION calc_order_finance()
RETURNS TRIGGER AS $$
DECLARE
  v_rate   NUMERIC := NULL;
  v_comm   NUMERIC := 0;
  v_vat    NUMERIC;
BEGIN
  SELECT COALESCE(NULLIF(driver_pay_rate, 0), NULLIF(rate_per_trip, 0))
    INTO v_rate
    FROM route_prefix_rates
   WHERE prefix = NEW.route_prefix
   LIMIT 1;

  IF v_rate IS NOT NULL AND v_rate <= 0 THEN
    v_rate := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.cost_amount := v_rate;
  ELSIF NEW.route_prefix IS NOT NULL THEN
    NEW.cost_amount := v_rate;
  ELSIF OLD.route_prefix IS NOT NULL THEN
    NEW.cost_amount := NULL;
    v_rate := NULL;
  ELSE
    NULL;
  END IF;

  IF NEW.total_fee IS NOT NULL AND NEW.total_fee > 0 THEN
    v_vat := ROUND((NEW.total_fee * 0.05)::NUMERIC, 2);
    NEW.vat_amount := v_vat;
    IF NEW.cost_amount IS NOT NULL THEN
      NEW.profit_amount := ROUND((NEW.total_fee - NEW.cost_amount)::NUMERIC, 2);
    ELSE
      NEW.profit_amount := NULL;
    END IF;
  ELSE
    NEW.vat_amount    := 0;
    NEW.profit_amount := NULL;
  END IF;

  IF NEW.fusingao_fleet_id IS NOT NULL THEN
    IF v_rate IS NULL THEN
      NEW.fleet_payout := NULL;
    ELSE
      SELECT COALESCE(commission_rate, 0)
        INTO v_comm
        FROM fusingao_fleets
       WHERE id = NEW.fusingao_fleet_id
       LIMIT 1;
      NEW.fleet_payout := ROUND(
        (v_rate * (1 - COALESCE(v_comm, 0) / 100))::NUMERIC, 2
      );
    END IF;
  ELSE
    NEW.fleet_payout := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`);

const def = await c.query(
  `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p WHERE p.proname = 'calc_order_finance' LIMIT 1`,
);
const body = def.rows[0]?.def ?? "";
console.log(
  JSON.stringify(
    {
      target: masked,
      applied: true,
      has_t1: body.includes("ELSE") && body.includes("TG_OP"),
      has_preserve_branch: /OLD\.route_prefix IS NOT NULL/.test(body),
      profit_uses_cost_amount: body.includes("NEW.total_fee - NEW.cost_amount"),
    },
    null,
    2,
  ),
);
await c.end();
