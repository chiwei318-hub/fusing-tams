# PERCENTAGE INVENTORY — READ-ONLY

Date: 2026-09-06  
Rule: Do not assume 15%=commission or 5%=VAT without call-chain evidence.

---

## High-signal rates

| VALUE | BUSINESS MEANING | FILE | FUNCTION / SITE | DB FIELD | APPLIES TO | RATE BASE | SOURCE | HARDCODED? | CONFIGURABLE? | USED? | READER | RISK |
|-------|------------------|------|-----------------|----------|------------|-----------|--------|------------|---------------|-------|--------|------|
| **5%** | VAT exclusive | `lib/taxEngine.ts` | `calcExclusiveVat` | — | net freight | `total_fee` (net) | code const `DEFAULT_VAT_RATE` | Y | via opts only | Y | invoice/billing/orders | Low if always exclusive |
| **5%** | VAT exclusive | `orders.ts` | `calc_order_finance` SQL | `orders.vat_amount` | order | `NEW.total_fee` | SQL `0.05` | Y | N | Y | orders | Low |
| **5%** | VAT exclusive | `orderFinanceColumns.ts` | `calcOrderFinance` | vat_amount | order | total_fee | taxEngine | Y | N | Y | routes | Medium: also subtracts VAT from profit |
| **5%** | VAT exclusive | `monthlyBilling.ts` | generate / invoice | invoices | bill | SUM(total_fee) | `*0.05` / taxEngine | Y | N | Y | monthly PDF | Low |
| **5%** | VAT exclusive | `autoInvoice.ts` | issue path | invoices.tax_amount | order | rawAmount | `taxRate=5` | Y | N | Y | LINE/email | Low |
| **5%** | VAT exclusive | `taxPayroll.ts` | ledger live/vat/close | platform_ledger.vat_output | delivered revenue | SUM(total_fee) | `*0.05` | Y | N | Y | tax UI | Low |
| **5%** | VAT on profit estimate | `fusingao.ts` | estimatedTax | — | grossProfit | grossProfit | `*0.05` | Y | N | Y | fusingao report | Medium: different base |
| **5%** | Fusingao premium commission tier | `fourLayerSettlement.ts` | Layer1 | — | shopee trip ≥ threshold | trip amount | `FUSINGAO_RATE_PREMIUM=0.05` | Y | N | Y | settlement | **Not VAT** |
| **7%** | Fusingao normal commission | `fourLayerSettlement.ts` | Layer1 | — | shopee trip | trip | `FUSINGAO_RATE_NORMAL=0.07` | Y | N | Y | settlement | **Not VAT** |
| **7%** | Import default | `fusingaoBillingDetailImport.ts` / `importXiaoYangFleet.ts` | summary/import | commission_rate | fleet billing | pretax | default 7 | Y | row override | Y | billing import | Medium |
| **10%** | 執行業務所得扣繳 | `taxPayroll.ts` | `WITHHOLDING_RATE` | driver_payroll.withholding_tax | driver gross > 20010 | gross pay | const 0.10 | Y | N | Y | tax payroll | Policy rate — version later |
| **10%** | 車隊扣繳（無統編） | `taxPayroll.ts` | `calcFleetTax` | fleet_payables | fleet payable | gross | 0.10 | Y | N | Y | tax | Policy |
| **10%** | Franchise platform fee default | `fleetOwner.ts` | salary calc | platform_commission_rate | fleet | gross | default **10** | Y default | Y (DB) | Y | fleet salary | Medium |
| **1.9%** | 車隊扣繳（有統編） | `taxPayroll.ts` | `calcFleetTax` | — | fleet | gross | 0.019 | Y | N | Y | tax | Policy |
| **2.11%** | 二代健保補充保費 | `taxPayroll.ts` / `fourLayerSettlement.ts` | NHI_RATE | nhi_supplement | pay > 24000 | gross | 0.0211 | Y | N | Y | tax/settlement | Policy — must version |
| **15%** | LEGACY platform profit approx | `financials.ts` | `auto_create_financials` | order_financials.platform_profit | delivered order | total_fee | `*0.15` | Y | N | Y | FinancialsDashboard / Excel | **HIGH — mislabeled as profit** |
| **15%** | Same trigger sets margin label | `financials.ts` | auto_create | profit_margin_pct | — | fixed 15 | literal | Y | N | Y | dashboard | HIGH |
| **15%** | Default commission_rate | `schema/settlements.ts` | column default | order_settlements.commission_rate | settlement | total_amount | default "15" | Y | per-row | Y | generated commission_amount | Medium |
| **15%** | settlementEngine example / params | `settlementEngine.ts` | `calculateSettlement` | — | franchisee payout | totalFreight | param (often 15) | caller | Y | Y | franchise settle | OK if labeled commission |
| **15%** | Driver commission default | `drivers.ts` / `cashFlow.ts` / `smartOrder.ts` / `receipts.ts` | COALESCE(...,15) | drivers.commission_rate | driver payout calc | total_fee | DB or 15 | Y default | Y | Y | cashFlow, reports | **HIGH — rate meaning ambiguous** |
| **15%** | Platform take on OCR receipt | `receipts.ts` | OCR commission | — | receipt amount | amount | `platformRate=0.15` | Y | overridden by driver rate | Y | receipts UI | Medium |
| **15%** | costAnalysis labor | `costAnalysis.ts` | `labor_pct:0.15` | — | cost model | revenue | const | Y | N | Y | cost analysis API | Model assumption |
| **15%** | Quote profit_margin default | `smartQuote.ts` / PartnerManagement | partner.profit_margin | partners | quote markup | base quote | default 15 | Y | Y | Y | quote UI | **Pricing margin ≠ ops profit** |
| **15%** | Freight quote profit_margin | `freightQuote.ts` / FreightQuoteTab | settings | — | quote | total_quote | 0.15 default | Y | settings | Y | quote | Pricing |
| **80%** | AP / driver cost proxy | `financials.ts` auto_create + calcFinancials fallback；`arApLedger.ts` | ap_total / ap_driver | order_financials | delivered | total_fee | `*0.80` | Y | N | Y | financials / ArApDashboard | **HIGH — not real AP** |
| **85%** | Implied driver share | `receipts.ts` comment | platform 15% → driver 85% | — | receipt | amount | inverse of 15 | Y | N | Y | receipts | Tied to 15% platform |
| **70%** | Franchisee / driver ratio default | `fleetOwner.ts` / `franchisees.ts` / `reports.ts` gross-margin | commission_rate | franchisees/drivers | payout | revenue | default 70 | Y default | Y | Y | fleet salary, reports | Medium — **different meaning than 15%** |
| **20%** | 營所稅粗估 | `taxPayroll.ts` | ledger close | income_tax_payable | netProfit | `*0.20` | Y | N | Y | tax | Rough estimate |
| **5%** | costAnalysis overhead | `costAnalysis.ts` | `overhead_pct:0.05` | — | cost model | revenue | const | Y | N | Y | cost API | **Not VAT** |

