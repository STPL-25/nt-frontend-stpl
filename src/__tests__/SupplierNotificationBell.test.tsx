import React from 'react';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  http: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn() }),
}));

// Sheet mock: like Radix, content is only mounted while open.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, title, variant, size, ...rest }: any) => (
    <button onClick={onClick} title={title} {...rest}>{children}</button>
  ),
}));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/Services/SupplierService', () => ({
  supplierAxios: h.http,
  supplierNotifications: '/api/notifications/supplier',
  supplierNotificationsReadAll: '/api/notifications/supplier/read-all',
  supplierNotificationsClearRead: '/api/notifications/supplier/read',
  supplierNotificationRead: (id: string) => `/api/notifications/supplier/${id}/read`,
  supplierNotificationRemove: (id: string) => `/api/notifications/supplier/${id}`,
}));

import SupplierNotificationBell from '@/Application/SupplierPortal/SupplierNotificationBell';

const now = () => new Date().toISOString();
const NOTIFS = [
  {
    id: 'n1', type: 'info', title: 'New quotation request', read: false, createdAt: now(),
    message: 'Space Textiles has asked you to quote for RFQ-7.',
    data: { kind: 'rfq', view: 'rfq-entry', rfq_supplier_sno: 12 },
  },
  {
    id: 'n2', type: 'success', title: 'Payment made', read: true, createdAt: now(),
    message: 'Payment PAY-9 has been paid.', data: { kind: 'payment', view: 'payments' },
  },
  { id: 'n3', type: 'warning', title: 'Heads up', read: false, createdAt: now(), message: 'No screen attached.' },
];

const list = (data: any[]) => ({ data: { success: true, data } });
const itemFor = (title: string) =>
  screen.getAllByTestId('supplier-notification-item').find((el) => within(el).queryByText(title))!;

async function openDrawer(onOpen = vi.fn()) {
  render(<SupplierNotificationBell onOpen={onOpen} />);
  await waitFor(() => expect(h.http.get).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId('supplier-notification-bell').textContent).not.toBe(''));
  fireEvent.click(screen.getByTestId('supplier-notification-bell'));
  await waitFor(() => screen.getByTestId('sheet'));
  return onOpen;
}

describe('SupplierNotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.http.get.mockResolvedValue(list(NOTIFS));
    h.http.patch.mockResolvedValue({ data: { success: true } });
    h.http.delete.mockResolvedValue({ data: { success: true } });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('fetches from the supplier notifications endpoint and shows the unread count on the bell', async () => {
    render(<SupplierNotificationBell onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('supplier-notification-bell').textContent).toBe('2'));
    expect(h.http.get).toHaveBeenCalledWith('/api/notifications/supplier');
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('does not toast notifications that already exist when the page opens', async () => {
    render(<SupplierNotificationBell onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('supplier-notification-bell').textContent).toBe('2'));
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('lists every notification with its message and filters by Unread', async () => {
    await openDrawer();
    expect(screen.getAllByTestId('supplier-notification-item')).toHaveLength(3);
    expect(screen.getByText('Space Textiles has asked you to quote for RFQ-7.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Unread/ }));
    expect(screen.queryByText('Payment made')).toBeNull();
    expect(screen.getByText('New quotation request')).toBeTruthy();
  });

  it('shows the empty state', async () => {
    h.http.get.mockResolvedValue(list([]));
    render(<SupplierNotificationBell onOpen={vi.fn()} />);
    await waitFor(() => expect(h.http.get).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('supplier-notification-bell'));
    await waitFor(() => screen.getByText('No notifications yet'));
  });

  it('opens the screen a notification is about, marking it viewed and closing the drawer', async () => {
    const onOpen = await openDrawer();
    fireEvent.click(within(itemFor('New quotation request')).getByTestId('supplier-open-screen'));

    expect(onOpen).toHaveBeenCalledWith({ view: 'rfq-entry', rfq_supplier_sno: 12, po_basic_sno: undefined });
    expect(h.http.patch).toHaveBeenCalledWith('/api/notifications/supplier/n1/read');
    await waitFor(() => expect(screen.queryByTestId('sheet')).toBeNull());
  });

  it('offers no Open button for an informational notification', async () => {
    await openDrawer();
    expect(within(itemFor('Heads up')).queryByTestId('supplier-open-screen')).toBeNull();
  });

  it('removes a notification', async () => {
    await openDrawer();
    fireEvent.click(within(itemFor('Payment made')).getByRole('button', { name: /Remove notification: Payment made/ }));
    await waitFor(() => expect(screen.queryByText('Payment made')).toBeNull());
    expect(h.http.delete).toHaveBeenCalledWith('/api/notifications/supplier/n2');
  });

  it('puts a notification back and says so when removing it fails', async () => {
    h.http.delete.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500, data: { message: 'Server down' } } }));
    await openDrawer();
    fireEvent.click(within(itemFor('Payment made')).getByRole('button', { name: /Remove notification: Payment made/ }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Server down'));
    expect(screen.getByText('Payment made')).toBeTruthy();
  });

  it('treats a 404 on remove as already gone (no error toast, stays removed)', async () => {
    h.http.delete.mockRejectedValue({ response: { status: 404 } });
    await openDrawer();
    fireEvent.click(within(itemFor('Payment made')).getByRole('button', { name: /Remove notification: Payment made/ }));
    await waitFor(() => expect(screen.queryByText('Payment made')).toBeNull());
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('marks unread notifications viewed just by opening the drawer, and clears the badge', async () => {
    await openDrawer();
    await waitFor(() => expect(itemFor('New quotation request').getAttribute('data-read')).toBe('true'), { timeout: 3000 });
    expect(h.http.patch).toHaveBeenCalledWith('/api/notifications/supplier/read-all');
    expect(screen.getByTestId('supplier-notification-bell').textContent).toBe('');
  });

  it('keeps them unread when that save fails', async () => {
    h.http.patch.mockRejectedValue(new Error('down'));
    await openDrawer();
    await waitFor(() => expect(h.http.patch).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(itemFor('New quotation request').getAttribute('data-read')).toBe('false'));
  });

  it('polls, and toasts only the notifications that arrived since the last poll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<SupplierNotificationBell onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('supplier-notification-bell').textContent).toBe('2'));

    const arrived = { id: 'n4', type: 'info', title: 'New purchase order', read: false, createdAt: now(), message: 'PO 7 issued.', data: { view: 'workspace', po_basic_sno: 7 } };
    h.http.get.mockResolvedValue(list([arrived, ...NOTIFS]));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    await waitFor(() => expect(screen.getByTestId('supplier-notification-bell').textContent).toBe('3'));
    expect(h.toast).toHaveBeenCalledTimes(1);
    expect(h.toast).toHaveBeenCalledWith('New purchase order', { description: 'PO 7 issued.' });
  });

  it('never breaks the header when the request fails', async () => {
    h.http.get.mockRejectedValue(new Error('network'));
    render(<SupplierNotificationBell onOpen={vi.fn()} />);
    await waitFor(() => expect(h.http.get).toHaveBeenCalled());
    expect(screen.getByTestId('supplier-notification-bell')).toBeTruthy();
    expect(screen.getByTestId('supplier-notification-bell').textContent).toBe('');
  });
});
