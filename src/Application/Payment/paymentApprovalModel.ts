import type { ApprovalContext, ApprovalStageRow } from '@/Application/PR/prApprovalContext';
import { personLabel } from '@/Application/PR/prApprovalContext';
import type {
  PaymentApprovalAction, PaymentApprovalSummary, PaymentDecision, PaymentDetail,
} from '@/Services/GrnService/paymentNetApi';

// Pure rules behind the Payment Approval screen (sql/66): which buttons an approver gets, what Forward and Send back
// may pick, what the dialog still needs before it can be confirmed, the request body, and the words said afterwards.
// Which stage a payment needs, and who may do what, is decided in the database - this only presents it.

export type PaymentApprovalContext = ApprovalContext<PaymentApprovalSummary>;

/**
 * The approval record of a payment in the shape the shared path component draws. null when the payment has none: it was saved
 * before approval existed, or its department has no Payment workflow and it was approved at once.
 */
export function paymentApprovalContext(detail: Pick<PaymentDetail, 'stages' | 'approval'> | null | undefined): PaymentApprovalContext | null {
  const a = detail?.approval;
  if (!detail || !a?.summary?.has_instance) return null;
  return { summary: a.summary, stages: detail.stages, forwardTargets: a.forward_targets, sendBackTargets: a.send_back_targets, log: a.log, fields: a.condition_fields };
}

export interface DecisionFlags { approve: boolean; reject: boolean; forward: boolean; sendBack: boolean }

/**
 * The buttons the signed-in approver gets. The database says what they may do; a payment it has no record of but that is
 * waiting on them (`waitingOnMe`, from the Awaiting me list) can still be approved or rejected - nothing more.
 */
export function decisionFlags(ctx: PaymentApprovalContext | null, waitingOnMe: boolean): DecisionFlags {
  const s = ctx?.summary;
  if (!s) return { approve: waitingOnMe, reject: waitingOnMe, forward: false, sendBack: false };
  return { approve: s.can_approve, reject: s.can_reject, forward: s.can_approve && s.can_forward, sendBack: s.can_approve && s.can_send_back };
}

/** Where approving sends the payment: the stage it resumes at after a send back, else the next stage the rules need. null = this is the last approval. */
export function nextStageAfterApprove(ctx: PaymentApprovalContext | null): ApprovalStageRow | null {
  const s = ctx?.summary;
  if (!ctx || !s || s.current_seq == null) return null;
  if (s.return_to_seq != null) return ctx.stages.find((st) => st.seq === s.return_to_seq) ?? null;
  return ctx.stages.find((st) => st.seq > s.current_seq! && st.state === 'UPCOMING') ?? null;
}

/** Forward and send back name the stage the payment goes to; reject and send back need the approver's reason. */
export const needsTarget = (a: PaymentApprovalAction): boolean => a === 'forward' || a === 'send_back';
export const needsRemarks = (a: PaymentApprovalAction): boolean => a === 'reject' || a === 'send_back';

/** The stage the dialog starts on: the nearest later stage to forward to; the nearest earlier approver to send back to. '' = nothing to pick. */
export function defaultTarget(action: PaymentApprovalAction, ctx: PaymentApprovalContext | null): string {
  if (!ctx) return '';
  if (action === 'forward') {
    const t = ctx.forwardTargets.find((f) => f.required_by_rule) ?? ctx.forwardTargets[0];
    return t ? String(t.seq) : '';
  }
  if (action === 'send_back') {
    const t = [...ctx.sendBackTargets].filter((b) => b.seq != null).sort((a, b) => (b.seq as number) - (a.seq as number))[0];
    return t ? String(t.seq) : '';
  }
  return '';
}

/** Forward / send back: why no stage can be picked yet (nowhere to go, or nothing chosen), or null. */
export function targetProblem(action: PaymentApprovalAction, target: string, ctx: PaymentApprovalContext | null): string | null {
  if (action === 'forward') {
    if (!ctx?.forwardTargets.length) return 'There is no later stage to forward this payment to.';
    if (!ctx.forwardTargets.some((t) => String(t.seq) === target)) return 'Choose the stage to forward it to.';
  }
  if (action === 'send_back') {
    if (!ctx?.sendBackTargets.length) return 'There is nobody to send this payment back to.';
    if (!ctx.sendBackTargets.some((t) => t.seq != null && String(t.seq) === target)) return 'Choose who to send it back to.';
  }
  return null;
}

/** Reject / send back: the reason is missing, or null. */
export function remarksProblem(action: PaymentApprovalAction, remarks: string): string | null {
  if (!needsRemarks(action) || remarks.trim()) return null;
  return action === 'reject' ? 'Give the reason for rejecting this payment.' : 'Say what needs to be checked or corrected.';
}

/** Why the decision cannot be sent yet, or null. */
export const blockedReason = (action: PaymentApprovalAction, remarks: string, target: string, ctx: PaymentApprovalContext | null): string | null =>
  targetProblem(action, target, ctx) ?? remarksProblem(action, remarks);

/** The body of POST /approve. Remarks are left out when empty; target_seq only for forward / send back (0 is a real stage). */
export function decisionBody(paymentSno: number, action: PaymentApprovalAction, remarks: string, target: string) {
  const body: { payment_sno: number; action: PaymentApprovalAction; comments?: string; target_seq?: number } = { payment_sno: paymentSno, action };
  const r = remarks.trim();
  if (r) body.comments = r;
  if (needsTarget(action)) body.target_seq = Number(target);
  return body;
}

/** "Name (ECNO)" for an approver of this payment's chain, else the bare code. */
export function approverLabel(ecno: string | null | undefined, stages: Pick<ApprovalStageRow, 'approver_ecno' | 'approver_name'>[]): string {
  if (!ecno) return '';
  const s = stages.find((x) => x.approver_ecno === ecno);
  return personLabel(s?.approver_name, ecno);
}

/** What the toast says once the server has recorded the decision. */
export function decisionMessage(d: Pick<PaymentDecision, 'result' | 'payment_no' | 'next_approver'>, stages: Pick<ApprovalStageRow, 'approver_ecno' | 'approver_name'>[]): string {
  const next = approverLabel(d.next_approver, stages);
  switch (d.result) {
    case 'FINAL': return `${d.payment_no} approved - it is now waiting in Payment Run`;
    case 'APPROVED_NEXT': return `${d.payment_no} approved - sent to ${next}`;
    case 'REJECTED': return `${d.payment_no} rejected - its invoices are free again`;
    case 'FORWARDED': return `${d.payment_no} forwarded to ${next}`;
    case 'SENT_BACK': return `${d.payment_no} sent back to ${next}`;
  }
}
