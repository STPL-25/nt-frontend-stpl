import type { AmendablePO, AmendmentRecord, AmendmentLine } from './types';

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

export const generateAmendNo = (poNo: string, revNo: number): string =>
  `${poNo}-R${revNo}`;

export const lineTotal = (qty: number, price: number): number =>
  (Number(qty) || 0) * (Number(price) || 0);

export const poTotal = (lines: { new_qty: number; new_price: number }[]): number =>
  lines.reduce((s, l) => s + lineTotal(l.new_qty, l.new_price), 0);

/** Has a given line actually been revised vs its original values? */
export const isLineChanged = (l: AmendmentLine): boolean =>
  Number(l.new_qty) !== Number(l.old_qty) || Number(l.new_price) !== Number(l.old_price);

// ── Mock data (replace with API calls) ─────────────────────────────────────────

export const MOCK_AMENDABLE_POS: AmendablePO[] = [
  {
    po_basic_sno: 1002,
    po_no: 'PO-2026-002',
    vendor_sno: 12,
    vendor_name: 'National Electronics Supply Co.',
    com_name: 'STPL Corp',
    po_date: '2026-03-20',
    required_date: '2026-04-15',
    terms_conditions: '50% advance, balance on delivery',
    status: 'Partially Received',
    amendment_count: 0,
    total_amount: 597000,
    items: [
      { po_item_sno: 5010, prod_sno: 310, prod_name: 'Dell Laptop (Core i5)',      specification: '8GB RAM, 512GB SSD', unit_name: 'Nos',  ordered_qty: 10, received_qty: 6, unit_price: 55000 },
      { po_item_sno: 5011, prod_sno: 311, prod_name: 'USB-C Docking Station',       specification: '4K HDMI, Ethernet',  unit_name: 'Nos',  ordered_qty: 10, received_qty: 6, unit_price: 3500 },
      { po_item_sno: 5012, prod_sno: 312, prod_name: 'Wireless Mouse',              specification: '2.4GHz ergonomic',   unit_name: 'Nos',  ordered_qty: 15, received_qty: 15, unit_price: 800 },
    ],
  },
  {
    po_basic_sno: 1004,
    po_no: 'PO-2026-004',
    vendor_sno: 14,
    vendor_name: 'Sunrise Chemicals Ltd',
    com_name: 'STPL Corp',
    po_date: '2026-04-01',
    required_date: '2026-04-20',
    terms_conditions: 'Payment within 45 days',
    status: 'Pending',
    amendment_count: 1,
    total_amount: 32000,
    items: [
      { po_item_sno: 5030, prod_sno: 330, prod_name: 'Floor Cleaner Concentrate', specification: '5L can', unit_name: 'Can', ordered_qty: 40,  received_qty: 0, unit_price: 400 },
      { po_item_sno: 5031, prod_sno: 331, prod_name: 'Hand Sanitizer (500ml)',    specification: '70% IPA', unit_name: 'Btl', ordered_qty: 100, received_qty: 0, unit_price: 160 },
    ],
  },
];

export const MOCK_AMENDMENTS: AmendmentRecord[] = [
  {
    amend_sno: 4001,
    amend_no: 'PO-2026-004-R1',
    rev_no: 1,
    po_basic_sno: 1004,
    po_no: 'PO-2026-004',
    amend_date: '2026-04-05',
    amend_type: 'Quantity',
    reason: 'Increased hand sanitizer requirement for additional branch offices.',
    old_total: 28000,
    new_total: 32000,
    status: 'Approved',
    created_by_name: 'Procurement — Anita',
    created_at: '2026-04-05T15:20:00',
    lines: [
      { po_item_sno: 5031, prod_name: 'Hand Sanitizer (500ml)', unit_name: 'Btl', received_qty: 0, old_qty: 75, new_qty: 100, old_price: 160, new_price: 160 },
    ],
  },
];

export const buildAmendmentLines = (po: AmendablePO): AmendmentLine[] =>
  po.items.map(it => ({
    po_item_sno: it.po_item_sno,
    prod_name: it.prod_name,
    unit_name: it.unit_name,
    received_qty: it.received_qty,
    old_qty: it.ordered_qty,
    new_qty: it.ordered_qty,
    old_price: it.unit_price,
    new_price: it.unit_price,
  }));

export const getAmendmentsForPO = (po_basic_sno: number): AmendmentRecord[] =>
  MOCK_AMENDMENTS.filter(a => a.po_basic_sno === po_basic_sno);
