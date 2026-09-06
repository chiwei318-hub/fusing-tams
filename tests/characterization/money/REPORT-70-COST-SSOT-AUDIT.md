# REPORT 70% COST SSoT AUDIT — MONEY #3B (READ-ONLY)

Date: 2026-09-06  
Baselines: Gross Profit `281e873` · Commission Semantic `40f0a62` · Characterization 50/50 PASS  
Mode: **READ-ONLY** — production change = **0** · commit = **NO**

### CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| Production business logic modified | **0** |
| DB schema changes | **0** |
| Migration | **NO** |
| Historical rewrite | **NO** |
| Gross Profit / commission / driver settlement / pricing / financials×15 / AP×80 | **UNTOUCHED** |
| Commit | **NO** |

---

## 1. Executive Summary

`GET /api/reports/gross-margin` 以：

```sql
driver_cost = SUM(total_fee × COALESCE(d.commission_rate, 70) / 100)
gross_profit = gross_revenue − driver_cost − franchise_cost
```

把 `drivers.commission_rate`（已鎖定為 **DRIVER_SETTLEMENT_RATE / DRIVER_SHARE_RATE**）當成「司機成本占營收比例」，null 時 **SILENT_DEFAULT 70%**。

| Verdict | Detail |
|---------|--------|
| 70% business meaning | **UNVERIFIED** — code treats as “driver cost share of total_fee”; **no** contract/policy/doc SSoT |
| Rate source | **HARDCODED** silent fallback in SQL (+ may coincide with franchisee schema default 70 copied onto drivers) |
| Base | **orders.total_fee** |
| Active | **YES** (FinanceReportsTab 毛利報表) |
| Uses canonical `orders.cost_amount` | **NO** |
| Creates fake/estimated cost | **YES** (when rate null → 70%; when rate set → still %×fee, not trip cost) |
| Writes DB | **NO** (read-time only) |
| Historical DB contamination from 70% | **NO** (query/API/UI only; exports of this endpoint not found) |
| **MULTIPLE_FINANCIAL_TRUTH** | **YES** — parallel 70% report cost / AP×80 / financials×15 / canonical fee−cost |

---

## 2. Step 1 A–H

### A. Where is 70%?

| Item | Evidence |
|------|----------|
| File | `artifacts/api-server/src/routes/reports.ts` |
| Function | `GET /reports/gross-margin` (~L121–175) |
| Query fragment | `COALESCE(d.commission_rate, 70)` inside `SUM(o.total_fee::numeric * … / 100) AS driver_cost` |

**Only production money path** with literal `COALESCE(..., 70)` on **drivers.commission_rate** for cost.  
Related but **different**: `franchisees.commission_rate` schema default `"70"` / `fleetOwner` `?? 70` (franchisee/driver **settlement ratio**, not this report’s silent cost fallback).

### B. Rate base

**orders.total_fee** (per delivered order, summed monthly).  
Not net_revenue, invoice, cost_amount, or rate_per_trip.

### C. Output field name

| SQL / API field | UI label |
|-----------------|----------|
| `driver_cost` | 「司機成本」 |
| feeds `gross_profit` | 「毛利」 |
| feeds `gross_margin_pct` | 「毛利率」 |

Not named `estimated_cost` / `payable` / `UNKNOWN`.

### D. Who reads it?

| Layer | Consumer |
|-------|----------|
| API | `GET /api/reports/gross-margin?months=N` |
| UI | `FinanceReportsTab.tsx` → `GrossMarginPanel` (chart + table) |
| Export | **No** dedicated Excel/Sheets consumer of this endpoint found |
| Cache | React Query `staleTime: 5min` client-only — **not** DB materialize |

### E. Prefer real `cost_amount`?

**NO.** Query never references `orders.cost_amount` or `orders.profit_amount`.

### F. When does 70% apply?

`COALESCE(d.commission_rate, 70)` → fallback when:

