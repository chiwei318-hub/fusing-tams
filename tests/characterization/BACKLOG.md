# Backlog (post P0-1 / P0-Tax)

| # | Item | Status | Blocker | Risk |
|---|------|--------|---------|------|
| 1 | Railway prod tax materiality (RO) | Blocked | Need `DATABASE_URL_RO_PROD` (never overwrite local `DATABASE_URL`) | Info gap |
| 2 | `financials` ×0.15 profit split | Deferred | Business decision — separate from VAT | Medium |
| 2b | `orders.profit_amount` subtracts VAT | **Done** (profit = total − cost; see PROFIT-NO-VAT-REPAIR.md) | — | — |
| 2c | `commission_rate` meaning split (driver vs platform) | **#3A Done** (receipts); reports=#3B deferred | See COMMISSION-DRIVER-SEMANTIC-REPAIR.md | Medium |
| 2d | `cost_amount=0` when no route rate → profit≈revenue (overstated) | **#2dA OVERALL CLOSED** (unknown→NULL); historical zeros deferred | See COST-UNKNOWN-WRITER-REPAIR.md; GIT FORENSICS PASS | Medium |
| 3 | `exception` → TMS `picking` visibility | Observing | Confirm downstream on `order_status` only | Low |
| 3B | REPORT DRIVER COST RATE (reports COALESCE 70) | **Done** (#3B REPAIR) | See REPORT-70-COST-REPAIR.md | — |
| 3C | financials ×15% stop-fake profit | **REPAIR Done** (trigger NULL; historical ×15 KEEP) | See FINANCIALS-15-STOP-FAKE-PROFIT-REPAIR.md | Medium |
| 3C-agg | Financials monthly SUM/Excel **AGGREGATE_COMPLETENESS_GAP** | Open | SUM ignores NULL profit rows with no pending/PARTIAL indicator; follow-up report-layer | Medium |
| 3D | `PLATFORM_COMMISSION_RATE` SSoT (prerequisite to restore OCR auto-post) | Deferred | Missing formal platform rate for OCR path | High |
| 3E | Historical OCR AR / driver_earnings written under inverted platform semantic | Deferred | Audit only; no bulk rewrite | Medium |
| 3F | AP ×80% on `order_financials` | **REPAIR Done (reduced scope)** | trigger/calcFinancials: verified settlement → payout else NULL; **no ×80**; no schema change | Medium |
| 3F-ledger | `ar_ap_records` still fee×80 | **AR_AP_RECORDS_SCHEMA_BLOCKED_LEGACY_80** | NOT NULL columns → NULL AP needs **approved schema migration**; dual-table AP divergence until then | High |
| 3F-name | `order_settlements.commission_rate` → future `platform_deduction_rate` rename | Deferred REFACTOR | SEMANTIC_COLLISION **OPEN**; no migration this round | Medium |
| 3F-equip | tailgate 500 / hydraulic 800 AP add-ons | Open | UNVERIFIED_DEFAULT on verified financials path | Low |
| 4 | enterprise create dual-write `orderStatus` | **Done** | — | Low |

#4 evidence: `enterprise.ts` single + bulk inserts use `prepareStatusWrite("pending")`; test `tests/characterization/status/enterprise-create.test.mjs`.
