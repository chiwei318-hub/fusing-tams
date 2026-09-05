const fs = require("node:fs");
const path = require("node:path");
const { defineConfig } = require("drizzle-kit");

/** Load KEY=VALUE from a .env file into process.env (does not override existing). */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, "../../.env"));
loadEnvFile(path.join(__dirname, ".env"));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Set it in the repo-root .env (e.g. postgresql://postgres:PASSWORD@localhost:5432/logistics_db)",
  );
}

// Relative paths (cwd = lib/db). Absolute Windows paths break drizzle-kit schema discovery.
module.exports = defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
