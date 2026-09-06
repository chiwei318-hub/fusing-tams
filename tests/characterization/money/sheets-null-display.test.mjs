import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sheetsFmtMoneyNullable, sheetsFmtLegacy } from "./formulas.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sheetsSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/sheetsExport.ts"),
  "utf8"
);

describe("MONEY #2dA sheets NULL display (UNKNOWN ≠ ZERO)", () => {
  it("A/B: null profit/cost-style money → blank", () => {
    assert.equal(sheetsFmtMoneyNullable(null), "");
    assert.equal(sheetsFmtMoneyNullable(undefined), "");
  });

  it("C/D: numeric zero → \"0\" (distinguishable from blank)", () => {
    assert.equal(sheetsFmtMoneyNullable(0), "0");
    assert.notEqual(sheetsFmtMoneyNullable(0), sheetsFmtMoneyNullable(null));
  });

  it("E: cost/profit 800 → normal", () => {
    assert.equal(sheetsFmtMoneyNullable(800), "800");
  });

  it("F: profit -200 → normal", () => {
    assert.equal(sheetsFmtMoneyNullable(-200), "-200");
  });

  it("G: UNKNOWN vs ZERO distinguishable", () => {
    assert.equal(sheetsFmtMoneyNullable(null), "");
    assert.equal(sheetsFmtMoneyNullable(0), "0");
    assert.notEqual("", "0");
  });

  it("source: profit uses fmtMoneyNullable; global fmt unchanged for COALESCE columns", () => {
    assert.match(sheetsSrc, /function fmtMoneyNullable/);
    assert.match(sheetsSrc, /fmtMoneyNullable\(r\.profit\)/);
    assert.match(sheetsSrc, /fmt\(r\.client_bill\)/);
    assert.match(sheetsSrc, /fmt\(r\.driver_payout\)/);
    // legacy fmt still null→"0" for non-canonical COALESCE fields
    assert.equal(sheetsFmtLegacy(null), "0");
    assert.match(sheetsSrc, /if \(v == null\) return "";/);
  });
});
