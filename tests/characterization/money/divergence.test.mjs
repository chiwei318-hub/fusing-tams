import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderFinanceTrigger,
  financialsAutoCreateTrigger,
  financialsCalcJs,
  monthlyBillingGenerateExclusive,
  monthlyBillingInvoiceInclusive,
  autoInvoiceExclusive,
  invoicePdfInclusive,
} from "./formulas.mjs";

/**
 * SAME INPUT → DIFFERENT OUTPUT evidence.
 * These tests PASS when divergence still exists (characterization of current prod).
 */

describe("characterization: SAME total_fee=10000 → divergent paths", () => {
  const TOTAL = 10000;
  const DRIVER_RATE = 800;

  it("snapshot: all path outputs for TOTAL=10000", () => {
    const trigger = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE });
    const finTrig = financialsAutoCreateTrigger({ total_fee: TOTAL });
    const finJs = financialsCalcJs({ total_fee: TOTAL });
    const mbEx = monthlyBillingGenerateExclusive(TOTAL);
    const mbIn = monthlyBillingInvoiceInclusive(TOTAL);
    const invEx = autoInvoiceExclusive(TOTAL);
    const invIn = invoicePdfInclusive(TOTAL);

    const snapshot = {
      order_finance_trigger: {
        vat: trigger.vat_amount,
        cost: trigger.cost_amount,
        profit: trigger.profit_amount,
        tax_basis: "inclusive_reverse",
      },
      financials_auto_create: {
        ar_grand: finTrig.ar_grand_total,
        ap: finTrig.ap_total,
        profit: finTrig.platform_profit,
        note: "profit=total*0.15 ignores driver_pay_rate",
      },
      financials_calc_js: {
        ar_tax: finJs.ar_tax,
        ar_grand: finJs.ar_grand_total,
        ap: finJs.ap_total,
        profit: finJs.platform_profit,
        tax_basis: "exclusive_add",
      },
      monthly_billing_generate: mbEx,
      monthly_billing_invoice_from_bill: mbIn,
      auto_invoice: invEx,
      invoice_pdf: invIn,
    };

    // Freeze observed numbers — update only when intentional prod change
    assert.equal(snapshot.order_finance_trigger.vat, 476.19);
    assert.equal(snapshot.order_finance_trigger.profit, 8723.81);
    assert.equal(snapshot.financials_auto_create.profit, 1500);
    assert.equal(snapshot.financials_calc_js.ar_tax, 500);
    assert.equal(snapshot.financials_calc_js.profit, 2000); // 10000 - 8000
    assert.equal(snapshot.monthly_billing_generate.taxAmount, 500);
    assert.equal(snapshot.monthly_billing_invoice_from_bill.taxAmount, 476);
    assert.equal(snapshot.auto_invoice.taxAmount, 500);
    assert.equal(snapshot.invoice_pdf.taxAmount, 476);
  });

  it("PROVES divergence: trigger VAT ≠ financials JS VAT ≠ monthly exclusive", () => {
    const tVat = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE }).vat_amount;
    const fVat = financialsCalcJs({ total_fee: TOTAL }).ar_tax;
    const mVat = monthlyBillingGenerateExclusive(TOTAL).taxAmount;
    assert.notEqual(tVat, fVat);
    assert.notEqual(tVat, mVat);
    assert.equal(fVat, mVat); // both exclusive 5% on 10000
  });

  it("PROVES divergence: trigger profit ≠ financials auto_create profit", () => {
    const tProfit = orderFinanceTrigger({ total_fee: TOTAL, driver_pay_rate: DRIVER_RATE }).profit_amount;
    const fProfit = financialsAutoCreateTrigger({ total_fee: TOTAL }).platform_profit;
    assert.notEqual(tProfit, fProfit);
    assert.equal(tProfit, 8723.81);
    assert.equal(fProfit, 1500);
  });

  it("PROVES monthlyBilling self-conflict: exclusive generate vs inclusive invoice path", () => {
    // If generate stores totalWithTax = total+tax, then invoice inclusive on that amount
    // differs from exclusive tax on original total — document both formulas on SAME raw total.
    const ex = monthlyBillingGenerateExclusive(TOTAL);
    const inc = monthlyBillingInvoiceInclusive(TOTAL);
    assert.notEqual(ex.taxAmount, inc.taxAmount);
    assert.equal(ex.basis, "exclusive");
    assert.equal(inc.basis, "inclusive");
  });

  it("PROVES autoInvoice exclusive ≠ invoicePdf inclusive on same amount", () => {
    assert.notEqual(
      autoInvoiceExclusive(TOTAL).taxAmount,
      invoicePdfInclusive(TOTAL).taxAmount,
    );
  });
});

describe("characterization: VAT basis matrix (total_fee fixtures)", () => {
  for (const total of [0, 1000, 10000, 100000]) {
    it(`total=${total} inclusive vs exclusive tax amounts`, () => {
      const inc = orderFinanceTrigger({ total_fee: total > 0 ? total : null, driver_pay_rate: 0 }).vat_amount;
      const ex = total > 0 ? monthlyBillingGenerateExclusive(total).taxAmount : 0;
      if (total === 0) {
        assert.equal(inc, 0);
        assert.equal(ex, 0);
      } else {
        // inclusive reverse vs exclusive add differ except edge cases
        if (total === 1000) {
          assert.equal(inc, 47.62);
          assert.equal(ex, 50);
        }
      }
    });
  }
});
