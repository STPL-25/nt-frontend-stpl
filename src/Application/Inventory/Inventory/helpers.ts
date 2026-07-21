import type { InventoryItem } from './types';

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getStockStatus = (item: InventoryItem): { label: string; color: 'green' | 'amber' | 'red' } => {
  if (item.current_stock <= 0) return { label: 'Out of Stock', color: 'red' };
  if (item.current_stock <= item.min_stock) return { label: 'Low Stock', color: 'amber' };
  if (item.current_stock >= item.max_stock) return { label: 'Overstocked', color: 'amber' };
  return { label: 'In Stock', color: 'green' };
};

export const generateItemCode = (): string => {
  const ts = Date.now().toString(36).toUpperCase();
  return `ITM-${ts}`;
};
