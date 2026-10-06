import { describe, it, expect } from "vitest";
import {
  buildDeliveryLanes, buildPrApprovalSteps, buildPoApproval, buildSummary,
  type PRTrackingTimelineData,
} from "@/Application/PRTracking/prTrackingModel";

// Modelled on the live PR26270026 (split into /1): one-stage PR approval, then a 3-stage
// quotation ("PO") approval, PO raised, gate entry, GRN, stock.
const QUOTATION_STAGES = [
  { workflow_types_id: 20, stage_no: 1, stage_name: "Purchase manager approval", approver_ecno: "SNV11097", approver_name: "KEERTHIKA G" },
  { workflow_types_id: 20, stage_no: 2, stage_name: "IA Approval", approver_ecno: "SNV11056", approver_name: "CHARLES FRANKLIN I" },
  { workflow_types_id: 20, stage_no: 3, stage_name: "Admin", approver_ecno: "KTM1004", approver_name: "M.SARAVANAKUMAR" },
];

const base = (over: Partial<PRTrackingTimelineData> = {}): PRTrackingTimelineData => ({
  prHeader: [{ pr_no: "PR26270026", status: "A", created_by: "KTM1148", created_by_name: "JAYAPRAKASH. K" }],
  prCore: [{ pr_no: "PR26270026", status: "A", current_approver_id: null, current_approver_name: null }],
  quotations: [], quotationHistory: [], purchaseOrders: [], poHistory: [],
  dispatchSlips: [], dispatchDeliveries: [], gateEntries: [], grns: [], grnHistory: [], inventoryMovements: [],
  approvalStages: [{ stage_no: 1, stage_name: "Manager Approval", approver_ecno: "KTM1006", approver_name: "V.NATARAJAN" }],
  approvalHistory: [
    { pr_history_sno: 1, status_by: "KTM1006", status_by_name: "V.NATARAJAN", status: "A", status_date: "2026-09-05", commends: "OK" },
  ],
  quotationStages: QUOTATION_STAGES,
  ...over,
});

const quotationApprovedFlow = (): Partial<PRTrackingTimelineData> => ({
  quotations: [{ sq_basic_sno: 32, pr_no: "PR26270026/1", status: "A", is_selected: "1", workflow_types_id: 20, approver_ecno: null }],
  quotationHistory: [
    { sq_history_sno: 132, pr_no: "PR26270026/1", action_type: "QUOTATION_SELECTION", status_by: "KTM1148", status_by_name: "JAYAPRAKASH. K", comment: "Supplier quotation selected" },
    { sq_history_sno: 133, pr_no: "PR26270026/1", action_type: "APPROVED", status_by: "SNV11097", status_by_name: "KEERTHIKA G", comment: "ok" },
    { sq_history_sno: 134, pr_no: "PR26270026/1", action_type: "APPROVED", status_by: "SNV11056", status_by_name: "CHARLES FRANKLIN I", comment: "fine by IA" },
    { sq_history_sno: 135, pr_no: "PR26270026/1", action_type: "FINAL_APPROVED", status_by: "KTM1004", status_by_name: "M.SARAVANAKUMAR", comment: "go ahead" },
    { sq_history_sno: 136, pr_no: "PR26270026/1", action_type: "PO_CREATED", status_by: "KTM1004", comment: "PO STPLSKTMCBE3003 auto-generated on final quotation approval" },
  ],
  purchaseOrders: [{ po_basic_sno: 62, po_df_no: "STPLSKTMCBE3003", split_pr_no: "PR26270026/1", status: "A", vendor_sno: 5 }],
});

