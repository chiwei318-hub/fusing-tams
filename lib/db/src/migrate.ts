import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { existsSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs Drizzle migrations from the drizzle/ folder.
 *
 * This is idempotent — safe to call on every startup. Drizzle tracks which
 * migrations have already been applied in the `__drizzle_migrations` table
 * and only runs new ones.
 */
export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const db = drizzle(pool);

    // Docker (WORKDIR /app): /app/lib/db/drizzle. Local dev: ../drizzle from this file. Override: DRIZZLE_MIGRATIONS_PATH.
    const defaultFolder = existsSync("/app/lib/db/drizzle")
      ? "/app/lib/db/drizzle"
      : path.join(__dirname, "../drizzle");
    const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_PATH || defaultFolder;

    console.log("[migrate] Running Drizzle migrations from", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully");
  } finally {
    await pool.end();
  }
}