---

## Semantic clusters（勿混用）

| Cluster | Typical % | Meaning |
|---------|-----------|---------|
| VAT | 5 | 未稅外加營業稅 |
| Platform service fee / commission | 15 (often) | 平台抽成 — **not gross profit** |
| Driver / franchisee share | 70–85 / 15 | 誰拿運費比例 — **commission_rate 欄位語意分裂** |
| AP proxy | 80 | 應付粗估 |
| Fusingao shopee cut | 5 / 7 | 上游抽成 |
| Withholding / NHI | 10 / 1.9 / 2.11 | 稅務法定近似 |
| Pricing profit_margin | 15 | 報價加價 — 與營運毛利無關 |
| Cost model | 5 overhead / 15 labor | 分析假設 |

---

## Call-chain notes

1. **`financials.ts` ×15%** → writes `order_financials.platform_profit` → read by FinancialsDashboard / monthly Excel. Parallel JS recalculate uses AR−AP, not ×15%.  
2. **`cashFlow.ts` × commission_rate default 15** → treats rate as **driver** payout share of `total_fee`.  
3. **`receipts.ts` 0.15** → treats as **platform** share. Same number, **opposite party**.  
4. **`reports/gross-margin` default commission 70** → driver_cost = revenue×70%. Third interpretation of “commission”.  
5. **`fourLayer` 5%/7%** → Fusingao upstream — unrelated to VAT 5%.

---

## Inventory completeness

This inventory focuses on `artifacts/api-server/src` financial paths + key FE consumers. Decorative KPI copy in `platformRequirements.ts` (e.g. “空駛率 ↓15%”) omitted as non-financial rates.

---

## Supplement — MONEY REPAIR #3 Commission SSoT (2026-09-06, READ-ONLY)

Full write-up: [`COMMISSION-SSOT-AUDIT.md`](./COMMISSION-SSOT-AUDIT.md). Evidence-only additions below (no production change).

### Rate base (must answer “% × WHAT”)

