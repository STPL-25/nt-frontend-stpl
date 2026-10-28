/**
 * Payment with adjustments (grn-service /api/payment_net, sql/44 + sql/48):
 * payable bills with GRN / GSTR-2B / TDS context, the supplier's advances and debit/credit notes,
 * a preview of the net amount to pay, and the save itself (sql/65: payment entry -> approval -> Payment Run -> payment file).
 */
import { GRN_SERVICE_BASE } from './base';
import type {
  ApprovalLogEntry, ApprovalStageRow, ApprovalSummaryBase, ForwardTarget, SendBackTarget,
} from '@/Application/PR/prApprovalContext';
import type { ConditionFieldDef } from '@/Application/RoleApproval/approvalConditions';

const base = `${GRN_SERVICE_BASE}/api/payment_net`;

export const payNetBills = `${base}/bills`;
export const payNetGrnPending = `${base}/grn-pending`;
// Notes are offered per bill (sql/64): pass the invoices being paid, the server returns only the notes they may redeem.
export const payNetAdjustments = (vendor_sno: number, invoice_snos: number[]) =>
  `${base}/adjustments?vendor_sno=${vendor_sno}&invoice_snos=${invoice_snos.join(',')}`;
export const payNetPreview = `${base}/preview`;
/** Saves the payment: it goes for approval (or is approved at once when the department has no Payment workflow). */
export const payNetRelease = `${base}/release`;
export const payNetTdsSections = `${base}/tds-sections`;

export interface PayableBillNet {
  bill_sno: number; invoice_sno: number; bill_no: string; supplier_invoice_no: string | null; po_no: string | null;
  vendor_sno: number; vendor_name: string; invoice_date: string; due_date: string | null; bucket_type: string;
  net_payable: number; hold_amount: number; paid_amount: number;
  /** what a saved / approved payment (not paid yet) already holds on this bill */
  reserved_amount?: number;
  outstanding: number; invoice_amount: number; taxable_value: number | null;
  tds_section_code: string | null; itc_status: string | null; payment_hold_override: 'Y' | 'N' | null;
  gst_supplier: boolean; gst_booked: boolean; grn_state: 'Done' | 'Pending approval' | 'No GRN' | 'NA'; on_hold_2b: boolean;
  /** (sql/70) the GST share of this bill; the part of it kept back until the invoice shows in GSTR-2B; what can be paid today
   *  (below `outstanding` while that GST is held). taxable_known = the invoice carries a taxable value, so it can be split. */
  gst_amount?: number; gst_held?: number; payable_now?: number; taxable_known?: boolean;
}

export interface GrnPendingPayment {
  po_basic_sno: number; po_no: string; vendor_sno: number; vendor_name: string | null;
  has_invoice: boolean; grn_count: number; grn_nos: string; last_received_date: string | null;
  ordered_qty: number; received_qty: number; qty_variance: number;
  taxable_value: number; gst_value: number; grn_value: number; gst_variance: number; taxable_variance: number;
  debit_notes: number; credit_notes: number; advances: number; tds_estimate: number; net_payable: number;
}
export const payNetInvoiceLedger = `${base}/invoice-ledger`;

/** 'In payment' = a saved / approved payment holds it but the money has not gone yet. */
export type InvoicePaymentStatus = 'Paid' | 'In payment' | 'Part paid' | 'Unpaid' | 'Not allocated';
export interface LedgerInvoice {
  invoice_sno: number; invoice_no: string; supplier_invoice_no: string | null; po_basic_sno: number; po_no: string | null;
  vendor_sno: number; invoice_date: string | null; due_date: string | null; invoice_amount: number; match_status: string | null;
  verification_status: string | null; invoice_file_url: string | null;
  release_total: number; paid_total: number; reserved_total?: number; outstanding: number; payment_status: InvoicePaymentStatus;
  payment_nos: string | null; dup_count: number;
}
export interface LedgerGrn {
  grn_basic_sno: number; grn_no: number; po_basic_sno: number; po_no: string | null; vendor_sno: number; status: string;
  received_date: string | null; invoice_no: string | null; invoice_date: string | null; invoice_amount: number | null;
  invoice_doc_url: string | null; has_invoice_data: boolean; dup_count: number;
}
export interface InvoiceLedger { invoices: LedgerInvoice[]; grns: LedgerGrn[] }

