// ── Inventory Types ───────────────────────────────────────────────────────────

export type InventoryCategory =
  | 'Raw Material'
  | 'WIP'
  | 'Finished Goods'
  | 'Consumable'
  | 'Spare Parts'
  | 'Packaging'
  | 'Other';

export type InventoryStatus = 'Active' | 'Inactive' | 'Discontinued';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';

export interface InventoryItem {
  item_sno?: number;
  item_code: string;
  item_name: string;
  category: InventoryCategory;
  sub_category?: string;
  uom: string;           // Unit of Measure
  current_stock: number;
  min_stock: number;
  max_stock: number;
  reorder_qty: number;
  warehouse: string;
  location?: string;     // Bin / Rack / Shelf
  cost_price: number;
  selling_price: number;
  status: InventoryStatus;
  hsn_code?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StockMovement {
  movement_sno?: number;
  item_sno: number;
  item_code: string;
  item_name: string;
  movement_type: StockMovementType;
  quantity: number;
  balance_after: number;
  uom: string;
  reference_no?: string;
  warehouse: string;
  reason?: string;
  created_by?: string;
  created_at?: string;
}

export interface InventoryFormState {
  item_code: string;
  item_name: string;
  category: string;
  sub_category: string;
  uom: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  reorder_qty: number;
  warehouse: string;
  location: string;
  cost_price: number;
  selling_price: number;
  status: string;
  hsn_code: string;
  description: string;
}

export const EMPTY_INVENTORY_FORM: InventoryFormState = {
  item_code: '',
  item_name: '',
  category: '',
  sub_category: '',
  uom: '',
  current_stock: 0,
  min_stock: 0,
  max_stock: 0,
  reorder_qty: 0,
  warehouse: '',
  location: '',
  cost_price: 0,
  selling_price: 0,
  status: 'Active',
  hsn_code: '',
  description: '',
};

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'Raw Material', 'WIP', 'Finished Goods', 'Consumable', 'Spare Parts', 'Packaging', 'Other',
];

export const UOM_OPTIONS = [
  'Nos', 'Kg', 'Gram', 'Litre', 'ML', 'Meter', 'CM', 'Feet', 'Box', 'Pack', 'Set', 'Pair', 'Roll', 'Sheet',
];

export const WAREHOUSES = [
  'Main Warehouse', 'Secondary Warehouse', 'Cold Storage', 'Transit', 'Scrap Yard',
];
