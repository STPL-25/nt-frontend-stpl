/**
 * Stock Requests — users request in-stock items, the stock incharge issues
 * them (grn-service /api/stock_request).
 *
 * Issuing posts an OUT movement per line through the same stock ledger as
 * the Inventory page, so current_stock is reduced with a full audit trail
 * (reference_no = the request number).
 */
import { GRN_SERVICE_BASE } from './base';

const base = `${GRN_SERVICE_BASE}/api/stock_request`;

export const srGetRequests = `${base}/getRequests`;
export const srGetRequestItems = (request_sno: number) => `${base}/getRequestItems/${request_sno}`;
export const srCreateRequest = `${base}/createRequest`;
export const srIssueRequest = `${base}/issueRequest`;
export const srRejectRequest = (request_sno: number) => `${base}/rejectRequest/${request_sno}`;
export const srCancelRequest = (request_sno: number) => `${base}/cancelRequest/${request_sno}`;

export interface StockRequestFilters {
  status?: string;
  requested_by?: string;
}

export interface CreateStockRequestLine {
  item_sno: number;
  quantity: number;
  remarks?: string;
}

export interface CreateStockRequestPayload {
  purpose?: string;
  department?: string;
  items: CreateStockRequestLine[];
}

export interface IssueStockRequestLine {
  sr_item_sno: number;
  issue_qty: number;
}

export interface IssueStockRequestPayload {
  request_sno: number;
  items: IssueStockRequestLine[];
}
