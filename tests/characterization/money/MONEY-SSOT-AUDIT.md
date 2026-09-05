# FUSING-TAMS MONEY SSoT — READ-ONLY AUDIT

Date: 2026-09-06  
Mode: **READ-ONLY** — no production logic / schema / migration / DB writes  
Policy locked: `total_fee` = 未稅；`gross_profit ≠ commission`；VAT 不進 gross_profit；`×15%` = LEGACY_HARDCODED_APPROXIMATION  

### CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| Modified production business logic | **0** |
| DB schema changes | **0** |
| Migration | **NO** |
| Production DB writes | **0** |

---

## A. Money 逐項稽核表（Step 1）

### A1. Customer Freight (`total_fee`)

| Field | Value |
|-------|--------|
| Business Meaning | 客戶未稅運費（net）— LOCKED `cbe037a` |
| DB Table / Field | `orders.total_fee` |
| Data Type | `real`（Drizzle）/ 營運中亦見 numeric 混用 |
| Writer | orders PATCH/PUT、enterprise 建單、approvals 議價/折讓、fusingao 匯入、smartOrder 付款後寫入、QuickOrder/Admin UI |
| Reader | 幾乎所有報表、派車、財務、司機/企業 UI |
| API | `PATCH /orders/:id`, enterprise monthly, financials, cashFlow, reports, … |
| UI | Admin / Enterprise / Driver / Fleet / Fusingao |
| Current Formula | 人工或報價寫入；**不是**計算欄 |
| Rate Source | N/A |
| Hard-coded? | No |
| Trigger? | 變更觸發 `calc_order_finance` |
| Runtime DDL? | No（schema 既有） |
| Report / Settlement Dependency | High — 幾乎所有金流入口 |
| SSoT Candidate | **YES** — 訂單層唯一客戶運費 SSoT |
| Duplicate Source | `suggested_price` / `base_price` / `quote_amount` 常當 fallback |
| Conflict | UI 未必標「未稅」；歷史資料可能曾按含稅輸入（UNKNOWN without prod RO） |
| Risk | High if operators enter 含稅 |
| Classification | **KEEP**（語意已鎖）；UI 標註 → **MODIFY** |

### A2. VAT (`tax_amount` / `vat_amount`)

| Field | Value |
|-------|--------|
| Business Meaning | 銷項營業稅 5%（未稅外加） |
| DB | `orders.vat_amount`；`invoices.tax_amount`；月結開票路徑即時算 |
| Type | `NUMERIC(10,2)` / invoice numeric |
| Writer | `calc_order_finance` trigger；`calcOrderFinance`；`autoInvoice`；`monthlyBilling`；`invoices` POST |
| Reader | 訂單欄位；發票 PDF/email；taxPayroll 試算用 `SUM(total_fee)*0.05`（不讀 vat_amount） |
| Formula | `taxEngine` / `ROUND(net*0.05)` — exclusive |
| Hard-coded rate | **5%** in taxEngine + many call sites |
| Trigger? | Yes (`calc_order_finance`) |
| Runtime DDL? | `ensureOrderFinanceColumns` ADD COLUMN IF NOT EXISTS |
| SSoT Candidate | **tax_engine**（已存在，呼叫覆蓋未完全） |
| Conflict | `orderFinanceColumns` 仍把 vat 扣進 `profit_amount`（違政策 #4） |
| Risk | Medium — 歷史 vat 可能仍為 inclusive（見 MATERIALITY 空庫） |
| Classification | **KEEP** formula；profit 扣 VAT → **REPAIR** |

### A3. Customer Gross Receivable（含稅應收）

| Field | Value |
|-------|--------|
| Business Meaning | 客戶應付含稅 = net × 1.05 |
| DB | `order_financials.ar_grand_total`；`invoices.total_amount`；`monthly_bills.total_amount` |
| Writer | `auto_create_financials`：`total_fee * 1.05`；`calcFinancials`：`ar + ar_tax`；invoice paths |
| Formula | **合法** `×1.05`（含稅應收），非語意衝突 |
| Classification | **KEEP**（明確標記為 grand / incl-tax）；欄位命名建議後續 `total_incl_tax` → **MODIFY**（命名） |

