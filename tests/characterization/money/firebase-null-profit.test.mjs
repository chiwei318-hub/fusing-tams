import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firebaseNullableMoney } from "./formulas.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fbSrc = readFileSync(
  join(__dirname, "../../../artifacts/api-server/src/routes/firebaseSync.ts"),
  "utf8"
);

describe("MONEY #2dA firebase NULL profit preservation", () => {
  it("A: DB profit=NULL → Firebase profit=null", () => {
    assert.equal(firebaseNullableMoney(null), null);
    assert.equal(firebaseNullableMoney(undefined), null);
  });

  it("B: DB profit=0 → Firebase profit=0", () => {
    assert.equal(firebaseNullableMoney(0), 0);
  });

  it("C: DB profit=9200 → 9200", () => {
    assert.equal(firebaseNullableMoney(9200), 9200);
  });

  it("D: DB profit=-2000 → -2000", () => {
    assert.equal(firebaseNullableMoney(-2000), -2000);
  });

  it("E: NULL vs numeric zero distinguishable", () => {
    assert.notEqual(firebaseNullableMoney(null), firebaseNullableMoney(0));
  });

  it("F: must not produce NaN", () => {
    assert.equal(firebaseNullableMoney(Number.NaN), null);
    assert.equal(firebaseNullableMoney("x"), null);
  });

  it("source: uses nullableMoney; no Number(order.profit) coerce", () => {
    assert.match(fbSrc, /function nullableMoney/);
    assert.match(fbSrc, /profit: nullableMoney\(order\.profit\)/);
    assert.doesNotMatch(fbSrc, /profit:\s*Number\(order\.profit\)/);
  });
});
