import { describe, it, expect } from "vitest";
import {
  approverLabel, blockedReason, decisionBody, decisionFlags, decisionMessage, defaultTarget, needsRemarks, needsTarget,
  nextStageAfterApprove, paymentApprovalContext, type PaymentApprovalContext,
} from "@/Application/Payment/paymentApprovalModel";
import type { ApprovalStageRow, StageState } from "@/Application/PR/prApprovalContext";
import type { PaymentApproval, PaymentApprovalSummary } from "@/Services/GrnService/paymentNetApi";

// The workflow seeded by sql/67: IA Approval (NSU00002) for every payment, Admin Approval (KTM1006) only above ₹50,000.
const stage = (seq: number, over: Partial<ApprovalStageRow> = {}): ApprovalStageRow => ({
  seq, stage_name: seq === 0 ? "IA Approval" : seq === 1 ? "Admin Approval" : "Finance Head",
  approver_ecno: seq === 0 ? "NSU00002" : seq === 1 ? "KTM1006" : "KTM1148", approver_name: seq === 0 ? "Interal Auditor" : seq === 1 ? "V.NATARAJAN" : null,
  alternate_names: null, escalation_hours: 24, can_forward: "Y", can_backward: "Y", can_edit_data: "N",
  condition_json: seq === 1 ? '{"match":"all","rules":[{"field":"amount","op":"gt","value":50000}]}' : null,
  condition_met: true, state: "UPCOMING", acted_by: null, acted_by_name: null, acted_at: null, comments: null, ...over,
});
const summary = (over: Partial<PaymentApprovalSummary> = {}): PaymentApprovalSummary => ({
  payment_sno: 7, payment_status: "Pending Approval", entity_type: "Payment", has_instance: true, cycle_no: 1, current_seq: 0, return_to_seq: null,
  current_since: "2026-10-22T10:00:00", my_role: "PRIMARY", alternate_available_at: null,
  can_approve: true, can_reject: true, can_forward: true, can_send_back: false, amount: 86400, gross_amount: 86400, created_by: "KTM1148", ...over,
});
const approval = (over: Partial<PaymentApproval> = {}): PaymentApproval => ({
  summary: summary(), forward_targets: [{ seq: 1, stage_name: "Admin Approval", approver_ecno: "KTM1006", approver_name: "V.NATARAJAN", required_by_rule: true }],
  send_back_targets: [], log: [], condition_fields: [{ field_key: "amount", field_label: "Amount (net payable)", value_kind: "number", unit: "INR" }], ...over,
});
const ctxOf = (stages: ApprovalStageRow[], a: PaymentApproval): PaymentApprovalContext => paymentApprovalContext({ stages, approval: a })!;
const states = (...s: StageState[]) => s.map((state, seq) => stage(seq, { state }));

describe("paymentApprovalContext", () => {
  it("gives the shared path component what it reads: summary, stages, targets, log and the field dictionary", () => {
    const stages = states("CURRENT", "UPCOMING");
    const ctx = paymentApprovalContext({ stages, approval: approval() })!;
    expect(ctx.stages).toBe(stages);
    expect(ctx.summary?.amount).toBe(86400);
    expect(ctx.forwardTargets.map((t) => t.seq)).toEqual([1]);
    expect(ctx.fields[0].field_key).toBe("amount");
  });

  it("is null when the payment has no approval record - approved at once, or saved before approval existed", () => {
    expect(paymentApprovalContext({ stages: [], approval: approval({ summary: summary({ has_instance: false }) }) })).toBeNull();
    expect(paymentApprovalContext({ stages: [], approval: approval({ summary: null }) })).toBeNull();
    expect(paymentApprovalContext(null)).toBeNull();
  });
});

