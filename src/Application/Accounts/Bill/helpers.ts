import type { Bill, BillableGRN, BillFormState, MatchStatus } from './types';

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

export const generateBillNo = (): string => {
  const ts = String(Date.now()).slice(-6);
  return `BILL-${new Date().getFullYear()}-${ts}`;
};

export interface ComputedTotals {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tds: number;
  netPayable: number;
}

/** Derive all tax + payable figures from the bill form inputs. */
export const computeTotals = (form: BillFormState): ComputedTotals => {
  const basic = Number(form.basic_amount) || 0;
  const discount = Number(form.discount) || 0;
  const taxable = Math.max(0, basic - discount);
  const gstRate = Number(form.gst_rate) || 0;
  const tdsRate = Number(form.tds_rate) || 0;
  const other = Number(form.other_charges) || 0;

  const gstAmount = (taxable * gstRate) / 100;
  const cgst = form.gst_type === 'intra' ? gstAmount / 2 : 0;
  const sgst = form.gst_type === 'intra' ? gstAmount / 2 : 0;
  const igst = form.gst_type === 'inter' ? gstAmount : 0;

  // TDS is deducted on the taxable (pre-GST) value
  const tds = (taxable * tdsRate) / 100;

  const netPayable = taxable + cgst + sgst + igst + other - tds;
  return { taxable, cgst, sgst, igst, tds, netPayable: Math.max(0, netPayable) };
};

/** 3-way match: compares booked basic amount against GRN value. */
export const matchAgainstGRN = (basicAmount: number, grn?: BillableGRN | null): MatchStatus => {
  if (!grn) return 'Not Checked';
  const tolerance = grn.grn_value * 0.02; // 2% tolerance
  return Math.abs(basicAmount - grn.grn_value) <= tolerance ? 'Matched' : 'Mismatch';
};

export const outstanding = (bill: Bill): number =>
  Math.max(0, bill.net_payable - (bill.paid_amount ?? 0));

// ── Mock data (replace with API calls) ─────────────────────────────────────────

export const MOCK_BILLABLE_GRNS: BillableGRN[] = [
  { grn_basic_sno: 9001, grn_no: 'GRN-2026-001', po_basic_sno: 1002, po_no: 'PO-2026-002', vendor_sno: 12, vendor_name: 'National Electronics Supply Co.', received_date: '2026-03-28', invoice_no: 'NES/INV/2026/4471', grn_value: 351000, po_value: 597000 },
  { grn_basic_sno: 9002, grn_no: 'GRN-2026-002', po_basic_sno: 1003, po_no: 'PO-2026-003', vendor_sno: 13, vendor_name: 'Hindustan Safety Products',       received_date: '2026-04-02', invoice_no: 'HSP/2026/0912',     grn_value: 78500,  po_value: 78500 },
];

export const MOCK_BILLS: Bill[] = [
  {
    bill_sno: 6001,
    bill_no: 'BILL-2026-000231',
    supplier_invoice_no: 'HSP/2026/0912',
    invoice_date: '2026-04-01',
    grn_basic_sno: 9002,
    grn_no: 'GRN-2026-002',
    po_basic_sno: 1003,
    po_no: 'PO-2026-003',
    vendor_sno: 13,
    vendor_name: 'Hindustan Safety Products',
    basic_amount: 78500,
    discount: 0,
    taxable_amount: 78500,
    cgst: 7065,
    sgst: 7065,
    igst: 0,
    tds: 785,
    other_charges: 0,
    net_payable: 91845,
    due_date: '2026-04-16',
    match_status: 'Matched',
    status: 'Approved',
    paid_amount: 0,
    remarks: '3-way match clear. GST @ 18% intra-state, TDS @ 1%.',
    created_by_name: 'Accounts — Priya',
    created_at: '2026-04-03T10:00:00',
  },
];

export const getBillForGRN = (grn_basic_sno: number): Bill | undefined =>
  MOCK_BILLS.find(b => b.grn_basic_sno === grn_basic_sno);
