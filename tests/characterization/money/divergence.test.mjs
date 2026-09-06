import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderFinanceTrigger,
  financialsAutoCreateTrigger,
  financialsCalcJs,
  monthlyBillingGenerateExclusive,
  monthlyBillingInvoiceExclusive,
  autoInvoiceExclusive,
  invoicePdfExclusive,
  calcExclusiveVat,
} from "./formulas.mjs";

describe("tax_engine exclusive: total_fee=10000 → tax 500, grand 10500", () => {
  it("cent and yuan modes", () => {
    const c = calcExclusiveVat(10000, "cent");
    assert.equal(c.taxAmount, 500);
    assert.equal(c.grandTotal, 10500);
    const y = calcExclusiveVat(10000, "yuan");
    assert.equal(y.taxAmount, 500);
    assert.equal(y.grandTotal, 10500);
  });
});

/**
 * Shadow comparison (REPAIR profit no-VAT-deduct).
 * Fixture chosen to match live smoke shape (rate=800), not the prompt's illustrative 7000.
 */
describe("shadow: profit OLD vs NEW vs LEGACY (total_fee=10000, cost=800)", () => {
  const TOTAL = 10000;
  const COST = 800;
  const VAT = 500;

  it("lists OLD (deduct VAT) / NEW (no VAT) / financials trigger (NULL after #3C)", () => {
    const oldProfit = Math.round((TOTAL - COST - VAT) * 100) / 100; // 8700
    const newProfit = orderFinanceTrigger({
      total_fee: TOTAL,
      driver_pay_rate: COST,
    }).profit_amount;
    const finTrig = financialsAutoCreateTrigger({ total_fee: TOTAL }).platform_profit;

    assert.equal(oldProfit, 8700);
    assert.equal(newProfit, 9200);
    assert.equal(finTrig, null);
    assert.notEqual(newProfit, oldProfit);
    assert.notEqual(newProfit, finTrig);
  });
});

describe("characterization: SAME total_fee=10000 after profit REPAIR", () => {
  const TOTAL = 10000;
  const DRIVER_RATE = 800;

  it("snapshot: VAT 500; profit 9200; financials trigger profit NULL (#3C)", () => {
    const trigger = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE });
    const finTrig = financialsAutoCreateTrigger({ total_fee: TOTAL });
    const finJs = financialsCalcJs({ total_fee: TOTAL });
    assert.equal(trigger.vat_amount, 500);
    assert.equal(trigger.profit_amount, 9200);
    assert.equal(finJs.ar_tax, 500);
    assert.equal(monthlyBillingGenerateExclusive(TOTAL).taxAmount, 500);
    assert.equal(monthlyBillingInvoiceExclusive(TOTAL).taxAmount, 500);
    assert.equal(autoInvoiceExclusive(TOTAL).taxAmount, 500);
    assert.equal(invoicePdfExclusive(TOTAL).taxAmount, 500);
    assert.equal(finTrig.platform_profit, null);
  });

  it("VAT basis aligned: trigger = financials JS = monthly = invoice = pdf", () => {
    const tVat = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE }).vat_amount;
    const fVat = financialsCalcJs({ total_fee: TOTAL }).ar_tax;
    const mVat = monthlyBillingGenerateExclusive(TOTAL).taxAmount;
    assert.equal(tVat, fVat);
    assert.equal(tVat, mVat);
    assert.equal(tVat, monthlyBillingInvoiceExclusive(TOTAL).taxAmount);
    assert.equal(tVat, invoicePdfExclusive(TOTAL).taxAmount);
  });

  it("PROVES remaining divergence: order profit ≠ financials AR−AP after recalc", () => {
    const tProfit = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE }).profit_amount;
    const fProfit = financialsCalcJs({ total_fee: TOTAL }).platform_profit;
    assert.notEqual(tProfit, fProfit);
    assert.equal(tProfit, 9200);
    assert.equal(fProfit, 2000);
  });

  it("monthlyBilling generate and invoice-from-bill both exclusive (no self-conflict)", () => {
    const ex = monthlyBillingGenerateExclusive(TOTAL);
    const inv = monthlyBillingInvoiceExclusive(TOTAL);
    assert.equal(ex.taxAmount, inv.taxAmount);
    assert.equal(ex.basis, "exclusive");
    assert.equal(inv.basis, "exclusive");
  });
});

describe("characterization: VAT exclusive matrix", () => {
  for (const total of [0, 1000, 10000, 100000]) {
    it(`total=${total} exclusive tax`, () => {
      const vat = orderFinanceTrigger({
        total_fee: total > 0 ? total : null,
        driver_pay_rate: 0,
      }).vat_amount;
      const ex = total > 0 ? monthlyBillingGenerateExclusive(total).taxAmount : 0;
      if (total === 0) {
        assert.equal(vat, 0);
        assert.equal(ex, 0);
      } else {
        assert.equal(vat, ex);
      }
    });
  }
});
