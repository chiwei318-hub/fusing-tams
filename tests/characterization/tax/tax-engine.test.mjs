/**
 * Unit tests mirroring artifacts/api-server/src/lib/taxEngine.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcExclusiveVat } from "../money/formulas.mjs";

describe("taxEngine exclusive VAT", () => {
  it("10000 → tax 500, grand 10500", () => {
    const r = calcExclusiveVat(10000);
    assert.equal(r.taxAmount, 500);
    assert.equal(r.grandTotal, 10500);
    assert.equal(r.basis, "exclusive");
    assert.ok(r.rateVersion);
  });

  it("never uses inclusive reverse for 10000", () => {
    const r = calcExclusiveVat(10000);
    assert.notEqual(r.taxAmount, 476.19);
    assert.notEqual(r.taxAmount, 476);
  });
});
