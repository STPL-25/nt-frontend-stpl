import { SUPPLIER_SERVICE_BASE } from './base';

const base = `${SUPPLIER_SERVICE_BASE}/api/supplier`;

export const supplierInvite = `${base}/invite`;
export const supplierLogin = `${base}/login`;
export const supplierResetPassword = `${base}/reset-password`;
export const supplierGetPOs = `${base}/pos`;
export const supplierGetPODetail = (po_basic_sno: number) => `${base}/pos/${po_basic_sno}`;
export const supplierAcceptPO = (po_basic_sno: number) => `${base}/pos/${po_basic_sno}/accept`;
export const supplierCreateDispatch = (po_basic_sno: number) => `${base}/pos/${po_basic_sno}/dispatch`;
export const supplierGetDispatchSlip = (dispatch_slip_sno: number) => `${base}/dispatch/${dispatch_slip_sno}`;
export const supplierGetDispatchDelivery = (delivery_sno: number) => `${base}/dispatch/delivery/${delivery_sno}`;

export interface SupplierPOListItem {
  po_basic_sno: number;
  po_no: string;
  po_date: string;
  required_date: string;
  delivery_address: string;
  status: string;
  supplier_ack_status: 'Accepted' | null;
  supplier_ack_date: string | null;
  com_name: string | null;
  dispatch_count: number;
}

export interface SupplierPOItem {
  po_item_sno: number;
  prod_sno: number | null;
  prod_name: string;
  specification: string | null;
  ordered_qty: number;
  unit_name: string | null;
  unit_price: number;
  total_amount: number;
}

export interface SupplierPODetail {
  po_basic_sno: number;
  po_no: string;
  po_date: string;
  required_date: string;
  delivery_address: string;
  terms_conditions: string | null;
  purpose: string | null;
  status: string;
  supplier_ack_status: 'Accepted' | null;
  supplier_ack_date: string | null;
  com_name: string | null;
  vendor_name: string | null;
  /** Raw FOR JSON PATH string from MSSQL — parse before use. */
  items: string | SupplierPOItem[];
}

/** One delivery (shipment/LR) entered on the dispatch form. */
export interface DeliveryFormValues {
  lr_no: string;
  invoice_no: string;
  invoice_date: string;
  qty?: number;
  pieces?: number;
  bundles?: number;
}

export interface DispatchFormValues {
  transport_name?: string;
  deliveries: DeliveryFormValues[];
}

/** One row returned right after sp_nt_CreateDispatchSlip creates it. */
export interface CreatedDelivery {
  delivery_sno: number;
  lr_no: string;
  invoice_no: string;
}

export interface DispatchCreateResult {
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  status: string;
  deliveries: CreatedDelivery[];
}

interface FromAddressFields {
  from_door_no: string | null;
  from_street: string | null;
  from_area: string | null;
  from_city: string | null;
  from_state: string | null;
  from_pincode: string | null;
}

/** sp_nt_GetDispatchSlip recap — header + every delivery under it. */
export interface SupplierDispatchSlip {
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  po_basic_sno: number;
  po_no: string;
  transport_name: string | null;
  status: string;
  created_at: string;
  deliveries: Array<{
    delivery_sno: number;
    lr_no: string;
    invoice_no: string;
    invoice_date: string;
    qty: number | null;
    pieces: number | null;
    bundles: number | null;
  }>;
}

/** sp_nt_GetDispatchDelivery — everything needed to print ONE delivery's slip. */
export interface SupplierDispatchDelivery extends FromAddressFields {
  delivery_sno: number;
  lr_no: string;
  invoice_no: string;
  invoice_date: string;
  qty: number | null;
  pieces: number | null;
  bundles: number | null;
  dispatch_slip_sno: number;
  dispatch_slip_no: string;
  transport_name: string | null;
  po_basic_sno: number;
  po_no: string;
  supplier_name: string | null;
  to_address: string | null;
}

export function parseSupplierPOItems(items: SupplierPODetail['items']): SupplierPOItem[] {
  if (Array.isArray(items)) return items;
  if (!items) return [];
  try {
    return JSON.parse(items);
  } catch {
    return [];
  }
}

export function formatFromAddress(addr: FromAddressFields): string {
  return [addr.from_door_no, addr.from_street, addr.from_area, addr.from_city, addr.from_state, addr.from_pincode]
    .filter(Boolean)
    .join(', ');
}
