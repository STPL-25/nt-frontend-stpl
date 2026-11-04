import { describe, it, expect } from 'vitest';
import { amountProblem, channelOf, dueState, onlineProblem, payeeLabel, payeeProblem, portalUrl, runProblem, scopeKey, scopeLabel, totalOf } from '@/Application/Payment/statutoryModel';
import type { StatutoryPayable } from '@/Services/GrnService/paymentNetApi';

const p = (over: Partial<StatutoryPayable> = {}): StatutoryPayable => ({
  stat_sno: 1, kind: 'TDS', source_type: 'TDS', com_sno: 1, com_name: 'STPL', div_sno: 1, brn_sno: 1, head_name: 'TDS u/s 194C', ref_no: '194C', period_label: 'Oct 2026',
  party_name: 'NEO DIAMONDS', payment_sno: 5, payment_no: 'PAY-1', payee_sno: 2, payee_name: 'ITD', payee_ref: null, amount: 100, due_date: '2026-11-07', days_overdue: null,
  narration: null, status: 'Open', batch_sno: null, batch_no: null, paid_at: null, created_by: 'x', created_at: '2026-10-28 10:00:00', ...over,
});
const today = new Date(2026, 9, 28);   // 28 Oct 2026

describe('dueState', () => {
  it('reads overdue from the server count, due today / soon / later from the date, and no date as neutral', () => {
    expect(dueState(p({ due_date: '2026-10-20', days_overdue: 8 }), today)).toEqual({ text: 'Overdue 8 days', tone: 'danger' });
    expect(dueState(p({ due_date: '2026-10-27', days_overdue: 1 }), today)).toEqual({ text: 'Overdue 1 day', tone: 'danger' });
    expect(dueState(p({ due_date: '2026-10-28' }), today)).toEqual({ text: 'Due today', tone: 'warning' });
    expect(dueState(p({ due_date: '2026-11-04' }), today)).toEqual({ text: 'Due in 7 days', tone: 'warning' });
    expect(dueState(p({ due_date: '2026-11-07' }), today)).toEqual({ text: 'Due in 10 days', tone: 'neutral' });
    expect(dueState(p({ due_date: null }), today)).toEqual({ text: 'No due date', tone: 'neutral' });
  });
  it('still shows overdue when the server did not count it (a date in the past)', () => {
    expect(dueState(p({ due_date: '2026-10-25', days_overdue: null }), today)).toEqual({ text: 'Overdue 3 days', tone: 'danger' });
  });
});

describe('totalOf', () => {
  it('adds only the ticked amounts, exactly', () => {
    const list = [p({ stat_sno: 1, amount: 0.1 }), p({ stat_sno: 2, amount: 0.2 }), p({ stat_sno: 3, amount: 50 })];
    expect(totalOf(list, new Set([1, 2]))).toBe(0.3);
    expect(totalOf(list, new Set())).toBe(0);
  });
});

describe('runProblem', () => {
  it('needs something ticked', () => expect(runProblem([])).toMatch(/Tick/));
  it('refuses two kinds in one file', () => expect(runProblem([p(), p({ stat_sno: 2, kind: 'GST' })])).toMatch(/one kind/));
  it('refuses two company / division / branch scopes in one file', () => expect(runProblem([p(), p({ stat_sno: 2, brn_sno: 2 })])).toMatch(/one company, division and branch/));
  it('accepts one kind in one scope', () => expect(runProblem([p(), p({ stat_sno: 2 })])).toBe(''));
  it('never mixes a bank-file payee with an online one', () => {
    expect(runProblem([p({ pay_to_online: 'N' }), p({ stat_sno: 2, pay_to_online: 'Y' })])).toMatch(/online and some by bank file/);
  });
  it('pays one online payee at a time, and accepts amounts of the same online payee', () => {
    const on = (over: Partial<StatutoryPayable>) => p({ pay_to_online: 'Y', pay_to_sno: 7, ...over });
    expect(runProblem([on({}), on({ stat_sno: 2, pay_to_sno: 8 })])).toMatch(/one payee at a time/);
    expect(runProblem([on({}), on({ stat_sno: 2 })])).toBe('');
  });
});

describe('channelOf', () => {
  it('is online only when the payee says so; before sql/82 (no flag) everything is a bank payee', () => {
    expect(channelOf(p({ pay_to_online: 'Y' }))).toBe('ONLINE');
    expect(channelOf(p({ pay_to_online: 'N' }))).toBe('BANK');
    expect(channelOf(p())).toBe('BANK');
  });
});

describe('portalUrl', () => {
  it('adds https:// to a bare address and leaves a full one as it is', () => {
    expect(portalUrl(' eportal.incometax.gov.in ')).toBe('https://eportal.incometax.gov.in');
    expect(portalUrl('http://x.gov.in/pay')).toBe('http://x.gov.in/pay');
    expect(portalUrl('HTTPS://payment.gst.gov.in')).toBe('HTTPS://payment.gst.gov.in');
    expect(portalUrl('  ')).toBe('');
  });
});

