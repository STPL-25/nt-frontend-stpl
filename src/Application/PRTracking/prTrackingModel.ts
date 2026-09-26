import type { ApprovalStep, ApprovalStepState } from "@/components/ApprovalTrail";
import { formatDate } from "@/lib/formatDate";

// Shape returned by GET /api/pr_tracking/getTimeline/:pr_no — see
// backend-stpl/src/PRTracking/services/PRTracking.service.js#getPRTrackingTimeline, whose 15 result
// sets come from sql/96_pr_tracking_po_approval_and_names.sql's sp_nt_GetPRTrackingTimeline.
export interface PRTrackingTimelineData {
  prHeader: any[];
  quotations: any[];
  quotationHistory: any[];
  purchaseOrders: any[];
  poHistory: any[];
  dispatchSlips: any[];
  dispatchDeliveries: any[];
  gateEntries: any[];
  grns: any[];
  grnHistory: any[];
  inventoryMovements: any[];
  /** The PR's own approval chain (stage_no, stage_name, approver_ecno, approver_name), in order. */
  approvalStages: any[];
  /** One row per stage actually acted on: who, approve/reject, date, comment. */
  approvalHistory: any[];
  /** The approval chain(s) the quotations went through — the "PO approval". Absent on an older backend. */
  quotationStages?: any[];
  /** The PR row itself: status and who it is with right now. Absent on an older backend. */
  prCore?: any[];
}

export interface DeliveryLane {
  label: string;
  vendorSno?: number | string;
  quotations: any[];
  quotationHistory: any[];
  purchaseOrders: any[];
  poHistory: any[];
  dispatchSlips: any[];
  dispatchDeliveries: any[];
  gateEntries: any[];
  grns: any[];
  grnHistory: any[];
  inventoryMovements: any[];
}

/** A person's display name, falling back to their employee / login code. */
export function nameOf(name?: string | null, code?: string | null): string | null {
  const n = typeof name === "string" ? name.trim() : "";
  return n || (code ? String(code) : null);
}

const isSelected = (q: any) => q?.is_selected === "1" || q?.is_selected === 1 || q?.is_selected === true || q?.is_selected === "Y";

// ── Delivery lanes ────────────────────────────────────────────────────────────

/**
 * A PR can be split (by the Purchase Team, across vendors) AFTER approval —
 * supplier_quotation_info.pr_no / po_request_info.split_pr_no then carry a
 * suffixed pr_no ('PR26270008/1', '/2', ...) instead of the base one.
 * Everything downstream of a PO (dispatch/gate-entry/GRN/inventory) only
 * carries po_basic_sno, so it's bucketed into the same lane as its owning PO.
 * Returns one lane per distinct split label — a single-element result for an
 * unsplit PR, so callers don't need a separate code path for that case.
 */
