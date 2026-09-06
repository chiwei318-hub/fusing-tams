/**
 * Static check: TaiwanAddressInput must destructure onLocationChange
 * (Browser E2E previously crashed: ReferenceError onLocationChange is not defined).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tw = readFileSync(
  join(__dirname, "../../../artifacts/logistics/src/components/TaiwanAddressInput.tsx"),
  "utf8",
);
const qop = readFileSync(
  join(__dirname, "../../../artifacts/logistics/src/components/QuickOrderPanel.tsx"),
  "utf8",
);

describe("#6 Fast UX onLocationChange wiring", () => {
  it("TaiwanAddressInput destructures onLocationChange prop", () => {
    assert.ok(
      /export function TaiwanAddressInput\(\{[^}]*onLocationChange[^}]*\}: Props\)/.test(tw),
      "must destructure onLocationChange from Props",
    );
    assert.ok(tw.includes("onLocationChange?.("));
    assert.ok(tw.includes("city: c"));
    assert.ok(tw.includes("district: d"));
  });

  it("QuickOrderPanel consumes city/district into submit body", () => {
    assert.ok(qop.includes("onLocationChange={(loc) => {"));
    assert.ok(qop.includes("setPickupCity(loc.city"));
    assert.ok(qop.includes("setPickupDistrict(loc.district"));
    assert.ok(qop.includes("setDeliveryCity(loc.city"));
    assert.ok(qop.includes("setDeliveryDistrict(loc.district"));
    assert.ok(qop.includes("pickupCity: pickupCity"));
    assert.ok(qop.includes("deliveryCity: deliveryCity"));
    assert.ok(qop.includes("customerId: customerId"));
  });
});
