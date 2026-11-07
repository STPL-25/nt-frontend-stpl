import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
// jsPDF is only used on "Download PO"; keep it out of the render.
vi.mock('@/Application/SupplierPortal/supplierPOPdf', () => ({
  addressToLines: (raw: string | null) => (raw ? [raw] : []),
  buildSupplierPOPdf: vi.fn(),
}));
vi.mock('@/Services/SupplierService', async () => {
  const actual = await vi.importActual<any>('@/Services/SupplierService/supplierApi');
  return {
    ...actual,
    supplierAxios: { get: h.get, post: vi.fn() },
    supplierGetPODetail: (id: number) => `/api/supplier/pos/${id}`,
    supplierAcceptPO: (id: number) => `/api/supplier/pos/${id}/accept`,
  };
});

import SupplierPODetail from '@/Application/SupplierPortal/SupplierPODetail';

// Exactly what sp_nt_GetPODetailForSupplier returns after sql/89: `items` is a FOR JSON string; amounts are computed per line.
const detail = (items: unknown[]) => ({
  po_basic_sno: 1136, po_no: 'STPLSKTMCBE3015', po_date: '2026-10-28', required_date: null, delivery_address: 'Plot 4, Tiruppur',
  terms_conditions: null, purpose: 'Yarn', status: 'A', supplier_ack_status: null, supplier_ack_date: null, po_pdf_url: null,
  com_name: 'Space Textiles', vendor_name: 'Sri Lakshmi Spinning Mills', items: JSON.stringify(items),
});

const NEW_LINE = {
  po_item_sno: 175, prod_sno: 3, prod_name: 'Cotton yarn 30s', specification: '', ordered_qty: 500, unit_name: 'Kg', unit_price: 700,
  discount_pct: 0, tax_pct: 12, taxable_amount: 350000, tax_amount: 42000, total_amount: 392000,
};

async function renderPO(items: unknown[]) {
  h.get.mockResolvedValue({ data: { data: detail(items) } });
  render(<SupplierPODetail po_basic_sno={1136} onDispatch={vi.fn()} />);
  await waitFor(() => screen.getByTestId('po-grand-total'));
}

describe('SupplierPODetail amounts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows the line total incl. GST - not the GST amount - and a Taxable / GST / Grand total breakdown that adds up', async () => {
    await renderPO([NEW_LINE]);
    expect(screen.getByTestId('po-taxable').textContent).toBe('₹3,50,000.00');
    expect(screen.getByTestId('po-gst').textContent).toBe('₹42,000.00');
    expect(screen.getByTestId('po-grand-total').textContent).toBe('₹3,92,000.00');
    // the line row (wide-pane table): rate, GST %, and the amount that includes GST
    const row = screen.getByText('Cotton yarn 30s', { selector: 'p.font-medium' }).closest('tr')!;
    expect(within(row).getByText('12%')).toBeTruthy();
    expect(within(row).getByText('₹3,92,000.00')).toBeTruthy();
    expect(within(row).queryByText('₹42,000.00')).toBeNull(); // the old bug: the tax shown as the amount
  });

  it('the hero "Order value" is the grand total incl. GST', async () => {
    await renderPO([NEW_LINE, { ...NEW_LINE, po_item_sno: 176, ordered_qty: 10, taxable_amount: 7000, tax_amount: 350, tax_pct: 5, total_amount: 7350 }]);
    expect(screen.getByTestId('po-grand-total').textContent).toBe('₹3,99,350.00');
    expect(screen.getAllByText('₹3,99,350.00').length).toBeGreaterThanOrEqual(2); // footer + hero metric
  });

  it('shows the Discount column only when some line has a discount', async () => {
    await renderPO([NEW_LINE]);
    expect(screen.queryByRole('columnheader', { name: 'Discount' })).toBeNull();
  });

  it('shows the Discount column (and the discounted amount) when a line has one', async () => {
    await renderPO([{ ...NEW_LINE, ordered_qty: 10, unit_price: 1500, discount_pct: 0.5, taxable_amount: 14925, tax_amount: 1791, total_amount: 16716 }]);
    expect(screen.getByRole('columnheader', { name: 'Discount' })).toBeTruthy();
    expect(screen.getByText('0.5%')).toBeTruthy();
    expect(screen.getByTestId('po-grand-total').textContent).toBe('₹16,716.00');
  });

  it('still renders sensibly against a payload from before sql/89 (no GST fields): no breakdown, dashes for GST, plain total', async () => {
    const { discount_pct, tax_pct, taxable_amount, tax_amount, ...old } = NEW_LINE;
    await renderPO([{ ...old, total_amount: 42000 }]);
    expect(screen.queryByTestId('po-gst')).toBeNull();
    expect(screen.queryByTestId('po-taxable')).toBeNull();
    expect(screen.getByTestId('po-grand-total').textContent).toBe('₹42,000.00');
  });
});
