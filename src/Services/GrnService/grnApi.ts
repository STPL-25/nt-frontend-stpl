/**
 * GRN — Goods Receipt Note against approved POs (grn-service /api/grn)
 *
 * The PO list comes from approved POs whose ordered quantity is not yet
 * fully received (sp_nt_GetPendingPOsForGRN), so a GRN can only ever be
 * booked against an approved purchase order.
 */
import type { GRNRecord } from '@/Application/GRN/GRN/types';
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/grn`;

export const grnSvcGetPendingPOs = `${base}/getPendingPOs`;
// GRN is gated on Gate Entry — this is what GRNPage lists so a GRN can only
// be raised against a delivery that already cleared the gate.
export const grnSvcGetPendingGateEntries = `${base}/getPendingGateEntries`;
export const grnSvcGetGRNsByPO = (po_basic_sno: number) => `${base}/getGRNsByPO/${po_basic_sno}`;
export const grnSvcCreateGRN = `${base}/createGRN`;
export const grnSvcGetAllGRNs = `${base}/getAllGRNs`;
// Locations scoped to a GRN's company/division/branch (from the Warehouse
// Location master) — populates the per-item Location dropdown in
// GRNEntryForm so a received item can be assigned exactly where it went.
export const grnSvcGetWarehouseLocations = (com_sno?: number, div_sno?: number, brn_sno?: number) => {
  const params = new URLSearchParams();
  if (com_sno != null) params.set('com_sno', String(com_sno));
  if (div_sno != null) params.set('div_sno', String(div_sno));
  if (brn_sno != null) params.set('brn_sno', String(brn_sno));
  return `${base}/getWarehouseLocations?${params.toString()}`;
};

// Inventory-sync tracking — a GRN line's stock-in posting can fail after the
// GRN itself already succeeded (transient DB error); these surface + retry it.
export const grnSvcGetUnsyncedInventoryItems = `${base}/getUnsyncedInventoryItems`;
export const grnSvcResyncInventoryItem = `${base}/resyncInventoryItem`;

export interface UnsyncedInventoryItem {
  grn_item_sno: number;
  prod_sno: number;
  prod_name: string;
  received_qty: number;
  rejected_qty: number;
  net_qty: number;
  inventory_sync_status: 'Failed';
  inventory_sync_error: string | null;
  created_date: string;
  grn_basic_sno: number;
  grn_no: string;
  com_sno: number | null;
  div_sno: number | null;
  brn_sno: number | null;
}

// Drafts (Redis-backed, per-user)
export const grnSvcSaveDraft = `${base}/saveGRNDraft`;
export const grnSvcGetDrafts = `${base}/getGRNDrafts`;
export const grnSvcGetDraft = (draftId: string) => `${base}/getGRNDraft/${draftId}`;
export const grnSvcUpdateDraft = (draftId: string) => `${base}/updateGRNDraft/${draftId}`;
export const grnSvcDeleteDraft = (draftId: string) => `${base}/deleteGRNDraft/${draftId}`;
export const grnSvcSubmitDraft = (draftId: string) => `${base}/submitGRNDraft/${draftId}`;

export interface GRNDraft extends Partial<GRNRecord> {
  draftId: string;
  ecno: string;
  savedAt: string;
  updatedAt: string;
}
