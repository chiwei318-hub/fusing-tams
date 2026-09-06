# REPORT 70% COST REPAIR — MONEY #3B

Date: 2026-09-06  
Baselines: GP `281e873` · Commission `40f0a62` · Audit `REPORT-70-COST-SSOT-AUDIT.md`  
Commit: **NO** (await review)

---

## PRE-CHANGE PLAN (expected production files)

| FILE | CLASSIFICATION | WHY | EXACT LOGIC CHANGE |
|------|----------------|-----|-------------------|
| `artifacts/api-server/src/routes/reports.ts` | REPAIR | Only site of COALESCE(...,70) as report cost | gross-margin: remove drivers join/rate; SUM(total_fee/cost_amount/profit_amount); PARTIAL when any NULL |
| `artifacts/logistics/src/pages/admin/FinanceReportsTab.tsx` | MODIFY (compat) | UI assumed numbers; would coerce null→0 | null-safe display; PARTIAL badge; known subtotal column; no ??0 for cost/profit |

**Production file count: 2** (≤3). Stop threshold >5: N/A.

**Policy chosen (Case E):** Hybrid Step3+Step5 — when incomplete, **`driver_cost` / `gross_profit` / `gross_margin_pct` = null**; expose **`driver_cost_known_sum`** + counts + `cost_status=PARTIAL` so known subtotal is visible but **not** the official full total.

---

## A. Pre-change evidence

See audit. Shadow: fee=10000 cost=800 → old report cost 7000 / GP 3000 vs canonical 800 / 9200.

## B. Expected file changes

As table above (+ characterization tests/docs only).

## C. Old report formula

```
driver_cost = SUM(total_fee × COALESCE(commission_rate, 70) / 100)
gross_profit = gross_revenue − driver_cost − franchise_cost
gross_margin_pct = profit / revenue × 100 (else 0)
```

## D. New canonical source

```
gross_revenue = SUM(total_fee)
driver_cost   = SUM(cost_amount)     only if cost_unknown=0 AND profit_unknown=0
gross_profit  = SUM(profit_amount)   same completeness gate
gross_margin_pct = profit/revenue×100 if complete AND revenue>0 else null
franchise_cost = informational only (NOT subtracted from canonical GP)
```

## E. Cost completeness policy

| Condition | cost_status | Official driver_cost / GP / margin |
|-----------|-------------|--------------------------------------|
| All cost_amount & profit_amount NOT NULL | COMPLETE | Full sums |
| Some known, some NULL | PARTIAL | **null** (+ known_sum exposed) |
| All NULL | UNKNOWN | **null** |

`cost_amount === 0` = **known zero** (not auto-null).

## F. NULL behavior

NULL cost/profit → unknown count++; month incomplete → official fields null.  
**UNKNOWN ≠ 0.** No 70/15/80 fallback.

## G. ZERO behavior

`cost_amount = 0` remains 0; contributes to known sum; month can be COMPLETE with GP = SUM(profit_amount).

## H. Partial aggregate behavior (Case E)

Orders: (10000,800,9200) + (5000,null,null)

| Field | Value |
|-------|-------|
| gross_revenue | 15000 |
| driver_cost_known_sum | **800** |
| cost_known_count / unknown | 1 / 1 |
| cost_status | **PARTIAL** |
| **driver_cost** | **null** (≠ 800) |
| **gross_profit** | **null** |
| **gross_margin_pct** | **null** |

Known subtotal **does not** masquerade as full actual total.

## I. API changes

New/changed fields on `/reports/gross-margin` rows:

- `cost_known_count`, `cost_unknown_count`, `profit_known_count`, `profit_unknown_count`
- `driver_cost_known_sum`, `profit_known_sum`
- `cost_data_complete`, `cost_status`
- `driver_cost` / `gross_profit` / `gross_margin_pct` may be **null**
- Removed dependency on `drivers`

## J. UI changes

- Banner when any PARTIAL/UNKNOWN month
- Status badge; 「已知成本小計」column for incomplete months
- Official cost/profit/margin show **—** when incomplete
- Charts: null not coerced to 0; connectNulls=false

## K. Shadow comparison

| Case | Old (70%) | New |
|------|-----------|-----|
| A fee=10000 cost=800 | cost 7000, GP 3000 | cost **800**, GP **9200**, margin **92%** |
| B cost=NULL | cost 7000, GP 3000 | **null / UNKNOWN** |
| E mixed | would blend or invent | PARTIAL; official null; known_sum=800 |

## L. Tests

- `report-70-cost.test.mjs` (Cases A–E + source/UI)
- Updated `commission-driver-semantic.test.mjs` (#3B removal assertion)
- `formulas.mjs`: `reportGrossMarginAggregate`

## M. Regression

`node --test tests/characterization/{money,status,tax}/*.test.mjs` — see run output (expect all pass).

## N. Historical impact

Read-time only; **no DB rewrite**; past UI numbers change on next fetch.

## O. Remaining financial truth conflicts

Still open: financials ×15%, AP ×80%, cost_amount=0 vs missing rate (2d). Report now aligns with order GP when COMPLETE.

## P. Next smallest repair

**#3C** financials ×15% deprecate/rename; and/or **2d** cost_amount=0 coverage semantics.

---

## Final checklist

```
reports uses drivers.commission_rate for cost: NO
reports uses 70% silent fallback: NO
canonical cost source: orders.cost_amount (SUM when COMPLETE)
canonical profit source: orders.profit_amount (SUM when COMPLETE)
unknown cost behavior: cost_status UNKNOWN/PARTIAL; official fields null
partial aggregate behavior: known_sum exposed; driver_cost/GP/margin null (Case E)

Production business logic modified: YES
Production files:
  artifacts/api-server/src/routes/reports.ts
  artifacts/logistics/src/pages/admin/FinanceReportsTab.tsx

DB schema: UNCHANGED
Migration: NO
Historical rewrite: NO
Gross Profit writer: UNCHANGED
Commission: UNCHANGED
financials ×15: UNCHANGED
AP ×80: UNCHANGED
Commit: NO
```
