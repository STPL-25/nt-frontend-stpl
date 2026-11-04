import { describe, expect, it } from 'vitest';
import type { PaymentBatchItem } from '@/Services/GrnService/paymentNetApi';
import {
  bankFailureText, bankWhen, isNotPaid, itemBankState, retryModeProblem, reverseFileProblem, runBankState,
} from '@/Application/Payment/bankReplyModel';
import { buildTestReverseFile, defaultTestStatuses, testUtr, testableLines } from '@/Application/Payment/testReverseFile';

const run = (o: Partial<Record<'bank_lines' | 'bank_paid' | 'bank_pending' | 'bank_failed' | 'bank_unconfirmed', number>>) =>
  ({ bank_lines: 4, bank_paid: 0, bank_pending: 0, bank_failed: 0, bank_unconfirmed: 0, ...o });

describe('runBankState - the bank reply on a run, worst first', () => {
  it('reads the counts', () => {
    expect(runBankState(run({ bank_lines: 0 }))).toBeNull();
    expect(runBankState(run({ bank_unconfirmed: 4 }))).toEqual({ label: 'Awaiting bank reply', tone: 'neutral' });
    expect(runBankState(run({ bank_paid: 2, bank_failed: 1, bank_pending: 1 }))).toEqual({ label: '1 not paid by bank', tone: 'danger' });
    expect(runBankState(run({ bank_paid: 3, bank_pending: 1 }))).toEqual({ label: '1 pending at bank', tone: 'warning' });
    expect(runBankState(run({ bank_paid: 3, bank_unconfirmed: 1 }))).toEqual({ label: '1 awaiting bank reply', tone: 'info' });
    expect(runBankState(run({ bank_paid: 4 }))).toEqual({ label: 'Bank paid all', tone: 'success' });
    expect(runBankState({})).toBeNull();
  });
});

describe('line state and helpers', () => {
  it('a line not in the bank file has no bank state', () => {
    expect(itemBankState({ bank_status: null, channel: 'MANUAL', mode: 'Cheque' })).toBeNull();
    expect(itemBankState({ bank_status: null, channel: 'BANK', mode: 'NEFT' })?.label).toBe('Awaiting bank reply');
    expect(itemBankState({ bank_status: 'RETURNED', channel: 'BANK', mode: 'NEFT' })).toEqual({ label: 'Returned by bank', tone: 'danger' });
    expect([isNotPaid('REJECTED'), isNotPaid('RETURNED'), isNotPaid('PAID'), isNotPaid(null)]).toEqual([true, true, false, false]);
  });

  it('says why a payment was not paid', () => {
    expect(bankFailureText({ bank_status: 'REJECTED', batch_no: 'PB-2026-000021', bank_reason_code: 'AC01', bank_reason: 'Invalid account' }))
      .toBe('Rejected by the bank in PB-2026-000021 · AC01 Invalid account');
    expect(bankFailureText({ bank_status: 'RETURNED', batch_no: 'PB-1', bank_reason_code: null, bank_reason: null })).toBe('Returned by the bank in PB-1');
  });

  it('RTGS only from Rs 2 lakh; a reverse file must be text and small', () => {
    expect(retryModeProblem('RTGS', 199999.99)).toMatch(/2,00,000/);
    expect(retryModeProblem('RTGS', 200000)).toBe('');
    expect(retryModeProblem('CHEQUE', 10)).toBe('');
    expect(reverseFileProblem({ name: 'rev.xlsx', size: 10 })).toMatch(/CSV/);
    expect(reverseFileProblem({ name: 'rev.csv', size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
    expect(reverseFileProblem({ name: 'SPACETEX.100.rev', size: 100 })).toBe('');
  });

  it('shows the bank time as written', () => {
    expect(bankWhen('2026-11-03 11:42:10')).toMatch(/3 Nov 2026, 11:42/);
    expect(bankWhen('2026-11-03')).toMatch(/^3 Nov 2026$/);
    expect(bankWhen(null)).toBe('');
  });
});

describe('test reverse file (development only)', () => {
  const item = (o: Partial<PaymentBatchItem>): PaymentBatchItem => ({
    payment_sno: 1, payment_no: 'PAY-1', line_no: 1, vendor_name: 'A', amount: 100, mode: 'NEFT', channel: 'BANK',
    beneficiary_name: 'A Ltd', account_no: '123', ifsc: 'HDFC0000001', invoice_nos: null, ...o,
  });
  const items = [
    item({ batch_item_sno: 11, line_no: 1, reference: '7-PAY1', amount: 48300 }),
    item({ batch_item_sno: 12, line_no: 2, reference: '8-PAY2', amount: 250000, mode: 'RTGS' }),
    item({ batch_item_sno: 13, line_no: 3, reference: null, mode: 'Cheque', channel: 'MANUAL' }),
    item({ batch_item_sno: 14, line_no: 4, reference: '9-PAY4', beneficiary_name: 'Comma, Co' }),
    item({ batch_item_sno: 15, line_no: 5, reference: '9-PAY5' }),
  ];
  const batch = { batch_no: 'PB-2026-000021', file_name: 'SPACETEX_SPA311_SPA3110311.100', batch_date: '2026-11-03T00:00:00.000Z' };
  const now = new Date(2026, 10, 3, 12, 0, 0);

  it('covers every status in turn on the file lines only', () => {
    const lines = testableLines(items);
    expect(lines.map((l) => l.batch_item_sno)).toEqual([11, 12, 14, 15]);
    expect(defaultTestStatuses(lines)).toEqual({ 11: 'PAID', 12: 'REJECTED', 14: 'RETURNED', 15: 'PENDING' });
  });

  it('writes the header-line CSV the upload reads, with made-up UTRs in the bank shape', () => {
    const f = buildTestReverseFile(batch, items, { 11: 'PAID', 12: 'REJECTED', 14: 'RETURNED', 15: '' }, now);
    expect(f.file_name).toBe('SPACETEX_SPA311_SPA3110311.100_TEST_REVERSE.csv');
    const rows = f.content.split('\r\n').map((r) => r.split(','));
    expect(rows[0]).toContain('Customer Reference No');
    expect(rows).toHaveLength(4);                                    // header + 3 (line 15 left out)
    const col = (name: string) => rows[0].indexOf(name);
    expect(rows.slice(1).map((r) => [r[col('Customer Reference No')], r[col('Status')], r[col('Amount')]]))
      .toEqual([['7-PAY1', 'PAID', '48300.00'], ['8-PAY2', 'REJECTED', '250000.00'], ['9-PAY4', 'RETURNED', '100.00']]);
    expect(rows[1][col('UTR No')]).toBe(testUtr('NEFT', now, 1));
    expect(rows[2][col('UTR No')]).toBe('');                         // rejected: never left the account
    expect(rows[3][col('Beneficiary Name')]).toBe('Comma Co');      // a comma would shift every column after it
    expect(rows[3][col('Reason Code')]).toBe('AC04');
    expect(rows[1][col('Payment Date')]).toBe('03/11/2026');
  });

  it('UTRs: NEFT 16 characters, RTGS 22', () => {
    expect(testUtr('NEFT', now, 1)).toBe('TESTN26307000001');
    expect(testUtr('NEFT', now, 1)).toHaveLength(16);
    expect(testUtr('RTGS', now, 2)).toBe('TESTR52026110300000002');
    expect(testUtr('RTGS', now, 2)).toHaveLength(22);
  });
});
