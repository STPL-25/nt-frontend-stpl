import { useCallback, useMemo, useState } from "react";
import { LayoutDashboard, LayoutGrid, ShieldCheck, UserRound, Users } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/CustomComponent/PageComponents";
import { cn } from "@/lib/utils";
import {
  LEVELS, LEVEL_PLURAL, buildTree, expandableKeys, findTreeNode, firstName, isAdmin as metaIsAdmin, nodeKey, pathTo, summarize,
  type OrgNode,
} from "./orgDashboardModel";
import { useOrgDashboard } from "./useOrgDashboard";
import { LiveStatus, StatTile } from "./DashboardParts";
import { useMediaQuery } from "./dashboardHooks";
import { LEVEL_ICON } from "./levelIcons";
import OrgTreePanel from "./OrgTreePanel";
import NodeDetailPanel from "./NodeDetailPanel";
import PeoplePanel, { type PeopleFocus, type PeopleTab } from "./PeoplePanel";

const NO_NODES: OrgNode[] = [];

/**
 * "Organisation & access" tab of the Dashboard (DashboardHome.tsx hosts it next to the Business overview). The organisation
 * (companies > divisions > branches > departments) and who can reach each part of it, kept live over the existing socket events
 * (see useOrgDashboard). What each person sees is decided by sp_nt_GetOrgAccessDashboard: everyone gets the part of the
 * organisation they can reach plus their own access; administrators (View on Role Approval) also get the people behind it.
 */
