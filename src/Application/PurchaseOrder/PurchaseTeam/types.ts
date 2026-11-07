// ── PurchaseTeam Types ────────────────────────────────────────────────────────

export interface PRItem {
  pr_item_sno?: number;
  prod_sno?: number;
  prod_code?: string;
  prod_name?: string;
  item_name?: string;
  specification?: string;
  qty?: number;
  quantity?: number;
  unit?: number;
  unit_name?: string;
  uom_name?: string;
  uom_code?: string;
  est_cost?: number;
  total_cost?: number;
  estimated_price?: number;
  budget_sno?: number;
  remarks?: string;
}

export interface PRRecord {
  pr_basic_sno?: number;
  /** PR split group of this Purchase entry (null = the PR's main entry). */
  group?: number | null;
  pr_no?: string;
  pr_id?: string | number;
  com_sno?: number;
  com_name?: string;
  div_sno?: number;
  div_name?: string;
  brn_sno?: number;
  brn_name?: string;
  dept_sno?: number;
  dept_name?: string;
  reg_date?: string;
  request_date?: string;
  req_date?: string;
  required_date?: string;
  req_by_date?: string;
  pr_item_details?: string | PRItem[];
  created_by_name?: string;
  stage_order_json?: string;
  pr_history_data?: string;
  priority_name?: string;
  priority_sno?: number;
  purpose?: string;
  status?: string;
  budget_sno?: number;
  budget_code?: string;
  entered_by?: string;
  created_by?: string;
  isQuotationSubmitted?: number | boolean | string;
  items?: PRItem[] | string;
  // flat item columns
  prod_name?: string;
  unit_name?: string;
  quantity?: number;
  est_cost?: number;
}

export interface Vendor {
  kyc_basic_info_sno?: number;
  vendor_sno?: number;
  company_name?: string;
  vendor_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  mobile_number?: string;
  address?: string;
  city?: string;
  state?: string;
  gst_no?: string;
  pan_no?: string;
  business_type?: string;
  is_msme_avail?: string;   // Y / N (from KYC)
  msme_type?: string;       // Micro / Small / Medium (from KYC)
}

export type AdditionalCoverType = 'Warranty' | 'AMC' | 'Other';
export type AdditionalCostType = 'Free' | 'Paid' | 'Semi-paid';

export interface AdditionalCover {
  type: AdditionalCoverType;
  /** Name of the cover — only used for 'Other'. */
  label?: string;
  years: number | string;
  cost_type: AdditionalCostType;
  terms?: string;
}

export interface QuotationItem {
  pr_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification: string;
  qty: number;
  unit: number;
  unit_name: string;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  total_amount: number;
  delivery_days: number;
  remarks: string;
  /** Extra covers the supplier offers on this line (Warranty / AMC / Others). */
  additional?: AdditionalCover[];
  buyback_value?: number;
  pr_no?: string;    // trade-in credit from supplier for existing asset
}

export interface Quotation {
  sq_basic_sno?: number;
  pr_basic_sno?: number;
  vendor_sno?: number;
  vendor_name?: string;
  company_name?: string;
  quotation_ref_no: string;
  quotation_date: string;
  valid_upto: string;
  currency_code: string;
  payment_terms: string;
  delivery_days: number;
  remarks: string;
  is_selected?: string;
  status?: string;
  items: QuotationItem[];
  sq_quotation_file?: string;
  freight_charges?: number;
  other_charges?: number;
  freight_gst_pct?: number;
  other_charges_gst_pct?: number;
  is_msme?: string | null;        // Y / N
  msme_type?: string | null;      // Micro / Small / Medium
  is_intrastate?: boolean | number | null;
  split_group?: number;       // which confirmed split group this quotation belongs to
  advance_payment_required?: boolean;
  advance_payment_pct?: number;
  buyback_available?: boolean;
  buyback_value?: number;
  supplier_advance?: string | SupplierAdvance[];
  pr_no?: string;
  /** Set when the supplier gave this quotation in the portal against an RFQ (the taken version). */
  rfq_sno?: number | null;
  rfq_response_sno?: number | null;
}

// ── Request For Quotation (RFQ) ──────────────────────────────────────────────

/** Where a supplier stands on one RFQ. */
export type RfqSupplierStatus =
  | 'PENDING'             // sent, supplier has not opened it
  | 'VIEWED'              // opened, nothing submitted
  | 'SUBMITTED'           // quotation given (latest version in current_version)
  | 'REVISION_REQUESTED'  // buyer asked for changes, waiting for the next version
  | 'DECLINED'            // supplier will not quote
  | 'TAKEN'               // a version was taken as the final supplier quotation
  | 'CLOSED';             // RFQ cancelled

export interface RfqItem {
  rfq_item_sno: number;
  pr_item_sno?: number | null;
  prod_sno?: number | null;
  prod_name: string;
  specification?: string | null;
  qty: number;
  unit?: number | null;
  unit_name?: string | null;
}

export interface RfqSupplier {
  rfq_supplier_sno: number;
  vendor_sno: number;
  company_name: string;
  supp_code?: string | null;
  status: RfqSupplierStatus;
  has_login: boolean;
  email_to?: string | null;
  email_sent: 'Y' | 'N';
  email_sent_at?: string | null;
  email_error?: string | null;
  email_count: number;
  first_viewed_at?: string | null;
  response_count: number;
  current_response_sno?: number | null;
  current_version?: number | null;
  last_submitted_at?: string | null;
  grand_total?: number | null;
  quotation_ref_no?: string | null;
  valid_upto?: string | null;
  delivery_days?: number | null;
  payment_terms?: string | null;
  due_date?: string | null;
  revision_note?: string | null;
  revision_requested_at?: string | null;
  decline_reason?: string | null;
  taken_response_sno?: number | null;
  taken_sq_basic_sno?: number | null;
  taken_at?: string | null;
}

