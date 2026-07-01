// ── Accounts / Bill Booking Types ─────────────────────────────────────────────
// Supplier invoice ("bill") booked in Accounts after GRN. Verified by a 3-way
// match (PO ↔ GRN ↔ Invoice), taxes computed, then routed to Payment.

export type BillStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Partially Paid'
  | 'Paid'
  | 'Rejected';

export type MatchStatus = 'Matched' | 'Mismatch' | 'Not Checked';

export interface BillableGRN {
  grn_basic_sno: number;
  grn_no: string;
  po_basic_sno?: number;
  po_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  received_date?: string;
  invoice_no?: string;          // captured at gate / GRN, if any
  grn_value: number;            // value of received goods (basis for the bill)
  po_value?: number;            // ordered value, for 3-way comparison
}

export interface Bill {
  bill_sno?: number;
  bill_no?: string;             // internal booking no
  supplier_invoice_no: string;
  invoice_date: string;
  // references
  grn_basic_sno?: number;
  grn_no?: string;
  po_basic_sno?: number;
  po_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  // amounts
  basic_amount: number;
  discount: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  tds: number;
  other_charges: number;
  net_payable: number;
  // workflow
  due_date?: string;
  match_status: MatchStatus;
  status: BillStatus;
  paid_amount?: number;         // running total paid (for Payment module)
  remarks?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface BillFormState {
  grn_basic_sno: string;        // select value
  supplier_invoice_no: string;
  invoice_date: string;
  basic_amount: string;
  discount: string;
  gst_rate: string;             // % applied to taxable amount
  gst_type: 'intra' | 'inter'; // intra → CGST+SGST, inter → IGST
  tds_rate: string;             // %
  other_charges: string;
  due_date: string;
  remarks: string;
}
