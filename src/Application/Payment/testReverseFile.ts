// DEVELOPMENT ONLY - never shipped: PaymentHistory loads this file with a dynamic import inside `if (import.meta.env.DEV)`, so a
// production build drops it.
//
// Writes a pretend reverse file for a payment run - what the bank would send back for its upload file - so the reverse-file upload
// can be tried without the bank. Same layout as the sample in docs/payment_reverse_file: a header line, one line per NEFT / RTGS
// transfer, matched on the reference the upload file carried.

import type { BankLineStatus, PaymentBatch, PaymentBatchItem } from '@/Services/GrnService/paymentNetApi';
import { inBankFile } from './paymentRunModel';

export const TEST_STATUSES: BankLineStatus[] = ['PAID', 'REJECTED', 'RETURNED', 'PENDING'];

/** The run's transfers that are in its bank file, with the reference the file gave them. */
export const testableLines = (items: PaymentBatchItem[]): PaymentBatchItem[] =>
  items.filter((i) => inBankFile({ channel: i.channel, mode: i.mode ?? '' }) && i.reference);

/** Every status in turn - PAID, REJECTED, RETURNED, PENDING - so a run of four or more transfers shows all of them. */
export const defaultTestStatuses = (lines: PaymentBatchItem[]): Record<number, BankLineStatus> =>
  Object.fromEntries(lines.map((l, k) => [l.batch_item_sno ?? l.line_no, TEST_STATUSES[k % TEST_STATUSES.length]]));

const REASONS: Partial<Record<BankLineStatus, [string, string]>> = {
  REJECTED: ['AC01', 'Invalid beneficiary account number - not debited (TEST)'],
  RETURNED: ['AC04', 'Beneficiary account closed - amount credited back (TEST)'],
  PENDING: ['', 'In process at the bank (TEST)'],
};
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const ddmmyyyy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const dayOfYear = (d: Date) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
const cell = (v: unknown) => String(v ?? '').replace(/[\r\n,]+/g, ' ').replace(/ {2,}/g, ' ').trim();

/** A made-up UTR in the bank's shape: NEFT 16 characters, RTGS 22 (prefix TEST so it is never taken for a real one). */
export const testUtr = (mode: string | null | undefined, when: Date, seq: number): string => {
  const yy = String(when.getFullYear()).slice(-2);
  return String(mode ?? '').toUpperCase() === 'RTGS'
    ? `TESTR5${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}${pad(seq, 8)}`
    : `TESTN${yy}${pad(dayOfYear(when), 3)}${pad(seq, 6)}`;
};

/**
 * @param statuses  batch_item_sno -> the answer to pretend for it (a line left out gets no answer, like a bank that skipped it)
 * @returns { file_name, content } - CSV with a header line
 */
export function buildTestReverseFile(batch: Pick<PaymentBatch, 'batch_no' | 'file_name' | 'batch_date'>, items: PaymentBatchItem[],
  statuses: Record<number, BankLineStatus | ''>, now = new Date()): { file_name: string; content: string } {
  const lines = testableLines(items);
  const paidOn = ddmmyyyy(now);
  const nextDay = new Date(now.getTime() + 86400000);
  const header = ['File Name', 'Line No', 'Transaction Type', 'Beneficiary Account No', 'Amount', 'Beneficiary Name', 'Customer Reference No', 'Payment Date',
    'Beneficiary IFSC', 'Status', 'UTR No', 'Bank Reference No', 'Debit Date', 'Credit / Return Date Time', 'Reason Code', 'Reason'];
  const rows = lines.flatMap((it, k) => {
    const st = statuses[it.batch_item_sno ?? it.line_no];
    if (!st) return [];
    const [code, reason] = REASONS[st] ?? ['', 'Credited to beneficiary (TEST)'];
    const sent = st !== 'REJECTED';                   // a rejected transfer never left the account
    return [[
      batch.file_name, k + 1, String(it.mode ?? '').toUpperCase() === 'RTGS' ? 'R' : 'N', it.account_no, Number(it.amount).toFixed(2),
      it.beneficiary_name ?? it.vendor_name, it.reference, String(batch.batch_date ?? '').slice(0, 10).split('-').reverse().join('/'),
      it.ifsc, st, sent ? testUtr(it.mode, now, k + 1) : '', `TEST${pad(k + 1, 6)}`, sent ? paidOn : '',
      st === 'PAID' ? `${paidOn} 11:${pad(10 + k)}:00` : st === 'RETURNED' ? `${ddmmyyyy(nextDay)} 10:15:00` : '',
      code, reason,
    ].map(cell).join(',')];
  });
  const stem = String(batch.file_name || batch.batch_no || 'payment-run');
  return { file_name: `${stem}_TEST_REVERSE.csv`, content: [header.join(','), ...rows].join('\r\n') };
}
