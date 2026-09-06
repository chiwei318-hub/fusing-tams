# AP ×80% SSoT AUDIT — MONEY #3F

Date: 2026-09-06  
Baselines: through `14f4aa1` (#3C CLOSED)  
Mode: **READ-ONLY AUDIT**  
Production / DB / migration / commit: **0 / NO**

Chair Gate: **Do not assume AP = `cost_amount`.** Prove business meaning first.

Characterization: `ap-80-ssot.test.mjs`

---

## 1. Executive Summary

`order_financials.ap_total` is **not** a verified accounts-payable SSoT.

| Path | Formula | Source of 80% |
|------|---------|----------------|
| **Writer A** trigger | `total_fee × 0.80` | **HARDCODED_LITERAL** (no config/contract) |
| **Writer B** `calcFinancials` | Prefer `order_settlements.driver_payout`; else `round(AR×0.80)` + tailgate **500** + hydraulic **800** | Settlement GENERATED share **or** hardcoded 80% + hardcoded equipment |

`orders.cost_amount` (#2dA) = **route trip rate** (`driver_pay_rate` / `rate_per_trip`), absolute money — **not** a % of `total_fee`.

Settlement `driver_payout` (when present) = `total_amount × (100 − commission_rate) / 100` (schema GENERATED; default rate **15** → typically **85%** of freight) — **commission residual**, not route cost.

Therefore **AP ≠ cost_amount** as concepts (code evidence). Replacing AP with `cost_amount` without a business Chair decision would create a new collision.

`driver_payout = 0` and missing settlement both hit `ap_base <= 0` → **same 80% fallback** → cannot distinguish verified-zero vs missing.

Historical mix of settlement-based vs 80% AP: **UNKNOWN** without RO prod DB (`RO_DB_REQUIRED_FOR_AP_EXPOSURE`).

---

## 2. Writer A AP trace

| Item | Evidence |
|------|----------|
| **FILE** | `artifacts/api-server/src/routes/financials.ts` |
| **FUNCTION** | `auto_create_financials()` |
| **FORMULA** | `COALESCE(NEW.total_fee,0) * 0.80` → `ap_total` |
| **RATE SOURCE** | none — literal |
| **HARDCODED?** | **YES** |
| **CONFIGURABLE?** | **NO** |
| **ACTIVE?** | **YES** (on delivered insert; `ON CONFLICT DO NOTHING`) |
| Equipment add-ons | **NOT applied** on trigger path |

**80% from contract / customer / driver / fleet / system config / settlement / env / DB field?**  
**NONE → HARDCODED_LITERAL**

---

## 3. Writer B AP trace

| Step | Behavior |
|------|----------|
| Read | `LEFT JOIN order_settlements` → `COALESCE(os.driver_payout, 0) AS ap_base` |
| If `ap_base > 0` | use as base |
| If `ap_base <= 0` | `ap_base = Math.round(ar_total * 0.80)` |
| Then | `+ ap_tailgate (500 if need_tailgate) + ap_frozen(0) + ap_other (800 if hydraulic)` |
| Result | `ap_total = sum` |

Parallel clone: `arApLedger.ts` `generateArApForOrder` — same 80% + 500/800 pattern → `ar_ap_records`.

| Q | A |
|---|---|
| Settlement coverage (prod) | **UNKNOWN** (no RO DB this round) |
| `driver_payout` writer | Schema: **GENERATED** from `total_amount` & `commission_rate`. Rows inserted by `webhookOrders` (Atoms complete), `franchiseSettlements`, `orderSettlements` APIs — insert `total_amount`/`commission_rate`; payout computed by DB |
| Formal meaning of payout | **Driver residual after platform commission %** (schema comment) — not route `cost_amount` |
| Zero vs missing | `COALESCE(...,0)` then `<= 0` → **both trigger fallback** |

---

## 4. tailgate / hydraulic source

| Constant | FILE (financials / arAp) | VALUE | APPLIES WHEN | RATE SOURCE | HARDCODED? | CONFIGURABLE? | ACTIVE? |
|----------|--------------------------|-------|--------------|-------------|------------|---------------|---------|
| Tailgate | `financials.ts` / `arApLedger.ts` | **500** | `orders.need_tailgate` true | literal in JS | **YES** | **NO** (not reading surcharge tables) | **YES** |
| Hydraulic | same | **800** | `orders.need_hydraulic_pallet` true | literal | **YES** | **NO** | **YES** |

Cross-module comparison (not wired into financials AP):

| Module | Tailgate | Hydraulic |
|--------|----------|-----------|
| `vehicleSurcharge.ts` ADDON | 500 | (crane 800; no hydraulic key) |
| `vehicleMatrix.ts` seed | 500 | — |
| `pricing.ts` CFG | **800** | **600** |
| `freightQuote.ts` seed | **600** | **800** |

→ Financials 500/800 are **UNVERIFIED_DEFAULT** literals; **not** proven mirror of customer surcharge SSoT; **no** link to `route_prefix_rates` / `cost_amount`.

Business intent (“customer surcharge mirrored as driver payable”) = **UNVERIFIED** from code alone.

---

## 5. AP vs cost_amount relationship matrix

| FIELD | SOURCE | FORMULA | BUSINESS MEANING FROM CODE | WRITER | READER | CANONICAL? |
|-------|--------|---------|----------------------------|--------|--------|------------|
| `orders.cost_amount` | route rates | valid `driver_pay_rate` else `rate_per_trip` else NULL (#2dA) | Direct transport trip cost | `calc_order_finance` | reports / sheets / firebase / GP | **YES** for trip cost |
| `order_financials.ap_total` (A) | fee | `fee × 0.80` | Legacy AP proxy | trigger | financials UI until recalc | **NO** |
| `order_financials.ap_total` (B) | settlement or fee | payout **or** `fee×0.80` + equip | Labeled 司機薪資/應付; mix of commission residual & proxy | `calcFinancials` | FinancialsDashboard / Excel | **NO** single SSoT |
| `order_settlements.driver_payout` | total×(100−rate)% | GENERATED | Driver share after platform commission | settlement insert | Writer B / SettlementCenter | Settlement split SSoT (≠ trip cost) |

| Q | A |
|---|---|
| Same financial concept? | **NO** |
| Can `ap_total` safely use `cost_amount`? | **NO** (code concepts differ; would need Chair redefinition — tag **DEPENDS_ON_BUSINESS_DEFINITION** only if product redefines AP as trip cost) |
| Can `cost_amount` safely use `ap_total`? | **NO** |

Example fee=10000, route cost=800: GP cost **800** vs AP fallback **8000** vs settlement@15% **8500**.

---

## 6. Settlement data completeness

| Item | Evidence |
|------|----------|
| SCHEMA | `lib/db/src/schema/settlements.ts` — UNIQUE order_id; GENERATED payout |
| WRITERS | webhook Atoms accept; franchiseSettlements; orderSettlements routes |
| WHEN | Often on delivery/completion / settle flows — **not** guaranteed for every delivered order |
| COVERAGE | **UNKNOWN** locally without DB query of prod/fixture counts |
| NULL | JOIN miss → COALESCE 0 |
| ZERO | Stored 0 or miss → same fallback |

**Can distinguish verified-zero payout from missing settlement:** **NO**

---

## 7. Cross-contamination (#2dA / #3C)

| Check | Result |
|-------|--------|
| `orders.profit_amount` reads `ap_total` / `driver_payout`? | **NO** (`total_fee − cost_amount` only) |
| Writer B `platform_profit` uses `ap_total`? | **YES** (`AR − AP`) — expected; #3C only nulled trigger profit |
| P0_UNEXPECTED_CROSS_CONTAMINATION | **NO** |

---

## 8. Shadow cases

| Case | Inputs | Expected CURRENT | Result |
|------|--------|------------------|--------|
| **A** | fee=10000, payout=7500, no equip | AP=**7500**, source SETTLEMENT | Confirmed via fixture |
| **B** | fee=10000, no settlement | AP=**8000** (trigger same; Writer B same without flags) | Confirmed |
| **B+** | fee=10000, no settlement, tailgate+hydraulic | AP=**8000+500+800=9300** | Confirmed |
| **C** | fee=10000, settlement exists, payout=**0** | Treated as missing → AP=**8000** | **ZERO≡MISSING** |
| **D** | fee=10000, cost_amount=800 | cost **800** vs AP **8000** (fallback) | **Not equal** |

---

## 9. Historical distinguishability

| Q | A |
|---|---|
| Schema distinguish settlement AP vs 80% fallback? | **NO** (no `ap_source`; optional heuristic if join payout>0 and equals ap_base — not authoritative) |
| Quantify from local fixtures? | **NO** (formulas only) |
| Historical production exposure | **UNKNOWN** — `RO_DB_REQUIRED_FOR_AP_EXPOSURE` |

---

## 10. Repair options (evaluate only)

| Opt | Idea | Correctness | Semantic | Schema | Migration | History | Reversibility | Risk |
|-----|------|-------------|----------|--------|-----------|---------|---------------|------|
| **A** | Trigger AP → NULL (stop-fake like #3C) | Stops unverified 80% on new rows | Honest unknown until calc | No | No | Old ×80 remain | High | Low–Med |
| **B** | Keep 80% but store `ap_source` | Transparency | Still estimate | **YES** column | **POSSIBLY** | Backfill hard | Med | Med |
| **C** | AP ← `cost_amount` | **Only if Chair redefines AP=trip cost** | Violates current code meanings | No | No | Wrong if AP≠trip cost | Med | **HIGH** without Chair |
| **D** | Independent AP SSoT; missing → NULL/UNKNOWN | Best long-term | Clear | Possibly | Possibly | Large | Med | Med |

Do **not** pick C unless Chair explicitly redefines payable = trip cost.

---

## 11. Recommended smallest repair

**Option A-leaning (conceptual):** stop Writer A from writing `fee×0.80` as if known AP (prefer **NULL** / withhold) — parallel to #3C — **without** mapping to `cost_amount`.

Then separately: decide whether Writer B fallback 80% should also become NULL; settle **equipment literals** vs surcharge config; only then consider settlement-first AP with provenance.

**Do not** merge with `cost_amount` in the first knife.

---

## 12. P0 risks

1. UI「司機薪資/AP」may be **80% fiction**  
2. Zero payout indistinguishable from missing → false fallback  
3. Settlement@15% (**85%**) vs fallback **80%** — inconsistent “driver share”  
4. Temptation to replace with `cost_amount` without Chair → **concept collision**

---

## 13. P1 risks

1. Dual writers (trigger 80% vs calc) + arApLedger clone  
2. Equipment 500/800 diverge from pricing/freightQuote configs  
3. Writer B profit (AR−AP) inherits bad AP  
4. Prod exposure UNKNOWN  

---

## 14. CHANGE VERIFICATION

| Check | Result |
|-------|--------|
| Production modified | **0** |
| DB / migration | **NO** |
| Commit | **NO** |
| Artifacts | this file; `ap-80-ssot.test.mjs`; PERCENTAGE-INVENTORY / BACKLOG updates |

---

## Final checklist

| Q | A |
|---|---|
| Is ×80% sourced from business config? | **NO** |
| Is ×80% hardcoded? | **YES** |
| What does `ap_total` mean based on code? | **LEGACY / MIXED**: trigger = fee×80% proxy; after recalc = settlement driver residual **or** fee×80% + hardcoded equipment — labeled payable/薪資, **not** route `cost_amount` |
| Same concept as `cost_amount`? | **NO** |
| Can AP safely be replaced by `cost_amount`? | **NO** (or only under **DEPENDS_ON_BUSINESS_DEFINITION** after Chair redefines AP) |
| Distinguish real settlement AP vs 80% fallback? | **NO** |
| Distinguish verified-zero vs missing settlement? | **NO** |
| tailgate/hydraulic business source? | **UNVERIFIED_DEFAULT** literals 500/800; not wired to surcharge SSoT; inconsistent with pricing.ts 800/600 |
| Does `profit_amount` cross-contaminate with AP? | **NO** |
| Historical production exposure | **UNKNOWN** (`RO_DB_REQUIRED_FOR_AP_EXPOSURE`) |
| Recommended smallest repair | Stop-fake trigger AP (NULL); do **not** map to `cost_amount`; later provenance + fallback policy + equipment config |
| Production modified | **0** |
| Commit | **NO** |
