export type NotificationType = "info" | "success" | "warning" | "error" | "pr" | "approval";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
  /** Client-only: arrived live while the drawer was open — highlighted until it is closed. */
  isNew?: boolean;
}

// PR26270003 (optionally a split suffix, PR26270003/1) and vendor-driven VPR2627-0009.
const PR_NO_RE = /\b(?:PR\d{6,}(?:\/\d+)?|VPR\d{4}-\d{3,})\b/;

/**
 * The PR a notification is about, if any. Producers that pass `data.pr_no` win; older
 * notifications were stored without their data payload (see notifications.service.js), so
 * fall back to a PR number quoted in the text — "…for PR PR26270003 has arrived…".
 */
export function extractPrNo(n: Pick<AppNotification, "data" | "title" | "message">): string | null {
  const fromData = n.data?.pr_no;
  if (typeof fromData === "string" && fromData.trim()) return fromData.trim();
  const match = `${n.title ?? ""} ${n.message ?? ""}`.match(PR_NO_RE);
  return match ? match[0] : null;
}

/** "Today" / "Yesterday" / "12 Sep 2026" — the group heading for a notification's day. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Keeps the incoming (newest-first) order; consecutive items share a heading. */
export function groupByDay<T extends { createdAt: string }>(
  items: T[],
  now: Date = new Date()
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
