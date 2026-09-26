import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Bell, BellOff, Check, CheckCheck, Trash2, X, Info, AlertTriangle, CheckCircle, XCircle,
  FileText, ShieldCheck, Route,
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
}

const NotificationItem: React.FC<ItemProps> = ({ n, onView, onRemove, onTrack }) => {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
  const prNo = extractPrNo(n);

  return (
    <li
      data-testid="notification-item"
      data-read={String(n.read)}
      // Opening (clicking) an unread message is what marks it viewed — no separate step needed.
      onClick={() => { if (!n.read) onView(n.id); }}
      className={cn(
        "flex gap-3 border-b px-4 py-3 transition-colors",
        n.read ? "bg-background" : "cursor-pointer bg-primary/5 hover:bg-primary/10",
        n.isNew && "ring-1 ring-inset ring-primary/40"
      )}
    >
      <span
        className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cfg.bg, cfg.color)}
        aria-hidden
      >
        {cfg.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", n.read ? "font-medium" : "font-semibold text-foreground")}>
            {n.title}
          </p>
          {!n.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" title="Unread" aria-label="Unread" />
          )}
        </div>

        {n.message && (
          <p className="mt-0.5 whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">
            {n.message}
          </p>
        )}

        <p className="mt-1 text-[11px] text-muted-foreground/80" title={formatDateTime(n.createdAt) ?? undefined}>
          {timeAgo(n.createdAt)} · {cfg.label}
          {n.isNew && <span className="ml-1.5 font-semibold text-primary">New</span>}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {prNo && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
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
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onView(n.id)}
              title="Mark as viewed"
            >
              <Check className="h-3 w-3" /> Mark viewed
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
        toast(notif.title, { description: notif.message, icon: TYPE_CONFIG[notif.type]?.icon });
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
        className="relative h-9 w-9"
        onClick={() => handleOpenChange(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        data-testid="notification-bell"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md" data-testid="notification-drawer">
          <SheetHeader className="gap-3 border-b p-4 pr-12">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <SheetTitle className="text-base">Notifications</SheetTitle>
              {unread > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {unread} new
                </Badge>
              )}
            </div>
            <SheetDescription className="text-xs">
              Viewed messages can be removed — they disappear from this list for good.
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

          <div className="flex items-center gap-1 border-b bg-muted/30 px-4 py-2" role="tablist" aria-label="Filter notifications">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.label}
                <span className={cn("ml-1.5 tabular-nums", filter === f.value ? "opacity-80" : "opacity-60")}>
                  {counts[f.value]}
                </span>
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
                <p className="text-sm">{EMPTY_TEXT[filter]}</p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.label}>
                  <h4 className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {group.label}
                  </h4>
                  <ul>
                    {group.items.map((n) => (
                      <NotificationItem key={n.id} n={n} onView={markOne} onRemove={removeOne} onTrack={trackPr} />
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
