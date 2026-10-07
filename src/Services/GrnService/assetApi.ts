/**
 * Asset Management — Non-Regular items issued to departments, with Return
 * (Purchase flow → Return Order → Debit Note) and Service (Outpass / In-store)
 * requests (grn-service /api/asset_management).
 */
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/asset_management`;

export const assetSvcMe = `${base}/me`;
export const assetSvcRegister = `${base}/register`;
export const assetSvcSuppliers = `${base}/suppliers`;
export const assetSvcRequests = `${base}/requests`;
export const assetSvcRequest = (id: number) => `${base}/requests/${id}`;
export const assetSvcAction = (id: number) => `${base}/requests/${id}/action`;

export type AssetAction =
  | 'APPROVE' | 'REJECT' | 'CANCEL' | 'RAISE_RETURN_ORDER' | 'GATE_OUT' | 'GATE_IN'
  | 'START_SERVICE' | 'COMPLETE_SERVICE' | 'RAISE_DEBIT_NOTE' | 'RESERVICE';

export interface AssetRow {
  sr_item_sno: number;
  stock_request_sno: number;
  issue_ref: string;
  item_sno: number;
  item_code: string;
  item_name: string;
  uom: string;
  category: string | null;
  sub_category: string | null;
  dept_sno: number | null;
  dept_name: string | null;
  com_name: string | null;
  div_name: string | null;
  brn_name: string | null;
  requested_by: string | null;
  requested_name: string | null;
  received_by_ecno: string | null;
  received_by_name: string | null;
  issued_qty: number;
  issue_date: string | null;
  returned_qty: number;
  service_qty: number;
  in_use_qty: number;
  default_supplier_sno: number | null;
  default_supplier_name: string | null;
}

export interface AssetRequest {
  asset_req_sno: number;
  request_no: string;
  request_type: 'RETURN' | 'SERVICE';
  sr_item_sno: number;
  issue_ref: string | null;
  item_sno: number;
  item_code: string | null;
  item_name: string;
  uom: string | null;
  qty: number;
  reason: string;
  raised_by: string;
  raised_by_name: string | null;
  raised_role: 'DEPT' | 'STORE';
  dept_name: string | null;
  status: string;
  current_approver_ecno: string | null;
  current_approver_name: string | null;
  reject_reason: string | null;
  supplier_sno: number | null;
  supplier_name: string | null;
  payment_applicable: 'Y' | 'N' | null;
  est_amount: number | null;
  service_mode: 'OUTPASS' | 'INSTORE' | null;
  service_vendor: string | null;
  expected_return_date: string | null;
  cycle_no: number;
  rework_count: number;
  return_order_no: string | null;
  return_order_date: string | null;
  dc_no: string | null;
  dc_date: string | null;
  gate_out_no: string | null;
  gate_out_at: string | null;
  gate_in_no: string | null;
  gate_in_at: string | null;
  service_receipt_no: string | null;
  qc_result: 'OK' | 'NOT_OK' | null;
  debit_note_no: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AssetApproval {
  approval_sno: number;
  seq: number;
  phase: 'DEPT' | 'MAIN';
  stage_name: string | null;
  approver_ecno: string;
  approver_name: string | null;
  status: 'Waiting' | 'Pending' | 'Approved' | 'Rejected' | 'Skipped';
  acted_by: string | null;
  acted_at: string | null;
  remarks: string | null;
}

export interface AssetHistory {
  hist_sno: number;
  event: string;
  remarks: string | null;
  by_ecno: string | null;
  by_name: string | null;
  at: string;
}

export interface AssetRequestDetail {
  request: AssetRequest;
  approvals: AssetApproval[];
  history: AssetHistory[];
}

export interface AssetSupplier {
  supplier_sno: number;
  company_name: string;
  supp_code: string | null;
}

export interface AssetMe {
  ecno: string;
  name: string;
  is_store_incharge: boolean;
}

export interface CreateAssetRequestPayload {
  request_type: 'RETURN' | 'SERVICE';
  sr_item_sno: number;
  qty: number;
  reason: string;
  supplier_sno?: number | null;
  payment_applicable?: 'Y' | 'N';
  est_amount?: number | null;
  service_mode?: 'OUTPASS' | 'INSTORE';
  service_vendor?: string;
  expected_return_date?: string;
}
