import { SUPPLIER_SERVICE_BASE } from './base';

const base = `${SUPPLIER_SERVICE_BASE}/api/supplier`;

export const supplierInvite = `${base}/invite`;
export const supplierLogin = `${base}/login`;
export const supplierResetPassword = `${base}/reset-password`;
export const supplierGetPOs = `${base}/pos`;
export const supplierGetPODetail = (po_basic_sno: number) => `${base}/pos/${po_basic_sno}`;
export const supplierAcceptPO = (po_basic_sno: number) => `${base}/pos/${po_basic_sno}/accept`;
export const supplierCreateDispatch = (po_basic_sno: number) => `${base}/pos/${po_basic_sno}/dispatch`;
export const supplierGetTransporters = `${base}/transporters`;
export const supplierGetDispatchSlip = (dispatch_slip_sno: number) => `${base}/dispatch/${dispatch_slip_sno}`;
export const supplierGetDispatchDelivery = (delivery_sno: number) => `${base}/dispatch/delivery/${delivery_sno}`;
export const supplierGetDebitNotes = `${base}/debit-notes`;
export const supplierGetDebitNoteDetail = (debit_note_sno: number) => `${base}/debit-notes/${debit_note_sno}`;
export const supplierGetPayments = `${base}/payments`;
export const supplierGetCreditNotes = `${base}/credit-notes`;
export const supplierGetCreditNoteDetail = (credit_note_sno: number) => `${base}/credit-notes/${credit_note_sno}`;
export const supplierNoteLedgers = `${base}/note-ledgers`;
export const supplierRemoveNoteLedger = (ledger_sno: number) => `${base}/note-ledgers/${ledger_sno}`;
export const supplierGetRfqs = `${base}/rfqs`;
export const supplierGetRfqDetail = (rfq_supplier_sno: number) => `${base}/rfqs/${rfq_supplier_sno}`;
export const supplierRespondRfq = (rfq_supplier_sno: number) => `${base}/rfqs/${rfq_supplier_sno}/respond`;
export const supplierDeclineRfq = (rfq_supplier_sno: number) => `${base}/rfqs/${rfq_supplier_sno}/decline`;
export const supplierKyc = `${base}/kyc`;
export const supplierKycModify = `${base}/kyc/modify`;
export const supplierKycWithdraw = `${base}/kyc/withdraw`;

// The portal's notification bell. Served by notification-service (not grn-service), reached through the gateway at
// /api/notifications/supplier and authenticated with the same supplier Bearer JWT; the recipient comes from the token.
const notificationsBase = `${SUPPLIER_SERVICE_BASE}/api/notifications/supplier`;
export const supplierNotifications = notificationsBase;
export const supplierNotificationsReadAll = `${notificationsBase}/read-all`;
export const supplierNotificationsClearRead = `${notificationsBase}/read`;
export const supplierNotificationRead = (id: string) => `${notificationsBase}/${id}/read`;
export const supplierNotificationRemove = (id: string) => `${notificationsBase}/${id}`;

// ── Request For Quotation (sql/86_supplier_rfq_portal.sql) ──────────────────────────────────────────
/** Where this supplier stands on one request for quotation. */
export type SupplierRfqStatus = 'PENDING' | 'VIEWED' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'DECLINED' | 'TAKEN' | 'CLOSED';

/** sp_nt_GetRfqsForSupplier */
export interface SupplierRfqListItem {
  rfq_supplier_sno: number;
  rfq_no: string;
  com_name: string | null;
  due_date: string;
  notes: string | null;
  status: SupplierRfqStatus;
  rfq_status: 'O' | 'X';
  response_count: number;
  revision_note: string | null;
  current_version: number | null;
  grand_total: number | null;
  last_submitted_at: string | null;
  requested_at: string;
  item_count: number;
  /** open, before the due date and not already accepted - the supplier may submit (again). */
  can_respond: boolean;
}

export interface SupplierRfqHeader {
  rfq_supplier_sno: number;
  rfq_no: string;
  com_name: string | null;
  notes: string | null;
  status: SupplierRfqStatus;
  rfq_status: 'O' | 'X';
  due_date: string;
  revision_note: string | null;
  decline_reason: string | null;
  response_count: number;
  current_version: number | null;
  requested_at: string;
  can_respond: boolean;
}

