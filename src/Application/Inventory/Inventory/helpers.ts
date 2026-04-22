import type { InventoryItem } from './types';

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getStockStatus = (item: InventoryItem): { label: string; color: 'green' | 'amber' | 'red' } => {
  if (item.current_stock <= 0) return { label: 'Out of Stock', color: 'red' };
  if (item.current_stock <= item.min_stock) return { label: 'Low Stock', color: 'amber' };
  if (item.current_stock >= item.max_stock) return { label: 'Overstocked', color: 'amber' };
  return { label: 'In Stock', color: 'green' };
};

export const generateItemCode = (): string => {
  const ts = Date.now().toString(36).toUpperCase();
  return `ITM-${ts}`;
};

// ── Temporary mock data ───────────────────────────────────────────────────────

export const TEMP_INVENTORY: InventoryItem[] = [
  {
    item_sno: 1, item_code: 'ITM-0001', item_name: 'Steel Rod 10mm',
    category: 'Raw Material', sub_category: 'Steel', uom: 'Kg',
    current_stock: 850, min_stock: 200, max_stock: 2000, reorder_qty: 500,
    warehouse: 'Main Warehouse', location: 'A-01-R1',
    cost_price: 68, selling_price: 75, status: 'Active', hsn_code: '7213',
    created_at: '2025-01-10T10:00:00Z',
  },
  {
    item_sno: 2, item_code: 'ITM-0002', item_name: 'Lubricant Oil 5L',
    category: 'Consumable', sub_category: 'Oils', uom: 'Litre',
    current_stock: 40, min_stock: 50, max_stock: 300, reorder_qty: 100,
    warehouse: 'Main Warehouse', location: 'B-02-R3',
    cost_price: 520, selling_price: 580, status: 'Active', hsn_code: '2710',
    created_at: '2025-02-05T09:30:00Z',
  },
  {
    item_sno: 3, item_code: 'ITM-0003', item_name: 'Bearing SKF 6205',
    category: 'Spare Parts', sub_category: 'Bearings', uom: 'Nos',
    current_stock: 0, min_stock: 10, max_stock: 100, reorder_qty: 25,
    warehouse: 'Secondary Warehouse', location: 'C-05-R2',
    cost_price: 480, selling_price: 550, status: 'Active', hsn_code: '8482',
    created_at: '2025-01-22T14:00:00Z',
  },
  {
    item_sno: 4, item_code: 'ITM-0004', item_name: 'Corrugated Box 12x10x8',
    category: 'Packaging', sub_category: 'Boxes', uom: 'Nos',
    current_stock: 1200, min_stock: 100, max_stock: 1000, reorder_qty: 200,
    warehouse: 'Main Warehouse', location: 'D-01-R1',
    cost_price: 18, selling_price: 22, status: 'Active', hsn_code: '4819',
    created_at: '2025-03-01T08:00:00Z',
  },
  {
    item_sno: 5, item_code: 'ITM-0005', item_name: 'Safety Gloves (Pair)',
    category: 'Consumable', sub_category: 'Safety Gear', uom: 'Pair',
    current_stock: 75, min_stock: 20, max_stock: 200, reorder_qty: 50,
    warehouse: 'Main Warehouse', location: 'E-03-R2',
    cost_price: 45, selling_price: 55, status: 'Active', hsn_code: '3926',
    created_at: '2025-03-15T11:00:00Z',
  },
];
