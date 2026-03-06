import React, { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, XCircle, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAppState } from "@/globalState/hooks/useAppState";
import axios from "axios";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error" | "pr" | "approval";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

const TYPE_CONFIG = {
  info:     { icon: <Info className="h-4 w-4" />,         color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/30"   },
  success:  { icon: <CheckCircle className="h-4 w-4" />,  color: "text-green-500",  bg: "bg-green-50 dark:bg-green-950/30" },
  warning:  { icon: <AlertTriangle className="h-4 w-4" />,color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/30" },
  error:    { icon: <XCircle className="h-4 w-4" />,      color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/30"     },
  pr:       { icon: <FileText className="h-4 w-4" />,     color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
  approval: { icon: <ShieldCheck className="h-4 w-4" />,  color: "text-teal-500",   bg: "bg-teal-50 dark:bg-teal-950/30"   },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const NotificationBell: React.FC = () => {
  const { socket, userData } = useAppState() as any;
  const [open, setOpen]       = useState(false);
  const [notifs, setNotifs]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unread = notifs.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/api/notifications`);
      if (data.success) setNotifs(data.data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Real-time: listen for new notifications via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = (notif: Notification) => {
      setNotifs((prev) => [notif, ...prev]);
      toast(notif.title, {
        description: notif.message,
        icon: TYPE_CONFIG[notif.type]?.icon,
      });
    };
    socket.on("notification:new", handler);
    return () => socket.off("notification:new", handler);
  }, [socket]);

  const markOne = async (id: string) => {
    try {
      await axios.patch(`${API}/api/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* silent */ }
  };

  const markAll = async () => {
    try {
      await axios.patch(`${API}/api/notifications/read-all`);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* silent */ }
  };

  const clearAll = async () => {
    try {
      await axios.delete(`${API}/api/notifications`);
      setNotifs([]);
    } catch { /* silent */ }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unread > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unread} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={markAll}
                title="Mark all as read"
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                All read
              </Button>
            )}
            {notifs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[420px]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Bell className="h-10 w-10 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifs.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    {/* Icon */}
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        cfg.bg, cfg.color
                      )}
                    >
                      {cfg.icon}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium leading-tight", !n.read && "text-foreground")}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot / mark read btn */}
                    <div className="flex flex-col items-end gap-1.5 pt-0.5 shrink-0">
                      {!n.read ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <button
                            onClick={() => markOne(n.id)}
                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            title="Mark as read"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifs.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2 text-center">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
