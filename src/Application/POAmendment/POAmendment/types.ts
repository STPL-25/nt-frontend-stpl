// ── PO Amendment Types ────────────────────────────────────────────────────────
// Revise an existing Purchase Order (typically after partial GRN) — change
// ordered quantity, unit price, delivery date or terms, with an audit trail.

export type AmendmentStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected';

export interface AmendablePOItem {
  po_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification?: string;
  unit_name: string;
  ordered_qty: number;
  received_qty: number;       // already received via GRN — cannot revise below this
  unit_price: number;
}

export interface AmendablePO {
  po_basic_sno: number;
  po_no: string;
  vendor_sno?: number;
  vendor_name?: string;
  com_name?: string;
  po_date?: string;
  required_date?: string;
  terms_conditions?: string;
  status?: string;
  amendment_count?: number;   // how many revisions already exist
  total_amount?: number;
  items: AmendablePOItem[];
}

export interface AmendmentLine {
  po_item_sno?: number;
  prod_name: string;
  unit_name: string;
  received_qty: number;
  old_qty: number;
  new_qty: number;
  old_price: number;
  new_price: number;
}

export interface AmendmentRecord {
  amend_sno?: number;
  amend_no?: string;
  rev_no?: number;            // revision number (R1, R2…)
  po_basic_sno?: number;
  po_no?: string;
  amend_date: string;
  amend_type: string;         // Quantity / Price / Delivery Date / Terms / Mixed
  reason: string;
  old_required_date?: string;
  new_required_date?: string;
  old_terms?: string;
  new_terms?: string;
  old_total?: number;
  new_total?: number;
  status: AmendmentStatus;
  created_by_name?: string;
  created_at?: string;
  lines: AmendmentLine[];
}

export interface AmendmentFormState {
  amend_date: string;
  amend_type: string;
  reason: string;
  new_required_date: string;
  new_terms: string;
}

export const AMENDMENT_TYPES = [
  'Quantity', 'Price', 'Delivery Date', 'Terms & Conditions', 'Mixed',
] as const;