describe('scope', () => {
  it('keys and labels a company / division / branch', () => {
    expect(scopeKey(p())).toBe('1|1|1');
    expect(scopeKey(p({ div_sno: null, brn_sno: null }))).toBe('1||');
    expect(scopeLabel(p())).toBe('STPL · Division 1 · Branch 1');
    expect(scopeLabel(p({ com_name: null, div_sno: null, brn_sno: null }))).toBe('Company 1');
  });
});

describe('payeeProblem', () => {
  const ok = { payee_name: 'Income Tax Department', ac_number: '000111222', ifsc: 'sbin0000001' };
  it('accepts a complete payee', () => expect(payeeProblem(ok)).toBeNull());
  it('asks for each missing or wrong part', () => {
    expect(payeeProblem({ ...ok, payee_name: ' ' })).toMatch(/name/);
    expect(payeeProblem({ ...ok, ac_number: '12ab' })).toMatch(/digits/);
    expect(payeeProblem({ ...ok, ac_number: '0001 1122 23' })).toBeNull();   // spaces are ignored
    expect(payeeProblem({ ...ok, ifsc: 'SBIN001' })).toMatch(/IFSC/);
  });
  it('an online payee needs its portal name and address, not a bank account', () => {
    const online = { payee_name: 'Income Tax e-Pay', ac_number: '', ifsc: '', pay_via_portal: true, payment_portal_name: 'Income Tax e-Filing', payment_portal_url: 'eportal.incometax.gov.in' };
    expect(payeeProblem(online)).toBeNull();
    expect(payeeProblem({ ...online, payment_portal_url: 'https://unifiedportal-emp.epfindia.gov.in/epfo/' })).toBeNull();
    expect(payeeProblem({ ...online, payment_portal_name: ' ' })).toMatch(/portal \/ website name/);
    expect(payeeProblem({ ...online, payment_portal_url: '' })).toMatch(/portal address/);
    expect(payeeProblem({ ...online, payment_portal_url: 'not a url' })).toMatch(/portal address/);
    expect(payeeProblem({ ...online, payment_portal_url: 'https://localhost' })).toMatch(/portal address/);
  });
});

describe('payeeLabel', () => {
  it('names an online payee as online and a bank payee by its last 4 digits', () => {
    expect(payeeLabel({ payee_name: 'GST portal', pay_via_portal: 'Y', ac_last4: null })).toBe('GST portal · online');
    expect(payeeLabel({ payee_name: 'ITD', pay_via_portal: 'N', ac_last4: '1222' })).toBe('ITD ••••1222');
    expect(payeeLabel({ payee_name: 'ITD', ac_last4: '1222' })).toBe('ITD ••••1222');
  });
});

describe('onlineProblem', () => {
  const ok = { mode: 'Net Banking', txnId: 'CIN-0510308-1', txnDate: '2026-11-02' };
  it('accepts a complete record', () => expect(onlineProblem(ok, '2026-11-03')).toBeNull());
  it('asks for a known mode, a clean challan number and a date that is not in the future', () => {
    expect(onlineProblem({ ...ok, mode: '' }, '2026-11-03')).toMatch(/how it was paid/);
    expect(onlineProblem({ ...ok, mode: 'Wallet' }, '2026-11-03')).toMatch(/how it was paid/);
    expect(onlineProblem({ ...ok, txnId: ' ' }, '2026-11-03')).toMatch(/challan/);
    expect(onlineProblem({ ...ok, txnId: 'A 1;' }, '2026-11-03')).toMatch(/letters, digits/);
    expect(onlineProblem({ ...ok, txnDate: '2026-11-04' }, '2026-11-03')).toMatch(/not in the future/);
    expect(onlineProblem({ ...ok, txnDate: '' }, '2026-11-03')).toMatch(/payment date/);
  });
});

describe('amountProblem', () => {
  const ok = { head_name: 'GSTR-3B', amount: '5000.50', com_sno: '1' };
  it('accepts a complete amount', () => expect(amountProblem(ok)).toBeNull());
  it('asks for the company, the purpose and a positive amount with at most two decimals', () => {
    expect(amountProblem({ ...ok, com_sno: '' })).toMatch(/company/);
    expect(amountProblem({ ...ok, head_name: '' })).toMatch(/for/);
    expect(amountProblem({ ...ok, amount: '0' })).toMatch(/above zero/);
    expect(amountProblem({ ...ok, amount: 'abc' })).toMatch(/above zero/);
    expect(amountProblem({ ...ok, amount: '10.123' })).toMatch(/two decimals/);
  });
});
