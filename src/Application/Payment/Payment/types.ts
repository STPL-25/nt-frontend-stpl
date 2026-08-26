// ── Payment Types ─────────────────────────────────────────────────────────────
// Pay approved supplier bills. Supports full / partial / advance payments via
// multiple modes, with a clearance status trail.

export type PaymentMode = 'NEFT' | 'RTGS' | 'Cheque' | 'Cash' | 'UPI' | 'DD';

export type PaymentStatus = 'Pending' | 'Processed' | 'Cleared' | 'Failed';

export type BucketType = 'MATERIAL' | 'SERVICE';

export interface PayableBill {
  bill_sno: number;
  bill_no: string;
  supplier_invoice_no?: string;
  po_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  invoice_date?: string;
  due_date?: string;
  bucket_type?: BucketType;
  allocated_amount?: number;
  hold_amount?: number;        // held back by the last match run (not yet payable)
  matched_qty_ratio?: number | null;
  net_payable: number;
  paid_amount: number;
  outstanding: number;       // net_payable - paid_amount
}

export interface PaymentRecord {
  payment_sno?: number;
  payment_no?: string;
  bill_sno?: number;
  bill_no?: string;
  supplier_invoice_no?: string;
  po_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  bucket_type?: BucketType;
  hold_amount?: number;
  matched_qty_ratio?: number | null;
  payment_date: string;
  amount: number;
  mode: PaymentMode;
  bank_account?: string;     // paying bank / ledger
  reference_no?: string;     // UTR / cheque no / txn id
  status: PaymentStatus;
  remarks?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface PaymentFormState {
  bill_sno: string;          // select value
  payment_date: string;
  amount: string;
  mode: PaymentMode;
  bank_account: string;
  reference_no: string;
  remarks: string;
}

export const PAYMENT_MODES: PaymentMode[] = ['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI', 'DD'];

export const PAYING_ACCOUNTS = [
  'Bank — SBI Current',
  'Bank — HDFC Current',
  'Cash in Hand',
];
