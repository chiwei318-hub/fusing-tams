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
| 8 | **PRICING_CONFIG_MISSING** | **OPEN GO-LIVE GATE P0**; LOCAL committed `102f59e` | LOCAL structure repaired; Production schema **UNKNOWN** — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 9 | **ORDER_SETTLEMENTS_SCHEMA_GAP** | **OPEN GO-LIVE GATE P0**; LOCAL committed `102f59e` | LOCAL cols+UNIQUE repaired; Production **UNKNOWN**; sub-gap #9a — see GO-LIVE-GATE.md | **HIGH BEFORE GO-LIVE** |
| 9a | **ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP** | Sub-gap of #9; **LOCAL repaired** (not a new Gate #) | UNIQUE(order_id) applied locally via `0003`; Production UNIQUE state **UNKNOWN** | **HIGH BEFORE GO-LIVE** |
| 10 | **ORDERS_DRIVER_NAME_MISSING** | **CLOSED LOCAL** (STALE_READER→join `drivers.name`) | No schema ADD; calcFinancials join only — see GO-LIVE-GATE.md | CLOSED LOCAL; prod **UNKNOWN** |
| 11 | **UI_COST_PROFIT_DISPLAY_GAP** | Open BACKLOG ONLY | API returns cost/profit; Admin list/detail show fee only | Medium |
| 12 | **COMMERCIAL_COST_OVERWRITE_ON_TRIGGER_REFIRE** | **LOCAL REPAIRED (UNCOMMITTED)** — trigger T1–T4 | `calc_order_finance` state-aware UPDATE: NULL→NULL preserve; Shopee owns when prefix set; Shopee→NULL clears stale. See GO-LIVE-GATE.md | COMMIT blocked until Chair review |
| 12a | **#6 FAST_UX_BROWSER_E2E_NOT_RUN** | OPEN evidence gap | Writer unit/API wiring + static source checks only; no HTTP/browser E2E while local server down | Medium |
| 12b | **#6 PATCH costAmount GLOBAL STRIP** | **LOCAL RESTORED (UNCOMMITTED)** — G3 | PATCH `body.costAmount` restored to pre-#6; CREATE still ignores client cost | Medium |
| 12c | **#6 TEST FIXTURE DELETE (governance)** | CLOSED as incident record | `commercial-cost-db-security.test.mjs` `after()` DELETE by fixture id only — unauthorized vs FORBIDDEN DELETE; technically fixture-scoped | Governance |
| U | **ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN** | OPEN umbrella; Audit DONE; #8/#9 LOCAL committed | Init SSoT=Drizzle-only; Production parity still NOT_PROVEN — see GO-LIVE-GATE.md | **AUDIT / DEPLOYMENT READINESS** |

#4 evidence: `enterprise.ts` single + bulk inserts use `prepareStatusWrite("pending")`; test `tests/characterization/status/enterprise-create.test.mjs`.

---

## GO-LIVE GATE LOCK

Canonical registry: [`GO-LIVE-GATE.md`](./GO-LIVE-GATE.md)

| Gate | ID | Priority | Status | Evidence scope |
|------|-----|----------|--------|----------------|
| #5 | VAT_AMOUNT_DRIZZLE_SCHEMA_GAP | P1 | OPEN — blocker | (prior) |
| #6 | RATE_INTAKE_PATH_GAP | P0 | OPEN — blocker | (prior) |
| #7 | COST_ENGINE_NORMAL_PATH_COVERAGE_GAP | P0 | OPEN — blocker | (prior) |
| #8 | PRICING_CONFIG_MISSING | P0 | OPEN — blocker; LOCAL committed `102f59e` | **LOCAL only**; prod schema **UNKNOWN** |
| #9 | ORDER_SETTLEMENTS_SCHEMA_GAP | P0 | OPEN — blocker; LOCAL committed `102f59e` | **LOCAL only**; prod schema **UNKNOWN**; UNIQUE(order_id) LOCAL |
| #9a | ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP | (under #9) | LOCAL repaired — not a new Gate # | Production UNIQUE state **UNKNOWN** |
| #10 | ORDERS_DRIVER_NAME_MISSING | P0 | **CLOSED LOCAL** | **LOCAL only**; prod schema **UNKNOWN** |
| #12 | COMMERCIAL_COST_OVERWRITE_ON_TRIGGER_REFIRE | P0 | **OPEN — #6 WRITER durability** | Blocks durable commercial `cost_amount` SSoT; see below |

Evidence aliases under #6: former `ADMIN_UI_NO_ROUTE_PREFIX_FIELD`, `ROUTE_IMPORT_SOURCE_COLUMN_GAP`.

Umbrella (not counted as 7th HIGH gate): `ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN` — Fresh Init Audit **DONE**; INIT_PARITY still **NOT_PROVEN**.

```text
#8 LOCAL_IMPL = COMMITTED (102f59e) — GO-LIVE OPEN (Production UNKNOWN)
#9 LOCAL_IMPL = COMMITTED (102f59e) — GO-LIVE OPEN (Production UNKNOWN)
#10 = CLOSED LOCAL
```

Do **not** auto-start TEST #4. Await explicit reopen.

### Runtime TEST status (locked)

| Test | Result |
|------|--------|
| #1 TAX | PASS |
| #2 COST / GP | PASS |
| #3 AP static logic | **VERIFIED** |
| #3 AP runtime E2E | **PASS LOCAL** (CASE A AP=8500 / profit=1500; CASE B NULL; no ×80/×15) |

**PRODUCTION_READY = NO** while any of #5–#9 OPEN, or #12 OPEN for durable commercial cost.  
**TOTAL OPEN HIGH GO-LIVE GATES = 6** (#5–#9 + #12)  
**#10 = CLOSED LOCAL**  
Runtime formula PASS ≠ production ready. Do not start TEST #4 without reopen.

### #6 Writer forensic status (2026-09-06)

```text
WRITER CORE IMPLEMENTED = YES
END-TO-END MONEY DURABILITY = LOCAL PASS (#12 T1–T4; UNCOMMITTED)
FAST_UX_BROWSER_E2E = NOT_RUN
PATCH_COST_SCOPE = LOCAL RESTORED (G3; UNCOMMITTED)
GOVERNANCE_DELETE = BENIGN_FIXTURE_ONLY_BUT_UNAUTHORIZED (recorded #12c)
AUTHORIZED SCOPE COMPLETED = CONDITIONAL (E2E still open)
COMMIT = BLOCKED pending Chair
```
