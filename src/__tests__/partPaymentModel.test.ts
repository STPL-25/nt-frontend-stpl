import { describe, it, expect } from 'vitest';
import {
  amountOf, amountProblem, billKind, clampAdvances, heldBy2b, leftLine, parseAmount, payCap, reduceProblem,
} from '@/Application/Payment/partPaymentModel';
import type { PayableBillNet, PaymentInvoiceFigures } from '@/Services/GrnService/paymentNetApi';

// Part payments (sql/70): what can be paid on a bill today, what was typed, and what an approver may cut.

const bill = (over: Partial<PayableBillNet> = {}): PayableBillNet => ({
  bill_sno: 10, invoice_sno: 9, bill_no: 'INV-2026-000006', supplier_invoice_no: 'inv1256', po_no: 'PO-1', vendor_sno: 101, vendor_name: 'KANINI',
  invoice_date: '2026-10-02', due_date: null, bucket_type: 'GOODS', net_payable: 85000, hold_amount: 0, paid_amount: 0, reserved_amount: 0,
  outstanding: 85000, invoice_amount: 85000, taxable_value: 72033.9, tds_section_code: null, itc_status: null, payment_hold_override: null,
  gst_supplier: true, gst_booked: false, grn_state: 'Done', on_hold_2b: false, ...over,
});
const fig = (over: Partial<PaymentInvoiceFigures> = {}): PaymentInvoiceFigures => ({
  invoice_sno: 9, invoice_no: 'INV-9', supplier_invoice_no: 'S-9', invoice_amount: 10000, gst_amount: null, payable_total: 10000, paid_other: 0,
  this_amount: 10000, balance_after: 0, on_hold_2b: false, hold_2b: 0, ...over,
});

describe('payCap - the most that can be paid on a bill today', () => {
  it('is the whole outstanding amount while nothing is held back', () => {
    expect(payCap(bill())).toBe(85000);
    expect(payCap(bill({ payable_now: 85000 }))).toBe(85000);
  });
  it('is the taxable part while the invoice is not in GSTR-2B (payable_now), never below zero', () => {
    expect(payCap(bill({ on_hold_2b: true, payable_now: 72033.9 }))).toBe(72033.9);
    expect(payCap(bill({ payable_now: -3 }))).toBe(0);
  });
});

describe('heldBy2b - a bill that cannot be paid at all yet', () => {
  it('is closed when it is not in 2B and nothing of it may be paid now', () => {
    expect(heldBy2b(bill({ on_hold_2b: true, payable_now: 0 }))).toBe(true);
  });
  it('is open when its taxable part can be paid before 2B', () => {
    expect(heldBy2b(bill({ on_hold_2b: true, payable_now: 72033.9 }))).toBe(false);
  });
  it('is open when 2B is not an issue, and closed on a database that has no payable_now yet (as it always was)', () => {
    expect(heldBy2b(bill({ on_hold_2b: false }))).toBe(false);
    expect(heldBy2b(bill({ on_hold_2b: true }))).toBe(true);
  });
});

describe('amountOf / amountProblem - what is typed for a bill', () => {
  const b = bill({ on_hold_2b: true, payable_now: 72033.9 });
  it('pays everything that can be paid unless something smaller was typed', () => {
    expect(amountOf(b, {})).toBe(72033.9);
    expect(amountOf(b, { 10: '20000' })).toBe(20000);
    expect(amountProblem(b, {})).toBe('');
    expect(amountProblem(b, { 10: '20000' })).toBe('');
  });
  it('refuses nothing, zero or text', () => {
    expect(amountProblem(b, { 10: '' })).toMatch(/Enter the amount/);
    expect(amountProblem(b, { 10: '0' })).toMatch(/Enter the amount/);
    expect(amountProblem(b, { 10: '.' })).toMatch(/Enter the amount/);
    expect(amountOf(b, { 10: '' })).toBe(0);
  });
  it('says the GST part follows once 2B has the invoice when the amount goes beyond the taxable part', () => {
    expect(amountProblem(b, { 10: '80000' })).toMatch(/At most/);
  });
  it('says what is left when the amount is more than the invoice has outstanding', () => {
    expect(amountProblem(bill({ outstanding: 500, payable_now: 500 }), { 10: '900' })).toMatch(/At most 500.00 is left/);
  });
  it('allows a rupee-cent of rounding over the cap', () => {
    expect(amountProblem(bill({ outstanding: 500 }), { 10: '500.004' })).toBe('');
  });
});