describe("buildPrApprovalSteps", () => {
  it("shows the approver, date and comment for an approved stage", () => {
    const [step] = buildPrApprovalSteps(base());
    expect(step).toMatchObject({ person: "V.NATARAJAN", label: "Manager Approval", state: "approved", comment: "OK" });
    expect(step.at).toMatch(/2026/);
  });

  it("appends history that belongs to no stage (the Purchase team's PR SPLITED) as an additional action", () => {
    const steps = buildPrApprovalSteps(base({
      approvalHistory: [
        { pr_history_sno: 1, status_by: "KTM1006", status_by_name: "V.NATARAJAN", status: "A", status_date: "2026-09-05", commends: "OK" },
        { pr_history_sno: 2, status_by: "KTM1148", status_by_name: "JAYAPRAKASH. K", status: "A", status_date: "2026-09-05", commends: "PR SPLITED" },
      ],
    }));
    expect(steps).toHaveLength(2);
    expect(steps[0].state).toBe("approved");
    expect(steps[1]).toMatchObject({ label: "Additional action", person: "JAYAPRAKASH. K", comment: "PR SPLITED" });
  });

  it("marks the first un-acted stage pending and the rest upcoming while the PR is pending", () => {
    const steps = buildPrApprovalSteps(base({
      prHeader: [{ pr_no: "PR1", status: "P" }],
      prCore: [{ status: "P", current_approver_id: "KTM1006", current_approver_name: "V.NATARAJAN" }],
      approvalStages: [
        { stage_no: 1, stage_name: "Manager", approver_ecno: "KTM1006", approver_name: "V.NATARAJAN" },
        { stage_no: 2, stage_name: "Director", approver_ecno: "KTM1004", approver_name: "M.SARAVANAKUMAR" },
      ],
      approvalHistory: [],
    }));
    expect(steps.map((s) => s.state)).toEqual(["pending", "upcoming"]);
  });

  it("after stage 1 approves, stage 2 becomes pending", () => {
    const steps = buildPrApprovalSteps(base({
      prHeader: [{ pr_no: "PR1", status: "P" }],
      prCore: [{ status: "P" }],
      approvalStages: [
        { stage_no: 1, stage_name: "Manager", approver_ecno: "KTM1006", approver_name: "V.NATARAJAN" },
        { stage_no: 2, stage_name: "Director", approver_ecno: "KTM1004", approver_name: "M.SARAVANAKUMAR" },
      ],
      approvalHistory: [{ status_by: "KTM1006", status: "A", status_date: "2026-09-05", commends: "looks good" }],
    }));
    expect(steps.map((s) => s.state)).toEqual(["approved", "pending"]);
    expect(steps[0].comment).toBe("looks good");
  });

  it("marks a rejected stage as rejected with the reason", () => {
    const [step] = buildPrApprovalSteps(base({
      prHeader: [{ status: "R" }], prCore: [{ status: "R" }],
      approvalHistory: [{ status_by: "KTM1006", status_by_name: "V.NATARAJAN", status: "R", status_date: "2026-09-05", commends: "over budget" }],
    }));
    expect(step).toMatchObject({ state: "rejected", comment: "over budget" });
  });

  it("when the PR's workflow no longer exists, still names who it is with and lists what was recorded", () => {
    const steps = buildPrApprovalSteps(base({
      prHeader: [{ pr_no: "PR1", status: "P" }],
      prCore: [{ status: "P", current_approver_id: "TC12723", current_approver_name: "SATHRIYAN" }],
      approvalStages: [],
      approvalHistory: [{ pr_history_sno: 7, status_by: "KTM1006", status_by_name: "V.NATARAJAN", status: "A", status_date: "2026-09-05", commends: "fine" }],
    }));
    expect(steps.map((s) => [s.label, s.person, s.state])).toEqual([
      ["Approval", "V.NATARAJAN", "approved"],
      ["Approval", "SATHRIYAN", "pending"],
    ]);
  });

  it("falls back to the code when a name could not be resolved", () => {
    const [step] = buildPrApprovalSteps(base({
      approvalStages: [{ stage_no: 1, stage_name: "Store", approver_ecno: "ED001", approver_name: null }],
      approvalHistory: [{ status_by: "ED001", status: "A", status_date: "2026-09-05" }],
    }));
    expect(step.person).toBe("ED001");
  });
});

