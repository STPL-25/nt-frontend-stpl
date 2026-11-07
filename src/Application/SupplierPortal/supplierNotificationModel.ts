import type { AppNotification } from '@/lib/notifications';

/** The portal screens a notification can open (the `data.view` the producers set). */
export type SupplierNotificationView = 'rfq-entry' | 'workspace' | 'debit-notes' | 'payments' | 'kyc';

export interface SupplierNotificationTarget {
  view: SupplierNotificationView;
  rfq_supplier_sno?: number;
  po_basic_sno?: number;
}

const VIEWS: readonly SupplierNotificationView[] = ['rfq-entry', 'workspace', 'debit-notes', 'payments', 'kyc'];

const positiveInt = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * Where a notification should take the supplier, or null when it is informational only.
 * `data` is whatever a producer stored, so every field is validated: an unknown `view` is ignored
 * rather than trusted.
 */
export function targetFromNotification(n: Pick<AppNotification, 'data'>): SupplierNotificationTarget | null {
  const view = n.data?.view;
  if (typeof view !== 'string' || !VIEWS.includes(view as SupplierNotificationView)) return null;
  return {
    view: view as SupplierNotificationView,
    rfq_supplier_sno: positiveInt(n.data?.rfq_supplier_sno),
    po_basic_sno: positiveInt(n.data?.po_basic_sno),
  };
}

/** Ids in `incoming` that are unread and were not in `known` - what just arrived since the last poll. */
export function newlyArrived(incoming: AppNotification[], known: ReadonlySet<string>): AppNotification[] {
  return incoming.filter((n) => !n.read && !known.has(n.id));
}
