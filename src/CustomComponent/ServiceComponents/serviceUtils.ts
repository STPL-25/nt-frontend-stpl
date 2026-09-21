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

export type AgreementType = 'FIXED_RECURRING' | 'VARIABLE_RECURRING' | 'STATUTORY';

export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  FIXED_RECURRING: 'Fixed',
  VARIABLE_RECURRING: 'Unfixed',
  STATUTORY: 'Statutory',
};

/** Unfixed agreements have their amount entered per cycle in Service PO. (Statutory loans no
 *  longer raise POs at all — interest is billed through Bank Payment Vouchers.) */
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

// ─── Statutory (loan / repo / cash credit) ─────────────────────────────────

export type FacilityType = 'LOAN' | 'REPO' | 'CASH_CREDIT';
export type RateType = 'FIXED' | 'FLOATING';

export const FACILITY_META: Record<FacilityType, { label: string; amountLabel: string; hint: string }> = {
  LOAN: { label: 'Loan', amountLabel: 'Loan amount', hint: 'Term loan repaid in instalments' },
  REPO: { label: 'Repo', amountLabel: 'Facility amount', hint: 'Repo-linked facility, rate follows the repo rate' },
  CASH_CREDIT: { label: 'Cash credit', amountLabel: 'Sanctioned limit', hint: 'Revolving limit, interest on what is drawn' },
};

export const facilityLabel = (t?: string | null) => (t && FACILITY_META[t as FacilityType]?.label) || '—';

export interface StatutoryForm {
  facility_type: FacilityType | '';
  facility_ref_no: string;
  sanctioned_amount: string;
  drawing_power: string;
  rate_type: RateType;
  benchmark_name: string;
  benchmark_rate_pct: string;
  spread_pct: string;
  interest_rate_pct: string;
  /** Amount actually drawn on the disbursement date — interest is charged on this. */
  disbursed_amount: string;
  /** Interest starts here. */
  disbursement_date: string;
  /** Day of the month interest is paid (1-31; a short month uses its last day). */
  interest_payment_day: string;
  /** Days in the year used to price a day of interest. */
  day_count_basis: '365' | '360';
}

export const emptyStatutory = (): StatutoryForm => ({
  facility_type: '', facility_ref_no: '', sanctioned_amount: '', drawing_power: '',
  rate_type: 'FIXED', benchmark_name: 'Repo', benchmark_rate_pct: '', spread_pct: '', interest_rate_pct: '',
  disbursed_amount: '', disbursement_date: '', interest_payment_day: '', day_count_basis: '365',
});

export const DAY_COUNT_LABEL: Record<string, string> = { '365': 'Actual / 365', '360': 'Actual / 360' };

/** "7th", "22nd", "31st" */
export function ordinalDay(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1) return '—';
  const s = ['th', 'st', 'nd', 'rd'], m = v % 100;
  return `${v}${s[(m - 20) % 10] ?? s[m] ?? s[0]}`;
}

/** Effective interest rate: benchmark + spread for floating, the entered rate for fixed. */
export function effectiveRate(s: Pick<StatutoryForm, 'rate_type' | 'benchmark_rate_pct' | 'spread_pct' | 'interest_rate_pct'>): number | null {
  if (s.rate_type === 'FLOATING') {
    if (s.benchmark_rate_pct === '' || s.spread_pct === '') return null;
    return Math.round((Number(s.benchmark_rate_pct) + Number(s.spread_pct)) * 1000) / 1000;
  }
  return s.interest_rate_pct === '' ? null : Number(s.interest_rate_pct);
}

