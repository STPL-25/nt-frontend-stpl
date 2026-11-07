// Pure data model for the Organisation Dashboard (no React, no network) so it can be unit-tested.
// The shapes mirror the six result sets of sp_nt_GetOrgAccessDashboard (backend-stpl/sql/152_org_access_dashboard.sql).

export type NodeLevel = "company" | "division" | "branch" | "department";

export const LEVELS: NodeLevel[] = ["company", "division", "branch", "department"];
export const LEVEL_LABEL: Record<NodeLevel, string> = { company: "Company", division: "Division", branch: "Branch", department: "Department" };
export const LEVEL_PLURAL: Record<NodeLevel, string> = { company: "Companies", division: "Divisions", branch: "Branches", department: "Departments" };
const LEVEL_RANK: Record<NodeLevel, number> = { company: 1, division: 2, branch: 3, department: 4 };

export interface OrgMeta {
  is_admin: boolean | number;
  my_ident: string;
  my_name: string;
  my_kind: "Staff" | "Non-staff";
  my_grant_count: number;
  my_screen_count: number;
  /** Database server time, no timezone ("2026-11-04T11:27:47"). */
  server_now: string;
}

export interface OrgNode {
  node_id: number;
  node_level: NodeLevel;
  com_sno: number;
  div_sno: number | null;
  brn_sno: number | null;
  dept_sno: number | null;
  node_name: string | null;
  node_code: string | null;
  is_active: string | null;
  /** 1 = one of the caller's own grants covers the whole node; 0 = shown only as context (an ancestor of what they can reach). */
  in_my_access: number | boolean;
  users_total: number;
  users_full: number;
}

export interface OrgNodeUser { node_id: number; ident: string; is_full: boolean | number }

export interface OrgUser {
  ident: string;
  user_name: string;
  kind: "Staff" | "Non-staff";
  grant_count: number;
  company_grants: number;
  division_grants: number;
  branch_grants: number;
  dept_grants: number;
  screen_count: number;
  /** Local time of the database server, no timezone. */
  last_updated: string | null;
  is_me: number | boolean;
}

export interface OrgGrant {
  ident: string;
  node_level: NodeLevel;
  com_sno: number; com_name: string | null;
  div_sno: number | null; div_name: string | null;
  brn_sno: number | null; brn_name: string | null;
  dept_sno: number | null; dept_name: string | null;
  /** 0 when a broader grant of the same user already covers it. */
  is_effective: number | boolean;
}

export interface OrgUnassigned { ident: string; user_name: string; kind: "Staff" | "Non-staff" }

export interface OrgOverview {
  meta: OrgMeta;
  nodes: OrgNode[];
  node_users: OrgNodeUser[];
  users: OrgUser[];
  grants: OrgGrant[];
  unassigned: OrgUnassigned[];
}

export const isAdmin = (m?: Pick<OrgMeta, "is_admin"> | null) => !!m?.is_admin;
export const isActive = (n: Pick<OrgNode, "is_active">) => (n.is_active ?? "Y").toString().toUpperCase() === "Y";

// ── node identity ──────────────────────────────────────────────────────────────────────────────
export const nodeKey = (n: Pick<OrgNode, "node_level" | "com_sno" | "div_sno" | "brn_sno" | "dept_sno">) =>
  `${n.node_level}:${n.com_sno}:${n.div_sno ?? ""}:${n.brn_sno ?? ""}:${n.dept_sno ?? ""}`;

/** Candidate parent keys, nearest first. Falls back upward when a master row points at a parent that is not visible / does not exist. */
const parentCandidates = (n: OrgNode): string[] => {
  const company = `company:${n.com_sno}:::`;
  const division = `division:${n.com_sno}:${n.div_sno ?? ""}::`;
  const branch = `branch:${n.com_sno}:${n.div_sno ?? ""}:${n.brn_sno ?? ""}:`;
  switch (n.node_level) {
    case "company": return [];
    case "division": return [company];
    case "branch": return [division, company];
    case "department": return [branch, division, company];
  }
};

export interface TreeNode {
  node: OrgNode;
  key: string;
  depth: number;
  children: TreeNode[];
}

const byName = (a: OrgNode, b: OrgNode) => (a.node_name ?? "").localeCompare(b.node_name ?? "", undefined, { sensitivity: "base" });

/** Builds the company -> division -> branch -> department forest. Inactive nodes (and everything below them) are dropped unless asked for. */
export function buildTree(nodes: OrgNode[], opts: { showInactive?: boolean } = {}): TreeNode[] {
  const showInactive = !!opts.showInactive;
  const kept = nodes.filter((n) => showInactive || isActive(n));
  const byKey = new Map<string, TreeNode>();
  for (const n of [...kept].sort(byName)) byKey.set(nodeKey(n), { node: n, key: nodeKey(n), depth: 0, children: [] });

  const roots: TreeNode[] = [];
  for (const t of byKey.values()) {
    const parent = parentCandidates(t.node).map((k) => byKey.get(k)).find(Boolean);
    if (parent) parent.children.push(t); else roots.push(t);
  }
  const setDepth = (t: TreeNode, d: number) => { t.depth = d; t.children.forEach((c) => setDepth(c, d + 1)); };
  roots.sort((a, b) => byName(a.node, b.node));
  roots.forEach((r) => setDepth(r, 0));
  return roots;
}

