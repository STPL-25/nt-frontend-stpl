import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  message,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border bg-card",
        className
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <p className="text-foreground/60 text-sm font-medium">{message}</p>
      {description && (
        <p className="text-muted-foreground text-xs mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
