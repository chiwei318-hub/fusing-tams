/**
 * CHARACTERIZATION / unit — orderStatusEngine (P0-1)
 * Mirrors production module logic for node:test without TS build.
 * Keep in sync with artifacts/api-server/src/lib/orderStatusEngine.ts
 */

export const CANONICAL_STATUSES = Object.freeze([
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

export const VALID_TRANSITIONS = Object.freeze({
  pending:    Object.freeze(["assigned", "cancelled"]),
  assigned:   Object.freeze(["accepted", "arrived", "in_transit", "cancelled", "exception"]),
  accepted:   Object.freeze(["arrived", "in_transit", "cancelled", "exception"]),
  arrived:    Object.freeze(["loading", "cancelled", "exception"]),
  loading:    Object.freeze(["in_transit", "exception"]),
  in_transit: Object.freeze(["delivered", "exception"]),
  delivered:  Object.freeze([]),
  exception:  Object.freeze(["assigned", "accepted", "in_transit", "delivered"]),
  cancelled:  Object.freeze([]),
});

export function isCanonicalStatus(value) {
  return typeof value === "string" && CANONICAL_STATUSES.includes(value);
}

export function assertCanonicalStatus(value) {
  if (!isCanonicalStatus(value)) {
    throw new Error(`非法訂單狀態：${String(value)}；允許：${CANONICAL_STATUSES.join(" | ")}`);
  }
  return value;
}

export function canTransition(from, to) {
  if (!isCanonicalStatus(from) || !isCanonicalStatus(to)) return false;
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from, to) {
  assertCanonicalStatus(to);
  if (!isCanonicalStatus(from)) throw new Error(`無效狀態轉換：來源非法 ${from} → ${to}`);
  if (!canTransition(from, to)) throw new Error(`無效狀態轉換：${from} → ${to}`);
}

export function deriveTmsOrderStatus(status) {
  switch (status) {
    case "pending": return "pending";
    case "assigned":
    case "accepted": return "accepted";
    case "arrived":
    case "loading":
    case "in_transit":
    case "exception": return "picking";
    case "delivered": return "delivered";
    case "cancelled": return "cancelled";
    default: throw new Error(`unknown status ${status}`);
  }
}

export function prepareStatusWrite(next) {
  const status = assertCanonicalStatus(next);
  return { status, orderStatus: deriveTmsOrderStatus(status) };
}
