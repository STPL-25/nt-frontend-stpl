/**
 * Gate Entry — security inward register (grn-service /api/gate_entry)
 *
 * A gate entry is recorded when a vehicle arrives, BEFORE the GRN.
 * Entries are registered against approved POs that are pending receipt.
 */
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/gate_entry`;

export const gateGetApprovedPOs = `${base}/getApprovedPOs`;
export const gateGetAllEntries = `${base}/getAllGateEntries`;
export const gateGetEntriesByPO = (po_basic_sno: number) =>
  `${base}/getGateEntriesByPO/${po_basic_sno}`;
export const gateCreateEntry = `${base}/createGateEntry`;
export const gateUpdateStatus = (gate_entry_sno: number) =>
  `${base}/updateGateEntryStatus/${gate_entry_sno}`;
/** Resolve a dispatch-slip QR code (LR no, or DSD-<delivery_sno>) to its dispatch delivery. */
export const gateGetDispatchByLr = (lr_code: string) =>
  `${base}/dispatchByLr/${encodeURIComponent(lr_code)}`;
/** POs dispatched by the supplier but not yet GRN-complete (sidebar Pending Inward widget). */
export const gateGetPendingInward = `${base}/pendingInward`;

/** Row returned by gateGetDispatchByLr (sp_nt_GetDispatchDeliveryByLr). */
export interface DispatchDeliveryLookup {
  delivery_sno: number;
  lr_no: string | null;
  invoice_no: string;
  invoice_date: string;
  qty: number | null;
  pieces: number | null;
  bundles: number | null;
  invoice_file_url: string | null;
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  transport_sno: number | null;
  transport_name: string | null;
  dispatch_mode: 'Transport' | 'Direct';
  dispatch_status: string;
  dispatched_at: string;
  po_basic_sno: number;
  po_no: string;
  vendor_sno: number | null;
  vendor_name: string | null;
}

/** Row returned by gateGetPendingInward (sp_nt_GetPendingInwardPOs). */
export interface PendingInwardPO {
  po_basic_sno: number;
  po_no: string;
  vendor_name: string | null;
  dispatch_count: number;
  last_dispatch_at: string | null;
  gate_entry_count: number;
  gate_open_count: number;
  grn_count: number;
  stage: 'Dispatched' | 'GRN Pending';
}
