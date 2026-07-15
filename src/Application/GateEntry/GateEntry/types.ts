// ── Gate Entry Types ──────────────────────────────────────────────────────────
// Security scans a PO number, reviews the PO summary, then records what actually
// arrived at the gate: invoice, received qty/date, bundles, transport, LR no,
// receiving ecno and a photo of the product.

import type { PORecord } from '@/Application/GRN/GRN/types';

export type { PORecord };

export type GateStatus = 'In' | 'Verified' | 'GRN Done' | 'Out';

export interface TransportOption {
  transport_sno: number;
  transport_name: string;
}

export interface GateEntryRecord {
  gate_entry_sno?: number;
  gate_entry_no?: string;
  // PO reference
  po_basic_sno?: number;
  po_no?: string;
  vendor_name?: string;
  // Receipt details
  invoice_no?: string;
  invoice_date?: string;
  received_qty?: number;
  received_date?: string;
  bundles?: number;
  transport_name?: string;
  lr_no?: string;
  receiver_ecno?: string;
  photo_name?: string;
  photo_url?: string;
  status?: GateStatus;
  created_by_name?: string;
  created_at?: string;
}

export interface GateEntryFormState {
  invoice_no: string;
  invoice_date: string;
  received_qty: string;
  received_date: string;
  bundles: string;
  transport_name: string;
  lr_no: string;
  receiver_ecno: string;
  photo: File | null;
}
