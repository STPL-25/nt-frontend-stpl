import React from "react";
import { Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: number | string;
  icon: LucideIcon;
  colorClass?: string;
}

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  stats?: StatItem[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ icon: Icon, title, description, stats, searchValue,
  onSearchChange, searchPlaceholder = "Search...", className, children }: PageHeaderProps) {
  return (
    <section className={cn(
      "relative isolate mx-2 my-2 shrink-0 overflow-hidden rounded-2xl border border-primary/15 bg-card/95 px-4 py-4 text-foreground shadow-[0_18px_45px_-35px_color-mix(in_oklab,var(--primary)_65%,transparent)] backdrop-blur sm:mx-3 sm:my-3 sm:px-6 sm:py-5 lg:mx-5 lg:my-4 lg:px-7",
      className
    )}>
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 -z-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-28 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12 text-primary shadow-sm ring-4 ring-primary/[0.05] sm:h-12 sm:w-12">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">{title}</h1>
            {description && <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>}
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
            {stats.map(({ label, value, icon: StatIcon, colorClass }) => (
              <div key={label} className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-xl border border-primary/10 bg-background/80 px-3 py-2 shadow-sm",
                colorClass
              )}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <StatIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold leading-none sm:text-base">{value}</div>
                  <div className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>

      {onSearchChange && (
        <div className="relative mt-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" placeholder={searchPlaceholder} value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-primary/15 bg-background/85 pl-9 pr-10 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary/35 focus:ring-4 focus:ring-primary/10" />
          {searchValue && <button type="button" aria-label="Clear search" onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary">
            <X className="h-4 w-4" />
          </button>}
        </div>
      )}
    </section>
  );
}
