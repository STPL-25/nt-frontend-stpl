// ── PurchaseTeam Types ────────────────────────────────────────────────────────

export interface PRItem {
  pr_item_sno?: number;
  prod_sno?: number;
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
}

export interface QuotationFormState {
  quotation_ref_no: string;
  quotation_date: string;
  valid_upto: string;
  currency_code: string;
  payment_terms: string;
  delivery_days: number;
  remarks: string;
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
