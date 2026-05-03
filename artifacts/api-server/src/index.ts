import { loadEnvFiles } from "./lib/loadEnv";
import { ensureProcessTimeZone } from "./lib/timezone";
import { logger } from "./lib/logger";
import { runMigrations } from "@workspace/db";

loadEnvFiles();
ensureProcessTimeZone();

// Run Drizzle migrations before starting the server so all schema tables exist
try {
  await runMigrations();
} catch (err) {
  logger.error({ err }, "[migrate] Failed to run database migrations");
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