### A4. Driver Pay (`driver_payable`)

| Field | Value |
|-------|--------|
| Business Meaning | 應付司機 |
| DB | `orders.driver_pay`；`orders.cost_amount`（trigger 自 route rate）；`order_settlements.driver_payout`；`driver_payroll`；`fleet_trips.driver_payout` |
| Writer | 多路徑：route_prefix `driver_pay_rate`、settlement generated、fleetOwner 薪資、taxPayroll |
| Formula（多套） | (a) fixed trip rate；(b) `total_fee × commission_rate%`（cashFlow，預設 15% 當司機抽成）；(c) settlement `(100-rate)%`；(d) receipts 平台 15%／司機 85% |
| Hard-coded? | Defaults 15 / 70 / 85 散落 |
| Conflict | **`commission_rate` 語意分裂**：有時=司機抽成%、有時=平台服務費% |
| Classification | **REPAIR**（統一 driver payable SSoT） |

### A5. Carrier Pay (`carrier_payable` / fleet)

| Field | Value |
|-------|--------|
| Business Meaning | 應付車隊／加盟／外包 |
| DB | `orders.fleet_payout`；`franchise_settlements.commission_amount`；fourLayer 表；`fleet_payables` |
| Writer | trigger fleet_payout；franchisees settle；fourLayerSettlement；fleetOwner |
| Formula | `rate × (1 - fleet.commission%)`；加盟 `gross × franchisee.commission_rate`（常 70）；四層福興高抽成 7%/5% |
| Classification | **KEEP** structure；**REFACTOR** 進 profit/settlement engine |

### A6. Commission

| Field | Value |
|-------|--------|
| Business Meaning | 平台服務費／抽成 — **≠ gross_profit**（LOCKED） |
| DB | `order_settlements.commission_rate` default **15**；`commission_amount` GENERATED；`drivers.commission_rate`；`franchisees.commission_rate`；`fusingao_fleets.commission_rate` |
| Writer | settlement trigger/engine；admin commission PATCH；import scripts |
| Formula | `total × rate/100`（settlementEngine） |
| Hard-coded default | **15** widely |
| Conflict | financials trigger `platform_profit = total×0.15` **誤當毛利** |
| Classification | **KEEP** as commission concept；financials misuse → **REPAIR** |

### A7. Direct Cost

| Item | Source | Tracked? | Classification |
|------|--------|----------|----------------|
| Driver trip cost | `route_prefix_rates.driver_pay_rate` / `cost_amount` | PARTIAL | KEEP |
| Tailgate / hydraulic | financials / arApLedger +500 / +800 | Hard-coded fees | MODIFY→config |
| Fuel / toll / misc | fourLayer / monthlyPnl imports | PARTIAL / NOT_TRACKED | KEEP + UNKNOWN |
| Vehicle fixed cost | vehicleCosts / costAnalysis % | PARTIAL | KEEP |
| Missing cost types | — | **NOT_TRACKED** | ADD when data exists；**禁止假填** |

### A8. Invoice

| Field | Value |
|-------|--------|
| DB | `invoices`（runtime CREATE 多處） |
| Writer | autoInvoice、monthlyBilling、invoices router、ECPay webhook |
| Formula | exclusive VAT on net |
| Dependency | fee_status、LINE/email |
| Classification | **KEEP** |

### A9. Payment

| Field | Value |
|-------|--------|
| DB | `orders.fee_status`；payments table；ar_ledger |
| Writer | smartOrder、ECPay、arLedger payment |
| Classification | **KEEP**；SSoT for 「已收」仍 **PARTIAL** |

### A10. AR

