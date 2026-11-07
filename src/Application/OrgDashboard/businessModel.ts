// Types + pure helpers for the "Business overview" tab (sp_nt_GetBusinessDashboard, backend sql/153). No React in here, so it is unit-tested.

export interface BizMeta { as_of: string; month_start: string; no_scope: 0 | 1; scope_rows: number }

/** One row of numbers - every value comes from the procedure, the page never recomputes a total. */
export interface BizKpi {
  inv_items: number; inv_qty: number; inv_value: number; inv_unpriced_items: number; inv_in_stock_items: number;
  asset_qty: number; asset_in_use_qty: number; asset_service_qty: number; asset_value: number; asset_kinds: number; asset_unpriced_kinds: number;
  pr_total: number; pr_month: number; pr_pending: number; pr_approved: number; pr_product: number; pr_service: number; pr_value: number;
  po_total: number; po_month: number; po_pending: number; po_value: number;
  po_product: number; po_product_value: number; po_service: number; po_service_value: number;
  gate_total: number; gate_today: number; gate_month: number; gate_waiting_grn: number; gate_grn_done: number;
  grn_done: number; grn_month: number; grn_pending: number; grn_approved: number; grn_value: number;
  pay_waiting_count: number; pay_waiting_amount: number; pay_approved_count: number; pay_approved_amount: number;
  pay_sent_count: number; pay_sent_amount: number; pay_bank_paid_count: number; pay_bank_paid_amount: number;
  pay_bank_returned_count: number; pay_bank_pending_count: number; bills_unpaid_count: number; bills_unpaid_amount: number;
  bud_count: number; bud_running_count: number; bud_running_budget: number; bud_running_used: number; bud_running_remaining: number;
  bud_all_budget: number; bud_all_used: number; bud_all_remaining: number; po_without_budget: number;
  exp_rec_count: number; exp_rec_amount: number; exp_rec_paid: number; exp_rec_month: number;
  exp_non_count: number; exp_non_amount: number; exp_non_paid: number; exp_non_month: number;
  agreements_active: number; agreements_cycle_amount: number;
}

export interface BizMonth {
  month_start: string; pr_count: number; po_count: number; po_value: number; gate_count: number; grn_count: number;
  exp_recurring: number; exp_non_recurring: number; pay_sent: number;
}
export interface BizBreakdown { section: string; label: string; cnt: number; amount: number | null; sort_order: number }
export interface BizStockLine {
  item_sno: number; item_code: string | null; item_name: string; uom: string | null; stock_type: string; category: string | null; dept_name: string | null;
  current_stock: number; unit_cost: number | null; value: number;
}
export interface BizAssetDept { dept_name: string; qty: number; in_use_qty: number; service_qty: number; value: number; kinds: number }
export interface BizBudget {
  bud_sno: number; bud_code: string | null; dept_name: string | null; bud_from: string | null; bud_to: string | null; is_expired: boolean;
  budget: number; used: number; remaining: number; po_count: number;
}
export type PayStage = "WAITING" | "APPROVED" | "SENT";
export interface BizPayment {
  payment_sno: number; payment_no: string | null; vendor_name: string | null; payment_date: string | null; stage: PayStage; payment_type: string | null;
  mode: string | null; status: string | null; bank_status: string | null; utr_no: string | null; batch_no: string | null; dept_name: string | null;
  amount: number; event_at: string | null;
}
export type ExpenseKind = "RECURRING" | "NON_RECURRING";
export interface BizExpense {
  invoice_sno: number; invoice_no: string | null; vendor_invoice_no: string | null; vendor_name: string | null; po_no: string | null;
  invoice_date: string | null; due_date: string | null; expense_class: "Product" | "Service"; kind: ExpenseKind; what: string | null; dept_name: string | null;
  amount: number; paid: number; in_payment: number; unpaid: number;
}
export interface BizVendorExpense { kind: ExpenseKind; vendor_name: string; cnt: number; amount: number; paid: number }
export interface BizAgreement {
  agreement_sno: number; agreement_no: string | null; vendor_name: string | null; service_name: string | null; cadence_name: string | null;
  dept_name: string | null; cycle_amount: number; period_start: string | null; period_end: string | null; cycles: number; billed: number;
}

export type ExpenseOrgLevel = "company" | "division" | "branch" | "department";

/** One month at one leaf organisation path, returned by result set 12 of sp_nt_GetBusinessDashboard. */
export interface BizExpenseOrgMonth {
  month_start: string;
  com_sno: number | null; com_name: string | null;
  div_sno: number | null; div_name: string | null;
  brn_sno: number | null; brn_name: string | null;
  dept_sno: number | null; dept_name: string | null;
  invoice_count: number;
  total_expense: number;
  recurring_expense: number;
  non_recurring_expense: number;
}

