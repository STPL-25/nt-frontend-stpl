// ── Stock Request Types ───────────────────────────────────────────────────────

export type StockRequestStatus =
  | 'Pending'
  | 'Partially Issued'
  | 'Issued'
  | 'Rejected'
  | 'Cancelled';

export interface StockRequest {
  request_sno: number;
  request_no: string;
  requested_by: string;
  requested_name?: string;
  department?: string;
  purpose?: string;
  status: StockRequestStatus;
  reject_reason?: string;
  issued_by?: string;
  issued_at?: string;
  item_count: number;
  total_requested_qty: number;
  total_issued_qty: number;
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
}

export interface StockRequestLine {
  sr_item_sno: number;
  request_sno: number;
  item_sno: number;
  item_code: string;
  item_name: string;
  uom: string;
  requested_qty: number;
  issued_qty: number;
  pending_qty: number;
  line_status: string;
  remarks?: string;
  /** Live stock at fetch time — cap for the issuable quantity. */
  current_stock: number;
  warehouse?: string;
  location?: string;
}

/** Cart line while the requester is composing a new request. */
export interface CartLine {
  item_sno: number;
  item_code: string;
  item_name: string;
  uom: string;
  current_stock: number;
  quantity: number;
  remarks: string;
}