| Field | Value |
|-------|--------|
| DB | `order_financials.ar_*`；`ar_ledger`；`ar_ap_ledger` |
| Writer | financials trigger/JS；arApLedger；invoices allowance |
| Formula | AR base = total_fee；tax exclusive add in JS path |
| Conflict | trigger vs JS recalculate paths |
| Classification | **REFACTOR** toward single AR writer |

### A11. AP

| Field | Value |
|-------|--------|
| DB | `order_financials.ap_*`；settlements driver_payout |
| Writer | auto_create: `total×0.80`；calcFinancials: settlement or `×0.80` fallback；arApLedger same |
| Hard-coded | **80%** as AP proxy |
| Classification | **REPAIR**（用真實 driver/carrier payable 取代 80%） |

### A12. Settlement

| Field | Value |
|-------|--------|
| DB | `order_settlements`；franchise settlements；fourLayer；fleet salary |
| Writer | settlementEngine / triggers / franchisees / fourLayer |
| Multiple engines | **DUPLICATED** |
| Classification | **REFACTOR**（Strangler → settlement/profit engine） |

### A13. Gross Profit

| Field | Value |
|-------|--------|
| Policy (LOCKED) | `net_revenue − direct_transport − other_direct_variable`；**不扣 VAT**；**≠ commission** |
| Current implementations | |
| (1) `orders.profit_amount` | `total_fee − cost − **vat**` → **違政策 #4** |
| (2) `auto_create_financials` | `total × 0.15` → **LEGACY commission 冒充 profit** |
| (3) `calcFinancials` | `ar_total − ap_total`（較接近，但 AP 常為 ×80%） |
| (4) cashFlow | `rev − driver_payout − franchise`（driver 用 commission_rate） |
| (5) reports/gross-margin | driver_cost = total × commission（default **70%**） |
| (6) pnl.ts / fourLayer | route rate − driver rate；層級損益 |
| SSoT Candidate | **MISSING** formal profit_engine |
| Classification | **REPAIR**（#2 backlog） |

### A14. Gross Margin

| Field | Value |
|-------|--------|
| Formula | usually `profit / revenue * 100` with inconsistent profit defs |
| Hard-coded thresholds | UI 「≥15% 好」等 |
| Classification | **REPAIR** after profit SSoT |

---

## B. 百分比清單

見同行產出：[`PERCENTAGE-INVENTORY.md`](./PERCENTAGE-INVENTORY.md)

---

## C. `total_fee` 語意衝突清單（Step 3）

### P0 MONEY SEMANTIC CONFLICT — `/ 1.05` treating total_fee as 含稅

| Location | Finding |
|----------|---------|
| Production `artifacts/api-server/src` (excl. comment in taxEngine) | **No remaining `total_fee / 1.05`** after `cbe037a` |
| `tests/characterization/tax/materiality-probe.mjs` | Compares inclusive formula for **audit only** — not production writer |

**Status: P0 inclusive-reverse writers cleared.** Residual risk = historical stored `vat_amount` / operator input habit.

### `total_fee × 1.05` — 合法含稅應收（勿盲標錯）

| Location | Purpose | Verdict |
|----------|---------|---------|
| `financials.ts` auto_create `ar_grand_total = total_fee * 1.05` | 含稅應收 | **OK** if total_fee=net |
| `financials.ts` calcFinancials `ar + ar*0.05` | 含稅應收 | **OK** |
| `smartOrder` / pricing `withTax = round(suggested * 1.05)` | 報價含稅展示 | **OK** |
| `autoInvoice` / monthly generate | net+tax | **OK** |
| `fourLayerSettlement` Layer1 `×1.05` | 福興高→富詠入帳含稅 | **OK**（不同商業流；非 total_fee 語意） |

### Related policy breach（非 ÷1.05，但屬毛利定義）

| Location | Issue | Severity |
|----------|-------|----------|
| `orders.profit_amount` / `calcOrderFinance` | 毛利扣 VAT | **P0 vs locked #4** |
| `auto_create_financials` platform_profit | ×0.15 當毛利 | **P0 vs locked #5**（BACKLOG #2） |

