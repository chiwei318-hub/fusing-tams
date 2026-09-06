# FINANCIALS ×15% STOP FAKE PROFIT REPAIR — MONEY #3C

Date: 2026-09-06  
Baselines: `ae9ddda`, `39bd760` (#2dA OVERALL CLOSED)  
Audit: `FINANCIALS-15-SSOT-AUDIT.md`  
Mode: **MINIMAL REPAIR** (Option B-leaning)  
Commit: **NO**

---

## A. Pre-change evidence

| Item | Before |
|------|--------|
| Trigger `platform_profit` | `total_fee * 0.15` |
| Trigger `platform_revenue` | `total_fee * 0.15` |
| Trigger `profit_margin_pct` | literal `15` |
| ON CONFLICT | `DO NOTHING` (kept) |
| Writer B | `AR − AP` (untouched) |
| AP ×80 | trigger + Writer B fallback (untouched — #3F) |
| Case D | GP NULL + financials **1500** |

### Expected production files (≤2)

| FILE | CLASSIFICATION | WHY | EXACT LOGIC CHANGE |
|------|----------------|-----|-------------------|
| `artifacts/api-server/src/routes/financials.ts` | Writer A trigger | Stop HARDCODED ×15 | INSERT `NULL,NULL,NULL` for profit/revenue/margin |
| `artifacts/logistics/src/pages/admin/FinancialsDashboard.tsx` | Formal UI reader | NULL ≠ 0 display | Row cells「待計算」/「—」; StatCard sub no longer claims all rows are AR−AP |

---

## B. Files changed

**Production (2):**  
- `financials.ts`  
- `FinancialsDashboard.tsx`

**Characterization / docs:**  
- `formulas.mjs`, `financials-15-ssot.test.mjs`, `divergence.test.mjs`, `commission-driver-semantic.test.mjs`, `report-70-cost.test.mjs`  
- this report; `BACKLOG.md`

---

## C. Old trigger formula

```
platform_profit    = total_fee * 0.15
platform_revenue   = total_fee * 0.15
profit_margin_pct  = 15
ap_total           = total_fee * 0.80   -- unchanged
ar_total           = total_fee          -- unchanged
```

---

## D. New trigger formula

```
platform_profit    = NULL
platform_revenue   = NULL
profit_margin_pct  = NULL
ap_total           = total_fee * 0.80   -- UNCHANGED (#3F)
ar_total           = total_fee          -- UNCHANGED
ON CONFLICT DO NOTHING                  -- UNCHANGED
```

Explicit `NULL` (not column omit) so schema `DEFAULT 0` does not revive fake zero/profit.

---

## E. Writer B unchanged confirmation

| Check | Result |
|-------|--------|
| `platform_profit = ar_total - ap_total` | YES still |
| AP ×80 fallback when settlement missing | YES still |
| recalculate / batch routes | unchanged |
| Source still has `* 0.15` in trigger block | **NO** |

---

## F. UI/API NULL handling

| Surface | Before | After |
|---------|--------|-------|
| Order row 淨利 | `n(platform_profit)` → Number(null)→**0** | `fmtProfitCell` → **「待計算」** |
| Order row 利潤率 | `?? 0` → **0%** | **「—」** |
| StatCard 平台淨利 sub | 「AR - AP」 | 「已計算列合計（待計算列未列入 SUM）」 |
| monthly-report `COALESCE(SUM(...),0)` | skips NULL then 0 if all null | **unchanged API** — see G |
| export-excel reduce `?? 0` | same SUM semantics | **unchanged this round** (AGGREGATE gap recorded) |

**UI displays NULL safely (row-level):** **YES**  
**Aggregate / Excel completeness labels:** **PARTIAL** (gap documented)

---

## G. Aggregate completeness gap findings

PostgreSQL `SUM(platform_profit)` **ignores NULL**.  
Monthly KPI therefore = sum of **known** (Writer B / historical numeric) rows only.  
No `pending_count` / `PARTIAL` flag on monthly-report yet.

**AGGREGATE_COMPLETENESS_GAP:** **YES**  
Not repaired this round (out of minimal stop-fake scope). Next UI/report pass.

---

## H. Shadow comparison (before / after)

| Case | Before | After (#3C) |
|------|--------|-------------|
| A trigger fee=10000 | profit **1500**, margin **15** | profit **NULL**, margin **NULL** |
| B recalc AR/AP 10000/8000 | profit **2000** | profit **2000** (unchanged) |
| C cost=800 GP | GP **9200** vs 1500 vs 2000 | GP **9200** vs **NULL** vs **2000** |
| D unknown GP | GP NULL + fin **1500** | GP NULL + fin **NULL** (new rows) |

Tag `FINANCIALS_SHOWS_PROFIT_WHILE_CANONICAL_GP_UNKNOWN` **cleared for NEW trigger-only rows**.  
Historical STATE 1 ×15 rows **still show fake profit** until separately remediated.

---

## I. Tests

`financials-15-ssot.test.mjs` A–E + isolation; divergence / #3A / #3B isolation updated.  
Full characterization suite: see command output (target PASS).

---

## J. Regression

| Area | Touched? |
|------|----------|
| orders.profit_amount / #2dA | NO |
| cost NULL policy | NO |
| Writer B AR−AP | NO |
| AP ×80 | NO |
| commission / OCR / pricing / tax / invoice | NO |

---

## K. Historical impact

**Historical rows rewritten:** **NO** (KEEP AS-IS)  
Old ×15 STATE 1 rows remain; provenance still **NO**.

---

## L. Remaining dependencies

1. **#3F AP×80** — trigger still writes `ap_total = fee×0.80`; Writer B fallback same  
2. **Historical ×15 rows** — still mislabel until backfill/relabel decision  
3. **AGGREGATE_COMPLETENESS_GAP** — monthly SUM silent on pending  
4. **UI_LABEL** on partner/vehicle aggregates & Excel — still may coerce/skip without pending banner  
5. **Prod exposure UNKNOWN** — RO_DB_REQUIRED  

---

## M. Next smallest repair

1. Monthly-report + dashboard: expose `pending_profit_orders` / PARTIAL when any NULL profit  
2. Decide historical ×15: KEEP / NULL backfill (needs provenance strategy or heuristic RO audit)  
3. Only then consider trusting AR−AP as formal KPI (**depends #3F**)

---

## Final checklist

| Q | A |
|---|---|
| trigger platform_profit after repair | **NULL** |
| trigger platform_revenue after repair | **NULL** |
| trigger profit_margin_pct after repair | **NULL** |
| Writer B AR-AP formula changed | **NO** |
| AP ×80 changed | **NO** |
| UI displays NULL safely | **YES** (order rows); aggregate **PARTIAL** |
| Aggregate completeness gap exists | **YES** |
| Historical rows rewritten | **NO** |
| Schema changed | **NO** |
| Migration | **NO** |
| Production files | `financials.ts`, `FinancialsDashboard.tsx` |
| Tests | characterization suite (see run) |
| Commit | **NO** |