describe("buildPoApproval", () => {
  it("lays out the whole chain with each approver's comment once the PO is raised", () => {
    const data = base(quotationApprovedFlow());
    const [lane] = buildDeliveryLanes(data);
    const po = buildPoApproval(lane, data.quotationStages);

    expect(po.poRaised).toBe(true);
    expect(po.steps.map((s) => [s.person, s.state, s.comment])).toEqual([
      ["KEERTHIKA G", "approved", "ok"],
      ["CHARLES FRANKLIN I", "approved", "fine by IA"],
      ["M.SARAVANAKUMAR", "approved", "go ahead"],
    ]);
    expect(po.selectedBy).toMatchObject({ name: "JAYAPRAKASH. K" });
    expect(po.pendingWith).toBeNull();
  });

  it("shows who it is with now, and who is still to come, while the quotation is in approval", () => {
    const data = base({
      quotations: [{ sq_basic_sno: 32, pr_no: "PR26270026", status: "P", is_selected: "1", workflow_types_id: 20, approver_ecno: "SNV11056", approver_name: "CHARLES FRANKLIN I" }],
      quotationHistory: [
        { pr_no: "PR26270026", action_type: "QUOTATION_SELECTION", status_by: "KTM1148" },
        { pr_no: "PR26270026", action_type: "APPROVED", status_by: "SNV11097", status_by_name: "KEERTHIKA G", comment: "ok" },
      ],
    });
    const [lane] = buildDeliveryLanes(data);
    const po = buildPoApproval(lane, data.quotationStages);

    expect(po.steps.map((s) => s.state)).toEqual(["approved", "pending", "upcoming"]);
    expect(po.pendingWith).toBe("CHARLES FRANKLIN I");
    expect(po.poRaised).toBe(false);
  });

  it("notes a forward and shows the person it went to as pending even when off-chain", () => {
    const data = base({
      quotations: [{ pr_no: "PR26270026", status: "P", is_selected: "1", workflow_types_id: 20, approver_ecno: "TC12723", approver_name: "SATHRIYAN" }],
      quotationHistory: [
        { pr_no: "PR26270026", action_type: "FORWARD", status_by: "SNV11097", transferred_to: "TC12723", transferred_to_name: "SATHRIYAN" },
      ],
    });
    const [lane] = buildDeliveryLanes(data);
    const po = buildPoApproval(lane, data.quotationStages);

    expect(po.steps[0].note).toBe("Forwarded to SATHRIYAN");
    expect(po.steps[po.steps.length - 1]).toMatchObject({ label: "Forwarded approval", person: "SATHRIYAN", state: "pending" });
  });

  it("flags a rejected quotation", () => {
    const data = base({
      quotations: [{ pr_no: "PR26270026", status: "R", is_selected: "1", workflow_types_id: 20, approver_ecno: null }],
      quotationHistory: [{ pr_no: "PR26270026", action_type: "REJECTED", status_by: "SNV11097", comment: "too dear" }],
    });
    const [lane] = buildDeliveryLanes(data);
    const po = buildPoApproval(lane, data.quotationStages);
    expect(po.rejected).toBe(true);
    expect(po.steps[0]).toMatchObject({ state: "rejected", comment: "too dear" });
  });
});

