import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Bell, BellOff, Check, CheckCheck, X, Info, AlertTriangle, CheckCircle, XCircle, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { timeAgo, formatDateTime } from '@/lib/formatDate';
import { groupByDay, type AppNotification, type NotificationType } from '@/lib/notifications';
import {
  supplierAxios,
  supplierNotifications,
  supplierNotificationsReadAll,
  supplierNotificationsClearRead,
  supplierNotificationRead,
  supplierNotificationRemove,
} from '@/Services/SupplierService';
import {
  targetFromNotification,
  newlyArrived,
  type SupplierNotificationTarget,
} from './supplierNotificationModel';

/** The portal has no Socket.IO session, so the bell polls. 30s keeps it feeling live at a trivial request rate. */
const POLL_MS = 30_000;

const TYPE_CONFIG: Partial<Record<NotificationType, { icon: React.ReactNode; color: string; bg: string; label: string }>> = {
  info:    { icon: <Info className="h-4 w-4" />,          color: 'text-blue-500',  bg: 'bg-blue-50 dark:bg-blue-950/30',   label: 'Info' },
  success: { icon: <CheckCircle className="h-4 w-4" />,   color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30', label: 'Update' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Attention' },
  error:   { icon: <XCircle className="h-4 w-4" />,       color: 'text-red-500',   bg: 'bg-red-50 dark:bg-red-950/30',     label: 'Alert' },
};
const configFor = (type: NotificationType) => TYPE_CONFIG[type] ?? TYPE_CONFIG.info!;

type Filter = 'all' | 'unread';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

interface ListResponse { success: boolean; data: AppNotification[] }

interface Props {
  /** Open the portal screen a notification is about. */
  onOpen: (target: SupplierNotificationTarget) => void;
}

