# COST ZERO / MISSING RATE SSoT AUDIT — MONEY #2d (READ-ONLY)

Date: 2026-09-06  
Baselines: GP `281e873` · Commission `40f0a62` · Report Cost `ae9ddda` · Characterization was 58/58  
Mode: **READ-ONLY** — production = **0** · DB = **0** · Migration = **NO** · Commit = **NO**

Characterization: `cost-zero-ssot.test.mjs` + `calcOrderFinanceCostLookup` (describe **current** behavior only).

---

## 1. Executive Summary

`orders.cost_amount` is canonical direct transport cost for Gross Profit and Reports (`ae9ddda`), but the writer collapses **missing prefix / missing rate / null rates** into **`0`** via:

```sql
COALESCE(NULLIF(driver_pay_rate, 0), rate_per_trip, 0)
```

plus column **`DEFAULT 0`**. Therefore **`cost_amount = 0` cannot mean a single thing**.

| Verdict | Answer |
|---------|--------|
| Can 0 mean missing rate? | **YES** |
| Can 0 mean verified real zero? | **UNKNOWN** (possible if both rates are 0, but indistinguishable) |
| Can system distinguish today? | **NO** (at best **PARTIAL** with external join to `route_prefix_rates`, still ambiguous when rates are 0) |
| Missing prefix / rate / both NULL → cost | **0** |
| Canonical cost trust | **PARTIAL** |
| False high GP when fee=10000 & unknown→0 | **YES** (`profit_amount=10000`) |
| Report inherits risk (`ae9ddda`) | **YES** — `cost=0` counted **known** → **POTENTIAL_FALSE_KNOWN** |

Root cause: **G (multi)** — writer COALESCE→0 + schema DEFAULT 0 + backfill `NULLIF(cost,0)` + no provenance + report NULL-only completeness.

---

## 2. All cost_amount writers

| ID | FILE | FUNCTION | TRIGGER / ROUTE | EVENT | FORMULA / INPUT | NULL | MISSING RATE | ZERO | OVERWRITE? | MANUAL? | ACTIVE? |
|----|------|----------|-----------------|-------|-----------------|------|--------------|------|------------|---------|---------|
| W1 | `orders.ts` | `calc_order_finance()` | `trg_order_finance` BEFORE INSERT / UPDATE OF `total_fee`,`route_prefix`,`fusingao_fleet_id` | insert/update key fields | `v_rate = COALESCE(NULLIF(driver_pay_rate,0), rate_per_trip, 0)` from `route_prefix_rates` WHERE prefix=NEW.route_prefix; `NEW.cost_amount := v_rate` | SELECT no-row → v_rate stays **0** | **→ 0** | writes **0** | **YES** overwrites cost on those updates | No | **YES** SSoT writer |
| W2 | `orders.ts` | startup sparse UPDATE | boot `ensureOrderFinanceTrigger` | once per process start | `cost = COALESCE(NULLIF(existing,0), lookup, 0)` | NULL treated empty | lookup miss → **0** | existing **0** treated as empty (`NULLIF`) then refill | Overwrites **0** rows if rate found | No | **YES** |
| W3 | `orders.ts` | PATCH `/orders/:id` | HTTP | body.costAmount | sets `updates.costAmount` (can be null) | allows null in update object | n/a | can set 0 | Only until W1 fires again on fee/prefix/fleet | **YES** | **YES** |
| W4 | `orderFinanceColumns.ts` | `calcOrderFinance()` | none (JS helper) | unused at runtime for DB | `cost_amount = rate_per_trip` param | n/a | caller-dependent | 0 if param 0 | n/a | No | **fn unused** as writer |
| W5 | schema / migrate | column default | INSERT without cost | DDL | `DEFAULT 0` / drizzle `real` nullable | insert may omit → **0** | — | default **0** | n/a | No | **YES** |
| W6 | enterprise / create / import | order INSERT | triggers W1 | create | via W1 | via W1 | via W1 | via W1 | via W1 | No direct | **YES** indirect |

No separate settlement/fleet-assignment writer of `orders.cost_amount` found (fleet `rate_override` affects **fleet_payout / PnL joins**, not this column).

---

## 3. Rate lookup chain

```
orders.route_prefix
  → route_prefix_rates.prefix
  → COALESCE(NULLIF(driver_pay_rate, 0), rate_per_trip, 0)
  → orders.cost_amount
```

### A–J answers

