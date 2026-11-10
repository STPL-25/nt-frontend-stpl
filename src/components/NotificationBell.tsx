import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Bell, BellOff, Check, CheckCheck, Trash2, X, Info, AlertTriangle, CheckCircle, XCircle,
  FileText, ShieldCheck, Route, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { timeAgo, formatDateTime } from "@/lib/formatDate";
import { extractPrNo, groupByDay, type AppNotification, type NotificationType } from "@/lib/notifications";
import { requestPrTracking } from "@/lib/prTrackLink";
import { useOpenScreen } from "@/hooks/useOpenScreen";
import { useAppState } from "@/globalState/hooks/useAppState";
import axios from "axios";
import { toast } from "sonner";
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiRemoveNotification,
  apiClearReadNotifications,
} from "@/Services/Api";
import { SOCKET_NOTIFICATION_NEW } from "@/Services/Socket";
import { SpaceLogoLoader } from "@/CustomComponent/LoadingComponents/Loading";

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  info:     { icon: <Info className="h-4 w-4" />,          color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/30",     label: "Info" },
  success:  { icon: <CheckCircle className="h-4 w-4" />,   color: "text-green-500",  bg: "bg-green-50 dark:bg-green-950/30",   label: "Success" },
  warning:  { icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/30",   label: "Reminder" },
  error:    { icon: <XCircle className="h-4 w-4" />,       color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/30",       label: "Alert" },
  pr:       { icon: <FileText className="h-4 w-4" />,      color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30", label: "Requisition" },
  approval: { icon: <ShieldCheck className="h-4 w-4" />,   color: "text-teal-500",   bg: "bg-teal-50 dark:bg-teal-950/30",     label: "Approval" },
};

type Filter = "all" | "unread" | "viewed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",    label: "All" },
  { value: "unread", label: "Unread" },
  { value: "viewed", label: "Viewed" },
];

const EMPTY_TEXT: Record<Filter, string> = {
  all:    "No notifications yet",
  unread: "No unread notifications",
  viewed: "No viewed notifications",
};

interface ItemProps {
  n: AppNotification;
  onView: (id: string) => void;
  onRemove: (id: string) => void;
  onTrack: (prNo: string) => void;
  /** Open the screen this notification is about (data.screen). */
  onOpen: (screen: string) => void;
}

const NotificationItem: React.FC<ItemProps> = ({ n, onView, onRemove, onTrack, onOpen }) => {
  const screenComp = typeof n.data?.screen === "string" ? n.data.screen : null;
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
  const prNo = extractPrNo(n);
  // Service PO past its PO date and still not raised: shown in red with how many days late.
  const overdue = n.data?.severity === "overdue";
  const daysLate = typeof n.data?.days_late === "number" ? n.data.days_late : null;

  return (
    <li
      data-testid="notification-item"
      data-read={String(n.read)}
      // Clicking an unread message marks it viewed straight away (opening the drawer does it after a
      // moment anyway). A notification that belongs to a screen also takes the user there.
      onClick={() => { if (!n.read) onView(n.id); if (screenComp) onOpen(screenComp); }}
      className={cn(
        "group relative mx-3 mb-2 flex gap-3 overflow-hidden rounded-2xl border p-3.5 shadow-sm transition-all duration-200",
        n.read
          ? "border-border/60 bg-card/70 hover:-translate-y-px hover:border-primary/20 hover:shadow-md"
          : "cursor-pointer border-primary/25 bg-gradient-to-br from-primary/[0.11] via-card to-card shadow-primary/5 hover:-translate-y-px hover:border-primary/40 hover:shadow-md",
        screenComp && "cursor-pointer",
        overdue && "border-red-300 border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 via-card to-card hover:border-red-400 dark:border-red-900 dark:border-l-red-500 dark:from-red-950/35",
        n.isNew && "ring-1 ring-inset ring-primary/40"
      )}
    >
      {!n.read && !overdue && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
      <span
        className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5", cfg.bg, cfg.color)}
        aria-hidden
      >
        {cfg.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              n.read ? "font-medium" : "font-semibold text-foreground",
              overdue && "font-semibold text-red-600 dark:text-red-400"
            )}
          >
            {n.title}
          </p>
          {!n.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" title="Unread" aria-label="Unread" />
          )}
        </div>

        {n.message && (
          <p
            className={cn(
              "mt-0.5 whitespace-pre-line break-words text-xs leading-relaxed",
              overdue ? "text-red-600/90 dark:text-red-300" : "text-muted-foreground"
            )}
          >
            {n.message}
          </p>
        )}

        {overdue && daysLate !== null && (
          <span
            data-testid="overdue-badge"
            className="mt-1.5 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white"
          >
            {daysLate} {daysLate === 1 ? "day" : "days"} late
          </span>
        )}

        <p className="mt-1 text-[11px] text-muted-foreground/80" title={formatDateTime(n.createdAt) ?? undefined}>
          {timeAgo(n.createdAt)} · {cfg.label}
          {n.isNew && <span className="ml-1.5 font-semibold text-primary">New</span>}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {screenComp && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-[11px] shadow-sm"
              onClick={() => onOpen(screenComp)}
              data-testid="open-screen"
            >
              <ExternalLink className="h-3 w-3" /> Open
            </Button>
          )}
          {prNo && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-[11px] shadow-sm"
              onClick={() => onTrack(prNo)}
              title={`Track ${prNo}`}
            >
              <Route className="h-3 w-3" /> Track {prNo}
            </Button>
          )}
          {!n.read && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={() => onView(n.id)}
              title="Mark as viewed"
            >
              <Check className="h-3 w-3" /> Mark viewed
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground opacity-70 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={() => onRemove(n.id)}
            title="Remove"
            aria-label={`Remove notification: ${n.title}`}
          >
            <X className="h-3 w-3" /> Remove
          </Button>
        </div>
      </div>
    </li>
  );
};