describe("decisionFlags", () => {
  const ctx = (s: Partial<PaymentApprovalSummary>) => ctxOf(states("CURRENT", "UPCOMING"), approval({ summary: summary(s) }));

  it("follows what the database allows", () => {
    expect(decisionFlags(ctx({}), false)).toEqual({ approve: true, reject: true, forward: true, sendBack: false });
    expect(decisionFlags(ctx({ can_forward: false, can_send_back: true }), false)).toEqual({ approve: true, reject: true, forward: false, sendBack: true });
  });

  it("gives nothing to someone who may not act - not even Forward - and an alternate still waiting", () => {
    expect(decisionFlags(ctx({ can_approve: false, can_reject: false, can_forward: true, my_role: "NONE" }), false)).toEqual({ approve: false, reject: false, forward: false, sendBack: false });
    expect(decisionFlags(ctx({ can_approve: false, can_reject: false, my_role: "ALTERNATE_WAITING" }), false).approve).toBe(false);
  });

  it("a payment the engine has no record of but that waits on the user can still be approved or rejected, nothing more", () => {
    expect(decisionFlags(null, true)).toEqual({ approve: true, reject: true, forward: false, sendBack: false });
    expect(decisionFlags(null, false)).toEqual({ approve: false, reject: false, forward: false, sendBack: false });
  });
});

describe("nextStageAfterApprove", () => {
  it("is the next stage the rules need", () => {
    const ctx = ctxOf(states("CURRENT", "UPCOMING"), approval());
    expect(nextStageAfterApprove(ctx)?.stage_name).toBe("Admin Approval");
  });

  it("skips a stage the amount does not need - this is then the last approval", () => {
    const ctx = ctxOf(states("CURRENT", "NOT_REQUIRED"), approval({ summary: summary({ amount: 283.2 }) }));
    expect(nextStageAfterApprove(ctx)).toBeNull();
  });

  it("skips over a not-required stage to a later required one", () => {
    const ctx = ctxOf(states("CURRENT", "NOT_REQUIRED", "UPCOMING"), approval());
    expect(nextStageAfterApprove(ctx)?.approver_ecno).toBe("KTM1148");
  });

  it("after a send back it resumes at the stage that sent it back, whatever the rules say", () => {
    const stages = states("CURRENT", "NOT_REQUIRED");
    stages[1] = stage(1, { state: "NOT_REQUIRED", condition_met: false });
    const ctx = ctxOf(stages, approval({ summary: summary({ current_seq: 0, return_to_seq: 1, amount: 40000 }) }));
    expect(nextStageAfterApprove(ctx)?.approver_ecno).toBe("KTM1006");
  });

  it("is null once nothing is current", () => {
    expect(nextStageAfterApprove(ctxOf(states("DONE", "DONE"), approval({ summary: summary({ current_seq: null }) })))).toBeNull();
    expect(nextStageAfterApprove(null)).toBeNull();
  });
});

describe("what Forward and Send back offer first", () => {
  const fwd = (seq: number, required: boolean) => ({ seq, stage_name: `S${seq}`, approver_ecno: `E${seq}`, approver_name: null, required_by_rule: required });
  const back = (seq: number) => ({ seq, stage_name: `S${seq}`, approver_ecno: `E${seq}`, approver_name: null, target_type: "STAGE" as const });
  const ctx = (a: Partial<PaymentApproval>) => ctxOf(states("DONE", "DONE", "CURRENT", "UPCOMING"), approval(a));

  it("forward starts on the first stage the rules need, else on the nearest one", () => {
    expect(defaultTarget("forward", ctx({ forward_targets: [fwd(3, false), fwd(4, true)] }))).toBe("4");
    expect(defaultTarget("forward", ctx({ forward_targets: [fwd(3, false), fwd(4, false)] }))).toBe("3");
    expect(defaultTarget("forward", ctx({ forward_targets: [] }))).toBe("");
  });

  it("send back starts on the nearest earlier approver, and stage 0 is a real choice", () => {
    expect(defaultTarget("send_back", ctx({ send_back_targets: [back(0), back(1)] }))).toBe("1");
    expect(defaultTarget("send_back", ctx({ send_back_targets: [back(0)] }))).toBe("0");
  });

  it("approve and reject pick nobody", () => {
    expect(defaultTarget("approve", ctx({}))).toBe("");
    expect(defaultTarget("reject", ctx({}))).toBe("");
    expect(defaultTarget("forward", null)).toBe("");
  });
});