/** Every key that has children - what "Expand all" opens. */
export function expandableKeys(tree: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (t: TreeNode) => { if (t.children.length) out.push(t.key); t.children.forEach(walk); };
  tree.forEach(walk);
  return out;
}

/** Flat list of the rows to draw. With a search term, shows matches plus their ancestors (auto-expanded) and, below a match, its subtree. */
export function visibleRows(tree: TreeNode[], expanded: ReadonlySet<string>, query = ""): TreeNode[] {
  const q = query.trim().toLowerCase();
  const rows: TreeNode[] = [];
  if (!q) {
    const walk = (t: TreeNode) => { rows.push(t); if (expanded.has(t.key)) t.children.forEach(walk); };
    tree.forEach(walk);
    return rows;
  }
  const hit = (t: TreeNode) => `${t.node.node_name ?? ""} ${t.node.node_code ?? ""}`.toLowerCase().includes(q);
  const subtreeHas = (t: TreeNode): boolean => hit(t) || t.children.some(subtreeHas);
  const walk = (t: TreeNode, underMatch: boolean) => {
    if (!underMatch && !subtreeHas(t)) return;
    rows.push(t);
    const nextUnder = underMatch || hit(t);
    t.children.forEach((c) => walk(c, nextUnder));
  };
  tree.forEach((r) => walk(r, false));
  return rows;
}

export function findTreeNode(tree: TreeNode[], key: string | null): TreeNode | null {
  if (!key) return null;
  let found: TreeNode | null = null;
  const walk = (t: TreeNode) => { if (t.key === key) found = t; else t.children.forEach(walk); };
  tree.forEach(walk);
  return found;
}

/** Ancestors from the company down to (and including) the node. */
export function pathTo(tree: TreeNode[], key: string | null): OrgNode[] {
  const path: OrgNode[] = [];
  const walk = (t: TreeNode, trail: OrgNode[]): boolean => {
    const next = [...trail, t.node];
    if (t.key === key) { path.push(...next); return true; }
    return t.children.some((c) => walk(c, next));
  };
  if (key) tree.some((r) => walk(r, []));
  return path;
}

/** How many divisions / branches / departments sit under a node. */
export function descendantCounts(t: TreeNode): Record<NodeLevel, number> {
  const out: Record<NodeLevel, number> = { company: 0, division: 0, branch: 0, department: 0 };
  const walk = (x: TreeNode) => x.children.forEach((c) => { out[c.node.node_level] += 1; walk(c); });
  walk(t);
  return out;
}

// ── numbers for the tiles ──────────────────────────────────────────────────────────────────────
export interface LevelSummary { total: number; active: number; inactive: number }

export function summarize(nodes: OrgNode[]): Record<NodeLevel, LevelSummary> {
  const out = Object.fromEntries(LEVELS.map((l) => [l, { total: 0, active: 0, inactive: 0 }])) as Record<NodeLevel, LevelSummary>;
  for (const n of nodes) {
    const s = out[n.node_level];
    if (!s) continue;
    s.total += 1;
    if (isActive(n)) s.active += 1; else s.inactive += 1;
  }
  return out;
}

export interface CompanyReach { node: OrgNode; full: number; partial: number; total: number }

/** Users reaching each company, split into whole-company ("full") and part-of-company ("partial"). Largest first; ties by name. */
export function companyReach(nodes: OrgNode[], opts: { showInactive?: boolean } = {}): CompanyReach[] {
  return nodes
    .filter((n) => n.node_level === "company" && (opts.showInactive || isActive(n)))
    .map((node) => ({ node, full: node.users_full, partial: Math.max(0, node.users_total - node.users_full), total: node.users_total }))
    .sort((a, b) => b.total - a.total || byName(a.node, b.node));
}

// ── users on a node ────────────────────────────────────────────────────────────────────────────
export interface NodeUserRow { user: OrgUser; isFull: boolean }

export function usersForNode(nodeId: number, nodeUsers: OrgNodeUser[], users: OrgUser[]): NodeUserRow[] {
  const byIdent = new Map(users.map((u) => [u.ident.toLowerCase(), u]));
  const rows: NodeUserRow[] = [];
  for (const p of nodeUsers) {
    if (p.node_id !== nodeId) continue;
    const user = byIdent.get(p.ident.toLowerCase());
    if (user) rows.push({ user, isFull: !!p.is_full });
  }
  return rows.sort((a, b) => Number(b.isFull) - Number(a.isFull) || a.user.user_name.localeCompare(b.user.user_name, undefined, { sensitivity: "base" }));
}