/** One requested line, with the prices of the supplier's latest submitted version (zero/blank when none yet). */
export interface SupplierRfqItem {
  rfq_item_sno: number;
  prod_sno: number | null;
  prod_name: string;
  specification: string | null;
  qty: number;
  unit: number | null;
  unit_name: string | null;
  is_quoted: boolean;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  total_amount: number;
  delivery_days: number | null;
  remarks: string | null;
  /** Raw JSON text of the Warranty / AMC / Other covers. */
  additional_json: string | null;
}

export interface SupplierRfqLatestResponse {
  rfq_response_sno: number;
  version_no: number;
  quotation_ref_no: string | null;
  quotation_date: string | null;
  valid_upto: string | null;
  currency_code: string;
  payment_terms: string | null;
  delivery_days: number | null;
  remarks: string | null;
  freight_charges: number;
  freight_gst_pct: number;
  other_charges: number;
  other_charges_gst_pct: number;
  items_total: number;
  grand_total: number;
  quotation_file: string | null;
  submitted_at: string;
}

export interface SupplierRfqVersion {
  version_no: number;
  submitted_at: string;
  grand_total: number;
  valid_upto: string | null;
  change_note: string | null;
  quotation_file: string | null;
}

export interface SupplierRfqDetail {
  header: SupplierRfqHeader;
  items: SupplierRfqItem[];
  response: SupplierRfqLatestResponse | null;
  versions: SupplierRfqVersion[];
  payment_terms: string[];
}

/** What the Quotation Entry form sends (as the `payload` JSON of a multipart request, next to the optional document). */
export interface SupplierRfqSubmission {
  quotation_ref_no?: string;
  quotation_date?: string;
  valid_upto: string;
  currency_code?: string;
  payment_terms?: string;
  delivery_days?: number | null;
  remarks?: string;
  change_note?: string;
  freight_charges: number;
  freight_gst_pct: number;
  other_charges: number;
  other_charges_gst_pct: number;
  items: Array<{
    rfq_item_sno: number;
    is_quoted: boolean;
    unit_price: number;
    discount_pct: number;
    tax_pct: number;
    delivery_days?: number | null;
    remarks?: string;
    additional?: unknown[];
  }>;
}

/** sp_nt_GetPaymentsForSupplier — what the supplier is (or will be) paid. 'Scheduled' = approved, waiting for a payment run. */
export interface SupplierPaymentItem {
  payment_sno: number;
  payment_no: string;
  payment_type: 'BILL' | 'ADVANCE';
  status: 'Scheduled' | 'Paid';
  payment_date: string | null;
  processed_at: string | null;
  batch_no: string | null;
  mode: string | null;
  gross_amount: number;
  tds_amount: number;
  advance_adjusted: number;
  note_adjusted: number;
  net_paid: number;
  po_nos: string | null;
  invoice_nos: string | null;
  supplier_invoice_nos: string | null;
  planned_for: string | null;
}
/** An advance paid to the supplier, with how much of it has been netted off bills. */
export interface SupplierAdvanceItem {
  advance_sno: number;
  advance_no: string;
  po_basic_sno: number | null;
  po_no: string | null;
  paid_date: string;
  amount: number;
  adjusted_amount: number;
  balance: number;
  remarks: string | null;
}
export interface SupplierPaymentsData { payments: SupplierPaymentItem[]; advances: SupplierAdvanceItem[] }

export interface SupplierPOListItem {
  po_basic_sno: number;
  po_no: string;
  po_date: string;
  required_date: string;
  delivery_address: string;
  status: string;
  supplier_ack_status: 'Accepted' | null;
  supplier_ack_date: string | null;
  po_pdf_url: string | null;
  com_name: string | null;
  dispatch_count: number;
}

