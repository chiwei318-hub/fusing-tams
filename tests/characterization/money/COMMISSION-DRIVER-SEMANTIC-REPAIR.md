# COMMISSION DRIVER SEMANTIC REPAIR (#3A)

Date: 2026-09-06  
Baseline: Gross Profit `281e873`  
Audit: `COMMISSION-SSOT-AUDIT.md`  
Mode: Minimal REPAIR — no DB rename / migration / historical rewrite  
Commit: pending (approved for commit)

---

## OCR AUTO-POSTING BEHAVIOR CHANGE

### Previous behavior

OCR receipt flow 會使用：

`drivers.commission_rate`

作為 platform commission rate，

並依此產生／寫入正式對帳資料。

### Evidence of semantic error

CashFlow 實證確認：

`drivers.commission_rate = DRIVER_SHARE_RATE`

例如：

```
total_fee = 10000
commission_rate = 15

driver_payout = 1500
platform_net = 8500
```

因此：

`drivers.commission_rate`

不能再作為：

`PLATFORM_COMMISSION_RATE`

使用。

### Why auto-posting is disabled

目前 repo 中尚未找到可信的：

`PLATFORM_COMMISSION_RATE SSoT`

因此 OCR flow 無法正確計算正式 platform fee。

若繼續 auto-post，只能：

1. 繼續錯用 driver rate
2. hardcode/default 15%
3. 猜測不存在的 platform rate

三者皆禁止。

所以在正式 Platform Rate SSoT 建立以前：

OCR 可以繼續解析／預覽資料，

但不得自動產生需要 Platform Commission 的正式對帳寫入。

### Impact scope

**Affected:**

* OCR receipt automatic posting / reconciliation path that requires platform commission

**Not affected:**

* OCR recognition itself（現有流程仍可正常解析）
* manual receipt viewing（若不依賴該 rate）
* cashFlow driver payout
* `drivers.commission_rate` physical field / driver settlement semantic
* Gross Profit
* Driver Pay route rate
* Pricing
* reports 70%
* financials ×15%

**Historical records:**

* 不 bulk rewrite
* 不 backfill
* 過去可能由錯誤 platform-rate semantic 產生的既有資料保留
* 後續另案 audit / remediation

**Restore condition:**

只有找到並確認正式：

`PLATFORM_COMMISSION_RATE SSoT`

後，才能重新啟用需要 platform fee 的 OCR auto-posting。

---

## A. CashFlow rate direction evidence

Source: `artifacts/api-server/src/routes/cashFlow.ts`

```sql
driver_payout = ROUND(total_fee * COALESCE(d.commission_rate, 15) / 100)
platform_net  = ROUND(total_fee - (total_fee * COALESCE(d.commission_rate, 15) / 100))
```

Characterization case: `total_fee = 10000`, `commission_rate = 15`

| Q | Answer |
|---|--------|
| **A. driver receives** | **1500** |
| **B. company/platform retains** | **8500** |
| **C. 15% 代表誰的 share？** | **DRIVER** |
| **D. 乘 rate 還是 (1−rate)？** | **× rate** (`MULTIPLY_RATE`) |
| **E. 最終欄位名稱** | `driver_payout`, `platform_net`（另別名 `driver_commission_rate`） |

**RATE_DIRECTION_CONFLICT:** **NO**

---

## B. Canonical meaning

| Locked | Value |
|--------|-------|
| Physical field | `drivers.commission_rate` (legacy name kept) |
| Business semantic | **DRIVER_SETTLEMENT_RATE** |
| Rate direction alias | **DRIVER_SHARE_RATE** (same as cashFlow: rate% × base = driver money) |
| Not | PLATFORM_COMMISSION_RATE / CUSTOMER_COMMISSION_RATE / REPORT_COST_RATE / GROSS_MARGIN_RATE / GROSS_PROFIT_RATE |

---

## C. Receipts old meaning

| Item | Old behavior |
|------|----------------|
| Hardcoded | `platformRate = 0.15` |
| Driver lookup | `actualPlatformRate = (commission_rate \|\| 15) / 100` |
| Formula | `platformFee = amount × rate`; `driverEarning = amount × (1 − rate)` |
| Party | Treated `drivers.commission_rate` as **PLATFORM** share |
| Example amount=10000 rate=15 | platformFee=**1500**, driverEarning=**8500** （與 cashFlow **相反**） |

Tag: **SEMANTIC COLLISION** / **INVALID_SEMANTIC_DEFAULT**

---

## D. Receipts required meaning

OCR 真正要寫入 AR 的是「平台抽成」金額（`platform_commission` ledger type），但 **OCR 路徑沒有正式 Platform Commission rate SSoT**。

本輪需求：

1. 不得再用 `drivers.commission_rate` 當平台抽成  
2. 若有司機結算率 → 可算 **司機應收**（DRIVER_SETTLEMENT_RATE，方向同 cashFlow）  
3. 平台抽成 → **NULL / PLATFORM_RATE_SSoT_MISSING**（禁止偷偷 default 15）

---

## E. Correct platform rate source

Search order result:

