# COMMISSION SSoT AUDIT

Date: 2026-09-06  
Baseline commit: `281e873` (Gross Profit #2b: `profit_amount = total_fee - cost_amount`)  
Mode: **READ-ONLY** — MONEY REPAIR #3 audit only  

### CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| Modified production business logic | **0** |
| DB schema changes | **0** |
| Migration | **NO** |
| Historical data rewrite | **NO** |
| Gross Profit formula modified | **NO** |
| Driver Pay formula modified | **NO** |
| Pricing modified | **NO** |
| Commission modified | **NO** |
| Commit | **NO** |

Companion: [`COMMISSION-INVENTORY.md`](./COMMISSION-INVENTORY.md) (earlier short form).

---

## 1. Executive Summary

系統裡「commission」**不是單一商業概念**。至少並存：

| Concept | Typical % | Example |
|---------|-----------|---------|
| Platform cut of fleet/trip income | 15 | `fusingao_fleets.commission_rate` |
| Platform cut of order settlement | 15 | `order_settlements.commission_rate` |
| Driver **share** of `total_fee` | 15 default / 70 fallback | `cashFlow` / `reports` gross-margin |
| Platform **share** of receipt | 15 | `receipts` OCR (same DB field!) |
| Franchisee share of gross | 70 | `franchisees.commission_rate` |
| Upstream Fusingao cut | 5–7 | `fourLayerSettlement` / imports |
| LEGACY estimated profit | 15 | `financials` `platform_profit = total×0.15` |
| Trip pay (NOT commission) | NT$ fixed | `driver_pay_rate` / `rate_per_trip` → `cost_amount` |

**P0:** `drivers.commission_rate` = **SEMANTIC COLLISION**（司機抽成 vs 平台抽成）.  
**PASS:** Gross Profit V1 **不讀** commission 欄位（isolation OK）.

---

## 2. Commission Inventory

| ID | FILE | FUNCTION | DB TABLE | DB FIELD | VALUE | RATE SOURCE | RATE BASE | BUSINESS MEANING | PAYER | PAYEE | WRITER | READER | API/UI/REPORT/SETTLEMENT | HARDCODED? | CONFIGURABLE? | ACTIVE? | CLASS | RISK |
|----|------|----------|----------|----------|-------|-------------|-----------|------------------|-------|-------|--------|--------|--------------------------|------------|---------------|---------|-------|------|
| C01 | `cashFlow.ts` | summary/driver queries | drivers | commission_rate | COALESCE 15 | DRIVER_PROFILE + SILENT_DEFAULT | **total_fee** | Driver share of freight | Customer→Platform pool | **Driver** | admin drivers PATCH | cashFlow | API+CashFlowTab | Y default | Y | Y | B DRIVER_COMMISSION | **P0 COLLISION** |
| C02 | `receipts.ts` | OCR commissionCalc | drivers | commission_rate | \|\| 15 | DRIVER_PROFILE + SILENT_DEFAULT | **OCR amount** | Platform fee on receipt | Driver/customer cash | **Platform** | — (calc only) | OCR API JSON | API | Y default | Y | Y | A COMPANY_PLATFORM | **P0 COLLISION** |
| C03 | `reports.ts` | gross-margin | drivers | commission_rate | COALESCE **70** | DRIVER_PROFILE + SILENT_DEFAULT | **total_fee** | Driver cost % of revenue | — | Driver (as cost) | — | gross-margin report | REPORT | Y 70 | Y | Y | H REPORT_ONLY + B | **P0 COLLISION** |
| C04 | `reports.ts` | driver-commission | drivers | commission_rate | COALESCE 0 | DRIVER_PROFILE | **total_fee** | Same as C01 if rate set | — | Driver | — | driver-commission report | REPORT | N | Y | Y | B | Aligns C01 if non-null |
| C05 | `settlements.ts` / settlementEngine | GENERATED / calculateSettlement | order_settlements | commission_rate / commission_amount | default 15 | DB_CONFIG / HARDCODED default | **total_amount** (freight) | Platform service fee | Franchisee/driver pool | **Platform** | webhookOrders / settle | settlement APIs | SETTLEMENT | Y 15 | Y | Y | A / F SETTLEMENT_SPLIT | P1 |
| C06 | `franchisees.ts` | settle period | franchisees | commission_rate | default 70 | FLEET_CONTRACT / DB | **gross_revenue** | Franchisee payout share | Customer revenue | **Franchisee** | franchisee CRUD | franchisee_settlements | SETTLEMENT | Y 70 | Y | Y | C FLEET / F | P1 |
| C07 | `fleetOwner.ts` | salary | franchisees | commission_rate as driver_ratio | 70 | FLEET_CONTRACT | **gross** | Driver ratio under fleet | Fleet gross | **Driver** | fleetOwner | salary records | SETTLEMENT | Y 70 | Y | Y | B / F | P1 |
| C08 | `fleetOwner.ts` | salary | franchisees | platform_commission_rate | 10 | FLEET_CONTRACT / SILENT_DEFAULT | **gross** | Platform fee on fleet | Fleet | **Platform** | fleetOwner | salary | SETTLEMENT | Y 10 | Y | Y | A | UNVERIFIED_DEFAULT |
| C09 | `fusingao.ts` | many billing queries | fusingao_fleets | commission_rate | 15 | FLEET_CONTRACT / DB | **income / rate_per_trip** | Platform cut; fleet gets 1−rate | Shopee/trip income | **Platform** vs Fleet | fusingao CRUD | billing UIs | SETTLEMENT | Y 15 | Y | Y | C FLEET_COMMISSION | P1 |
| C10 | `fusingaoFleets` schema | — | fusingao_fleets | fusingao_commission_rate | 7 | UPSTREAM / DB | trip/gross | Upstream Fusingao cut | — | Fusingao | import script | fourLayer / import | SETTLEMENT | Y 7 | Y | Y | E UPSTREAM | P1 |
| C11 | `fourLayerSettlement.ts` | Layer1 | — | consts | 5% / 7% | HARDCODED | trip gross | Upstream cut tiers | — | Fusingao | — | settlement summary | SETTLEMENT | Y | N | Y | E | P1 |
| C12 | `financials.ts` | auto_create_financials | order_financials | platform_profit | ×0.15 | HARDCODED literal | **total_fee** | LEGACY estimated platform take/profit | — | Platform (label) | trigger on delivered | FinancialsDashboard | REPORT | Y | N | Y | H / I | P0 mislabel |
| C13 | `settlementExport.ts` | export | — | — | ×0.15 | HARDCODED | **total_fee** | 「佣金」+「人事成本(估)」 | UNKNOWN | UNKNOWN | — | Excel | REPORT | Y | N | Y | H | UNVERIFIED |
| C14 | `orders.ts` trigger | calc_order_finance | fusingao_fleets | commission_rate | DB | FLEET_CONTRACT | **v_rate** (trip rate) | Cuts fleet_payout only | Trip rate | Platform retains share | trigger | orders.fleet_payout | SETTLEMENT | — | Y | Y | C | OK isolated |
| C15 | `orderFinanceColumns.ts` | calcOrderFinance | — | param | default 15 | HARDCODED param | rate_per_trip | fleet_payout only | — | — | unused caller | — | — | Y | param | **fn unused** | C | Dead for profit |
| C16 | `orders` / rates | trigger | route_prefix_rates | driver_pay_rate / rate_per_trip | NT$ | ROUTE_RATE | per trip | **Driver/trip pay — NOT commission** | Platform/customer | Driver/carrier | rate admin | cost_amount | — | N | Y | Y | **G DRIVER_PAY_RATE** | — |
| C17 | smartQuote / freightQuote | pricing | partners | profit_margin | ~15 | CUSTOMER_CONTRACT / UI | quote subtotal | Pricing markup | Customer | Platform | partner admin | quote UI | — | Y | Y | Y | D-ish / pricing | Not ops commission |
| C18 | shopeeBillingImport | import | summary | commission_rate | 0.07 | UPSTREAM file | pretax | Upstream billing cut | — | Fusingao | import | billing | — | Y 7 | Y | Y | E | — |
| C19 | taxPayroll | withholding | — | — | 10% / 2.11% | HARDCODED policy | gross pay | Tax/NHI — **not commission** | Payee | Tax authority | tax close | tax UI | — | Y | N | Y | I (tax) | Separate domain |

---

## 3. Semantic Collisions

| Tag | Evidence |
|-----|----------|
| **SEMANTIC COLLISION P0** | `drivers.commission_rate`: C01 treats as **driver share**; C02 as **platform share**; C03 as **driver cost %** with different silent default |
| **NAME COLLISION** | `franchisees.commission_rate` (70% franchisee) vs `fusingao_fleets.commission_rate` (15% platform) — same English name, opposite residual party |
| **LABEL COLLISION** | `financials.platform_profit` named profit but formula = fee×15% (commission-shaped) |

Same number **15%** across C01/C02/C05/C09/C12 **does not** imply same meaning.

---

## 4. Rate Base Matrix

| ID | % | × WHAT (base) |
|----|---|----------------|
| C01 cashFlow | rate/15 | **orders.total_fee** |
| C02 receipts | rate/15 | **OCR extracted.amount** |
| C03 reports margin | rate/70 | **orders.total_fee** |
| C05 order_settlements | rate/15 | **order_settlements.total_amount** |
| C06 franchisee settle | rate/70 | **gross_revenue** (manual/body) |
| C08 platform_commission_rate | 10 | **fleet salary gross** |
| C09 fusingao | rate/15 | **billing income** or **rate_per_trip** |
| C11 fourLayer | 5/7 | **trip gross** |
| C12 financials | 15 | **orders.total_fee** |
| C14 fleet_payout | fleet rate | **route trip rate (v_rate)** — not total_fee |
| C16 driver_pay_rate | N/A (money) | **per trip** fixed NT$ |

---

## 5. Rate Source Matrix

| Source | Examples |
|--------|----------|
| HARDCODED | financials ×0.15; settlementExport ×0.15; fourLayer 5/7; tax 10/2.11 |
| DB_CONFIG | order_settlements.commission_rate; webhook `default_commission_rate` |
| FLEET_CONTRACT | franchisees.*; fusingao_fleets.* |
| ROUTE_RATE | driver_pay_rate, rate_per_trip |
| DRIVER_PROFILE | drivers.commission_rate |
| UI_INPUT / CUSTOMER_CONTRACT | partner profit_margin |
| DERIVED | GENERATED commission_amount; platform = gross − franchisee commission |
| ENV | not primary for commission rates |
| UNKNOWN | settlementExport 「人事成本」 |

---

## 6. Silent Defaults

| Pattern | Location | Tag |
|---------|----------|-----|
| `COALESCE(d.commission_rate, 15)` | cashFlow | **SILENT_DEFAULT** → driver 15% |
| `(parseFloat(...) \|\| 15)` | receipts | **SILENT_DEFAULT** → platform 15% |
| `COALESCE(d.commission_rate, 70)` | reports gross-margin | **SILENT_DEFAULT** → driver cost 70% |
| `COALESCE(d.commission_rate, 0)` | reports driver-commission | different silent behavior |
| `?? 70` / `?? 10` | fleetOwner | **SILENT_DEFAULT** |
| `?? 15` / `COALESCE(...,15)` | fusingao / settlements | **SILENT_DEFAULT** |
| schema defaults 15 / 70 / 7 / 10 | drizzle schemas | **SILENT_DEFAULT** at insert |

---

## 7. Driver Pay vs Commission

| Concept | Fields | Formula role |
|---------|--------|--------------|
| **G DRIVER_PAY_RATE** | `route_prefix_rates.driver_pay_rate`, `rate_per_trip` | → `orders.cost_amount`; Gross Profit V1 cost |
| **B DRIVER_COMMISSION** (share %) | `drivers.commission_rate` in cashFlow | % of total_fee as payout estimate |
| Settlement driver_payout | `(100 − commission_rate)% × total` | Residual after platform fee |

**Rule:** Driver Pay (NT$/trip) ≠ Commission (%).  
Misnaming risk: calling trip rates “commission” is wrong — classify **G**, not A/B.

---

## 8. Platform Commission

| Site | Base | Payee | Status |
|------|------|-------|--------|
| order_settlements | total_amount | Platform | ACTIVE SSoT candidate for order-level platform fee |
| fusingao_fleets.commission_rate | trip/income | Platform | ACTIVE fleet channel |
| franchisees.platform_commission_rate | salary gross | Platform | ACTIVE |
| receipts OCR | amount | Platform | ACTIVE suggestion only |
| financials ×15% | total_fee | Labeled profit | LEGACY / mislabel |

Canonical name candidate: `platform_fee_pct` / `platform_fee_amount`.

---

## 9. Fleet Commission

| Site | Meaning |
|------|---------|
| fusingao: rate% to platform, fleet keeps rest | C FLEET_COMMISSION |
| franchisees.commission_rate 70%: money **to franchisee** | C / F — residual platform = 30% |
| orders.fleet_payout = rate × (1 − fusingao.commission%) | Carrier payable after platform cut |

---

## 10. Customer Service Fee

| Finding | Status |
|---------|--------|
| Dedicated `customer_service_fee` field | **MISSING / UNKNOWN** in ops money path |
| Quote `profit_margin` | Pricing markup — not settlement commission |
| Classification | D only if product later defines it; else keep as pricing |

---

## 11. Upstream Commission

| Site | Rate | Base |
|------|------|------|
| fourLayer FUSINGAO_RATE_NORMAL/PREMIUM | 7% / 5% | trip gross |
| fusingao_commission_rate | 7% default | fleet/import |
| shopeeBillingImport | 0.07 | pretax |

Classification: **E UPSTREAM_COMMISSION**.

---

## 12. Settlement Split Rates

| Engine | Split |
|--------|-------|
| order_settlements | platform `commission_rate%` / driver residual |
| settlementEngine | commission + insurance + other fees → franchisee_payout |
| franchisee_settlements | franchisee `commission_rate%` of gross; platform = remainder |
| fourLayer | multi-layer upstream + fleet + driver + tax |

Classification: **F SETTLEMENT_SPLIT_RATE** (multiple engines — DUPLICATED).

---

## 13. OWN_FLEET

| MODE | CUSTOMER REVENUE | DRIVER/CARRIER PAYABLE | COMMISSION | RATE SOURCE | RATE BASE | PROFIT | CURRENT IMPLEMENTATION | CONFLICT |
|------|------------------|------------------------|------------|-------------|-----------|--------|------------------------|----------|
| OWN_FLEET | total_fee | cost_amount from route rates; or cashFlow % | often drivers.commission_rate (ambiguous) | ROUTE_RATE / DRIVER_PROFILE | total_fee or trip | profit_amount = fee−cost | Partial | Collision on drivers.commission_rate |

## 14. FRANCHISE

| MODE | CUSTOMER REVENUE | PAYABLE | COMMISSION | RATE SOURCE | RATE BASE | PROFIT | IMPLEMENTATION | CONFLICT |
|------|------------------|---------|------------|-------------|-----------|--------|----------------|----------|
| FRANCHISE | gross_revenue / total_fee | franchisee net_payout; driver via fleetOwner ratios | franchisees 70% + platform 10% | FLEET_CONTRACT | gross | V1 order profit separate | fleetOwner + franchisees settle | Naming vs fusingao “commission” |

## 15. OUTSOURCED

| MODE | CUSTOMER REVENUE | PAYABLE | COMMISSION | RATE SOURCE | RATE BASE | PROFIT | IMPLEMENTATION | CONFLICT |
|------|------------------|---------|------------|-------------|-----------|--------|----------------|----------|
| OUTSOURCED / Fusingao | shopee/trip income | fleet_payout / rate_override | fusingao_fleets 15%; upstream 5–7% | FLEET + UPSTREAM | income / trip rate | V1 if total_fee set; often separate PnL | fusingao.ts + fourLayer | Dual 15% meanings |

UNKNOWN where mode flag not explicit on order.

---

## 16. Financials 15%

| Item | Finding |
|------|---------|
| Writer | `auto_create_financials` on delivered |
| Formula | `platform_profit = total_fee * 0.15` (literal) |
| Reads commission_rate? | **No** |
| True meaning | **historical approximation** shaped like platform take; UI says 淨利 |
| Readers | FinancialsDashboard, monthly Excel |
| Classification | **DEPRECATE CANDIDATE** as profit; **RENAME CANDIDATE** → `legacy_platform_fee_estimate`; **REPAIR CANDIDATE** under BACKLOG #2 |
| KEEP? | Only if frozen as legacy shadow column |

## 17. Reports 70%

| Item | Finding |
|------|---------|
| Formula | `driver_cost = total_fee * COALESCE(commission_rate, 70) / 100` |
| Meaning in code | Treats rate as **driver cost share**; null → **70% of revenue is driver cost** |
| Business source in repo | **None** |
| Tag | **UNVERIFIED_DEFAULT** — not policy |
| Conflict | vs cashFlow silent **15** on same field |

## 18. Gross Profit Isolation

| Check | Result |
|-------|--------|
| `profit_amount = total_fee - cost_amount` | Confirmed in `orders.ts` / `orderFinanceColumns.ts` @ `281e873` |
| Reads commission / commission_rate / 15% / 70% / 80%? | **NO** for profit line |
| fleet_payout uses fusingao commission in same trigger? | YES — **separate column** |
| **PASS — Gross Profit independent from Commission** | **YES** |
| **P0 CROSS-CONTAMINATION** | **NO** |

## 19. P0 Risks

1. **SEMANTIC COLLISION** on `drivers.commission_rate` (driver vs platform vs report cost).  
2. Financials ×15% still shown as 平台淨利 while V1 gross profit lives elsewhere → dual truth for managers.  
3. Repairing “commission” without locking party meaning will break either cashFlow or receipts.

## 20. P1 Risks

1. franchisees vs fusingao same field name, opposite residual party.  
2. Multiple settlement engines (order_settlements / franchisee / fourLayer / fusingao).  
3. settlementExport hardcoded 15% 佣金/人事.  
4. Silent defaults 15/70/10/0 inconsistent.  
5. calcOrderFinance unused but still documents default 15 for fleet_payout.

## 21. Recommended Canonical Names

| Concept | Suggested name |
|---------|----------------|
| Platform fee % | `platform_fee_pct` |
| Platform fee $ | `platform_fee_amount` |
| Driver share % of fee | `driver_share_pct` |
| Franchisee share % | `franchisee_share_pct` |
| Upstream cut % | `upstream_commission_pct` |
| Trip pay NT$ | `driver_pay_rate` / `trip_cost` (keep; not commission) |
| Legacy fee×15% | `legacy_platform_fee_estimate` |

## 22. Recommended SSoT Candidates

1. **Platform fee on order:** `order_settlements.commission_*` (after rename)  
2. **Fusingao fleet cut:** `fusingao_fleets.commission_rate`  
3. **Franchisee share:** `franchisees.commission_rate` + `platform_commission_rate`  
4. **Trip cost:** `route_prefix_rates` → `orders.cost_amount`  
5. **Do not** use `drivers.commission_rate` as SSoT until meaning locked / column split  

## 23. REPAIR / MODIFY / KEEP / DEPRECATE Candidates

| Item | Candidate |
|------|-----------|
| drivers.commission_rate collision | **REPAIR** (split or lock meaning) — first #3 repair |
| financials ×15% as profit | **DEPRECATE** / **RENAME** |
| reports COALESCE 70 | **MODIFY** remove or require explicit rate; **UNVERIFIED_DEFAULT** |
| settlementExport ×15% | **MODIFY** or DEPRECATE |
| order_settlements platform fee | **KEEP** then **RENAME** |
| fusingao / franchisee rates | **KEEP** (document party) |
| driver_pay_rate / cost_amount | **KEEP** (not commission) |
| Gross Profit V1 | **KEEP** — do not reintroduce commission |

## 24. Recommended smallest next repair

**Do not code yet — business lock first:**

> Decide one sentence:  
> `drivers.commission_rate` means **(A) driver share of total_fee** XOR **(B) platform fee share of amount**.

Then smallest engineering slice:

1. Document lock in BACKLOG / rule.  
2. Fix the **losing** call site (likely `receipts.ts` if A wins, or `cashFlow`+`reports` if B wins) to use the other concept’s field or inverted formula.  
3. Align silent defaults (ban dual 15 vs 70).  
4. Characterization tests for both parties’ formulas.  
5. Leave financials ×15% for a separate deprecate/rename PR.

---

*End of READ-ONLY audit.*