export interface SupplierPOItem {
  po_item_sno: number;
  prod_sno: number | null;
  prod_name: string;
  specification: string | null;
  ordered_qty: number;
  unit_name: string | null;
  unit_price: number;
  /** Discount on the line, in percent. Absent on a payload from before sql/89. */
  discount_pct?: number;
  /** GST on the line, in percent. Absent on a payload from before sql/89. */
  tax_pct?: number;
  /** qty x unit price after discount, before GST (sql/89). */
  taxable_amount?: number;
  /** GST on the line (sql/89). */
  tax_amount?: number;
  /** The line total INCLUDING GST (computed from the line, sql/89 - the stored net_cost column was not reliable). */
  total_amount: number;
}

export interface SupplierPODetail {
  po_basic_sno: number;
  po_no: string;
  po_date: string;
  required_date: string;
  delivery_address: string;
  terms_conditions: string | null;
  purpose: string | null;
  status: string;
  supplier_ack_status: 'Accepted' | null;
  supplier_ack_date: string | null;
  po_pdf_url: string | null;
  com_name: string | null;
  vendor_name: string | null;
  /** Raw FOR JSON PATH string from MSSQL — parse before use. */
  items: string | SupplierPOItem[];
}

export type DispatchMode = 'Transport' | 'Direct';

/** Row from the transporter master (sp_nt_GetTransportRecords). */
export interface TransporterOption {
  transport_sno: number;
  transport_code: string | null;
  transport_name: string;
}

/** One delivery (shipment/LR) entered on the dispatch form. */
export interface DeliveryFormValues {
  lr_no: string;
  invoice_no: string;
  invoice_date: string;
  qty?: number;
  pieces?: number;
  bundles?: number;
  /** Invoice copy — compulsory when dispatching via a transporter. */
  invoice_file?: File | null;
}

export interface DispatchFormValues {
  dispatch_mode: DispatchMode;
  transport_sno?: number;
  transport_name?: string;
  deliveries: DeliveryFormValues[];
}

/** One row returned right after sp_nt_CreateDispatchSlip creates it. */
export interface CreatedDelivery {
  delivery_sno: number;
  lr_no: string | null;
  invoice_no: string;
}

export interface DispatchCreateResult {
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  status: string;
  deliveries: CreatedDelivery[];
}

interface FromAddressFields {
  from_door_no: string | null;
  from_street: string | null;
  from_area: string | null;
  from_city: string | null;
  from_state: string | null;
  from_pincode: string | null;
}

/** sp_nt_GetDispatchSlip recap — header + every delivery under it. */
export interface SupplierDispatchSlip {
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  po_basic_sno: number;
  po_no: string;
  transport_sno: number | null;
  transport_name: string | null;
  dispatch_mode: DispatchMode;
  status: string;
  created_at: string;
  deliveries: Array<{
    delivery_sno: number;
    lr_no: string | null;
    invoice_no: string;
    invoice_date: string;
    qty: number | null;
    pieces: number | null;
    bundles: number | null;
    invoice_file_url: string | null;
  }>;
}

/** sp_nt_GetDispatchDelivery — everything needed to print ONE delivery's slip. */
export interface SupplierDispatchDelivery extends FromAddressFields {
  delivery_sno: number;
  lr_no: string | null;
  invoice_no: string;
  invoice_date: string;
  qty: number | null;
  pieces: number | null;
  bundles: number | null;
  invoice_file_url: string | null;
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  transport_sno: number | null;
  transport_name: string | null;
  dispatch_mode: DispatchMode;
  po_basic_sno: number;
  po_no: string;
  supplier_name: string | null;
  to_address: string | null;
}

/**
 * The code encoded in a delivery slip's QR: the LR number when there is one,
 * else a 'DSD-<delivery_sno>' fallback (Direct dispatches may have no LR).
 * sp_nt_GetDispatchDeliveryByLr resolves both forms at the gate.
 */
export function dispatchQrCode(delivery: { lr_no: string | null; delivery_sno: number }): string {
  return delivery.lr_no || `DSD-${delivery.delivery_sno}`;
}

export type DebitNoteReasonType = 'Damage' | 'Shortage' | 'Return';
/** Credit notes are raised when more arrived than the supplier invoiced (sql/71) and add to what the supplier is paid. */
export type CreditNoteReasonType = 'Excess' | string;

/**
 * A ledger (statement of account) the supplier uploaded on the Debit / Credit Notes screen (sql/87_supplier_note_ledger.sql).
 * scope 'NOTE' belongs to one debit or credit note (note_kind + note_sno); scope 'INVOICE' (invoice_no) covers every debit and
 * credit note on that supplier invoice.
 */
