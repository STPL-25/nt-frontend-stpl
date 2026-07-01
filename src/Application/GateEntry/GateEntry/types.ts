// ── Gate Entry Types ──────────────────────────────────────────────────────────
// Security-gate inward register. Captured when a vehicle arrives at the gate,
// BEFORE goods are received (GRN). A gate entry references a PO and records the
// supplier invoice / vehicle / weighment basics.

export type GateStatus = 'In' | 'Verified' | 'GRN Done' | 'Out';

export interface GatePORef {
  po_basic_sno?: number;
  po_no?: string;
  vendor_sno?: number;
  vendor_name?: string;
  com_name?: string;
  po_date?: string;
}

export interface GateEntryRecord {
  gate_entry_sno?: number;
  gate_entry_no?: string;
  entry_date: string;
  entry_time: string;
  // PO reference
  po_basic_sno?: number;
  po_no?: string;
  vendor_name?: string;
  // Document basics
  invoice_no?: string;
  invoice_date?: string;
  challan_no?: string;
  lr_no?: string;            // Lorry Receipt / consignment note
  // Vehicle / transport
  vehicle_no?: string;
  driver_name?: string;
  driver_mobile?: string;
  transporter_name?: string;
  // Weighment
  gross_weight?: number;
  tare_weight?: number;
  net_weight?: number;
  no_of_packages?: number;
  material_desc?: string;
  remarks?: string;
  status?: GateStatus;
  created_by_name?: string;
  created_at?: string;
}

export interface GateEntryFormState {
  entry_date: string;
  entry_time: string;
  po_basic_sno: string;      // select value (stringified sno)
  invoice_no: string;
  invoice_date: string;
  challan_no: string;
  lr_no: string;
  vehicle_no: string;
  driver_name: string;
  driver_mobile: string;
  transporter_name: string;
  gross_weight: string;
  tare_weight: string;
  no_of_packages: string;
  material_desc: string;
  remarks: string;
}
