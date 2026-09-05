/**
 * CHARACTERIZATION — order status inventory (P0-1 aligned)
 * Documents where each value is defined / written. Does not change enums.
 */

/** OpenAPI coarse subset (public PATCH/PUT) */
export const OPENAPI_STATUS = Object.freeze([
  "pending",
  "assigned",
  "in_transit",
  "delivered",
  "cancelled",
]);

/** P0-1 canonical write allowlist for orders.status */
export const P01_CANONICAL_STATUS = Object.freeze([
  "pending",
  "assigned",
  "accepted",
  "arrived",
  "loading",
  "in_transit",
  "delivered",
  "exception",
  "cancelled",
]);

/** drizzle / TMS orders.order_status */
export const TMS_ORDER_STATUS = Object.freeze([
  "pending",
  "accepted",
  "picking",
  "delivered",
  "settled",
  "cancelled",
]);

/**
 * Written into orders.status by orderStatusFlow.ts (now in P0-1 canonical)
 */
export const RUNTIME_FLOW_STATUS_ON_ORDERS_STATUS = Object.freeze([
  "arrived",
  "loading",
  "exception",
]);

/**
 * Written into orders.status by fleetDriver.ts — retained in P0-1 canonical
 */
export const FLEET_WRITES_TO_ORDERS_STATUS = Object.freeze(["accepted"]);

/** app.ts backfill maps status → order_status (null-only; no historical rewrite) */
export const STATUS_TO_ORDER_STATUS_BACKFILL = Object.freeze({
  pending: "pending",
  assigned: "accepted",
  in_transit: "picking",
  picking: "picking",
  delivered: "delivered",
  cancelled: "cancelled",
});

export const DRIVER_ACTION_TRANSITIONS = Object.freeze({
  accept: { to_status: "assigned", sets: ["driverAcceptedAt"] },
  reject: { to_status: "pending", clears: ["driverId"] },
});

export function classifyStatusValue(value) {
  const tracks = [];
  if (OPENAPI_STATUS.includes(value)) tracks.push("openapi_status");
  if (P01_CANONICAL_STATUS.includes(value)) tracks.push("p01_canonical");
  if (TMS_ORDER_STATUS.includes(value)) tracks.push("tms_order_status");
  if (RUNTIME_FLOW_STATUS_ON_ORDERS_STATUS.includes(value)) tracks.push("runtime_flow_on_orders.status");
  if (FLEET_WRITES_TO_ORDERS_STATUS.includes(value)) tracks.push("fleet_writes_orders.status");
  return {
    value,
    tracks,
    in_openapi_enum: OPENAPI_STATUS.includes(value),
    in_p01_canonical: P01_CANONICAL_STATUS.includes(value),
  };
}
