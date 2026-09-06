# FUSING-TAMS GO-LIVE GATE LOCK

**STATUS: LOCKED**  
**LOCKED_AT:** 2026-09-06 (post Runtime TEST #1 TAX / TEST #2 COST-GP)  
**UPDATED_AT:** 2026-09-06 (post #10 CLOSED LOCAL + TEST #3 PASS LOCAL; retroactive auth)  
**ACTION THIS ROUND:** #10 READER_JOIN_FIX committed; docs corrected; Production still UNKNOWN.

## Interpretation rule

Subsequent Runtime TEST #3–#9, even if all PASS, mean only:

> **REPAIR FORMULAS / SEMANTICS VERIFIED**

They do **not** mean:

> **SYSTEM READY FOR PRODUCTION**

While any of GATE #5 / #6 / #7 / #8 / #9 remains OPEN:

> **PRODUCTION_READY = NO**

Especially while #6 / #7 are OPEN: do **not** claim “系統會自動依費率計算所有訂單成本”.  
Correct statement: “成本/毛利公式已驗證；正常 intake → rate matching coverage 尚未完成上線驗收。”

Especially while #8 / #9 remain OPEN (Production schema UNKNOWN): do **not** claim “AP / platform_profit 已端到端驗證可上線”.  
Correct statement: “LOCAL TEST #3 AP runtime PASS；#8/#9 Production schema parity 未證明；Production = UNKNOWN。”

### Evidence boundary (TEST #3)

本輪證明的是：

> **LOCAL TEST ENVIRONMENT** 的 AP / platform_profit runtime path 已 PASS（settlement → recalc）。

**不得**寫成：

- Production DB schema 已與 LOCAL 一致  
- Production settlement / AP 已驗證可上線  
- PRODUCTION_READY = YES  

**PRODUCTION ENVIRONMENT STATE = UNKNOWN**（不得升級為確定壞、也不得降級為確定好）。

---

## GATE #5 — VAT_AMOUNT_DRIZZLE_SCHEMA_GAP

```text
ID = VAT_AMOUNT_DRIZZLE_SCHEMA_GAP
TYPE = MODIFY
SEVERITY = HIGH BEFORE GO-LIVE (P1)
STATUS = OPEN — GO-LIVE BLOCKER
```

**PROVEN (TEST #1):**
- DB `orders.vat_amount` written correctly (exclusive 5%: fee 10000 → 500)
- Drizzle / API transport incomplete → UI cannot reliably show VAT

**GO-LIVE CONDITION:** Prove DB → Drizzle → API → UI `vat_amount` chain consistent.  
**FORBIDDEN:** Re-edit already-PASS VAT tax-base formula to fix transport gap.

---

## GATE #6 — RATE_INTAKE_PATH_GAP

```text
ID = RATE_INTAKE_PATH_GAP
TYPE = MODIFY / INTEGRATION
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER
```

**PROVEN (TEST #2):**
- Cost/GP formulas work when matching input present (cost=800 from `driver_pay_rate`, profit=9200, VAT not deducted from GP)
- Normal admin create (QuickOrder) cannot set `route_prefix` / equivalent rate-match key
- Case A required non-normal prefix attach to hit rates
- Evidence aliases: former `ADMIN_UI_NO_ROUTE_PREFIX_FIELD`, `ROUTE_IMPORT_SOURCE_COLUMN_GAP`

**GO-LIVE CONDITION:** Formal create/import path must naturally produce/pass rate-matching input.  
Must not require operators to know internal `route_prefix` to get cost.

### #6 Writer progress (LOCAL UNCOMMITTED — 2026-09-06)

```text
WRITER CORE IMPLEMENTED = YES (Intake + Fast UX wiring + Engine + Provenance)
CHARACTERIZATION = 150/150 PASS (unit/in-memory + LOCAL DB security fixture)
BROWSER / HTTP E2E THROUGH QuickOrderPanel = NOT_RUN (local API/UI not up)
END-TO-END MONEY DURABILITY = FAIL / OPEN  → see GATE #12
AUTHORIZED SCOPE COMPLETED = NO
COMMIT GATE = BLOCKED
```

Commercial path no longer depends on `route_prefix` for standard trip cost (DECISION C / CM-D).  
#6 GO-LIVE remains OPEN until durability (#12) + normal-path E2E proven.

---

## GATE #7 — COST_ENGINE_NORMAL_PATH_COVERAGE_GAP

```text
ID = COST_ENGINE_NORMAL_PATH_COVERAGE_GAP
TYPE = MODIFY / INTEGRATION
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER
```

**PROVEN / RISK:**
- Normal intake → cost engine coverage not proven end-to-end via UI-only path
- Risk: rates exist but many live orders still `cost_amount=NULL` / `profit_amount=NULL`

**NULL is correct UNKNOWN semantics.**  
**FORBIDDEN** to restore fake numbers for display: cost=0, 70%, 80%, 15%, or any fallback estimate.

**GO-LIVE CONDITION:** Verify via normal UI intake:

```text
UI intake → API payload → canonical route/rate matching → cost_amount → profit_amount
```

At least:
- MATCHED: cost = verified rate; profit = total_fee − cost
- UNMATCHED: cost = NULL; profit = NULL

**#6 Writer note:** Engine + Intake + QuickOrderPanel wiring exist UNCOMMITTED;  
**browser E2E still NOT_RUN** — do not close #7 on static wiring alone.

---

## GATE #12 — COMMERCIAL_COST_OVERWRITE_ON_TRIGGER_REFIRE

```text
ID = COMMERCIAL_COST_OVERWRITE_ON_TRIGGER_REFIRE
TYPE = REPAIR (minimal; trigger or commercial re-apply boundary)
SEVERITY = HIGH — blocks durable #6 money SSoT / COMMIT
STATUS = LOCAL REPAIRED (UNCOMMITTED) — Chair Commit Gate pending
RELATED = #6 / #7
SELECTED_REPAIR = A trigger-side state-aware (T1–T4)
PROVENANCE_AS_LIVE_SSOT = NO
```

**PROVEN chain (pre-repair):**

1. Commercial Engine MATCHED → `UPDATE orders SET cost_amount = C` (only cost/profit columns → trigger does **not** fire).
2. Later any path that updates `total_fee` OR `route_prefix` OR `fusingao_fleet_id` fired:

```text
trg_order_finance
  BEFORE INSERT OR UPDATE OF total_fee, route_prefix, fusingao_fleet_id
  → calc_order_finance()
  → NEW.cost_amount := v_rate   -- ALWAYS; ignored prior commercial C
```

**LOCAL repair (UNCOMMITTED):**
- T1 NULL→NULL: preserve `NEW.cost_amount`; profit = fee − cost
- T2/T3 prefix present: Shopee `route_prefix_rates` owns cost (unchanged formula)
- T4 Shopee→NULL: cost/profit → NULL (no stale Shopee retain)
- Characterization: `commercial-cost-durability.test.mjs` #12-1..#12-6

**GO-LIVE / COMMIT CONDITION:** Chair review of LOCAL evidence; browser E2E still NOT_RUN (#12a).

---

## GATE #8 — PRICING_CONFIG_MISSING

```text
ID = PRICING_CONFIG_MISSING
TYPE = REPAIR / INITIALIZATION GAP
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER (LOCAL structure repaired + committed `102f59e`; Production UNKNOWN)
EVIDENCE SCOPE = LOCAL TEST ENVIRONMENT ONLY
PRODUCTION SCHEMA STATE = UNKNOWN
LOCAL_IMPL = COMMITTED (`102f59e`)
```

**PROVEN (TEST #3, LOCAL):**
- Normal settlement calculate path (`POST /api/franchise-settlements/calculate/:orderId`) reads `pricing_config` (`default_commission_rate`, `insurance_rate`, `other_fee_rate`, `other_fee_fixed`)
- Pre-repair LOCAL: relation `pricing_config` missing → calculate returned 500 at rate-load stage
- Post-repair LOCAL: CREATE via Drizzle `0002`; calculate unblocked when rates supplied / keys present

**IMPACT:** Cannot complete settlement → cannot end-to-end verify AP / platform_profit at runtime.

**GO-LIVE CONDITION:** Prove fresh/target environment obtains required pricing configuration via **formal initialization** (not hand-seeded rows for a test PASS).

**FORBIDDEN:** Manual DB insert of `pricing_config` solely to manufacture TEST PASS; claiming Production DB lacks `pricing_config` without RO prod evidence.

---

## GATE #9 — ORDER_SETTLEMENTS_SCHEMA_GAP

```text
ID = ORDER_SETTLEMENTS_SCHEMA_GAP
TYPE = REPAIR / SCHEMA CONTRACT GAP
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER (LOCAL columns+UNIQUE repaired + committed `102f59e`; Production UNKNOWN)
EVIDENCE SCOPE = LOCAL TEST ENVIRONMENT ONLY
PRODUCTION SCHEMA STATE = UNKNOWN
LOCAL_IMPL = COMMITTED (`102f59e`)
```

**PROVEN (TEST #3, LOCAL):**
- Settlement writer (`franchiseSettlements.ts` calculate INSERT) expected columns that pre-repair LOCAL `order_settlements` did **not** present on `\d order_settlements` inspection.
- Writer INSERT list (code contract):  
  `insurance_rate`, `insurance_fee`, `other_fee_rate`, `other_handling_fee`,  
  `franchisee_id`, `franchisee_payout`, `franchisee_payment_status`
- LOCAL observed columns (among others):  
  `id`, `order_id`, `order_no`, `driver_id`, `total_amount`, `commission_rate`,  
  `commission_amount`, `platform_revenue`, `driver_payout`, `payment_status`,  
  `paid_at`, `payment_ref`, `notes`, `created_at`, `updated_at`  
  — **without** the insurance / franchisee fields above; `order_id` exists but lacks UNIQUE (see sub-gap).
- Even if GATE #8 were cleared, normal INSERT path may still fail on LOCAL.

### Sub-gap (not a separate Go-Live Gate #)

```text
ID = ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP
PARENT GATE = #9 ORDER_SETTLEMENTS_SCHEMA_GAP
STATUS = CONFIRMED LOCAL
TYPE = SCHEMA CONTRACT / UPSERT CONSTRAINT GAP
SEVERITY = HIGH BEFORE GO-LIVE
LOCAL = CONFIRMED
PRODUCTION = UNKNOWN
```

**CONFIRMED EVIDENCE (LOCAL RO `\d` / `pg_indexes`, 2026-09-06):**
- LOCAL `order_settlements` has PK on `id` only.
- **No** `UNIQUE(order_id)` / equivalent unique constraint or unique index.
- Writer uses `ON CONFLICT (order_id)`.
- Therefore: even after adding the confirmed missing columns above, settlement upsert may still fail because `ON CONFLICT (order_id)` has no matching UNIQUE / EXCLUSION constraint.

**FORBIDDEN wording:** Do **not** write “Production 缺 UNIQUE(order_id)”. Production state remains **UNKNOWN**.

### #9 GO-LIVE / closure requirements (minimum, before implement)

1. Missing settlement columns’ canonical ownership confirmed  
2. Formal migration can create required columns  
3. `order_id` uniqueness business invariant confirmed  
4. Formal migration can create UNIQUE constraint/index compatible with `ON CONFLICT (order_id)`  
5. Existing duplicate `order_id` preflight completed  
6. Must **not** create UNIQUE on a DB that already has duplicate `order_id` rows  
7. Migration replay test PASS  
8. Settlement insert/upsert runtime test PASS  

**UNIQUE migration hard stop:** Until this preflight has been run and reviewed:

```sql
SELECT order_id, COUNT(*)
FROM order_settlements
GROUP BY order_id
HAVING COUNT(*) > 1;
```

— **do not** execute a UNIQUE(`order_id`) migration.

**GO-LIVE CONDITION:** Prove consistency of:

```text
canonical schema definition
→ migration / init
→ actual target DB schema
→ settlement writer (columns + ON CONFLICT target)
```

**FORBIDDEN:** Close this gate with runtime `ALTER TABLE` workaround; invent column names not in TEST #3 evidence; assert Production schema is broken without prod RO proof.

---

## GATE #10 — ORDERS_DRIVER_NAME_MISSING

```text
ID = ORDERS_DRIVER_NAME_MISSING
TYPE = REPAIR / SCHEMA CONTRACT GAP → classified STALE_READER
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = CLOSED LOCAL (2026-09-06; retroactive authorization)
EVIDENCE SCOPE = LOCAL TEST ENVIRONMENT ONLY
PRODUCTION SCHEMA STATE = UNKNOWN
CLASSIFICATION = A. STALE_READER / READER_JOIN_FIX
```

**PROVEN (TEST #3, LOCAL):**
- `calcFinancials` / `POST /api/financials/recalculate/:orderId` previously selected `o.driver_name` from `orders`
- LOCAL `orders` schema: `driver_name` **not** present → recalculate returned 500 (`column o.driver_name does not exist`)

**REPAIR (LOCAL, no schema):**
- Canonical FK = `orders.driver_id` → `drivers.id`
- Canonical display name = `drivers.name`
- `calcFinancials` now: `LEFT JOIN drivers d ON d.id = o.driver_id` → `d.name AS driver_name`
- No ADD COLUMN; no migration; AP formula unchanged
- Runtime: CASE A order#5 ap_total=8500 platform_profit=1500; CASE B order#6 ap/platform_profit NULL
- Characterization: 106/106 PASS; TEST #1/#2 unchanged

**CLOSURE:** Retroactively authorized after forensic review (reader-only, clean uncommitted diff, no schema impact). Production still UNKNOWN.

**FORBIDDEN:** Blindly ADD COLUMN; skip ownership decision.

---

## Umbrella risk (not a 7th independent blocker)

```text
ID = ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN
TYPE = AUDIT / DEPLOYMENT READINESS
STATUS = OPEN
ROLE = Umbrella for #6/#7/#8/#9/#10 pattern (and related intake/schema gaps)
NOT COUNTED AS separate HIGH GO-LIVE GATE #
```

**Signal (three Runtime exposures):**
1. UI intake → rate engine contract incomplete (#6 / #7)
2. Settlement → pricing config contract incomplete (#8)
3. Code expected schema → actual LOCAL schema incomplete (#9 / #10)

### AUDIT RESULT — Fresh Environment Initialization (2026-09-06)

**MODE:** READ-ONLY  
**INIT_PARITY:** **NOT_PROVEN**  
**PRODUCTION ENVIRONMENT STATE:** **UNKNOWN**

**Root pattern (LOCAL + repo):** three parallel / incomplete init channels —

| Channel | What it does | Gap |
|---------|--------------|-----|
| Drizzle `runMigrations()` on API start (`lib/db` journal `0000` + `0001_spotty_master_mold`) | Base tables incl. `order_settlements` **without** insurance/franchisee cols | Does **not** create `pricing_config`; does **not** apply franchise settlement cols |
| Orphan SQL `artifacts/api-server/migrations/002_franchise_settlement_columns.sql` | ALTER `order_settlements` + INSERT rate keys | **Not** wired into Drizzle migrate / startup; **assumes** `pricing_config` already exists |
| Runtime `ensure*` / `ALTER … IF NOT EXISTS` (e.g. `orders.ts` → `vat_amount`) | Ad-hoc columns/tables | Partial; never creates `pricing_config` |

**CRITICAL:** repo-wide search found **no `CREATE TABLE pricing_config`** — only INSERTs/SELECTs. Table creation is **MISSING** from every formal init path.

**CRITICAL_BLOCKERS_EXPLAINED_BY_INIT_GAP:**

| Gate | Explained by init gap? | Notes |
|------|------------------------|-------|
| #8 | **YES (same family)** | No CREATE + 002 never auto-run |
| #9 | **YES (same family)** | 002 orphan; Drizzle schema/`settlements.ts` also omit writer cols |
| #10 | **CLOSED LOCAL** (stale reader) | Was stale denorm `o.driver_name`; fixed via join `drivers.name` — **not** ADD COLUMN |
| #5 | **PARTIAL** | LOCAL has `vat_amount` via runtime ALTER; Drizzle `orders.ts` omits it → transport/SSoT drift |
| #6 / #7 | **NO (not init)** | `route_prefix` + `route_prefix_rates` **exist** LOCAL; QuickOrder UI does not supply prefix — **application intake** gap |

**RECOMMENDED NEXT DECISION = (3) BOTH**, sequenced:

1. **Formal initialization / migration contract** (closes path for #8/#9; also documents `pricing_config` CREATE + fold or replace orphan `002`)  
2. **Stale code reader SSoT** for #10 (`driver_name` ownership) — and separately intake work for #6/#7  

**Why defer TEST #4 remains correct:** LOCAL AP (#3) PASS; #8/#9 still OPEN for Production schema parity; init parity NOT_PROVEN; #5/#6/#7 still OPEN → do not start TEST #4 without explicit reopen.

**FORBIDDEN still:** runtime ALTER to close gates; hand-seed for PASS; claim Production schema broken.

### #8/#9 INIT CONTRACT — LOCAL IMPLEMENTED + COMMITTED (`102f59e`)

**HISTORICAL:** Plan was content-approved first; implement later authorized separately. Do **not** re-read stale “IMPLEMENTATION = NOT AUTHORIZED” as current state.

```text
#8 LOCAL_IMPL = COMMITTED (102f59e) — GO-LIVE still OPEN (Production UNKNOWN)
#9 LOCAL_IMPL = COMMITTED (102f59e) — GO-LIVE still OPEN (Production UNKNOWN)
#10 = CLOSED LOCAL (READER_JOIN_FIX; this commit) — Production UNKNOWN
DECISION_SSOT_INIT_ENTRY = DRIZZLE_MIGRATE_ONLY (as applied)
PRODUCTION_STATE = UNKNOWN
STILL_DEFER_TEST_4 = YES — #5/#6/#7/#8/#9 OPEN; PRODUCTION_READY = NO
```

---

## Authorization lock (current)

```text
#8/#9 LOCAL = COMMITTED (102f59e); GO-LIVE OPEN (Production UNKNOWN)
#10 = CLOSED LOCAL (retroactive auth + this commit)
TEST #3 RUNTIME = PASS LOCAL
COMMIT = THIS ROUND (#10 only)
PUSH = NO
DEPLOY = NO
PRODUCTION = UNKNOWN
PRODUCTION_READY = NO
```

---

## Priority

| Priority | Gate | Why |
|----------|------|-----|
| **P0** | #6 RATE_INTAKE_PATH_GAP | Formula OK but engine often unreachable |
| **P0** | #7 COST_ENGINE_NORMAL_PATH_COVERAGE_GAP | Coverage of normal path unproven |
| **P0** | #8 PRICING_CONFIG_MISSING | LOCAL repaired; Production schema parity UNKNOWN |
| **P0** | #9 ORDER_SETTLEMENTS_SCHEMA_GAP | LOCAL repaired; Production schema parity UNKNOWN |
| **P1** | #5 VAT_AMOUNT_DRIZZLE_SCHEMA_GAP | DB OK; visibility for invoice/recon |
| **CLOSED LOCAL** | #10 ORDERS_DRIVER_NAME_MISSING | STALE_READER → join `drivers.name` |

---

## Formula / runtime status

| Test | Static logic | Runtime E2E |
|------|--------------|-------------|
| #1 TAX | PASS | PASS |
| #2 COST / GROSS PROFIT | PASS | PASS |
| #3 AP / PLATFORM PROFIT | **STATIC LOGIC VERIFIED** | **PASS LOCAL** |

### TEST #3 locked wording

- **LOCAL runtime:** **PASS LOCAL** (CASE A trusted settlement → AP=payout=8500, platform_profit=1500; CASE B no settlement → AP/profit NULL; no ×80/×15 revived).
- **Must not** upgrade to: Production PASS / PRODUCTION_READY.
- Static: trusted settlement → `driver_payout` → AP; no trusted settlement → NULL; legacy ×80 removed in repair scope.

**REPAIR_FORMULAS_VERIFIED_SO_FAR** = YES for TAX + COST/GP + AP (LOCAL runtime)  
**ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN** = YES  
**PRODUCTION ENVIRONMENT STATE** = UNKNOWN  
**TOTAL OPEN HIGH GO-LIVE GATES** = 5 (#5–#9)  
**#10** = CLOSED LOCAL  
**PRODUCTION_READY** = NO

---

## Next (locked)

- Fresh Environment Initialization Audit: **DONE**.  
- #8/#9 LOCAL minimal repair: **COMMITTED** (`102f59e`); GO-LIVE still OPEN until Production schema evidence.  
- #10: **CLOSED LOCAL** (this commit; retroactive authorization).  
- #9 sub-gap `ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP`: **CONFIRMED LOCAL** (repaired locally); Production **UNKNOWN**.  
- Do **not** start Runtime TEST #4 without explicit reopen.  
- Preferred next (when authorized): #6/#7 intake path; #5 VAT transport; Production RO evidence for #8/#9.