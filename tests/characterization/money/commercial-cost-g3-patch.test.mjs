/**
 * G3 — PATCH costAmount scope restoration (separate from #12 durability).
 * Restores pre-#6 PATCH write; must NOT weaken commercial CREATE security.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { simulateOrderCostWrite } from "./commercial-cost-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const ordersPath = join(root, "artifacts/api-server/src/routes/orders.ts");
const ordersSrc = readFileSync(ordersPath, "utf8");
const apiZodSrc = readFileSync(join(root, "lib/api-zod/src/generated/api.ts"), "utf8");

function headOrdersSnippet() {
  try {
    return execSync("git show HEAD:artifacts/api-server/src/routes/orders.ts", {
      cwd: root,
      encoding: "utf8",
    });
  } catch {
    return "";
  }
}

describe("G3 PATCH costAmount scope restoration", () => {
  it("#G3-1 PATCH prior capability restored (pre-#6 contract)", () => {
    const head = headOrdersSnippet();
    assert.ok(
      /if \(body\.costAmount !== undefined\) updates\.costAmount = body\.costAmount/.test(head),
      "HEAD before #6 wrote body.costAmount",
    );
    assert.ok(
      /if \(body\.costAmount !== undefined\) updates\.costAmount = body\.costAmount/.test(ordersSrc),
      "CURRENT restores body.costAmount write",
    );
    assert.ok(
      /if \(body\.profitAmount !== undefined\) updates\.profitAmount = body\.profitAmount/.test(
        ordersSrc,
      ),
    );
    // UpdateOrderBody still accepts costAmount (schema never removed)
    assert.ok(/costAmount:\s*zod\.number\(\)\.nullish\(\)/.test(apiZodSrc));
  });

  it("#G3-2 commercial CREATE MATCHED still ignores client W", async () => {
    const { request, db, engine } = await simulateOrderCostWrite({
      facts: {
        customerId: 42,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        vehicleType: "箱型車",
        serviceType: "冷鏈",
      },
      rates: [
        {
          id: 1,
          matchLevel: 1,
          originCity: "台北市",
          originDistrict: "中山區",
          destinationCity: "新北市",
          destinationDistrict: "板橋區",
          vehicleType: "箱型車",
          serviceType: "冷鏈",
          standardDriverTripCost: 3100,
          active: true,
          blockFallthrough: false,
        },
      ],
      clientCostAmount: 999999,
    });
    assert.equal(request.cost_amount, 999999);
    assert.equal(engine.standardCost, 3100);
    assert.equal(db.cost_amount, 3100);
  });

  it("#G3-3 commercial CREATE MISS still ignores client W → NULL", async () => {
    const { request, db } = await simulateOrderCostWrite({
      facts: {
        customerId: 42,
        originCity: "台北市",
        originDistrict: "中山區",
        destinationCity: "新北市",
        destinationDistrict: "板橋區",
        vehicleType: "箱型車",
        serviceType: "冷鏈",
      },
      rates: [],
      clientCostAmount: 999999,
    });
    assert.equal(request.cost_amount, 999999);
    assert.equal(db.lookup_status, "MISS");
    assert.equal(db.cost_amount, null);
  });

  it("G3 isolation: create path still omits trusting CreateOrderBody cost fields", () => {
    // CreateOrderBody intentionally omits costAmount
    const createSlice = apiZodSrc.slice(
      apiZodSrc.indexOf("export const CreateOrderBody"),
      apiZodSrc.indexOf("export const GetOrderParams"),
    );
    assert.ok(createSlice.includes("intentionally OMITTED") || !/costAmount:/.test(createSlice));
    assert.ok(ordersSrc.includes("applyCommercialOrderCost"));
    assert.ok(ordersSrc.includes("clientCostAmount"));
  });
});
