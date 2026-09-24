import {
  DAY_COUNT_LABEL, facilityLabel, formatDate, formatINR, ordinalDay, type StatusMeta,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

// Types, status maps and the print layout shared by the Loan Payments screens and the
// Loan Voucher approval screen. Server side: backend-stpl/sql/89_loan_facility_bank_payment_voucher.sql.

export interface LoanSegment {
  seg_no: number;
  from_date: string;
  /** Last day of the slice (inclusive). */
  to_date: string;
  days: number;
  principal: number;
  benchmark_rate_pct?: number | null;
  spread_pct?: number | null;
  rate_pct: number;
  interest: number;
}

export interface LoanAccount {
  agreement_sno: number; agreement_no: string; agreement_status: 'A' | 'X';
  com_sno: number; div_sno: number; brn_sno: number; dept_sno: number;
  vendor_sno: number; vendor_name?: string; service_name: string;
  period_start_date: string; period_end_date: string;
  facility_type: string; facility_ref_no?: string;
  sanctioned_amount: number; drawing_power?: number | null;
  rate_type: 'FIXED' | 'FLOATING'; benchmark_name?: string | null;
  benchmark_rate_pct?: number | null; spread_pct?: number | null; sanctioned_rate_pct: number;
  disbursed_amount: number; disbursement_date: string;
  interest_payment_day: number; day_count_basis: number;
  /** Where the next voucher starts — the end of the last approved / paid voucher (else disbursement). */
  billed_through: string;
  current_rate_pct: number; accrued_interest: number; principal_outstanding: number;
  next_due_date?: string | null;
  pending_voucher_sno?: number | null; pending_voucher_no?: string | null;
  unpaid_voucher_sno?: number | null; unpaid_voucher_no?: string | null;
  voucher_count: number; interest_billed: number;
}

export interface LoanRate {
  rate_period_sno?: number | null;
  effective_from: string;
  /** Last day this rate applies (absent = still current). */
  effective_to?: string | null;
  benchmark_rate_pct?: number | null; spread_pct?: number | null; interest_rate_pct: number;
  source: 'SANCTIONED' | 'ENTERED';
  remarks?: string | null; created_by?: string | null;
  can_delete: 0 | 1;
}

export interface LoanTxn {
  txn_sno?: number | null;
  txn_date: string; txn_type: 'DRAWDOWN' | 'REPAYMENT'; amount: number;
  voucher_sno?: number | null; remarks?: string | null; created_by?: string | null;
  source: 'OPENING' | 'MANUAL' | 'VOUCHER';
  principal_after: number;
  can_delete: 0 | 1;
}

export interface LoanVoucherSummary {
  voucher_sno: number; voucher_no: string;
  period_from: string; period_to: string; days: number;
  interest_amount: number; principal_repayment: number; total_payable: number; principal_after: number;
  rate_pct: number; status: VoucherStatus; created_at: string; paid_on?: string | null;
}

export interface LoanBeneficiary {
  ac_holder_name?: string; ac_number?: number | string; ifsc?: string; bank_name?: string; bank_branch_name?: string;
}

export interface LoanDetail {
  agreement_sno: number;
  billed_through: string;
  locked_through: string;
  rates: LoanRate[];
  txns: LoanTxn[];
  vouchers: LoanVoucherSummary[];
  /** The vendor's active/primary bank account (KYC) — null if none is on file yet. */
  beneficiary: LoanBeneficiary | null;
}

export type VoucherStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED';

/** What sp_nt_PreviewLoanInterest returns (segments parsed by the API). */
export interface VoucherPreview {
  agreement_sno: number; agreement_no: string;
  period_from: string; period_to: string; default_payment_date: string;
  days: number; day_count_basis: number;
  opening_principal: number; principal_on_payment: number;
  principal_repayment: number; interest_amount: number; total_payable: number; principal_after: number;
  rate_pct: number; rate_effective_from?: string | null;
  segments: LoanSegment[];
  next_due_date?: string | null; next_days?: number | null; next_est_interest?: number | null;
  next_segments: LoanSegment[];
  rate_type: 'FIXED' | 'FLOATING'; benchmark_name?: string | null; interest_payment_day: number;
  is_projected: 0 | 1; projected_days: number;
  open_voucher_sno?: number | null; open_voucher_no?: string | null;
}

export interface BankPaymentVoucher {
  voucher_sno: number; voucher_no: string; agreement_sno: number; agreement_no: string;
  service_name?: string; vendor_name?: string; vendor_code?: string;
  facility_type?: string; facility_ref_no?: string; rate_type?: 'FIXED' | 'FLOATING'; benchmark_name?: string | null;
  sanctioned_amount?: number; disbursed_amount?: number; disbursement_date?: string; interest_payment_day?: number;
  com_name?: string; div_name?: string; brn_name?: string; dept_name?: string;
  period_from: string; period_to: string; days: number; day_count_basis: number;
  opening_principal: number; principal_on_payment: number; interest_amount: number;
  principal_repayment: number; total_payable: number; principal_after: number; rate_pct: number;
  segments: LoanSegment[];
  next_due_date?: string | null; next_days?: number | null; next_est_interest?: number | null; next_segments?: LoanSegment[];
  remarks?: string | null;
  status: VoucherStatus; current_approver_id?: string | null;
  created_by: string; created_at: string; approved_at?: string | null;
  paid_on?: string | null; payment_mode?: string | null; payment_ref_no?: string | null; paid_from_bank?: string | null; paid_by?: string | null;
  beneficiary?: { ac_holder_name?: string; ac_number?: number | string; ifsc?: string; bank_name?: string; bank_branch_name?: string } | null;
  history?: { action_type: string; status_by: string; comment?: string | null; created_at: string }[];
  stage_order_json?: string;
}

export const VOUCHER_STATUS: Record<string, StatusMeta> = {
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warning' },
  APPROVED: { label: 'Approved · to pay', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

export const VOUCHER_EVENT: Record<string, string> = {
  CREATED: 'Voucher raised', APPROVED: 'Approved', REJECTED: 'Rejected', PAID: 'Marked paid',
};

export const PAYMENT_MODES = ['NEFT', 'RTGS', 'Cheque', 'DD', 'UPI', 'ECS', 'Cash'];

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** yyyy-mm-dd + n days, staying in UTC so a timezone can't shift the date. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "01 Jan – 15 Jan 2026" style range for a slice. */
export function formatRange(from: string, to: string): string {
  const f = formatDate(from), t = formatDate(to);
  return f === t ? f : `${f} – ${t}`;
}

/** Rate cell text: "14%" for a fixed slice, "14% (Repo 12% + 2%)" when it is benchmark + spread. */
export function rateText(s: Pick<LoanSegment, 'rate_pct' | 'benchmark_rate_pct' | 'spread_pct'>, benchmarkName?: string | null): string {
  const base = `${Number(s.rate_pct)}%`;
  if (s.benchmark_rate_pct == null) return base;
  return `${base} (${benchmarkName ?? 'Repo'} ${Number(s.benchmark_rate_pct)}% + ${Number(s.spread_pct ?? 0)}%)`;
}

export const facilityText = (t?: string | null) => facilityLabel(t);

// ─── Amount in words (Indian system) ───────────────────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '')); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

/** 114602.74 → "Rupees One Lakh Fourteen Thousand Six Hundred Two and Paise Seventy Four Only" */
export function amountInWords(value: number | string): string {
  const total = Math.round(Number(value) * 100);
  if (!Number.isFinite(total) || total <= 0) return 'Rupees Zero Only';
  let rupees = Math.floor(total / 100);
  const paise = total % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000); rupees %= 10_000_000;
  const lakh = Math.floor(rupees / 100_000); rupees %= 100_000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (rupees) parts.push(below1000(rupees));
  const rupeeText = parts.join(' ') || 'Zero';
  return `Rupees ${rupeeText}${paise ? ` and Paise ${below1000(paise)}` : ''} Only`;
}

// ─── Print ─────────────────────────────────────────────────────────────────

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Opens the voucher in a print-ready window (the app shell has sidebars, so a plain window.print() would print those too). */
export function printVoucher(v: BankPaymentVoucher): void {
  const bene = v.beneficiary;
  const rows = (v.segments ?? []).map((s) => `
    <tr>
      <td>${esc(formatRange(s.from_date, s.to_date))}</td>
      <td class="r">${esc(s.days)}</td>
      <td class="r">${esc(formatINR(s.principal))}</td>
      <td class="r">${esc(rateText(s, v.benchmark_name))}</td>
      <td class="r">${esc(formatINR(s.interest))}</td>
    </tr>`).join('');
  const org = [v.com_name, v.div_name, v.brn_name, v.dept_name].filter(Boolean).join(' / ');
  const paid = v.status === 'PAID'
    ? `<p class="note">Paid on ${esc(formatDate(v.paid_on))} by ${esc(v.payment_mode)}${v.payment_ref_no ? ` · Ref ${esc(v.payment_ref_no)}` : ''}${v.paid_from_bank ? ` · from ${esc(v.paid_from_bank)}` : ''}</p>`
    : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.voucher_no)}</title>
<style>
  *{box-sizing:border-box} body{font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;letter-spacing:.08em;text-align:center;margin:0 0 2px} .sub{text-align:center;color:#555;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:10px 0 14px}
  .grid div span{color:#666;display:inline-block;min-width:130px}
  table{width:100%;border-collapse:collapse;margin:8px 0} th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}
  th{background:#f2f2f2;font-size:11px;text-transform:uppercase;letter-spacing:.04em} .r{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td{font-weight:700;background:#fafafa} .tot td{font-size:14px}
  .words{margin:8px 0;font-style:italic} .note{color:#333;margin:10px 0}
  .sig{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:56px;text-align:center}
  .sig div{border-top:1px solid #555;padding-top:4px;color:#444} h2{font-size:13px;margin:14px 0 4px}
  @media print{body{margin:12mm}}
</style></head><body>
  <h1>BANK PAYMENT VOUCHER</h1>
  <div class="sub">${esc(org)}</div>
  <div class="grid">
    <div><span>Voucher no.</span><b>${esc(v.voucher_no)}</b></div>
    <div><span>Date</span>${esc(formatDate(v.created_at))}</div>
    <div><span>Pay to</span><b>${esc(v.vendor_name)}</b></div>
    <div><span>Payment date</span><b>${esc(formatDate(v.period_to))}</b></div>
    <div><span>Loan</span>${esc(facilityLabel(v.facility_type))} · ${esc(v.agreement_no)}${v.facility_ref_no ? ` · ${esc(v.facility_ref_no)}` : ''}</div>
    <div><span>Interest period</span>${esc(formatDate(v.period_from))} to ${esc(formatDate(addDaysIso(v.period_to, -1)))} (${esc(v.days)} days, ${esc(DAY_COUNT_LABEL[String(v.day_count_basis)] ?? '')})</div>
    ${bene ? `<div><span>Beneficiary a/c</span>${esc(bene.ac_holder_name)} · ${esc(bene.ac_number)}</div><div><span>Bank / IFSC</span>${esc(bene.bank_name)}${bene.bank_branch_name ? `, ${esc(bene.bank_branch_name)}` : ''} · ${esc(bene.ifsc)}</div>` : ''}
    <div><span>Interest paid on</span>${v.interest_payment_day ? `${esc(ordinalDay(v.interest_payment_day))} of every month` : '—'}</div>
    <div><span>Rate on payment date</span>${esc(Number(v.rate_pct))}%</div>
  </div>

  <h2>Interest calculation</h2>
  <table>
    <thead><tr><th>Period</th><th class="r">Days</th><th class="r">Principal</th><th class="r">Rate p.a.</th><th class="r">Interest</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4">Interest for ${esc(v.days)} days</td><td class="r">${esc(formatINR(v.interest_amount))}</td></tr></tfoot>
  </table>

  <table>
    <tbody>
      <tr><td>Principal outstanding on payment date</td><td class="r">${esc(formatINR(v.principal_on_payment))}</td></tr>
      <tr><td>Interest payable</td><td class="r">${esc(formatINR(v.interest_amount))}</td></tr>
      <tr><td>Principal repayment</td><td class="r">${esc(formatINR(v.principal_repayment))}</td></tr>
      <tr class="tot"><td><b>Total payable</b></td><td class="r"><b>${esc(formatINR(v.total_payable))}</b></td></tr>
      <tr><td>Principal outstanding after this payment</td><td class="r">${esc(formatINR(v.principal_after))}</td></tr>
      ${v.next_due_date ? `<tr><td>Next interest: ${esc(formatDate(v.next_due_date))} (${esc(v.next_days)} days, estimated)</td><td class="r">${esc(formatINR(v.next_est_interest))}</td></tr>` : ''}
    </tbody>
  </table>
  <p class="words">${esc(amountInWords(v.total_payable))}</p>
  ${v.remarks ? `<p class="note"><b>Narration:</b> ${esc(v.remarks)}</p>` : ''}
  ${paid}
  <div class="sig"><div>Prepared by (${esc(v.created_by)})</div><div>Checked by</div><div>Approved by</div></div>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
