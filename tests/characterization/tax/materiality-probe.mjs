/**
 * Read-only tax materiality probe (P0-1 parallel). No writes.
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
}

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.log(JSON.stringify({ error: "NO_DATABASE_URL" }));
  process.exit(0);
}

const c = new pg.Client({ connectionString: url });
await c.connect();

const vat = await c.query(`
  SELECT
    COUNT(*) FILTER (WHERE total_fee > 0)::int AS orders_with_fee,
    COUNT(*) FILTER (WHERE total_fee > 0 AND vat_amount IS NOT NULL)::int AS with_vat,
    COUNT(*) FILTER (WHERE total_fee > 0 AND ABS(COALESCE(vat_amount,0) - ROUND((total_fee * 0.05)::numeric, 2)) < 0.01)::int AS match_exclusive,
    COUNT(*) FILTER (WHERE total_fee > 0 AND ABS(COALESCE(vat_amount,0) - ROUND((total_fee / 1.05 * 0.05)::numeric, 2)) < 0.01)::int AS match_inclusive,
    COALESCE(SUM(
      CASE WHEN total_fee > 0
        THEN ROUND((total_fee * 0.05)::numeric, 2) - COALESCE(vat_amount,0)
        ELSE 0 END
    ),0)::numeric AS sum_delta_exclusive_minus_stored
  FROM orders
`);

let invoices_90d = null;
try {
  const inv = await c.query(`
    SELECT COUNT(*)::int AS cnt,
           COALESCE(SUM(total_amount),0)::numeric AS sum_total
    FROM invoices
    WHERE created_at >= NOW() - INTERVAL '90 days'
  `);
  invoices_90d = inv.rows[0];
} catch (e) {
  invoices_90d = { error: String(e.message).slice(0, 200) };
}

let monthly_bills = null;
try {
  const bills = await c.query(`
    SELECT COUNT(*)::int AS cnt,
           COALESCE(SUM(total_amount),0)::numeric AS sum_total
    FROM monthly_bills
  `);
  monthly_bills = bills.rows[0];
} catch (e) {
  monthly_bills = { error: String(e.message).slice(0, 200) };
}

console.log(JSON.stringify({
  queried_at: new Date().toISOString(),
  vat: vat.rows[0],
  invoices_90d,
  monthly_bills,
}, null, 2));

await c.end();
