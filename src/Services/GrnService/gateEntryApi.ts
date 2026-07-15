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
