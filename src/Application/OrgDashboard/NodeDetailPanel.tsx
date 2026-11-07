import { useState } from "react";
import { ArrowUpRight, Clock, MousePointerClick, ShieldCheck, UserX, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LEVELS, LEVEL_LABEL, LEVEL_PLURAL, companyReach, descendantCounts, findTreeNode, formatStamp, grantPath, grantsOfUser, initials,
  isActive, nodeKey, pathTo, scopeLabel, sortGrants, usersForNode, type CompanyReach, type OrgOverview, type TreeNode,
} from "./orgDashboardModel";
import { AccessBadge, GrantPath, Initials, Panel } from "./DashboardParts";
import { LEVEL_ICON } from "./levelIcons";

interface Props {
  data: OrgOverview;
  tree: TreeNode[];
  selectedKey: string | null;
  admin: boolean;
  showInactive: boolean;
  changed: ReadonlySet<string>;
  onSelect: (key: string | null) => void;
  onPickUser: (ident: string) => void;
  onOpenAwaiting: () => void;
}

const SHOW_FIRST = 40;

export default function NodeDetailPanel(p: Props) {
  const sel = findTreeNode(p.tree, p.selectedKey);
  return sel ? <NodeDetail key={sel.key} {...p} sel={sel} /> : <Overview {...p} />;
}

