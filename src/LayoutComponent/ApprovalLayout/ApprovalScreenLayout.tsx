import { useMemo, useState } from 'react';
import {
  ArrowRightCircle, CheckCircle2, ChevronRight, FileText, Hourglass, Layers, Package, Pencil, Send, Undo2, XCircle,
} from 'lucide-react';
import type { ConditionLookups } from '@/Application/RoleApproval/approvalConditions';
import {
  formatWhen,
  type ApprovalContext, type EditDraft, type PrAction,
} from '@/Application/PR/prApprovalContext';
import { ApprovalPath, ApprovalActivity } from './PrApprovalPath';
import { ForwardTargetPicker, SendBackTargetPicker, EditValuesForm } from './PrApprovalActionForm';
import ApprovalActionDialog from './ApprovalActionDialog';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  ApprovalStepper, Callout, DetailEmptyState, DetailHero, Fact, FactGrid, Panel, SearchInput,
  SelectableCard, StatusPill, StickyActionBar,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, TONE, formatDate, formatINR, statusMeta, type Tone,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

// ─── SP response mapping ──────────────────────────────────────────────────────
// pr_basic_sno | brn_sno | brn_name | brn_prefix | dept_name | div_prefix
// div_name | com_name | created_by_name | dept_sno | reg_date | required_date
// priority_sno | purpose | is_active | created_by | created_date | modified_by
// modified_date | pr_no | workflow_types_id | current_approver_id | status
// pr_item_details (JSON) | stage_order_json (JSON)
//
// Item JSON: pr_item_sno, pr_basic_sno, prod_sno, qty, unit, uom_name, uom_code,
//            est_cost, total_cost, remarks, created_by, created_date, is_active, pr_no
//
// Stage JSON: approver_ecno, stage, required_approvals, is_mandatory, escalation_hours,
//             approver_condition, next_approver_ecno, can_forward, can_backward, can_edit_data

interface ApprovalScreenLayoutProps {
  approvalName: string;
  prList: any[];
  selectedPR: any;
  handlePRSelect: (pr: any) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  action: string;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: PrAction;
  fieldDatas: FieldType[];
  toast?: { message: string; type: 'success' | 'error' } | null;

  // Conditional approval (sql/99). `approvalContext` is null until it loads, or for a PR the
  // engine has no record of — the screen then falls back to plain approve / reject.
  approvalContext?: ApprovalContext | null;
  contextLoading?: boolean;
  conditionLookups?: ConditionLookups;
  priorityOptions?: { label: string; value: string | number }[];
  /** forward: the stage seq · send back: 'REQUESTER' or the stage seq */
  targetValue?: string;
  setTargetValue?: (v: string) => void;
  editDraft?: EditDraft | null;
  setEditDraft?: (d: EditDraft) => void;
  /** Why the dialog's confirm button is disabled right now (shown under the form), or null. */
  submitBlockedReason?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string | number, string> = { 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Critical' };

function getPriorityLabel(sno: any): string {
  return PRIORITY_MAP[sno] ?? (sno ? String(sno) : 'Normal');
}

function priorityTone(label: string): Tone {
  if (label === 'High' || label === 'Critical') return 'danger';
  if (label === 'Medium') return 'warning';
  return 'success';
}

function parsePrItems(pr: any): { parsedItems: any[]; totalCost: number } {
  let parsedItems: any[] = [];
  try {
    const raw = pr.pr_item_details ?? pr.items;
    if (typeof raw === 'string') parsedItems = JSON.parse(raw);
    else if (Array.isArray(raw)) parsedItems = raw;
  } catch { /* ignore */ }
  const totalCost = parsedItems.reduce((s, i) => s + (parseFloat(i.total_cost) || 0), 0);
  return { parsedItems, totalCost };
}

function parseStages(pr: any): any[] {
  try {
    const raw = pr.stage_order_json;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return []; }
}

function parseHistory(pr: any): any[] {
  try {
    const raw = pr.pr_history_data;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return []; }
}

const num = (v: any) => (parseFloat(v || 0) || 0).toLocaleString('en-IN');
const th = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', TONE[tone])}>
      {children}
    </span>
  );
}

// ─── Sidebar card ─────────────────────────────────────────────────────────────