| % / field | × base | Party meaning |
|-----------|--------|---------------|
| cashFlow `COALESCE(commission_rate,15)` | **orders.total_fee** | **Driver** share |
| receipts `(rate\|\|15)` | **OCR amount** | **Platform** share |
| reports gross-margin `COALESCE(...,70)` | **orders.total_fee** | **Driver cost** share (**UNVERIFIED_DEFAULT**) |
| order_settlements `commission_rate` default 15 | **total_amount** | Platform service fee |
| franchisees `commission_rate` default 70 | **gross_revenue** | Franchisee share |
| franchisees `platform_commission_rate` default 10 | **salary gross** | Platform fee |
| fusingao_fleets `commission_rate` default 15 | **income / rate_per_trip** | Platform cut of fleet channel |
| financials `platform_profit` | **total_fee × 0.15** | LEGACY estimate (not reading commission_rate) |
| fourLayer / fusingao_commission 5–7% | **trip / pretax** | Upstream |
| driver_pay_rate / rate_per_trip | **per trip NT$** | **Driver Pay — not commission** |

### Silent defaults (SILENT_DEFAULT)

| Pattern | File | Effect |
|---------|------|--------|
| `COALESCE(..., 15)` | cashFlow | null → driver 15% of total_fee |
| `\|\| 15` | receipts | null → platform 15% of amount |
| `COALESCE(..., 70)` | reports gross-margin | null → driver cost 70% of total_fee |
| `COALESCE(..., 0)` | reports driver-commission | null → $0 commission |
| schema defaults 15/70/10/7 | drizzle | insert-time defaults |

### Semantic collision (P0)

`drivers.commission_rate` alone drives **opposite parties** in cashFlow vs receipts, and a **third** cost interpretation + **70** silent default in reports. Tag: **SEMANTIC COLLISION**. Same digit 15% across financials / settlements / fusingao ≠ same business concept.

### Gross Profit isolation (@281e873)

`orders.profit_amount = total_fee − cost_amount` does **not** read commission / commission_rate / 15% / 70% / 80%.  
**PASS — Gross Profit independent from Commission.**  
Same trigger may set `fleet_payout` from fusingao commission — separate column, not GP contamination.

---

## Supplement — MONEY #3B Report 70% Cost (2026-09-06, READ-ONLY)

Full write-up: [`REPORT-70-COST-SSOT-AUDIT.md`](./REPORT-70-COST-SSOT-AUDIT.md).

| Item | Evidence |
|------|----------|
| Location | `reports.ts` `GET /reports/gross-margin` only (money path) |
| Formula | `driver_cost = SUM(total_fee × COALESCE(d.commission_rate, 70) / 100)` |
| Base | **orders.total_fee** |
| Source | **HARDCODED SILENT_DEFAULT** — **UNVERIFIED_DEFAULT** (no contract/policy) |
| Classification | **SILENT_DEFAULT** / **ESTIMATED** — not actual cost |
| Canonical cost | `orders.cost_amount` — **not read** by this report |
| UI | `FinanceReportsTab` GrossMarginPanel — **ACTIVE** |
| DB write of 70% result | **NO** (read-time only) → historical DB contamination from fallback: **NO** |
| vs drivers.commission_rate | **Misuse**: field is DRIVER_SETTLEMENT_RATE (`40f0a62`); report treats as cost % |
| vs cashFlow silent 15 | Same field, different silent default (**15** vs **70**) |
| Shadow fee=10000 cost=800 rate=null | Actual cost 800; report cost **7000**; canonical GP **9200**; report GP **3000** |
| financials ×15 / AP ×80 | Code **ISOLATED** from R70; coexistence = **MULTIPLE_FINANCIAL_TRUTH** |
| Note | receipts platform misuse fixed in `40f0a62`; **#3B REPAIR**: gross-margin now uses `cost_amount`/`profit_amount`; `COALESCE(...,70)` **removed** (see REPORT-70-COST-REPAIR.md) |

---

## Supplement — MONEY #2d Cost Zero vs Unknown (2026-09-06, READ-ONLY)

Full write-up: [`COST-ZERO-SSOT-AUDIT.md`](./COST-ZERO-SSOT-AUDIT.md).

| Item | Evidence |
|------|----------|
| Writer formula | `COALESCE(NULLIF(driver_pay_rate,0), rate_per_trip, 0)` in `calc_order_finance` |
| Missing prefix/rate | **cost_amount → 0** (not NULL) |
| Schema | `DEFAULT 0` |
| fee=10000 unknown cost | **profit_amount=10000** → FALSE_HIGH_GROSS_PROFIT |
| Report (`ae9ddda`) | `cost_amount=0` is **known** → **POTENTIAL_FALSE_KNOWN** |
| Distinguish 0 meanings today | **NO** |
| Production change this audit | **0** |
