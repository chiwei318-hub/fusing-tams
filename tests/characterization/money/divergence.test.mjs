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

describe("characterization: SAME total_fee=10000 after exclusive REPAIR", () => {
  const TOTAL = 10000;
  const DRIVER_RATE = 800;

  it("snapshot: VAT paths aligned on exclusive 500", () => {
    const trigger = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE });
    const finTrig = financialsAutoCreateTrigger({ total_fee: TOTAL });
    const finJs = financialsCalcJs({ total_fee: TOTAL });
    const mbEx = monthlyBillingGenerateExclusive(TOTAL);
    const mbInv = monthlyBillingInvoiceExclusive(TOTAL);
    const invEx = autoInvoiceExclusive(TOTAL);
    const pdf = invoicePdfExclusive(TOTAL);

    assert.equal(trigger.vat_amount, 500);
    assert.equal(trigger.profit_amount, 8700);
    assert.equal(finJs.ar_tax, 500);
    assert.equal(mbEx.taxAmount, 500);
    assert.equal(mbInv.taxAmount, 500);
    assert.equal(invEx.taxAmount, 500);
    assert.equal(pdf.taxAmount, 500);
    // commercial split still diverges on profit (not VAT basis)
    assert.equal(finTrig.platform_profit, 1500);
    assert.notEqual(trigger.profit_amount, finTrig.platform_profit);
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

  it("PROVES remaining divergence: trigger profit ≠ financials auto_create profit", () => {
    const tProfit = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE }).profit_amount;
    const fProfit = financialsAutoCreateTrigger({ total_fee: TOTAL }).platform_profit;
    assert.notEqual(tProfit, fProfit);
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
        assert.equal(vat, Math.round(total * 0.05 * 100) / 100);
      }
    });
  }
});
