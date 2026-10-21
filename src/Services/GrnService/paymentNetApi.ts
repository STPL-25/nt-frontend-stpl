/**
 * Payment with adjustments (grn-service /api/payment_net, sql/44 + sql/48):
 * payable bills with GRN / GSTR-2B / TDS context, the supplier's advances and debit/credit notes,
 * a preview of the net amount to pay, and the release itself.
 */
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/payment_net`;

export const payNetBills = `${base}/bills`;
export const payNetGrnPending = `${base}/grn-pending`;
export const payNetAdjustments = (vendor_sno: number) => `${base}/adjustments?vendor_sno=${vendor_sno}`;
export const payNetPreview = `${base}/preview`;
export const payNetRelease = `${base}/release`;
export const payNetTdsSections = `${base}/tds-sections`;

export interface PayableBillNet {
  bill_sno: number; invoice_sno: number; bill_no: string; supplier_invoice_no: string | null; po_no: string | null;
  vendor_sno: number; vendor_name: string; invoice_date: string; due_date: string | null; bucket_type: string;
  net_payable: number; hold_amount: number; paid_amount: number; outstanding: number; invoice_amount: number; taxable_value: number | null;
  tds_section_code: string | null; itc_status: string | null; payment_hold_override: 'Y' | 'N' | null;
  gst_supplier: boolean; gst_booked: boolean; grn_state: 'Done' | 'Pending approval' | 'No GRN' | 'NA'; on_hold_2b: boolean;
}

export interface GrnPendingPayment {
  po_basic_sno: number; po_no: string; vendor_sno: number; vendor_name: string | null;
  has_invoice: boolean; grn_count: number; grn_nos: string; last_received_date: string | null;
  ordered_qty: number; received_qty: number; qty_variance: number;
  taxable_value: number; gst_value: number; grn_value: number; gst_variance: number; taxable_variance: number;
  debit_notes: number; credit_notes: number; advances: number; tds_estimate: number; net_payable: number;
}
export const payNetInvoiceLedger = `${base}/invoice-ledger`;

export type InvoicePaymentStatus = 'Paid' | 'Part paid' | 'Unpaid' | 'Not allocated';
export interface LedgerInvoice {
  invoice_sno: number; invoice_no: string; supplier_invoice_no: string | null; po_basic_sno: number; po_no: string | null;
  vendor_sno: number; invoice_date: string | null; due_date: string | null; invoice_amount: number; match_status: string | null;
  verification_status: string | null; invoice_file_url: string | null;
  release_total: number; paid_total: number; outstanding: number; payment_status: InvoicePaymentStatus;
  payment_nos: string | null; dup_count: number;
}
export interface LedgerGrn {
  grn_basic_sno: number; grn_no: number; po_basic_sno: number; po_no: string | null; vendor_sno: number; status: string;
  received_date: string | null; invoice_no: string | null; invoice_date: string | null; invoice_amount: number | null;
  invoice_doc_url: string | null; has_invoice_data: boolean; dup_count: number;
}
export interface InvoiceLedger { invoices: LedgerInvoice[]; grns: LedgerGrn[] }

export interface SupplierAdvance { advance_sno: number; advance_no: string; po_basic_sno: number | null; paid_date: string; amount: number; balance: number }
export interface PendingNote { note_sno: number; note_no: string; po_basic_sno: number | null; note_date: string; amount: number; remarks: string | null }
export type TdsAppliesTo = 'Service' | 'Product' | 'Both';
export interface TdsSection { section_code: string; description: string; rate_individual: number; rate_other: number; is_active: 'Y' | 'N'; applies_to?: TdsAppliesTo }

export interface PaymentAdjustments {
  advances: SupplierAdvance[]; debitNotes: PendingNote[]; creditNotes: PendingNote[]; tdsSections: TdsSection[];
}

export interface NetSummary {
  gross_amount: number; tds_amount: number; advance_adjusted: number; debit_notes: number; credit_notes: number; net_paid: number;
}
export interface NetInvoiceLine {
  invoice_sno: number; invoice_no: string; gross: number; taxable_base: number; tds_section: string | null;
  tds_rate_pct: number | null; tds_taxable: number | null; tds_amount: number;
}
export interface NetPreview { summary: NetSummary | null; invoices: NetInvoiceLine[] }