---

## D. `financials.ts` ×15% 依賴盤點（Step 4）

### Who creates it?

| Path | When | Formula |
|------|------|---------|
| DB trigger `auto_create_financials` | `orders.status` → `delivered` | `platform_profit = total_fee * 0.15`；`ap_total = total_fee * 0.80`；`ar_grand = total_fee * 1.05`；`ON CONFLICT DO NOTHING` |
| `calcFinancials(orderId)` JS | `POST /financials/recalculate/:id`、bulk backfill | `platform_profit = ar − ap`（AP from settlement or ×80%）— **overwrites** row |

### Who reads?

| Consumer | How |
|----------|-----|
| `GET /api/financials` | lists `order_financials` |
| `GET /api/financials/monthly-report` | SUM platform_profit, margin |
| `GET /api/financials/export-excel` | Excel sheets AR/AP/profit |
| UI `FinancialsDashboard.tsx` | `/financials` — 平台淨利、利潤率 |
| **Not** primary path for autoInvoice / monthlyBilling invoices | Invoice uses order fees + tax_engine style exclusive |

### Historical dependency

- Trigger `ON CONFLICT DO NOTHING` → first delivered write **sticks** unless recalculate called  
- Rows created only by trigger keep **×15% / ×80%** forever  
- Recalculate replaces with AR−AP model (still not LOCKED gross_profit)

### If remove/replace ×15%

| Impact | Scope |
|--------|-------|
| Dashboard / Excel monthly financials | **Direct** |
| Trigger-created historical rows | Need migration policy（user decision） |
| Invoice / tax_engine paths | Low coupling |
| cashFlow / reports / settlements | Separate hardcodes — **not auto-fixed** by changing financials alone |

### Classification

`×15%` path: **DELETE CANDIDATE** as profit definition；**KEEP** only if re-labeled as `legacy_platform_fee_estimate` — business decision = BACKLOG **#2**.

---

## E. 建議下一個 MONEY REPAIR 候選（本輪不做）

優先序建議：

1. **BACKLOG #2 — Profit SSoT**  
   - 定義並實作 `gross_profit`（不扣 VAT、≠ commission）  
   - 停用或改名 `auto_create_financials` 的 ×15%／×80%  
   - 修正 `orders.profit_amount` 不再減 vat  

2. **Unify `commission_rate` semantics**（driver share vs platform fee）— 文件化 + 預設對齊  

3. **AP SSoT** — 用 `driver_pay_rate` / settlement payout 取代硬編 80%  

4. **Railway RO materiality (#1)** — 量化歷史 vat／×15% 影響金額  

5. Optional later: 唯讀「每小時貢獻毛利」報表（不驅動派車）

---

## F. Testability blockers

| Blocker | Detail |
|---------|--------|
| SQL triggers | `calc_order_finance`、`auto_create_financials` — 行為需 mirror 或 integration DB |
| Runtime DDL | `order_financials`、finance columns 在 boot CREATE — schema drift vs Drizzle |
| Multi-definition profit | Characterization can lock mirrors；「正確毛利」需業務 LOCK 後才能改鏡像預期 |
| `real` vs `numeric` | 精度不一致仍在；金額引擎應用 Decimal／numeric（已知，未本輪修） |
| Prod data | Local DB 無 invoices/monthly_bills — 正式曝險 **UNKNOWN** until #1 |

---

## Summary

| Area | Status |
|------|--------|
| VAT exclusive on new writes | FIXED (`cbe037a`) |
| total_fee = net | LOCKED |
| Gross profit SSoT | **MISSING / BROKEN**（多定義 + 扣 VAT + ×15%） |
| Commission SSoT | PARTIAL（settlementEngine 清晰；與 profit 混淆） |
| Next gate | BACKLOG **#2** business formula before AI/dispatch optimization |
