/**
 * orderStatusEngine — P0-1 Order Status SSoT
 *
 * Canonical write column: orders.status
 * Derived compat column:  orders.order_status (TMS lifecycle; never deleted)
 *
 * Do not treat this as OpenAPI-only five values — runtime + fleet + driver UI
 * depend on accepted / arrived / loading / exception.
 */

export const CANONICAL_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "arrived",
  "loading",
  "in_transit",
  "delivered",
  "exception",
  "cancelled",
] as const;

export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

/** OpenAPI / public PATCH coarse subset */
export const OPENAPI_COARSE_STATUSES = [
  "pending",
  "assigned",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export type OpenApiCoarseStatus = (typeof OPENAPI_COARSE_STATUSES)[number];

export const TMS_ORDER_STATUSES = [
  "pending",
  "accepted",
  "picking",
  "delivered",
  "settled",
  "cancelled",
] as const;

export type TmsOrderStatus = (typeof TMS_ORDER_STATUSES)[number];

export const VALID_TRANSITIONS: Readonly<Record<CanonicalStatus, readonly CanonicalStatus[]>> = {
  pending:    ["assigned", "cancelled"],
  assigned:   ["accepted", "arrived", "in_transit", "cancelled", "exception"],
  accepted:   ["arrived", "in_transit", "cancelled", "exception"],
  arrived:    ["loading", "cancelled", "exception"],
  loading:    ["in_transit", "exception"],
  in_transit: ["delivered", "exception"],
  delivered:  [],
  exception:  ["assigned", "accepted", "in_transit", "delivered"],
  cancelled:  [],
};

export function isCanonicalStatus(value: unknown): value is CanonicalStatus {
  return typeof value === "string" && (CANONICAL_STATUSES as readonly string[]).includes(value);
}

export function assertCanonicalStatus(value: unknown): CanonicalStatus {
  if (!isCanonicalStatus(value)) {
    throw new Error(
      `非法訂單狀態：${String(value)}；允許：${CANONICAL_STATUSES.join(" | ")}`,
    );
  }
  return value;
}

export function canTransition(from: string, to: CanonicalStatus): boolean {
  if (!isCanonicalStatus(from)) return false;
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: string, to: CanonicalStatus): void {
  assertCanonicalStatus(to);
  if (!isCanonicalStatus(from)) {
    throw new Error(`無效狀態轉換：來源非法 ${from} → ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new Error(`無效狀態轉換：${from} → ${to}`);
  }
}

/** Derive TMS order_status from canonical orders.status (compat; not SSoT). */
export function deriveTmsOrderStatus(status: CanonicalStatus): TmsOrderStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "assigned":
    case "accepted":
      return "accepted";
    case "arrived":
    case "loading":
    case "in_transit":
    case "exception":
      return "picking";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type StatusWriteFields = {
  status: CanonicalStatus;
  orderStatus: TmsOrderStatus;
};

/** Prepare dual-write payload for drizzle / SQL. */
export function prepareStatusWrite(next: unknown): StatusWriteFields {
  const status = assertCanonicalStatus(next);
  return {
    status,
    orderStatus: deriveTmsOrderStatus(status),
  };
}

/** SQL column names (snake_case) for raw pool queries. */
export function prepareStatusWriteSql(next: unknown): {
  status: CanonicalStatus;
  order_status: TmsOrderStatus;
} {
  const w = prepareStatusWrite(next);
  return { status: w.status, order_status: w.orderStatus };
}
