import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OPENAPI_STATUS,
  P01_CANONICAL_STATUS,
  TMS_ORDER_STATUS,
  RUNTIME_FLOW_STATUS_ON_ORDERS_STATUS,
  FLEET_WRITES_TO_ORDERS_STATUS,
  STATUS_TO_ORDER_STATUS_BACKFILL,
  DRIVER_ACTION_TRANSITIONS,
  classifyStatusValue,
} from "./inventory.mjs";

describe("characterization: status inventory", () => {
  it("OpenAPI status set is exactly 5 values", () => {
    assert.deepEqual([...OPENAPI_STATUS], [
      "pending",
      "assigned",
      "in_transit",
      "delivered",
      "cancelled",
    ]);
  });

  it("P0-1 canonical includes OpenAPI + accepted/arrived/loading/exception", () => {
    assert.equal(P01_CANONICAL_STATUS.length, 9);
    for (const v of OPENAPI_STATUS) assert.ok(P01_CANONICAL_STATUS.includes(v));
    for (const v of ["accepted", "arrived", "loading", "exception"]) {
      assert.ok(P01_CANONICAL_STATUS.includes(v));
      assert.equal(OPENAPI_STATUS.includes(v), false);
    }
  });

  it("TMS order_status includes accepted/picking/settled not in OpenAPI status", () => {
    for (const v of ["accepted", "picking", "settled"]) {
      assert.ok(TMS_ORDER_STATUS.includes(v));
      assert.equal(OPENAPI_STATUS.includes(v), false);
    }
  });

  it("runtime flow writes arrived/loading/exception onto orders.status (now P0-1 canonical)", () => {
    for (const v of RUNTIME_FLOW_STATUS_ON_ORDERS_STATUS) {
      const c = classifyStatusValue(v);
      assert.equal(c.in_openapi_enum, false);
      assert.equal(c.in_p01_canonical, true);
      assert.ok(c.tracks.includes("runtime_flow_on_orders.status"));
    }
  });

  it("fleetDriver writes accepted onto orders.status (retained)", () => {
    const c = classifyStatusValue("accepted");
    assert.equal(c.in_openapi_enum, false);
    assert.equal(c.in_p01_canonical, true);
    assert.ok(c.tracks.includes("fleet_writes_orders.status"));
  });

  it("requested checklist coverage", () => {
    const checklist = [
      "pending", "assigned", "accepted", "arrived", "loading",
      "in_transit", "delivered", "exception",
    ];
    const report = checklist.map(classifyStatusValue);
    assert.equal(report.find((r) => r.value === "pending").in_openapi_enum, true);
    assert.equal(report.find((r) => r.value === "accepted").in_p01_canonical, true);
    assert.equal(report.find((r) => r.value === "exception").in_p01_canonical, true);
  });

  it("backfill maps assigned → order_status accepted", () => {
    assert.equal(STATUS_TO_ORDER_STATUS_BACKFILL.assigned, "accepted");
    assert.equal(STATUS_TO_ORDER_STATUS_BACKFILL.in_transit, "picking");
  });

  it("driver accept/reject documented transitions (no DB call)", () => {
    assert.equal(DRIVER_ACTION_TRANSITIONS.accept.to_status, "assigned");
    assert.equal(DRIVER_ACTION_TRANSITIONS.reject.to_status, "pending");
  });
});