export interface SupplierNoteLedger {
  ledger_sno: number;
  scope: 'NOTE' | 'INVOICE';
  note_kind: 'DEBIT' | 'CREDIT' | null;
  note_sno: number | null;
  invoice_no: string | null;
  file_url: string;
  file_name: string | null;
  remarks: string | null;
  uploaded_by: string | null;
  uploaded_date: string;
}

/** What a ledger upload is attached to. */
export type SupplierNoteLedgerTarget =
  | { scope: 'NOTE'; note_kind: 'DEBIT' | 'CREDIT'; note_sno: number }
  | { scope: 'INVOICE'; invoice_no: string };

/** sp_nt_GetCreditNotesForSupplier - same shape as a debit note row (the invoice is the gate entry's supplier invoice, as sql/87 resolves it). */
export interface SupplierCreditNoteListItem {
  credit_note_sno: number;
  credit_note_no: string;
  grn_basic_sno: number;
  grn_no: string;
  po_basic_sno: number;
  po_no: string;
  com_name: string | null;
  vendor_invoice_no: string | null;
  vendor_invoice_date: string | null;
  credit_note_date: string;
  total_qty: number;
  total_amount: number;
  remarks: string | null;
  status: string;
}
export interface SupplierCreditNoteItem {
  credit_note_item_sno: number;
  prod_name: string;
  specification: string | null;
  unit_name: string | null;
  reason_type: CreditNoteReasonType;
  qty: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
}

/** sp_nt_GetDebitNotesForSupplier — one row per debit note raised against this vendor. */
export interface SupplierDebitNoteListItem {
  debit_note_sno: number;
  debit_note_no: string;
  grn_basic_sno: number;
  grn_no: string;
  po_basic_sno: number;
  po_no: string;
  com_name: string | null;
  vendor_invoice_no: string | null;
  vendor_invoice_date: string | null;
  debit_note_date: string;
  total_qty: number;
  total_amount: number;
  remarks: string | null;
  status: string;
}

export interface SupplierDebitNoteItem {
  debit_note_item_sno: number;
  prod_name: string;
  specification: string | null;
  unit_name: string | null;
  reason_type: DebitNoteReasonType;
  qty: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
}

/** sp_nt_GetDebitNoteDetailForSupplier */
export interface SupplierDebitNoteDetail extends Omit<SupplierDebitNoteListItem, 'items'> {
  /** Raw FOR JSON PATH string from MSSQL — parse before use. */
  items: string | SupplierDebitNoteItem[];
}

export function parseSupplierDebitNoteItems(items: SupplierDebitNoteDetail['items']): SupplierDebitNoteItem[] {
  if (Array.isArray(items)) return items;
  if (!items) return [];
  try {
    return JSON.parse(items);
  } catch {
    return [];
  }
}

export function parseSupplierPOItems(items: SupplierPODetail['items']): SupplierPOItem[] {
  if (Array.isArray(items)) return items;
  if (!items) return [];
  try {
    return JSON.parse(items);
  } catch {
    return [];
  }
}

export function formatFromAddress(addr: FromAddressFields): string {
  return [addr.from_door_no, addr.from_street, addr.from_area, addr.from_city, addr.from_state, addr.from_pincode]
    .filter(Boolean)
    .join(', ');
}

// ── My KYC (grn-service sql/92_supplier_kyc_modification.sql) ────────────────────────────────────────
export interface SupplierKycBasic {
  company_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  /** A business types master id, or (older records) the type written out. */
  business_type: string | null;
  business_type_name: string | null;
  is_gst_avail: 'Y' | 'N';
  gst_no: string | null;
  gst_status: string | null;
  gst_blk_status: string | null;
  txp_type: string | null;
  date_of_reg: string | null;
  is_msme_avail: 'Y' | 'N';
  msme_no: string | null;
  msme_type: string | null;
  pan_no: string | null;
}

export interface SupplierKycPayment {
  pay_via_portal: 'Y' | 'N';
  payment_portal_name: string | null;
  payment_portal_url: string | null;
  payment_instructions: string | null;
}

