import { describe, it, expect } from 'vitest';
import type { SupplierPOItem } from '@/Services/SupplierService';
import { poTotals, percentLabel, hasAnyDiscount } from '@/Application/SupplierPortal/supplierPOModel';

const line = (over: Partial<SupplierPOItem> = {}): SupplierPOItem => ({
  po_item_sno: 1, prod_sno: 3, prod_name: 'Cotton yarn', specification: null, ordered_qty: 500, unit_name: 'Kg', unit_price: 700,
  discount_pct: 0, tax_pct: 12, taxable_amount: 350000, tax_amount: 42000, total_amount: 392000, ...over,
});

describe('poTotals', () => {
  it('sums taxable value, GST and the grand total (incl. GST) from the lines', () => {
    const t = poTotals([
      line(),
      line({ po_item_sno: 2, taxable_amount: 7000, tax_amount: 350, total_amount: 7350, tax_pct: 5 }),
    ]);
    expect(t).toEqual({ taxable: 357000, gst: 42350, grand: 399350, hasBreakdown: true });
    // the breakdown always reconciles to the grand total
    expect(t.taxable + t.gst).toBe(t.grand);
  });

  it('the grand total is the line TOTAL, never the GST amount (the bug: 500 x 700 @12% showed 42,000)', () => {
    expect(poTotals([line()]).grand).toBe(392000);
  });

  it('keeps paise exact when summing (no float drift)', () => {
    const t = poTotals([
      line({ taxable_amount: 0.1, tax_amount: 0.01, total_amount: 0.11 }),
      line({ po_item_sno: 2, taxable_amount: 0.2, tax_amount: 0.02, total_amount: 0.22 }),
    ]);
    expect(t.grand).toBe(0.33);
    expect(t.taxable).toBe(0.3);
    expect(t.gst).toBe(0.03);
  });

  it('falls back to the line totals alone for a payload from before sql/89 (no per-line taxable / GST)', () => {
    const old = (n: number): SupplierPOItem => ({ ...line(), taxable_amount: undefined, tax_amount: undefined, tax_pct: undefined, discount_pct: undefined, total_amount: n });
    const t = poTotals([old(100), old(250.5)]);
    expect(t.hasBreakdown).toBe(false);
    expect(t.grand).toBe(350.5);
  });

  it('no breakdown when only some lines carry it (never show a breakdown that does not add up)', () => {
    expect(poTotals([line(), line({ po_item_sno: 2, taxable_amount: undefined })]).hasBreakdown).toBe(false);
  });

  it('an empty order totals to zero with no breakdown', () => {
    expect(poTotals([])).toEqual({ taxable: 0, gst: 0, grand: 0, hasBreakdown: false });
  });
});

describe('percentLabel', () => {
  it('formats whole and fractional percentages', () => {
    expect(percentLabel(12)).toBe('12%');
    expect(percentLabel(0.5)).toBe('0.5%');
    expect(percentLabel(0)).toBe('0%');
    expect(percentLabel('18' as unknown as number)).toBe('18%');
  });
  it('shows a dash when there is no figure', () => {
    expect(percentLabel(undefined)).toBe('—');
    expect(percentLabel(null)).toBe('—');
    expect(percentLabel(NaN)).toBe('—');
  });
});

describe('hasAnyDiscount', () => {
  it('is true only when some line has a discount', () => {
    expect(hasAnyDiscount([line(), line({ discount_pct: 0.5 })])).toBe(true);
    expect(hasAnyDiscount([line(), line()])).toBe(false);
    expect(hasAnyDiscount([line({ discount_pct: undefined })])).toBe(false);
  });
});
