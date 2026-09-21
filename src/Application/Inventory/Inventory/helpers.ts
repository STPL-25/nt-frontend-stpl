import type { InventoryItem } from './types';

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// When a Product Stock Level Master policy is configured for this item's
// product + scope (master_min_qty/max_qty/reorder_level, joined in by
// sp_nt_GetInventoryItems), it now DRIVES the stock status color — it no
// longer sits alongside the badge as reference-only. Falls back to the
// item's own independently-editable min_stock/max_stock/reorder_qty when no
// master policy applies (the normal case for a "rare"/untracked product).
// Shared by getStockStatus (below) and every place that displays Min/Max/ROL
// (InventoryTable, InventoryDetailDrawer) so the numbers shown always match
// what actually decided the status color — no separate "Configured Levels"
// reference block needed alongside them.
export const getEffectiveLevels = (item: InventoryItem): { min: number; max: number; reorder: number } => ({
  min: item.master_min_qty ?? item.min_stock,
  max: item.master_max_qty ?? item.max_stock,
  reorder: item.master_reorder_level ?? item.reorder_qty,
});

/**
 * Stock re-expressed in the product's pack unit (115 Liter -> 7.67 Tin), for
 * products bought in a pack but held in a measure unit. Null when there is no
 * pack size, or the item is already held in the pack unit (nothing to add).
 */
export const getPackEquivalent = (item: InventoryItem): { qty: number; unit: string } | null => {
  const factor = Number(item.pack_factor);
  if (!item.pack_uom_name || !(factor > 0)) return null;
  if ((item.uom ?? '').trim().toLowerCase() === item.pack_uom_name.trim().toLowerCase()) return null;
  return { qty: item.current_stock / factor, unit: item.pack_uom_name };
};

export const formatPackQty = (qty: number): string =>
  qty.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const getStockStatus = (item: InventoryItem): { label: string; color: 'green' | 'amber' | 'red' | 'purple' } => {
  const { min: effectiveMin, max: effectiveMax, reorder: effectiveReorder } = getEffectiveLevels(item);

  if (item.current_stock <= 0) return { label: 'Out of Stock', color: 'red' };
  // Perishable stock still on hand past its subcategory's shelf life
  // (server-computed in sp_nt_GetInventoryItems) — ranked above the
  // quantity-based tiers below since unconsumed, ageing food is a more
  // urgent problem than a low/high quantity reading.
  if (item.is_expiry_stock) return { label: 'Expiry Stock', color: 'purple' };
  // A threshold of 0 means "not configured" (the item/master default), not
  // "already breached" — otherwise every item without a real policy set would
  // wrongly show Overstocked the moment it has any stock at all.
  if (effectiveMin > 0 && item.current_stock <= effectiveMin) return { label: 'Low Stock', color: 'red' };
  if (effectiveReorder > 0 && item.current_stock <= effectiveReorder) return { label: 'Reorder Needed', color: 'amber' };
  if (effectiveMax > 0 && item.current_stock >= effectiveMax) return { label: 'Overstocked', color: 'amber' };
  return { label: 'In Stock', color: 'green' };
};

export const generateItemCode = (): string => {
  const ts = Date.now().toString(36).toUpperCase();
  return `ITM-${ts}`;
};
