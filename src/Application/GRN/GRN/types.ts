// ── GRN Types ─────────────────────────────────────────────────────────────────

export interface POItem {
  po_item_sno?: number;
  pr_item_sno?: number;
  prod_sno?: number;
  prod_name?: string;
  item_name?: string;
  specification?: string;
  ordered_qty?: number;
  qty?: number;
  received_qty?: number;    // total already received across past GRNs
  pending_qty?: number;     // still to receive
  unit?: number;
  unit_name?: string;
  uom_name?: string;
  unit_price?: number;
  total_amount?: number;
}

export interface PORecord {
  po_basic_sno?: number;
  po_no?: string;
  pr_basic_sno?: number;
  pr_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  company_name?: string;
  po_date?: string;
  required_date?: string;
  delivery_address?: string;
  terms_conditions?: string;
  purpose?: string;
  com_sno?: number;
  com_name?: string;
  div_sno?: number;
  div_name?: string;
  brn_sno?: number;
  brn_name?: string;
  dept_sno?: number;
  dept_name?: string;
  status?: string;
  grn_status?: string;      // 'Pending' | 'Partial' | 'Received'
  total_amount?: number;
  items?: POItem[] | string;
  // flat item columns (when PO has single item)
  prod_name?: string;
  unit_name?: string;
  // Gate Entry linkage — present when this row came from
  // sp_nt_GetPendingGateEntriesForGRN (GRN is gated on Gate Entry).
  gate_entry_sno?: number;
  gate_entry_no?: string;
  invoice_no?: string;
  invoice_date?: string;
  gate_received_qty?: number;
  gate_received_date?: string;
  gate_entry_status?: string;
}

export interface WarehouseLocationOption {
  location_sno: number;
  location_code: string;
  location_name: string;
  description?: string;
}

export interface GRNItem {
  grn_item_sno?: number;
  po_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification: string;
  ordered_qty: number;
  received_qty: number;
  rejected_qty: number;
  unit_name: string;
  condition: 'Good' | 'Damaged' | 'Partial';
  /** HSN code keyed in from the supplier's invoice. */
  hsn_code?: string;
  remarks: string;
  /** Warehouse Location master row this receipt was placed into. */
  warehouse_location_sno?: number;
  warehouse_location_name?: string;
}

export interface GRNRecord {
  grn_basic_sno?: number;
  grn_no?: string;
  po_basic_sno?: number;
  po_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  received_date?: string;
  received_by?: string;
  received_by_name?: string;
  doc_ref_no?: string;
  vehicle_no?: string;
  challan_no?: string;
  remarks?: string;
  status?: string;
  created_at?: string;
  items: GRNItem[];
}

export interface GRNFormState {
  received_date: string;
  doc_ref_no: string;
  vehicle_no: string;
  challan_no: string;
  remarks: string;
}

export interface GRNItemEntry {
  po_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification: string;
  ordered_qty: number;
  pending_qty: number;
  unit_name: string;
  unit_price: number;
  received_qty: number;
  rejected_qty: number;
  condition: 'Good' | 'Damaged' | 'Partial';
  /** HSN code keyed in from the supplier's invoice. */
  hsn_code: string;
  remarks: string;
  selected: boolean;
  /** Warehouse Location master row this receipt is being placed into. */
  warehouse_location_sno?: number;
}