export function buildDeliveryLanes(data: PRTrackingTimelineData): DeliveryLane[] {
  const labels = new Set<string>();
  (data.quotations ?? []).forEach((q) => q.pr_no && labels.add(q.pr_no));
  (data.purchaseOrders ?? []).forEach((po) => po.split_pr_no && labels.add(po.split_pr_no));
  if (labels.size === 0) {
    return [{
      label: data.prHeader?.[0]?.pr_no ?? "",
      quotations: [], quotationHistory: [], purchaseOrders: [], poHistory: [],
      dispatchSlips: [], dispatchDeliveries: [], gateEntries: [], grns: [],
      grnHistory: [], inventoryMovements: [],
    }];
  }

  const poToLabel = new Map<number, string>();
  (data.purchaseOrders ?? []).forEach((po) => poToLabel.set(po.po_basic_sno, po.split_pr_no));

  const dispatchSlipToLabel = new Map<number, string>();
  (data.dispatchSlips ?? []).forEach((d) => {
    const label = poToLabel.get(d.po_basic_sno);
    if (label) dispatchSlipToLabel.set(d.dispatch_slip_sno, label);
  });

  // Inventory movements reference the FORMATTED grn number ('GRN-2026-000019'); the SP sends it as grn_ref.
  const grnRefToLabel = new Map<string, string>();
  (data.grns ?? []).forEach((g) => {
    const label = poToLabel.get(g.po_basic_sno);
    if (!label) return;
    const ref =
      g.grn_ref ??
      (g.grn_no != null && g.created_date
        ? `GRN-${new Date(g.created_date).getFullYear()}-${String(g.grn_no).padStart(6, "0")}`
        : null);
    if (ref) grnRefToLabel.set(ref, label);
  });

  return Array.from(labels).sort().map((label) => {
    const lanePOs = (data.purchaseOrders ?? []).filter((po) => po.split_pr_no === label);
    return {
      label,
      vendorSno: lanePOs[0]?.vendor_sno ?? (data.quotations ?? []).find((q) => q.pr_no === label)?.vendor_sno,
      quotations: (data.quotations ?? []).filter((q) => q.pr_no === label),
      quotationHistory: (data.quotationHistory ?? []).filter((h) => h.pr_no === label),
      purchaseOrders: lanePOs,
      poHistory: (data.poHistory ?? []).filter((h) => poToLabel.get(h.po_basic_sno) === label),
      dispatchSlips: (data.dispatchSlips ?? []).filter((d) => poToLabel.get(d.po_basic_sno) === label),
      dispatchDeliveries: (data.dispatchDeliveries ?? []).filter(
        (d) => dispatchSlipToLabel.get(d.dispatch_slip_sno) === label
      ),
      gateEntries: (data.gateEntries ?? []).filter((g) => poToLabel.get(g.po_basic_sno) === label),
      grns: (data.grns ?? []).filter((g) => poToLabel.get(g.po_basic_sno) === label),
      grnHistory: (data.grnHistory ?? []).filter((h) => poToLabel.get(h.po_basic_sno) === label),
      inventoryMovements: (data.inventoryMovements ?? []).filter(
        (m) => grnRefToLabel.get(m.reference_no) === label
      ),
    };
  });
}

// ── PR approval ───────────────────────────────────────────────────────────────

export function prStatusOf(data: PRTrackingTimelineData): string | undefined {
  return data.prCore?.[0]?.status ?? data.prHeader?.[0]?.status;
}

/**
 * The PR's approval chain as a trail: every stage with its approver, and — for the ones
 * already acted on — the date and the comment they left. Stages are matched to history rows
 * by approver first; a stage whose approver did not act (someone acted for them) falls back
 * to its position in the history. History rows that belong to no stage — e.g. the Purchase
 * team's "PR SPLITED" entry recorded after approval — are appended as additional actions.
 */
export function buildPrApprovalSteps(data: PRTrackingTimelineData): ApprovalStep[] {
  const stages = data.approvalStages ?? [];
  const rows = data.approvalHistory ?? [];
  const status = prStatusOf(data);

  const used = rows.map(() => false);
  const assigned: any[] = stages.map(() => undefined);

  stages.forEach((st, i) => {
    const j = rows.findIndex((h, k) => !used[k] && h.status_by === st.approver_ecno);
    if (j >= 0) { used[j] = true; assigned[i] = rows[j]; }
  });
  stages.forEach((_, i) => {
    if (assigned[i] || i >= rows.length || used[i]) return;
    used[i] = true;
    assigned[i] = rows[i];
  });

  const firstOpen = assigned.findIndex((a) => !a);
  const steps: ApprovalStep[] = stages.map((st, i) => {
    const row = assigned[i];
    let state: ApprovalStepState;
    if (row) state = row.status === "R" ? "rejected" : "approved";
    else if (status === "A") state = "approved"; // approved with no per-stage record (e.g. older data)
    else if (status === "P" && i === firstOpen) state = "pending";
    else state = "upcoming";

    return {
      key: `pr-${st.stage_no ?? i}`,
      label: st.stage_name || `Stage ${st.stage_no ?? i + 1}`,
      person: nameOf(st.approver_name, st.approver_ecno),
      state,
      at: formatDate(row?.status_date),
      comment: row?.commends || null,
    };
  });

  // With no chain to lay out (its workflow was removed or never configured) the history rows ARE the
  // approvals; otherwise a leftover row is an action outside the chain.
  const noChain = stages.length === 0;
  rows.forEach((row, k) => {
    if (used[k]) return;
    steps.push({
      key: `pr-extra-${row.pr_history_sno ?? k}`,
      label: noChain ? "Approval" : "Additional action",
      person: nameOf(row.status_by_name, row.status_by),
      state: row.status === "R" ? "rejected" : "approved",
      at: formatDate(row.status_date),
      comment: row.commends || null,
    });
  });

  // Still pending but there is no chain to say who is next — name the approver it is with.
  if (noChain && status === "P") {
    const core = data.prCore?.[0];
    steps.push({
      key: "pr-pending",
      label: "Approval",
      person: nameOf(core?.current_approver_name, core?.current_approver_id) ?? "Approver not assigned",
      state: "pending",
    });
  }

  return steps;
}

