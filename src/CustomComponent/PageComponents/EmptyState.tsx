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

/**
 * Themed empty placeholder. Every tint derives from --primary / --card, so it
 * follows the selected colour theme and light/dark background automatically.
 */
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
        "relative isolate overflow-hidden flex flex-col items-center justify-center py-14 px-6 text-center rounded-xl border border-dashed border-primary/25 bg-gradient-to-b from-primary/[0.06] via-card to-card",
        className
      )}
    >
      {/* soft decorative blobs */}
      <span aria-hidden className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mb-5">
        <span aria-hidden className="absolute inset-0 -m-3 rounded-full bg-primary/10 animate-pulse" />
        <span aria-hidden className="absolute inset-0 -m-6 rounded-full border border-primary/15" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20 shadow-sm">
          <Icon className="h-8 w-8" strokeWidth={1.6} />
        </div>
      </div>

      <p className="text-base font-semibold text-foreground">{message}</p>
      {description && (
        <p className="text-muted-foreground text-sm mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