/** Facility columns on a list/approval row (or a version's `statutory` block) → form values. */
export function statutoryFromRow(row: any): StatutoryForm {
  if (!row?.facility_type) return emptyStatutory();
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    facility_type: row.facility_type,
    facility_ref_no: str(row.facility_ref_no),
    sanctioned_amount: str(row.sanctioned_amount),
    drawing_power: str(row.drawing_power),
    rate_type: row.rate_type === 'FLOATING' ? 'FLOATING' : 'FIXED',
    benchmark_name: str(row.benchmark_name) || 'Repo',
    benchmark_rate_pct: str(row.benchmark_rate_pct),
    spread_pct: str(row.spread_pct),
    interest_rate_pct: str(row.interest_rate_pct),
    disbursed_amount: str(row.disbursed_amount),
    disbursement_date: dateOnly(row.disbursement_date),
    interest_payment_day: str(row.interest_payment_day),
    day_count_basis: Number(row.day_count_basis) === 360 ? '360' : '365',
  };
}

/** Field errors for the facility block, keyed like the form's other errors. `term` is the
 *  agreement's Duration From / To — interest can't start outside the loan term. */
export function validateStatutory(s: StatutoryForm, term?: { start?: string; end?: string }): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!s.facility_type) errs.stat_facility_type = 'Choose Loan, Repo or Cash credit';
  if (!(Number(s.sanctioned_amount) > 0)) errs.stat_sanctioned_amount = 'Enter the sanctioned amount';

  if (!s.disbursement_date) errs.stat_disbursement_date = 'Enter the date interest starts from';
  else if (term?.start && s.disbursement_date < term.start) errs.stat_disbursement_date = 'Cannot be before the loan term starts (Duration From)';
  else if (term?.end && s.disbursement_date >= term.end) errs.stat_disbursement_date = 'Must be before the loan term ends (Duration To)';

  const day = Number(s.interest_payment_day);
  if (!Number.isInteger(day) || day < 1 || day > 31) errs.stat_interest_payment_day = 'Enter a day of the month from 1 to 31';

  const sanctioned = Number(s.sanctioned_amount), disbursed = Number(s.disbursed_amount);
  if (s.disbursed_amount === '') errs.stat_disbursed_amount = 'Enter the amount drawn';
  else if (disbursed < 0 || (sanctioned > 0 && disbursed > sanctioned)) errs.stat_disbursed_amount = 'Must be between 0 and the sanctioned amount';
  else if (s.facility_type !== 'CASH_CREDIT' && !(disbursed > 0)) errs.stat_disbursed_amount = 'Must be greater than zero';
  if (s.rate_type === 'FLOATING') {
    if (s.benchmark_rate_pct === '') errs.stat_benchmark_rate_pct = 'Enter the benchmark (repo) rate';
    if (s.spread_pct === '') errs.stat_spread_pct = 'Enter the spread';
  } else if (s.interest_rate_pct === '') {
    errs.stat_interest_rate_pct = 'Enter the interest rate';
  }
  const eff = effectiveRate(s);
  if (eff !== null && (eff < 0 || eff > 100)) errs.stat_interest_rate_pct = 'Rate must be between 0 and 100%';
  if (s.facility_type === 'CASH_CREDIT' && s.drawing_power !== '') {
    const dp = Number(s.drawing_power);
    if (!(dp > 0) || dp > Number(s.sanctioned_amount)) errs.stat_drawing_power = 'Drawing power must be positive and within the limit';
  }
  return errs;
}

export function buildStatutoryPayload(s: StatutoryForm) {
  return {
    facility_type: s.facility_type,
    facility_ref_no: s.facility_ref_no.trim() || undefined,
    sanctioned_amount: Number(s.sanctioned_amount),
    drawing_power: s.facility_type === 'CASH_CREDIT' && s.drawing_power !== '' ? Number(s.drawing_power) : undefined,
    rate_type: s.rate_type,
    ...(s.rate_type === 'FLOATING'
      ? { benchmark_name: s.benchmark_name.trim() || 'Repo', benchmark_rate_pct: Number(s.benchmark_rate_pct), spread_pct: Number(s.spread_pct) }
      : { interest_rate_pct: Number(s.interest_rate_pct) }),
    disbursed_amount: Number(s.disbursed_amount),
    disbursement_date: s.disbursement_date,
    interest_payment_day: Number(s.interest_payment_day),
    day_count_basis: Number(s.day_count_basis),
  };
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
  statutory?: {
    facility_type?: string | null; facility_ref_no?: string | null; sanctioned_amount?: number | null;
    drawing_power?: number | null; rate_type?: string | null; benchmark_rate_pct?: number | null;
    spread_pct?: number | null; interest_rate_pct?: number | null;
    benchmark_name?: string | null; disbursed_amount?: number | null; disbursement_date?: string | null;
    interest_payment_day?: number | null; day_count_basis?: number | null;
  } | null;
}

