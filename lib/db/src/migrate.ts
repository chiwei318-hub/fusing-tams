import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
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

    // Migrations folder is at lib/db/drizzle/ — two levels up from src/
    const migrationsFolder = path.join(__dirname, "../../drizzle");

    console.log("[migrate] Running Drizzle migrations from", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully");
  } finally {
    await pool.end();
  }
}
