import type { PaymentBatch, PaymentBatchItem, PaymentBatchLine, PortalPayment } from '@/Services/GrnService/paymentNetApi';
import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';

// Payment history = the previous payment runs. Pure helpers for the History tab of Payment Run: date ranges, filters,
// day groups and totals. Dates are compared as 'yyyy-mm-dd' text in the user's local day.

export type HistoryRange = '7D' | '30D' | 'MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM';
export const HISTORY_RANGES: { value: Exclude<HistoryRange, 'CUSTOM'>; label: string }[] = [
  { value: '7D', label: 'Last 7 days' },
  { value: '30D', label: 'Last 30 days' },
  { value: 'MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'ALL', label: 'All' },
];

const pad = (n: number) => String(n).padStart(2, '0');
/** The local calendar day of a Date as 'yyyy-mm-dd' (toISOString would give yesterday before 05:30 IST). */
export const localYmd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const runDay = (b: Pick<PaymentBatch, 'batch_date'>): string => String(b.batch_date ?? '').slice(0, 10);

const shift = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localYmd(d);
};

/** from / to (inclusive) for a range; null = open. */
export const rangeBounds = (range: HistoryRange, today: string, custom: { from: string; to: string } = { from: '', to: '' }): { from: string | null; to: string | null } => {
  const month = today.slice(0, 7);
  switch (range) {
    case '7D': return { from: shift(today, -6), to: today };
    case '30D': return { from: shift(today, -29), to: today };
    case 'MONTH': return { from: `${month}-01`, to: today };
    case 'LAST_MONTH': {
      const first = new Date(`${month}-01T00:00:00`);
      const lastOfPrev = new Date(first.getFullYear(), first.getMonth(), 0);
      return { from: `${localYmd(lastOfPrev).slice(0, 7)}-01`, to: localYmd(lastOfPrev) };
    }
    case 'CUSTOM': return { from: custom.from || null, to: custom.to || null };
    default: return { from: null, to: null };
  }
};

export const scopeKeyOfRun = (b: Pick<PaymentBatch, 'com_sno' | 'div_sno' | 'brn_sno'>): string => `${b.com_sno ?? ''}|${b.div_sno ?? ''}|${b.brn_sno ?? ''}`;
export const scopeLabelOfRun = (b: PaymentBatch): string =>
  [b.com_name ?? (b.com_sno != null ? `Company ${b.com_sno}` : null), b.div_name, b.brn_name].filter(Boolean).join(' · ') || '—';
/** the account a run was paid from; '' for a run with no bank transfer */
export const bankKeyOfRun = (b: PaymentBatch): string => (b.payment_bank_sno ? String(b.payment_bank_sno) : b.sender_bank_name ? `${b.sender_bank_name}|${b.sender_ac_last4 ?? ''}` : '');
export const bankLabelOfRun = (b: PaymentBatch): string =>
  (b.sender_bank_name ? `${b.sender_name ? `${b.sender_name} · ` : ''}${b.sender_bank_name}${b.sender_ac_last4 ? ` ••••${b.sender_ac_last4}` : ''}` : 'No bank file');

// History = bank runs (one bank file each) + payments recorded as paid on a supplier's own portal (no run, no file).
export type HistoryKind = 'ALL' | 'RUN' | 'PORTAL';
export type HistoryItem =
  | { kind: 'RUN'; key: string; day: string; at: string; amount: number; payments: number; run: PaymentBatch }
  | { kind: 'PORTAL'; key: string; day: string; at: string; amount: number; payments: number; txn: PortalPayment };

export const portalDay = (t: Pick<PortalPayment, 'txn_date'>): string => String(t.txn_date ?? '').slice(0, 10);

/** One list, newest first: by day, then by when it was made / recorded. */
export const toHistoryItems = (runs: PaymentBatch[], portal: PortalPayment[]): HistoryItem[] => {
  const items: HistoryItem[] = [
    ...runs.map((run): HistoryItem => ({ kind: 'RUN', key: `R${run.batch_sno}`, day: runDay(run), at: String(run.created_at ?? ''), amount: Number(run.total_amount) || 0, payments: Number(run.item_count) || 0, run })),
    ...portal.map((txn): HistoryItem => ({ kind: 'PORTAL', key: `P${txn.txn_sno}`, day: portalDay(txn), at: String(txn.recorded_at ?? ''), amount: Number(txn.amount_paid) || 0, payments: 1, txn })),
  ];
  return items.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
};

export interface HistoryFilter { from: string | null; to: string | null; search: string; scope: string; bank: string; kind: HistoryKind }

export const filterHistory = (items: HistoryItem[], f: HistoryFilter): HistoryItem[] => {
  const q = f.search.trim().toLowerCase();
  const scopeCompany = f.scope.split('|')[0];
  return items.filter((it) => {
    if (f.kind !== 'ALL' && it.kind !== f.kind) return false;
    if (f.from && it.day < f.from) return false;
    if (f.to && it.day > f.to) return false;
    if (it.kind === 'RUN') {
      const b = it.run;
      if (f.scope && scopeKeyOfRun(b) !== f.scope) return false;
      if (f.bank && bankKeyOfRun(b) !== f.bank) return false;
      if (!q) return true;
      return [b.batch_no, b.file_name, b.created_by, b.sender_bank_name, b.sender_name, b.com_name, b.div_name, b.brn_name,
        ...(b.vendor_names ?? []), ...(b.supp_codes ?? []), ...(b.payment_nos ?? [])]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    }
    const t = it.txn;
    // a portal payment is filed under its company only, and is never paid from one of the company's bank accounts
    if (f.scope && String(t.com_sno ?? '') !== scopeCompany) return false;
    if (f.bank) return false;
    if (!q) return true;
    return [t.payment_no, t.vendor_name, t.supp_code, t.portal_name, t.txn_id, t.txn_mode, t.recorded_by, t.com_name, t.remarks, 'portal']
      .some((v) => String(v ?? '').toLowerCase().includes(q));
  });
};