function PRListCard({ pr, isSelected, onClick }: { pr: any; isSelected: boolean; onClick: () => void }) {
  const { parsedItems, totalCost } = useMemo(() => parsePrItems(pr), [pr]);
  const priorityLabel = getPriorityLabel(pr.priority_sno);
  const status = statusMeta(AGREEMENT_STATUS, pr.status ?? 'P');

  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{pr.pr_no}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{pr.created_by_name || '—'}</span>
        </span>
        <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <Tag tone={priorityTone(priorityLabel)}>{priorityLabel} priority</Tag>
        {pr.request_mode === 'VENDOR_DRIVEN' && <Tag tone="violet">Vendor driven</Tag>}
      </span>
      <span className="mt-3 block space-y-1 text-xs">
        {pr.brn_name && (
          <span className="flex justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Branch</span>
            <span className="truncate text-right font-medium">{pr.brn_name}</span>
          </span>
        )}
        {pr.dept_name && (
          <span className="flex justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Department</span>
            <span className="truncate text-right font-medium">{pr.dept_name}</span>
          </span>
        )}
        {pr.required_date && (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">Required by</span>
            <span className="text-right font-medium">{formatDate(pr.required_date)}</span>
          </span>
        )}
      </span>
      <span className="mt-3 block space-y-1 border-t pt-2.5 text-xs">
        <span className="flex justify-between gap-3">
          <span className="flex items-center gap-1 text-muted-foreground"><Package className="h-3 w-3" />Items</span>
          <span className="font-medium">{parsedItems.length}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold text-primary">{formatINR(totalCost)}</span>
        </span>
      </span>
      {pr.purpose && <span className="mt-2 line-clamp-2 block text-xs text-muted-foreground">{pr.purpose}</span>}
    </SelectableCard>
  );
}

// ─── Detail sections ──────────────────────────────────────────────────────────