describe("blockedReason", () => {
  const stages = states("CURRENT", "UPCOMING");
  const ctx = ctxOf(stages, approval({ send_back_targets: [{ seq: 0, stage_name: "IA Approval", approver_ecno: "NSU00002", approver_name: null, target_type: "STAGE" }] }));
  const noTargets = ctxOf(stages, approval({ forward_targets: [], send_back_targets: [] }));

  it("approve needs nothing", () => {
    expect(blockedReason("approve", "", "", ctx)).toBeNull();
  });

  it("reject and send back need the reason", () => {
    expect(blockedReason("reject", "  ", "", ctx)).toMatch(/reason/);
    expect(blockedReason("reject", "wrong bank", "", ctx)).toBeNull();
    expect(blockedReason("send_back", "", "0", ctx)).toMatch(/checked or corrected/);
    expect(blockedReason("send_back", "check the account", "0", ctx)).toBeNull();
  });

  it("forward needs one of the offered stages; remarks are optional", () => {
    expect(blockedReason("forward", "", "", ctx)).toMatch(/Choose/);
    expect(blockedReason("forward", "", "5", ctx)).toMatch(/Choose/);
    expect(blockedReason("forward", "", "1", ctx)).toBeNull();
  });

  it("send back to stage 0 is accepted - '0' is not 'nothing chosen'", () => {
    expect(blockedReason("send_back", "why", "0", ctx)).toBeNull();
    expect(blockedReason("send_back", "why", "", ctx)).toMatch(/Choose/);
  });

  it("says so when there is nowhere to go", () => {
    expect(blockedReason("forward", "", "1", noTargets)).toMatch(/no later stage/);
    expect(blockedReason("send_back", "why", "0", noTargets)).toMatch(/nobody to send/);
    expect(blockedReason("forward", "", "1", null)).toMatch(/no later stage/);
  });
});

describe("decisionBody", () => {
  it("approve / reject carry the remarks only when there are some, and no target", () => {
    expect(decisionBody(7, "approve", "  ", "")).toEqual({ payment_sno: 7, action: "approve" });
    expect(decisionBody(7, "reject", " wrong bank ", "3")).toEqual({ payment_sno: 7, action: "reject", comments: "wrong bank" });
  });

  it("forward / send back carry the stage number - stage 0 included", () => {
    expect(decisionBody(7, "forward", "", "1")).toEqual({ payment_sno: 7, action: "forward", target_seq: 1 });
    expect(decisionBody(7, "send_back", "recheck", "0")).toEqual({ payment_sno: 7, action: "send_back", comments: "recheck", target_seq: 0 });
  });

  it("knows which actions need what", () => {
    expect([needsTarget("forward"), needsTarget("send_back"), needsTarget("approve"), needsTarget("reject")]).toEqual([true, true, false, false]);
    expect([needsRemarks("reject"), needsRemarks("send_back"), needsRemarks("approve"), needsRemarks("forward")]).toEqual([true, true, false, false]);
  });
});

describe("what is said afterwards", () => {
  const stages = [stage(0), stage(1)];
  const d = (result: "FINAL" | "APPROVED_NEXT" | "REJECTED" | "FORWARDED" | "SENT_BACK", next: string | null = null) => ({ result, payment_no: "PAY-2026-000009", next_approver: next });

  it("names the person it went to, with their name when the chain has one", () => {
    expect(decisionMessage(d("APPROVED_NEXT", "KTM1006"), stages)).toBe("PAY-2026-000009 approved - sent to V.NATARAJAN (KTM1006)");
    expect(decisionMessage(d("FORWARDED", "KTM1006"), stages)).toBe("PAY-2026-000009 forwarded to V.NATARAJAN (KTM1006)");
    expect(decisionMessage(d("SENT_BACK", "NSU00002"), stages)).toBe("PAY-2026-000009 sent back to Interal Auditor (NSU00002)");
  });

  it("falls back to the bare code for someone the chain has no name for", () => {
    expect(approverLabel("KTM1148", stages)).toBe("KTM1148");
    expect(approverLabel(null, stages)).toBe("");
  });

  it("final approval and rejection say where the payment is", () => {
    expect(decisionMessage(d("FINAL"), stages)).toMatch(/waiting in Payment Run/);
    expect(decisionMessage(d("REJECTED"), stages)).toMatch(/invoices are free again/);
  });
});
