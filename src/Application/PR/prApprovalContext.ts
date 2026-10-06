// Types + pure helpers for the PR approval screen's conditional-approval features
// (sql/99: conditions, forward, send back, edit-and-restart, alternates).

import { formatInr, PRIORITY_LABELS, type ConditionFieldDef } from "@/Application/RoleApproval/approvalConditions";

export type PrAction = "approve" | "reject" | "forward" | "send_back" | "edit" | "resubmit";

export type StageState =
  | "CURRENT" | "DONE" | "FORWARDED" | "SKIPPED" | "SENT_BACK" | "REJECTED" | "UPCOMING" | "NOT_REQUIRED";

export type MyRole = "PRIMARY" | "ALTERNATE" | "ALTERNATE_WAITING" | "REQUESTER" | "NONE";

export interface ApprovalSummary {
  pr_basic_sno: number;
  pr_no: string;
  pr_status: string;
  has_instance: boolean;
  cycle_no: number | null;
  current_seq: number | null;
  return_to_seq: number | null;
  awaiting_requester: boolean | null;
  current_since: string | null;
  my_role: MyRole;
  alternate_available_at: string | null;
  can_approve: boolean;
  can_reject: boolean;
  can_forward: boolean;
  can_send_back: boolean;
  can_edit: boolean;
  can_resubmit: boolean;
  request_mode: string;
  created_by: string;
  created_by_name: string | null;
  amount: number;
  priority_sno: number | null;
}

export interface ApprovalStageRow {
  seq: number;
  stage_name: string;
  approver_ecno: string;
  approver_name: string | null;
  alternate_names: string | null;
  escalation_hours: number;
  can_forward: string;
  can_backward: string;
  can_edit_data: string;
  condition_json: string | null;
  condition_met: boolean;
  state: StageState;
  acted_by: string | null;
  acted_by_name: string | null;
  acted_at: string | null;
  comments: string | null;
}

export interface ForwardTarget {
  seq: number;
  stage_name: string;
  approver_ecno: string;
  approver_name: string | null;
  required_by_rule: boolean;
}

export interface SendBackTarget {
  seq: number | null;
  stage_name: string;
  approver_ecno: string;
  approver_name: string | null;
  target_type: "REQUESTER" | "STAGE";
}

export interface ApprovalLogEntry {
  log_id: number;
  cycle_no: number;
  action: string;
  from_seq: number | null;
  to_seq: number | null;
  stage_name: string | null;
  acted_by: string | null;
  acted_by_name: string | null;
  acted_as: string | null;
  target_ecno: string | null;
  target_name: string | null;
  comments: string | null;
  before_json: string | null;
  after_json: string | null;
  acted_at: string | null;
}

export interface ApprovalContext {
  summary: ApprovalSummary | null;
  stages: ApprovalStageRow[];
  forwardTargets: ForwardTarget[];
  sendBackTargets: SendBackTarget[];
  log: ApprovalLogEntry[];
  /** What this workflow type's condition rules can test (labels, units, option sources) — the dictionary for describing them. */
  fields: ConditionFieldDef[];
}

// ── labels ───────────────────────────────────────────────────────────────────

export const ACTION_LABEL: Record<string, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  FORWARD: "Forwarded",
  SEND_BACK: "Sent back",
  RESUBMIT: "Resubmitted",
  EDIT: "Edited values",
  RESTART: "Approval restarted",
  SKIP: "Stage not needed",
};

export const STAGE_STATE_LABEL: Record<StageState, string> = {
  CURRENT: "Current",
  DONE: "Approved",
  FORWARDED: "Forwarded on",
  SKIPPED: "Skipped",
  SENT_BACK: "Sent back",
  REJECTED: "Rejected",
  UPCOMING: "Waiting",
  NOT_REQUIRED: "Not required",
};

export const personLabel = (name?: string | null, ecno?: string | null): string =>
  name && ecno && name !== ecno ? `${name} (${ecno})` : name || ecno || "—";

// ── PR values that can be edited ────────────────────────────────────────────

export interface EditItemDraft {
  pr_item_sno: number;
  name: string;
  uom: string;
  qty: string;
  est_cost: string;
  orig_qty: number;
  orig_cost: number;
}

export interface EditDraft {
  purpose: string;
  required_date: string; // yyyy-mm-dd
  priority_sno: string;
  orig_purpose: string;
  orig_required_date: string;
  orig_priority_sno: string;
  items: EditItemDraft[];
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/** A `date` column arrives as an ISO string at midnight UTC; the first ten characters are the date. */
export const toDateInput = (v: unknown): string => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : "");

/** Start an edit form from the PR as it is now. */
export function initEditDraft(pr: any, items: any[]): EditDraft {
  const purpose = String(pr?.purpose ?? "");
  const required = toDateInput(pr?.required_date);
  const priority = pr?.priority_sno != null ? String(pr.priority_sno) : "";
  return {
    purpose,
    required_date: required,
    priority_sno: priority,
    orig_purpose: purpose,
    orig_required_date: required,
    orig_priority_sno: priority,
    items: items
      .filter((i) => i?.pr_item_sno != null)
      .map((i) => ({
        pr_item_sno: Number(i.pr_item_sno),
        name: i.prod_name || i.service_name || `Item #${i.pr_item_sno}`,
        uom: i.uom_name ?? "",
        qty: String(num(i.qty)),
        est_cost: String(num(i.est_cost)),
        orig_qty: num(i.qty),
        orig_cost: num(i.est_cost),
      })),
  };
}

