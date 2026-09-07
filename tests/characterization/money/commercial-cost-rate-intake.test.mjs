/**
 * #6/#7 GATE 2 — commercial trip cost rate API writer contracts (source + shape).
 * Does not invent money; does not call engine as E2E substitute.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");

const routeSrc = readFileSync(
  join(root, "artifacts/api-server/src/routes/commercialTripCostRates.ts"),
  "utf8",
);
const indexSrc = readFileSync(
  join(root, "artifacts/api-server/src/routes/index.ts"),
  "utf8",
);
const tabSrc = readFileSync(
  join(root, "artifacts/logistics/src/pages/admin/CommercialTripCostRatesTab.tsx"),
  "utf8",
);
const adminSrc = readFileSync(
  join(root, "artifacts/logistics/src/pages/Admin.tsx"),
  "utf8",
);
const applySrc = readFileSync(
  join(root, "artifacts/api-server/src/lib/applyCommercialOrderCost.ts"),
  "utf8",
);
const engineSrc = readFileSync(
  join(root, "artifacts/api-server/src/lib/commercialCostEngine.ts"),
  "utf8",
);

describe("#6/#7 GATE2 commercial rate intake wiring", () => {
  it("rate route mounts CREATE + LIST writer (not fixture-only)", () => {
    assert.ok(indexSrc.includes("commercialTripCostRatesRouter"));
    assert.ok(routeSrc.includes('"/commercial-trip-cost-rates"'));
    assert.ok(routeSrc.includes(".insert(commercialTripCostRatesTable)"));
    assert.ok(routeSrc.includes("standardDriverTripCost"));
    assert.ok(routeSrc.includes("positive"));
  });

  it("CREATE rejects non-positive cost and enforces L1/L2/L3 shape", () => {
    assert.ok(routeSrc.includes("matchLevel"));
    assert.ok(routeSrc.includes("L1 需填寫"));
    assert.ok(routeSrc.includes("L2 需填寫"));
    assert.ok(routeSrc.includes("shapeFieldsForLevel"));
    assert.ok(!/standardDriverTripCost.*\?\? 0/.test(routeSrc));
    assert.ok(!/\* 0\.15/.test(routeSrc));
    assert.ok(!/\/ 1\.05/.test(routeSrc));
  });

  it("Admin rate UI posts to normal API (no raw SQL / no engine call)", () => {
    assert.ok(tabSrc.includes("/api/commercial-trip-cost-rates"));
    assert.ok(tabSrc.includes("method: \"POST\""));
    assert.ok(adminSrc.includes("CommercialTripCostRatesTab"));
    assert.ok(adminSrc.includes("commercial-cost-rates"));
    assert.ok(!/INSERT INTO commercial_trip_cost_rates/.test(tabSrc));
    assert.ok(!/lookupCommercialTripCost/.test(tabSrc));
  });

  it("Admin order list displays costAmount without inventing zero/15%", () => {
    assert.ok(adminSrc.includes("order-cost-amount-"));
    assert.ok(adminSrc.includes("未匹配"));
    assert.ok(adminSrc.includes("costAmount"));
    // must not coerce null → 0 for display invent
    assert.ok(!/costAmount\s*\?\?\s*0/.test(adminSrc));
    assert.ok(!/costAmount\s*\|\|\s*0/.test(adminSrc));
    assert.ok(!/\* 0\.15/.test(adminSrc.slice(adminSrc.indexOf("order-cost-amount-"))));
  });

  it("existing commercial engine SSoT unchanged (reuse, no second engine)", () => {
    assert.ok(applySrc.includes("lookupCommercialTripCost"));
    assert.ok(engineSrc.includes("L1 district"));
    assert.ok(!/0\.7|0\.8|0\.15/.test(engineSrc));
    assert.ok(!routeSrc.includes("lookupCommercialTripCost")); // writer is intake only
  });
});
