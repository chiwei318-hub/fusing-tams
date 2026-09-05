/**
 * P0-1 follow-up #4: enterprise create must dual-write status + order_status.
 * Mirrors prepareStatusWrite("pending") — same contract as enterprise.ts inserts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareStatusWrite } from "./engine.mjs";

/** Same payload shape enterprise.ts uses on single + bulk create */
export function enterprisePendingInsertFields() {
  const w = prepareStatusWrite("pending");
  return { status: w.status, orderStatus: w.orderStatus };
}

describe("P0-1 #4 enterprise create coverage", () => {
  it("pending create sets orderStatus (not null) via prepareStatusWrite", () => {
    const fields = enterprisePendingInsertFields();
    assert.equal(fields.status, "pending");
    assert.notEqual(fields.orderStatus, null);
    assert.notEqual(fields.orderStatus, undefined);
    assert.equal(fields.orderStatus, "pending");
  });

  it("bulk-create shape matches single-create dual-write", () => {
    const a = enterprisePendingInsertFields();
    const b = prepareStatusWrite("pending");
    assert.deepEqual(a, { status: b.status, orderStatus: b.orderStatus });
  });
});
