import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_STATUSES,
  VALID_TRANSITIONS,
  isCanonicalStatus,
  assertCanonicalStatus,
  assertTransition,
  canTransition,
  deriveTmsOrderStatus,
  prepareStatusWrite,
} from "./engine.mjs";

describe("P0-1 orderStatusEngine: allowlist", () => {
  it("accepts all canonical statuses including accepted/arrived/loading/exception", () => {
    for (const s of [
      "pending", "assigned", "accepted", "arrived", "loading",
      "in_transit", "delivered", "exception", "cancelled",
    ]) {
      assert.equal(isCanonicalStatus(s), true);
      assert.equal(assertCanonicalStatus(s), s);
    }
    assert.equal(CANONICAL_STATUSES.length, 9);
  });

  it("rejects illegal status values", () => {
    for (const bad of ["picking", "settled", "completed", "foo", "", null, 1]) {
      assert.equal(isCanonicalStatus(bad), false);
      assert.throws(() => assertCanonicalStatus(bad));
      assert.throws(() => prepareStatusWrite(bad));
    }
  });

  it("preserves accepted as first-class write (not normalized away)", () => {
    const w = prepareStatusWrite("accepted");
    assert.equal(w.status, "accepted");
    assert.equal(w.orderStatus, "accepted");
  });
});

describe("P0-1 orderStatusEngine: transitions", () => {
  it("assigned → accepted → in_transit|arrived (fleet + flow)", () => {
    assert.equal(canTransition("assigned", "accepted"), true);
    assert.equal(canTransition("accepted", "in_transit"), true);
    assert.equal(canTransition("accepted", "arrived"), true);
    assert.doesNotThrow(() => assertTransition("accepted", "arrived"));
  });

  it("does not allow accepted → loading (must go arrived first — matches orderStatusFlow)", () => {
    assert.equal(canTransition("accepted", "loading"), false);
    assert.throws(() => assertTransition("accepted", "loading"));
    assert.equal(canTransition("arrived", "loading"), true);
  });

  it("terminals have no outbound transitions", () => {
    assert.deepEqual([...VALID_TRANSITIONS.delivered], []);
    assert.deepEqual([...VALID_TRANSITIONS.cancelled], []);
    assert.throws(() => assertTransition("delivered", "pending"));
  });

  it("exception can recover to assigned / in_transit / delivered", () => {
    assert.equal(canTransition("exception", "assigned"), true);
    assert.equal(canTransition("exception", "in_transit"), true);
    assert.equal(canTransition("exception", "delivered"), true);
  });
});

describe("P0-1 orderStatusEngine: TMS derive", () => {
  it("maps coarse and fine statuses", () => {
    assert.equal(deriveTmsOrderStatus("pending"), "pending");
    assert.equal(deriveTmsOrderStatus("assigned"), "accepted");
    assert.equal(deriveTmsOrderStatus("accepted"), "accepted");
    assert.equal(deriveTmsOrderStatus("arrived"), "picking");
    assert.equal(deriveTmsOrderStatus("loading"), "picking");
    assert.equal(deriveTmsOrderStatus("in_transit"), "picking");
    assert.equal(deriveTmsOrderStatus("exception"), "picking"); // NOTE: exception not visible on order_status alone
    assert.equal(deriveTmsOrderStatus("delivered"), "delivered");
    assert.equal(deriveTmsOrderStatus("cancelled"), "cancelled");
  });

  it("prepareStatusWrite dual fields", () => {
    assert.deepEqual(prepareStatusWrite("in_transit"), {
      status: "in_transit",
      orderStatus: "picking",
    });
  });
});