| Q | Answer |
|---|--------|
| **A. route_prefix from?** | Order field `orders.route_prefix`; filled by route import, notes regex backfill (`app.ts`), create/API payloads, fleet/shopee flows — **not** from customer table |
| **B. prefix missing?** | Lookup finds no row → `v_rate` remains **0** → `cost_amount=0` |
| **C. prefix ok, rate row missing?** | Same → **0** |
| **D. driver_pay_rate NULL?** | `NULLIF` → fall through to `rate_per_trip` |
| **E. rate_per_trip NULL?** | Final COALESCE → **0** (table often `NOT NULL DEFAULT 0`) |
| **F. both NULL / both 0?** | **cost_amount=0** |
| **G. COALESCE(...,0)?** | **YES** — explicit |
| **H. fleet-specific rate?** | **Not in cost_amount writer.** `fusingao_fleets.rate_override` used elsewhere; trigger only uses `route_prefix_rates` (+ fleet commission for `fleet_payout`) |
| **I. customer-specific rate?** | **NO** for cost_amount |
| **J. manual override?** | PATCH `costAmount` **YES**, but **not durable** across W1 events; no audit “manual vs derived” flag |

---

## 4. Missing prefix

Current result: **`cost_amount = 0`**, and if `total_fee > 0` → **`profit_amount = total_fee`**. Semantic: **UNKNOWN** collapsed to zero.

## 5. Missing rate

Same as §4: **`cost_amount = 0`**.

## 6. Null rates

`driver_pay_rate` null/0 → try `rate_per_trip`; both null/0 → **0**.

## 7. Zero behavior

| Situation | Result |
|-----------|--------|
| Real rate 800 | cost=800 KNOWN |
| `driver_pay_rate=0`, `rate_per_trip=500` | cost=**500** (0 pay treated as missing via NULLIF) |
| Both rates 0 | cost=**0** — **cannot** prove VERIFIED_ZERO vs empty defaults |
| Business allows 0 fee rate? | **UNKNOWN** in repo policy docs |

## 8. Manual zero

PATCH can set `costAmount=0` or `null`. Schema DEFAULT 0 and boot `NULLIF(cost,0)` mean **manual zero is not durable / not labeled**. **MANUAL_ZERO not identifiable** without audit log (none found on this field).

## 9. Writer conflicts

1. W1 always overwrites cost on fee/prefix/fleet update — clobbers manual.  
2. W2 treats cost=0 as “empty” and may refill.  
3. W3 allows null; DEFAULT 0 and W1 fight NULL persistence.  
4. JS `calcOrderFinance` docs say cost=rate_per_trip; SQL prefers driver_pay_rate — **doc/code drift** (JS unused).

## 10. Trigger behavior

See W1. Also sets `vat_amount`, `profit_amount = total_fee - v_rate` (or NULL if no fee), `fleet_payout`.

## 11. Startup backfill behavior

Sparse fill where cost NULL **or 0**; preserves non-zero cost; **does not** invent rates beyond lookup; final COALESCE **0**.

## 12. Cost provenance

**None stored.** No `cost_status`, `cost_source`, rate-id snapshot.

## 13. Zero semantic matrix

| CASE | RATE ROW | DRIVER RATE | TRIP RATE | COST_AMOUNT | TRUE MEANING (evidence) |
|------|----------|-------------|-----------|-------------|-------------------------|
| 1 | exists | 800 | 1000 | **800** | **KNOWN** |
| 2 | exists | 0 | 0 | **0** | **UNKNOWN** if 0 means empty default; cannot claim VERIFIED_ZERO |
| 3 | missing | — | — | **0** | **UNKNOWN** |
| 4 | prefix missing | — | — | **0** | **UNKNOWN** |
| 5 | exists | NULL | NULL | **0** | **UNKNOWN** |
| 6 | any | — | — | PATCH 0 | **UNKNOWN** (no MANUAL flag) |

**Forbidden:** `0 = KNOWN` automatically.

## 14. Coverage logic (`ae9ddda`)

```sql
cost_known  = cost_amount IS NOT NULL
cost_unknown = cost_amount IS NULL
```

Therefore **`cost_amount = 0` → known**. Tag: **POTENTIAL_FALSE_KNOWN**.

## 15. False-known risk

Report months with all costs = 0 (missing rates) show **COMPLETE**, `driver_cost=0`, `gross_profit=SUM(fee)` → fake full margin.

## 16. Profit impact

| Input | Output |
|-------|--------|
| total_fee=10000, cost unknown→0 | **profit_amount=10000** |
| Tag | **FALSE_HIGH_GROSS_PROFIT** |

## 17. Report / export impact

| READER | USES COST? | USES PROFIT? | RISK |
|--------|------------|--------------|------|
| `reports` gross-margin | YES (canonical) | YES | **YES** inherits; 0=known |
| orders API / UI | may expose fields | yes | shows inflated profit |
| `sheetsExport` | no direct cost | `COALESCE(profit_amount, fee−driver_pay, 0)` | **YES** if profit inflated |
| `firebaseSync` | same pattern | same | **YES** |
| cashFlow | no cost_amount | commission % | different lens |
| financials ×15 / AP×80 | no | no | isolated but still MULTIPLE_TRUTH |

## 18. Historical exposure

