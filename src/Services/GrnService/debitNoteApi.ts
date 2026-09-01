/**
 * Debit Note — raised against a submitted GRN when received goods are
 * damaged, short of the ordered quantity, or being returned to the
 * supplier (grn-service /api/debit_note).
 */
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/debit_note`;

export const debitNoteSvcGetDiscrepancyItems = (grn_basic_sno: number) =>
  `${base}/discrepancyItems/${grn_basic_sno}`;
export const debitNoteSvcCreate = `${base}/createDebitNote`;
export const debitNoteSvcGetAll = `${base}/getAllDebitNotes`;
export const debitNoteSvcGetByGRN = (grn_basic_sno: number) => `${base}/getDebitNotesByGRN/${grn_basic_sno}`;
