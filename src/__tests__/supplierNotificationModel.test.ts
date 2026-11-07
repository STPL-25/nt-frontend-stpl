import { describe, it, expect } from 'vitest';
import type { AppNotification } from '@/lib/notifications';
import { targetFromNotification, newlyArrived } from '@/Application/SupplierPortal/supplierNotificationModel';

const n = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1', type: 'info', title: 't', message: 'm', read: false, createdAt: new Date().toISOString(), ...over,
});

describe('targetFromNotification', () => {
  it('opens the RFQ named by the notification', () => {
    expect(targetFromNotification(n({ data: { view: 'rfq-entry', rfq_supplier_sno: 12, rfq_no: 'RFQ-1' } })))
      .toEqual({ view: 'rfq-entry', rfq_supplier_sno: 12, po_basic_sno: undefined });
  });

  it('opens the PO named by the notification', () => {
    expect(targetFromNotification(n({ data: { view: 'workspace', po_basic_sno: 40 } })))
      .toEqual({ view: 'workspace', rfq_supplier_sno: undefined, po_basic_sno: 40 });
  });

  it('opens the notes and payments lists', () => {
    expect(targetFromNotification(n({ data: { view: 'debit-notes' } }))?.view).toBe('debit-notes');
    expect(targetFromNotification(n({ data: { view: 'payments' } }))?.view).toBe('payments');
  });

  it('opens My KYC for a KYC change decision (approved / rejected)', () => {
    expect(targetFromNotification(n({ data: { view: 'kyc', kyc_modified_sno: 5, status: 'R' } })))
      .toEqual({ view: 'kyc', rfq_supplier_sno: undefined, po_basic_sno: undefined });
  });

  it('accepts ids that arrived as numeric strings, rejects junk ids', () => {
    expect(targetFromNotification(n({ data: { view: 'workspace', po_basic_sno: '41' } }))?.po_basic_sno).toBe(41);
    expect(targetFromNotification(n({ data: { view: 'workspace', po_basic_sno: 'abc' } }))?.po_basic_sno).toBeUndefined();
    expect(targetFromNotification(n({ data: { view: 'workspace', po_basic_sno: -3 } }))?.po_basic_sno).toBeUndefined();
    expect(targetFromNotification(n({ data: { view: 'workspace', po_basic_sno: 1.5 } }))?.po_basic_sno).toBeUndefined();
  });

  it('is informational (null) without a known view - an unknown view is never trusted', () => {
    expect(targetFromNotification(n())).toBeNull();
    expect(targetFromNotification(n({ data: {} }))).toBeNull();
    expect(targetFromNotification(n({ data: { view: 'admin-panel' } }))).toBeNull();
    expect(targetFromNotification(n({ data: { view: 42 } }))).toBeNull();
  });
});

describe('newlyArrived', () => {
  it('returns only unread notifications that were not seen before', () => {
    const known = new Set(['a']);
    const got = newlyArrived([n({ id: 'a' }), n({ id: 'b' }), n({ id: 'c', read: true })], known);
    expect(got.map((x) => x.id)).toEqual(['b']);
  });

  it('returns nothing when everything is already known', () => {
    expect(newlyArrived([n({ id: 'a' })], new Set(['a']))).toEqual([]);
  });
});
