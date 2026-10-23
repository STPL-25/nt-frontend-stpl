import type { PaymentEntry, PaymentEntryLine, PaymentSender } from '@/Services/GrnService/paymentNetApi';

// Pure rules behind the Payment Run screen (sql/65): in which order the approved payments are offered, which of them
// today's fund plan covers, and how a fund amount is typed ("50 lakh"). The server decides what a payment's due date is
// (MSME statutory limit from receipt, else the invoice's own due date); here it is only ranked and fitted to the fund.

export type PriorityMode = 'MSME_FIRST' | 'DUE_DATE' | 'OLDEST_RECEIPT';

export const PRIORITY_MODES: { value: PriorityMode; label: string; hint: string }[] = [
  { value: 'MSME_FIRST', label: 'MSME first', hint: 'Micro, then Small, then Medium MSME suppliers, then the rest - within each, earliest due date, then oldest gate entry / GRN' },
  { value: 'DUE_DATE', label: 'Earliest due date', hint: 'Overdue first, whoever the supplier is; MSME type breaks a tie' },
  { value: 'OLDEST_RECEIPT', label: 'Oldest goods received', hint: 'Whose goods came in (gate entry / GRN) longest ago comes first' },
];

const NO_DATE = '9999-12-31';
const day = (d: string | null | undefined): string => (d ? String(d).slice(0, 10) : NO_DATE);

type Key = (string | number)[];
const compare = (a: Key, b: Key): number => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
};

const keyOf = (e: PaymentEntry, mode: PriorityMode): Key => {
  const due = day(e.due_date);
  const recv = day(e.accepted_date);
  const tail = [Number(e.net_paid) || 0, e.payment_sno];
  if (mode === 'DUE_DATE') return [due, e.msme_tier, recv, ...tail];
  if (mode === 'OLDEST_RECEIPT') return [recv, e.msme_tier, due, ...tail];
  return [e.msme_tier, due, recv, ...tail];
};

/** The payments in the order they should be paid. */
export const rankEntries = (entries: PaymentEntry[], mode: PriorityMode): PaymentEntry[] =>
  [...entries].sort((a, b) => compare(keyOf(a, mode), keyOf(b, mode)));

/** Why a payment cannot go in a run right now (empty = it can). A bank transfer needs the supplier's account. */
export const blockReason = (e: PaymentEntry): string =>
  e.channel === 'BANK' && !e.bank_ready ? "The supplier's bank account number / IFSC is missing - update the supplier KYC" : '';

/** The payment modes the bank file can carry (NEFT = N, RTGS = R - see grn-service paymentFile.js). UPI, cheque, cash and DD are paid another way. */
export const BANK_FILE_MODES = ['NEFT', 'RTGS'];

/** True when the payment is a line of the bank file: a bank transfer by NEFT / RTGS. */
export const inBankFile = (e: Pick<PaymentEntry, 'channel' | 'mode'>): boolean =>
  e.channel === 'BANK' && BANK_FILE_MODES.includes(String(e.mode ?? '').toUpperCase());

/** Why a payment is not a line of the bank file ('' when it is). */
export const notInFileReason = (e: Pick<PaymentEntry, 'channel' | 'mode'>): string => {
  if (inBankFile(e)) return '';
  if (e.channel === 'MANUAL') return 'Cheque / cash / DD';
  if (e.channel === 'PORTAL') return 'Supplier portal';
  if (e.channel === 'ADJUSTMENT') return 'Nothing to pay out';
  return `${e.mode} - not in the bank file`;
};

/** The account the run is paid from: the one the user chose if it is still offered, else the company's default, else the only one. null = the user has to choose. */
export const pickSender = (senders: PaymentSender[], chosen: string): PaymentSender | null =>
  senders.find((s) => String(s.payment_bank_sno) === chosen)
  ?? senders.find((s) => s.is_default === 'Y')
  ?? (senders.length === 1 ? senders[0] : null);

/** "HDFC Current A/c · HDFC BANK LIMITED ••••5678" */
export const senderLabel = (s: Pick<PaymentSender, 'profile_name' | 'bank_name' | 'ac_last4'>): string => `${s.profile_name} · ${s.bank_name} ••••${s.ac_last4}`;

/** What stops a run that has `fileLines` bank transfers from being paid, or null: no account to pay from, or more than one and none chosen. */
export const senderProblem = (fileLines: number, senders: PaymentSender[], chosen: string): string | null => {
  if (fileLines === 0) return null;
  if (senders.length === 0) return 'No bank account to pay from is set up for this company. Add one in Masters > Payment Bank, then come back.';
  return pickSender(senders, chosen) ? null : 'Choose the bank account to pay from.';
};

export const toPaise = (n: number | string | null | undefined): number => Math.round((Number(n) || 0) * 100);
const fromPaise = (p: number): number => p / 100;

