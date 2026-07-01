import type { GatePORef, GateEntryRecord } from './types';

export const today = () => new Date().toISOString().slice(0, 10);

export const nowTime = () => new Date().toTimeString().slice(0, 5); // HH:MM

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

export const generateGateNo = (): string => {
  const ts = String(Date.now()).slice(-6);
  return `GE-${new Date().getFullYear()}-${ts}`;
};

export const netWeight = (gross?: number | string, tare?: number | string): number => {
  const g = Number(gross) || 0;
  const t = Number(tare) || 0;
  return Math.max(0, g - t);
};

// ── Mock data (replace with API calls) ─────────────────────────────────────────

export const MOCK_GATE_PO_LIST: GatePORef[] = [
  { po_basic_sno: 1001, po_no: 'PO-2026-001', vendor_sno: 11, vendor_name: 'Agarwal Traders Pvt Ltd',        com_name: 'STPL Corp', po_date: '2026-03-15' },
  { po_basic_sno: 1002, po_no: 'PO-2026-002', vendor_sno: 12, vendor_name: 'National Electronics Supply Co.', com_name: 'STPL Corp', po_date: '2026-03-20' },
  { po_basic_sno: 1003, po_no: 'PO-2026-003', vendor_sno: 13, vendor_name: 'Hindustan Safety Products',       com_name: 'STPL Corp', po_date: '2026-03-25' },
  { po_basic_sno: 1004, po_no: 'PO-2026-004', vendor_sno: 14, vendor_name: 'Sunrise Chemicals Ltd',           com_name: 'STPL Corp', po_date: '2026-04-01' },
];

export const MOCK_GATE_ENTRIES: GateEntryRecord[] = [
  {
    gate_entry_sno: 7001,
    gate_entry_no: 'GE-2026-000118',
    entry_date: '2026-03-28',
    entry_time: '10:45',
    po_basic_sno: 1002,
    po_no: 'PO-2026-002',
    vendor_name: 'National Electronics Supply Co.',
    invoice_no: 'NES/INV/2026/4471',
    invoice_date: '2026-03-27',
    challan_no: 'CH-NES-2026-143',
    lr_no: 'LR-DL-99214',
    vehicle_no: 'DL 1C 3456',
    driver_name: 'Mahesh Yadav',
    driver_mobile: '9876543210',
    transporter_name: 'Delhi Cargo Movers',
    gross_weight: 1450,
    tare_weight: 1200,
    net_weight: 250,
    no_of_packages: 12,
    material_desc: 'Laptops, docking stations, mice',
    remarks: 'Seal intact, documents verified at gate.',
    status: 'GRN Done',
    created_by_name: 'Security — Ramesh',
    created_at: '2026-03-28T10:45:00',
  },
  {
    gate_entry_sno: 7002,
    gate_entry_no: 'GE-2026-000124',
    entry_date: '2026-04-02',
    entry_time: '09:10',
    po_basic_sno: 1003,
    po_no: 'PO-2026-003',
    vendor_name: 'Hindustan Safety Products',
    invoice_no: 'HSP/2026/0912',
    invoice_date: '2026-04-01',
    challan_no: 'CH-HSP-2026-088',
    lr_no: 'LR-MH-55120',
    vehicle_no: 'MH 14 AB 7890',
    driver_name: 'Sunil Patil',
    driver_mobile: '9822011223',
    transporter_name: 'Maharashtra Roadlines',
    gross_weight: 980,
    tare_weight: 800,
    net_weight: 180,
    no_of_packages: 8,
    material_desc: 'Safety helmets, shoes, jackets',
    remarks: '',
    status: 'Verified',
    created_by_name: 'Security — Sunil',
    created_at: '2026-04-02T09:10:00',
  },
];
