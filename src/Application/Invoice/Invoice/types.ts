// ── Invoice Allocation Types ─────────────────────────────────────────────────
// Composite vendor invoices (Product + Service portions) captured, linked to
// a PO, split into MATERIAL/SERVICE buckets against po_item_sno lines, and
// matched independently per bucket against GRN / Service Entry.

export type InvoiceType = 'SERVICE' | 'MATERIAL' | 'COMPOSITE';
export type SourceType = 'STANDARD' | 'RETROSPECTIVE';
export type InvoiceMatchStatus = 'Pending' | 'Allocated' | 'Matched' | 'PartialRelease' | 'Rejected';
export type BucketType = 'MATERIAL' | 'SERVICE';
export type BucketMatchStatus = 'Pending' | 'Partial' | 'Matched';

export interface InvoiceAllocation {
  invoice_alloc_sno: number;
  po_item_sno: number;
  bucket_type: BucketType;
  allocated_amount: number;
  matched_qty_ratio: number | null;
  hold_amount: number;
  release_amount: number;
  match_status: BucketMatchStatus;
}

export interface Invoice {
  invoice_sno: number;
  invoice_no: string;
  vendor_invoice_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  po_basic_sno?: number | null;
  po_no?: string;
  invoice_date?: string;
  due_date?: string;
  invoice_amount: number;
  invoice_file_url?: string;
  invoice_type: InvoiceType;
  source_type: SourceType;
  match_status: InvoiceMatchStatus;
  net_payable?: number;
  created_date?: string;
  allocations?: InvoiceAllocation[] | string;
  verification_status?: 'Pending' | 'Verified';
  verified_by?: string;
  verified_at?: string;
  verification_remarks?: string;
}

export interface PoItemForAllocation {
  po_item_sno: number;
  po_section: BucketType;
  prod_sno?: number | null;
  prod_name?: string | null;
  service_sno?: number | null;
  service_name?: string | null;
  qty: number;
  unit_name?: string | null;
  line_value: number;
  already_allocated: number;
  received_qty: number;
}

export interface InvoiceCaptureFormState {
  vendor_invoice_no: string;
  vendor_sno: string;
  po_basic_sno: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: string;
  invoice_type: InvoiceType;
  source_type: SourceType;
  remarks: string;
}

export interface AllocationRow {
  po_item_sno: number;
  label: string;
  bucket_type: BucketType;
  line_value: number;
  amount: string; // controlled input value
}