interface SocketLike {
  on: (event: string, handler: (n: AppNotification) => void) => void;
  off: (event: string, handler: (n: AppNotification) => void) => void;
}

const NotificationBell: React.FC = () => {
  const { socket } = useAppState() as unknown as { socket?: SocketLike };
  const openScreen = useOpenScreen();

  const [open, setOpen]       = useState(false);
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  // The socket handler needs to know whether the drawer is open without re-subscribing.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  const notifsRef = useRef<AppNotification[]>([]);
  useEffect(() => { notifsRef.current = notifs; }, [notifs]);

  const viewTried = useRef<Set<string>>(new Set());
  useEffect(() => { if (!open) viewTried.current.clear(); }, [open]);

  const unread = notifs.filter((n) => !n.read).length;
  const viewed = notifs.length - unread;

  // Load once on mount so the badge is right before the drawer is ever opened.
  useEffect(() => {
    let cancelled = false;
    axios
      .get(apiGetNotifications)
      .then(({ data }) => { if (!cancelled && data.success) setNotifs(data.data); })
      .catch(() => { /* silent — the bell must never break the header */ });
    return () => { cancelled = true; };
  }, []);

  // Opening re-fetches (anything missed while the socket was down shows up); closing drops the
  // "New" highlights and any half-confirmed "clear all".
  const handleOpenChange = useCallback(async (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmClear(false);
      setNotifs((prev) => (prev.some((n) => n.isNew) ? prev.map((n) => ({ ...n, isNew: false })) : prev));
      return;
    }
    const showSpinner = notifsRef.current.length === 0;
    try {
      if (showSpinner) setLoading(true);
      const { data } = await axios.get(apiGetNotifications);
      if (data.success) setNotifs(data.data);
    } catch {
      /* silent */
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Seeing is viewing: whatever is unread while the drawer is open counts as viewed after a short
  // dwell — no click needed. They keep the "New" highlight until the drawer closes so the user can still
  // tell which ones just arrived. A failed save puts them back so the badge stays truthful.
  useEffect(() => {
    if (!open || loading) return;
    const unreadIds = notifs.filter((n) => !n.read && !viewTried.current.has(n.id)).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const t = setTimeout(async () => {
      const ids = new Set(unreadIds);
      unreadIds.forEach((id) => viewTried.current.add(id)); // one attempt per opening — no retry loop if the save keeps failing
      setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: true, isNew: true } : n)));
      try {
        await axios.patch(apiMarkAllNotificationsRead);
      } catch {
        setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: false } : n)));
      }
    }, 800);
    return () => clearTimeout(t);
  }, [open, loading, notifs]);

  // Auto-cancel the "really clear everything?" confirmation.
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  // Real-time: new notifications arrive over Socket.IO.
  useEffect(() => {
    if (!socket) return;
    const handler = (notif: AppNotification) => {
      setNotifs((prev) =>
        prev.some((n) => n.id === notif.id) ? prev : [{ ...notif, isNew: openRef.current }, ...prev]
      );
      // With the drawer open the new item appears in front of the user; otherwise pop a toast.
      if (!openRef.current) {
        const show = notif.data?.severity === "overdue" ? toast.error : toast;
        show(notif.title, { description: notif.message, icon: TYPE_CONFIG[notif.type]?.icon });
      }
    };
    socket.on(SOCKET_NOTIFICATION_NEW, handler);
    return () => socket.off(SOCKET_NOTIFICATION_NEW, handler);
  }, [socket]);

  const markOne = async (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await axios.patch(apiMarkNotificationRead(id));
    } catch {
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  };

  const markAll = async () => {
    const before = notifs;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await axios.patch(apiMarkAllNotificationsRead);
    } catch (err) {
      setNotifs(before);
      toast.error(getErrorMessage(err, "Could not mark notifications as read"));
    }
  };

  const removeOne = async (id: string) => {
    const before = notifs;
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    try {
      await axios.delete(apiRemoveNotification(id));
    } catch (err) {
      // 404 = already gone (removed in another tab) — the list is right as it is.
      if ((err as { response?: { status?: number } })?.response?.status === 404) return;
      setNotifs(before);
      toast.error(getErrorMessage(err, "Could not remove the notification"));
    }
  };

  const removeViewed = async () => {
    const before = notifs;
    setNotifs((prev) => prev.filter((n) => !n.read));
    try {
      await axios.delete(apiClearReadNotifications);
    } catch (err) {
      setNotifs(before);
      toast.error(getErrorMessage(err, "Could not remove viewed notifications"));
    }
  };

  const clearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    const before = notifs;
    setConfirmClear(false);
    setNotifs([]);
    try {
      await axios.delete(apiGetNotifications);
    } catch (err) {
      setNotifs(before);
      toast.error(getErrorMessage(err, "Could not clear notifications"));
    }
  };

  const trackPr = (prNo: string) => {
    requestPrTracking(prNo);
    if (openScreen("PRTrackingPage")) {
      handleOpenChange(false);
    } else {
      toast.info("PR Tracking isn't enabled for your account — ask an administrator to grant it.");
    }
  };

  const openNotificationScreen = (screen: string) => {
    if (openScreen(screen)) {
      handleOpenChange(false);
    } else {
      toast.info("That screen isn't enabled for your account — ask an administrator to grant it.");
    }
  };

  const visible = useMemo(
    () => notifs.filter((n) => (filter === "unread" ? !n.read : filter === "viewed" ? n.read : true)),
    [notifs, filter]
  );
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const counts: Record<Filter, number> = { all: notifs.length, unread, viewed };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative h-9 w-9 rounded-xl transition-all", unread > 0 && "bg-primary/10 text-primary hover:bg-primary/15")}
        onClick={() => handleOpenChange(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        data-testid="notification-bell"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-md ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full gap-0 overflow-hidden border-l border-primary/15 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-[460px]" data-testid="notification-drawer">
          <SheetHeader className="relative gap-4 overflow-hidden border-b border-primary/15 bg-gradient-to-br from-primary/[0.14] via-background to-primary/[0.04] px-5 pb-4 pt-5 pr-14">
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/20">
                <Bell className="h-5 w-5" />
              </span>
              <div className="min-w-0 text-left">
                <SheetTitle className="text-lg tracking-tight">Notifications</SheetTitle>
                <SheetDescription className="mt-0.5 text-xs">Updates from across your workspace</SheetDescription>
              </div>
              {unread > 0 && (
                <Badge className="ml-auto h-6 rounded-full px-2 text-[10px] shadow-sm">
                  {unread} new
                </Badge>
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
              {notifs.length > 0 && (
                <Button
                  variant={confirmClear ? "destructive" : "ghost"}
                  size="sm"
                  className={cn("ml-auto h-7 gap-1 px-2 text-[11px]", !confirmClear && "text-muted-foreground hover:text-destructive")}
                  onClick={clearAll}
                  title="Clear all"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {confirmClear ? "Click again to clear all" : "Clear all"}
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-1.5 border-b bg-muted/30 px-4 py-2.5" role="tablist" aria-label="Filter notifications">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-all",
                  filter === f.value
                    ? "bg-background text-primary shadow-sm ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                {f.label}
                <span className={cn("ml-1.5 tabular-nums", filter === f.value ? "opacity-80" : "opacity-60")}>
                  {counts[f.value]}
                </span>
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
                <p className="text-sm font-semibold text-foreground">{EMPTY_TEXT[filter]}</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">You’re up to date. New activity will appear here automatically.</p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.label}>
                  <h4 className="sticky top-0 z-10 bg-background/85 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-xl">
                    <span className="rounded-full bg-muted px-2.5 py-1">{group.label}</span>
                  </h4>
                  <ul className="pb-1">
                    {group.items.map((n) => (
                      <NotificationItem key={n.id} n={n} onView={markOne} onRemove={removeOne} onTrack={trackPr} onOpen={openNotificationScreen} />
                    ))}
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

export default NotificationBell;