1. `drivers.commission_rate` **IS NULL**, or  
2. Order has **no driver** (`LEFT JOIN drivers` → `d.commission_rate` NULL)

If rate is **non-null** (e.g. 15 or 70 stored), uses **that** %, not the literal 70 — but still **% × total_fee**, not trip cost.

### G. Formal source for 70%?

| Candidate | Found? |
|-----------|--------|
| Contract | **NO** |
| Customer config | **NO** |
| Driver config as “cost %” | Field exists as **settlement share**, not cost policy |
| Fleet config | Franchisee default 70 = **share**, different semantics |
| System config key | **NO** for this report |
| Business policy doc in repo | **NO** |
| Migration justifying 70 cost | **NO** |

Tag: **UNVERIFIED_DEFAULT**

### H. Relation to `drivers.commission_rate`?

**YES — direct. Semantic misplacement.**

| Locked (#3A `40f0a62`) | Report gross-margin use |
|------------------------|-------------------------|
| DRIVER_SETTLEMENT_RATE / DRIVER_SHARE_RATE | Treated as **driver cost ratio of revenue** |
| cashFlow: rate% × fee = **driver_payout** | Same rate% × fee labeled **driver_cost** |
| Example rate=15 → driver gets 1500 | Report: “cost” = 1500 (may accidentally match payout $, still wrong concept vs `cost_amount`) |
| Example rate NULL → cashFlow silent **15** | Report silent **70** — **inconsistent silent defaults** |

---

## 3. All 70% occurrences (money-relevant)

| ID | Location | Meaning | Same as report 70? |
|----|----------|---------|-------------------|
| R70 | `reports.ts` gross-margin `COALESCE(...,70)` | Silent **driver cost %** | **THIS TARGET** |
| F70 | `franchisees` schema default 70 | Franchisee **share** of gross | NO (different table/party) |
| FO70 | `fleetOwner.ts` `?? 70` | Copy fleet share onto driver / salary ratio | NO (settlement) |
| FF70 | FranchiseFleetPortal default 70 | UI default for driver rate | NO |
| CT70 | CommissionTiersTab copy “急單 70%” | Urgent bonus split | NO |
| UI0.7 | opacity / KPI thresholds | Non-money | NO |

---

## 4. Rate Base

| Path | % | × WHAT |
|---------|--------|
| R70 | COALESCE(rate,70) | **orders.total_fee** |
| Canonical cost | n/a (NT$) | **route trip rate → cost_amount** |

---

## 5. Rate Source

| Path | Source class |
|------|----------------|
| R70 fallback 70 | **HARDCODED** / **SILENT_DEFAULT** |
| R70 when rate present | **DRIVER_PROFILE** field, but **wrong use** (settlement → cost) |
| Canonical | **ROUTE_RATE** (`driver_pay_rate` / `rate_per_trip`) |

---

## 6. Actual vs Estimated classification

| Expression | Class |
|------------|-------|
| `orders.cost_amount` from route rates | **DERIVED_FROM_REAL_RATE** / configured trip pay |
| `total_fee × commission_rate/100` (rate set) | Misuse of settlement rate as cost — **ESTIMATED** / wrong semantic |
| `total_fee × 70/100` (rate null) | **SILENT_DEFAULT** + **ESTIMATED** |
| Must **not** be called | actual driver cost / actual gross profit |

---

## 7. True Cost Source

| Attribute | Value |
|-----------|--------|
| SOURCE | Route prefix rates → order finance trigger |
| TABLE | `orders` (canonical store); origin `route_prefix_rates` |
| FIELD | `orders.cost_amount` |
| WRITER | `calc_order_finance` trigger in `orders.ts` (+ sparse boot fill) |
| COVERAGE | Only when prefix/rate resolvable; else often **0** |
| NULL BEHAVIOR | Column default **0**; profit may be NULL if total_fee missing |
| ZERO BEHAVIOR | Ambiguous: true zero **or** missing rate / legacy (BACKLOG 2d) — **UNKNOWN without audit** |
| UNIT | NT$ per order (trip) |

Reports **can** SELECT `SUM(cost_amount)` / `SUM(profit_amount)` today — **not implemented**.

---

## 8. Report Formula Inventory

### `/reports/gross-margin`

| Concept | Formula |
|---------|---------|
| Revenue | `SUM(total_fee)` → `gross_revenue` (+ `extra_fee` separate) |
| Cost (driver) | `SUM(total_fee × COALESCE(commission_rate,70)/100)` → `driver_cost` |
| Cost (franchise) | `SUM(franchisee_settlements.commission_amount)` by month |
| Profit | `gross_revenue − driver_cost − franchise_cost` |
| Margin | `profit / gross_revenue × 100` (0 if revenue≤0) |

### `/reports/driver-commission` (related, **not** 70)

| Concept | Formula |
|---------|---------|
| commission_amount | `SUM(total_fee) × COALESCE(rate, **0**)/100` |
| platform_net | revenue − commission |

Silent default **0**, not 70 — still settlement-shaped, not trip cost.

### Canonical (`281e873`)

| Concept | Formula |
|---------|---------|
| Revenue | `orders.total_fee` |
| Cost | `orders.cost_amount` |
| Profit | `orders.profit_amount = total_fee − cost_amount` |

---

## 9. Canonical Comparison

| REPORT_FIELD | CURRENT_FORMULA | CANONICAL_FIELD | MATCH? | CONFLICT | RISK |
|--------------|-----------------|-----------------|--------|----------|------|
| gross_revenue | SUM(total_fee) | total_fee | YES (agg) | — | Low |
| driver_cost | fee × COALESCE(rate,70)% | cost_amount | **NO** | Settlement % vs trip NT$ | **P0** |
| gross_profit | rev − driver_cost − franchise | profit_amount | **NO** | Second GP formula + franchise subtract | **P0** |
| gross_margin_pct | derived from above | profit/fee | **NO** | Fake margin | **P0** |
| franchise_cost | franchisee settlement sum | (not in order GP V1) | n/a | Extra cost layer | P1 |

---

## 10. Shadow Cases (characterization only)

Assumptions: single-order month, no franchise_cost, delivered.

### Case 1 — `total_fee=10000`, `cost_amount=800`, `commission_rate=NULL`

| Metric | Value |
|--------|-------|
| Actual / canonical cost | **800** |
| 70% fallback driver_cost | **7000** |
| Canonical GP | **9200** |
| Report GP (fallback) | 10000 − 7000 − 0 = **3000** |
| Distortion | Cost overstated **+6200**; profit understated **−6200** |

### Case 1b — same fees, `commission_rate=15` (no silent 70)

| Metric | Value |
|--------|-------|
| Report driver_cost | **1500** |
| Report GP | **8500** |
| Canonical GP | **9200** |
| Note | Still ≠ cost_amount; happens to equal cashFlow driver_payout |

### Case 2 — `total_fee=10000`, `cost_amount=0`, rate NULL

| Metric | Value |
|--------|-------|
| Report driver_cost | **7000** |
| Report GP | **3000** |
| Canonical GP | **10000** (if profit written as fee−0) |
| Risk | Report invents cost; canonical may **overstate** profit if 0 means missing rate (2d) |

### Case 3 — `total_fee=10000`, `cost_amount=NULL`

DB column typically defaults to **0** → behaves like Case 2 for canonical writer. Report still **7000** if rate null. Report never reads NULL cost.

### Case 4 — `total_fee=0`, cost 0/NULL

| Metric | Value |
|--------|-------|
| Report revenue | 0 |
| Report driver_cost | 0 |
| Report GP | 0 |
| Report margin | **0** (CASE WHEN revenue>0 … ELSE 0) — **not** UNKNOWN |

**Conclusion:** 70% fallback creates **large** fake cost / fake margin vs canonical when rates missing.

---

## 11. NULL / ZERO behavior

| Situation | Report behavior | Desired later (#3B repair) |
|-----------|-----------------|------------------------------|
| rate NULL | Silent **70%** | UNKNOWN / exclude from cost agg — **not** 0 by default |
| cost_amount 0 | Ignored | Distinguish missing vs real zero (separate) |
| total_fee 0 | margin **0** | OK or N/A |
| Replace 70→0 | **Forbidden** as auto-fix | UNKNOWN ≠ ZERO |

**API/UI tolerance (assess only):**  
`FinanceReportsTab` always `Number(x ?? 0)` and formats money — **can display 0**, but **cannot** show UNKNOWN without UI change. Null JSON fields would currently render as **0** → compatibility blocker for pure NULL without UI tweak.

---

## 12. Historical impact

| Question | Answer |
|----------|--------|
| 70% computed when? | **Read-time** SQL on each API call |
| Written to DB? | **NO** |
| Materialized table/cache? | **NO** server-side |
| Snapshot/export of this formula? | **Not found** for gross-margin |
| HISTORICAL_DATA_RISK from 70% column writes | **NO** |
| Caveat | Past **screenshots / downloaded decisions** may have used fake margins — operational, not DB contamination |
| Drivers with stored rate=70 | May exist via franchisee copy — those are **DB values**, not created by this report query |

---

## 13. Dashboard dependencies

- `FinanceReportsTab` / GrossMarginPanel — **ACTIVE**
- Labels: 總收入 / 司機成本 / 加盟成本 / 毛利 / 毛利率
- No disclaimer that cost is estimated

---

## 14. Export dependencies

- No Sheets/Excel route found calling `/reports/gross-margin`
- `settlementExport` / financials Excel use **other** formulas (incl. ×15%) — **isolated** from R70

---

## 15. financials ×15 isolation

| Item | Detail |
|------|--------|
| Writer | `auto_create_financials`: `platform_profit = total_fee × 0.15` |
| Reads reports 70%? | **NO** |
| Tag | **ISOLATED** from R70 code path |
| Truth conflict | Still separate “profit” story vs report GP vs order GP → contributes to **MULTIPLE_FINANCIAL_TRUTH** |

---

## 16. AP ×80 isolation

| Item | Detail |
|------|--------|
| Formula | `ap_total ≈ total_fee × 0.80` in financials trigger / JS fallback |
| Reads reports 70%? | **NO** |
| Tag | **ISOLATED** code path |
| Truth conflict | Third cost/AP approximation alongside 70% report cost |

---

## 17. Multiple Financial Truth findings

**MULTIPLE_FINANCIAL_TRUTH: YES**

| Lens | Cost / profit story |
|------|---------------------|
| Canonical order | cost_amount; profit = fee − cost |
| Report gross-margin | cost ≈ fee × COALESCE(rate, **70**)% (+ franchise) |
| financials | “profit” ≈ fee × **15%**; AP ≈ fee × **80%** |
| cashFlow | driver payout ≈ fee × COALESCE(rate, **15**)% |

Same order can show **four** incompatible numbers. R70 does not *call* ×15/×80, but **coexists** as another unverified dial.

---

## 18. P0 risks

1. Silent 70% invents driver_cost when rate null — fake GP/margin on admin 毛利報表.  
2. Uses DRIVER_SETTLEMENT_RATE as cost % even when rate present — wrong SSoT after `40f0a62`.  
3. Second gross-profit formula diverges from `orders.profit_amount` (`281e873`).

## 19. P1 risks

1. franchise_cost blended into “gross_profit” without clear product definition.  
2. UI forces null→0; cannot express UNKNOWN without change.  
3. cost_amount=0 ambiguity (BACKLOG 2d) if report switches to canonical blindly.  
4. Drivers pre-seeded with 70 from franchisee defaults amplify “looks configured” costs.

---

## 20. Repair options (no implement)

| Option | Idea | Correctness | Clarity | Compat | Historical | Files | DB/Mig | UI | Risk |
|--------|------|-------------|---------|--------|------------|-------|--------|-----|------|
| **A** | Report reads `SUM(cost_amount)` / `SUM(profit_amount)` | High vs canonical | High | Medium (numbers jump) | None (read-time) | reports (+ maybe UI label) | 0 | Low–Med | Medium if 0 means missing |
| **B** | No cost when unavailable → UNKNOWN/null; no 70 | High honesty | High | Needs UI null handling | None | reports + FinanceReportsTab | 0 | Med | Low semantic |
| **C** | Keep 70 but rename `estimated_driver_cost` + disclaimer | Low truth | Med | High | None | reports + UI | 0 | Low | Keeps fake number |
| **D** | Configurable estimate rate | Low without business ask | Med | Med | Config debt | +config | Maybe | Med | **Avoid** unless real policy |

**Do not prefer D** without documented commercial need.  
**Do not** auto-replace 70→0.

---

## 21. Recommended smallest repair

**Hybrid A+B (smallest slice):**

1. Prefer `orders.cost_amount` when present and **trustworthy** (define rule: e.g. `cost_amount > 0` **or** explicit “rate resolved” flag if later added).  
2. When cost unavailable: **do not** `COALESCE(rate,70)`; return null / omit from margin or flag `cost_status=UNAVAILABLE`.  
3. Prefer `profit_amount` when both fee and cost canonical available — **no second GP formula**.  
4. Leave franchise_cost as separate column (don’t silently fold into fake driver %).  
5. Touch **≤2–3** production files; characterization shadow tests from §10.

Defer: inventing estimate config (D); rewriting history; financials×15; AP×80.

---

## 22. Expected production files if repaired

| Likely | Role |
|--------|------|
| `artifacts/api-server/src/routes/reports.ts` | Formula change |
| `artifacts/logistics/src/pages/admin/FinanceReportsTab.tsx` | UNKNOWN / labels (if B) |
| Tests under `tests/characterization/money/` | Shadow → regression |

Target budget ≤3 production files.

---

## 23. Test plan (for next repair)

1. Case1: fee=10000 cost=800 → report cost 800, GP 9200 (ignore rate/70).  
2. Rate null + cost missing → not 7000; UNKNOWN/unavailable.  
3. Rate=15 must **not** force cost=1500 if cost_amount=800.  
4. total_fee=0 → margin safe.  
5. GP writer / cashFlow / OCR #3A / pricing / financials×15 / AP×80 unchanged.  
6. Full characterization suite green.

---

## 24. CHANGE VERIFICATION (this audit)

```
Production business logic modified: 0
DB schema changes: 0
Migration: NO
Historical rewrite: NO
Commit: NO
```

---

## Final required answers

```
70% business meaning:
  UNVERIFIED — code uses as “driver cost share of total_fee”; no formal policy/contract SSoT

70% rate source:
  HARDCODED SILENT_DEFAULT in reports.ts gross-margin SQL
  (UNVERIFIED_DEFAULT)

70% base:
  orders.total_fee

70% currently active:
  YES

Canonical actual cost source:
  orders.cost_amount ← route_prefix_rates.driver_pay_rate / rate_per_trip

Does report use canonical cost today:
  NO

Does 70% create fake/estimated cost:
  YES

Does 70% write DB:
  NO

Historical DB contamination:
  NO
  (read-time only; no materialize of this fallback found)

Recommended smallest repair:
  Prefer canonical cost_amount/profit_amount; remove COALESCE(...,70);
  unavailable → UNKNOWN/PARTIAL (not 0, not 70); ≤3 files

MULTIPLE_FINANCIAL_TRUTH:
  YES (canonical vs report-70 vs financials-15 vs AP-80)

Production business logic modified: 0
DB schema changes: 0
Migration: NO
Historical rewrite: NO
Commit: NO
```

*End of READ-ONLY #3B audit.*
