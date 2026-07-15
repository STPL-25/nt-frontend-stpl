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
export const grnSvcGetGRNsByPO = (po_basic_sno: number) => `${base}/getGRNsByPO/${po_basic_sno}`;
export const grnSvcCreateGRN = `${base}/createGRN`;
export const grnSvcGetAllGRNs = `${base}/getAllGRNs`;

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