/** A list/approval row (flat columns + `vendors`) in the same shape a version snapshot uses. */
export function termsFromRow(row: any): AgreementTerms {
  return {
    service_name: row.service_name, qty: row.qty, rate_amount: row.rate_amount, rate_uom_name: row.rate_uom_name,
    cadence_name: row.cadence_name, po_generation_day: row.po_generation_day, notify_days_before: row.notify_days_before,
    period_start_date: row.period_start_date, period_end_date: row.period_end_date,
    agreement_doc_url: row.agreement_doc_url, remarks: row.remarks, terms_conditions: row.terms_conditions,
    ceiling_amount: row.ceiling_amount, suppliers: row.vendors ?? [],
    statutory: row.facility_type ? {
      facility_type: row.facility_type, facility_ref_no: row.facility_ref_no, sanctioned_amount: row.sanctioned_amount,
      drawing_power: row.drawing_power, rate_type: row.rate_type, benchmark_rate_pct: row.benchmark_rate_pct,
      spread_pct: row.spread_pct, interest_rate_pct: row.interest_rate_pct,
      benchmark_name: row.benchmark_name, disbursed_amount: row.disbursed_amount, disbursement_date: row.disbursement_date,
      interest_payment_day: row.interest_payment_day, day_count_basis: row.day_count_basis,
    } : null,
  };
}

export interface TermChange { label: string; from?: string; to?: string; note?: string }

/** Plain-language list of what differs between two versions of an agreement's terms. */
export function diffTerms(prev: AgreementTerms | null | undefined, cur: AgreementTerms | null | undefined): TermChange[] {
  if (!prev || !cur) return [];
  const out: TermChange[] = [];
  const money = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : formatINR(v as number));
  const plain = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
  const pct = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : `${Number(v)}%`);
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

  // Facility block (Statutory)
  const ps = prev.statutory ?? {}, cs = cur.statutory ?? {};
  cmp('Facility type', ps.facility_type, cs.facility_type, (v) => facilityLabel(v as string));
  cmp('Facility reference', ps.facility_ref_no, cs.facility_ref_no, plain);
  cmp('Sanctioned amount', ps.sanctioned_amount, cs.sanctioned_amount, money);
  cmp('Drawing power', ps.drawing_power, cs.drawing_power, money);
  cmp('Rate type', ps.rate_type, cs.rate_type, (v) => (v === 'FLOATING' ? 'Floating' : v === 'FIXED' ? 'Fixed' : '—'));
  cmp('Benchmark (repo) rate', ps.benchmark_rate_pct, cs.benchmark_rate_pct, pct);
  cmp('Spread', ps.spread_pct, cs.spread_pct, pct);
  cmp('Interest rate', ps.interest_rate_pct, cs.interest_rate_pct, pct);
  cmp('Disbursed amount', ps.disbursed_amount, cs.disbursed_amount, money);
  cmp('Disbursement date', ps.disbursement_date?.slice(0, 10), cs.disbursement_date?.slice(0, 10), (v) => formatDate(v as string));
  cmp('Interest payment day', ps.interest_payment_day, cs.interest_payment_day, (v) => ordinalDay(v as number));
  cmp('Day-count basis', ps.day_count_basis, cs.day_count_basis, (v) => DAY_COUNT_LABEL[String(v)] ?? '—');

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
