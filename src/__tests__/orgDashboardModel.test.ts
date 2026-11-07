import { describe, it, expect } from "vitest";
import {
  agoLabel, buildTree, companyReach, descendantCounts, diffOverview, expandableKeys, filterUsers, findTreeNode, firstName,
  formatStamp, grantPath, initials, nodeKey, pathTo, scopeLabel, secondsAgo, sortGrants, summarize, usersForNode, visibleRows,
  type OrgGrant, type OrgNode, type OrgOverview, type OrgUser,
} from "@/Application/OrgDashboard/orgDashboardModel";

let id = 0;
const node = (over: Partial<OrgNode>): OrgNode => ({
  node_id: ++id, node_level: "company", com_sno: 1, div_sno: null, brn_sno: null, dept_sno: null, node_name: "X", node_code: null,
  is_active: "Y", in_my_access: 1, users_total: 0, users_full: 0, ...over,
});
const user = (over: Partial<OrgUser>): OrgUser => ({
  ident: "KTM1", user_name: "Asha", kind: "Staff", grant_count: 1, company_grants: 0, division_grants: 0, branch_grants: 0, dept_grants: 0,
  screen_count: 3, last_updated: "2026-11-04T10:52:45", is_me: 0, ...over,
});

const COMPANY = node({ node_level: "company", com_sno: 1, node_name: "Space Textiles" });
const DIV = node({ node_level: "division", com_sno: 1, div_sno: 3, node_name: "Retail Division" });
const BRN = node({ node_level: "branch", com_sno: 1, div_sno: 3, brn_sno: 4, node_name: "KTM Branch" });
const DEPT_A = node({ node_level: "department", com_sno: 1, div_sno: 3, brn_sno: 4, dept_sno: 16, node_name: "Canteen" });
const DEPT_B = node({ node_level: "department", com_sno: 1, div_sno: 3, brn_sno: 4, dept_sno: 17, node_name: "Accounts", is_active: "N" });
const OTHER = node({ node_level: "company", com_sno: 2, node_name: "Garsons" });
const ALL = [DEPT_A, OTHER, BRN, COMPANY, DEPT_B, DIV];

describe("buildTree", () => {
  it("nests company > division > branch > department, sorted by name", () => {
    const tree = buildTree(ALL, { showInactive: true });
    expect(tree.map((t) => t.node.node_name)).toEqual(["Garsons", "Space Textiles"]);
    const co = tree[1];
    expect(co.children[0].node.node_name).toBe("Retail Division");
    expect(co.children[0].children[0].children.map((c) => c.node.node_name)).toEqual(["Accounts", "Canteen"]);
    expect(co.children[0].children[0].children[0].depth).toBe(3);
  });

  it("hides inactive nodes by default", () => {
    const names = (n: ReturnType<typeof buildTree>): string[] => n.flatMap((t) => [t.node.node_name ?? "", ...names(t.children)]);
    expect(names(buildTree(ALL))).not.toContain("Accounts");
    expect(names(buildTree(ALL, { showInactive: true }))).toContain("Accounts");
  });

  it("hides everything under an inactive node", () => {
    const deadDiv = { ...DIV, is_active: "N" };
    const names = (n: ReturnType<typeof buildTree>): string[] => n.flatMap((t) => [t.node.node_name ?? "", ...names(t.children)]);
    // the branch and departments are orphaned (their division is gone) and fall back to the company - still listed, never lost
    expect(names(buildTree([COMPANY, deadDiv, BRN, DEPT_A]))).toEqual(["Space Textiles", "KTM Branch", "Canteen"]);
  });

  it("attaches to the nearest visible ancestor when a parent is not in the list (context-only nodes are not always sent)", () => {
    const tree = buildTree([COMPANY, DEPT_A]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.node.node_name)).toEqual(["Canteen"]);
  });

  it("keeps a node whose company is not visible as a root", () => {
    expect(buildTree([DEPT_A]).map((t) => t.node.node_name)).toEqual(["Canteen"]);
  });
});

describe("visibleRows", () => {
  const tree = buildTree(ALL, { showInactive: true });
  it("shows only roots when nothing is expanded", () => {
    expect(visibleRows(tree, new Set()).map((t) => t.node.node_name)).toEqual(["Garsons", "Space Textiles"]);
  });
  it("shows children of expanded nodes", () => {
    const rows = visibleRows(tree, new Set([nodeKey(COMPANY)]));
    expect(rows.map((t) => t.node.node_name)).toEqual(["Garsons", "Space Textiles", "Retail Division"]);
  });
  it("expandableKeys lists every node that has children", () => {
    expect(expandableKeys(tree).sort()).toEqual([nodeKey(COMPANY), nodeKey(DIV), nodeKey(BRN)].sort());
  });
  it("a search keeps the ancestors of a match and ignores the expanded set", () => {
    const rows = visibleRows(tree, new Set(), "canteen");
    expect(rows.map((t) => t.node.node_name)).toEqual(["Space Textiles", "Retail Division", "KTM Branch", "Canteen"]);
  });
  it("a search that matches a branch also lists what is under it", () => {
    const rows = visibleRows(tree, new Set(), "ktm branch");
    expect(rows.map((t) => t.node.node_name)).toEqual(["Space Textiles", "Retail Division", "KTM Branch", "Accounts", "Canteen"]);
  });
  it("matches on code too, and returns nothing for no match", () => {
    const coded = buildTree([{ ...COMPANY, node_code: "STPL" }]);
    expect(visibleRows(coded, new Set(), "stpl")).toHaveLength(1);
    expect(visibleRows(tree, new Set(), "zzz")).toEqual([]);
  });
});