export function OrgAccessView() {
  const live = useOrgDashboard();
  const { data, loading, error, changed } = live;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [pickedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedState, setExpandedState] = useState<ReadonlySet<string> | null>(null);   // null = untouched: companies open
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("with");
  const [focus, setFocus] = useState<PeopleFocus | null>(null);

  const nodes = data?.nodes ?? NO_NODES;
  const tree = useMemo(() => buildTree(nodes, { showInactive }), [nodes, showInactive]);
  const admin = metaIsAdmin(data?.meta);

  // A live update (or the inactive switch) can remove the selected node - treat it as unselected rather than show a ghost.
  const selectedKey = pickedKey && findTreeNode(tree, pickedKey) ? pickedKey : null;

  // Until the user opens or closes something, the companies are open so the divisions underneath are visible straight away.
  const defaultExpanded = useMemo(() => new Set(tree.filter((t) => t.children.length > 0).map((t) => t.key)), [tree]);
  const expanded = expandedState ?? defaultExpanded;

  const select = useCallback((key: string | null) => {
    setSelectedKey(key);
    if (!key) return;
    // make sure the node can be seen in the tree (breadcrumb jumps land on collapsed branches)
    const ancestors = pathTo(tree, key).slice(0, -1).map(nodeKey);
    if (ancestors.length) setExpandedState((prev) => new Set([...(prev ?? defaultExpanded), ...ancestors]));
  }, [tree, defaultExpanded]);

  const toggle = useCallback((key: string) => setExpandedState((prev) => {
    const next = new Set(prev ?? defaultExpanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }), [defaultExpanded]);

  const pickUser = useCallback((ident: string) => {
    if (!isDesktop) setSelectedKey(null);       // phones: close the sheet so the people list is visible; desktop keeps your place
    setPeopleTab("with");
    setFocus({ ident, nonce: Date.now() });     // PeoplePanel is keyed on the nonce: it remounts already filtered to this person
  }, [isDesktop]);

  const openAwaiting = useCallback(() => {
    setPeopleTab("awaiting");
    document.getElementById("org-people")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── first load / failure ──
  if (loading && !data) return <DashboardSkeleton />;
  if (!data) return <ErrorState fullPage message={error ?? "Could not load the dashboard."} onRetry={live.refresh} />;

  const { meta } = data;
  const sum = summarize(nodes);
  const peopleTotal = data.users.length + data.unassigned.length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-4 px-2 pb-8 pt-2 sm:px-3 lg:px-5 lg:pt-4">
        {/* ── hero ── */}
        <section className="org-rise relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-card/95 px-4 py-5 shadow-[0_18px_45px_-35px_color-mix(in_oklab,var(--primary)_65%,transparent)] backdrop-blur sm:px-6 lg:px-7">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 -z-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-28 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12 text-primary shadow-sm ring-4 ring-primary/[0.05] sm:h-14 sm:w-14">
                <LayoutDashboard className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Organisation Dashboard</h1>
                <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Companies, divisions, branches and departments{admin ? " - and who can access each of them." : " - and where you have access."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                    <UserRound className="h-3 w-3" aria-hidden />{meta.my_name ? `Welcome back, ${firstName(meta.my_name) || meta.my_name}` : "Welcome back"}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", admin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <ShieldCheck className="h-3 w-3" aria-hidden />{admin ? "Administrator view" : "Your view"}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{meta.my_kind}</span>
                </div>
              </div>
            </div>
            <LiveStatus
              connected={live.connected}
              refreshing={live.refreshing}
              lastFetchedAt={live.lastFetchedAt}
              lastEvent={live.lastEvent}
              error={live.error}
              onRefresh={live.refresh}
            />
          </div>
        </section>

        {/* ── numbers ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {LEVELS.map((l, i) => {
            const s = sum[l];
            return (
              <StatTile
                key={l}
                label={LEVEL_PLURAL[l]}
                value={s.active}
                icon={LEVEL_ICON[l]}
                sub={s.inactive > 0 ? `${s.total} in total · ${s.inactive} inactive` : `${s.total} in total · all active`}
                ratio={s.total ? s.active / s.total : 1}
                ratioLabel="Active"
                flash={changed.has(`tile:${l}`)}
                delay={60 * (i + 1)}
              />
            );
          })}
          {admin ? (
            <StatTile
              label="People with access"
              value={data.users.length}
              icon={Users}
              sub={data.unassigned.length > 0 ? `${data.unassigned.length} awaiting access` : "everyone has access"}
              ratio={peopleTotal ? data.users.length / peopleTotal : 1}
              ratioLabel="People with access"
              flash={changed.has("tile:people")}
              delay={300}
              className="sm:col-span-2 xl:col-span-1"
            />
          ) : (
            <StatTile
              label="Screens you can open"
              value={meta.my_screen_count}
              icon={LayoutGrid}
              sub={`${meta.my_grant_count} access ${meta.my_grant_count === 1 ? "assignment" : "assignments"}`}
              delay={300}
              className="sm:col-span-2 xl:col-span-1"
            />
          )}
        </div>

        {/* ── structure + details ── */}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-5 xl:col-span-4">
            <OrgTreePanel
              tree={tree}
              nodeCount={nodes.length}
              selectedKey={selectedKey}
              onSelect={select}
              expanded={expanded}
              onToggle={toggle}
              onExpandAll={() => setExpandedState(new Set(expandableKeys(tree)))}
              onCollapseAll={() => setExpandedState(new Set())}
              query={query}
              onQuery={setQuery}
              showInactive={showInactive}
              onShowInactive={setShowInactive}
              showUsers={admin}
              changed={changed}
            />
          </div>
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            <NodeDetailPanel
              data={data}
              tree={tree}
              selectedKey={isDesktop ? selectedKey : null}
              admin={admin}
              showInactive={showInactive}
              changed={changed}
              onSelect={select}
              onPickUser={pickUser}
              onOpenAwaiting={openAwaiting}
            />
          </div>
        </div>

        {/* ── people (administrators) ── */}
        {admin && <PeoplePanel key={focus?.nonce ?? 0} data={data} changed={changed} focus={focus} tab={peopleTab} onTab={setPeopleTab} />}
      </div>

      {/* phones / tablets: a selected node opens as a sheet instead of pushing the page around */}
      <Sheet open={!isDesktop && !!selectedKey} onOpenChange={(o) => { if (!o) setSelectedKey(null); }}>
        <SheetContent side="bottom" className="max-h-[88vh] gap-0 overflow-y-auto rounded-t-2xl p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Details</SheetTitle>
            <SheetDescription>Details and access for the selected part of the organisation</SheetDescription>
          </SheetHeader>
          <div className="p-2 pt-8">
            <NodeDetailPanel
              data={data}
              tree={tree}
              selectedKey={selectedKey}
              admin={admin}
              showInactive={showInactive}
              changed={changed}
              onSelect={select}
              onPickUser={pickUser}
              onOpenAwaiting={openAwaiting}
            />
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-2 pb-8 pt-2 sm:px-3 lg:px-5 lg:pt-4" aria-busy="true" aria-label="Loading the dashboard">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[460px] rounded-2xl lg:col-span-5 xl:col-span-4" />
        <Skeleton className="h-[460px] rounded-2xl lg:col-span-7 xl:col-span-8" />
      </div>
    </div>
  );
}