| Candidate | Verdict for OCR receipts |
|-----------|--------------------------|
| Dedicated platform rate on drivers | **MISSING** |
| Customer/platform/fleet contract on OCR path | **NOT WIRED** |
| Settlement config `default_commission_rate`（franchise「系統服務費率」） | Exists elsewhere; **not proven** as OCR receipt SSoT — **not adopted** (would invent business link) |
| System hardcoded 15% | Was present; **INVALID_SEMANTIC_DEFAULT** — **removed** |
| Formal OCR platform rate | **PLATFORM_RATE_SSoT_MISSING** |

---

## F. Silent default findings

| Location | Pattern | Tag | #3A action |
|----------|---------|-----|------------|
| receipts (old) | `platformRate=0.15` | INVALID_SEMANTIC_DEFAULT | **Removed** |
| receipts (old) | `\|\| 15` as platform | INVALID_SEMANTIC_DEFAULT | **Removed** |
| cashFlow | `COALESCE(..., 15)` driver side | SILENT_DEFAULT | **Kept** (out of scope; direction correct) |
| reports | `COALESCE(..., 70)` | UNVERIFIED_DEFAULT | **#3B** — untouched |

---

## G. Production changes

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/receipts.ts` | OCR: driver rate → driver earning; platformFee/Rate = null + status; confirm-settlement 400 if fees null |
| `artifacts/logistics/src/pages/admin/OcrReceiptDialog.tsx` | Null-safe UI; labels 司機結算率 / 平台抽成不可用; disable confirm when platformFee null |

**Production modified files: 2** (budget ≤3)

**Not changed:** cashFlow, reports, financials, orders profit, route rates, DB schema.

---

## H. Before / after example

`amount = 10000`, `drivers.commission_rate = 15`, driver matched:

| Field | BEFORE (wrong) | AFTER (#3A) |
|-------|----------------|-------------|
| Interpretation of 15% | Platform share | **Driver settlement share** |
| driverEarning | 8500 | **1500** |
| platformFee | 1500 | **null** |
| platformRate | 15 | **null** |
| platformRateStatus | — | **PLATFORM_RATE_SSoT_MISSING** |
| companyRetainAmount | — | **8500** (residual info; not configured platform %) |
| Auto confirm AR write | enabled | **disabled** until platform SSoT |

No driver / null rate: no invented 15%; platform + driver amounts unavailable.

---

## I. Tests

Added:

- `tests/characterization/money/commission-driver-semantic.test.mjs`
- helpers in `formulas.mjs` (`cashFlowDriverSettlement`, `receiptsOcrSettlementCalc`, …)

Covers: rate direction A–E, canonical driver semantic, receipts isolation, missing platform behavior, no silent 15, GP / Driver Pay / reports70 / financials15 unchanged (source + formula).

---

## J. Regression

```
node --test tests/characterization/money/*.test.mjs tests/characterization/status/*.test.mjs tests/characterization/tax/*.test.mjs
→ tests 50, pass 50, fail 0
```

(Prior suite ~38 + new #3A cases.)

---

## K. Reports 70 dependency

`reports.ts` still: `COALESCE(d.commission_rate, 70)` as driver_cost share.  
**Untouched.** Backlog: **MONEY REPAIR #3B REPORT DRIVER COST RATE**.

---

## L. Financials 15 dependency

`order_financials.platform_profit = total_fee × 0.15`  
**Untouched.** Remains **LEGACY_HARDCODED_APPROXIMATION**. Backlog: **#3C**.

---

## M. Historical data impact / N. Historical data impact

| Item | Impact |
|------|--------|
| DB columns | **UNCHANGED** |
| Past OCR AR / driver_earnings rows | **Not rewritten** (may have been written under inverted semantic) |
| Future OCR auto-confirm | Blocked until platform rate SSoT |
| Manual/API confirm with explicit fees | Still allowed if client sends non-null fees |

---

## N. Remaining semantic collisions

1. **reports** still uses `drivers.commission_rate` as cost % + silent 70 → #3B  
2. **franchisees/fusingao** same English name, different party → document only  
3. **financials ×15%** mislabeled profit → #3C  
4. Historical OCR settlements may be inverted vs cashFlow — audit later, no bulk rewrite this round  

---

## O. Next smallest repair

**#3B** — reports gross-margin: stop treating driver settlement rate as unverified 70% cost ratio (or require explicit rate; remove SILENT 70).  
Do **not** invent platform OCR rate until product names a real SSoT (settlement config vs contract).

---

## Final checklist

```
drivers.commission_rate canonical semantic:
  DRIVER_SETTLEMENT_RATE (= DRIVER_SHARE_RATE; × rate → driver money)

Rate direction:
  MULTIPLY_RATE — total_fee=10000, rate=15 → driver 1500 / platform retain 8500
  RATE_DIRECTION_CONFLICT: NO

Receipts still uses drivers.commission_rate as platform rate:
  NO

Production business logic modified:
  YES (receipts OCR + confirm guard; OCR UI display/disable only)

DB schema:
  UNCHANGED

Migration:
  NO

Historical rewrite:
  NO

Gross Profit:
  UNCHANGED

Driver Pay:
  UNCHANGED

Pricing:
  UNCHANGED

financials ×15:
  UNCHANGED

reports ×70:
  UNCHANGED
```

*Await commit approval.*