describe("buildSummary", () => {
  const states = (s: ReturnType<typeof buildSummary>) => s.milestones.map((m) => `${m.key}:${m.state}`).join(" ");

  it("PR pending: names who it is with", () => {
    const s = buildSummary(base({
      prHeader: [{ status: "P" }],
      prCore: [{ status: "P", current_approver_id: "KTM1006", current_approver_name: "V.NATARAJAN" }],
    }));
    expect(s.headline).toBe("PR approval — with V.NATARAJAN");
    expect(s.pendingWith).toBe("V.NATARAJAN");
    expect(s.step).toBe(2);
    expect(states(s)).toBe(
      "raised:done prApproved:current poApproval:upcoming poRaised:upcoming gateEntry:upcoming grn:upcoming stock:upcoming"
    );
  });

  it("PR rejected: says who rejected it", () => {
    const s = buildSummary(base({
      prHeader: [{ status: "R" }], prCore: [{ status: "R" }],
      approvalHistory: [{ status_by: "KTM1006", status_by_name: "V.NATARAJAN", status: "R" }],
    }));
    expect(s.tone).toBe("rejected");
    expect(s.headline).toBe("PR was rejected by V.NATARAJAN");
    expect(s.milestones[1].state).toBe("rejected");
  });

  it("PR approved, nothing from Purchase yet", () => {
    const s = buildSummary(base());
    expect(s.headline).toMatch(/waiting for the Purchase team to collect supplier quotations/);
    expect(s.milestones.find((m) => m.state === "current")?.key).toBe("poApproval");
  });

  it("quotation in approval: PO approval — with <approver>", () => {
    const s = buildSummary(base({
      quotations: [{ pr_no: "PR26270026", status: "P", is_selected: "1", workflow_types_id: 20, approver_ecno: "SNV11056", approver_name: "CHARLES FRANKLIN I" }],
    }));
    expect(s.headline).toBe("PO approval — with CHARLES FRANKLIN I");
    expect(s.step).toBe(3);
  });

  it("PO raised, waiting for the gate", () => {
    const s = buildSummary(base(quotationApprovedFlow()));
    expect(s.headline).toBe("PO STPLSKTMCBE3003 raised and sent — awaiting delivery at the gate");
    expect(s.milestones.find((m) => m.state === "current")?.key).toBe("gateEntry");
  });

  it("gate entry done, GRN pending", () => {
    const s = buildSummary(base({ ...quotationApprovedFlow(), gateEntries: [{ po_basic_sno: 62, gate_entry_no: "GE-2026-000043" }] }));
    expect(s.headline).toBe("Goods at the gate (GE-2026-000043) — GRN pending");
  });

  it("GRN done and stock updated: complete", () => {
    const s = buildSummary(base({
      ...quotationApprovedFlow(),
      gateEntries: [{ po_basic_sno: 62, gate_entry_no: "GE-1" }],
      grns: [{ po_basic_sno: 62, grn_no: 27, grn_ref: "GRN-2026-000027", status: "Received", created_date: "2026-09-05" }],
      inventoryMovements: [{ reference_no: "GRN-2026-000027", quantity: 5 }],
    }));
    expect(s.tone).toBe("done");
    expect(s.headline).toBe("Complete — stock received");
    expect(s.step).toBe(7);
    expect(s.milestones.every((m) => m.state === "done")).toBe(true);
  });

  it("a split PR is only as far along as its slowest delivery", () => {
    const data = base({
      quotations: [
        { sq_basic_sno: 1, pr_no: "PR26270026/1", status: "A", is_selected: "1", workflow_types_id: 20 },
        { sq_basic_sno: 2, pr_no: "PR26270026/2", status: "A", is_selected: "1", workflow_types_id: 20 },
      ],
      purchaseOrders: [
        { po_basic_sno: 61, po_df_no: "PO-A", split_pr_no: "PR26270026/1", status: "A" },
        { po_basic_sno: 62, po_df_no: "PO-B", split_pr_no: "PR26270026/2", status: "A" },
      ],
      gateEntries: [{ po_basic_sno: 61, gate_entry_no: "GE-1" }],
    });
    const s = buildSummary(data);
    expect(s.headline).toMatch(/PO-B raised.*\(delivery 2 of 2\)/);
    expect(s.milestones.find((m) => m.key === "gateEntry")?.state).toBe("current");
  });

  it("still works against an older backend that sends neither prCore nor quotationStages", () => {
    const data = base({ prCore: undefined, quotationStages: undefined, ...quotationApprovedFlow() });
    expect(() => buildSummary(data)).not.toThrow();
    expect(buildPoApproval(buildDeliveryLanes(data)[0], data.quotationStages).steps.length).toBeGreaterThan(0);
  });
});

