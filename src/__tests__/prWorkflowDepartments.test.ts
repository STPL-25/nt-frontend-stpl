import { describe, it, expect } from "vitest";
import { departmentsWithWorkflow } from "@/hooks/ReUsableHook/usePrWorkflowScopes";

const dept = (value: number, com: number, div: number, brn: number) => ({ value, label: `D${value}`, com_sno: com, div_sno: div, brn_sno: brn });

// Dept 16 (Canteen) and 21 (Packing) of TCS-Coimbatore (1/3/4) have a PR workflow; 20 (Stores) has none yet.
const depts = [dept(16, 1, 3, 4), dept(20, 1, 3, 4), dept(21, 1, 3, 4), dept(22, 1, 3, 5)];
const scopes = new Set(["1:3:4:16", "1:3:4:21"]);
const picked = { company: "1", division: "3", branch: "4" };

describe("departmentsWithWorkflow", () => {
  it("keeps only departments that have a workflow for the picked company/division/branch", () => {
    expect(departmentsWithWorkflow(depts.slice(0, 3), scopes, picked).map((d) => d.value)).toEqual([16, 21]);
  });

  it("leaves the list alone until the lookup has loaded or when it failed (null)", () => {
    expect(departmentsWithWorkflow(depts, null, picked)).toBe(depts);
  });

  it("keeps the department already on the form even if it has no workflow", () => {
    expect(departmentsWithWorkflow(depts.slice(0, 3), scopes, picked, "20").map((d) => d.value)).toEqual([16, 20, 21]);
    expect(departmentsWithWorkflow(depts.slice(0, 3), scopes, picked, 20).map((d) => d.value)).toEqual([16, 20, 21]);
  });

  it("an empty / missing keep value keeps nothing extra", () => {
    expect(departmentsWithWorkflow(depts.slice(0, 3), scopes, picked, "").map((d) => d.value)).toEqual([16, 21]);
    expect(departmentsWithWorkflow(depts.slice(0, 3), scopes, picked, null).map((d) => d.value)).toEqual([16, 21]);
  });

  it("matches the scope on the form's own company/division/branch, not another branch's", () => {
    // dept 21 has a workflow at branch 4 only; asked for branch 5 it must not match
    expect(departmentsWithWorkflow([dept(21, 1, 3, 5)], scopes, { company: "1", division: "3", branch: "5" })).toEqual([]);
  });

  it("uses a department's own org ids where the form has not picked a level yet", () => {
    expect(departmentsWithWorkflow(depts, scopes, {}).map((d) => d.value)).toEqual([16, 21]);
  });

  it("a workflow row whose division differs from the department's division does not match", () => {
    expect(departmentsWithWorkflow([dept(16, 1, 9, 4)], scopes, {})).toEqual([]);
  });

  it("returns nothing when no department has a workflow", () => {
    expect(departmentsWithWorkflow(depts, new Set(), picked)).toEqual([]);
  });
});
