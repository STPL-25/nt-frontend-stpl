import { STATUTORY_ONLINE_MODES, type StatutoryKind, type StatutoryPayable, type StatutoryPayee, type StatutoryPayeeInput } from '@/Services/GrnService/paymentNetApi';

// Pure rules behind the Statutory Payments screen (grn-service sql/73 + sql/82): what each kind is called, which amounts can be paid
// together (one kind, one company/division/branch; a bank file and an online payment never mix), how due dates read, and what a
// payee / a keyed-in amount / an online payment record must have.

export const KINDS: { value: StatutoryKind; label: string; short: string; hint: string }[] = [
  { value: 'TDS', label: 'TDS payable', short: 'TDS', hint: 'Tax deducted from supplier payments - owed to the Income Tax Department by the 7th of the next month (30 April for March).' },
  { value: 'GST', label: 'GST payable', short: 'GST', hint: 'GST owed to the GST department. Key the amount in; GST held on supplier bills until GSTR-2B stays with the bill.' },
  { value: 'OTHER', label: 'Others', short: 'Other', hint: 'Any other statutory amount - Provident Fund, ESI, professional tax and the like.' },
];

const IFSC = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

/** "Overdue 12 days" / "Due today" / "Due in 5 days" / "No due date"; the amber window is the coming week. */
export const dueState = (p: Pick<StatutoryPayable, 'due_date' | 'days_overdue'>, today: Date = new Date()): { text: string; tone: 'neutral' | 'warning' | 'danger' } => {
  if (!p.due_date) return { text: 'No due date', tone: 'neutral' };
  const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
  if (p.days_overdue != null && p.days_overdue > 0) return { text: `Overdue ${plural(p.days_overdue)}`, tone: 'danger' };
  const due = new Date(`${String(p.due_date).slice(0, 10)}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = Math.round((due.getTime() - start.getTime()) / 86400000);
  if (Number.isNaN(d)) return { text: 'No due date', tone: 'neutral' };
  if (d < 0) return { text: `Overdue ${plural(-d)}`, tone: 'danger' };
  if (d === 0) return { text: 'Due today', tone: 'warning' };
  return { text: `Due in ${plural(d)}`, tone: d <= 7 ? 'warning' : 'neutral' };
};

/** The company / division / branch an amount belongs to - one payment file covers exactly one. */
export const scopeKey = (p: Pick<StatutoryPayable, 'com_sno' | 'div_sno' | 'brn_sno'>): string => `${p.com_sno ?? ''}|${p.div_sno ?? ''}|${p.brn_sno ?? ''}`;

export const scopeLabel = (p: Pick<StatutoryPayable, 'com_name' | 'com_sno' | 'div_sno' | 'brn_sno'>): string =>
  [p.com_name ?? (p.com_sno != null ? `Company ${p.com_sno}` : 'No company'), p.div_sno != null ? `Division ${p.div_sno}` : null, p.brn_sno != null ? `Branch ${p.brn_sno}` : null]
    .filter(Boolean).join(' · ');

const paise = (n: number | string | null | undefined): number => Math.round((Number(n) || 0) * 100);
/** Sum of the ticked amounts, in whole paise so 0.1 + 0.2 never shows as 0.30000000000000004. */
export const totalOf = (list: StatutoryPayable[], ids: Set<number>): number => list.reduce((s, p) => (ids.has(p.stat_sno) ? s + paise(p.amount) : s), 0) / 100;

/** How an open amount will be paid: on its payee's portal (recorded), or in a bank file. Before sql/82 every payee is a bank one. */
export const channelOf = (p: Pick<StatutoryPayable, 'pay_to_online'>): 'ONLINE' | 'BANK' => (p.pay_to_online === 'Y' ? 'ONLINE' : 'BANK');

/** Why the ticked amounts cannot be paid together, or '' when they can. */
export const runProblem = (picked: StatutoryPayable[]): string => {
  if (picked.length === 0) return 'Tick the amounts to pay.';
  if (new Set(picked.map((p) => p.kind)).size > 1) return 'A statutory file holds one kind at a time - pay TDS, GST and others separately.';
  if (new Set(picked.map(scopeKey)).size > 1) return 'A payment file covers one company, division and branch - untick the amounts of the others.';
  const channels = new Set(picked.map(channelOf));
  if (channels.size > 1) return 'Some of these are paid online and some by bank file - tick one or the other.';
  if (channels.has('ONLINE') && new Set(picked.map((p) => p.pay_to_sno ?? null)).size > 1) return 'One online payment pays one payee - tick the amounts of one payee at a time.';
  return '';
};

/** A portal address as typed, made into a link: "eportal.incometax.gov.in" -> "https://eportal.incometax.gov.in". */
export const portalUrl = (raw: string): string => {
  const s = raw.trim();
  return !s || /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
const PORTAL_URL = /^https?:\/\/[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i;

/** Why a payee cannot be saved yet, or null. A bank payee needs its account and IFSC; an online one its portal name and address. */
export const payeeProblem = (f: Pick<StatutoryPayeeInput, 'payee_name' | 'ac_number' | 'ifsc'> & Partial<Pick<StatutoryPayeeInput, 'pay_via_portal' | 'payment_portal_name' | 'payment_portal_url'>>): string | null => {
  if (!f.payee_name.trim()) return 'Enter the payee name.';
  if (f.pay_via_portal) {
    if (!f.payment_portal_name?.trim()) return 'Enter the portal / website name.';
    if (!PORTAL_URL.test(portalUrl(f.payment_portal_url ?? ''))) return 'Enter the portal address, e.g. https://eportal.incometax.gov.in';
    return null;
  }
  if (!/^\d{6,20}$/.test(f.ac_number.replace(/\s+/g, ''))) return 'The account number is digits only (6 to 20).';
  if (!IFSC.test(f.ifsc.trim())) return 'The IFSC is 11 characters, e.g. SBIN0000001.';
  return null;
};

/** How a payee shows in a picker: "Income Tax e-Pay · online" / "ITD ••••1234". */
export const payeeLabel = (y: Pick<StatutoryPayee, 'payee_name' | 'pay_via_portal' | 'ac_last4'>): string =>
  y.pay_via_portal === 'Y' ? `${y.payee_name} · online` : `${y.payee_name}${y.ac_last4 ? ` ••••${y.ac_last4}` : ''}`;

export interface OnlinePaymentForm { mode: string; txnId: string; txnDate: string }

/** Why an online payment cannot be recorded yet, or null. */
export const onlineProblem = (f: OnlinePaymentForm, today: string): string | null => {
  if (!(STATUTORY_ONLINE_MODES as readonly string[]).includes(f.mode)) return 'Choose how it was paid.';
  if (!f.txnId.trim()) return 'Enter the challan / transaction number.';
  if (!/^[A-Za-z0-9._/-]+$/.test(f.txnId.trim())) return 'The challan / transaction number can only have letters, digits and . _ / -';
  if (!f.txnDate || f.txnDate > today) return 'Enter the payment date (not in the future).';
  return null;
};

/** Why a keyed-in amount cannot be saved yet, or null. */
export const amountProblem = (f: { head_name: string; amount: string; com_sno: string }): string | null => {
  if (!f.com_sno) return 'Choose the company.';
  if (!f.head_name.trim()) return 'Say what the amount is for.';
  const n = Number(f.amount);
  if (!f.amount.trim() || !Number.isFinite(n) || n <= 0) return 'Enter an amount above zero.';
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return 'An amount has at most two decimals.';
  return null;
};