Local/prod counts of ZERO_WITH_VALID_RATE vs ZERO_WITHOUT_RATE: **UNKNOWN** (no safe fixture stats in this audit; no prod write). Distinguishing would need join queries, still fail on rate=0 rows.

## 19. Current distinguishability

**NO** from `cost_amount` alone.  
**PARTIAL** if join `route_prefix` + `route_prefix_rates` (still ambiguous when rates are 0 / DEFAULT 0).

## 20. Root cause

**G — multiple:**

1. Writer COALESCE → 0 (UNKNOWN→0)  
2. DB DEFAULT 0  
3. Backfill NULLIF(cost,0)  
4. NULLIF(driver_pay_rate,0) erases zero pay as “missing”  
5. No provenance columns  
6. Report completeness = IS NOT NULL only  

## 21. P0 risks

1. FALSE_HIGH_GROSS_PROFIT on missing rates.  
2. Report COMPLETE with cost=0 after `ae9ddda`.  
3. Export/sync of inflated `profit_amount`.

## 22. P1 risks

1. Manual cost not durable / not labeled.  
2. Fleet override not in cost SSoT.  
3. Boot refill treats verified-looking zeros as empty.

---

## 23. Repair options (no implement)

| Option | Idea | Correctness | Compat | DB | Mig | Hist | Writers | Readers | Reversible | Complexity |
|--------|------|-------------|--------|-----|-----|------|---------|---------|------------|------------|
| **A** | Missing → NULL; only verified zero → 0 | High | Medium (DEFAULT 0 fight) | Maybe drop default | Possibly backfill NULL | Recompute needed | W1/W2 | Report already null-aware | Med | Med |
| **B** | Keep amount + add `cost_status`/`cost_source` | High | High | **YES** cols | YES | Backfill status | W1/W2/W3 | Report use status | High | Med–High |
| **C** | Canonical CostResult engine (amount,status,source) | Highest | Med | Optional persist | Optional | Shadow first | Centralize | Migrate readers | High if strangler | Higher |
| **D** | Only report infers from joins | Med | High short-term | NO | NO | None | 0 | Report only | Easy | Low but **leaves GP writer wrong** |

**Do not pick D alone** — GP writer remains false-high.  
**Prefer** smallest path that stops UNKNOWN=0 at **writer** (A and/or B). Avoid greenfield rewrite (C full) unless needed.

## 24. Recommended smallest repair

1. **Writer:** when no rate row (or prefix null), set `cost_amount = NULL` and `profit_amount = NULL` (do not compute fee−0).  
2. When rate row exists and resolved pay is genuinely 0 **with explicit policy**, allow 0 + later status.  
3. Stop treating `NULLIF(cost,0)` as “empty” in backfill without provenance — or only refill NULL.  
4. Report already treats NULL as unknown — gains correctness once writer fixed.  
5. Optional thin `cost_status` (B) if 0 must remain allowed without ambiguity.  
6. Characterization: missing rate → null profit; report PARTIAL; fee=10000 no longer GP=10000.

## 25. Expected production files (next repair)

| File | Role |
|------|------|
| `artifacts/api-server/src/routes/orders.ts` | trigger + backfill |
| Possibly `orderFinanceColumns.ts` | align docs/helper |
| Characterization tests | required |
| Report | **prefer no change** if NULL semantics enough |

Target ≤3 production files; schema **POSSIBLY** (drop DEFAULT 0 / add status).

## 26. Migration requirement

**POSSIBLY** — if NULL must stick (change DEFAULT) or add status columns. Historical zero rows need **classification pass**, not blind rewrite to NULL.

## 27. Test plan (next repair)

A–H cases from this audit as regression; assert missing rate ≠ profit=fee; report cost=0 not auto-COMPLETE without provenance; no touch commission/OCR/financials/AP/tax.

## CHANGE VERIFICATION (this audit)

```
Production modified: 0
DB schema: UNCHANGED
Migration: NO
Commit: NO
```

---

## Final required answers

```
Can cost_amount=0 mean missing rate: YES
Can cost_amount=0 mean verified real zero: UNKNOWN
Can system distinguish these today: NO
Missing prefix current result: cost_amount=0 (profit=total_fee if fee>0)
Missing rate current result: cost_amount=0
Both rates NULL current result: cost_amount=0
Canonical cost trust level: PARTIAL
Does zero cause false high gross profit: YES
Does report inherit this risk: YES
Current cost coverage: report known = IS NOT NULL (0 counts as known) → POTENTIAL_FALSE_KNOWN
Recommended smallest repair: writer NULL on missing rate + null profit; stop COALESCE unknown→0; optional cost_status; report already null-aware
Expected production files: orders.ts (± orderFinanceColumns + tests); report optional
DB schema changes required: POSSIBLY
Migration required: POSSIBLY
Production modified: 0
Commit: NO
```

*End of READ-ONLY #2d audit.*