// ── a selected node ────────────────────────────────────────────────────────────────────────────
function NodeDetail({ data, tree, sel, admin, onSelect, onPickUser, changed }: Props & { sel: TreeNode }) {
  const [showAll, setShowAll] = useState(false);
  const n = sel.node;
  const Icon = LEVEL_ICON[n.node_level];
  const path = pathTo(tree, sel.key);
  const below = descendantCounts(sel);
  const belowLevels = LEVELS.filter((l) => below[l] > 0);
  const people = usersForNode(n.node_id, data.node_users, data.users);
  const shown = showAll ? people : people.slice(0, SHOW_FIRST);
  const partial = Math.max(0, n.users_total - n.users_full);
  const fullPct = n.users_total ? (n.users_full / n.users_total) * 100 : 0;

  return (
    <Panel
      icon={Icon}
      title={n.node_name ?? "—"}
      subtitle={`${LEVEL_LABEL[n.node_level]}${n.node_code ? ` · ${n.node_code}` : ""}`}
      className={cn("h-full", changed.has(`node:${sel.key}`) && "org-flash")}
      actions={
        <>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", isActive(n) ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
            {isActive(n) ? "Active" : "Inactive"}
          </span>
          <Tooltip>
            <TooltipTrigger asChild><span><AccessBadge full={!!n.in_my_access} /></span></TooltipTrigger>
            <TooltipContent>{n.in_my_access ? `Your access covers this whole ${LEVEL_LABEL[n.node_level].toLowerCase()}` : `You can reach part of this ${LEVEL_LABEL[n.node_level].toLowerCase()}`}</TooltipContent>
          </Tooltip>
        </>
      }
      bodyClassName="space-y-5 p-4 sm:p-5"
    >
      {path.length > 1 && (
        <nav aria-label="Where this sits" className="flex flex-wrap items-center gap-1 text-xs">
          {path.map((a, i) => {
            const AIcon = LEVEL_ICON[a.node_level];
            const last = i === path.length - 1;
            const key = nodeKey(a);
            return (
              <span key={key} className="inline-flex items-center gap-1">
                {i > 0 && <span aria-hidden className="text-muted-foreground">›</span>}
                {last ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 font-semibold text-primary"><AIcon className="h-3 w-3" aria-hidden />{a.node_name}</span>
                ) : (
                  <button type="button" onClick={() => onSelect(key)} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                    <AIcon className="h-3 w-3" aria-hidden />{a.node_name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* what sits under it */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inside this {LEVEL_LABEL[n.node_level].toLowerCase()}</h3>
        {belowLevels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">Nothing below this level.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {belowLevels.map((l) => {
              const LIcon = LEVEL_ICON[l];
              return (
                <div key={l} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><LIcon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="text-lg font-bold leading-none tabular-nums">{below[l]}</div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">{LEVEL_PLURAL[l]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {sel.children.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sel.children.slice(0, 12).map((c) => {
              const CIcon = LEVEL_ICON[c.node.node_level];
              return (
                <button key={c.key} type="button" onClick={() => onSelect(c.key)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                  <CIcon className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{c.node.node_name}</span>
                </button>
              );
            })}
            {sel.children.length > 12 && <span className="px-1 py-1 text-xs text-muted-foreground">+{sel.children.length - 12} more</span>}
          </div>
        )}
      </div>

      {/* who can reach it */}
      {admin ? (
        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Who can access this</h3>
            <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{n.users_total}</span> {n.users_total === 1 ? "person" : "people"}</span>
          </div>

          {n.users_total > 0 && (
            <div className="mb-3">
              <div className="flex h-2.5 w-full gap-0.5" role="img" aria-label={`${n.users_full} with full access, ${partial} with partial access`}>
                {n.users_full > 0 && <div className={cn("org-grow h-full bg-primary", partial > 0 ? "rounded-l-full" : "rounded-full")} style={{ width: `${fullPct}%` }} />}
                {partial > 0 && <div className={cn("org-grow h-full bg-primary/40", n.users_full > 0 ? "rounded-r-full" : "rounded-full")} style={{ width: `${100 - fullPct}%` }} />}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" aria-hidden />Full access <b className="text-foreground tabular-nums">{n.users_full}</b></span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/40" aria-hidden />Partial access <b className="text-foreground tabular-nums">{partial}</b></span>
              </div>
            </div>
          )}

          {people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">Nobody in your view has access to this yet.</p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
              {shown.map(({ user, isFull }) => (
                <li key={user.ident} className={cn(changed.has(`user:${user.ident.toLowerCase()}`) && "org-flash")}>
                  <button type="button" onClick={() => onPickUser(user.ident)} title="Show this person's full access"
                    className="group flex w-full items-center gap-3 bg-background px-3 py-2.5 text-left transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                    <Initials text={initials(user.user_name)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{user.user_name}</span>
                        {!!user.is_me && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">You</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{user.ident} · {user.kind} · {scopeLabel(user)}</span>
                    </span>
                    <AccessBadge full={isFull} />
                    <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary sm:block" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {people.length > SHOW_FIRST && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-primary hover:underline">
              {showAll ? "Show fewer" : `Show all ${people.length}`}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            {n.in_my_access
              ? <>You have <b className="text-foreground">full access</b> to this {LEVEL_LABEL[n.node_level].toLowerCase()}.</>
              : <>You have <b className="text-foreground">partial access</b> here - you can reach some of what is inside it.</>}
          </p>
        </div>
      )}
    </Panel>
  );
}

// ── nothing selected ───────────────────────────────────────────────────────────────────────────
function Overview({ data, admin, showInactive, onSelect, onPickUser, onOpenAwaiting, changed }: Props) {
  const reach = companyReach(data.nodes, { showInactive });
  const recent = [...data.users].filter((u) => u.last_updated).sort((a, b) => (b.last_updated ?? "").localeCompare(a.last_updated ?? "")).slice(0, 6);
  const mine = sortGrants(grantsOfUser(data.grants, data.meta.my_ident));
  const effective = mine.filter((g) => g.is_effective);
  const covered = mine.length - effective.length;

  return (
    <Panel
      icon={MousePointerClick}
      title={admin ? "Access at a glance" : "Your access"}
      subtitle={admin ? "Select any node on the left to see exactly who can reach it" : "Select any node on the left to see what you can do there"}
      className="h-full"
      bodyClassName="space-y-6 p-4 sm:p-5"
    >
      {admin ? (
        <>
          {data.unassigned.length > 0 && (
            <button type="button" onClick={onOpenAwaiting}
              className="flex w-full items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-left transition hover:bg-amber-500/15">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300"><UserX className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 text-sm">
                <b>{data.unassigned.length} {data.unassigned.length === 1 ? "person has" : "people have"} no access assigned yet</b>
                <span className="block text-xs text-muted-foreground">They can sign in but see nothing until you give them a company, division, branch or department.</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden />People reaching each company</h3>
            {reach.length === 0 ? <p className="text-sm text-muted-foreground">No companies in your view.</p> : <ReachBars rows={reach} onSelect={onSelect} />}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Clock className="h-3.5 w-3.5" aria-hidden />Recently changed access</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
                {recent.map((u) => (
                  <li key={u.ident} className={cn(changed.has(`user:${u.ident.toLowerCase()}`) && "org-flash")}>
                    <button type="button" onClick={() => onPickUser(u.ident)} className="flex w-full items-center gap-3 bg-background px-3 py-2.5 text-left transition hover:bg-primary/5">
                      <Initials text={initials(u.user_name)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.user_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{u.ident} · {scopeLabel(u)}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatStamp(u.last_updated)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Where you have access</h3>
          {effective.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No company, division, branch or department is assigned to you yet.</p>
          ) : (
            <ul className="space-y-2">
              {effective.map((g, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {(() => { const I = LEVEL_ICON[g.node_level]; return <I className="h-3 w-3" aria-hidden />; })()}{LEVEL_LABEL[g.node_level]}
                  </span>
                  <GrantPath path={grantPath(g)} />
                </li>
              ))}
            </ul>
          )}
          {covered > 0 && <p className="mt-2 text-xs text-muted-foreground">{covered} more {covered === 1 ? "assignment is" : "assignments are"} already included in the broader access above.</p>}
        </section>
      )}
    </Panel>
  );
}

function ReachBars({ rows, onSelect }: { rows: CompanyReach[]; onSelect: (key: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const shown = rows.slice(0, 8);
  return (
    <div>
      <ul className="space-y-3">
        {shown.map((r) => {
          const n = r.node;
          const key = nodeKey(n);
          return (
            <li key={n.node_id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => onSelect(key)} className="group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <span className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate font-medium group-hover:text-primary">{n.node_name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{r.total}</span>
                    </span>
                    <span className="flex h-2.5 w-full gap-0.5 rounded-full bg-primary/[0.07]" aria-hidden>
                      {r.full > 0 && <span className={cn("org-grow h-full bg-primary transition-opacity group-hover:opacity-80", r.partial > 0 ? "rounded-l-full" : "rounded-full")} style={{ width: `${(r.full / max) * 100}%` }} />}
                      {r.partial > 0 && <span className={cn("org-grow h-full bg-primary/40 transition-opacity group-hover:opacity-80", r.full > 0 ? "rounded-r-full" : "rounded-full")} style={{ width: `${(r.partial / max) * 100}%` }} />}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><b>{n.node_name}</b><br /><b>{r.full}</b> full · <b>{r.partial}</b> partial</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {rows.length > shown.length && <p className="mt-2 text-xs text-muted-foreground">+{rows.length - shown.length} more companies</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" aria-hidden />Whole company</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/40" aria-hidden />Part of the company</span>
      </div>
    </div>
  );
}
