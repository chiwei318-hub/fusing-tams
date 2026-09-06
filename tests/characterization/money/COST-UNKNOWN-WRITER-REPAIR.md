# COST UNKNOWN WRITER REPAIR — MONEY #2dA

Date: 2026-09-06  
Baselines: `281e873` / `40f0a62` / `ae9ddda`  
Audit: `COST-ZERO-SSOT-AUDIT.md`  
Commit: **NO** (await review)

---

## A. Pre-change schema evidence

| Q | Answer |
|---|--------|
| **A. cost_amount nullable?** | **YES** — drizzle `real("cost_amount")` no `.notNull()` |
| **B. profit_amount nullable?** | **YES** — same |
| **C. DEFAULT 0?** | **YES** on `ADD COLUMN IF NOT EXISTS ... DEFAULT 0` (ensureOrderColumns / ensureOrderFinanceColumns) |
| **D. DEFAULT vs explicit NULL?** | DEFAULT only when column **omitted** on INSERT; BEFORE INSERT trigger may set **explicit NULL** (overrides default after apply) |
| **E. Trigger can write NULL?** | **YES** |
| **F. Startup backfill NULL→0?** | **Was YES** (old COALESCE … 0); **fixed** — no longer |
| **G. Create depends on default 0?** | Indirect — trigger always runs on INSERT and now sets NULL when unknown |

**SCHEMA_BLOCKER:** **NO** — no migration.

## B. Active writer inventory

| FILE | WRITER | OLD UNKNOWN | NEW | MUST MODIFY? |
|------|--------|-------------|-----|--------------|
| `orders.ts` | `calc_order_finance` trigger | cost=0, profit=fee | cost=NULL, profit=NULL | **YES** |
| `orders.ts` | startup sparse UPDATE | NULLIF(0)+COALESCE→0 | fill NULL only if rate>0; never write 0 for miss; no hist zero rewrite | **YES** |
| `orders.ts` | PATCH costAmount | manual | unchanged ownership | NO (backlog) |
| `orderFinanceColumns.calcOrderFinance` | unused runtime | n/a | skip | NO |
| `sheetsExport.ts` | COALESCE invent profit | fee−driver_pay | `profit_amount` only | **YES** (downstream) |
| `firebaseSync.ts` | same | same | `profit_amount` only | **YES** |

**Production files: 3** (`orders.ts`, `sheetsExport.ts`, `firebaseSync.ts`).

## C. Rate priority

1. `driver_pay_rate > 0`  
2. else `rate_per_trip > 0`  
3. else **NULL** (UNKNOWN)

No 15/70/80%. No `COALESCE(...,0)` as unknown fallback.

## D. Old missing-rate behavior

`cost=0`, `profit=total_fee` → FALSE_HIGH_GROSS_PROFIT.

## E. New missing-rate behavior

`cost_amount=NULL`, `profit_amount=NULL` (vat still from fee when fee>0).

## F. Zero-rate policy

`rate <= 0` / NULL with no positive fallback → **UNKNOWN**, not VERIFIED_ZERO.  
**ZERO_RATE_BUSINESS_POLICY_CONFLICT:** not raised (no business evidence of legal free rate).

## G. Trigger change

`v_rate` init NULL; lookup without trailing `,0`; unknown → NULL cost/profit; fleet_payout NULL when rate unknown + fleet set.

## H. Startup/backfill change

- Do **not** select `cost_amount=0` for refill  
- Do **not** `NULLIF(cost,0)`  
- Do **not** COALESCE miss → 0  
- Do **not** invent profit from historical cost=0  

## I. Manual override impact

PATCH still writable; fee/prefix still re-triggers.  
**MANUAL_COST_OWNERSHIP_BACKLOG** — no provenance; not expanded this round.

## J. Profit behavior

| Condition | profit |
|-----------|--------|
| fee known + cost known | fee − cost (negative allowed) |
| cost NULL | NULL |
| fee NULL / ≤0 | NULL |

## K. Report compatibility

`ae9ddda` already null-aware → **YES**. NULL → PARTIAL/UNKNOWN. No report code change.