export interface ExpenseOrgOption { id: number; label: string; path: string }
export interface ExpenseTrendMonth {
  month_start: string; total_expense: number; recurring_expense: number; non_recurring_expense: number; invoice_count: number;
}

export interface BusinessOverview {
  meta: BizMeta; kpi: BizKpi; monthly: BizMonth[]; breakdown: BizBreakdown[]; top_items: BizStockLine[]; assets_by_dept: BizAssetDept[];
  budgets: BizBudget[]; payments: BizPayment[]; expenses: BizExpense[]; expense_by_vendor: BizVendorExpense[]; agreements: BizAgreement[];
  expense_monthly_org: BizExpenseOrgMonth[];
}

// ── money / numbers (Indian grouping; Cr = crore = 1,00,00,000, L = lakh = 1,00,000) ───────────────────────────────
const INR_FULL = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const INR_WHOLE = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** "₹1,23,456.50" - the exact figure (tooltips, tables). */
export function formatInr(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? INR_FULL.format(n) : "₹0.00";
}

/** "₹12.34 Cr" / "₹4.20 L" / "₹9,800" - the headline figure on a card. Under a lakh the whole rupee is shown. */
export function formatInrCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${trim2(a / 1e7)} Cr`;
  if (a >= 1e5) return `${sign}₹${trim2(a / 1e5)} L`;
  return INR_WHOLE.format(n);
}

function trim2(x: number): string {
  return x.toFixed(2).replace(/\.?0+$/, "");
}

/** "1,480.4" - quantities. */
export function formatQty(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? NUM.format(n) : "0";
}

/** The date part of a DATE column. The API sends "2026-10-29T00:00:00.000Z"; reading it through `new Date()` would shift it by the zone. */
export function dateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

/** "29 Oct 2026" */
export function formatDay(value: string | null | undefined): string {
  const d = dateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "-";
  const [y, m, day] = d.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 26" for the month axis. */
export function monthLabel(value: string): string {
  const d = dateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const [y, m] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

function expenseOrgIdentity(row: BizExpenseOrgMonth, level: ExpenseOrgLevel): { id: number | null; label: string | null; path: string[] } {
  switch (level) {
    case "company":
      return { id: row.com_sno, label: row.com_name, path: [row.com_name ?? ""] };
    case "division":
      return { id: row.div_sno, label: row.div_name, path: [row.com_name ?? "", row.div_name ?? ""] };
    case "branch":
      return { id: row.brn_sno, label: row.brn_name, path: [row.com_name ?? "", row.div_name ?? "", row.brn_name ?? ""] };
    case "department":
      return { id: row.dept_sno, label: row.dept_name, path: [row.com_name ?? "", row.div_name ?? "", row.brn_name ?? "", row.dept_name ?? ""] };
  }
}

/** Distinct, path-labelled selector options from only the organisation rows the signed-in user may see. */
export function expenseOrgOptions(rows: BizExpenseOrgMonth[], level: ExpenseOrgLevel): ExpenseOrgOption[] {
  const options = new Map<number, ExpenseOrgOption>();
  for (const row of rows) {
    const item = expenseOrgIdentity(row, level);
    if (item.id == null || options.has(item.id)) continue;
    const label = item.label?.trim() || `${level[0].toUpperCase()}${level.slice(1)} ${item.id}`;
    const path = item.path.map((part) => part.trim()).filter(Boolean).join(" › ") || label;
    options.set(item.id, { id: item.id, label, path });
  }
  return [...options.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function matchesExpenseOrg(row: BizExpenseOrgMonth, level: ExpenseOrgLevel, entityId: number | null): boolean {
  if (entityId == null) return true;
  switch (level) {
    case "company": return row.com_sno === entityId;
    case "division": return row.div_sno === entityId;
    case "branch": return row.brn_sno === entityId;
    case "department": return row.dept_sno === entityId;
  }
}

/** Roll scoped leaf rows up to the selected level and preserve the base 12-month timeline, including zero months. */
export function buildExpenseTrend(
  months: BizMonth[],
  rows: BizExpenseOrgMonth[],
  level: ExpenseOrgLevel,
  entityId: number | null
): ExpenseTrendMonth[] {
  const byMonth = new Map<string, ExpenseTrendMonth>();
  for (const row of rows) {
    if (!matchesExpenseOrg(row, level, entityId)) continue;
    const key = dateOnly(row.month_start);
    const current = byMonth.get(key) ?? { month_start: key, total_expense: 0, recurring_expense: 0, non_recurring_expense: 0, invoice_count: 0 };
    current.total_expense += Number(row.total_expense ?? 0);
    current.recurring_expense += Number(row.recurring_expense ?? 0);
    current.non_recurring_expense += Number(row.non_recurring_expense ?? 0);
    current.invoice_count += Number(row.invoice_count ?? 0);
    byMonth.set(key, current);
  }

  const hasOrganisationData = rows.length > 0;
  return months.map((month) => {
    const key = dateOnly(month.month_start);
    const found = byMonth.get(key);
    if (found) return found;
    // Compatibility while the appended SQL result set is being deployed: the unfiltered view can still use the existing totals.
    if (!hasOrganisationData && entityId == null) {
      const recurring = Number(month.exp_recurring ?? 0);
      const nonRecurring = Number(month.exp_non_recurring ?? 0);
      return { month_start: key, total_expense: recurring + nonRecurring, recurring_expense: recurring, non_recurring_expense: nonRecurring, invoice_count: 0 };
    }
    return { month_start: key, total_expense: 0, recurring_expense: 0, non_recurring_expense: 0, invoice_count: 0 };
  });
}

/** Share 0..1 (never NaN). */
export function share(part: number | null | undefined, whole: number | null | undefined): number {
  const w = Number(whole ?? 0);
  if (!(w > 0)) return 0;
  return Math.min(1, Math.max(0, Number(part ?? 0) / w));
}

export function pct(part: number | null | undefined, whole: number | null | undefined): number {
  return Math.round(share(part, whole) * 100);
}

// ── reading the procedure's output ─────────────────────────────────────────────────────────────────────────────
export function breakdownOf(data: BusinessOverview | null, section: string): BizBreakdown[] {
  return (data?.breakdown ?? []).filter((b) => b.section === section).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export type ExpenseFilter = "ALL" | ExpenseKind;

export function filterExpenses(rows: BizExpense[], kind: ExpenseFilter, query: string): BizExpense[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (kind !== "ALL" && r.kind !== kind) return false;
    if (!q) return true;
    return [r.invoice_no, r.vendor_invoice_no, r.vendor_name, r.po_no, r.what, r.dept_name, r.expense_class].some((v) => (v ?? "").toLowerCase().includes(q));
  });
}

export type PaymentFilter = "ALL" | PayStage;

export function filterPayments(rows: BizPayment[], stage: PaymentFilter, query: string): BizPayment[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (stage !== "ALL" && r.stage !== stage) return false;
    if (!q) return true;
    return [r.payment_no, r.vendor_name, r.utr_no, r.batch_no, r.dept_name, r.mode, r.payment_type].some((v) => (v ?? "").toLowerCase().includes(q));
  });
}

export const STAGE_LABEL: Record<PayStage, string> = { WAITING: "Waiting for approval", APPROVED: "Approved - not yet sent", SENT: "Sent to bank" };

/** What the bank said about a SENT payment. NULL = no answer yet. */
export function bankStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "PAID": return "Bank confirmed";
    case "RETURNED": return "Returned by bank";
    case "PENDING": return "Awaiting bank";
    default: return "Awaiting bank";
  }
}

/** Sum of a numeric column - for the totals row under a table (the headline totals still come from the procedure). */
export function sumOf<T>(rows: T[], pick: (r: T) => number | null | undefined): number {
  return rows.reduce((s, r) => s + Number(pick(r) ?? 0), 0);
}

/** Is there anything at all to show? A user with no org access (or a brand-new install) sees only zeros - say so instead of a wall of 0s. */
export function isEmptyOverview(data: BusinessOverview | null): boolean {
  if (!data) return true;
  if (data.meta?.no_scope === 1) return true;
  const k = data.kpi;
  return [k.inv_items, k.asset_qty, k.pr_total, k.po_total, k.gate_total, k.grn_done, k.pay_waiting_count, k.pay_approved_count, k.pay_sent_count, k.bud_count, k.exp_rec_count, k.exp_non_count]
    .every((v) => !Number(v));
}

/** The numbers that moved between two snapshots - the cards that changed flash once after a live refresh. */
export function diffKpi(prev: BizKpi | null | undefined, next: BizKpi | null | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  if (!prev || !next) return out;
  for (const key of Object.keys(next) as (keyof BizKpi)[]) {
    if (Number(prev[key] ?? 0) !== Number(next[key] ?? 0)) out.add(String(key));
  }
  return out;
}
