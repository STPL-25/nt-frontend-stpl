import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Centralised status styling for the whole app.
 *
 * Every status badge / chip / dot should resolve its colours through here so a
 * status (e.g. "Approved") looks identical on every screen and supports dark
 * mode out of the box. Accepts both single-letter codes (Y/N/P/A/R/D…) and full
 * words ("Pending Approval", "Active", "Cancelled"…), case-insensitively.
 */

// ── Semantic tones ────────────────────────────────────────────────────────────

type Tone = "success" | "warning" | "danger" | "info" | "purple" | "neutral";

interface ToneStyle {
  /** Badge: background + text + border, with dark-mode variants. */
  cls: string;
  /** Solid dot colour for list indicators. */
  dot: string;
}

const TONE: Record<Tone, ToneStyle> = {
  success: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  warning: {
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  danger: {
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
    dot: "bg-red-500",
  },
  info: {
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  purple: {
    cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  neutral: {
    cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

// ── Status → { label, tone } ──────────────────────────────────────────────────

interface StatusDef {
  label: string;
  tone: Tone;
}

/**
 * Keyed by the NORMALISED status (uppercased, trimmed). Both short codes and
 * full words map to the same canonical definition.
 */
const STATUS_DEFS: Record<string, StatusDef> = {
  // Active / inactive
  Y: { label: "Active", tone: "success" },
  ACTIVE: { label: "Active", tone: "success" },
  N: { label: "Inactive", tone: "neutral" },
  INACTIVE: { label: "Inactive", tone: "neutral" },

  // Pending / approval lifecycle
  P: { label: "Pending", tone: "warning" },
  PENDING: { label: "Pending", tone: "warning" },
  "PENDING APPROVAL": { label: "Pending Approval", tone: "warning" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  A: { label: "Approved", tone: "success" },
  APPROVED: { label: "Approved", tone: "success" },
  VERIFIED: { label: "Verified", tone: "success" },
  R: { label: "Rejected", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REVERSED: { label: "Reversed", tone: "danger" },

  // Document lifecycle
  D: { label: "Draft", tone: "info" },
  DRAFT: { label: "Draft", tone: "info" },
  POSTED: { label: "Posted", tone: "success" },
  SENT: { label: "Sent", tone: "info" },
  OPEN: { label: "Open", tone: "info" },
  "IN PROGRESS": { label: "In Progress", tone: "info" },
  PARTIAL: { label: "Partial", tone: "warning" },
  "PARTIALLY APPROVED": { label: "Partially Approved", tone: "warning" },
  RECEIVED: { label: "Received", tone: "purple" },
  COMPLETED: { label: "Completed", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  C: { label: "Cancelled", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  CANCELED: { label: "Cancelled", tone: "neutral" },
};

export interface StatusInfo {
  label: string;
  /** Badge classes (bg + text + border, dark-mode aware). */
  cls: string;
  /** Solid dot colour. */
  dotCls: string;
}

function normalise(status: string | number | undefined | null): string {
  return String(status ?? "").trim().toUpperCase();
}

export function getStatusInfo(status: string | number | undefined | null): StatusInfo {
  const key = normalise(status);
  const def = STATUS_DEFS[key];
  if (def) {
    const tone = TONE[def.tone];
    return { label: def.label, cls: tone.cls, dotCls: tone.dot };
  }
  // Unknown status: show the raw value with neutral styling rather than nothing.
  const fallbackLabel = key
    ? key.charAt(0) + key.slice(1).toLowerCase()
    : "—";
  return { label: fallbackLabel, cls: TONE.neutral.cls, dotCls: TONE.neutral.dot };
}

/** Back-compat: legacy map keyed by short code. Prefer getStatusInfo(). */
export const STATUS_MAP: Record<string, StatusInfo> = Object.fromEntries(
  Object.keys(STATUS_DEFS).map((k) => [k, getStatusInfo(k)])
);

// ── Components ─────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string | number | undefined | null;
  /** Show a leading coloured dot inside the badge. */
  withDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, withDot = false, className }: StatusBadgeProps) {
  const { label, cls, dotCls } = getStatusInfo(status);
  return (
    <Badge variant="outline" className={cn("text-xs border gap-1.5", cls, className)}>
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", dotCls)} />}
      {label}
    </Badge>
  );
}

interface StatusDotProps {
  status: string | number | undefined | null;
  className?: string;
}

/** Standalone coloured dot (e.g. leading a list row), no label. */
export function StatusDot({ status, className }: StatusDotProps) {
  const { dotCls } = getStatusInfo(status);
  return <span className={cn("h-2 w-2 rounded-full inline-block", dotCls, className)} />;
}
