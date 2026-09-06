import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { existsSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveMigrationsFolder(): string {
  if (process.env.DRIZZLE_MIGRATIONS_PATH) {
    return process.env.DRIZZLE_MIGRATIONS_PATH;
  }

  // When bundled into artifacts/api-server/dist, __dirname is no longer lib/db/src.
  // Try common locations (Docker, monorepo root cwd, api-server cwd, source layout).
  const candidates = [
    "/app/lib/db/drizzle",
    path.join(process.cwd(), "lib/db/drizzle"),
    path.join(process.cwd(), "../../lib/db/drizzle"),
    path.join(__dirname, "../drizzle"),
    path.join(__dirname, "../../../lib/db/drizzle"),
    path.join(__dirname, "../../../../lib/db/drizzle"),
  ];

  for (const folder of candidates) {
    const journal = path.join(folder, "meta", "_journal.json");
    if (existsSync(journal)) return path.resolve(folder);
  }

  throw new Error(
    `Can't find drizzle migrations (meta/_journal.json). Tried:\n- ${candidates.join("\n- ")}\nSet DRIZZLE_MIGRATIONS_PATH to the absolute path of lib/db/drizzle.`,
  );
}

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
    const migrationsFolder = resolveMigrationsFolder();

    console.log("[migrate] Running Drizzle migrations from", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully");
  } finally {
    await pool.end();
  }
}

// CLI: `pnpm --filter @workspace/db migrate` / `tsx ./src/migrate.ts`
const isDirectRun =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runMigrations().catch((err) => {
    console.error("[migrate] Failed:", err);
    process.exit(1);
  });
}
