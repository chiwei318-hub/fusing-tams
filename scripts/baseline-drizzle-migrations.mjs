/**
 * Mark existing drizzle SQL migrations as applied without re-running CREATE TABLE.
 * Use after `drizzle-kit push` already created the schema.
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   node scripts/baseline-drizzle-migrations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const drizzleDir = path.join(root, "lib/db/drizzle");
const journalPath = path.join(drizzleDir, "meta/_journal.json");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!fs.existsSync(journalPath)) {
  console.error("Missing", journalPath);
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
await pool.query(`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`);

for (const entry of journal.entries) {
  const sqlPath = path.join(drizzleDir, `${entry.tag}.sql`);
  const query = fs.readFileSync(sqlPath);
  const hash = crypto.createHash("sha256").update(query).digest("hex");
  const createdAt = entry.when ?? Date.now();

  const exists = await pool.query(
    `SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1 LIMIT 1`,
    [hash],
  );
  if (exists.rowCount) {
    console.log("already baselined:", entry.tag);
    continue;
  }
  await pool.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [hash, createdAt],
  );
  console.log("baselined:", entry.tag, hash.slice(0, 12) + "...");
}

await pool.end();
console.log("Done. You can start the API without SKIP_DB_MIGRATE.");
