# COMMISSION INVENTORY — READ-ONLY

Date: 2026-09-06  
Mode: **READ-ONLY** — no code / schema / DB writes / commit  
Post-`281e873` check: Gross Profit V1 must not be contaminated by commission fields.

### CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| Modified production business logic | **0** |
| DB schema / migration | **0 / NO** |
| Production DB writes | **0** |
| Commit | **NO** |

---

## 1. Field map (who owns which `commission_rate`)

| Table / Field | Intended party (from usage) | Default | Notes |
|---------------|----------------------------|---------|-------|
| `drivers.commission_rate` | **COLLISION** — see §4 | often 15 or 70 | Same column, opposite party meanings |
| `franchisees.commission_rate` | Franchisee / driver share of gross | **70** | Used as `driver_ratio` in fleetOwner |
| `franchisees.platform_commission_rate` | Platform fee on fleet gross | **10** | fleetOwner salary |
| `fusingao_fleets.commission_rate` | **Platform** cut of shopee/trip income | **15** | fleet gets `(1 - rate%)` |
| `order_settlements.commission_rate` | Platform service fee on settlement | **15** | GENERATED `commission_amount` |
| `order_financials.platform_profit` | LEGACY approx — **not a rate field** | n/a | Written as `total_fee * 0.15` |

---

## 2. Commission inventory (high-signal sites)

| ID | VALUE | MEANING (verified by call chain) | FILE | FORMULA | RATE BASE | SOURCE | HARDCODED DEFAULT? | CONFIGURABLE? | USED IN OUTPUT? | RISK |
|----|-------|----------------------------------|------|---------|-----------|--------|-------------------|---------------|-----------------|------|
| C1 | 15% | Platform cut of fusingao fleet income | `fusingao.ts` many queries | `income * rate/100` platform; fleet `(1-rate)` | billing income / rate_per_trip | `fusingao_fleets.commission_rate` | Y default 15 | Y DB | Y | Medium |
| C2 | 15% | Platform service fee on order settlement | `settlementEngine` / `webhookOrders` / schema | `total × rate/100` | total_freight | `order_settlements.commission_rate` / config key | Y 15 | Y | Y | Medium |
| C3 | 15% | **Driver share** of `total_fee` | `cashFlow.ts` | `total_fee * COALESCE(d.commission_rate,15)/100` → **driver_payout** | `orders.total_fee` | `drivers.commission_rate` | Y 15 | Y | Y CashFlowTab | **SEMANTIC COLLISION** |
| C4 | 15% | **Platform share** of receipt amount | `receipts.ts` OCR | `amount * (commission_rate\|\|15)/100` → **platformFee**; driver = remainder | OCR amount | `drivers.commission_rate` | Y 15 | Y | Y commissionCalc JSON | **SEMANTIC COLLISION** |
| C5 | 0 / 70% | Driver cost share for margin report | `reports.ts` gross-margin | `total_fee * COALESCE(d.commission_rate, **70**)/100` → driver_cost | `orders.total_fee` | `drivers.commission_rate` | Y **70** fallback | Y | Y gross-margin API | **SEMANTIC COLLISION** + **UNVERIFIED_DEFAULT** |
| C6 | rate% | Driver commission report | `reports.ts` driver-commission | `SUM(total_fee)*rate/100` as commission_amount | total_fee | `drivers.commission_rate` (COALESCE 0, not 15) | N (0 if null) | Y | Y | Aligns with C3 if rate filled |
| C7 | 70% | Franchisee default driver_ratio | `fleetOwner.ts` / `franchisees.ts` | `gross * driver_ratio/100` | trip/gross | `franchisees.commission_rate` | Y 70 | Y | Y salary | Different table — OK if labeled franchisee share |
| C8 | 10% | Platform fee on fleet salary | `fleetOwner.ts` | `gross * platform_commission_rate/100` | gross | `franchisees.platform_commission_rate` | Y 10 | Y | Y | **UNVERIFIED_DEFAULT** without contract doc |
| C9 | 15% | LEGACY platform_profit | `financials.ts` trigger | `total_fee * 0.15` | total_fee | **literal** — not reading commission_rate | Y | N | Y FinancialsDashboard | Not commission field; mislabeled profit |
| C10 | 15% | Export 「佣金(15%)」/「人事成本(估)」 | `settlementExport.ts` | `SUM(total_fee)*0.15` | total_fee | literal | Y | N | Y Excel | **UNVERIFIED_DEFAULT**; may mean either party |
| C11 | 5%/7% | Fusingao upstream cut | `fourLayerSettlement.ts` | Layer1 | trip gross | const NORMAL/PREMIUM | Y | N | Y | Not `commission_rate` column |
| C12 | 7% | Import / shopee billing | import scripts / `shopeeBillingImport` | summary | pretax | row/default | Y 7 | Y | Y | Upstream |
| C13 | 15% | `calcOrderFinance` default for **fleet_payout only** | `orderFinanceColumns.ts` | `rate*(1-commission/100)` | rate_per_trip | param default 15 | Y | param | fn unused at runtime | Dead path for profit |
| C14 | 15–25% | Pricing / quote profit_margin | smartQuote / freightQuote | markup on quote | quote subtotal | partner settings | Y | Y | Y | **Not ops commission** |

