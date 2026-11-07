import { ChevronRight, ChevronsDownUp, ChevronsUpDown, EyeOff, Network, Search, Users, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/CustomComponent/PageComponents";
import { LEVEL_LABEL, isActive, visibleRows, type TreeNode } from "./orgDashboardModel";
import { Panel } from "./DashboardParts";
import { LEVEL_ICON } from "./levelIcons";

interface Props {
  tree: TreeNode[];
  nodeCount: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  query: string;
  onQuery: (q: string) => void;
  showInactive: boolean;
  onShowInactive: (v: boolean) => void;
  /** Admins also see how many people reach each node. */
  showUsers: boolean;
  changed: ReadonlySet<string>;
}

export default function OrgTreePanel(p: Props) {
  const rows = visibleRows(p.tree, p.expanded, p.query);
  const searching = p.query.trim().length > 0;

  return (
    <Panel
      icon={Network}
      title="Organisation structure"
      subtitle={`${p.nodeCount} ${p.nodeCount === 1 ? "node" : "nodes"} you can see`}
      className="h-full"
      actions={
        <>
          <button type="button" onClick={p.onExpandAll} aria-label="Expand all" title="Expand all"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
            <ChevronsUpDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={p.onCollapseAll} aria-label="Collapse all" title="Collapse all"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
            <ChevronsDownUp className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="space-y-3 border-b border-border/50 px-4 py-3 sm:px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="Search company, division, branch, department"
            aria-label="Search the organisation"
            className="h-9 w-full rounded-xl border border-border/80 bg-background pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
          {p.query && (
            <button type="button" aria-label="Clear search" onClick={() => p.onQuery("")}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" aria-hidden /> Show inactive</span>
          <Switch checked={p.showInactive} onCheckedChange={p.onShowInactive} aria-label="Show inactive" />
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Network}
            message={searching ? "Nothing matches your search" : "No organisation access yet"}
            description={searching ? "Try a different name or code." : "Ask an administrator to assign you a company, division, branch or department in Role Approval."}
          />
        </div>
      ) : (
        <ul role="tree" aria-label="Organisation structure" className="max-h-[60vh] space-y-0.5 overflow-y-auto overscroll-contain p-2 sm:p-3 lg:max-h-[640px]">
          {rows.map((t) => {
            const n = t.node;
            const Icon = LEVEL_ICON[n.node_level];
            const hasKids = t.children.length > 0;
            const open = searching ? hasKids : p.expanded.has(t.key);
            const selected = p.selectedKey === t.key;
            const context = !n.in_my_access;
            return (
              <li key={t.key} role="treeitem" aria-level={t.depth + 1} aria-selected={selected} aria-expanded={hasKids ? open : undefined}>
                <div
                  className={cn(
                    "group flex items-stretch rounded-xl pr-1.5 transition-colors",
                    selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60",
                    p.changed.has(`node:${t.key}`) && "org-flash"
                  )}
                >
                  {Array.from({ length: t.depth }).map((_, i) => (
                    <span key={i} aria-hidden className="w-4 shrink-0 sm:w-[18px]">
                      <span className="ml-2 block h-full w-px bg-border/70" />
                    </span>
                  ))}
                  {hasKids ? (
                    <button type="button" onClick={() => p.onToggle(t.key)} aria-label={`${open ? "Collapse" : "Expand"} ${n.node_name}`}
                      className="flex w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-primary">
                      <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-90")} />
                    </button>
                  ) : (
                    <span className="w-6 shrink-0" aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => p.onSelect(t.key)}
                    className={cn("flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40", context && "opacity-70")}
                  >
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-tight">{n.node_name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {LEVEL_LABEL[n.node_level]}{n.node_code ? ` · ${n.node_code}` : ""}{context ? " · partial access" : ""}
                      </span>
                    </span>
                    {!isActive(n) && (
                      <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Inactive</span>
                    )}
                    {p.showUsers && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                            <Users className="h-3 w-3" aria-hidden /> {n.users_total}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <span className="font-semibold">{n.users_total}</span> people reach this · <span className="font-semibold">{n.users_full}</span> with full access
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
