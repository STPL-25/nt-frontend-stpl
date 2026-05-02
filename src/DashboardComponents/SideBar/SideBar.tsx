import React, { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppState } from "@/globalState/hooks/useAppState";
import type { IconComponent, MenuItem, Screen, HandleClickParams } from "./SideBar.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getIcon = (name: string | null): IconComponent => {
  if (!name) return LucideIcons.File as unknown as IconComponent;
  const Icon = (LucideIcons as Record<string, unknown>)[name];
  return Icon ? (Icon as IconComponent) : (LucideIcons.File as unknown as IconComponent);
};

const buildMenuItems = (screens: Screen[]): MenuItem[] =>
  screens.map((s) => ({
    id: s.screen_comp,
    key: `${s.screen_comp}`,
    label: s.screen_name,
    icon: getIcon(s.screen_img),
    screenId: s.screen_id,
    groupId: s.group_id,
  }));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Sidebar: React.FC = () => {
  const {
    sidebarOpen,
    setSidebarOpen,
    activeItem,
    setActiveItem,
    activeComponent,
    setActiveComponent,
    sidebarWidth,
    setSidebarWidth,
    isCollapsed,
    toggleCollapse,
    setHeaderComponentRender,
    userData,
    fetchSidebarData,
    data: sidebarData,
    loading,
    error,
    setActiveGroupId,
  } = useAppState() as any;

  const ecno = (Array.isArray(userData) ? userData[0]?.ecno : userData?.ecno) as string ?? "";
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [isResizing, setIsResizing] = useState(false);

  // Fetch sidebar menu when ecno becomes available (skip if already loaded)
  useEffect(() => {
    if (ecno && !sidebarData && !loading) fetchSidebarData(ecno);
  }, [ecno]);

  // Build menu items when sidebar data changes
  useEffect(() => {
    if (!sidebarData?.screens) {
      setMenu([]);
      return;
    }
    setMenu(buildMenuItems(sidebarData.screens));
  }, [sidebarData]);

  // Auto-select first item on initial load
  useEffect(() => {
    if (menu.length > 0 && (!activeComponent || activeComponent === null)) {
      const first = menu[0];
      setActiveItem?.(first.key);
      setActiveComponent?.(first.screenId);
      setHeaderComponentRender?.(first.label);
    }
  }, [menu, activeComponent, setActiveItem, setActiveComponent, setHeaderComponentRender]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMenuClick = ({ key, label, screenId, groupId }: HandleClickParams) => {
    setActiveItem?.(key);
    setActiveComponent?.(screenId);
    setHeaderComponentRender?.(label);
    setActiveGroupId?.(groupId);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen?.(false);
    }
  };

  // Resize drag
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (typeof setSidebarWidth === "function" && newWidth >= 280 && newWidth <= 450) {
        setSidebarWidth(newWidth);
      }
    };
    const onMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      {/* ── Sidebar panel ───────────────────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background/95 backdrop-blur-xl shadow-lg transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: isCollapsed ? "80px" : `${sidebarWidth}px` }}
      >
        {/* ── Brand / collapse row ────────────────────────────────────── */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-muted/40 to-transparent">
          <div className="flex items-center gap-3">
            {!isCollapsed && (
              <div className="flex items-center gap-2.5">
                {/* Brand avatar — uses primary theme color */}
                <Avatar className="h-9 w-9 rounded-lg ring-2 ring-primary/30">
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-extrabold">
                    SA
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground leading-tight">
                    Space Textiles Pvt Ltd
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium leading-tight uppercase tracking-wider">
                    ERP Console
                  </span>
                </div>
              </div>
            )}

            {/* Collapse toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCollapse}
                  className="hidden lg:inline-flex h-8 w-8 rounded-lg hover:bg-muted transition-all duration-200"
                >
                  <LucideIcons.ChevronsLeft
                    className={`h-5 w-5 transition-transform duration-300 text-muted-foreground ${
                      isCollapsed ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen?.(false)}
            className="lg:hidden h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <LucideIcons.X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 px-3 py-4">
          {loading && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Loading menu…</p>
          )}
          {error && (
            <p className="px-2 py-1 text-xs text-destructive">Failed to load menu</p>
          )}

          <nav className="space-y-1">
            {menu.map((item) => {
              const isActive = activeItem === item.key;
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleMenuClick(item as HandleClickParams)}
                      className={`group flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                        ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                    >
                      {/* Icon box */}
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                          ${
                            isActive
                              ? "border-primary-foreground/20 bg-primary-foreground/10"
                              : "border-border/60 bg-background"
                          }`}
                      >
                        <item.icon
                          className={`h-4 w-4 ${
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                      </div>

                      {!isCollapsed && (
                        <span className="ml-3 truncate text-sm font-medium">
                          {item.label}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        {/* ── Resize handle — follows primary color ────────────────────── */}
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 transition-colors duration-150"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute right-0 top-1/2 h-10 w-3 -translate-y-1/2 rounded-l-full bg-gradient-to-b from-primary to-primary/60 opacity-0 shadow-sm transition-opacity group-hover:opacity-100" />
          </div>
        )}
      </div>

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen?.(false)}
        />
      )}
    </TooltipProvider>
  );
};

export default Sidebar;
