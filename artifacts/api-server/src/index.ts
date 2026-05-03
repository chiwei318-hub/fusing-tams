import { loadEnvFiles } from "./lib/loadEnv";
import { ensureProcessTimeZone } from "./lib/timezone";
import { logger } from "./lib/logger";
import { runSchemaMigration } from "@workspace/db";

loadEnvFiles();
ensureProcessTimeZone();

// Bootstrap all base tables before any ensure* helpers run in app.ts.
// This is idempotent (CREATE TABLE IF NOT EXISTS) and safe to run on every
// startup — it is a no-op once the tables already exist.
try {
  await runSchemaMigration();
} catch (err) {
  logger.error({ err }, "[SchemaMigration] Fatal: could not create base tables");
  process.exit(1);
}

const { default: app } = await import("./app");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
