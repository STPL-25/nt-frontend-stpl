import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import type {
  BankFailure, BankLineStatus, PaymentBatch, PaymentBatchItem, ReverseAction, ReverseResultCode, RetryMode,
} from '@/Services/GrnService/paymentNetApi';
import { inBankFile } from './paymentRunModel';

// The bank's answer to a payment run's upload file - the reverse file (grn-service sql/83): what the bank paid (with the UTR),
// what it still has, and what it did not pay (those payments went back to Make payment).

interface Meta { label: string; tone: Tone }

/** One line of the bank's summary of a run, worst first; null for a run with no NEFT / RTGS transfer. */
export const runBankState = (b: Pick<PaymentBatch, 'bank_lines' | 'bank_paid' | 'bank_pending' | 'bank_failed' | 'bank_unconfirmed'>): Meta | null => {
  const lines = Number(b.bank_lines) || 0;
  if (lines === 0) return null;
  const failed = Number(b.bank_failed) || 0;
  const pending = Number(b.bank_pending) || 0;
  const waiting = Number(b.bank_unconfirmed) || 0;
  if (failed > 0) return { label: `${failed} not paid by bank`, tone: 'danger' };
  if (waiting === lines) return { label: 'Awaiting bank reply', tone: 'neutral' };
  if (pending > 0) return { label: `${pending} pending at bank`, tone: 'warning' };
  if (waiting > 0) return { label: `${waiting} awaiting bank reply`, tone: 'info' };
  return { label: 'Bank paid all', tone: 'success' };
};

export const BANK_STATUS_META: Record<BankLineStatus, Meta> = {
  PAID: { label: 'Paid by bank', tone: 'success' },
  PENDING: { label: 'Pending at bank', tone: 'warning' },
  REJECTED: { label: 'Rejected by bank', tone: 'danger' },
  RETURNED: { label: 'Returned by bank', tone: 'danger' },
};

/** A run line's bank state; null when it was not in the bank file (cheque, portal ...). */
export const itemBankState = (it: Pick<PaymentBatchItem, 'bank_status' | 'channel' | 'mode'>): Meta | null => {
  if (it.bank_status) return BANK_STATUS_META[it.bank_status];
  return inBankFile({ channel: it.channel, mode: it.mode ?? '' }) ? { label: 'Awaiting bank reply', tone: 'neutral' } : null;
};

export const isNotPaid = (s: BankLineStatus | null | undefined): boolean => s === 'REJECTED' || s === 'RETURNED';

export const REVERSE_ACTION_META: Record<ReverseAction, Meta> = {
  MARK_PAID: { label: 'Mark paid', tone: 'success' },
  UPDATE_UTR: { label: 'New UTR', tone: 'info' },
  MARK_PENDING: { label: 'Pending', tone: 'warning' },
  RETURN_TO_RUN: { label: 'Not paid · back to Make payment', tone: 'danger' },
  NO_CHANGE: { label: 'No change', tone: 'neutral' },
  IGNORED: { label: 'Older answer · not used', tone: 'neutral' },
};

export const RESULT_META: Record<ReverseResultCode, Meta> = {
  PAID: { label: 'Paid', tone: 'success' },
  UPDATED: { label: 'UTR updated', tone: 'info' },
  PENDING: { label: 'Pending', tone: 'warning' },
  FAILED: { label: 'Back to Make payment', tone: 'danger' },
  UNCHANGED: { label: 'No change', tone: 'neutral' },
  IGNORED: { label: 'Not used', tone: 'neutral' },
  ERROR: { label: 'Not applied', tone: 'danger' },
};

/** "Rejected by the bank in PB-2026-000021 · AC01 Invalid beneficiary account" */
export const bankFailureText = (f: Pick<BankFailure, 'bank_status' | 'batch_no' | 'bank_reason_code' | 'bank_reason'>): string => {
  const reason = [f.bank_reason_code, f.bank_reason].filter(Boolean).join(' ');
  return `${f.bank_status === 'RETURNED' ? 'Returned' : 'Rejected'} by the bank in ${f.batch_no}${reason ? ` · ${reason}` : ''}`;
};

export const RETRY_MODE_LABEL: Record<RetryMode, string> = {
  NEFT: 'NEFT (bank file)', RTGS: 'RTGS (bank file, ₹2 lakh and above)', CHEQUE: 'Cheque', DD: 'Demand draft', CASH: 'Cash',
};
/** RTGS is for ₹2,00,000 and above (the database refuses it below). '' when the mode is fine. */
export const retryModeProblem = (mode: string, net: number): string =>
  mode === 'RTGS' && (Number(net) || 0) < 200000 ? 'RTGS is for ₹2,00,000 and above - use NEFT for a smaller amount.' : '';

/** "dd Mon yyyy, hh:mm" from the 'yyyy-mm-dd hh:mm:ss' the database sends (shown as written - it is the bank's time). */
export const bankWhen = (s: string | null | undefined): string => {
  if (!s) return '';
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(s);
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const t = String(s).slice(11, 16);
  return t && t !== '00:00' ? `${day}, ${t}` : day;
};

/** A reverse file is text (CSV / TXT); refuse anything else before it is read. */
export const REVERSE_FILE_ACCEPT = '.csv,.txt,.rev,text/csv,text/plain';
export const REVERSE_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const reverseFileProblem = (f: Pick<File, 'name' | 'size'>): string => {
  if (f.size > REVERSE_FILE_MAX_BYTES) return 'The file is larger than 2 MB - a reverse file is one line per transfer.';
  if (/\.(xlsx?|pdf|zip|docx?)$/i.test(f.name)) return 'Save the bank\'s reverse file as CSV (or text) and choose that.';
  return '';
};
