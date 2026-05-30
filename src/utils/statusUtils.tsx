import React from "react";
import { Badge } from "@/components/ui/badge";

export interface StatusInfo {
  label: string;
  cls: string;
}

export const STATUS_MAP: Record<string, StatusInfo> = {
  Y: { label: "Active",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" },
  N: { label: "Inactive", cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700" },
  P: { label: "Pending",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800" },
  A: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" },
  R: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800" },
  D: { label: "Draft",    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800" },
};

export function getStatusInfo(status: string | undefined): StatusInfo {
  const key = String(status ?? "P").toUpperCase();
  return STATUS_MAP[key] ?? { label: key, cls: "" };
}

interface StatusBadgeProps {
  status: string | undefined;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, cls } = getStatusInfo(status);
  return (
    <Badge variant="outline" className={`text-xs border ${cls} ${className ?? ""}`}>
      {label}
    </Badge>
  );
}
