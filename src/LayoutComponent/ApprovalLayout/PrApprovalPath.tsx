import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightCircle, CheckCircle2, Clock, GitBranch, History, Pencil, RotateCcw, Undo2, XCircle, MinusCircle, Send,
} from "lucide-react";
import { describeCondition, normalizeCondition, type ConditionFieldDef, type ConditionLookups } from "@/Application/RoleApproval/approvalConditions";
import {
  ACTION_LABEL, STAGE_STATE_LABEL, formatWhen, personLabel, summarizeEdit,
  type ApprovalContext, type ApprovalLogEntry, type ApprovalStageRow, type StageState,
} from "@/Application/PR/prApprovalContext";

const STATE_CLS: Record<StageState, string> = {
  CURRENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  FORWARDED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  SKIPPED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  SENT_BACK: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  UPCOMING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  NOT_REQUIRED: "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500",
};

function StageRow({ stage, idx, fields, lookups }: { stage: ApprovalStageRow; idx: number; fields: ConditionFieldDef[]; lookups?: ConditionLookups }) {
  const cond = normalizeCondition(stage.condition_json);
  const muted = stage.state === "NOT_REQUIRED" || stage.state === "SKIPPED";
  const isCurrent = stage.state === "CURRENT";
  return (
    <div
      data-testid="approval-stage"
      data-state={stage.state}
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        isCurrent
          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20"
          : muted
            ? "border-slate-200 bg-slate-50/40 opacity-70 dark:border-slate-800 dark:bg-slate-900/20"
            : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30"
      }`}
    >
      <div
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isCurrent ? "bg-blue-600 text-white" : stage.state === "DONE" ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
        }`}
      >
        {idx + 1}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{stage.stage_name}</p>
          <Badge className={`border-0 text-xs ${STATE_CLS[stage.state]}`}>{STAGE_STATE_LABEL[stage.state]}</Badge>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Approver: <span className="font-medium text-slate-700 dark:text-slate-300">{personLabel(stage.approver_name, stage.approver_ecno)}</span>
        </p>
        {stage.alternate_names && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Alternate{stage.alternate_names.includes(",") ? "s" : ""}:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">{stage.alternate_names}</span>
            <span className="text-slate-400"> · can act after {stage.escalation_hours}h</span>
          </p>
        )}
        {cond ? (
          <p className="text-xs text-purple-700 dark:text-purple-400" data-testid="stage-condition">
            Required when: {describeCondition(cond, fields, lookups)}
            {stage.state === "NOT_REQUIRED" && " — not met for this requisition"}
          </p>
        ) : idx > 0 ? (
          <p className="text-xs text-slate-400">Always required</p>
        ) : null}
        {stage.acted_by && (stage.state === "DONE" || stage.state === "FORWARDED" || stage.state === "SENT_BACK" || stage.state === "REJECTED") && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {STAGE_STATE_LABEL[stage.state]} by {personLabel(stage.acted_by_name, stage.acted_by)}
            {stage.acted_at ? ` · ${formatWhen(stage.acted_at)}` : ""}
          </p>
        )}
        {stage.comments && stage.state !== "SKIPPED" && (
          <p className="text-xs italic text-slate-600 dark:text-slate-300">"{stage.comments}"</p>
        )}
      </div>
    </div>
  );
}

/** The chain this requisition follows, stage by stage, with the state of each. */
export function ApprovalPath({ context, lookups }: { context: ApprovalContext; lookups?: ConditionLookups }) {
  const { summary, stages } = context;
  if (!summary?.has_instance || stages.length === 0) return null;
  const required = stages.filter((s) => s.state !== "NOT_REQUIRED" && s.state !== "SKIPPED").length;
  return (
    <Card className="shadow-sm" data-testid="approval-path">
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
          <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
          Approval Path
          <Badge variant="secondary" className="ml-1 text-xs">
            {required} of {stages.length} stage{stages.length !== 1 ? "s" : ""} needed
          </Badge>
          {(summary.cycle_no ?? 1) > 1 && (
            <Badge variant="outline" className="text-xs">Round {summary.cycle_no} (restarted after an edit)</Badge>
          )}
        </CardTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Worked out from this requisition's amount, categories and priority
          {summary.amount != null ? ` — total ₹${Number(summary.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : ""}.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-2">
          {stages.map((s, i) => <StageRow key={s.seq} stage={s} idx={i} fields={context.fields ?? []} lookups={lookups} />)}
        </div>
      </CardContent>
    </Card>
  );
}

const ACTION_ICON: Record<string, ReactNode> = {
  APPROVE: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  REJECT: <XCircle className="h-4 w-4 text-red-600" />,
  FORWARD: <ArrowRightCircle className="h-4 w-4 text-amber-600" />,
  SEND_BACK: <Undo2 className="h-4 w-4 text-amber-600" />,
  RESUBMIT: <Send className="h-4 w-4 text-blue-600" />,
  EDIT: <Pencil className="h-4 w-4 text-blue-600" />,
  RESTART: <RotateCcw className="h-4 w-4 text-blue-600" />,
  SKIP: <MinusCircle className="h-4 w-4 text-slate-400" />,
};

function LogRow({ entry, itemNames }: { entry: ApprovalLogEntry; itemNames: Record<number, string> }) {
  const editLines = entry.action === "EDIT" ? summarizeEdit(entry.before_json, entry.after_json, itemNames) : [];
  const actor = entry.acted_as === "SYSTEM" ? "System" : personLabel(entry.acted_by_name, entry.acted_by);
  const alt = entry.acted_as === "ALTERNATE" ? " (as alternate)" : entry.acted_as === "REQUESTER" ? " (requester)" : "";
  const system = entry.acted_as === "SYSTEM";
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${system ? "border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/20" : "border-slate-200 dark:border-slate-800"}`} data-testid="activity-row">
      <div className="mt-0.5 flex-shrink-0">{ACTION_ICON[entry.action] ?? <Clock className="h-4 w-4 text-slate-400" />}</div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {ACTION_LABEL[entry.action] ?? entry.action}
            {entry.stage_name ? <span className="font-normal text-slate-500"> · {entry.stage_name}</span> : null}
          </p>
          <span className="text-xs text-slate-400 dark:text-slate-500">{formatWhen(entry.acted_at)}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {system ? entry.comments : <>by {actor}{alt}{(entry.action === "FORWARD" || entry.action === "SEND_BACK") && entry.target_name ? <> → <span className="font-medium text-slate-700 dark:text-slate-300">{entry.target_name}</span></> : null}</>}
        </p>
        {!system && entry.comments && <p className="text-xs italic text-slate-600 dark:text-slate-300">"{entry.comments}"</p>}
        {editLines.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
            {editLines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Everything that has happened to this requisition's approval, including edits and skipped stages. */
export function ApprovalActivity({ context, itemNames }: { context: ApprovalContext; itemNames: Record<number, string> }) {
  const log = context.log;
  if (!log.length) return null;
  const rounds = new Set(log.map((l) => l.cycle_no));
  return (
    <Card className="shadow-sm" data-testid="approval-activity">
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <History className="h-4 w-4 sm:h-5 sm:w-5" />
          Approval Activity
          <Badge variant="secondary" className="ml-1 text-xs">{log.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-2">
          {log.map((e, i) => (
            <div key={e.log_id}>
              {rounds.size > 1 && (i === 0 || log[i - 1].cycle_no !== e.cycle_no) && (
                <p className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Round {e.cycle_no}</p>
              )}
              <LogRow entry={e} itemNames={itemNames} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
