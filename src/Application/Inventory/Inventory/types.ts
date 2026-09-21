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
  com_sno?: number;
  com_name?: string;
  div_sno?: number;
  div_name?: string;
  brn_sno?: number;
  brn_name?: string;
  dept_sno?: number;
  dept_name?: string;
  created_at?: string;
  updated_at?: string;
  location_name?: string; // Added for display purposes
  location_code?: string; // Added for display purposes
  // Reference-only values from the Product Stock Level Master (see
  // grn-service/sql/29_inventory_stock_level_reference.sql) — the best-matching
  // configured policy for this item's product + scope, if any. Shown alongside
  // this item's own independently-editable min_stock/max_stock/reorder_qty
  // above; never auto-applied to them. Undefined/null when the product has no
  // configured policy (the normal case for a "rare"/untracked product).
  master_min_qty?: number | null;
  master_max_qty?: number | null;
  master_reorder_level?: number | null;
  master_scope_type?: 'ORG' | 'LOCATION' | null;
  // Perishable/expiry signal (see grn-service/sql/30_perishable_expiry_stock.sql).
  // subcat_stock_type/perishable_days come from the product's subcategory;
  // last_received_date is an approximation — MAX(GRN received_date) across
  // every receipt of this product, not true per-batch aging (this codebase
  // has no batch/lot stock tracking). is_expiry_stock is the server-computed
  // "still on hand past its shelf life" flag the Inventory page badges.
  subcat_stock_type?: 'Regular' | 'Non-Regular' | 'Perishable' | null;
  perishable_days?: number | null;
  last_received_date?: string | null;
  days_since_last_received?: number | null;
  is_expiry_stock?: boolean;
  // The product's purchase/pack unit and how many stock units it holds (Tin, 15),
  // attached by grn-service for products with a per-product pack size. Lets the
  // list show the same stock in both units — 115 Liter ≈ 7.67 Tin.
  pack_uom_name?: string | null;
  pack_factor?: number | null;
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
  com_sno: number | '';
  com_name: string;
  div_sno: number | '';
  div_name: string;
  brn_sno: number | '';
  brn_name: string;
  dept_sno: number | '';
  dept_name: string;
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
  com_sno: '',
  com_name: '',
  div_sno: '',
  div_name: '',
  brn_sno: '',
  brn_name: '',
  dept_sno: '',
  dept_name: '',
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