// ── sql/99: the trail built from the conditional-approval engine ──────────────
describe("buildPrApprovalSteps — conditional approval engine", () => {
  const stage = (seq: number, name: string, ecno: string, approver: string, state: string, over: Record<string, unknown> = {}) => ({
    seq, stage_name: name, approver_ecno: ecno, approver_name: approver, alternate_names: null, escalation_hours: 24,
    state, acted_by: null, acted_by_name: null, acted_at: null, comments: null, ...over,
  });
  const engine = (stages: any[], log: any[] = [], summary: Record<string, unknown> = {}) => ({
    summary: { has_instance: true, cycle_no: 1, awaiting_requester: false, ...summary }, stages, log,
  });

  it("leaves out stages the PR's values did not require instead of showing them approved", () => {
    const steps = buildPrApprovalSteps(base({
      prCore: [{ status: "A" }],
      approvalEngine: engine([
        stage(0, "Admin", "A1", "ADMIN", "DONE", { acted_by: "A1", acted_by_name: "ADMIN", acted_at: "2026-09-26T10:00:00.000Z", comments: "ok" }),
        stage(1, "GM", "G1", "GM", "SKIPPED"),
        stage(2, "ED", "E1", "ED", "NOT_REQUIRED"),
      ]),
    }));
    expect(steps.map((s) => [s.label, s.state])).toEqual([["Admin", "approved"]]);
    expect(steps[0].comment).toBe("ok");
  });

  it("shows the current stage as pending and later required ones as upcoming", () => {
    const steps = buildPrApprovalSteps(base({
      prCore: [{ status: "P" }],
      approvalEngine: engine([
        stage(0, "Admin", "A1", "ADMIN", "DONE", { acted_by: "A1", acted_by_name: "ADMIN" }),
        stage(1, "GM", "G1", "GM", "CURRENT", { alternate_names: "PRIYA" }),
        stage(2, "ED", "E1", "ED", "UPCOMING"),
      ]),
    }));
    expect(steps.map((s) => s.state)).toEqual(["approved", "pending", "upcoming"]);
    expect(steps[1].note).toBe("Alternate: PRIYA (can act after 24h)");
  });

  it("says when an alternate approved for someone", () => {
    const [step] = buildPrApprovalSteps(base({
      approvalEngine: engine([stage(0, "Admin", "A1", "ADMIN", "DONE", { acted_by: "B2", acted_by_name: "BACKUP" })]),
    }));
    expect(step).toMatchObject({ person: "BACKUP", note: "On behalf of ADMIN (alternate)" });
  });

  it("tells a forward: the forwarding stage counts as handled, the bypassed one is not listed", () => {
    const steps = buildPrApprovalSteps(base({
      prCore: [{ status: "P" }],
      approvalEngine: engine(
        [
          stage(0, "Admin", "A1", "ADMIN", "FORWARDED", { acted_by: "A1", acted_by_name: "ADMIN", comments: "needs ED" }),
          stage(1, "GM", "G1", "GM", "SKIPPED"),
          stage(2, "ED", "E1", "ED", "CURRENT"),
        ],
        [{ cycle_no: 1, action: "FORWARD", from_seq: 0, target_name: "ED" }]
      ),
    }));
    expect(steps.map((s) => [s.label, s.state, s.word ?? null])).toEqual([["Admin", "approved", "Forwarded"], ["ED", "pending", null]]);
    expect(steps[0].note).toBe("Forwarded to ED");
  });

  it("tells a send-back to the requester, keeping the sender pending", () => {
    const steps = buildPrApprovalSteps(base({
      prCore: [{ status: "P" }],
      approvalEngine: engine(
        [
          stage(0, "Admin", "A1", "ADMIN", "DONE", { acted_by: "A1", acted_by_name: "ADMIN" }),
          stage(1, "GM", "G1", "GM", "SENT_BACK", { acted_by: "G1", acted_by_name: "GM", acted_at: "2026-09-26T11:00:00.000Z" }),
        ],
        [{ cycle_no: 1, action: "SEND_BACK", from_seq: 1, target_name: "LEENA", comments: "attach quotation" }],
        { awaiting_requester: true }
      ),
    }));
    expect(steps[1]).toMatchObject({ state: "pending", word: "Sent back", comment: "attach quotation" });
    expect(steps[1].note).toBe("Sent back to LEENA — returns here once they respond");
  });

  it("opens a restarted PR with what was edited, by whom and why", () => {
    const steps = buildPrApprovalSteps(base({
      prCore: [{ status: "P" }],
      approvalEngine: engine(
        [stage(0, "Admin", "A1", "ADMIN", "CURRENT"), stage(1, "GM", "G1", "GM", "UPCOMING")],
        [{ cycle_no: 1, action: "EDIT", acted_by: "G1", acted_by_name: "GM", comments: "cut quantity", acted_at: "2026-09-26T12:00:00.000Z" }],
        { cycle_no: 2 }
      ),
    }));
    expect(steps[0]).toMatchObject({ label: "Values edited — approval restarted (round 2)", person: "GM", word: "Restarted", comment: "cut quantity" });
    expect(steps.slice(1).map((s) => s.state)).toEqual(["pending", "upcoming"]);
  });

  it("marks a rejection", () => {
    const steps = buildPrApprovalSteps(base({
      prCore: [{ status: "R" }],
      approvalEngine: engine([stage(0, "Admin", "A1", "ADMIN", "REJECTED", { acted_by: "A1", acted_by_name: "ADMIN", comments: "no budget" })]),
    }));
    expect(steps[0]).toMatchObject({ state: "rejected", comment: "no budget" });
  });

  it("falls back to the plain history when the engine has nothing on the PR", () => {
    const plain = buildPrApprovalSteps(base());
    expect(buildPrApprovalSteps(base({ approvalEngine: null }))).toEqual(plain);
    expect(buildPrApprovalSteps(base({ approvalEngine: { summary: { has_instance: false }, stages: [], log: [] } }))).toEqual(plain);
  });
});