export interface Rfq {
  rfq_sno: number;
  rfq_no: string;
  pr_basic_sno: number;
  pr_no?: string | null;
  split_group?: number | null;
  response_due_date: string;
  notes?: string | null;
  status: 'O' | 'X';          // open / cancelled
  close_reason?: string | null;
  created_by?: string | null;
  created_at: string;
  com_name?: string | null;
  items: RfqItem[];
  suppliers: RfqSupplier[];
}

export interface RfqResponseItem {
  rfq_item_sno: number;
  prod_sno?: number | null;
  prod_name: string;
  specification?: string | null;
  qty: number;
  unit_name?: string | null;
  is_quoted: boolean;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  total_amount: number;
  delivery_days?: number | null;
  remarks?: string | null;
  additional?: AdditionalCover[] | null;
}

/** One submitted version of a supplier's quotation. */
export interface RfqResponseVersion {
  rfq_response_sno: number;
  version_no: number;
  is_current: 'Y' | 'N';
  is_taken: boolean;
  quotation_ref_no?: string | null;
  quotation_date?: string | null;
  valid_upto?: string | null;
  currency_code: string;
  payment_terms?: string | null;
  delivery_days?: number | null;
  remarks?: string | null;
  change_note?: string | null;
  freight_charges: number;
  freight_gst_pct: number;
  other_charges: number;
  other_charges_gst_pct: number;
  items_total: number;
  grand_total: number;
  quotation_file?: string | null;
  submitted_by?: string | null;
  submitted_at: string;
  items: RfqResponseItem[];
}

export interface RfqLogEntry {
  log_sno: number;
  event_type: string;
  event_by?: string | null;
  event_note?: string | null;
  event_at: string;
}

/** Per-supplier portal-login status (so the buyer is warned before mailing someone who cannot log in). */
export interface RfqSupplierContact {
  vendor_sno: number;
  supp_code?: string | null;
  kyc_email?: string | null;
  login_email?: string | null;
  has_login: boolean;
}

export interface RfqEmailResult {
  rfq_supplier_sno: number;
  vendor_sno: number;
  company_name: string;
  has_login: boolean;
  email_to: string | null;
  sent: boolean;
  error?: string;
}

export interface AdvancePaymentStage {
  id: string;
  stage_no: number;
  amount: number;
  due_days: number;
}

export interface SupplierAdvanceStage {
  id: string;
  stage_no: number;
  amount: number;
  due_days: number;
}

export interface SupplierAdvance {
  sq_adv_sno?: number;
  sq_basic_sno?: number;
  quotation_ref_no?: string;
  payment_terms?: string;
  advance_payment_pct: number;
  gst_applicable: string;
  gst_pct: number;
  reason: string;
  note: string;
  adv_issue_stages: string | SupplierAdvanceStage[];
  is_active?: string;
  created_by?: string;
  created_date?: string;
}

export interface AdvancePaymentData {
  advance_pct: number;
  gst_applicable: boolean;
  gst_pct: number;
  reason: string;
  note: string;
  stages: AdvancePaymentStage[];
}

export interface QuotationFormState {
  quotation_ref_no: string;
  quotation_date: string;
  valid_upto: string;
  currency_code: string;
  payment_terms: string;
  delivery_days: number;
  remarks: string;
  buyback_available: boolean;
  buyback_value: number;
  advance_payment_required: boolean;
  advance_payment_pct: number;
  advance_payment_data?: AdvancePaymentData;
  freight_charges: number;
  other_charges: number;
  freight_gst_pct: number;
  other_charges_gst_pct: number;
}

export interface POFormState {
  po_date: string;
  required_date: string;
  purpose: string;
  terms_conditions: string;
  delivery_address: string;
}

// ── Split/Merge Group ────────────────────────────────────────────────────────
// A "group" is a collection of items + assigned vendor that will become one PO.
// Created during split or merge phase, BEFORE quotation.

export interface POGroup {
  id: string;                 // unique group id (uuid or counter)
  label: string;              // display label e.g. "Group 1", "Split 1"
  vendorSno?: number;         // assigned vendor (optional at creation)
  vendorName?: string;
  items: POGroupItem[];       // items in this group
  sourcePRs: number[];        // pr_basic_sno(s) this group came from
}

export interface POGroupItem {
  pr_basic_sno: number;       // which PR this item belongs to
  pr_no: string;              // display PR no
  pr_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification: string;
  qty: number;                // qty allocated to this group (can be partial)
  originalQty: number;        // original qty in the PR
  unit: number;
  unit_name: string;
  est_cost?: number;
}

// ── PO Confirmation (Step 1 before quotation) ────────────────────────────────

export interface POConfirmItem {
  id: string;                 // client-side row id (for split rows)
  pr_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification: string;
  originalQty: number;        // original qty from PR
  qty: number;                // confirmed qty for this row
  unit: number;
  unit_name: string;
  est_cost?: number;
  com_sno?: number | string;
  com_name?: string;
  div_sno?: number | string;
  div_name?: string;
  brn_sno?: number | string;
  brn_name?: string;
  dept_sno?: number | string;
  dept_name?: string;
  isSplit: boolean;
  parentItemSno?: number;
  split_group?: number;   
  prod_code?:string; 
  pr_no?: string;    // which split PO group (1, 2, 3…). undefined = main PO
}

export interface POConfirmationData {
  pr_basic_sno: number;
  required_date: string;
  billing_com_sno?: number | string;
  billing_div_sno?: number | string;
  billing_brn_sno?: number | string;
  billing_dept_sno?: number | string;
  items: POConfirmItem[];
}