function HistoryPanel({ history }: { history: any[] }) {
  return (
    <Panel icon={FileText} title="Approval history" description={`${history.length} action${history.length !== 1 ? 's' : ''}`}>
      <ol className="space-y-4">
        {history.map((entry: any, idx: number) => (
          <li key={idx} className="flex items-start gap-3">
            <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', TONE.success)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{entry.ename ?? '—'}</p>
                {entry.status_by && <Tag tone="success">{entry.status_by}</Tag>}
              </div>
              {entry.status_date && <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(entry.status_date)}</p>}
              {entry.commends && (
                <p className="mt-1.5 border-l-2 border-emerald-300 pl-2 text-xs italic text-muted-foreground dark:border-emerald-700">“{entry.commends}”</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ItemsPanel({ items, isVendorDriven }: { items: any[]; isVendorDriven: boolean }) {
  return (
    <Panel icon={Package} title="Requested items" description={`${items.length} item${items.length !== 1 ? 's' : ''}`}>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No items found.</p> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className={cn(th, 'text-left')}>#</th>
                <th className={cn(th, 'text-left')}>Item</th>
                <th className={cn(th, 'text-right')}>Qty</th>
                {isVendorDriven && <>
                  <th className={cn(th, 'text-right')}>Rate</th>
                  <th className={cn(th, 'text-right')}>Discount %</th>
                  <th className={cn(th, 'text-right')}>GST %</th>
                  <th className={cn(th, 'text-right')}>Total</th>
                  <th className={cn(th, 'text-left')}>Proof</th>
                </>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item: any, idx: number) => (
                <tr key={item.pr_item_sno ?? idx}>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{item.prod_name || item.service_name}</p>
                    <p className="text-xs text-muted-foreground">{item.remarks || item.service_code}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span className="font-medium tabular-nums">{num(item.qty)}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{item.uom_name}</span>
                  </td>
                  {isVendorDriven && <>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatINR(parseFloat(item.rate || 0))}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{parseFloat(item.discount_pct || 0)}%</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{parseFloat(item.gst_pct || 0)}%</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{formatINR(parseFloat(item.total_cost || 0))}</td>
                    <td className="px-3 py-2.5">
                      {item.item_attachment ? (
                        <a href={item.item_attachment} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-2 hover:underline">View</a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function PRDetailPanel({
  pr, handleAction, fieldDatas, context, contextLoading, conditionLookups,
}: {
  pr: any; handleAction: (a: string) => void; fieldDatas: FieldType[];
  context?: ApprovalContext | null; contextLoading?: boolean; conditionLookups?: ConditionLookups;
}) {
  const { canEdit } = usePermissions();
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const isCurrentApprover = !!(pr.current_approver_id && userEcno && String(pr.current_approver_id).trim() === String(userEcno).trim());
  // The engine's view of what this user may do; absent for a PR it has no record of (then: approve / reject only).
  const summary = context?.summary?.has_instance ? context.summary : null;
  const itemNames = useMemo(() => {
    const out: Record<number, string> = {};
    for (const i of parsePrItems(pr).parsedItems) if (i?.pr_item_sno != null) out[Number(i.pr_item_sno)] = i.prod_name || i.service_name || `Item #${i.pr_item_sno}`;
    return out;
  }, [pr]);
  const { parsedItems, totalCost } = useMemo(() => parsePrItems(pr), [pr]);
  const isVendorDriven = pr.request_mode === 'VENDOR_DRIVEN';
  const stages = useMemo(() => parseStages(pr), [pr]);
  const history = useMemo(() => parseHistory(pr), [pr]);
  const priorityLabel = getPriorityLabel(pr.priority_sno);
  const status = statusMeta(AGREEMENT_STATUS, pr.status ?? 'P');
  const org = [pr.com_name, pr.div_name, pr.brn_name].filter(Boolean).join(' › ');
  const reviewAllowed = canEdit('PRApprovalScreen');

  const decideBtn = 'h-11 w-full';
  const approveBtn = (label: string) => (
    <Button onClick={() => handleAction('approve')} className={cn(decideBtn, 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40')}>
      <CheckCircle2 className="h-4 w-4" />{label}
    </Button>
  );
  const rejectBtn = (label: string) => (
    <Button onClick={() => handleAction('reject')} variant="destructive" className={decideBtn}>
      <XCircle className="h-4 w-4" />{label}
    </Button>
  );

  /** The buttons this user may press; `short` shortens labels for the sticky bar. */
  const renderActions = (short: boolean) => {
    if (!reviewAllowed) return <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-center text-xs text-muted-foreground">View only — no approval permission</p>;
    if (contextLoading && !context) return <p className="py-2 text-center text-xs text-muted-foreground">Checking what you can do…</p>;
    if (summary) {
      return (
        <div className="space-y-2">
          {summary.my_role === 'ALTERNATE' && (
            <Callout tone="info" icon={Hourglass}><span data-testid="alternate-notice">You are acting as an alternate approver — this has waited past the stage's escalation time.</span></Callout>
          )}
          {summary.my_role === 'ALTERNATE_WAITING' && (
            <Callout tone="neutral" icon={Hourglass}><span data-testid="alternate-waiting">You are the alternate approver for this stage. You can act from {formatWhen(summary.alternate_available_at)}, if it is still waiting.</span></Callout>
          )}
          {summary.my_role === 'REQUESTER' && (
            <Callout tone="warning" icon={Undo2}><span data-testid="requester-notice">This requisition was sent back to you. Correct it, or resubmit it unchanged.</span></Callout>
          )}
          {summary.can_approve && approveBtn(short ? 'Approve' : 'Approve request')}
          {summary.can_approve && summary.can_forward && (
            <Button onClick={() => handleAction('forward')} variant="outline" className={cn(decideBtn, 'gap-1.5')}>
              <ArrowRightCircle className="h-4 w-4" />{short ? 'Forward' : 'Forward to higher stage'}
            </Button>
          )}
          {summary.can_approve && summary.can_send_back && (
            <Button onClick={() => handleAction('send_back')} variant="outline" className={cn(decideBtn, 'gap-1.5')}>
              <Undo2 className="h-4 w-4" />Send back
            </Button>
          )}
          {summary.can_resubmit && (
            <Button onClick={() => handleAction('resubmit')} className={cn(decideBtn, 'gap-1.5')}>
              <Send className="h-4 w-4" />Resubmit unchanged
            </Button>
          )}
          {summary.can_edit && (
            <Button onClick={() => handleAction('edit')} variant="outline" className={cn(decideBtn, 'gap-1.5')}>
              <Pencil className="h-4 w-4" />Edit values
            </Button>
          )}
          {summary.can_reject && rejectBtn(short ? 'Reject' : 'Reject request')}
          {!summary.can_approve && !summary.can_resubmit && !summary.can_edit && summary.my_role === 'NONE' && (
            <p className="py-2 text-center text-xs text-muted-foreground">Waiting for another approver — nothing for you to do here.</p>
          )}
        </div>
      );
    }
    if (isCurrentApprover) {
      return <div className="space-y-2">{approveBtn(short ? 'Approve' : 'Approve request')}{rejectBtn(short ? 'Reject' : 'Reject request')}</div>;
    }
    return <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-center text-xs text-muted-foreground">View only — no approval permission</p>;
  };

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={Layers}
              eyebrow="Purchase requisition"
              title={pr.pr_no}
              subtitle={pr.purpose || org}
              badges={
                <>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <Tag tone={priorityTone(priorityLabel)}>{priorityLabel} priority</Tag>
                  {isVendorDriven && <Tag tone="violet">Vendor driven</Tag>}
                  {pr.purpose && org && <Tag tone="neutral">{org}</Tag>}
                </>
              }
              metrics={[
                { label: 'Items', value: parsedItems.length },
                { label: 'Total amount', value: formatINR(totalCost), accent: true },
                { label: 'Required by', value: formatDate(pr.required_date), valueClassName: 'text-base @md:text-base' },
              ]}
            />

            <Panel icon={FileText} title="Requisition details">
              <FactGrid>
                {fieldDatas.filter((f) => f.view !== false).map((f) => {
                  const rawVal = pr[f.field];
                  if (rawVal == null || rawVal === '') return null;
                  return <Fact key={f.field} label={f.label}>{f.type === 'date' ? formatDate(String(rawVal)) : String(rawVal)}</Fact>;
                })}
              </FactGrid>
            </Panel>

            <ItemsPanel items={parsedItems} isVendorDriven={isVendorDriven} />

            {summary && context ? (
              <>
                <ApprovalPath context={context} lookups={conditionLookups} />
                <ApprovalActivity context={context} itemNames={itemNames} />
              </>
            ) : (
              <ApprovalStepper stages={stages} currentApproverId={pr.current_approver_id} currentUserEcno={userEcno} />
            )}
            {history.length > 0 && <HistoryPanel history={history} />}
          </div>

          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this requisition" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {renderActions(false)}
                <dl className="space-y-2 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd><StatusPill tone={status.tone}>{status.label}</StatusPill></dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Priority</dt>
                    <dd><StatusPill tone={priorityTone(priorityLabel)}>{priorityLabel}</StatusPill></dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd className="font-semibold">{parsedItems.length}</dd>
                  </div>
                  {pr.current_approver_id && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{pr.current_approver_id}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <StickyActionBar>{renderActions(true)}</StickyActionBar>
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

const DIALOG_META: Record<PrAction, { tone: Tone; icon: typeof CheckCircle2; title: string; description: string; confirm: string }> = {
  approve: { tone: 'success', icon: CheckCircle2, title: 'Approve requisition', description: 'Optionally add a comment before approving.', confirm: 'Confirm approval' },
  reject: { tone: 'danger', icon: XCircle, title: 'Reject requisition', description: 'Please provide a reason for rejection.', confirm: 'Confirm rejection' },
  forward: { tone: 'warning', icon: ArrowRightCircle, title: 'Forward requisition', description: 'Pass this requisition to a higher stage for their decision.', confirm: 'Confirm forward' },
  send_back: { tone: 'warning', icon: Undo2, title: 'Send back requisition', description: 'Return it to someone who already handled it, with your reason.', confirm: 'Confirm send back' },
  edit: { tone: 'info', icon: Pencil, title: 'Edit values', description: 'Change the values, and say why.', confirm: 'Save & restart approval' },
  resubmit: { tone: 'info', icon: Send, title: 'Resubmit requisition', description: 'Send it back into approval without changing anything.', confirm: 'Confirm resubmit' },
};

export default function ApprovalScreenLayout({
  approvalName, prList, selectedPR, handlePRSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, fieldDatas, toast,
  approvalContext, contextLoading, conditionLookups, priorityOptions,
  targetValue = '', setTargetValue, editDraft, setEditDraft, submitBlockedReason,
}: ApprovalScreenLayoutProps) {
  const [search, setSearch] = useState('');

  const enrichedSelectedPR = useMemo(() => {
    if (!selectedPR) return null;
    const { parsedItems, totalCost } = parsePrItems(selectedPR);
    return { ...selectedPR, parsedItems, totalCost };
  }, [selectedPR]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prList;
    return prList.filter((pr) =>
      [pr.pr_no, pr.created_by_name, pr.dept_name, pr.brn_name, pr.purpose].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [prList, search]);

  const meta = DIALOG_META[actionType];
  const commentsRequired = actionType === 'reject' || actionType === 'send_back' || actionType === 'edit';

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={prList.length}
        toast={toast}
        listItems={(closeSheet) => (
          <>
            <div className="sticky top-0 z-10 -mx-2 -mt-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
              <SearchInput value={search} onChange={setSearch} placeholder="Search PR, requestor…" />
            </div>
            {filteredList.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'No matches found' : 'No pending requisitions'}
              </p>
            ) : (
              filteredList.map((pr: any) => (
                <PRListCard
                  key={pr.pr_no}
                  pr={pr}
                  isSelected={selectedPR?.pr_no === pr.pr_no}
                  onClick={() => { handlePRSelect(pr); closeSheet(); }}
                />
              ))
            )}
          </>
        )}
        hasSelection={!!enrichedSelectedPR}
        detailContent={
          enrichedSelectedPR
            ? (
              <PRDetailPanel
                pr={enrichedSelectedPR}
                handleAction={handleAction}
                fieldDatas={fieldDatas}
                context={approvalContext}
                contextLoading={contextLoading}
                conditionLookups={conditionLookups}
              />
            )
            : null
        }
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={prList.length === 0 ? 'Nothing waiting on you' : 'No PR selected'}
            description={prList.length === 0
              ? 'Purchase requisitions routed to you for approval will show up here.'
              : 'Pick a requisition from the list to review its details and take action.'}
          />
        }
        mobileListLabel="PR list"
        mobileSelectionTitle={selectedPR?.pr_no}
      />

      <ApprovalActionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        wide={actionType === 'edit'}
        tone={meta.tone}
        icon={meta.icon}
        title={meta.title}
        description={meta.description}
        summary={enrichedSelectedPR ? [
          { label: 'PR number', value: enrichedSelectedPR.pr_no },
          { label: 'Requestor', value: enrichedSelectedPR.created_by_name || '—' },
          { label: 'Total amount', value: <span className="text-primary">{formatINR(enrichedSelectedPR.totalCost)}</span> },
        ] : undefined}
        commentsLabel={actionType === 'edit' ? 'Reason for the change' : 'Comments'}
        commentsRequired={commentsRequired}
        commentsPlaceholder={
          actionType === 'reject' ? 'Reason for rejection…'
            : actionType === 'send_back' ? 'What needs to be fixed or checked…'
            : actionType === 'edit' ? 'Why are these values changing…'
            : 'Any additional notes…'
        }
        comments={comments}
        setComments={setComments}
        blockedReason={submitBlockedReason}
        loading={loading}
        disabled={!!submitBlockedReason}
        onSubmit={handleSubmit}
        confirmLabel={meta.confirm}
        confirmIcon={meta.icon}
      >
        {actionType === 'approve' && (
          <Callout tone="success" icon={CheckCircle2}>This requisition will proceed to the next stage.</Callout>
        )}
        {actionType === 'forward' && (
          <ForwardTargetPicker targets={approvalContext?.forwardTargets ?? []} value={targetValue} onChange={(v) => setTargetValue?.(v)} />
        )}
        {actionType === 'send_back' && (
          <SendBackTargetPicker targets={approvalContext?.sendBackTargets ?? []} value={targetValue} onChange={(v) => setTargetValue?.(v)} />
        )}
        {actionType === 'edit' && editDraft && (
          <EditValuesForm draft={editDraft} onChange={(d) => setEditDraft?.(d)} priorityOptions={priorityOptions} />
        )}
      </ApprovalActionDialog>
    </>
  );
}