export interface HistoryTotals { amount: number; payments: number; runs: number; portal: number; portalAmount: number }
export const sumHistory = (items: HistoryItem[]): HistoryTotals => items.reduce((s, it) => ({
  amount: s.amount + it.amount,
  payments: s.payments + it.payments,
  runs: s.runs + (it.kind === 'RUN' ? 1 : 0),
  portal: s.portal + (it.kind === 'PORTAL' ? 1 : 0),
  portalAmount: s.portalAmount + (it.kind === 'PORTAL' ? it.amount : 0),
}), { amount: 0, payments: 0, runs: 0, portal: 0, portalAmount: 0 });

export interface HistoryDay extends HistoryTotals { day: string; items: HistoryItem[] }
/** Day groups of an already newest-first list. */
export const groupHistoryByDay = (items: HistoryItem[]): HistoryDay[] => {
  const out: HistoryDay[] = [];
  const at = new Map<string, HistoryItem[]>();
  for (const it of items) {
    let list = at.get(it.day);
    if (!list) { list = []; at.set(it.day, list); out.push({ day: it.day, items: list, amount: 0, payments: 0, runs: 0, portal: 0, portalAmount: 0 }); }
    list.push(it);
  }
  return out.map((d) => ({ ...d, ...sumHistory(d.items) }));
};

/** Paid this calendar month and the whole of last month (bank runs + portal payments). */
export const monthSummary = (items: HistoryItem[], today: string) => {
  const last = rangeBounds('LAST_MONTH', today);
  return {
    thisMonth: sumHistory(items.filter((it) => it.day.slice(0, 7) === today.slice(0, 7))),
    lastMonth: sumHistory(items.filter((it) => it.day >= (last.from ?? '') && it.day <= (last.to ?? ''))),
  };
};

/** "3 runs · 1 paid on portal" */
export const countWords = (t: Pick<HistoryTotals, 'runs' | 'portal'>): string =>
  [t.runs ? `${t.runs} run${t.runs === 1 ? '' : 's'}` : '', t.portal ? `${t.portal} paid on portal` : ''].filter(Boolean).join(' · ') || 'Nothing paid';

/** share of the run's fund plan it used, 0-100 (null without a fund plan) */
export const fundUsePct = (b: Pick<PaymentBatch, 'total_amount' | 'fund_plan_amount'>): number | null => {
  const fund = Number(b.fund_plan_amount) || 0;
  if (fund <= 0) return null;
  return Math.min(100, Math.round(((Number(b.total_amount) || 0) / fund) * 100));
};

export const hasRunFile = (b: Pick<PaymentBatch, 'has_file' | 'file_type'>): boolean => !!(b.has_file || b.file_type);
export const runStatus = (b: Pick<PaymentBatch, 'has_file' | 'file_type'>): { label: string; tone: Tone } =>
  (hasRunFile(b) ? { label: 'Bank file made', tone: 'success' } : { label: 'No bank transfer', tone: 'neutral' });

/** "NEO DIAMONDS, SILVER ZONE +2" */
export const payeeSummary = (names: string[] | undefined, show = 2): string => {
  const list = names ?? [];
  if (list.length === 0) return '';
  return list.length <= show ? list.join(', ') : `${list.slice(0, show).join(', ')} +${list.length - show}`;
};

/** ₹1.25 Cr / ₹38.61 L / ₹80,835 - for headline figures only; tables keep exact rupees. */
export const compactRupees = (n: number | string | null | undefined): string => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const t = (x: number) => String(Math.round(x * 100) / 100);
  if (a >= 1e7) return `₹${t(v / 1e7)} Cr`;
  if (a >= 1e5) return `₹${t(v / 1e5)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

/** The invoice lines of each payment of a run (lines carry batch_item_sno; older lines are matched on payment_sno). */
export const linesByItem = (items: PaymentBatchItem[], lines: PaymentBatchLine[]): Map<number, PaymentBatchLine[]> => {
  const out = new Map<number, PaymentBatchLine[]>();
  const itemOf = new Map(items.filter((i) => i.batch_item_sno != null).map((i) => [i.batch_item_sno as number, i.payment_sno]));
  for (const l of lines) {
    const pay = itemOf.get(l.batch_item_sno) ?? l.payment_sno;
    const list = out.get(pay) ?? [];
    list.push(l);
    out.set(pay, list);
  }
  return out;
};

export const itemTotals = (items: PaymentBatchItem[]) => items.reduce((s, i) => ({
  gross: s.gross + (Number(i.gross_amount ?? i.amount) || 0),
  tds: s.tds + (Number(i.tds_amount) || 0),
  advance: s.advance + (Number(i.advance_amount) || 0),
  notes: s.notes + (Number(i.note_amount) || 0),
  net: s.net + (Number(i.amount) || 0),
}), { gross: 0, tds: 0, advance: 0, notes: 0, net: 0 });

/** FULL / PART n / FINAL as words for the invoice line pill */
export const lineKind = (l: Pick<PaymentBatchLine, 'kind' | 'part_no'>): { label: string; tone: Tone } => {
  const k = String(l.kind ?? '').toUpperCase();
  if (k === 'PART') return { label: `Part ${l.part_no ?? ''}`.trim(), tone: 'warning' };
  if (k === 'FINAL') return { label: 'Final part', tone: 'info' };
  return { label: 'Full', tone: 'success' };
};
