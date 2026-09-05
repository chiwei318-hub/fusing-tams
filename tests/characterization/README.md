# Characterization tests (P0-0)

Record **current production behavior**. Not proof that formulas are correct.

- Pure fixtures only — no production DB, LINE, ECPay, or webhooks.
- Formulas are **mirrors** of SQL/TS found in routes (see comments in `money/formulas.mjs`).
- When production intentionally changes, update fixtures + these tests in the same PR.

Run:

```bash
pnpm run test:characterization
```