describe("tree lookups", () => {
  const tree = buildTree(ALL, { showInactive: true });
  it("findTreeNode / pathTo", () => {
    expect(findTreeNode(tree, nodeKey(DEPT_A))?.node.node_name).toBe("Canteen");
    expect(findTreeNode(tree, "nope")).toBeNull();
    expect(findTreeNode(tree, null)).toBeNull();
    expect(pathTo(tree, nodeKey(DEPT_A)).map((n) => n.node_name)).toEqual(["Space Textiles", "Retail Division", "KTM Branch", "Canteen"]);
    expect(pathTo(tree, null)).toEqual([]);
  });
  it("descendantCounts", () => {
    const co = findTreeNode(tree, nodeKey(COMPANY))!;
    expect(descendantCounts(co)).toEqual({ company: 0, division: 1, branch: 1, department: 2 });
  });
});

describe("summarize / companyReach", () => {
  it("counts active and inactive per level", () => {
    const s = summarize(ALL);
    expect(s.company).toEqual({ total: 2, active: 2, inactive: 0 });
    expect(s.department).toEqual({ total: 2, active: 1, inactive: 1 });
    expect(s.division.total).toBe(1);
  });
  it("companyReach splits full and partial, largest first", () => {
    const rows = companyReach([
      node({ com_sno: 1, node_name: "A", users_total: 5, users_full: 2 }),
      node({ com_sno: 2, node_name: "B", users_total: 7, users_full: 7 }),
      node({ com_sno: 3, node_name: "C", users_total: 5, users_full: 5 }),
      node({ com_sno: 4, node_name: "Dead", users_total: 9, users_full: 9, is_active: "N" }),
    ]);
    expect(rows.map((r) => [r.node.node_name, r.full, r.partial])).toEqual([["B", 7, 0], ["A", 2, 3], ["C", 5, 0]]);
  });
});

describe("users", () => {
  const users = [user({ ident: "A1", user_name: "Zed" }), user({ ident: "B2", user_name: "Amy" }), user({ ident: "C3", user_name: "Bob" })];
  it("usersForNode: full access first, then by name; unknown identities are dropped", () => {
    const rows = usersForNode(9, [
      { node_id: 9, ident: "A1", is_full: true }, { node_id: 9, ident: "B2", is_full: false }, { node_id: 9, ident: "C3", is_full: true },
      { node_id: 9, ident: "ghost", is_full: true }, { node_id: 8, ident: "A1", is_full: true },
    ], users);
    expect(rows.map((r) => [r.user.user_name, r.isFull])).toEqual([["Bob", true], ["Zed", true], ["Amy", false]]);
  });
  it("usersForNode matches identities case-insensitively (production has ktm1166 / KTM1166)", () => {
    expect(usersForNode(1, [{ node_id: 1, ident: "KTM1166", is_full: 1 }], [user({ ident: "ktm1166" })])).toHaveLength(1);
  });
  it("scopeLabel names the broadest level held", () => {
    expect(scopeLabel(user({ company_grants: 1, dept_grants: 4 }))).toBe("Company-wide");
    expect(scopeLabel(user({ division_grants: 1 }))).toBe("Division level");
    expect(scopeLabel(user({ branch_grants: 2 }))).toBe("Branch level");
    expect(scopeLabel(user({ dept_grants: 2 }))).toBe("Department level");
    expect(scopeLabel(user({}))).toBe("No access");
  });
  it("filterUsers by text, type and broadest level", () => {
    const list = [
      user({ ident: "KTM1", user_name: "Asha", kind: "Staff", company_grants: 1 }),
      user({ ident: "NSU2", user_name: "Ravi Auditor", kind: "Non-staff", dept_grants: 2 }),
    ];
    expect(filterUsers(list, { query: "auditor" }).map((u) => u.ident)).toEqual(["NSU2"]);
    expect(filterUsers(list, { query: "ktm" }).map((u) => u.ident)).toEqual(["KTM1"]);
    expect(filterUsers(list, { kind: "Non-staff" }).map((u) => u.ident)).toEqual(["NSU2"]);
    expect(filterUsers(list, { scope: "company" }).map((u) => u.ident)).toEqual(["KTM1"]);
    expect(filterUsers(list, { scope: "department", kind: "Non-staff" }).map((u) => u.ident)).toEqual(["NSU2"]);
    expect(filterUsers(list, {})).toHaveLength(2);
  });
});

