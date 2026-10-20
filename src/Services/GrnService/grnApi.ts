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
export const grnSvcGetUoms = `${base}/getUoms`;
// Qty received above the PO is held until the approver decides (accept / reject).
export const grnSvcGetExcessRequests = (params: { mine?: boolean; status?: string; grn_basic_sno?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.mine) q.set('mine', '1');
  if (params.status) q.set('status', params.status);
  if (params.grn_basic_sno != null) q.set('grn_basic_sno', String(params.grn_basic_sno));
  return `${base}/excessRequests?${q.toString()}`;
};
export const grnSvcDecideExcess = `${base}/decideExcess`;
// GRN approval gate: stock is posted only after final approval.
export const grnSvcGetGRNApprovals = (params: { mine?: boolean; grn_basic_sno?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.mine) q.set('mine', '1');
  if (params.grn_basic_sno != null) q.set('grn_basic_sno', String(params.grn_basic_sno));
  return `${base}/grnApprovals?${q.toString()}`;
};
export const grnSvcDecideGRN = `${base}/decideGRN`;
// Per-unit asset tags (QR labels) for approved GRNs.
export const grnSvcAssetTagGRNs = `${base}/assetTagGRNs`;
export const grnSvcGenerateAssetTags = `${base}/generateAssetTags`;
export const grnSvcAssetTagsPrinted = `${base}/assetTagsPrinted`;
export const grnSvcGetCreditNotesByGRN = (grn_basic_sno: number) => `${base}/creditNotesByGRN/${grn_basic_sno}`;
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

// -- Accounting journal / account heads (sql/41, sql/42) --
export const grnSvcAccountHeads = `${base}/accountHeads`;
export const grnSvcSubcategoryAccountMap = `${base}/subcategoryAccountMap`;
export const grnSvcSetSubcategoryAccountHead = `${base}/setSubcategoryAccountHead`;
export const grnSvcJournals = `${base}/journals`;

export interface AccountHead { head_sno: number; head_code: string; head_name: string; head_type: string; system_key: string | null }
export interface SubcategoryAccountRow {
  subcat_sno: number; subcat_name: string; cat_name: string | null; subcat_stock_type: string | null;
  account_head_sno: number | null; head_code: string | null; head_name: string | null; suspense_amount: number;
}
export interface JournalLine {
  journal_sno: number; journal_no: string; journal_date: string; source_type: string; source_sno: number;
  narration: string | null; status: string; line_sno: number; head_code: string; head_name: string;
  debit: number; credit: number; vendor_sno: number | null; subcat_sno: number | null; is_suspense: boolean;
}