/** Broadest level a user holds ("Company-wide" beats "Division" ...). */
export function scopeLabel(u: Pick<OrgUser, "company_grants" | "division_grants" | "branch_grants" | "dept_grants">): string {
  if (u.company_grants > 0) return "Company-wide";
  if (u.division_grants > 0) return "Division level";
  if (u.branch_grants > 0) return "Branch level";
  if (u.dept_grants > 0) return "Department level";
  return "No access";
}

export function scopeRank(u: Pick<OrgUser, "company_grants" | "division_grants" | "branch_grants" | "dept_grants">): NodeLevel | null {
  if (u.company_grants > 0) return "company";
  if (u.division_grants > 0) return "division";
  if (u.branch_grants > 0) return "branch";
  if (u.dept_grants > 0) return "department";
  return null;
}

export type KindFilter = "all" | "Staff" | "Non-staff";
export type ScopeFilter = "all" | NodeLevel;

export function filterUsers(users: OrgUser[], f: { query?: string; kind?: KindFilter; scope?: ScopeFilter }): OrgUser[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return users.filter((u) => {
    if (f.kind && f.kind !== "all" && u.kind !== f.kind) return false;
    if (f.scope && f.scope !== "all" && scopeRank(u) !== f.scope) return false;
    if (!q) return true;
    return `${u.user_name} ${u.ident}`.toLowerCase().includes(q);
  });
}

export const grantsOfUser = (grants: OrgGrant[], ident: string) => grants.filter((g) => g.ident.toLowerCase() === ident.toLowerCase());

/** "Space Textiles › Textiles Division › KTM-HO › IT" - the names a grant reaches, outermost first. */
export function grantPath(g: OrgGrant): string[] {
  return [g.com_name, g.div_sno != null ? g.div_name : null, g.brn_sno != null ? g.brn_name : null, g.dept_sno != null ? g.dept_name : null]
    .filter((x): x is string => !!x);
}

/** Effective grants first (broadest first), then the ones a broader grant already covers. */
export function sortGrants(grants: OrgGrant[]): OrgGrant[] {
  return [...grants].sort((a, b) =>
    Number(!!b.is_effective) - Number(!!a.is_effective)
    || LEVEL_RANK[a.node_level] - LEVEL_RANK[b.node_level]
    || grantPath(a).join("›").localeCompare(grantPath(b).join("›"), undefined, { sensitivity: "base" }));
}

// ── presentation helpers ───────────────────────────────────────────────────────────────────────
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The name to greet someone by: the first word with more than one letter ("V.NATARAJAN" -> "Natarajan", "JAYAPRAKASH. K" -> "Jayaprakash"). */
export function firstName(name: string | null | undefined): string {
  const words = (name ?? "").split(/[\s.]+/).filter(Boolean);
  const first = words.find((w) => w.length > 1) ?? words[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-11-04T10:52:45" -> "04 Nov, 10:52". The database stores local time with no timezone, so the text is read as it is -
 * going through Date would shift it by the browser's offset (see the mssql useUTC note).
 */
export function formatStamp(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso ?? "");
  if (!m) return "—";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]}, ${m[4]}:${m[5]}`;
}

/** Whole seconds between two timestamps, clamped at 0. */
export function secondsAgo(thenMs: number | null, nowMs: number): number {
  if (thenMs == null) return 0;
  return Math.max(0, Math.round((nowMs - thenMs) / 1000));
}

export function agoLabel(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

// ── real-time: what changed between two snapshots (used to flash the rows / tiles that moved) ─────
export function diffOverview(prev: OrgOverview | null, next: OrgOverview): Set<string> {
  const changed = new Set<string>();
  if (!prev) return changed;

  const a = summarize(prev.nodes);
  const b = summarize(next.nodes);
  for (const l of LEVELS) if (a[l].total !== b[l].total || a[l].active !== b[l].active) changed.add(`tile:${l}`);
  if (prev.users.length !== next.users.length || prev.unassigned.length !== next.unassigned.length) changed.add("tile:people");

  const prevNodes = new Map(prev.nodes.map((n) => [nodeKey(n), n]));
  for (const n of next.nodes) {
    const p = prevNodes.get(nodeKey(n));
    if (!p || p.users_total !== n.users_total || p.users_full !== n.users_full || p.node_name !== n.node_name || p.is_active !== n.is_active) changed.add(`node:${nodeKey(n)}`);
  }

  const prevUsers = new Map(prev.users.map((u) => [u.ident.toLowerCase(), u]));
  for (const u of next.users) {
    const p = prevUsers.get(u.ident.toLowerCase());
    if (!p || p.last_updated !== u.last_updated || p.grant_count !== u.grant_count || p.screen_count !== u.screen_count) changed.add(`user:${u.ident.toLowerCase()}`);
  }
  return changed;
}