describe("grants", () => {
  const g = (over: Partial<OrgGrant>): OrgGrant => ({
    ident: "A", node_level: "company", com_sno: 1, com_name: "Space", div_sno: null, div_name: null, brn_sno: null, brn_name: null,
    dept_sno: null, dept_name: null, is_effective: 1, ...over,
  });
  it("grantPath lists the names outermost first and skips unnamed levels", () => {
    expect(grantPath(g({ node_level: "department", div_sno: 3, div_name: "Retail", brn_sno: 4, brn_name: "KTM", dept_sno: 16, dept_name: "Canteen" })))
      .toEqual(["Space", "Retail", "KTM", "Canteen"]);
    expect(grantPath(g({}))).toEqual(["Space"]);
  });
  it("sortGrants puts effective grants first, broadest first", () => {
    const sorted = sortGrants([
      g({ node_level: "department", dept_sno: 1, dept_name: "Z", is_effective: 0 }),
      g({ node_level: "branch", brn_sno: 4, brn_name: "KTM" }),
      g({ node_level: "company" }),
    ]);
    expect(sorted.map((x) => [x.node_level, !!x.is_effective])).toEqual([["company", true], ["branch", true], ["department", false]]);
  });
});

describe("presentation helpers", () => {
  it("initials / firstName", () => {
    expect(initials("JAYAPRAKASH. K")).toBe("JK");
    expect(initials("Vikram")).toBe("VI");
    expect(initials("  ")).toBe("?");
    expect(initials(null)).toBe("?");
    expect(firstName("V.NATARAJAN")).toBe("Natarajan");
    expect(firstName("JAYAPRAKASH. K")).toBe("Jayaprakash");
    expect(firstName("KEERTHIKA G")).toBe("Keerthika");
    expect(firstName("K")).toBe("K");
    expect(firstName("")).toBe("");
  });
  it("formatStamp reads the database's local time as written - no timezone shift", () => {
    expect(formatStamp("2026-11-04T10:52:45")).toBe("04 Nov, 10:52");
    expect(formatStamp("2026-01-09T00:05:00")).toBe("09 Jan, 00:05");
    expect(formatStamp(null)).toBe("—");
    expect(formatStamp("garbage")).toBe("—");
  });
  it("secondsAgo / agoLabel", () => {
    expect(secondsAgo(null, 5000)).toBe(0);
    expect(secondsAgo(1000, 4600)).toBe(4);
    expect(secondsAgo(9000, 1000)).toBe(0);
    expect(agoLabel(2)).toBe("just now");
    expect(agoLabel(42)).toBe("42s ago");
    expect(agoLabel(125)).toBe("2 min ago");
    expect(agoLabel(7300)).toBe("2 h ago");
  });
});

describe("diffOverview", () => {
  const base = (over: Partial<OrgOverview> = {}): OrgOverview => ({
    meta: { is_admin: 1, my_ident: "A", my_name: "A", my_kind: "Staff", my_grant_count: 1, my_screen_count: 1, server_now: "2026-11-04T10:00:00" },
    nodes: [{ ...COMPANY, users_total: 2, users_full: 1 }, { ...DIV, users_total: 1, users_full: 1 }],
    node_users: [], users: [user({ ident: "A", last_updated: "2026-11-04T09:00:00" })], grants: [], unassigned: [], ...over,
  });
  it("is empty on the first load", () => {
    expect(diffOverview(null, base()).size).toBe(0);
  });
  it("is empty when nothing moved", () => {
    expect(diffOverview(base(), base()).size).toBe(0);
  });
  it("flags a node whose user count moved, and a user whose access was just edited", () => {
    const next = base({
      nodes: [{ ...COMPANY, users_total: 3, users_full: 1 }, { ...DIV, users_total: 1, users_full: 1 }],
      users: [user({ ident: "A", last_updated: "2026-11-04T10:01:00" })],
    });
    const changed = diffOverview(base(), next);
    expect(changed.has(`node:${nodeKey(COMPANY)}`)).toBe(true);
    expect(changed.has(`node:${nodeKey(DIV)}`)).toBe(false);
    expect(changed.has("user:a")).toBe(true);
  });
  it("flags the tile of a level that gained a node, and the people tile when someone is added", () => {
    const next = base({ nodes: [...base().nodes, node({ node_level: "company", com_sno: 9, node_name: "New Co" })], users: [...base().users, user({ ident: "B" })] });
    const changed = diffOverview(base(), next);
    expect(changed.has("tile:company")).toBe(true);
    expect(changed.has("tile:division")).toBe(false);
    expect(changed.has("tile:people")).toBe(true);
    expect(changed.has("user:b")).toBe(true);
  });
});
