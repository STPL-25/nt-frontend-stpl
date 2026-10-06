import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatInr, PRIORITY_LABELS } from "@/Application/RoleApproval/approvalConditions";
import {
  draftTotal, lineTotal, personLabel,
  type EditDraft, type ForwardTarget, type SendBackTarget,
} from "@/Application/PR/prApprovalContext";

const optionCls = (selected: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
    selected
      ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20"
      : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
  }`;

function RadioOption({
  name, value, checked, onChange, children,
}: { name: string; value: string; checked: boolean; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className={optionCls(checked)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 accent-blue-600"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** Pick a later stage to hand the requisition to — including stages the rules did not require. */
export function ForwardTargetPicker({
  targets, value, onChange,
}: { targets: ForwardTarget[]; value: string; onChange: (v: string) => void }) {
  if (targets.length === 0) return <p className="text-sm text-slate-500">There is no later stage to forward to.</p>;
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Forward to" data-testid="forward-targets">
      {targets.map((t) => (
        <RadioOption key={t.seq} name="forward-target" value={String(t.seq)} checked={value === String(t.seq)} onChange={onChange}>
          <span className="block font-medium text-slate-900 dark:text-slate-50">{t.stage_name}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{personLabel(t.approver_name, t.approver_ecno)}</span>
          <span className={`mt-0.5 block text-[11px] ${t.required_by_rule ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {t.required_by_rule
              ? "Required for this requisition"
              : "Not required by the rules — forwarding asks them anyway"}
          </span>
        </RadioOption>
      ))}
      <p className="text-xs text-slate-500">Stages in between are skipped. The person you choose decides from there.</p>
    </div>
  );
}

/** Pick who gets it back: the requester or an approver who already acted. */
export function SendBackTargetPicker({
  targets, value, onChange,
}: { targets: SendBackTarget[]; value: string; onChange: (v: string) => void }) {
  if (targets.length === 0) return <p className="text-sm text-slate-500">There is nobody to send this back to.</p>;
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Send back to" data-testid="send-back-targets">
      {targets.map((t) => {
        const v = t.target_type === "REQUESTER" ? "REQUESTER" : String(t.seq);
        return (
          <RadioOption key={v} name="send-back-target" value={v} checked={value === v} onChange={onChange}>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{t.stage_name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{personLabel(t.approver_name, t.approver_ecno)}</span>
          </RadioOption>
        );
      })}
      <p className="text-xs text-slate-500">
        When they are done it comes straight back to you — unless they change any values, which restarts the approval.
      </p>
    </div>
  );
}

/** Edit quantities, costs, purpose, date and priority. Saving restarts the approval from stage 1. */
export function EditValuesForm({
  draft, onChange, priorityOptions,
}: {
  draft: EditDraft;
  onChange: (next: EditDraft) => void;
  priorityOptions?: { label: string; value: string | number }[];
}) {
  const priorities =
    priorityOptions && priorityOptions.length > 0
      ? priorityOptions.map((o) => ({ label: o.label, value: String(o.value) }))
      : Object.entries(PRIORITY_LABELS as Record<string, string>).map(([value, label]) => ({ label, value }));
  const total = draftTotal(draft);
  const origTotal = draft.items.reduce((s, i) => s + i.orig_qty * i.orig_cost, 0);

  const setItem = (idx: number, patch: Partial<EditDraft["items"][number]>) =>
    onChange({ ...draft, items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  return (
    <div className="space-y-4" data-testid="edit-values-form">
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          Saving changes restarts the approval from the first stage. Approvals already given will have to be given again, and the
          stages needed are worked out afresh from the new values.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="edit-purpose" className="text-xs sm:text-sm">Purpose</Label>
          <Textarea id="edit-purpose" rows={2} className="resize-none text-sm" value={draft.purpose}
            onChange={(e) => onChange({ ...draft, purpose: e.target.value })} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-required" className="text-xs sm:text-sm">Required by</Label>
          <Input id="edit-required" type="date" value={draft.required_date}
            onChange={(e) => onChange({ ...draft, required_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-priority" className="text-xs sm:text-sm">Priority</Label>
          <select
            id="edit-priority"
            value={draft.priority_sno}
            onChange={(e) => onChange({ ...draft, priority_sno: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
        {draft.items.length === 0 && <p className="text-sm text-slate-500">This requisition has no editable lines.</p>}
        {draft.items.map((it, idx) => (
          <div key={it.pr_item_sno} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_7rem_8rem_7rem]" data-testid="edit-item">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{it.name}</p>
              {it.uom && <p className="text-xs text-slate-500">per {it.uom}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`qty-${it.pr_item_sno}`} className="text-xs">Quantity</Label>
              <Input id={`qty-${it.pr_item_sno}`} type="number" min="0" step="any" value={it.qty}
                onChange={(e) => setItem(idx, { qty: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`cost-${it.pr_item_sno}`} className="text-xs">Est. cost (₹)</Label>
              <Input id={`cost-${it.pr_item_sno}`} type="number" min="0" step="any" value={it.est_cost}
                onChange={(e) => setItem(idx, { est_cost: e.target.value })} />
            </div>
            <div className="text-right sm:pb-2">
              <p className="text-xs text-slate-500">Line total</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatInr(lineTotal(it))}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900" data-testid="edit-total">
          <span className="font-medium text-slate-600 dark:text-slate-300">Total</span>
          <span className="text-right">
            {total !== origTotal && <span className="mr-2 text-xs text-slate-400 line-through">{formatInr(origTotal)}</span>}
            <span className="font-bold text-green-600 dark:text-green-400">{formatInr(total)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
