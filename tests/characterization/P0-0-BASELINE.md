# FUSING-TAMS P0-0 TEST BASELINE

Date: 2026-09-06  
Scope: Characterization safety net only — **no business logic / schema / API behavior changes**.

## Decision

| Item | Choice |
|------|--------|
| Runner | Node built-in `node:test` + `node:assert` |
| Why | No vitest/jest in repo; zero new deps; Node 24 present |
| Command | `pnpm run test:characterization` |

## Result

```
tests 23 | pass 23 | fail 0
```

## CHANGE VERIFICATION

| Category | Count |
|----------|-------|
| Production business logic edited | **0** |
| Schema / migration edited | **0** |
| DB writes during tests | **0** |
| LINE / ECPay / webhook calls | **0** |

**Added only:**

- `tests/characterization/**` (mirrors + tests + README)
- `package.json` script `test:characterization`

## Money: SAME INPUT → DIFFERENT OUTPUT (`total_fee = 10000`, rate = 800)

> **WARNING — do not treat locked numbers as “correct tax law”.**  
> Business rule confirmed 2026-09-06: **未稅外加** `tax = net × 0.05`, `grand = net × 1.05`.  
> Rows marked **KNOWN_WRONG** still match **production code as of P0-0 / P0-1** (inclusive reverse).  
> Rows marked **KNOWN_CORRECT** already match exclusive-add.  
> Characterization freezes behavior so refactors cannot silently invent a third formula. Tax REPAIR is a separate change.

| Path | Tax / VAT | Cost / AP | Profit | Basis | Verdict |
|------|-----------|-----------|--------|-------|---------|
| `calc_order_finance` trigger | **476.19** | 800 | **8723.81** | inclusive reverse (`/1.05*0.05`) | **KNOWN_WRONG** |
| `auto_create_financials` trigger | (grand = 10500) | AP **8000** | **1500** (`×0.15`) | fixed split; ignores driver rate | commercial split (out of VAT scope) |
| `calcFinancials` JS | AR tax **500** | AP **8000** | **2000** | exclusive add | **KNOWN_CORRECT** (VAT) |
| `monthlyBilling` generate | **500** | — | — | exclusive | **KNOWN_CORRECT** |
| `monthlyBilling` invoice-from-bill | **476** | — | — | inclusive (self-conflict vs generate) | **KNOWN_WRONG** |
| `autoInvoice` | **500** | — | — | exclusive | **KNOWN_CORRECT** |
| `invoicePdf` | **476** | — | — | inclusive | **KNOWN_WRONG** |

Fixtures also cover `total_fee` ∈ {0, 1000, 10000, 100000} and `driver_pay_rate` null / 0 / normal; live smoke `2100/800 → vat 100 / profit 1200` locked in (**KNOWN_WRONG** inclusive path until tax REPAIR).

## Status inventory

| Value | OpenAPI `status` | TMS `order_status` | Also written on `orders.status` by |
|-------|------------------|--------------------|-------------------------------------|
| pending | ✓ | ✓ | — |
| assigned | ✓ | — | driver accept |
| accepted | ✗ | ✓ | **fleetDriver** |
| arrived | ✗ | ✗ | **orderStatusFlow** |
| loading | ✗ | ✗ | **orderStatusFlow** |
| in_transit | ✓ | — (backfill → picking) | — |
| delivered | ✓ | ✓ | — |
| exception | ✗ | ✗ | **orderStatusFlow** |
| cancelled | ✓ | ✓ | — |
| picking / settled | ✗ | ✓ | backfill / TMS |

Backfill (`app.ts`): `assigned → accepted`, `in_transit|picking → picking`.

Driver accept/reject: documented transitions only (no HTTP/DB in this step) — accept→`assigned`, reject→`pending`.

## TESTABILITY BLOCKER

Formulas live in **SQL triggers** and **route handlers**. P0-0 does **not** refactor them out.

Characterization uses **labeled pure mirrors** of current code (`tests/characterization/money/formulas.mjs`).  
Mirrors ≠ “correct tax law”; they freeze observed behavior so P0-1+ cannot silently drift.

Accept/reject / full status writers: inventory + transition docs only — no API integration tests yet (would need DB or heavy mocking; out of P0-0).

## Next

**P0-1 Status SSoT:** implemented (engine + dual-write). Tax REPAIR still pending — see `tests/characterization/tax/MATERIALITY.md`.