export interface SupplierAdvance {
  advance_sno: number; advance_no: string; po_basic_sno: number | null; po_no?: string | null; paid_date: string; amount: number; balance: number;
  /** OWN = paid against the PO of the invoices being paid; SUPPLIER = its PO is cancelled / settled, so it moves to the supplier's other invoices (sql/70) */
  scope?: 'OWN' | 'SUPPLIER';
}
export interface PendingNote {
  note_sno: number; note_no: string; po_basic_sno: number | null; note_date: string; amount: number; remarks: string | null;
  /** OWN = raised against a bill in this payment (that bill is still open);
   *  SUPPLIER = no open bill behind it - raised against bills already paid in full, or on a PO whose invoice is not entered yet - usable on any bill of the supplier */
  scope?: 'OWN' | 'SUPPLIER';
  /** the invoice(s) the note was raised against, e.g. "INV-2026-000017 (NEO/586)"; null when its invoice is not entered yet */
  source_invoices?: string | null;
}
export type NoteKind = 'DEBIT' | 'CREDIT';
/** Pushed on socket `payment:released` after any payment is released: what it used up. */
export interface PaymentReleasedEvent {
  payment_sno: number; payment_no: string; vendor_sno: number;
  bill_snos: number[]; notes: { type: NoteKind; note_sno: number }[];
}
export type TdsAppliesTo = 'Service' | 'Product' | 'Both';
export interface TdsSection { section_code: string; description: string; rate_individual: number; rate_other: number; is_active: 'Y' | 'N'; applies_to?: TdsAppliesTo }

export interface PaymentAdjustments {
  advances: SupplierAdvance[]; debitNotes: PendingNote[]; creditNotes: PendingNote[]; tdsSections: TdsSection[];
  /** advances approved for the supplier but not paid yet (waiting in Payment Run) - not nettable until paid */
  pendingAdvances?: PendingAdvance[];
}
export interface PendingAdvance { payment_sno: number; payment_no: string; po_basic_sno: number | null; po_no: string | null; amount: number; status: string }

export interface NetSummary {
  gross_amount: number; tds_amount: number; advance_adjusted: number; debit_notes: number; credit_notes: number; net_paid: number;
}
export interface NetInvoiceLine {
  invoice_sno: number; invoice_no: string; gross: number; taxable_base: number; tds_section: string | null;
  tds_rate_pct: number | null; tds_taxable: number | null; tds_amount: number;
  /** (sql/70) what the invoice may be paid in all, what was paid / held before this payment, what is left after it; is_part = more is still to pay or was paid before */
  payable_total?: number; paid_before?: number; balance_after?: number; is_part?: boolean; supplier_invoice_no?: string | null;
}
export interface NetPreview { summary: NetSummary | null; invoices: NetInvoiceLine[] }

/** What POST /release returns (sql/65): the saved payment and where it went. */
export interface SavedPayment {
  payment_sno: number; payment_no: string; net_paid: number; status: PaymentStatus; current_approver_id: string | null; is_final: boolean;
}

// ── approval + Payment Run (sql/65) ─────────────────────────────────────────
export const payNetEntries = `${base}/entries`;
export const payNetEntryDetail = (payment_sno: number) => `${base}/entries/${payment_sno}`;
export const payNetApprove = `${base}/approve`;
/** The approver pays less now (sql/70): { payment_sno, reason, allocations: [{ invoice_sno, amount }] }; the rest stays on the invoice. */
export const payNetRevise = `${base}/revise`;
export const payNetCancel = `${base}/cancel`;
export const payNetRunProceed = `${base}/run/proceed`;
export const payNetRunBatches = `${base}/run/batches`;
export const payNetRunBatchFile = (batch_sno: number) => `${base}/run/batches/${batch_sno}/file`;
/** The sheet the auditor / payment inputter checks the bank's screen against (invoice-wise, part payments, TDS, balance left) */
export const payNetRunBatchVerification = (batch_sno: number) => `${base}/run/batches/${batch_sno}/verification`;
/** A supplier paid on their portal: no run, no file - record the transaction once it is paid there (sql/69). */
export const payNetPortalPay = `${base}/run/portal-payment`;
export const payNetPortalPayments = `${base}/run/portal-payments`;
/** TDS taken on each invoice (deductee, deductor, section, rate, amount) */
export const payNetTdsRecords = `${base}/tds-records`;

export type PortalMode = 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'Wallet' | 'Other';
export interface PortalPayment {
  txn_sno: number; payment_sno: number; payment_no: string; vendor_name: string | null; supp_code: string | null; portal_name: string | null;
  txn_mode: PortalMode; txn_id: string; txn_date: string; net_paid: number; amount_paid: number; discount_amount: number;
  remarks: string | null; recorded_by: string | null; recorded_at: string; com_name: string | null;
}
export interface TdsRecord {
  deduction_sno: number; payment_sno: number; payment_no: string; payment_status: PaymentStatus; payment_date: string | null;
  invoice_sno: number; invoice_no: string | null; supplier_invoice_no: string | null;
  vendor_sno: number; vendor_name: string | null; supp_code: string | null; vendor_pan: string | null;
  deductor_name: string | null; deductor_tan: string | null; deductor_pan: string | null;
  section_code: string; section_description: string | null; fin_year: string | null; base_amount: number; base_deducted: number; rate_pct: number; tds_amount: number;
}

