# Tax path materiality (read-only)

Date: 2026-09-06  
Scope: **SELECT only** — no formula REPAIR, no historical UPDATE.  
Probe: `node tests/characterization/tax/materiality-probe.mjs`

## Local DB snapshot (`logistics_db`)

| Metric | Value |
|--------|-------|
| Orders with `total_fee > 0` | 1 |
| Matching **exclusive** `ROUND(total_fee*0.05,2)` | **0** |
| Matching **inclusive** `ROUND(total_fee/1.05*0.05,2)` | **1** |
| Σ (exclusive − stored vat) | **+5.00** |
| `invoices` (90d) | relation missing on this local DB |
| `monthly_bills` | relation missing on this local DB |

Interpretation: the one fee order’s `vat_amount` follows the **KNOWN_WRONG** inclusive trigger path. Gap vs exclusive is NT$5 on that sample — not production-scale evidence, but directionally confirms trigger is live and wrong under the confirmed business rule.

## Code evidence (who consumes `vat_amount`)

| Consumer | Uses `orders.vat_amount`? |
|----------|---------------------------|
| autoInvoice / invoices | No (own exclusive calc) |
| monthlyBilling generate | No (exclusive on fee sum) |
| Driver / fleet settlement docs | No |
| sheetsExport / firebaseSync | Uses **`profit_amount`** (derived with wrong vat) — indirect |

## Urgency note for next tax REPAIR

- Formal invoices/月結 on this local DB: tables absent → cannot quantify issued docs here.
- Production urgency still high if prod has many `match_inclusive` rows and startup backfill keeps rewriting vat/profit.
- P0-1 did **not** change money formulas (characterization money suite unchanged).

## How to re-run

```bash
node tests/characterization/tax/materiality-probe.mjs
```
