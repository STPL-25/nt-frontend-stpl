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
}