export interface SupplierKycAddress {
  kyc_address_sno: number;
  address_type: string | null;
  door_no: string | null;
  street: string | null;
  area: string | null;
  city: string | null;
  taluk: string | null;
  state: string | null;
  state_code: number | null;
  pincode: string | null;
  location_link: string | null;
  is_primary: 'Y' | 'N';
}

export interface SupplierKycBank {
  kyc_bank_sno: number;
  ac_holder_name: string | null;
  /** Text: a long account number does not survive a JavaScript number. */
  ac_number: string | null;
  /** A bank account type master id. */
  ac_type: string | null;
  ac_type_name: string | null;
  ifsc: string | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_address: string | null;
  is_primary: 'Y' | 'N';
}

export interface SupplierKycContact {
  kyc_contact_sno: number;
  contact_type: string | null;
  contact_name: string | null;
  contact_position: string | null;
  contact_mobile: string | null;
  contact_email: string | null;
}

export interface SupplierKycDocument {
  kyc_document_sno: number;
  document_type: string | null;
  document_name: string | null;
  document_path: string | null;
  uploaded_date: string | null;
}

/** The KYC as one document - what a change stores as its "old data" and "new data". */
export interface SupplierKycSnapshot {
  basic: SupplierKycBasic;
  payment: SupplierKycPayment;
  addresses: SupplierKycAddress[];
  banks: SupplierKycBank[];
  contacts: SupplierKycContact[];
  documents: SupplierKycDocument[];
}

export interface SupplierKyc extends SupplierKycSnapshot {
  kyc_basic_info_sno: number;
  supp_code: string | null;
  /** A approved, P pending, R rejected. */
  status: string | null;
  pan_no: string | null;
  supplier_category: string | null;
  category: string;
  created_date: string | null;
  modified_date: string | null;
  /** Goes back with a change: a form opened on an older KYC is refused instead of overwriting. */
  snapshot_hash: string;
  /** The change request waiting for approval, if any (sql/93). Only one can wait at a time. Optional so an older API still renders. */
  pending_sno?: number | null;
  pending_version?: number | null;
  /** The approval stage it is waiting at (1-based) and how many stages there are. */
  pending_stage_no?: number | null;
  pending_stage_total?: number | null;
  pending_stage_name?: string | null;
  pending_since?: string | null;
}

/** P waiting for approval, A approved (live), R rejected, C withdrawn by the supplier. */
export type SupplierKycChangeStatus = 'P' | 'A' | 'R' | 'C';

/** One approve / reject action of the approval trail. The approver's identity stays internal; the supplier sees the stage. */
export interface SupplierKycApproval {
  seq_no: number;
  stage_name: string | null;
  action: 'A' | 'R';
  note: string | null;
  acted_date: string;
}

export interface SupplierKycFile {
  /** AUTHORIZATION, or the KYC document type it added (gst_file, pan_file ...). */
  file_kind: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_date: string | null;
}

/** One change the supplier made: the whole KYC before (old data) and after (new data), why, who, and the files uploaded with it. */
export interface SupplierKycChange {
  kyc_modified_sno: number;
  version_no: number;
  reason: string;
  /** Comma list of BASIC, PAYMENT, ADDRESS, BANK, CONTACT, DOCUMENT. */
  changed_sections: string;
  old_data: SupplierKycSnapshot | null;
  new_data: SupplierKycSnapshot | null;
  source: string;
  modified_by: string;
  modified_date: string;
  files: SupplierKycFile[];
  /** A change made before approval stages existed (sql/92) has no status here: it was applied at once. */
  status?: SupplierKycChangeStatus;
  decided_date?: string | null;
  /** Why it was rejected (R), or "Withdrawn by the supplier" (C), or the approver's note. */
  decision_note?: string | null;
  stage_no?: number | null;
  stage_total?: number | null;
  stage_name?: string | null;
  approvals?: SupplierKycApproval[];
}

export interface SupplierKycChoice { value: string; label: string }

export interface SupplierKycData {
  kyc: SupplierKyc;
  history: SupplierKycChange[];
  business_types: SupplierKycChoice[];
  account_types: SupplierKycChoice[];
}
