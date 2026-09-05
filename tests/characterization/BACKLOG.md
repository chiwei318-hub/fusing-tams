# Backlog (post P0-1 / P0-Tax)

| # | Item | Status | Blocker | Risk |
|---|------|--------|---------|------|
| 1 | Railway prod tax materiality (RO) | Blocked | Need `DATABASE_URL_RO_PROD` (never overwrite local `DATABASE_URL`) | Info gap |
| 2 | `financials` ×0.15 profit split | Deferred | Business decision — separate from VAT | Medium |
| 2b | `orders.profit_amount` subtracts VAT | **Done** (profit = total − cost; see PROFIT-NO-VAT-REPAIR.md) | — | — |
| 2c | `commission_rate` meaning split (driver vs platform) | Deferred | cashFlow vs receipts vs reports defaults | Medium |
| 2d | `cost_amount=0` when no route rate → profit≈revenue (overstated) | Deferred | Rate-table coverage gap; V1 tracked-cost only | Low |
| 3 | `exception` → TMS `picking` visibility | Observing | Confirm downstream on `order_status` only | Low |
| 4 | enterprise create dual-write `orderStatus` | **Done** | — | Low |

#4 evidence: `enterprise.ts` single + bulk inserts use `prepareStatusWrite("pending")`; test `tests/characterization/status/enterprise-create.test.mjs`.
