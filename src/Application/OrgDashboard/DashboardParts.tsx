import type { ReactNode } from "react";
import { Radio, RefreshCw, Shield, ShieldCheck, WifiOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { agoLabel, secondsAgo } from "./orgDashboardModel";
import { useCountUp, useNow } from "./dashboardHooks";
import type { LiveEvent } from "./useOrgDashboard";

// ── live status ────────────────────────────────────────────────────────────────────────────────
export function LiveStatus({ connected, refreshing, lastFetchedAt, lastEvent, error, onRefresh }: {
  connected: boolean; refreshing: boolean; lastFetchedAt: number | null; lastEvent: LiveEvent | null; error: string | null; onRefresh: () => void;
}) {
  const now = useNow(5000);
  const ago = agoLabel(secondsAgo(lastFetchedAt, now));
  const recentEvent = lastEvent && now - lastEvent.at < 30_000 ? lastEvent : null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
          connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        )}
        title={connected ? "Connected - changes appear here as they happen" : "Not connected - refreshing every minute until the connection returns"}
      >
        {connected ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="org-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Live
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Reconnecting…
          </>
        )}
      </span>

      <span className="text-xs text-muted-foreground">
        {error ? <span className="text-amber-700 dark:text-amber-300">Could not refresh · showing the last data</span> : <>Updated {ago}</>}
      </span>

      {recentEvent && (
        <span key={recentEvent.at} className="org-rise inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <span className="truncate">{recentEvent.label}</span>
        </span>
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh now"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/15 bg-background/80 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
      </button>
    </div>
  );
}

// ── stat tile ──────────────────────────────────────────────────────────────────────────────────
export function StatTile({ label, value, icon: Icon, sub, ratio, ratioLabel, flash, delay = 0, className }: {
  label: string; value: number; icon: LucideIcon; sub: ReactNode; ratio?: number; ratioLabel?: string; flash?: boolean; delay?: number; className?: string;
}) {
  const shown = useCountUp(value);
  const pct = ratio == null ? null : Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className={cn("org-rise", className)} style={{ animationDelay: `${delay}ms` }}>
      <div
        className={cn(
          "group relative h-full overflow-hidden rounded-2xl border border-primary/10 bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
          flash && "org-flash"
        )}
      >
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </span>
        </div>
        <div className="relative mt-2 text-3xl font-bold leading-none tracking-tight tabular-nums sm:text-[2rem]">{shown.toLocaleString()}</div>
        <p className="relative mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>
        {pct != null && (
          <div
            className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/10"
            role="img"
            aria-label={`${ratioLabel ?? "Share"}: ${pct}%`}
          >
            <div className="org-grow h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── people bits ────────────────────────────────────────────────────────────────────────────────
export function Initials({ text, className }: { text: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20", className)}
    >
      {text}
    </span>
  );
}

/** Full = the whole node is covered by one of the person's grants; Partial = they reach only a part of it. Icon + word, never colour alone. */
export function AccessBadge({ full, className }: { full: boolean; className?: string }) {
  return full ? (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground", className)}>
      <ShieldCheck className="h-3 w-3" aria-hidden /> Full
    </span>
  ) : (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary", className)}>
      <Shield className="h-3 w-3" aria-hidden /> Partial
    </span>
  );
}

/** "Space Textiles › Retail Division › KTM Branch" - one grant, outermost first; the last link is emphasised. */
export function GrantPath({ path, muted }: { path: string[]; muted?: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 text-xs", muted && "opacity-60")}>
      {path.map((name, i) => (
        <span key={`${name}-${i}`} className="inline-flex min-w-0 items-center gap-1">
          {i > 0 && <span aria-hidden className="text-muted-foreground">›</span>}
          <span className={cn("truncate rounded-md px-1.5 py-0.5", i === path.length - 1 ? "bg-primary/10 font-semibold text-primary" : "bg-muted text-muted-foreground")}>{name}</span>
        </span>
      ))}
    </span>
  );
}

export function Panel({ title, subtitle, icon: Icon, actions, children, className, bodyClassName }: {
  title: string; subtitle?: ReactNode; icon?: LucideIcon; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm", className)}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
