import type { PORecord, POItem, GRNItemEntry } from './types';

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

export const getPODisplayNo = (po: PORecord): string =>
  po.po_no ?? String(po.po_basic_sno ?? '—');

export const getPOItems = (po: PORecord): POItem[] => {
  if (!po) return [];
  if (Array.isArray(po.items)) return po.items;
  if (typeof po.items === 'string') {
    try { return JSON.parse(po.items); } catch { /* ignore */ }
  }
  // flat single-item PO
  if (po.prod_name) {
    return [{
      prod_name: po.prod_name,
      unit_name: po.unit_name,
    }];
  }
  return [];
};

export const normalisePORows = (rows: any[]): PORecord[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    ...row,
    items: (() => {
      if (Array.isArray(row.items)) return row.items;
      if (Array.isArray(row.po_item_details)) return row.po_item_details;
      if (typeof row.items === 'string') {
        try { return JSON.parse(row.items); } catch { return []; }
      }
      if (typeof row.po_item_details === 'string') {
        try { return JSON.parse(row.po_item_details); } catch { return []; }
      }
      return [];
    })(),
  }));
};

export const buildGRNItems = (po: PORecord): GRNItemEntry[] => {
  return getPOItems(po).map(item => {
    const ordered = Number(item.ordered_qty ?? item.qty ?? 0);
    const alreadyReceived = Number(item.received_qty ?? 0);
    const pending = Math.max(0, ordered - alreadyReceived);
    return {
      po_item_sno: item.po_item_sno,
      prod_sno: item.prod_sno,
      prod_name: item.prod_name ?? item.item_name ?? '',
      specification: item.specification ?? '',
      ordered_qty: ordered,
      pending_qty: pending,
      unit_name: item.unit_name ?? item.uom_name ?? '',
      unit_price: Number(item.unit_price ?? 0),
      received_qty: pending,
      rejected_qty: 0,
      condition: 'Good',
      remarks: '',
      selected: pending > 0,
    };
  });
};

export const getGRNStatus = (po: PORecord): { label: string; color: string } => {
  const status = (po.grn_status ?? po.status ?? '').toLowerCase();
  if (status.includes('receiv') && !status.includes('partial')) return { label: 'Received', color: 'green' };
  if (status.includes('partial')) return { label: 'Partial', color: 'amber' };
  return { label: 'Pending', color: 'red' };
};
