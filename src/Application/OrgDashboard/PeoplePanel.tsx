import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, KeyRound, Search, UserCheck, UserX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOpenScreen } from "@/hooks/useOpenScreen";
import {
  LEVELS, LEVEL_LABEL, filterUsers, formatStamp, grantPath, grantsOfUser, initials, scopeLabel, sortGrants,
  type KindFilter, type OrgOverview, type OrgUser, type ScopeFilter,
} from "./orgDashboardModel";
import { GrantPath, Initials, Panel } from "./DashboardParts";
import { LEVEL_ICON } from "./levelIcons";

export type PeopleTab = "with" | "awaiting";
export interface PeopleFocus { ident: string; nonce: number }

interface Props {
  data: OrgOverview;
  changed: ReadonlySet<string>;
  focus: PeopleFocus | null;
  tab: PeopleTab;
  onTab: (t: PeopleTab) => void;
}

const PAGE = 20;
const GRANT_COUNT: Record<(typeof LEVELS)[number], keyof OrgUser> = {
  company: "company_grants", division: "division_grants", branch: "branch_grants", department: "dept_grants",
};

const KINDS: { id: KindFilter; label: string }[] = [{ id: "all", label: "Everyone" }, { id: "Staff", label: "Staff" }, { id: "Non-staff", label: "Non-staff" }];

