import type { PayableBill, PaymentRecord } from './types';

export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
};

export const formatINR = (val?: number | null): string => {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
};

export const generatePaymentNo = (): string => {
  const ts = String(Date.now()).slice(-6);
  return `PMT-${new Date().getFullYear()}-${ts}`;
};

/** A reference no is mandatory for all electronic / instrument-based modes. */
export const requiresReference = (mode: string): boolean => mode !== 'Cash';

export const isOverdue = (dueDate?: string): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(today());
};

// ── Mock data (replace with API calls) ─────────────────────────────────────────

export const MOCK_PAYABLE_BILLS: PayableBill[] = [
  {
    bill_sno: 6001,
    bill_no: 'BILL-2026-000231',
    supplier_invoice_no: 'HSP/2026/0912',
    po_no: 'PO-2026-003',
    vendor_sno: 13,
    vendor_name: 'Hindustan Safety Products',
    invoice_date: '2026-04-01',
    due_date: '2026-04-16',
    net_payable: 91845,
    paid_amount: 0,
    outstanding: 91845,
  },
  {
    bill_sno: 6002,
    bill_no: 'BILL-2026-000236',
    supplier_invoice_no: 'NES/INV/2026/4471',
    po_no: 'PO-2026-002',
    vendor_sno: 12,
    vendor_name: 'National Electronics Supply Co.',
    invoice_date: '2026-03-27',
    due_date: '2026-04-26',
    net_payable: 414180,
    paid_amount: 200000,
    outstanding: 214180,
  },
];

export const MOCK_PAYMENTS: PaymentRecord[] = [
  {
    payment_sno: 5001,
    payment_no: 'PMT-2026-000089',
    bill_sno: 6002,
    bill_no: 'BILL-2026-000236',
    supplier_invoice_no: 'NES/INV/2026/4471',
    po_no: 'PO-2026-002',
    vendor_sno: 12,
    vendor_name: 'National Electronics Supply Co.',
    payment_date: '2026-04-05',
    amount: 200000,
    mode: 'RTGS',
    bank_account: 'Bank — SBI Current',
    reference_no: 'SBIN0R526098114',
    status: 'Cleared',
    remarks: 'Part payment (advance) against laptop delivery.',
    created_by_name: 'Accounts — Priya',
    created_at: '2026-04-05T12:30:00',
  },
];

export const getPaymentsForBill = (bill_sno: number): PaymentRecord[] =>
  MOCK_PAYMENTS.filter(p => p.bill_sno === bill_sno);
