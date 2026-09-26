import type {
  WorkflowMasterRow,
  WorkflowTypeRow,
} from "./types/ApprovalWorkflowManagerTypes";

// ─── Short workflow labels ────────────────────────────────────────────────────

// Entities that read better abbreviated; anything else is just un-camel-cased
// ("BankPaymentVoucher" -> "Bank Payment Voucher").
const ENTITY_SHORT: Record<string, string> = {
  PurchaseRequisition: "PR",
  PurchaseOrder: "PO",
  VendorDrivenPurchaseRequisition: "Vendor PR",
  ServiceVendorKYC: "Service KYC",
  ServicePO: "Service PO",
};

const MAX_BRANCHES_SHOWN = 2;

const humanize = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

const shortEntity = (entityType: string) =>
  ENTITY_SHORT[entityType] ?? humanize(entityType);

const splitList = (value?: string) =>
  (value ?? "")
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);

const isKyc = (wf: WorkflowMasterRow) => wf.entity_type?.toUpperCase() === "KYC";

/**
 * "PR · TCS · TCS-Coimbatore" — entity, division short name(s), branch(es).
 * KYC is just "KYC" unless `collapseKyc` is off.
 */
export const workflowShortLabel = (
  wf: WorkflowMasterRow,
  { collapseKyc = true }: { collapseKyc?: boolean } = {}
): string => {
  if (!wf.entity_type) return wf.workflow_name;
  const entity = shortEntity(wf.entity_type);
  if (collapseKyc && isKyc(wf)) return entity;

  const divisions = splitList(wf.division_short);
  const branches = splitList(wf.branch_names);

  const parts = [entity];
  if (divisions.length) parts.push(divisions.join("/"));
  if (branches.length) {
    const shown = branches.slice(0, MAX_BRANCHES_SHOWN).join(", ");
    const extra = branches.length - MAX_BRANCHES_SHOWN;
    parts.push(extra > 0 ? `${shown} +${extra}` : shown);
  }
  return parts.join(" · ");
};

const duplicated = (labels: Map<number, string>) => {
  const tally = new Map<string, number>();
  for (const label of labels.values()) tally.set(label, (tally.get(label) ?? 0) + 1);
  return (id: number) => (tally.get(labels.get(id)!) ?? 0) > 1;
};

/**
 * One short label per workflow, unique within the list.
 *  - a lone KYC workflow is plain "KYC"; if several exist they'd be
 *    indistinguishable, so those fall back to their division/branch label
 *  - anything still identical (e.g. three PR workflows for one branch) gets
 *    its workflow id appended
 */
export const buildWorkflowLabels = (rows: WorkflowMasterRow[]): Map<number, string> => {
  const labels = new Map<number, string>();
  for (const wf of rows) labels.set(wf.workflow_id, workflowShortLabel(wf));

  let isDup = duplicated(labels);
  for (const wf of rows) {
    if (isKyc(wf) && isDup(wf.workflow_id)) {
      labels.set(wf.workflow_id, workflowShortLabel(wf, { collapseKyc: false }));
    }
  }

  isDup = duplicated(labels);
  for (const wf of rows) {
    if (isDup(wf.workflow_id)) {
      labels.set(wf.workflow_id, `${labels.get(wf.workflow_id)} #${wf.workflow_id}`);
    }
  }
  return labels;
};

// ─── Edit-mode sync of a type's department rows ───────────────────────────────

export interface TypeRowSyncPlan {
  /** rows that stay — their name/description/active flag/stages are re-saved */
  keep: WorkflowTypeRow[];
  /** departments selected on the card that have no row yet */
  addDepts: string[];
  /** rows whose department (or, for branch-only legacy rows, branch) was deselected */
  remove: WorkflowTypeRow[];
}

/**
 * A type card is one row per department in workflow_types. Compare what the card
 * now selects against the rows it was loaded with, so a department added or
 * removed on an existing type actually reaches the database.
 *
 * Legacy rows with no department are keyed by branch instead: they stay unless
 * their branch was deselected, and are never dropped just because no department
 * is selected.
 */
export const planTypeRowSync = (
  rows: WorkflowTypeRow[],
  selectedDepts: string[],
  selectedBranches: string[]
): TypeRowSyncPlan => {
  const depts = new Set(selectedDepts.map(String));
  const branches = new Set(selectedBranches.map(String));
  const existingDepts = new Set(rows.filter((r) => r.dept_sno).map((r) => r.dept_sno));

  const keep: WorkflowTypeRow[] = [];
  const remove: WorkflowTypeRow[] = [];
  for (const row of rows) {
    const gone = row.dept_sno ? !depts.has(row.dept_sno) : !!row.brn_sno && !branches.has(row.brn_sno);
    (gone ? remove : keep).push(row);
  }

  const addDepts = [...depts].filter((d) => !existingDepts.has(d));
  return { keep, addDepts, remove };
};