/** The company's bank accounts a run can be paid from (Payment Bank master): ?com_sno= */
export const payNetRunSenders = `${base}/run/senders`;

/** Pending Approval -> Approved -> Processed (paid in a run); Rejected / Cancelled end a payment early. */
export type PaymentStatus = 'Pending Approval' | 'Approved' | 'Processed' | 'Rejected' | 'Cancelled';
/** BANK goes in the payment file; the rest are paid another way (MANUAL = cheque / cash / DD, PORTAL = supplier's portal) or need no payout (ADJUSTMENT). */
export type PayChannel = 'BANK' | 'PORTAL' | 'MANUAL' | 'ADJUSTMENT';
export type MsmeClass = 'MICRO' | 'SMALL' | 'MEDIUM' | 'MSME';

/** One saved payment. Dates are yyyy-mm-dd (plus a time zone the screens ignore). */
export interface PaymentEntry {
  /** ADVANCE = the quotation's advance, due once its PO is approved (sql/69); it has no invoices, and paying it creates a supplier advance */
  payment_type?: 'BILL' | 'ADVANCE'; po_basic_sno?: number | null; adv_stage_no?: number | null;
  payment_sno: number; payment_no: string; vendor_sno: number; vendor_name: string | null; supp_code: string | null; vendor_email: string | null;
  mode: string; debit_account: string | null; reference_no: string | null; remarks: string | null; payment_date: string | null;
  status: PaymentStatus; current_approver_id: string | null; workflow_types_id: number | null;
  created_by: string | null; created_at: string; approved_at: string | null; processed_at: string | null; batch_sno: number | null; batch_no: string | null;
  gross_amount: number | null; tds_amount: number | null; advance_adjusted: number | null; note_adjusted: number | null; net_paid: number; amount: number;
  com_sno: number | null; div_sno: number | null; brn_sno: number | null; dept_sno: number | null; com_name: string | null;
  msme_class: MsmeClass | null; msme_label: string | null;
  /** 1 Micro, 2 Small, 3 Medium / MSME with no type, 4 not an MSME */
  msme_tier: 1 | 2 | 3 | 4; msme_no: string | null;
  /** Micro / Small (or MSME with no type): the statutory payment limit applies */
  is_statutory: boolean;
  pay_via_portal: boolean; payment_portal_name: string | null; payment_portal_url: string | null;
  ac_holder_name: string | null; ac_number: string | null; ifsc: string | null; bank_name: string | null; bank_branch_name: string | null;
  channel: PayChannel; bank_ready: boolean;
  invoice_count: number; invoice_nos: string | null; supplier_invoice_nos: string | null; po_nos: string | null; gate_entry_nos: string | null; grn_nos: string | null;
  first_gate_entry_date: string | null; first_grn_date: string | null; accepted_date: string | null; due_date: string | null; statutory_due_date: string | null;
  days_to_due: number | null; is_overdue: boolean;
}

export interface PaymentEntryLine {
  payment_sno: number; invoice_sno: number; invoice_no: string; supplier_invoice_no: string | null; po_no: string | null; invoice_date: string | null;
  amount: number; bucket_type: string | null; gate_entry_nos: string | null; gate_entry_date: string | null; grn_nos: string | null; grn_date: string | null;
  received_date: string | null; due_date: string | null;
}

export interface PaymentEntries {
  entries: PaymentEntry[]; lines: PaymentEntryLine[];
  /** MSME_LIMIT_DAYS, DEFAULT_CREDIT_DAYS (nt_payment_run_setting) */
  settings: Record<string, string>;
}

export interface PaymentHistoryItem { action_type: string; status_by: string | null; comment: string | null; created_at: string }
export interface PaymentAdjustmentLine {
  adj_type: 'TDS' | 'ADVANCE' | 'DEBIT_NOTE' | 'CREDIT_NOTE'; ref_sno: number | null; invoice_sno: number | null; amount: number; ref_no: string | null; invoice_no: string | null;
}
/**
 * One stage of the chain a payment follows (sql/66): who approves, the rule that makes the stage necessary (condition_json,
 * e.g. amount above ₹50,000), whether the rule holds for THIS payment (condition_met) and what happened here (state).
 * Same shape as a PR's stage, so the PR approval path component draws it.
 */
export type PaymentStage = ApprovalStageRow;

