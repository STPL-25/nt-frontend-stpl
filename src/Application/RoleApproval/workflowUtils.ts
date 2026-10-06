import type {
  StageOrderItem,
  WorkflowMasterRow,
  WorkflowTypeRow,
} from "./types/ApprovalWorkflowManagerTypes";
import { cleanCondition, normalizeCondition, validateCondition, type ConditionFieldDef } from "./approvalConditions";

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

// ─── Conditional routing & alternates on a stage (sql/99) ────────────────────

// Whether a workflow type supports conditions/alternates is NOT a fixed list of entity types: it is
// whatever the field registry (approval_condition_field) offers for that entity. The screen loads
// those fields and passes them here:
//   fields === null   not known yet (loading, or the request failed)
//   fields.length===0 this kind of workflow has no conditions
//   fields.length > 0 conditions + alternates are available, built from these fields
// "Not known" must never be treated as "none": that would silently strip saved conditions on save.
export type RoutingFields = ConditionFieldDef[] | null;

const hasRouting = (stage: StageOrderItem): boolean =>
  !!normalizeCondition(stage.condition) || (stage.alternates ?? []).length > 0;

/** The first thing wrong with a workflow type's stages, or null when they can be saved. */
export const validateStageRouting = (stages: StageOrderItem[], fields: RoutingFields): string | null => {
  if (fields === null) {
    return stages.some(hasRouting)
      ? "The condition fields for this workflow could not be loaded yet, so its conditions cannot be checked or saved — wait a moment and try again"
      : null;
  }
  if (fields.length === 0) return null;
  for (const [i, stage] of stages.entries()) {
    const label = stage.stage?.trim() || `Stage ${i + 1}`;
    const cond = normalizeCondition(stage.condition);
    if (i === 0 && cond) return `"${label}" is the first stage, which is always required — remove its condition or move it down`;
    const problem = validateCondition(cond, fields);
    if (problem) return `"${label}": ${problem}`;
    if ((stage.alternates ?? []).some((a) => String(a) === String(stage.approver_ecno)))
      return `"${label}": the alternate approver cannot be the approver themselves`;
  }
  return null;
};

/**
 * What is stored in workflow_stage.stage_order_json. With registered fields, conditions are tidied and an
 * empty condition / alternate list is left out (so untouched stages look exactly as before). For a workflow
 * type with no fields they are dropped (they would be silently ignored). When the fields are not known they
 * are left exactly as loaded.
 */
export const serializeStages = (stages: StageOrderItem[], fields: RoutingFields): string => {
  if (fields === null) return JSON.stringify(stages);
  return JSON.stringify(
    stages.map((stage) => {
      const { condition, alternates, ...rest } = stage;
      if (fields.length === 0) return rest;
      const cleaned = cleanCondition(normalizeCondition(condition));
      const alts = [...new Set((alternates ?? []).map(String).filter(Boolean))];
      return {
        ...rest,
        ...(cleaned ? { condition: cleaned } : {}),
        ...(alts.length ? { alternates: alts } : {}),
      };
    })
  );
};
