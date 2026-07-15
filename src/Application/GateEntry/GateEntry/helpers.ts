import type { TransportOption } from './types';

export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
};

// ── Mock data (no transporter master table in the DB yet — replace with an API call once one exists) ──
export const MOCK_TRANSPORT_LIST: TransportOption[] = [
  { transport_sno: 1, transport_name: 'Delhi Cargo Movers' },
  { transport_sno: 2, transport_name: 'Maharashtra Roadlines' },
  { transport_sno: 3, transport_name: 'Sunrise Logistics' },
  { transport_sno: 4, transport_name: 'National Carriers Pvt Ltd' },
  { transport_sno: 5, transport_name: 'Self / Vendor Delivered' },
];