export default function PeoplePanel({ data, changed, focus, tab, onTab }: Props) {
  // "Show this person" from the node panel mounts this panel anew (keyed on focus.nonce) already filtered to them, grants open.
  const [query, setQuery] = useState(focus?.ident ?? "");
  const [kind, setKind] = useState<KindFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(focus ? [focus.ident.toLowerCase()] : []));
  const rootRef = useRef<HTMLDivElement>(null);
  const focusedOnMount = useRef(focus != null);
  const openScreen = useOpenScreen();

  useEffect(() => {
    if (focusedOnMount.current) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // "Show more" is remembered per filter combination, so changing a filter starts again from the first page.
  const filterKey = `${tab}|${query}|${kind}|${scope}`;
  const [paging, setPaging] = useState({ key: filterKey, n: PAGE });
  const limit = paging.key === filterKey ? paging.n : PAGE;

  const people = useMemo(() => filterUsers(data.users, { query, kind, scope }), [data.users, query, kind, scope]);
  const awaiting = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.unassigned.filter((u) => !q || `${u.user_name} ${u.ident}`.toLowerCase().includes(q));
  }, [data.unassigned, query]);

  const toggle = (ident: string) => setOpen((prev) => {
    const next = new Set(prev);
    const k = ident.toLowerCase();
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const assign = () => {
    if (!openScreen("RoleApproval")) toast.error("You do not have the Role Approval screen.");
  };

  const filtering = query.trim() !== "" || kind !== "all" || scope !== "all";

  return (
    <div ref={rootRef} id="org-people" className="scroll-mt-4">
      <Panel
        icon={Users}
        title="People & access"
        subtitle="Everyone whose access overlaps yours, and exactly what they can reach"
        actions={
          <div role="tablist" aria-label="People" className="inline-flex rounded-xl border border-border/80 bg-muted/40 p-0.5 text-xs font-semibold">
            <TabButton active={tab === "with"} onClick={() => onTab("with")} icon={UserCheck} label="With access" count={data.users.length} />
            <TabButton active={tab === "awaiting"} onClick={() => onTab("awaiting")} icon={UserX} label="Awaiting access" count={data.unassigned.length} warn />
          </div>
        }
      >
        {/* filters */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:px-5 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or employee number"
              aria-label="Search people"
              className="h-9 w-full rounded-xl border border-border/80 bg-background pl-9 pr-9 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {tab === "with" && (
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Type" className="inline-flex rounded-xl border border-border/80 bg-muted/40 p-0.5 text-xs font-medium">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}
                    className={cn("rounded-lg px-2.5 py-1.5 transition", kind === k.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {k.label}
                  </button>
                ))}
              </div>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as ScopeFilter)}
                aria-label="Broadest level of access"
                className="h-9 rounded-xl border border-border/80 bg-background px-2.5 text-xs font-medium outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              >
                <option value="all">Any level</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l === "company" ? "Company-wide" : `${LEVEL_LABEL[l]} level`}</option>)}
              </select>
            </div>
          )}
        </div>

        {tab === "with" ? (
          people.length === 0 ? (
            <Empty icon={Users} text={filtering ? "Nobody matches these filters." : "Nobody else has access in your scope yet."} />
          ) : (
            <>
              <div aria-hidden className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.8fr)_88px_118px_28px] gap-4 border-b border-border/50 bg-muted/30 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Person</span><span>Access</span><span>Screens</span><span>Updated</span><span />
              </div>
              <ul className="divide-y divide-border/60">
                {people.slice(0, limit).map((u) => {
                  const isOpen = open.has(u.ident.toLowerCase());
                  const grants = sortGrants(grantsOfUser(data.grants, u.ident));
                  const effective = grants.filter((g) => g.is_effective);
                  const covered = grants.filter((g) => !g.is_effective);
                  return (
                    <li key={u.ident} className={cn("bg-card transition-colors", changed.has(`user:${u.ident.toLowerCase()}`) && "org-flash")}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggle(u.ident)}
                        className="flex w-full flex-col gap-2.5 px-4 py-3 text-left outline-none transition hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:px-5 md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.8fr)_88px_118px_28px] md:items-center md:gap-4"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Initials text={initials(u.user_name)} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold">{u.user_name}</span>
                              {!!u.is_me && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">You</span>}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{u.ident} · {u.kind}</span>
                          </span>
                          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 md:hidden", isOpen && "rotate-180")} aria-hidden />
                        </span>

                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="mr-0.5 text-xs font-medium">{scopeLabel(u)}</span>
                          {LEVELS.map((l) => {
                            const count = Number(u[GRANT_COUNT[l]] ?? 0);
                            if (!count) return null;
                            const I = LEVEL_ICON[l];
                            return (
                              <span key={l} title={`${count} ${LEVEL_LABEL[l].toLowerCase()} ${count === 1 ? "assignment" : "assignments"}`}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                                <I className="h-3 w-3" aria-hidden />{count}
                                <span className="sr-only">{LEVEL_LABEL[l].toLowerCase()} assignments</span>
                              </span>
                            );
                          })}
                        </span>

                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground md:block">
                          <KeyRound className="h-3 w-3 md:hidden" aria-hidden />
                          <span className="font-semibold tabular-nums text-foreground">{u.screen_count}</span> screens
                        </span>
                        <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                          <Clock className="h-3 w-3 md:hidden" aria-hidden />{formatStamp(u.last_updated)}
                        </span>
                        <ChevronDown className={cn("hidden h-4 w-4 text-muted-foreground transition-transform duration-200 md:block", isOpen && "rotate-180")} aria-hidden />
                      </button>

                      {isOpen && (
                        <div className="border-t border-border/50 bg-muted/20 px-4 py-3 sm:px-5">
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Can access</h4>
                          <ul className="space-y-2">
                            {effective.map((g, i) => {
                              const I = LEVEL_ICON[g.node_level];
                              return (
                                <li key={i} className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex w-[104px] shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                    <I className="h-3 w-3" aria-hidden />{LEVEL_LABEL[g.node_level]}
                                  </span>
                                  <GrantPath path={grantPath(g)} />
                                </li>
                              );
                            })}
                          </ul>
                          {covered.length > 0 && (
                            <details className="mt-3 text-xs text-muted-foreground">
                              <summary className="cursor-pointer select-none font-medium hover:text-foreground">
                                {covered.length} more {covered.length === 1 ? "assignment is" : "assignments are"} already included above
                              </summary>
                              <ul className="mt-2 space-y-1.5">
                                {covered.map((g, i) => <li key={i}><GrantPath path={grantPath(g)} muted /></li>)}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {people.length > limit && (
                <div className="border-t border-border/50 p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setPaging({ key: filterKey, n: limit + PAGE })}>Show {Math.min(PAGE, people.length - limit)} more · {people.length - limit} left</Button>
                </div>
              )}
            </>
          )
        ) : awaiting.length === 0 ? (
          <Empty icon={UserCheck} text={data.unassigned.length === 0 ? "Everyone in your view has access assigned." : "Nobody matches this search."} />
        ) : (
          <ul className="divide-y divide-border/60">
            {awaiting.map((u) => (
              <li key={u.ident} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <Initials text={initials(u.user_name)} className="bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{u.user_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.ident} · {u.kind} · no company, division, branch or department yet</span>
                </span>
                <Button size="sm" variant="outline" onClick={assign}>Assign access</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count, warn }: {
  active: boolean; onClick: () => void; icon: typeof Users; label: string; count: number; warn?: boolean;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition", active ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
      <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", warn && count > 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary")}>{count}</span>
    </button>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      {text}
    </div>
  );
}
