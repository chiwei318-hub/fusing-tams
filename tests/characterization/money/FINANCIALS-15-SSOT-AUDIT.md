# FINANCIALS ×15% SSoT AUDIT — MONEY #3C

Date: 2026-09-06  
Baselines: `ae9ddda` (#3B), `39bd760` (#2dA OVERALL CLOSED — TECHNICAL PASS + GIT FORENSICS PASS; `UNAUTHORIZED_COMMIT=NO`)  
Mode: **READ-ONLY AUDIT**  
Production modified: **0**  
DB / migration / commit: **NO**

Draft scope review (working tree): `formulas.mjs` = characterization helper only (not runtime/production); audit + `financials-15-ssot.test.mjs` = RO docs/tests only; `artifacts/` diff empty.

Characterization: `financials-15-ssot.test.mjs` (documents CURRENT behavior only)

---

## 1. Executive Summary

`order_financials.platform_profit` has **two active writers with incompatible formulas**:

| Writer | When | Formula |
|--------|------|---------|
| **A** `auto_create_financials` (DB trigger) | `orders.status` → `delivered` (first insert) | `total_fee × 0.15` |
| **B** `calcFinancials` (JS) | `POST …/recalculate/:id` (and batch only for **missing** rows) | `AR − AP` |

Formal UI `/financials` labels「平台淨利」as **AR − AP**, but **trigger-only rows stay ×15%** until a **per-order** recalculate.  
`POST /batch-recalculate` does **not** refresh existing trigger rows (`WHERE f.id IS NULL` only).

×15% is a **HARDCODED_LITERAL** — not config / contract / commission / settlement.  
Tag: **LEGACY_HARDCODED_APPROXIMATION**.

Canonical V1 `orders.profit_amount = total_fee − cost_amount` (NULL when cost unknown) is a **different concept**. Same fee can show GP=9200 / trigger profit=1500 / recalc profit=2000, or **GP=NULL while financials still shows +1500**.

---

## 2. Writer A — `auto_create_financials`

| Item | Evidence |
|------|----------|
| **FILE** | `artifacts/api-server/src/routes/financials.ts` L68–101 |
| **FUNCTION** | `auto_create_financials()` plpgsql |
| **TRIGGER** | `trg_auto_financials` AFTER UPDATE ON `orders` |
| **WHEN FIRES** | `NEW.status = 'delivered' AND OLD.status != 'delivered'` |
| **INSERT CONDITION** | Same IF |
| **ON CONFLICT** | `(order_id) DO NOTHING` — never overwrites existing row |
| **INPUT TABLES** | `orders` (NEW row only) |
| **INPUT COLUMNS** | `id`, `order_no`, `status`, `total_fee` |

### Per-column (Writer A)

| Column | FORMULA | BUSINESS MEANING FROM CODE | HARDCODED RATE | SOURCE OF RATE | CANONICAL? | ACTIVE? |
|--------|---------|----------------------------|----------------|----------------|------------|---------|
| `platform_profit` | `COALESCE(NEW.total_fee,0) * 0.15` | Labeled platform P&L; formula = 15% of fee | **0.15** | **HARDCODED_LITERAL** | NO | YES |
| `platform_revenue` | `COALESCE(NEW.total_fee,0) * 0.15` | Same numeric as profit | **0.15** | HARDCODED_LITERAL | NO | YES |
| `profit_margin_pct` | literal `15` | Fixed label, not computed from AR/AP | **15** | HARDCODED_LITERAL | NO | YES |
| `ar_total` | `COALESCE(NEW.total_fee,0)` | AR ≈ fee | — | orders.total_fee | PARTIAL (fee as AR) | YES |
| `ar_grand_total` | `total_fee * 1.05` | Fee + 5% tax | **1.05** | HARDCODED_LITERAL | tax path OK-ish | YES |
| `ap_total` | `total_fee * 0.80` | AP proxy | **0.80** | HARDCODED_LITERAL | NO (#3F) | YES |
| Other MONEY (`ar_tax`, `ap_base`, …) | **not set** by trigger | remain DEFAULT 0 | — | — | — | N/A |

**15% source check:** not config / customer / driver / platform rate field / contract / settlement / env / DB setting → **HARDCODED_LITERAL**.

---

## 3. Writer B — `calcFinancials`

| Item | Evidence |
|------|----------|
| **FILE** | `financials.ts` L108–172 |
| **API** | `POST /api/financials/recalculate/:orderId` → `calcFinancials` |
| **BATCH** | `POST /api/financials/batch-recalculate` → same fn, **only** `delivered AND order_financials missing` (L224–228) |
| **CALLER (UI)** | `FinancialsDashboard` 「補跑財務」→ **batch only** (not per-row overwrite of existing) |
| **OTHER callers** | Grep: only `financials.ts` routes; no settlement/webhook auto-hook |

| Item | Value |
|------|--------|
| **AR SOURCE** | `COALESCE(o.total_fee,0)` |
| **AP SOURCE** | `order_settlements.driver_payout` as `ap_base`; if `ap_base <= 0` → `round(ar * 0.80)` + tailgate 500 / hydraulic 800 |
| **PROFIT FORMULA** | `platform_profit = ar_total - ap_total` |
| **MARGIN FORMULA** | `round(platform_profit / ar_total * 1000) / 10` (or 0) |
| **UPSERT** | `ON CONFLICT (order_id) DO UPDATE` — overwrites AR/AP/profit/revenue/cost/margin + `updated_at` |

| Question | Answer |
|----------|--------|
| `platform_profit` is AR − AP? | **YES** |
| `profit_margin_pct` recomputed from actual? | **YES** |
| `platform_revenue` updated? | **YES** → set to **full `ar_total`** (≠ Writer A’s fee×0.15) |
| Still contains 15% in Writer B profit? | **NO** (but AP **still may** use ×80 fallback) |

---

## 4. Writer Precedence

| Event | Effect on `platform_profit` |
|-------|-----------------------------|
| delivered (first) | Writer A insert ×15 |
| delivered again / status flicker | Writer A IF only on transition; if row exists → **DO NOTHING** |
| `recalculate/:id` | Writer B **UPSERT overwrite** → AR−AP |
| `batch-recalculate` | Writer B **only if no row**; **existing ×15 rows untouched** |
| settlement change | **No auto refresh** (no hook) |
| order fee change after financials row | **No auto refresh** |

**Last writer controlling profit:** whoever last successfully wrote — A on insert-only, B only if per-id recalculate (or batch when row was missing).

**Trigger overwrite recalculated?** **NO** (`DO NOTHING`).

**Stale data without refresh?** **YES** — settlement/fee changes; batch button does not refresh existing.

---

## 5. Lifecycle states

| State | How entered | Who owns `platform_profit` |
|-------|-------------|----------------------------|
| **STATE 1 TRIGGER_ONLY** | delivered insert, never recalculated | Writer A ×15 |
| **STATE 2 RECALCULATED** | `POST …/recalculate/:id` (or batch when row was absent) | Writer B AR−AP |
| **STATE 3 RECALCULATED_THEN_ORDER_CHANGED** | fee/flags change after B | Still B’s **old** numbers until manual recalc — **STALE** |
| **STATE 4 SETTLEMENT_CHANGED_WITHOUT_RECALC** | `driver_payout` changes | Still previous writer values — **STALE**; batch won’t help if row exists |

---

## 6. Row Provenance

Schema columns (`financials.ts` L20–62): `created_at`, `updated_at` only.  
**No** `source`, `calculation_type`, `updated_by`, `recalculated_at`, `version`, metadata, audit log for formula path.

Heuristic `updated_at > created_at` is **not** proof of Writer B (status PATCH also bumps `updated_at`).

**Can distinguish writer source today:** **NO**

---

## 7. 15% source

Code: `* 0.15` and literal `15` in trigger INSERT (L85–87).  
No join to commission_rate, config, contract, env.

**Is ×15 from business config:** **NO**  
**Is ×15 hardcoded:** **YES** → **LEGACY_HARDCODED_APPROXIMATION**

---

## 8. 15% semantic (code only — do not invent)

Closest tags from formula shape + column names:

- Numerically **commission-shaped** (fee × 15%) but **not wired** to any commission SSoT  
- Column named `platform_profit` / UI「淨利」→ **mislabeled**  
- Not driver deduction SSoT; not canonical GP  

**Verdict:** **F. legacy approximation** (+ optional **G. unknown** business intent)  
Do **not** treat as proven A–E without business confirmation.

---

## 9. AP dependency

| Writer | AP |
|--------|-----|
| A | always `fee × 0.80` |
| B | settlement `driver_payout` if > 0, else **`ar × 0.80`** + equipment |

**Does #3C depend on unresolved AP×80:** **PARTIAL**  
- Stopping **fake ×15 profit** can proceed without AP SSoT (e.g. NULL profit on trigger).  
- Making AR−AP the **trusted** formal KPI **does** depend on AP authenticity → tag **`#3C_REPAIR_DEPENDS_ON_AP_SSoT`** for full replace-with-B.  
Do **not** repair AP this round (#3F).

---

## 10. Canonical GP comparison

| FIELD | SOURCE | FORMULA | COST SOURCE | NULL POLICY | WRITER | READER | BUSINESS LABEL |
|-------|--------|---------|-------------|-------------|--------|--------|----------------|
| `orders.profit_amount` | orders | `total_fee − cost_amount` | route/driver rate (#2dA) | unknown cost → **NULL** | `calc_order_finance` | reports / sheets / firebase | Gross profit V1 |
| `order_financials.platform_profit` | order_financials | ×15 **or** AR−AP | N/A / AP proxy | never NULL from writers (defaults 0) | A or B | FinancialsDashboard / Excel | 「平台淨利」 |

| Q | A |
|---|---|
| Same financial concept? | **NO** |
| `platform_profit` substitute `profit_amount`? | **NO** |
| `profit_amount` substitute `platform_profit`? | **NO** (different meaning + AP/settlement UI expectations) |

---

## 11. Formal UI readers

| FILE | ENDPOINT | FIELD | LABEL | FORMULA | FALLBACK | USER-FACING? |
|------|----------|-------|-------|---------|----------|--------------|
| `FinancialsDashboard.tsx` | `GET /api/financials` | `platform_profit` | 「淨利」 | stored value | none | YES |
| same | same | `profit_margin_pct` | 「利潤率」 | stored | `?? 0` | YES |
| same | `GET …/monthly-report` | `total_platform_profit` | 「平台淨利」 | SUM stored | 0 | YES |
| same | monthly summary | `profit_margin` | 「利潤率」 | SUM(profit)/SUM(ar) | | YES |
| same StatCard | — | — | sub「AR - AP」 | **UI copy only** | — | YES |
| same | `GET …/export-excel` | SUM profit | 「平台淨利」/「平台毛利」 | SUM stored | | YES |
| same | `POST …/batch-recalculate` | — | 「補跑財務」 | missing rows only | | YES |

**UI_LABEL_DATA_SEMANTIC_MISMATCH:** **YES** — subtitle claims AR−AP; STATE 1 rows are ×15.

---

## 12. Export readers

Excel sheets (月結總覽 / 廠商對帳單 / 車型 / 平台損益) all sum or list `platform_profit` from `order_financials` for period — same dual-formula exposure.

---

## 13. Aggregate behavior

`SUM(platform_profit)` / margin `SUM(profit)/SUM(ar)` over a month with mixed STATE 1 + STATE 2 rows → **mixed formulas in one KPI**.

**MIXED_FORMULA_AGGREGATE:** **POSSIBLE** (YES whenever both states coexist; production mix ratio = **UNKNOWN** without RO DB).

Same for AP (×80 vs settlement) and `platform_revenue` (fee×15 vs full AR).

---

## 14. UI label mismatch

Confirmed: **UI_LABEL_DATA_SEMANTIC_MISMATCH**.

---

## 15. Shadow cases

| Case | Inputs | Current expected |
|------|--------|------------------|
| **A** trigger only, fee=10000 | — | profit=**1500**, margin=**15**, ap=**8000**, revenue=**1500** |
| **B** recalc, AR=10000, AP=8000 (no settlement) | — | profit=**2000**, margin=**20**, revenue=**10000** |
| **C** cost=800 | GP=**9200** vs A=1500 vs B=2000 | **three different concepts** |
| **D** unknown cost | GP=**NULL**; trigger profit still **1500** | **FINANCIALS_SHOWS_PROFIT_WHILE_CANONICAL_GP_UNKNOWN** |

---

## 16. Unknown-cost interaction

Writer A/B **ignore** `cost_amount` / `profit_amount`.  
Delivered + unknown cost → canonical GP NULL, financials still positive ×15 (or AR−AP after recalc).

---

## 17. Historical distinguishability

| Q | A |
|---|---|
| Schema distinguish trigger vs recalc? | **NO** |
| Quantify from local fixtures? | **NO** (fixtures prove formulas only) |
| Historical production exposure | **UNKNOWN** |
| Tag | **RO_DB_REQUIRED_FOR_EXPOSURE** |

Do not report exposure as 0 rows.

---

## 18. Production exposure

**UNKNOWN** — need `DATABASE_URL_RO_PROD` (read-only) to count STATE 1 vs 2. Heuristics unreliable.

---

## 19. DUAL_WRITER

**YES**

---

## 20. MULTIPLE_FINANCIAL_TRUTH

**YES** — ×15 vs AR−AP vs canonical GP (+ AP×80 vs settlement).

Also: **UI_SOURCE_AMBIGUOUS YES**; **ROW_PROVENANCE_AVAILABLE NO**.

---

## 21. P0 risks

1. Same column, different formulas  
2. Formal UI cannot show writer source  
3. Monthly aggregate may mix formulas  
4. Label「AR−AP」vs ×15 rows  
5. Per-order recalc jumps KPI (1500→2000 on same fee/AP×80)  
6. Canonical GP NULL while financials shows profit  

---

## 22. P1 risks

- `platform_revenue` dual meaning (×15 vs full AR)  
- Batch button false sense of “refresh all”  
- Settlement changes leave STALE financials  
- Excel「平台毛利」= SUM(platform_profit) not V1 GP  
- Coupling to #3F AP×80 for any “trust AR−AP” narrative  

---

## 23. Repair options (compare only)

| Opt | Idea | Correctness | Semantic | AP dep | Schema | Migration | History | UI | Reversibility | Complexity | Risk |
|-----|------|-------------|----------|--------|--------|-----------|---------|-----|---------------|------------|------|
| **A** | Stop A; only B writes | Better than dual ×15 | Still not V1 GP; AP×80 | High if trusted | No | No | New delivered use B; old ×15 remain unless backfill | Medium | High | Med | Med–High |
| **B** | Trigger inserts shell; profit **NULL** until formal calc | Stops fake profit | Honest unknown | Low for first cut | No | No | New NULL; old ×15 remain | Must tolerate blank | High | Low | **Lowest for “stop fake”** |
| **C** | platform_profit ← `orders.profit_amount` | Only if concepts equal | **NO — concepts differ** | Low | No | No | Misuse V1 | High confusion | Med | Low | **Reject unless business redefines financials = GP** |
| **D** | Split columns estimate vs actual | Clear | Best long-term | Med | **YES** | **POSSIBLY** | Dual columns | Relabel | Med | High | Med |
| **E** | Deprecate financials profit KPI; UI → V1 GP | Aligns money SSoT | Changes product meaning of /financials | Low for profit line; AP still separate | No | No | UI rewrite | High | Med | Med | Med |

Do not “just rename” without deciding concept.

---

## 24. Recommended smallest repair

**First knife (concept only — not this round):**  
**STOP CREATING FAKE PROFIT** — Option **B**-leaning: trigger must not write fee×0.15 as `platform_profit` (prefer **NULL** / withhold KPI) rather than silently switching all trust to AR−AP while AP×80 unresolved.

Full replace-with-B (Option A) → mark **`#3C_REPAIR_DEPENDS_ON_AP_SSoT`**.

---

## 25. AP×80 dependency

Safe **minimal** #3C (stop ×15 fake profit): **does not require** AP fix.  
Safe **replacement** KPI via Writer B: **PARTIAL / YES** depends on AP SSoT (#3F).

---

## 26. Expected production files (future repair — not now)

- `artifacts/api-server/src/routes/financials.ts` (trigger ± calcFinancials)  
- Possibly `artifacts/logistics/src/pages/admin/FinancialsDashboard.tsx` (labels / NULL UX)  
- Characterization + this audit  

Not in scope: commission, tax, settlements engine rewrite, orders GP writer.

---

## 27. Schema / migration

Minimal stop-fake-profit: **schema change NO**, **migration NO**.  
Option D split columns: **POSSIBLY** both.

---

## 28. Test plan (RO now; repair later)

A–G covered in `financials-15-ssot.test.mjs`.  
Future repair: assert no `* 0.15` into platform_profit; NULL policy; isolation from GP / commission / #2dA.

---

## 29. CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| Production modified | **0** |
| DB / migration | **NO** |
| Commit | **NO** |
| Audit artifact | this file |
| Characterization | `financials-15-ssot.test.mjs` |

---

## Final checklist answers

| Q | A |
|---|---|
| Is ×15 sourced from business config? | **NO** |
| Is ×15 hardcoded? | **YES** |
| What does ×15 mean based on code? | **LEGACY_HARDCODED_APPROXIMATION** (fee×0.15 into columns named profit/revenue; no SSoT wiring) |
| Does platform_profit have multiple writers? | **YES** |
| Trigger formula | `total_fee * 0.15` |
| Recalculate formula | `ar_total - ap_total` |
| Can system identify which writer produced a row? | **NO** |
| Does UI read platform_profit formally? | **YES** |
| Does UI label always match row formula? | **NO** |
| Can monthly totals mix formulas? | **POSSIBLE** |
| Can canonical GP be NULL while financials shows positive profit? | **YES** |
| Are canonical GP and platform_profit the same concept? | **NO** |
| Does safe #3C repair depend on AP×80 SSoT? | **PARTIAL** (stop-fake: NO; trust AR−AP: YES) |
| Historical production exposure | **UNKNOWN** (`RO_DB_REQUIRED_FOR_EXPOSURE`) |
| Recommended smallest repair | Stop writing ×15 as profit (NULL / withhold); don’t auto-trust AR−AP until AP SSoT |
| Expected production files | `financials.ts` (+ possibly FinancialsDashboard labels) |
| DB schema change required | **NO** for smallest; **POSSIBLY** for split columns |
| Migration required | **NO** / **POSSIBLY** |
| Production modified | **0** |
| Commit | **NO** |
