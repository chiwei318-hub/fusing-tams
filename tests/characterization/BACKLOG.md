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
| 5 | **VAT_AMOUNT_DRIZZLE_SCHEMA_GAP** | **OPEN GO-LIVE GATE P1** | DB VAT OK; API/UI transport gap — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 6 | **RATE_INTAKE_PATH_GAP** | **OPEN GO-LIVE GATE P0** | Cost/GP formula OK; normal create cannot supply rate-match input — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 7 | **COST_ENGINE_NORMAL_PATH_COVERAGE_GAP** | **OPEN GO-LIVE GATE P0** | Normal UI intake→cost coverage unproven; NULL unknown OK — no fake fallbacks — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 8 | **PRICING_CONFIG_MISSING** | **OPEN GO-LIVE GATE P0**; **IMPL NOT AUTHORIZED** | LOCAL: settlement calculate needs `pricing_config`; missing → path blocked — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 9 | **ORDER_SETTLEMENTS_SCHEMA_GAP** | **OPEN GO-LIVE GATE P0**; **IMPL NOT AUTHORIZED** | LOCAL: missing writer cols + **sub-gap** `ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP` (no UNIQUE(order_id); ON CONFLICT would fail) — prod UNKNOWN — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 9a | **ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP** | Sub-gap of #9; **CONFIRMED LOCAL** (not a new Gate #) | PK on id only; no UNIQUE(order_id); preflight duplicates before any UNIQUE migrate | **HIGH BEFORE GO-LIVE** |
| 10 | **ORDERS_DRIVER_NAME_MISSING** | **OPEN GO-LIVE GATE P0** | LOCAL: `calcFinancials` reads `orders.driver_name` but column absent — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 11 | **UI_COST_PROFIT_DISPLAY_GAP** | Open BACKLOG ONLY | API returns cost/profit; Admin list/detail show fee only | Medium |
| U | **ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN** | OPEN umbrella; Audit DONE; **#8/#9 plan content OK; IMPL NOT AUTHORIZED** | Init SSoT=Drizzle-only; fold 002; CREATE pricing_config; #9 also needs UNIQUE(order_id) after dup preflight — see GO-LIVE-GATE.md | **AUDIT / DEPLOYMENT READINESS** |

#4 evidence: `enterprise.ts` single + bulk inserts use `prepareStatusWrite("pending")`; test `tests/characterization/status/enterprise-create.test.mjs`.

---

## GO-LIVE GATE LOCK

Canonical registry: [`GO-LIVE-GATE.md`](./GO-LIVE-GATE.md)

| Gate | ID | Priority | Status | Evidence scope |
|------|-----|----------|--------|----------------|
| #5 | VAT_AMOUNT_DRIZZLE_SCHEMA_GAP | P1 | OPEN — blocker | (prior) |
| #6 | RATE_INTAKE_PATH_GAP | P0 | OPEN — blocker | (prior) |
| #7 | COST_ENGINE_NORMAL_PATH_COVERAGE_GAP | P0 | OPEN — blocker | (prior) |
| #8 | PRICING_CONFIG_MISSING | P0 | OPEN — blocker; **IMPL NOT AUTHORIZED** | **LOCAL only**; prod schema **UNKNOWN** |
| #9 | ORDER_SETTLEMENTS_SCHEMA_GAP | P0 | OPEN — blocker; **IMPL NOT AUTHORIZED** | **LOCAL only**; prod schema **UNKNOWN**; sub-gap UNIQUE(order_id) **CONFIRMED LOCAL** |
| #9a | ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP | (under #9) | CONFIRMED LOCAL — not a new Gate # | Production UNIQUE state **UNKNOWN** |
| #10 | ORDERS_DRIVER_NAME_MISSING | P0 | OPEN — blocker | **LOCAL only**; prod schema **UNKNOWN** |

Evidence aliases under #6: former `ADMIN_UI_NO_ROUTE_PREFIX_FIELD`, `ROUTE_IMPORT_SOURCE_COLUMN_GAP`.

Umbrella (not counted as 7th HIGH gate): `ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN` — Fresh Init Audit **DONE**; INIT_PARITY still **NOT_PROVEN**.

```text
#8 IMPLEMENTATION = NOT CURRENTLY AUTHORIZED
#9 IMPLEMENTATION = NOT CURRENTLY AUTHORIZED
```

Do **not** auto-start TEST #4. Await new explicit implement authorization before schema/migration work.

### Runtime TEST status (locked)

| Test | Result |
|------|--------|
| #1 TAX | PASS |
| #2 COST / GP | PASS |
| #3 AP static logic | **VERIFIED** |
| #3 AP runtime E2E | **BLOCKED — RUNTIME / SCHEMA PATH** (not PASS, not FORMULA FAIL) |

**PRODUCTION_READY = NO** while any of #5–#10 OPEN.  
**TOTAL OPEN HIGH GO-LIVE GATES = 6**  
Runtime formula PASS / static AP verify ≠ production ready. Do not repair #8/#9/#10 mid-suite; do not start TEST #4 without reopen.