## L. Export compatibility

Removed `COALESCE(profit_amount, total_fee - driver_pay, 0)`.

### SHEETS NULL DISPLAY SEMANTIC

| | Before | After |
|--|--------|-------|
| NULL profit cell | `"0"` via global `fmt` | **blank `""`** via `fmtMoneyNullable` |
| Numeric profit `0` | `"0"` | `"0"` |
| Negative profit | preserved | preserved |

- `fmt` remains for `client_bill` / `driver_payout` (SQL already `COALESCE(...,0)`).
- **Did not** change global `fmt` null→blank (would blur COALESCE columns).
- Preview summary skips null profits (`profitUnknownCount` added).

**Can Sheets distinguish UNKNOWN vs ZERO:** **YES** (blank vs `"0"`).

**firebaseSync (spot-check, out of this patch):** still `Number(order.profit)` which turns null→0 in Firestore payload — remaining downstream risk; not modified this round.

### FIREBASE NULL SEMANTIC

| | Before | After |
|--|--------|-------|
| Backend | **Firestore** (`orders` + `accounting`) | same |
| Field | `profit` | same |
| NULL DB profit | `Number(null)` → **0** | **`null`** via `nullableMoney` |
| Numeric 0 | 0 | **0** |
| Negative | preserved | preserved |

- Firestore allows null field values (**YES**).
- In-repo readers of Firestore `orders.profit` / `accounting.profit` for MONEY calc: **none found**.
- **FIREBASE_DOWNSTREAM_MONEY_BLOCKER:** **NO**
- External/out-of-repo consumers: **UNKNOWN** (not in this repo)

**Can Firebase distinguish UNKNOWN vs ZERO:** **YES** (`null` vs `0`)


## M. Historical data impact

**NO HISTORICAL REWRITE.** Existing cost=0 / profit=fee rows remain until separately audited.  
Backlog: **HISTORICAL ZERO COST EXPOSURE**.

## N. False-high-profit before/after

| | BEFORE | AFTER (new writes) |
|--|--------|---------------------|
| fee=10000 missing rate | cost=0 profit=**10000** | cost=**NULL** profit=**NULL** |

## O. Tests

`cost-unknown-writer.test.mjs`, updated `cost-zero-ssot`, `order-finance`, `formulas`, `commission-driver-semantic`. Full suite run below.

## P. Typecheck

Not blocking; pre-existing TS7030 elsewhere. Mark **PRE_EXISTING_TYPECHECK_FAILURE** if run shows same baseline.

## Q. Production files changed

1. `artifacts/api-server/src/routes/orders.ts`  
2. `artifacts/api-server/src/routes/sheetsExport.ts`  
3. `artifacts/api-server/src/routes/firebaseSync.ts`  

## R. Remaining risks

1. Historical zeros still report COMPLETE if unchanged  
2. INSERT omitting columns still has DEFAULT 0 until trigger sets NULL — OK if trigger always runs  
3. Manual PATCH ownership  
4. sheets `fmt(null)→"0"` display — **fixed** with `fmtMoneyNullable` for profit cells  
5. Verified free-rate still impossible by design  
6. firebaseSync `Number(null)→0` — **fixed** with `nullableMoney`  

## S. Next smallest repair

**HISTORICAL ZERO COST EXPOSURE** (RO classify then optional remediation) and/or **MANUAL_COST_OWNERSHIP**; then financials ×15 (#3C).

---

## Final checklist

```
cost_amount nullable: YES
profit_amount nullable: YES
Schema migration required: NO

Missing prefix after repair: cost=NULL profit=NULL
Missing rate after repair: cost=NULL profit=NULL
Both rates NULL/0 after repair: cost=NULL profit=NULL
Rate=0 treated as verified zero: NO

Unknown cost can still become zero through active writer: NO
Unknown cost can still create full-revenue profit: NO
  (new writes; historical rows unchanged)

Reports support new NULL: YES
Historical rows rewritten: NO

Production files modified:
  orders.ts, sheetsExport.ts, firebaseSync.ts

Commit: NO
```
