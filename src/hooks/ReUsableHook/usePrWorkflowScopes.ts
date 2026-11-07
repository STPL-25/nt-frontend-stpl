import { useMemo } from "react";
import useFetch from "@/hooks/useFetchHook";
import { apiGetPrWorkflowDepartments } from "@/Services/Api";

/** NORMAL = regular requisition, VENDOR_DRIVEN = vendor-driven requisition (each routes to its own approval workflow). */
export type PrVariant = "NORMAL" | "VENDOR_DRIVEN";

interface WorkflowScopeRow {
  com_sno: string | number;
  div_sno: string | number;
  brn_sno: string | number;
  dept_sno: string | number;
}

const scopeKey = (com: unknown, div: unknown, brn: unknown, dept: unknown) =>
  [com, div, brn, dept].map((v) => String(v ?? "")).join(":");

/**
 * The organisation scopes ("com:div:brn:dept") a requisition of this kind can be raised for, i.e. that have an
 * approval workflow — the same exact company/division/branch/department match the PR insert procedures use.
 *
 * `null` while loading or if the lookup failed: callers then leave the list alone, so a failed lookup can never
 * leave the Department dropdown empty (submitting a department without a workflow still gets the server's error).
 */
export const usePrWorkflowScopes = (variant: PrVariant): ReadonlySet<string> | null => {
  const params = useMemo(() => ({ variant }), [variant]);
  const { data } = useFetch<{ data?: WorkflowScopeRow[] }>(apiGetPrWorkflowDepartments, "", params);
  return useMemo(
    () =>
      Array.isArray(data?.data)
        ? new Set(data!.data!.map((r) => scopeKey(r.com_sno, r.div_sno, r.brn_sno, r.dept_sno)))
        : null,
    [data]
  );
};

export interface DeptWithOrg {
  value: string | number;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
}

/**
 * Keep only the departments a requisition can actually be raised for. A department's scope is the company /
 * division / branch picked on the form (its own where one is not picked yet) plus the department itself.
 * `keepDeptSno` — the department already chosen on the form (the user's locked home department, or a loaded
 * draft's) — always stays listed so the field never goes blank under the user.
 */
export const departmentsWithWorkflow = <T extends DeptWithOrg>(
  depts: T[],
  scopes: ReadonlySet<string> | null,
  selected: { company?: string; division?: string; branch?: string },
  keepDeptSno?: string | number | null
): T[] => {
  if (!scopes) return depts;
  const keep = keepDeptSno == null || keepDeptSno === "" ? null : String(keepDeptSno);
  return depts.filter(
    (d) =>
      String(d.value) === keep ||
      scopes.has(
        scopeKey(
          selected.company || d.com_sno,
          selected.division || d.div_sno,
          selected.branch || d.brn_sno,
          d.value
        )
      )
  );
};