/** What the signed-in user may do with a payment right now, worked out by the database from the stage the payment is at. */
export interface PaymentApprovalSummary extends ApprovalSummaryBase {
  payment_sno: number; payment_status: PaymentStatus; entity_type: string;
  /** net payable - the value the stage rules are tested against */
  amount: number;
  gross_amount: number | null; created_by: string | null;
}
export interface PaymentApproval {
  /** null when the payment has no approval record at all */
  summary: PaymentApprovalSummary | null;
  /** later stages the approver may hand the payment to - including ones the rules did not require */
  forward_targets: ForwardTarget[];
  /** earlier stages that already acted in this round */
  send_back_targets: SendBackTarget[];
  /** every step of the engine, incl. stages passed over */
  log: ApprovalLogEntry[];
  /** what a stage rule can test on a payment (labels / units), for describing the rules in words */
  condition_fields: ConditionFieldDef[];
}
/** forward / send_back carry target_seq (a stage number); reject and send_back need remarks. */
export type PaymentApprovalAction = 'approve' | 'reject' | 'forward' | 'send_back';
/** What POST /approve returns: where the payment went. `next_approver` is set while it stays in approval. */
export type PaymentApprovalResult = 'APPROVED_NEXT' | 'FINAL' | 'REJECTED' | 'FORWARDED' | 'SENT_BACK';
export interface PaymentDecision {
  result: PaymentApprovalResult; payment_sno: number; payment_no: string; net_paid: number; status: PaymentStatus;
  next_approver: string | null; next_seq: number | null; stage_name: string | null; acted_as: string | null;
}
/** One invoice of a payment with what an approver needs to decide how much to pay now (sql/70). */
export interface PaymentInvoiceFigures {
  invoice_sno: number; invoice_no: string; supplier_invoice_no: string | null; invoice_amount: number | null; gst_amount: number | null;
  /** what the invoice may be paid in all */
  payable_total: number;
  /** held or paid by OTHER payments */
  paid_other: number;
  /** what this payment pays on it */
  this_amount: number;
  /** left to pay after this payment */
  balance_after: number;
  on_hold_2b: boolean; hold_2b: number;
}
export interface PaymentDetail {
  entry: PaymentEntry; lines: PaymentEntryLine[]; invoices?: PaymentInvoiceFigures[]; history: PaymentHistoryItem[]; adjustments: PaymentAdjustmentLine[]; stages: PaymentStage[];
  approval: PaymentApproval;
}

/** One bank account of a company in the Payment Bank master - what a run is paid from. Only the last 4 digits of the number come to the screen. */
export interface PaymentSender {
  payment_bank_sno: number; com_sno: number; com_name: string | null; div_sno: number; div_name: string | null; brn_sno: number; brn_name: string | null;
  profile_name: string; bank_name: string; branch_name: string | null;
  ac_holder_name: string; ac_last4: string; ifsc: string;
  /** the layout of the payment file this account's bank takes */
  file_type: string; client_code: string; file_code: number; is_default: 'Y' | 'N';
}

export interface PaymentBatch {
  batch_sno: number; batch_no: string; batch_date: string; com_sno: number | null; com_name?: string | null;
  div_sno?: number | null; div_name?: string | null; brn_sno?: number | null; brn_name?: string | null;
  fund_plan_amount: number; total_amount: number; item_count: number; status: string; file_name: string | null; has_file?: boolean;
  created_by: string | null; created_at: string;
  /** the account the run was paid from (null for a run from before the Payment Bank master, or one with no bank transfer) */
  file_no?: number | null; file_type?: string | null; payment_bank_sno?: number | null; sender_name?: string | null; sender_bank_name?: string | null;
  sender_ac_last4?: string | null; sender_client_code?: string | null;
}
export interface PaymentBatchItem {
  payment_sno: number; payment_no: string; line_no: number; vendor_name: string | null; amount: number; mode: string | null; channel: PayChannel;
  beneficiary_name: string | null; account_no: string | null; ifsc: string | null; invoice_nos: string | null;
}
export interface PaymentFile { file_name: string; mime_type: string; content: string; line_count?: number; total_amount?: number }
export interface SkippedPayment { payment_no: string; vendor_name: string | null; amount: number; channel: PayChannel; reason: string }
export interface RunResult {
  batch: PaymentBatch; items: PaymentBatchItem[]; skipped: SkippedPayment[]; file: PaymentFile;
  /** the verification sheet (CSV) for the checker of the bank upload; null when the run has no bank transfer */
  verification?: PaymentFile | null;
}

/** Pushed on socket `payment:updated` whenever a payment is saved, approved, rejected, cancelled or paid. */
export interface PaymentUpdatedEvent { payment_sno: number; payment_no: string; status: PaymentStatus; batch_no?: string; payment_snos?: number[] }
