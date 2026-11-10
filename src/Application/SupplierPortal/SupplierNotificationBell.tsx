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
import { SpaceLogoLoader } from '@/CustomComponent/LoadingComponents/Loading';

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
        className={cn('relative h-9 w-9 rounded-xl transition-all', unread > 0 && 'bg-primary/10 text-primary hover:bg-primary/15')}
        onClick={() => handleOpenChange(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        data-testid="supplier-notification-bell"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-md ring-2 ring-background">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full gap-0 overflow-hidden border-l border-primary/15 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-[460px]" data-testid="supplier-notification-drawer">
          <SheetHeader className="relative gap-4 overflow-hidden border-b border-primary/15 bg-gradient-to-br from-primary/[0.14] via-background to-primary/[0.04] px-5 pb-4 pt-5 pr-14">
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/20">
                <Bell className="h-5 w-5" />
              </span>
              <div className="min-w-0 text-left">
                <SheetTitle className="text-lg tracking-tight">Notifications</SheetTitle>
                <SheetDescription className="mt-0.5 text-xs">Supplier workspace updates</SheetDescription>
              </div>
              {unread > 0 && (
                <Badge className="ml-auto h-6 rounded-full px-2 text-[10px] shadow-sm">{unread} new</Badge>
              )}
            </div>

            <div className="relative grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-primary/15 bg-background/70 px-3 py-2 text-left shadow-sm backdrop-blur">
                <p className="text-lg font-bold leading-none tabular-nums text-primary">{unread}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Unread</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-left shadow-sm backdrop-blur">
                <p className="text-lg font-bold leading-none tabular-nums text-foreground">{notifs.length}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total updates</p>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-1.5">
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

          <div className="grid grid-cols-2 gap-1.5 border-b bg-muted/30 px-4 py-2.5" role="tablist" aria-label="Filter notifications">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-all',
                  filter === f.value
                    ? 'bg-background text-primary shadow-sm ring-1 ring-primary/15'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                {f.label}
                <span className={cn('ml-1.5 tabular-nums', filter === f.value ? 'opacity-80' : 'opacity-60')}>{counts[f.value]}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15">
            {loading ? (
              <SpaceLogoLoader size="md" text="Loading notifications…" className="py-20" />
            ) : visible.length === 0 ? (
              <div className="m-5 flex flex-col items-center rounded-3xl border border-dashed border-primary/20 bg-gradient-to-b from-primary/[0.07] to-card px-6 py-16 text-center shadow-sm">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <BellOff className="h-7 w-7" />
                </span>
                <p className="text-sm font-semibold text-foreground">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Quotation, order and payment updates will appear here automatically.</p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.label}>
                  <h4 className="sticky top-0 z-10 bg-background/85 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-xl">
                    <span className="rounded-full bg-muted px-2.5 py-1">{group.label}</span>
                  </h4>
                  <ul className="pb-1">
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
                            'group relative mx-3 mb-2 flex gap-3 overflow-hidden rounded-2xl border p-3.5 shadow-sm transition-all duration-200',
                            n.read
                              ? 'border-border/60 bg-card/70 hover:-translate-y-px hover:border-primary/20 hover:shadow-md'
                              : 'cursor-pointer border-primary/25 bg-gradient-to-br from-primary/[0.11] via-card to-card shadow-primary/5 hover:-translate-y-px hover:border-primary/40 hover:shadow-md',
                            target && 'cursor-pointer',
                            n.isNew && 'ring-1 ring-inset ring-primary/40',
                          )}
                        >
                          {!n.read && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                          <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5', cfg.bg, cfg.color)} aria-hidden>
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
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {target && (
                                <Button variant="outline" size="sm" className="h-7 gap-1 rounded-lg px-2 text-[11px] shadow-sm" onClick={() => openTarget(n)} data-testid="supplier-open-screen">
                                  <ExternalLink className="h-3 w-3" /> Open
                                </Button>
                              )}
                              {!n.read && (
                                <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => markOne(n.id)} title="Mark as viewed">
                                  <Check className="h-3 w-3" /> Mark viewed
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground opacity-70 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
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
