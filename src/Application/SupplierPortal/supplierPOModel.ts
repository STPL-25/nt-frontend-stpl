import type { SupplierPOItem } from '@/Services/SupplierService';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SupplierPOTotals {
  /** Sum of the lines before GST (after discount). Only meaningful when `hasBreakdown`. */
  taxable: number;
  /** Sum of the GST on the lines. Only meaningful when `hasBreakdown`. */
  gst: number;
  /** Sum of the line totals - the order value the supplier will be paid against. */
  grand: number;
  /** False for a payload from before sql/89 (no taxable / GST per line): only `grand` can be trusted then. */
  hasBreakdown: boolean;
}

/**
 * The order's totals from its lines. Each line's `total_amount` already includes GST (sql/89), so the grand total is a plain
 * sum; the taxable value and GST are shown alongside so the supplier can see how the amount is made up.
 */
export function poTotals(items: SupplierPOItem[]): SupplierPOTotals {
  const hasBreakdown = items.length > 0 && items.every((it) => it.taxable_amount != null && it.tax_amount != null);
  return {
    taxable: round2(items.reduce((s, it) => s + Number(it.taxable_amount ?? 0), 0)),
    gst: round2(items.reduce((s, it) => s + Number(it.tax_amount ?? 0), 0)),
    grand: round2(items.reduce((s, it) => s + Number(it.total_amount ?? 0), 0)),
    hasBreakdown,
  };
}

/** "12%" / "0.5%" / "0%"; "—" when the line carries no figure (payload from before sql/89). */
export function percentLabel(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(Number(pct))) return '—';
  return `${Number(pct).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

/** True when any line has a discount - the Discount column is only worth showing then. */
export const hasAnyDiscount = (items: SupplierPOItem[]): boolean => items.some((it) => Number(it.discount_pct ?? 0) > 0);
