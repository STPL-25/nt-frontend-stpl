/**
 * GSTR-2B reconciliation (grn-service /api/gstr2b, sql/45).
 * Upload the portal's Excel, see what matched our invoices, add missing ones, release payment holds.
 */
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/gstr2b`;

export const gstr2bUpload = `${base}/upload`;
export const gstr2bUploads = `${base}/uploads`;
export const gstr2bUploadDetail = (id: number, status?: string) =>
  `${base}/uploads/${id}${status ? `?status=${encodeURIComponent(status)}` : ''}`;
export const gstr2bCandidates = (rowSno: number) => `${base}/rows/${rowSno}/candidates`;
export const gstr2bConfirm = (rowSno: number) => `${base}/rows/${rowSno}/confirm`;
export const gstr2bSkip = (rowSno: number) => `${base}/rows/${rowSno}/skip`;
export const gstr2bMissing = `${base}/missing`;
export const gstr2bHoldOverride = (invoiceSno: number) => `${base}/invoices/${invoiceSno}/hold-override`;

export type Gstr2bStatus = 'Matched' | 'Mismatch' | 'Unmatched' | 'Added' | 'Skipped' | 'Info' | 'New';

export interface Gstr2bSummary {
  upload_sno: number; return_period: string; file_name: string | null; row_count: number;
  uploaded_by: string | null; uploaded_at: string;
  matched: number; mismatch: number; unmatched: number; added: number; notes_info?: number;
}

export interface Gstr2bRow {
  row_sno: number; doc_type: 'INV' | 'CDN'; supplier_gstin: string; trade_name: string | null; invoice_no: string;
  invoice_date: string | null; invoice_value: number; taxable_value: number; igst: number; cgst: number; sgst: number; cess: number;
  itc_available: string | null; itc_reason: string | null; filing_period: string | null; match_status: Gstr2bStatus;
  books_invoice_sno: number | null; books_invoice_no: string | null; books_amount: number | null; mismatch_note: string | null;
}

export interface Gstr2bCandidate {
  vendor_sno: number; company_name: string | null; legal_name: string | null; trade_name: string | null;
  gst_no: string | null; supp_code: string | null; score: number; matched_on: 'GSTIN' | 'NAME';
}

export interface MissingIn2B {
  invoice_sno: number; invoice_no: string; vendor_invoice_no: string | null; invoice_date: string | null; vendor_sno: number;
  vendor_name: string | null; gst_no: string | null; invoice_amount: number; taxable_value: number | null;
  itc_status: string | null; payment_hold_override: 'Y' | 'N' | null;
}