export const lineTotal = (i: Pick<EditItemDraft, "qty" | "est_cost">): number => num(i.qty) * num(i.est_cost);

export const draftTotal = (d: EditDraft): number => d.items.reduce((s, i) => s + lineTotal(i), 0);

/** Why the edit cannot be sent yet, or null. */
export function validateEditDraft(d: EditDraft): string | null {
  for (const i of d.items) {
    const qty = Number(i.qty);
    const cost = Number(i.est_cost);
    if (!Number.isFinite(qty) || qty <= 0) return `${i.name}: quantity must be more than zero`;
    if (!Number.isFinite(cost) || cost < 0) return `${i.name}: cost cannot be negative`;
    if (qty * cost > 9999999) return `${i.name}: the line total is too large`;
  }
  if (!d.required_date) return "Choose the required-by date";
  if (!d.purpose.trim()) return "Purpose cannot be empty";
  return null;
}

/** What actually changed, in the shape the API takes; `changed` is false when nothing differs. */
export function buildEditPayload(d: EditDraft): { edits: Record<string, unknown>; changed: boolean } {
  const edits: Record<string, unknown> = {};
  if (d.purpose.trim() !== d.orig_purpose.trim()) edits.purpose = d.purpose.trim();
  if (d.required_date && d.required_date !== d.orig_required_date) edits.required_date = d.required_date;
  if (d.priority_sno && d.priority_sno !== d.orig_priority_sno) edits.priority_sno = Number(d.priority_sno);
  const items = d.items
    .filter((i) => Number(i.qty) !== i.orig_qty || Number(i.est_cost) !== i.orig_cost)
    .map((i) => ({ pr_item_sno: i.pr_item_sno, qty: Number(i.qty), est_cost: Number(i.est_cost) }));
  if (items.length) edits.items = items;
  return { edits, changed: Object.keys(edits).length > 0 };
}

// ── describing a logged edit ────────────────────────────────────────────────

const parse = (raw: string | null | undefined): any => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * The before/after snapshots the engine stores on an EDIT row, as short human lines
 * ("Amount ₹1,20,000 → ₹30,000", "Ghee 12 → 3 …"). `itemNames` maps pr_item_sno to a product name.
 */
export function summarizeEdit(
  beforeJson: string | null | undefined,
  afterJson: string | null | undefined,
  itemNames: Record<number, string> = {}
): string[] {
  const before = parse(beforeJson);
  const after = parse(afterJson);
  if (!before || !after) return [];
  const lines: string[] = [];

  if (before.amount != null && after.amount != null && num(before.amount) !== num(after.amount))
    lines.push(`Amount ${formatInr(num(before.amount))} → ${formatInr(num(after.amount))}`);

  const bh = before.header ?? {};
  const ah = after.header ?? {};
  if (bh.purpose !== ah.purpose) lines.push(`Purpose "${bh.purpose ?? ""}" → "${ah.purpose ?? ""}"`);
  if (bh.required_date !== ah.required_date)
    lines.push(`Required by ${toDateInput(bh.required_date) || "—"} → ${toDateInput(ah.required_date) || "—"}`);
  if (bh.priority_sno !== ah.priority_sno)
    lines.push(
      `Priority ${PRIORITY_LABELS[bh.priority_sno] ?? bh.priority_sno} → ${PRIORITY_LABELS[ah.priority_sno] ?? ah.priority_sno}`
    );

  const beforeItems: any[] = Array.isArray(before.items) ? before.items : [];
  for (const a of Array.isArray(after.items) ? after.items : []) {
    const b = beforeItems.find((x) => x.pr_item_sno === a.pr_item_sno);
    if (!b) continue;
    const name = itemNames[a.pr_item_sno] ?? `Item #${a.pr_item_sno}`;
    if (num(b.qty) !== num(a.qty)) lines.push(`${name}: quantity ${num(b.qty)} → ${num(a.qty)}`);
    if (num(b.est_cost) !== num(a.est_cost))
      lines.push(`${name}: cost ${formatInr(num(b.est_cost))} → ${formatInr(num(a.est_cost))}`);
  }
  return lines;
}

/** "18 Sep 2026, 3:40 pm" — timestamps in this API are stored local, so read them as written. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return String(iso);
  const [, y, mo, d, h, mi] = m;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour = Number(h);
  return `${Number(d)} ${months[Number(mo) - 1]} ${y}, ${hour % 12 || 12}:${mi} ${hour >= 12 ? "pm" : "am"}`;
}

/** Toast text for a finished action. */
export function successMessage(action: PrAction, targetName?: string | null): string {
  switch (action) {
    case "approve": return "PR approved successfully";
    case "reject": return "PR rejected";
    case "forward": return targetName ? `Forwarded to ${targetName}` : "PR forwarded";
    case "send_back": return targetName ? `Sent back to ${targetName}` : "PR sent back";
    case "edit": return "Values updated — approval restarted from the first stage";
    case "resubmit": return "PR resubmitted for approval";
  }
}
