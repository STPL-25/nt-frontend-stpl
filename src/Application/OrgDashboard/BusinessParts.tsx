import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { share } from "./businessModel";
import { BIZ_TONE, type BizTone } from "./bizTone";

/** Small status pill: coloured dot + word. */
export function Pill({ tone = "slate", children, className, title }: { tone?: BizTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", BIZ_TONE[tone].chip, className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", BIZ_TONE[tone].dot)} />
      {children}
    </span>
  );
}

/** A group of cards: icon + title + one line saying what the numbers mean. */
export function SectionHeader({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-sm"><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-tight tracking-tight sm:text-lg">{title}</h2>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * One headline number. `value` is already formatted; `full` is the exact figure for the tooltip. When `onOpen` is given the whole
 * card is a button that jumps to the matching detail table.
 */
export function KpiCard({ label, value, full, icon: Icon, tone, sub, foot, ratio, ratioLabel, flash, delay = 0, onOpen, openLabel, className }: {
  label: string; value: string; full?: string; icon: LucideIcon; tone: BizTone; sub?: ReactNode; foot?: ReactNode;
  ratio?: number; ratioLabel?: string; flash?: boolean; delay?: number; onOpen?: () => void; openLabel?: string; className?: string;
}) {
  const T = BIZ_TONE[tone];
  const pctValue = ratio == null ? null : Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1", T.icon, T.ring)}><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden /></span>
      </div>
      <div className="mt-2 truncate text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-[1.75rem]" title={full ?? value}>{value}</div>
      {sub && <div className="mt-1.5 text-xs leading-snug text-muted-foreground">{sub}</div>}
      {pctValue != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${ratioLabel ?? "Share"}: ${pctValue}%`}>
          <div className={cn("org-grow h-full rounded-full", T.bar)} style={{ width: `${pctValue}%` }} />
        </div>
      )}
      {foot && <div className="mt-2 text-[11px] leading-snug text-muted-foreground">{foot}</div>}
      {onOpen && (
        <span className="absolute bottom-3 right-3 flex h-7 w-7 translate-y-1 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-all duration-200 group-hover:translate-y-0 group-hover:text-primary group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </>
  );
  const shell = cn(
    "group relative block h-full w-full overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-4 text-left shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)] transition duration-200 before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent",
    onOpen && "cursor-pointer hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_18px_45px_-28px_color-mix(in_oklab,var(--primary)_50%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    flash && "org-flash"
  );
  return (
    <div className={cn("org-rise min-w-0", className)} style={{ animationDelay: `${delay}ms` }}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={shell} aria-label={`${label}: ${full ?? value}. ${openLabel ?? "Show details"}`}>{body}</button>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </div>
  );
}

/**
 * Two (or more) parts of one whole as a single bar, with the numbers written underneath - so the split is readable without colour.
 */
export function SplitBar({ title, parts, format }: {
  title: string; parts: { label: string; value: number; tone: BizTone }[]; format: (v: number) => string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/80">{title}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{format(total)}</span>
      </div>
      <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${title}: ${parts.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}>
        {total > 0 && parts.map((p) => p.value > 0 && (
          <div key={p.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", BIZ_TONE[p.tone].bar)} style={{ width: `${share(p.value, total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-xs">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", BIZ_TONE[p.tone].dot)} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-semibold tabular-nums">{format(p.value)}</span>
            <span className="tabular-nums text-muted-foreground">({Math.round(share(p.value, total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Segmented filter buttons (single choice). */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number; icon?: LucideIcon }[]; label: string;
}) {
  const compact = options.length <= 2;

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "max-w-full gap-1 rounded-xl border border-border/70 bg-muted/80 p-1 shadow-inner",
        compact ? "grid w-full grid-cols-2 sm:inline-grid sm:w-auto" : "scrollbar-none flex w-full overflow-x-auto sm:w-auto"
      )}
    >
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
              !compact && "shrink-0",
              value === o.value ? "bg-background text-foreground shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{o.label}</span>
            {o.count != null && <span className="tabular-nums text-muted-foreground">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyRows({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon className="h-5 w-5" aria-hidden /></span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