describe('billKind - full or part', () => {
  it('is a part payment when something stays on the invoice, with the amount left', () => {
    expect(billKind(bill(), 20000)).toEqual({ part: true, left: 65000 });
  });
  it('is full when the whole outstanding amount is paid and nothing was paid before', () => {
    expect(billKind(bill(), 85000)).toEqual({ part: false, left: 0 });
  });
  it('is a part payment even when it clears what is left, if earlier payments were made (the last part)', () => {
    expect(billKind(bill({ outstanding: 30000, paid_amount: 55000 }), 30000)).toEqual({ part: true, left: 0 });
  });
});

describe('clampAdvances - an advance never nets off more than is being paid', () => {
  it('leaves advances alone when they fit', () => {
    const adv = { 1: '500', 2: '300' };
    expect(clampAdvances(adv, 1000)).toBe(adv);
  });
  it('takes the excess off the newest advance first', () => {
    expect(clampAdvances({ 1: '500', 2: '300' }, 600)).toEqual({ 1: '500', 2: '100' });
    expect(clampAdvances({ 1: '500', 2: '300' }, 400)).toEqual({ 1: '400', 2: '' });
  });
  it('clears them all when nothing is being paid', () => {
    expect(clampAdvances({ 1: '500' }, 0)).toEqual({ 1: '' });
  });
});

describe('reduceProblem - the approver pays less now', () => {
  const two = [fig(), fig({ invoice_sno: 10, invoice_no: 'INV-10', this_amount: 4000, payable_total: 4000 })];
  it('is fine when at least one invoice is reduced and something is still paid', () => {
    expect(reduceProblem(two, { 9: '6000' })).toBe('');
    expect(reduceProblem(two, { 9: '0' })).toBe('');   // leave INV-9 out, still paying INV-10
  });
  it('wants a change before it can be sent', () => {
    expect(reduceProblem(two, {})).toMatch(/Nothing is reduced/);
    expect(reduceProblem(two, { 9: '10000' })).toMatch(/Nothing is reduced/);
  });
  it('can only reduce, never raise', () => {
    expect(reduceProblem(two, { 9: '12000' })).toMatch(/only be reduced/);
  });
  it('refuses a blank or non-number', () => {
    expect(reduceProblem(two, { 9: '' })).toMatch(/Enter an amount for S-9/);
    expect(reduceProblem(two, { 9: 'abc' })).toMatch(/Enter an amount/);
  });
  it('does not let every invoice be taken out - that is a reject / cancel', () => {
    expect(reduceProblem(two, { 9: '0', 10: '0' })).toMatch(/reject or cancel/);
  });
});

describe('leftLine / parseAmount', () => {
  it('says what stays on the invoice, and the GST that waits for 2B', () => {
    expect(leftLine(0, false)).toBe('Nothing left on this invoice');
    expect(leftLine(12966.1, false)).toBe('₹12,966.10 stays on the invoice');
    expect(leftLine(12966.1, true, 12966.1)).toBe('₹12,966.10 stays on the invoice (of which ₹12,966.10 GST waits for GSTR-2B)');
  });
  it('reads amounts with thousands separators, NaN for nothing', () => {
    expect(parseAmount('1,25,000.50')).toBe(125000.5);
    expect(Number.isNaN(parseAmount(''))).toBe(true);
    expect(Number.isNaN(parseAmount(undefined))).toBe(true);
  });
});