const SupplierNotificationBell: React.FC<Props> = ({ onOpen }) => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  // null until the first successful load, so existing notifications never toast on page open.
  const knownIds = useRef<Set<string> | null>(null);

  const unread = notifs.filter((n) => !n.read).length;

  const load = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const { data } = await supplierAxios.get<ListResponse>(supplierNotifications);
      if (!data.success) return;
      const incoming = data.data;

      if (knownIds.current) {
        const fresh = newlyArrived(incoming, knownIds.current);
        // With the drawer open the new item appears in front of the supplier; otherwise pop a toast.
        if (!openRef.current) {
          fresh.slice(0, 3).forEach((n) => toast(n.title, { description: n.message }));
          if (fresh.length > 3) toast(`${fresh.length - 3} more new notifications`);
        }
        setNotifs((prev) => {
          const flagged = new Set(prev.filter((p) => p.isNew).map((p) => p.id));
          fresh.forEach((n) => { if (openRef.current) flagged.add(n.id); });
          return incoming.map((n) => (flagged.has(n.id) ? { ...n, isNew: true } : n));
        });
      } else {
        setNotifs(incoming);
      }
      knownIds.current = new Set(incoming.map((n) => n.id));
    } catch {
      /* silent - the bell must never break the header (a 401 is handled by the screens' own calls) */
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Initial load, then poll while the tab is visible; catching up the moment the tab becomes visible again.
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      load(notifs.length === 0);
    } else {
      setNotifs((prev) => (prev.some((n) => n.isNew) ? prev.map((n) => ({ ...n, isNew: false })) : prev));
    }
  }, [load, notifs.length]);

  // Seeing is viewing (same as the staff bell): whatever is unread while the drawer is open counts as viewed after a
  // short dwell. They keep the "New" highlight until the drawer closes. A failed save puts them back so the badge
  // stays truthful; one attempt per opening, so a failing save never turns into a retry loop.
  const viewTried = useRef<Set<string>>(new Set());
  useEffect(() => { if (!open) viewTried.current.clear(); }, [open]);
  useEffect(() => {
    if (!open || loading) return;
    const unreadIds = notifs.filter((n) => !n.read && !viewTried.current.has(n.id)).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const t = setTimeout(async () => {
      const ids = new Set(unreadIds);
      unreadIds.forEach((id) => viewTried.current.add(id));
      setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: true, isNew: true } : n)));
      try {
        await supplierAxios.patch(supplierNotificationsReadAll);
      } catch {
        setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: false } : n)));
      }
    }, 800);
    return () => clearTimeout(t);
  }, [open, loading, notifs]);

  const markOne = async (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await supplierAxios.patch(supplierNotificationRead(id));
    } catch {
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  };

  const markAll = async () => {
    const before = notifs;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await supplierAxios.patch(supplierNotificationsReadAll);
    } catch (err) {
      setNotifs(before);
      toast.error(getErrorMessage(err, 'Could not mark notifications as read'));
    }
  };

  const removeOne = async (id: string) => {
    const before = notifs;
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    try {
      await supplierAxios.delete(supplierNotificationRemove(id));
    } catch (err) {
      // 404 = already gone (removed in another tab) - the list is right as it is.
      if ((err as { response?: { status?: number } })?.response?.status === 404) return;
      setNotifs(before);
      toast.error(getErrorMessage(err, 'Could not remove the notification'));
    }
  };

  const removeViewed = async () => {
    const before = notifs;
    setNotifs((prev) => prev.filter((n) => !n.read));
    try {
      await supplierAxios.delete(supplierNotificationsClearRead);
    } catch (err) {
      setNotifs(before);
      toast.error(getErrorMessage(err, 'Could not remove viewed notifications'));
    }
  };

  const openTarget = (n: AppNotification) => {
    const target = targetFromNotification(n);
    if (!n.read) markOne(n.id);
    if (target) {
      setOpen(false);
      onOpen(target);
    }
  };

  const visible = useMemo(() => notifs.filter((n) => (filter === 'unread' ? !n.read : true)), [notifs, filter]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const viewed = notifs.length - unread;
  const counts: Record<Filter, number> = { all: notifs.length, unread };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => handleOpenChange(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        data-testid="supplier-notification-bell"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md" data-testid="supplier-notification-drawer">
          <SheetHeader className="gap-3 border-b p-4 pr-12">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <SheetTitle className="text-base">Notifications</SheetTitle>
              {unread > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{unread} new</Badge>
              )}
            </div>
            <SheetDescription className="text-xs">
              Quotation requests, purchase orders, debit / credit notes and payments. Messages are kept for 24 hours.
            </SheetDescription>

            <div className="flex flex-wrap items-center gap-1.5">
              {unread > 0 && (
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={markAll} title="Mark all as read">
                  <CheckCheck className="h-3.5 w-3.5" /> All read
                </Button>
              )}
              {viewed > 0 && (
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={removeViewed} title="Remove viewed">
                  <X className="h-3.5 w-3.5" /> Remove viewed
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex items-center gap-1 border-b bg-muted/30 px-4 py-2" role="tablist" aria-label="Filter notifications">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {f.label}
                <span className={cn('ml-1.5 tabular-nums', filter === f.value ? 'opacity-80' : 'opacity-60')}>{counts[f.value]}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
                <BellOff className="h-10 w-10 opacity-20" />
                <p className="text-sm">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.label}>
                  <h4 className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {group.label}
                  </h4>
                  <ul>
                    {group.items.map((n) => {
                      const cfg = configFor(n.type);
                      const target = targetFromNotification(n);
                      return (
                        <li
                          key={n.id}
                          data-testid="supplier-notification-item"
                          data-read={String(n.read)}
                          onClick={() => openTarget(n)}
                          className={cn(
                            'flex gap-3 border-b px-4 py-3 transition-colors',
                            n.read ? 'bg-background' : 'cursor-pointer bg-primary/5 hover:bg-primary/10',
                            target && 'cursor-pointer',
                            n.isNew && 'ring-1 ring-inset ring-primary/40',
                          )}
                        >
                          <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', cfg.bg, cfg.color)} aria-hidden>
                            {cfg.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn('text-sm leading-snug', n.read ? 'font-medium' : 'font-semibold text-foreground')}>{n.title}</p>
                              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" title="Unread" aria-label="Unread" />}
                            </div>
                            {n.message && (
                              <p className="mt-0.5 whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">{n.message}</p>
                            )}
                            <p className="mt-1 text-[11px] text-muted-foreground/80" title={formatDateTime(n.createdAt) ?? undefined}>
                              {timeAgo(n.createdAt)} · {cfg.label}
                              {n.isNew && <span className="ml-1.5 font-semibold text-primary">New</span>}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {target && (
                                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => openTarget(n)} data-testid="supplier-open-screen">
                                  <ExternalLink className="h-3 w-3" /> Open
                                </Button>
                              )}
                              {!n.read && (
                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => markOne(n.id)} title="Mark as viewed">
                                  <Check className="h-3 w-3" /> Mark viewed
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => removeOne(n.id)}
                                title="Remove"
                                aria-label={`Remove notification: ${n.title}`}
                              >
                                <X className="h-3 w-3" /> Remove
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default SupplierNotificationBell;
