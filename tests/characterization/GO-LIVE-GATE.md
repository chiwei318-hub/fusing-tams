# FUSING-TAMS GO-LIVE GATE LOCK

**STATUS: LOCKED**  
**LOCKED_AT:** 2026-09-06 (post Runtime TEST #1 TAX / TEST #2 COST-GP)  
**UPDATED_AT:** 2026-09-06 (post Runtime TEST #3 AP — GATE #8/#9/#10 registry)  
**ACTION THIS ROUND:** Documentation / evidence lock only — no code / schema / DB / formula repair.

## Interpretation rule

Subsequent Runtime TEST #3–#9, even if all PASS, mean only:

> **REPAIR FORMULAS / SEMANTICS VERIFIED**

They do **not** mean:

> **SYSTEM READY FOR PRODUCTION**

While any of GATE #5 / #6 / #7 / #8 / #9 / #10 remains OPEN:

> **PRODUCTION_READY = NO**

Especially while #6 / #7 are OPEN: do **not** claim “系統會自動依費率計算所有訂單成本”.  
Correct statement: “成本/毛利公式已驗證；正常 intake → rate matching coverage 尚未完成上線驗收。”

Especially while #8 / #9 / #10 are OPEN: do **not** claim “AP / platform_profit 已端到端驗證可上線”.  
Correct statement: “AP 靜態邏輯已審；LOCAL settlement runtime path 不完整，端到端 runtime 尚未 PASS。”

### Evidence boundary (TEST #3)

本輪證明的是：

> **LOCAL TEST ENVIRONMENT** 的 settlement runtime contract / path 不完整。

**不得**寫成：

- Production DB 已缺欄位  
- Production settlement 已壞  
- Production data 已受污染  

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

---

## GATE #8 — PRICING_CONFIG_MISSING

```text
ID = PRICING_CONFIG_MISSING
TYPE = REPAIR / INITIALIZATION GAP
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER (LOCAL structure repaired 2026-09-06; Production UNKNOWN)
EVIDENCE SCOPE = LOCAL TEST ENVIRONMENT ONLY
PRODUCTION SCHEMA STATE = UNKNOWN
LOCAL_IMPL = APPLIED (await human review / commit)
```

**PROVEN (TEST #3, LOCAL):**
- Normal settlement calculate path (`POST /api/franchise-settlements/calculate/:orderId`) reads `pricing_config` (`default_commission_rate`, `insurance_rate`, `other_fee_rate`, `other_fee_fixed`)
- LOCAL runtime: relation `pricing_config` missing → calculate returns 500 at rate-load stage
- Therefore formal settlement business flow cannot complete on LOCAL → AP runtime E2E blocked

**IMPACT:** Cannot complete settlement → cannot end-to-end verify AP / platform_profit at runtime.

**GO-LIVE CONDITION:** Prove fresh/target environment obtains required pricing configuration via **formal initialization** (not hand-seeded rows for a test PASS).

**FORBIDDEN:** Manual DB insert of `pricing_config` solely to manufacture TEST PASS; claiming Production DB lacks `pricing_config` without RO prod evidence.

---

## GATE #9 — ORDER_SETTLEMENTS_SCHEMA_GAP

```text
ID = ORDER_SETTLEMENTS_SCHEMA_GAP
TYPE = REPAIR / SCHEMA CONTRACT GAP
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER (LOCAL columns+UNIQUE repaired 2026-09-06; Production UNKNOWN)
EVIDENCE SCOPE = LOCAL TEST ENVIRONMENT ONLY
PRODUCTION SCHEMA STATE = UNKNOWN
LOCAL_IMPL = APPLIED (await human review / commit)
```

**PROVEN (TEST #3, LOCAL):**
- Settlement writer (`franchiseSettlements.ts` calculate INSERT) expects columns that LOCAL `order_settlements` did **not** present on `\d order_settlements` inspection.
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
TYPE = REPAIR / SCHEMA CONTRACT GAP
SEVERITY = HIGH BEFORE GO-LIVE (P0)
STATUS = OPEN — GO-LIVE BLOCKER
EVIDENCE SCOPE = LOCAL TEST ENVIRONMENT ONLY
PRODUCTION SCHEMA STATE = UNKNOWN
```

**PROVEN (TEST #3, LOCAL):**
- `calcFinancials` / `POST /api/financials/recalculate/:orderId` selects `o.driver_name` from `orders`
- LOCAL `orders` schema: `driver_name` **not** present → recalculate returns 500 (`column o.driver_name does not exist`)
- Orders #5 / #6: fee quoted OK; financials row not written via recalc path

**GO-LIVE CONDITION:** First confirm SSoT ownership:

- Is `driver_name` a canonical `orders` column?  
- Or is the code reader using a wrong / stale field (e.g. should join `drivers.name`)?

**FORBIDDEN:** Blindly ADD COLUMN to close the gate; skip ownership decision (REPAIR / MODIFY / DELETE / migration).

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
| #10 | **PARTIAL / different** | `orders.driver_name` absent from Drizzle **and** LOCAL; `calcFinancials` stale denorm read — prefer join `drivers.name`, **not** blind ADD COLUMN |
| #5 | **PARTIAL** | LOCAL has `vat_amount` via runtime ALTER; Drizzle `orders.ts` omits it → transport/SSoT drift |
| #6 / #7 | **NO (not init)** | `route_prefix` + `route_prefix_rates` **exist** LOCAL; QuickOrder UI does not supply prefix — **application intake** gap |

**RECOMMENDED NEXT DECISION = (3) BOTH**, sequenced:

1. **Formal initialization / migration contract** (closes path for #8/#9; also documents `pricing_config` CREATE + fold or replace orphan `002`)  
2. **Stale code reader SSoT** for #10 (`driver_name` ownership) — and separately intake work for #6/#7  

**Why defer TEST #4 remains correct:** AP path still blocked by #8/#9/#10; init parity NOT_PROVEN → later money tests likely hit more missing contracts before formulas.

**FORBIDDEN still:** runtime ALTER to close gates; hand-seed for PASS; claim Production schema broken.

### #8/#9 INIT CONTRACT REPAIR PLAN — CONTENT APPROVED; IMPLEMENTATION NOT AUTHORIZED (2026-09-06)

**MODE:** Plan content/direction approved. **No implement.** No migration created/run. No DDL. No code change.

```text
#8 IMPLEMENTATION = NOT CURRENTLY AUTHORIZED
#9 IMPLEMENTATION = NOT CURRENTLY AUTHORIZED
Await new explicit implement authorization.

DECISION_SSOT_INIT_ENTRY = DRIZZLE_MIGRATE_ONLY
  (API start already calls runMigrations(); reject long-term hybrid)
  ensure* may remain for legacy ad-hoc tables, but MUST NOT be the
  create-path for pricing_config or order_settlements franchise cols.
  Orphan artifacts/api-server/migrations/*.sql MUST NOT stay a second SSoT.

PRICING_CONFIG_PLAN (#8):
  - CREATE TABLE pricing_config in next formal Drizzle migration
    (repo today: zero CREATE — only INSERT/SELECT)
  - Minimal columns (from existing writers/readers): id, key, value, label, updated_at
    + UNIQUE(key) for ON CONFLICT (key)
  - Seed keys (idempotent ON CONFLICT DO NOTHING):
      default_commission_rate  (002 omitted this; getRates defaults 15 but key should exist)
      insurance_rate
      other_fee_rate
      other_fee_fixed
  - Add Drizzle schema module for pricing_config (today MISSING)
  - Other keys (vehicle_rate_cards, smtp_*, etc.): OUT OF SCOPE create;
    table existence unblocks them; do not expand seed set in #8/#9 repair

ORDER_SETTLEMENTS_PLAN (#9):
  REQUIRED for franchiseSettlements calculate/autoCalculate INSERT:
    insurance_rate, insurance_fee, other_fee_rate, other_handling_fee,
    franchisee_id, franchisee_payout, franchisee_payment_status
  OPTIONAL for calculate writer, but REQUIRED for adjacent settlement features
  (include in same migration for 002 parity — do not leave half-applied):
    franchisee_paid_at, franchisee_payment_ref, atoms_pushed_at
  + indexes from 002 (franchisee_id, franchisee_payment_status)
  LATENT → CONFIRMED LOCAL (sub-gap ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP):
    writer uses ON CONFLICT (order_id); LOCAL has no UNIQUE(order_id)
    — PRODUCTION still UNKNOWN; UNIQUE migration forbidden until duplicate preflight

ORPHAN_002_DISPOSITION = FOLD_INTO_DRIZZLE_THEN_SUPERSEDE
  - Translate 002 into Drizzle schema + generated migration (after CREATE pricing_config)
  - Mark 002 file SUPERSEDED (header comment only in implement phase);
    do NOT keep dual auto-apply
  - ROLLBACK idea: additive columns → reverse = documented DROP COLUMN script
    ONLY on empty/dev DBs; on data-bearing DBs = feature-off + no drop
    (no silent destructive rollback)

DRIZZLE_SCHEMA_SYNC = YES_REQUIRED
  - Update lib/db/src/schema/settlements.ts to match writer
  - Add pricing_config schema; generate migrate; journal single path

FRESH_ENV_ACCEPTANCE_SCRIPT = NOT EXECUTED (design only):
  1. Empty DB + DATABASE_URL
  2. Start API with SKIP_DB_MIGRATE unset → runMigrations only
  3. Assert to_regclass('pricing_config') not null + 4 seed keys present
  4. Assert order_settlements has REQUIRED (+ OPTIONAL) cols above
  5. POST calculate on a fixture order → 200 (not 500 on missing relation/col)
  6. Do NOT use runtime ALTER; do NOT hand INSERT pricing_config outside migrate
  Gate close condition: steps 1–5 reproducible on fresh env (still LOCAL≠Production)

OUT_OF_SCOPE: #5 #6 #7 #10 (and UI_COST #11)
RECOMMENDED_IMPLEMENTATION_ORDER (after explicit approve):
  1) pricing_config schema+CREATE+seed
  2) settlements cols + unique(order_id) if needed + schema sync
  3) supersede 002
  4) fresh-env acceptance (dev) → then re-open TEST #3 runtime only
STILL_DEFER_TEST_4 = YES — #8/#9/#10 still OPEN; AP path not E2E
PRODUCTION_STATE = UNKNOWN
```

**Await human approve before any implement phase.**

---

## Authorization lock (current)

```text
#8/#9 LOCAL minimal repair = APPLIED (uncommitted; human review)
COMMIT = NO
PUSH = NO
DEPLOY = NO
PRODUCTION = UNKNOWN
TEST #3 RUNTIME = BLOCKED BY GATE #10 (orders.driver_name)
```

---

## Priority

| Priority | Gate | Why |
|----------|------|-----|
| **P0** | #6 RATE_INTAKE_PATH_GAP | Formula OK but engine often unreachable |
| **P0** | #7 COST_ENGINE_NORMAL_PATH_COVERAGE_GAP | Coverage of normal path unproven |
| **P0** | #8 PRICING_CONFIG_MISSING | LOCAL settlement calculate blocked at config load |
| **P0** | #9 ORDER_SETTLEMENTS_SCHEMA_GAP | LOCAL settlements schema ≠ writer contract |
| **P0** | #10 ORDERS_DRIVER_NAME_MISSING | LOCAL recalc blocked on `orders.driver_name` |
| **P1** | #5 VAT_AMOUNT_DRIZZLE_SCHEMA_GAP | DB OK; visibility for invoice/recon |

---

## Formula / runtime status

| Test | Static logic | Runtime E2E |
|------|--------------|-------------|
| #1 TAX | PASS | PASS |
| #2 COST / GROSS PROFIT | PASS | PASS |
| #3 AP / PLATFORM PROFIT | **STATIC LOGIC VERIFIED** | **BLOCKED — RUNTIME / INITIALIZATION / SCHEMA CONTRACT** |

### TEST #3 locked wording

- **Must not** record as: PASS  
- **Must not** record as: FORMULA FAIL  
- Correct: AP repair logic (static) shows trusted settlement → `driver_payout` → AP; no trusted settlement → NULL; legacy ×80 removed in repair scope. LOCAL runtime could not complete settlement → **AP Runtime = NOT VERIFIED**.

**REPAIR_FORMULAS_VERIFIED_SO_FAR** = YES for TAX + COST/GP; AP = static only  
**ENVIRONMENT_INITIALIZATION_PARITY_NOT_PROVEN** = YES  
**PRODUCTION ENVIRONMENT STATE** = UNKNOWN  
**TOTAL OPEN HIGH GO-LIVE GATES** = 6 (#5–#10)  
**PRODUCTION_READY** = NO

---

## Next (locked)

- Fresh Environment Initialization Audit: **DONE**.  
- #8/#9 plan: **content approved**; **IMPLEMENTATION = NOT CURRENTLY AUTHORIZED** (both).  
- #9 sub-gap `ORDER_SETTLEMENTS_ORDER_ID_UNIQUE_GAP`: **CONFIRMED LOCAL**; Production **UNKNOWN**.  
- Do **not** start Runtime TEST #4 while #8/#9/#10 OPEN without explicit reopen.  
- Do **not** mid-suite repair #8/#9/#10; do **not** run UNIQUE migration without duplicate preflight.  
- Preferred next (when authorized): unify init contract for #8/#9 including UNIQUE(order_id); SSoT for #10; #6/#7 intake separately.