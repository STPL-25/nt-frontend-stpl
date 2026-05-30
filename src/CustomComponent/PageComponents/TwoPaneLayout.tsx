import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PageHeader, type StatItem } from "./PageHeader";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TwoPaneLayoutProps {
  /** PageHeader props */
  icon: LucideIcon;
  title: string;
  description?: string;
  stats?: StatItem[];
  headerChildren?: React.ReactNode;

  /** Sidebar */
  sidebar: React.ReactNode;
  sidebarWidth?: string;

  /** Mobile sidebar sheet */
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;

  /** Main panel */
  children: React.ReactNode;

  className?: string;
}

/**
 * Responsive two-pane layout used by all list/detail screens.
 *
 * Desktop: fixed-width sidebar + scrollable main panel, side by side.
 * Mobile:  main panel fills the screen; sidebar slides in as a Sheet.
 */
export function TwoPaneLayout({
  icon,
  title,
  description,
  stats,
  headerChildren,
  sidebar,
  sidebarWidth = "w-80",
  sidebarOpen,
  onSidebarOpenChange,
  children,
  className,
}: TwoPaneLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full min-h-screen bg-muted/20", className)}>
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        stats={stats}
      >
        {headerChildren}
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col flex-shrink-0 border-r border-border bg-card overflow-hidden",
            sidebarWidth
          )}
        >
          {sidebar}
        </aside>

        {/* Mobile sidebar sheet */}
        <Sheet open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
          <SheetContent side="left" className="p-0 w-80 sm:w-96">
            {sidebar}
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