// ── PO approval (quotation approval chain → PO raised) ───────────────────────

export interface PoApproval {
  steps: ApprovalStep[];
  /** The Purchase team member who picked the winning quotation. */
  selectedBy: { name: string | null; comment: string | null } | null;
  /** Who the approval is waiting on (null once the PO exists or nobody is holding it). */
  pendingWith: string | null;
  rejected: boolean;
  poRaised: boolean;
}

const uniqBy = <T,>(items: T[], key: (t: T) => string | undefined): T[] => {
  const seen = new Set<string | undefined>();
  return items.filter((it) => {
    const k = key(it);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * The "PO approval": the Purchase team picks a supplier quotation and it goes through an
 * approval chain; the last approval raises the PO (sp_nt_ApproveSupplierQuotation). Each
 * stage is matched to its approver's APPROVED / FINAL_APPROVED / REJECTED history row; the
 * stage the quotation currently sits with is "pending"; the rest are "upcoming". Once a PO
 * exists every stage counts as approved even if an old row lacks its history entry.
 */
export function buildPoApproval(lane: DeliveryLane, allStages: any[] = []): PoApproval {
  const hist = lane.quotationHistory ?? [];
  const poRaised = (lane.purchaseOrders ?? []).length > 0;

  const selection = hist.find((h) => h.action_type === "QUOTATION_SELECTION");
  const approvals = uniqBy(
    hist.filter((h) => h.action_type === "APPROVED" || h.action_type === "FINAL_APPROVED"),
    (h) => h.status_by
  );
  const rejections = uniqBy(hist.filter((h) => h.action_type === "REJECTED"), (h) => h.status_by);
  const transfers = hist.filter((h) => h.action_type === "FORWARD" || h.action_type === "BACKWARD");

  const active = lane.quotations.find((q) => q.status === "P" && q.approver_ecno);
  const currentApprover: string | null = active?.approver_ecno ?? null;

  const workflowId =
    (lane.quotations.find(isSelected) ?? lane.quotations.find((q) => q.workflow_types_id != null))?.workflow_types_id ??
    lane.quotations.map((q) => q.workflow_types_id).find((id) => id != null) ??
    null;
  const chain = workflowId != null ? allStages.filter((s) => s.workflow_types_id === workflowId) : [];

  const steps: ApprovalStep[] = [];

  if (chain.length > 0) {
    chain.forEach((st) => {
      const approved = approvals.find((h) => h.status_by === st.approver_ecno);
      const rejected = rejections.find((h) => h.status_by === st.approver_ecno);
      const forwarded = transfers.find((h) => h.status_by === st.approver_ecno);

      let state: ApprovalStepState;
      if (rejected) state = "rejected";
      else if (approved) state = "approved";
      else if (!poRaised && st.approver_ecno === currentApprover) state = "pending";
      else if (poRaised) state = "approved";
      else state = "upcoming";

      steps.push({
        key: `po-${st.workflow_types_id}-${st.stage_no}`,
        label: st.stage_name || `Stage ${st.stage_no}`,
        person: nameOf(st.approver_name, st.approver_ecno),
        state,
        comment: (approved ?? rejected)?.comment || null,
        note: forwarded ? `Forwarded to ${nameOf(forwarded.transferred_to_name, forwarded.transferred_to)}` : null,
      });
    });

    // Forwarded to someone who is not on the configured chain.
    if (!poRaised && currentApprover && !chain.some((s) => s.approver_ecno === currentApprover)) {
      steps.push({
        key: "po-forwarded",
        label: "Forwarded approval",
        person: nameOf(active?.approver_name, currentApprover),
        state: "pending",
      });
    }
  } else {
    // No configured chain to lay out (or none recorded) — show what actually happened.
    approvals.forEach((h, i) =>
      steps.push({
        key: `po-a-${i}`, label: "Approval", person: nameOf(h.status_by_name, h.status_by),
        state: "approved", comment: h.comment || null,
      })
    );
    rejections.forEach((h, i) =>
      steps.push({
        key: `po-r-${i}`, label: "Approval", person: nameOf(h.status_by_name, h.status_by),
        state: "rejected", comment: h.comment || null,
      })
    );
    if (!poRaised && currentApprover) {
      steps.push({
        key: "po-pending", label: "Approval", person: nameOf(active?.approver_name, currentApprover), state: "pending",
      });
    }
  }

  return {
    steps,
    selectedBy: selection ? { name: nameOf(selection.status_by_name, selection.status_by), comment: selection.comment || null } : null,
    pendingWith: poRaised ? null : nameOf(active?.approver_name, currentApprover),
    rejected: !poRaised && rejections.length > 0,
    poRaised,
  };
}

// ── Where is it now? ──────────────────────────────────────────────────────────

export type MilestoneKey = "raised" | "prApproved" | "poApproval" | "poRaised" | "gateEntry" | "grn" | "stock";
export type MilestoneState = "done" | "current" | "upcoming" | "rejected";

export const MILESTONES: { key: MilestoneKey; label: string }[] = [
  { key: "raised",     label: "PR Raised" },
  { key: "prApproved", label: "PR Approved" },
  { key: "poApproval", label: "PO Approval" },
  { key: "poRaised",   label: "PO Raised" },
  { key: "gateEntry",  label: "Gate Entry" },
  { key: "grn",        label: "GRN" },
  { key: "stock",      label: "Stock Updated" },
];

export interface Milestone { key: MilestoneKey; label: string; state: MilestoneState }

export interface TrackingSummary {
  milestones: Milestone[];
  /** One sentence: what stage it is at and who it is with. */
  headline: string;
  pendingWith: string | null;
  tone: "progress" | "done" | "rejected";
  /** 1-based position of the current milestone (7 when complete). */
  step: number;
}

const GRN_RECEIVED = new Set(["Received", "Partial", "Completed", "Posted"]);

function laneDone(lane: DeliveryLane): Record<"poApproval" | "poRaised" | "gateEntry" | "grn" | "stock", boolean> {
  const poRaised = lane.purchaseOrders.length > 0;
  return {
    poApproval: poRaised || lane.quotations.some((q) => q.status === "A"),
    poRaised,
    gateEntry: lane.gateEntries.length > 0,
    grn: lane.grns.length > 0,
    stock: lane.inventoryMovements.length > 0 || lane.grns.some((g) => GRN_RECEIVED.has(g.status)),
  };
}

/** The stage a PR that is already approved has reached in ONE delivery lane, in words. */
export function describeLane(
  lane: DeliveryLane,
  po: PoApproval
): { key: MilestoneKey; text: string; pendingWith: string | null; complete: boolean } {
  const d = laneDone(lane);
  const poLabel = lane.purchaseOrders[0]?.po_df_no ? `PO ${lane.purchaseOrders[0].po_df_no}` : "PO";
  const at = (key: MilestoneKey, text: string, pendingWith: string | null = null, complete = false) =>
    ({ key, text, pendingWith, complete });

  if (!d.poApproval) {
    if (po.rejected) return at("poApproval", "PO approval — quotation was rejected");
    if (po.pendingWith) return at("poApproval", `PO approval — with ${po.pendingWith}`, po.pendingWith);
    return at(
      "poApproval",
      lane.quotations.length
        ? "PR approved — quotation is being finalised by the Purchase team"
        : "PR approved — waiting for the Purchase team to collect supplier quotations"
    );
  }
  if (!d.poRaised) return at("poRaised", "PO approved — PO is being raised");
  if (!d.gateEntry) {
    return at(
      "gateEntry",
      lane.dispatchSlips.length
        ? `${poLabel} raised — supplier has dispatched, in transit`
        : `${poLabel} raised and sent — awaiting delivery at the gate`
    );
  }
  if (!d.grn) {
    const ge = lane.gateEntries[lane.gateEntries.length - 1];
    return at("grn", `Goods at the gate (${ge?.gate_entry_no ?? "gate entry"}) — GRN pending`);
  }
  if (!d.stock) return at("stock", "GRN done — stock update pending");
  return at("stock", "Complete — stock received", null, true);
}

/**
 * The header of the tracking sheet: a milestone bar (PR Raised → PR Approved → PO Approval → PO
 * Raised → Gate Entry → GRN → Stock Updated) and one sentence saying where the request is now.
 * A split PR has several delivery lanes; a milestone counts as done only when EVERY lane has
 * reached it, and the sentence describes the lane that is furthest behind.
 */
export function buildSummary(data: PRTrackingTimelineData, lanes: DeliveryLane[] = buildDeliveryLanes(data)): TrackingSummary {
  const status = prStatusOf(data);
  const core = data.prCore?.[0];
  const stages = data.quotationStages ?? [];
  const mk = (states: Partial<Record<MilestoneKey, MilestoneState>>, fallback: MilestoneState): Milestone[] =>
    MILESTONES.map((m) => ({ ...m, state: states[m.key] ?? fallback }));

  if (status === "R") {
    const rejecter = (data.approvalHistory ?? []).find((h) => h.status === "R");
    const who = nameOf(rejecter?.status_by_name, rejecter?.status_by);
    return {
      milestones: mk({ raised: "done", prApproved: "rejected" }, "upcoming"),
      headline: who ? `PR was rejected by ${who}` : "PR was rejected",
      pendingWith: null, tone: "rejected", step: 2,
    };
  }

  if (status !== "A") {
    const who = nameOf(core?.current_approver_name, core?.current_approver_id);
    return {
      milestones: mk({ raised: "done", prApproved: "current" }, "upcoming"),
      headline: who ? `PR approval — with ${who}` : "PR approval pending",
      pendingWith: who, tone: "progress", step: 2,
    };
  }

  const described = lanes.map((lane) => ({ lane, ...describeLane(lane, buildPoApproval(lane, stages)) }));
  const order = MILESTONES.map((m) => m.key);
  const behind = described.reduce((a, b) => (order.indexOf(b.key) < order.indexOf(a.key) ? b : a));
  const complete = described.every((d) => d.complete);

  const doneByKey: Record<MilestoneKey, boolean> = {
    raised: true,
    prApproved: true,
    poApproval: lanes.every((l) => laneDone(l).poApproval),
    poRaised: lanes.every((l) => laneDone(l).poRaised),
    gateEntry: lanes.every((l) => laneDone(l).gateEntry),
    grn: lanes.every((l) => laneDone(l).grn),
    stock: lanes.every((l) => laneDone(l).stock),
  };
  const firstOpen = order.find((k) => !doneByKey[k]);
  const milestones: Milestone[] = MILESTONES.map((m) => ({
    ...m,
    state: doneByKey[m.key] ? "done" : m.key === firstOpen ? "current" : "upcoming",
  }));

  const split = lanes.length > 1;
  const laneNo = described.indexOf(behind) + 1;
  return {
    milestones,
    headline: complete ? "Complete — stock received" : split ? `${behind.text} (delivery ${laneNo} of ${lanes.length})` : behind.text,
    pendingWith: complete ? null : behind.pendingWith,
    tone: complete ? "done" : "progress",
    step: complete ? MILESTONES.length : Math.max(1, order.indexOf(firstOpen ?? "stock") + 1),
  };
}