export type FundVerdict = 'PAY' | 'SHORT' | 'BLOCKED';

export interface FundPlan {
  /** payment_sno of the payments the fund covers */
  picked: Set<number>;
  verdict: Map<number, FundVerdict>;
  /** SHORT payments: how much more fund they needed when their turn came */
  needs: Map<number, number>;
  used: number;
  left: number;
}

/**
 * Walks the ranked payments and takes each one the fund still covers. A payment that does not fit is skipped - not a
 * stop sign - so a smaller one further down can still use the money; the skipped ones are reported with how much more
 * fund they needed. A payment that cannot be paid at all (no bank details) is never taken.
 */
export const planFund = (ranked: PaymentEntry[], fund: number): FundPlan => {
  let left = toPaise(fund);
  const total = left;
  const picked = new Set<number>();
  const verdict = new Map<number, FundVerdict>();
  const needs = new Map<number, number>();
  for (const e of ranked) {
    if (blockReason(e)) { verdict.set(e.payment_sno, 'BLOCKED'); continue; }
    const amt = toPaise(e.net_paid);
    if (amt <= left) {
      picked.add(e.payment_sno);
      verdict.set(e.payment_sno, 'PAY');
      left -= amt;
    } else {
      verdict.set(e.payment_sno, 'SHORT');
      needs.set(e.payment_sno, fromPaise(amt - left));
    }
  }
  return { picked, verdict, needs, used: fromPaise(total - left), left: fromPaise(left) };
};

export const totalOf = (entries: PaymentEntry[], ids: Set<number>): number =>
  fromPaise(entries.reduce((s, e) => (ids.has(e.payment_sno) ? s + toPaise(e.net_paid) : s), 0));

export const groupLines = (lines: PaymentEntryLine[]): Map<number, PaymentEntryLine[]> => {
  const m = new Map<number, PaymentEntryLine[]>();
  for (const l of lines) m.set(l.payment_sno, [...(m.get(l.payment_sno) ?? []), l]);
  return m;
};

export type DueTone = 'neutral' | 'warning' | 'danger';
/** "Overdue 12 days" / "Due today" / "Due in 5 days" - the amber window is the coming week. */
export const dueState = (e: Pick<PaymentEntry, 'due_date' | 'days_to_due'>): { text: string; tone: DueTone } => {
  if (!e.due_date || e.days_to_due == null) return { text: 'No due date', tone: 'neutral' };
  const d = Number(e.days_to_due);
  const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
  if (d < 0) return { text: `Overdue ${plural(-d)}`, tone: 'danger' };
  if (d === 0) return { text: 'Due today', tone: 'warning' };
  return { text: `Due in ${plural(d)}`, tone: d <= 7 ? 'warning' : 'neutral' };
};

/** The MSME chip text and what it means for the due date; null for a supplier that is not an MSME. */
export const msmeNote = (e: Pick<PaymentEntry, 'msme_class' | 'msme_label' | 'statutory_due_date'>, limitDays: number): { label: string; hint: string } | null => {
  if (!e.msme_class) return null;
  const label = e.msme_class === 'MSME' ? 'MSME' : `${e.msme_label ?? e.msme_class} MSME`;
  if (e.msme_class === 'MEDIUM') return { label, hint: 'Medium enterprise - the MSME statutory payment limit does not apply, normal due date used' };
  const by = e.statutory_due_date ? ` - pay by ${day(e.statutory_due_date)}` : '';
  const unknown = e.msme_class === 'MSME' ? ' (MSME type not recorded, treated as Micro / Small)' : '';
  return { label, hint: `Statutory limit ${limitDays} days from goods received${by}${unknown}` };
};

const UNIT: Record<string, number> = { k: 1e3, thousand: 1e3, l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };

/** "50,00,000", "50 lakh", "50L", "1.5 cr", "₹75k" -> rupees; null when it is not an amount. */
export const parseAmountInput = (raw: string): number | null => {
  const s = String(raw ?? '').toLowerCase().replace(/rs\.?/g, '').replace(/[₹,\s]/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(k|thousand|l|lac|lacs|lakh|lakhs|cr|crore|crores)?$/);
  if (!m) return null;
  const n = Math.round(Number(m[1]) * (UNIT[m[2] ?? ''] ?? 1) * 100) / 100;
  return n > 0 ? n : null;
};

const trim = (n: number) => String(Math.round(n * 100) / 100);
/** 5000000 -> "50 Lakh", 12500000 -> "1.25 Crore"; '' below a lakh. */
export const amountInWords = (n: number): string => {
  if (!Number.isFinite(n) || n < 1e5) return '';
  return n >= 1e7 ? `${trim(n / 1e7)} Crore` : `${trim(n / 1e5)} Lakh`;
};

export const rupees = (n: number | string | null | undefined): string =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
