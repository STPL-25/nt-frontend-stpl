/**
 * Inventory management — item master + stock ledger (grn-service /api/inventory)
 *
 * Stock levels only change through adjustStock so every change leaves a
 * movement row (IN / OUT / ADJUSTMENT / TRANSFER). Deleting an item is a
 * soft delete: it is marked Discontinued, never removed.
 */
import type { StockMovementType } from '@/Application/Inventory/Inventory/types';
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/inventory`;

export const invSvcGetItems = `${base}/getItems`;
export const invSvcCreateItem = `${base}/createItem`;
export const invSvcUpdateItem = (item_sno: number) => `${base}/updateItem/${item_sno}`;
export const invSvcDeleteItem = (item_sno: number) => `${base}/deleteItem/${item_sno}`;
export const invSvcGetMovements = (item_sno: number) => `${base}/getMovements/${item_sno}`;
export const invSvcAdjustStock = `${base}/adjustStock`;
export const invSvcGetStockSummary = `${base}/getStockSummary`;

export interface StockAdjustment {
  item_sno: number;
  movement_type: StockMovementType;
  quantity: number;
  reference_no?: string;
  /** Required when movement_type is 'TRANSFER'. */
  to_warehouse?: string;
  reason?: string;
}

export interface ItemFilters {
  category?: string;
  warehouse?: string;
  status?: string;
  /** Stock is bucketed per company/division/branch (dept is not part of the key). */
  com_sno?: number;
  div_sno?: number;
  brn_sno?: number;
}

/** One row per item — current_stock summed across every branch holding it. */
export interface StockSummaryOverall {
  item_key: string;
  prod_sno: number | null;
  item_code: string;
  item_name: string;
  category: string | null;
  uom: string | null;
  total_stock: number;
  total_min_stock: number;
  branch_count: number;
}

/** One row per item per branch — join to the overall rows via item_key. */
export interface StockSummaryBranchRow {
  item_key: string;
  item_sno: number;
  item_code: string;
  item_name: string;
  category: string | null;
  uom: string | null;
  current_stock: number;
  min_stock: number;
  warehouse: string | null;
  status: string;
  prod_sno: number | null;
  com_sno: number | null;
  com_name: string | null;
  div_sno: number | null;
  div_name: string | null;
  brn_sno: number | null;
  brn_name: string | null;
}

export interface StockSummaryResponse {
  overall: StockSummaryOverall[];
  byBranch: StockSummaryBranchRow[];
}
