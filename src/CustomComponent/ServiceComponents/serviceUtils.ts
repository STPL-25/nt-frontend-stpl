// Formatting helpers, status maps and the amount formula shared by the Service
// Agreement / Service PO screens. Kept out of ServiceParts.tsx so that file only
// exports components (keeps React Fast Refresh working).

// ─── Formatting ────────────────────────────────────────────────────────────

export const dateOnly = (v?: string | null) => (v ? v.slice(0, 10) : '');

export function formatDate(d?: string | null): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return String(d);
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatINR(value: number | string | null | undefined, maxFractionDigits = 2): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  // Whole amounts stay bare (₹50,000); anything with paise always shows both digits (₹40,833.70).
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(n) ? 0 : Math.min(2, maxFractionDigits), maximumFractionDigits: maxFractionDigits })}`;
}

export function parseStages(row: any): any[] {
  try {
    const raw = row?.stage_order_json;
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type ApprovalAction = 'approve' | 'reject' | 'forward' | 'send_back';

export interface ApprovalRoute { ecno: string; stage?: string }

/**
 * What the signed-in approver can do besides approve / reject, from the workflow's stage list.
 * Forward goes to the next stage's approver; send back goes to any EARLIER stage's approver.
 * Each needs the stage's can_forward / can_backward flag (Approval Workflows screen).
 */
export function approvalRoutes(stages: any[], userEcno?: string | null): {
  canForward: boolean; forwardTo: ApprovalRoute | null; canSendBack: boolean; sendBackOptions: ApprovalRoute[];
} {
  const none = { canForward: false, forwardTo: null, canSendBack: false, sendBackOptions: [] as ApprovalRoute[] };
  const me = String(userEcno ?? '').trim();
  const idx = me ? stages.findIndex((s) => String(s?.approver_ecno ?? '').trim() === me) : -1;
  if (idx < 0) return none;
  const cur = stages[idx];
  const next = stages[idx + 1];
  const earlier: ApprovalRoute[] = stages
    .slice(0, idx)
    .filter((s) => s?.approver_ecno)
    .map((s) => ({ ecno: String(s.approver_ecno).trim(), stage: s.stage }));
  return {
    canForward: cur?.can_forward === 'Y' && !!next?.approver_ecno,
    forwardTo: next?.approver_ecno ? { ecno: String(next.approver_ecno).trim(), stage: next.stage } : null,
    canSendBack: cur?.can_backward === 'Y' && earlier.length > 0,
    sendBackOptions: earlier,
  };
}

export const ACTION_DONE_LABEL: Record<ApprovalAction, string> = {
  approve: 'approved', reject: 'rejected', forward: 'forwarded', send_back: 'sent back',
};

// ─── Tones & status maps ───────────────────────────────────────────────────

export type Tone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

// Theme tokens for neutral/primary so the app's colour themes and dark mode
// apply; the other tones are fixed hues, each with a dark-mode variant.
export const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
  violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20',
};

export interface StatusMeta { label: string; tone: Tone }

export const AGREEMENT_STATUS: Record<string, StatusMeta> = {
  D: { label: 'Draft', tone: 'neutral' },
  P: { label: 'Pending', tone: 'warning' },
  A: { label: 'Approved', tone: 'success' },
  R: { label: 'Rejected', tone: 'danger' },
  X: { label: 'Expired', tone: 'neutral' },
};

export const CYCLE_STATUS: Record<string, StatusMeta> = {
  PENDING_ENTRY: { label: 'Pending Entry', tone: 'warning' },
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'info' },
  GENERATED: { label: 'Generated', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

export function statusMeta(map: Record<string, StatusMeta>, key: unknown): StatusMeta {
  return map[String(key).toUpperCase()] ?? { label: String(key ?? 'Pending'), tone: 'neutral' };
}

// ─── Agreement types ───────────────────────────────────────────────────────

export type AgreementType = 'FIXED_RECURRING' | 'VARIABLE_RECURRING';

export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  FIXED_RECURRING: 'Fixed',
  VARIABLE_RECURRING: 'Unfixed',
};

/** Unfixed agreements have their amount entered per cycle in Service PO. */
export const entersAmountPerCycle = (type?: string) => type === 'VARIABLE_RECURRING';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Suppliers (one agreement, several suppliers) ──────────────────────────

export interface SupplierShare {
  vendor_sno: number | string;
  vendor_name?: string | null;
  share_amount: number;
  share_pct?: number | null;
}

/** One line of the supplier split as edited in the form (strings, like every other form field). */
export interface SupplierRowValue { vendor_sno: string; share_amount: string }

export const emptySupplierRow = (): SupplierRowValue => ({ vendor_sno: '', share_amount: '' });

/** Rows → the payload the backend takes. A lone supplier always carries 100% of the total. */
export function buildSupplierPayload(rows: SupplierRowValue[], total: number) {
  const picked = rows.filter((r) => r.vendor_sno !== '');
  if (picked.length === 1) return [{ vendor_sno: Number(picked[0].vendor_sno), share_amount: round2(total) }];
  return picked.map((r) => ({ vendor_sno: Number(r.vendor_sno), share_amount: round2(Number(r.share_amount) || 0) }));
}

/** Client-side mirror of sp_nt_SaveServiceAgreementSuppliers' checks (the SP stays the authority). */
export function validateSuppliers(rows: SupplierRowValue[], total: number): string | undefined {
  const picked = rows.filter((r) => r.vendor_sno !== '');
  if (picked.length === 0) return 'Select at least one supplier';
  if (rows.some((r) => r.vendor_sno === '')) return 'Pick a supplier for every row, or remove the empty one';
  if (new Set(picked.map((r) => r.vendor_sno)).size !== picked.length) return 'The same supplier is listed more than once';
  if (picked.length === 1) return undefined;
  if (picked.some((r) => !(Number(r.share_amount) > 0))) return 'Every supplier needs an amount greater than zero';
  if (total > 0) {
    const sum = picked.reduce((s, r) => s + (Number(r.share_amount) || 0), 0);
    if (Math.abs(sum - total) > 0.01) return `Supplier amounts total ${formatINR(sum)} but must equal ${formatINR(total)}`;
  }
  return undefined;
}

/** What each supplier's PO will be for an entered rate — same rounding as sp_nt_BuildServicePoCycleSplit
 *  (last supplier absorbs the remainder so unit prices add up exactly). */
export function previewSupplierSplit(
  suppliers: { vendor_sno: number | string; vendor_name?: string | null; share_pct?: number | null }[],
  { rate, qty, discountPct, gstPct }: { rate: number; qty: number; discountPct: number; gstPct: number },
) {
  let assigned = 0;
  return suppliers.map((s, i) => {
    const isLast = i === suppliers.length - 1;
    const unit = isLast ? round2(rate - assigned) : round2((rate * Number(s.share_pct ?? 0)) / 100);
    assigned += unit;
    const net = round2(unit * qty * (1 - discountPct / 100) * (1 + gstPct / 100));
    return { vendor_sno: s.vendor_sno, vendor_name: s.vendor_name ?? null, share_pct: Number(s.share_pct ?? 0), unit_rate: unit, net };
  });
}

// ─── Versions, renewal & history ───────────────────────────────────────────

export const VERSION_OUTCOME: Record<string, StatusMeta> = {
  PENDING: { label: 'Pending approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

export const VERSION_ACTION: Record<string, string> = {
  SUBMITTED: 'Original submission',
  RESUBMITTED: 'Edited & resubmitted',
  RENEWED: 'Renewal',
};

export const HISTORY_EVENT: Record<string, StatusMeta> = {
  SUBMITTED: { label: 'Submitted', tone: 'primary' },
  RESUBMITTED: { label: 'Resubmitted', tone: 'primary' },
  RENEWED: { label: 'Renewed', tone: 'violet' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const utcDate = (s: string) => new Date(`${s}T00:00:00Z`);

/** Default term for a renewal: starts the day after the old term ended (or today, if that is
 *  already past) and runs for the same number of days. */
export function suggestRenewalTerm(prevStart: string, prevEnd: string, today = new Date()) {
  const spanDays = Math.round((utcDate(prevEnd).getTime() - utcDate(prevStart).getTime()) / DAY_MS);
  const dayAfterEnd = new Date(utcDate(prevEnd).getTime() + DAY_MS);
  const todayUtc = utcDate(isoDate(today));
  const start = dayAfterEnd > todayUtc ? dayAfterEnd : todayUtc;
  return { start: isoDate(start), end: isoDate(new Date(start.getTime() + spanDays * DAY_MS)) };
}

export interface AgreementTerms {
  service_name?: string | null;
  qty?: number | null;
  rate_amount?: number | null;
  rate_uom_name?: string | null;
  cadence_name?: string | null;
  po_generation_day?: number | null;
  notify_days_before?: number | null;
  period_start_date?: string | null;
  period_end_date?: string | null;
  agreement_doc_url?: string | null;
  remarks?: string | null;
  terms_conditions?: string | null;
  ceiling_amount?: number | null;
  suppliers?: SupplierShare[] | null;
}

/** A list/approval row (flat columns + `vendors`) in the same shape a version snapshot uses. */
export function termsFromRow(row: any): AgreementTerms {
  return {
    service_name: row.service_name, qty: row.qty, rate_amount: row.rate_amount, rate_uom_name: row.rate_uom_name,
    cadence_name: row.cadence_name, po_generation_day: row.po_generation_day, notify_days_before: row.notify_days_before,
    period_start_date: row.period_start_date, period_end_date: row.period_end_date,
    agreement_doc_url: row.agreement_doc_url, remarks: row.remarks, terms_conditions: row.terms_conditions,
    ceiling_amount: row.ceiling_amount, suppliers: row.vendors ?? [],
  };
}

export interface TermChange { label: string; from?: string; to?: string; note?: string }

/** Plain-language list of what differs between two versions of an agreement's terms. */
export function diffTerms(prev: AgreementTerms | null | undefined, cur: AgreementTerms | null | undefined): TermChange[] {
  if (!prev || !cur) return [];
  const out: TermChange[] = [];
  const money = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : formatINR(v as number));
  const plain = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
  const days = (v: unknown) => (v === null || v === undefined ? '—' : `${v} day${Number(v) === 1 ? '' : 's'}`);
  const cmp = (label: string, a: unknown, b: unknown, fmt: (v: unknown) => string) => {
    if (String(a ?? '') !== String(b ?? '')) out.push({ label, from: fmt(a), to: fmt(b) });
  };

  cmp('Service', prev.service_name, cur.service_name, plain);
  cmp('Term starts', prev.period_start_date?.slice(0, 10), cur.period_start_date?.slice(0, 10), (v) => formatDate(v as string));
  cmp('Term ends', prev.period_end_date?.slice(0, 10), cur.period_end_date?.slice(0, 10), (v) => formatDate(v as string));
  cmp('Quantity', prev.qty, cur.qty, plain);
  cmp('Rate', prev.rate_amount, cur.rate_amount, money);
  cmp('Recurrence', prev.cadence_name, cur.cadence_name, plain);
  cmp('PO generation day', prev.po_generation_day, cur.po_generation_day, plain);
  cmp('Notify before', prev.notify_days_before, cur.notify_days_before, days);
  cmp('Ceiling per cycle', prev.ceiling_amount, cur.ceiling_amount, money);

  // Supplier split
  const prevMap = new Map((prev.suppliers ?? []).map((s) => [String(s.vendor_sno), s]));
  const curMap = new Map((cur.suppliers ?? []).map((s) => [String(s.vendor_sno), s]));
  curMap.forEach((s, k) => {
    const before = prevMap.get(k);
    const name = s.vendor_name ?? `Supplier ${k}`;
    if (!before) out.push({ label: name, from: 'Not a supplier', to: money(s.share_amount) });
    else if (Number(before.share_amount) !== Number(s.share_amount)) out.push({ label: name, from: money(before.share_amount), to: money(s.share_amount) });
  });
  prevMap.forEach((s, k) => {
    if (!curMap.has(k)) out.push({ label: s.vendor_name ?? `Supplier ${k}`, from: money(s.share_amount), to: 'Removed' });
  });

  if ((prev.terms_conditions ?? '') !== (cur.terms_conditions ?? '')) out.push({ label: 'Terms & conditions', note: 'Wording updated' });
  if ((prev.remarks ?? '') !== (cur.remarks ?? '')) out.push({ label: 'Remarks', note: 'Updated' });
  if ((prev.agreement_doc_url ?? '') !== (cur.agreement_doc_url ?? '')) out.push({ label: 'Agreement document', note: 'A new document was uploaded' });
  return out;
}

// ─── Amount ────────────────────────────────────────────────────────────────

// Same formula the SPs use for service_po_cycle.net_cost:
// (rate × qty) × (1 − discount%) × (1 + GST%).
export function computeAmount({ rate, qty, discountPct, gstPct }: {
  rate: number; qty: number; discountPct: number; gstPct: number;
}) {
  const subtotal = rate * qty;
  const discountAmt = subtotal * (discountPct / 100);
  const taxable = subtotal - discountAmt;
  const gstAmt = taxable * (gstPct / 100);
  return { subtotal, discountAmt, gstAmt, net: taxable + gstAmt };
}
