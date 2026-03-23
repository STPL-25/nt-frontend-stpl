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

export function PageHeader({
  icon: Icon,
  title,
  description,
  stats,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("bg-primary text-primary-foreground px-4 sm:px-6 lg:px-8 py-6 shadow-sm", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-foreground/15 rounded-xl">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-primary-foreground/70 text-sm mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(({ label, value, icon: StatIcon, colorClass }) => (
              <div
                key={label}
                className={cn(
                  "bg-primary-foreground/10 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 border border-primary-foreground/10",
                  colorClass
                )}
              >
                <StatIcon className="h-5 w-5 text-primary-foreground/80 flex-shrink-0" />
                <div>
                  <div className="text-xl font-bold leading-none">{value}</div>
                  <div className="text-xs text-primary-foreground/70 mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>

      {onSearchChange && (
        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/50" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-primary-foreground/10 border border-primary-foreground/20 rounded-xl text-primary-foreground placeholder-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30 focus:bg-primary-foreground/15 transition-all text-sm"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/50 hover:text-primary-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