---

## 3. §4 — Three-way semantic split (INPUT → FIELD → FORMULA → OUTPUT)

### A. `cashFlow.ts`

```
INPUT:  orders.total_fee, drivers.commission_rate
FIELD:  drivers.commission_rate
FORMULA: driver_payout = total_fee × COALESCE(rate, 15) / 100
         platform_net  = total_fee − driver_payout
OUTPUT: CashFlowTab KPI「司機薪資 / 平台淨利」
PARTY:  rate% = **DRIVER** share（預設 15% 給司機）
```

### B. `receipts.ts` (OCR commissionCalc)

```
INPUT:  extracted.amount; optional drivers row
FIELD:  drivers.commission_rate
FORMULA: platformFee = amount × (rate||15)/100
         driverEarning = amount − platformFee
         Comment: "Default driver commission rate is 85% (platform takes 15%)"
OUTPUT: API JSON commissionCalc only (suggestion, not settlement write in this snippet)
PARTY:  rate% = **PLATFORM** share（預設 15% 給平台）
```

### C. `reports.ts` `/reports/gross-margin`

```
INPUT:  orders.total_fee, drivers.commission_rate
FIELD:  drivers.commission_rate
FORMULA: driver_cost = SUM(total_fee × COALESCE(rate, **70**) / 100)
         gross_profit = revenue − driver_cost − franchise_cost
OUTPUT: monthly gross margin report
PARTY:  rate% = **DRIVER** cost share（預設 **70%** 給司機成本）
```

### Collision verdict

| Tag | Finding |
|-----|---------|
| **SEMANTIC COLLISION** | Same DB field `drivers.commission_rate` interpreted as driver share (cashFlow, reports) **and** platform share (receipts) |
| **UNVERIFIED_DEFAULT** | Fallback 15 vs 70 vs 0 across call sites — no single business source of truth in code |
| Severity | **P0 for REPAIR #3 design** — cannot “fix the rate” until party meaning is locked |

---

## 4. §7 — Gross Profit isolation (post-`281e873`)

| Check | Result |
|-------|--------|
| `orders.profit_amount` formula | `total_fee − cost_amount` (`cost` from route_prefix rates) |
| Does profit formula **read** `drivers.commission_rate`? | **NO** |
| Does profit formula **read** `order_settlements.commission_*`? | **NO** |
| Does profit formula **use** `×0.15`? | **NO** |
| Same trigger also sets `fleet_payout` using `fusingao_fleets.commission_rate`? | **YES** — **separate column**, not mixed into `profit_amount` |
| `calcOrderFinance` profit line uses commission? | **NO** — commission only for `fleet_payout` return field |
| Readers sheetsExport/firebaseSync | `COALESCE(profit_amount, total_fee−driver_pay)` — fallback uses `driver_pay`, not commission_rate |
| FinancialsDashboard | Still reads `order_financials.platform_profit` (LEGACY ×15%) — **isolated from V1 profit_amount** |

### Contamination tags

| Tag | Present? |
|-----|----------|
| **P0 CROSS-CONTAMINATION** (profit_amount computed from commission) | **NO** |
| Residual dual KPI risk | **YES** — UI may show V1 `profit_amount` elsewhere while Financials still shows ×15% — different columns, not formula bleed |

---

## 5. `financials.ts` ×15% true meaning

| Question | Answer |
|----------|--------|
| Reads `commission_rate` column? | **No** |
| Formula | Literal `NEW.total_fee * 0.15` into `platform_profit` |
| Business label in UI | 「平台淨利」 |
| Formal source | **UNVERIFIED_DEFAULT** / LEGACY_HARDCODED_APPROXIMATION (BACKLOG #2) |
| Relation to commission | Numerically equals “15% of fee” but **not** wired to settlement commission SSoT |

---

## 6. `reports` 70% true meaning

| Question | Answer |
|----------|--------|
| Where | `COALESCE(d.commission_rate, 70)` in gross-margin driver_cost |
| Meaning in formula | Assumes **70% of revenue is driver cost** when rate null |
| Formal contract source in repo | **None found** → **UNVERIFIED_DEFAULT** |
| Conflicts with | cashFlow default **15** on same column |

---

## 7. Suggested next REPAIR #3 inputs (audit only — do not implement)

1. **Lock `drivers.commission_rate` party meaning** (driver share XOR platform share) — business decision  
2. Split columns if both needed: e.g. `driver_share_pct` vs `platform_fee_pct`  
3. Unify fallbacks (15 vs 70 vs 0) or require NOT NULL  
4. Keep Gross Profit V1 on `cost_amount` path; do not reintroduce commission into `profit_amount`  
5. Relabel or quarantine financials ×15% / settlementExport ×15% until business confirms  

---

## 8. Testability note

Pure search + call-chain audit; no new tests required this round. Characterization already locks profit≠×15% divergence.
