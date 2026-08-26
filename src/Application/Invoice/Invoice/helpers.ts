import type { Invoice, InvoiceAllocation } from './types';

export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
};

export const formatINR = (val?: number | null): string => {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
};

/** allocations comes back as a JSON string from FOR JSON PATH on some rows, an array on others. */
export const parseAllocations = (invoice: Invoice): InvoiceAllocation[] => {
  if (!invoice.allocations) return [];
  if (Array.isArray(invoice.allocations)) return invoice.allocations;
  try {
    return JSON.parse(invoice.allocations);
  } catch {
    return [];
  }
};

export const matchStatusTone: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Allocated: 'bg-blue-100 text-blue-700 border-blue-200',
  Matched: 'bg-green-100 text-green-700 border-green-200',
  Partial: 'bg-orange-100 text-orange-700 border-orange-200',
  PartialRelease: 'bg-orange-100 text-orange-700 border-orange-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};
