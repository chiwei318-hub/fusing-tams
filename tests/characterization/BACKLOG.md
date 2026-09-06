# Backlog (post P0-1 / P0-Tax)

| # | Item | Status | Blocker | Risk |
|---|------|--------|---------|------|
| 1 | Railway prod tax materiality (RO) | Blocked | Need `DATABASE_URL_RO_PROD` (never overwrite local `DATABASE_URL`) | Info gap |
| 2 | `financials` ×0.15 profit split | Deferred | Business decision — separate from VAT | Medium |
| 2b | `orders.profit_amount` subtracts VAT | **Done** (profit = total − cost; see PROFIT-NO-VAT-REPAIR.md) | — | — |
| 2c | `commission_rate` meaning split (driver vs platform) | **#3A Done** (receipts); reports=#3B deferred | See COMMISSION-DRIVER-SEMANTIC-REPAIR.md | Medium |
| 2d | `cost_amount=0` when no route rate → profit≈revenue (overstated) | Deferred | Rate-table coverage gap; V1 tracked-cost only | Low |
| 3 | `exception` → TMS `picking` visibility | Observing | Confirm downstream on `order_status` only | Low |
| 3B | REPORT DRIVER COST RATE (reports COALESCE 70) | **Done** (#3B REPAIR) | See REPORT-70-COST-REPAIR.md | — |
| 3C | financials ×15% deprecate/rename | Deferred | LEGACY_HARDCODED_APPROXIMATION | Medium |
| 3D | `PLATFORM_COMMISSION_RATE` SSoT (prerequisite to restore OCR auto-post) | Deferred | Missing formal platform rate for OCR path | High |
| 3E | Historical OCR AR / driver_earnings written under inverted platform semantic | Deferred | Audit only; no bulk rewrite | Medium |
| 3F | AP ×80% proxy (`order_financials` / arAp) | Deferred | Not real AP; separate from commission | Medium |
| 4 | enterprise create dual-write `orderStatus` | **Done** | — | Low |

#4 evidence: `enterprise.ts` single + bulk inserts use `prepareStatusWrite("pending")`; test `tests/characterization/status/enterprise-create.test.mjs`.
