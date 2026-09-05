# MONEY REPAIR — profit_amount stop deducting VAT

Date: 2026-09-06  
Scope: `orders.profit_amount` / `calcOrderFinance` only.  
**Did not touch:** financials ×15%/×80%, commission, tax_engine rate, historical non-NULL rows.

---

## Step 1 — Pre-change evidence (A–E)

### A. Who writes `orders.profit_amount`?

| Writer | Path | Notes |
|--------|------|-------|
| **Primary** | SQL trigger `calc_order_finance` in `orders.ts` `ensureOrderFinanceTrigger` | BEFORE INSERT/UPDATE OF `total_fee, route_prefix, fusingao_fleet_id` |
| Mirror (unused at runtime) | `calcOrderFinance()` in `orderFinanceColumns.ts` | **No call sites** in repo (imported in orders.ts but never invoked) |
| Manual | `PATCH /orders/:id` if body includes `profitAmount` | Operator override |
| Sparse boot fill | Same trigger installer; only when `profit_amount IS NULL` | Does **not** overwrite existing values |

### B. Old formula (before this REPAIR)

```
profit_amount = ROUND(total_fee - cost_amount - vat_amount, 2)
vat_amount    = ROUND(total_fee * 0.05, 2)   // exclusive VAT — kept
cost_amount   = COALESCE(driver_pay_rate, rate_per_trip, 0) from route_prefix_rates
```

### C. Who reads `profit_amount`?

| Reader | Use |
|--------|-----|
| `sheetsExport.ts` | `COALESCE(profit_amount, total_fee - driver_pay, 0)` |
| `firebaseSync.ts` | same COALESCE pattern → Firebase |
| Admin/API order payloads | field on order JSON if selected |
| **Not** FinancialsDashboard | reads `order_financials.platform_profit` (×15% / AR−AP) instead |

### D. Is `cost_amount` reliable enough for `gross_profit = net − cost`?

| Question | Evidence |
|----------|----------|
| Semantic | Documented as 趟次直接成本 = `route_prefix_rates.driver_pay_rate` else `rate_per_trip` |
| Fake fill? | **No** — comes from rate table or 0; not invented fuel/toll |
| Coverage | **PARTIAL**: only when `route_prefix` matches a rate row; else cost=0 |
| Full direct cost? | **No** — fuel/toll/other = **NOT_TRACKED** (out of scope) |
| Verdict | **Not BLOCKED_BY_COST_SSoT** — cost is a real tracked direct-transport proxy; incompleteness must be labeled, not blocked |

### E. NULL / ZERO policy (no invented business rules)

| Case | Behavior (unchanged policy) |
|------|------------------------------|
| `total_fee` NULL / ≤0 | `profit_amount = NULL`（蝦皮無收費） |
| `cost_amount = 0` | Still compute `profit = total_fee - 0` — **may mean missing rate**; treat as data-quality issue, not auto-NULL |
| Existing non-NULL `profit_amount` | **Not rewritten** on boot（sparse fill only） |
| Negative profit | Allowed if cost > fee — **no clamp**（would be BUSINESS_POLICY_REQUIRED to forbid） |

---

## Step 2–5 — Change

**New formula (LOCKED #3/#4):**

```
profit_amount = ROUND(total_fee - cost_amount, 2)
vat_amount unchanged (still exclusive 5%, separate column)
```

**Files (2 production + tests ≤5):**

1. `artifacts/api-server/src/routes/orders.ts` — trigger + sparse NULL fill  
2. `artifacts/api-server/src/routes/orderFinanceColumns.ts` — pure fn + comments  
3. `tests/characterization/money/formulas.mjs`  
4. `tests/characterization/money/order-finance.test.mjs`  
5. `tests/characterization/money/divergence.test.mjs` (+ this report)

**Untouched:** `financials.ts` ×15%/×80%, settlements, commission, tax rate.

---

## Step 6 — Shadow comparison

Fixture: `total_fee=10000`, `cost=800`, `VAT=500`（真實 characterization fixture，非 prompt 示意的 7000）

| Label | Formula | Value |
|-------|---------|-------|
| OLD | total − cost − VAT | **8700** |
| NEW | total − cost | **9200** |
| LEGACY | financials `total × 0.15` | **1500** |

---

## Tests

Restored two VAT-alignment cases that were accidentally dropped when rewriting
`divergence.test.mjs` (net −1 → 36). After restore: **38 = 37 baseline + 1 shadow**.

`pnpm run test:characterization`

---

## CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| financials ×15%/×80% edited | **0** |
| Historical non-NULL profit bulk rewrite | **0** |
| VAT exclusive formula changed | **0**（only removed from profit） |
| Migration | **NO** |
