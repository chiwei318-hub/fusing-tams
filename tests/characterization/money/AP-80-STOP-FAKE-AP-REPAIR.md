# AP ×80% STOP FAKE AP REPAIR — MONEY #3F (reduced scope)

Date: 2026-09-06  
Mode: **MINIMAL REPAIR — SCHEMA-FREE**  
Commit: **NO** (await `#3F 核准 commit`)

---

## Scope after SCHEMA_BLOCKER (Case B)

| Target | Status |
|--------|--------|
| `order_financials` (trigger + `calcFinancials`) | **IN SCOPE** — AP NULL without verified settlement; no ×80 |
| `FinancialsDashboard` AP NULL UI | **IN SCOPE** |
| `ar_ap_records` / `arApLedger.ts` formula | **OUT OF SCOPE** — restored LEGACY ×80 |
| `DROP NOT NULL` DDL | **REMOVED** (unauthorized; never executed on local DB) |

## VERIFIED_SETTLEMENT_CRITERIA (`order_financials` only)

Proxy: settlement row EXISTS AND `payment_status ≠ 'cancelled'`  
→ `ap_*` from `driver_payout` (+ equip literals)  
Else → `ap_total` / profit NULL  

## Dual-table divergence (accepted this round)

| Table | No settlement |
|-------|---------------|
| `order_financials.ap_total` | **NULL** |
| `ar_ap_records.ap_total` | still **fee×80%** |

BACKLOG: **AR_AP_RECORDS_SCHEMA_BLOCKED_LEGACY_80** (`REPAIR_REQUIRES_SCHEMA_CHANGE`)

Ledger API/UI marked `LEGACY_80_ESTIMATE` / disclaimer.

## Unchanged

- Settlement GENERATED `driver_payout` formula  
- `drivers.commission_rate` #3A  
- SEMANTIC_COLLISION naming: **OPEN**  
- Historical financials ×80 rows: KEEP  
- No migration  

## Production files (reduced)

1. `financials.ts`  
2. `FinancialsDashboard.tsx`  
3. `arApLedger.ts` — **comments + API/UI disclaimer only**; formula = HEAD LEGACY ×80 (no DDL)
4. `ArApDashboard.tsx` — disclaimer only
