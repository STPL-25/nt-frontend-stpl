import { useMemo } from 'react';
import { CalendarClock, ChevronRight, Landmark, Layers, ReceiptText, Repeat, Users, Wallet, Calculator } from 'lucide-react';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  AmountBreakdown, ApprovalDecisionDialog, ApprovalStepper, Callout, DecisionButtons, DetailEmptyState,
  DetailHero, Fact, FactGrid, Panel, SelectableCard, StatusPill, StickyActionBar, SupplierSplitTable, SupplierSummary, TypeBadge,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { CYCLE_STATUS, facilityLabel, formatDate, formatINR, parseStages, statusMeta } from '@/CustomComponent/ServiceComponents/serviceUtils';

// ─── SP response mapping (sp_nt_GetServicePoCyclesForApproval) ────────────
// cycle_sno | agreement_sno | agreement_no | service_name |
// service_type_code | service_type_name | vendor_name |
// vendors (the cycle's per-supplier split, parsed by the API) |
// billing_period_start | qty | rate_amount | discount_pct | gst_pct |
// net_cost | ceiling_amount | status | current_approver_id | entered_by |
// entered_at | facility_type / rate_type / interest_rate_pct /
// sanctioned_amount (Statutory only) | stage_order_json (JSON)
//
// Unlike the agreement approval screen, there's nothing left to enter here
// — Fixed cycles arrive with rate/net_cost pre-filled from the agreement,
// Unfixed and Statutory cycles arrive already filled in by the entry step.
// The approver only reviews and approves/rejects. When the agreement has
// several suppliers, approving raises one PO per supplier.

interface ServicePoApprovalScreenLayoutProps {
  approvalName: string;
  cycleList: any[];
  selectedCycle: any;
  handleCycleSelect: (cycle: any) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: 'approve' | 'reject';
  toast?: { message: string; type: 'success' | 'error' } | null;
}

function amountLabel(cycle: any): string {
  return cycle?.net_cost ? formatINR(cycle.net_cost) : '—';
}

// ─── Cycle List Card ────────────────────────────────────────────────────

function CycleListCard({ cycle, isSelected, onClick }: { cycle: any; isSelected: boolean; onClick: () => void }) {
  const status = statusMeta(CYCLE_STATUS, cycle.status);
  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{cycle.agreement_no}</span>
          {cycle.service_name && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{cycle.service_name}</span>
          )}
        </span>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60'}`} />
      </span>

      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <TypeBadge type={cycle.service_type_code} />
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </span>

      <span className="mt-3 block space-y-1 text-xs">
        {(cycle.vendors?.length > 0 || cycle.vendor_name) && (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">{cycle.vendors?.length > 1 ? 'Suppliers' : 'Supplier'}</span>
            <SupplierSummary
              suppliers={(cycle.vendors ?? []).map((v: any) => ({ vendor_name: v.vendor_name, share_amount: v.net_cost }))}
              fallback={cycle.vendor_name}
              className="justify-end text-right font-medium"
            />
          </span>
        )}
        {cycle.billing_period_start && (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">PO generation</span>
            <span className="text-right font-medium">{formatDate(cycle.billing_period_start)}</span>
          </span>
        )}
      </span>

      <span className="mt-3 flex items-baseline justify-between gap-2 border-t pt-2.5">
        <span className="text-xs font-medium text-muted-foreground">Net amount</span>
        <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{amountLabel(cycle)}</span>
      </span>
    </SelectableCard>
  );
}

// ─── Amount breakdown ───────────────────────────────────────────────────

function CycleAmountBreakdown({ cycle }: { cycle: any }) {
  return (
    <Panel icon={Calculator} title="Amount breakdown">
      <AmountBreakdown
        rate={Number(cycle.rate_amount) || 0}
        qty={Number(cycle.qty ?? 1) || 0}
        discountPct={Number(cycle.discount_pct) || 0}
        gstPct={Number(cycle.gst_pct) || 0}
        net={cycle.net_cost != null ? Number(cycle.net_cost) : undefined}
        ceiling={cycle.service_type_code !== 'FIXED_RECURRING' ? cycle.ceiling_amount : null}
      />
    </Panel>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────

function CycleDetailPanel({ cycle, handleAction }: { cycle: any; handleAction: (a: string) => void }) {
  const { canEdit } = usePermissions();
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const isCurrentApprover = cycle.current_approver_id && userEcno && String(cycle.current_approver_id).trim() === String(userEcno).trim();
  const canAct = canEdit('ServicePoApprovalScreen') && !!isCurrentApprover;
  const stages = useMemo(() => parseStages(cycle), [cycle]);
  const status = statusMeta(CYCLE_STATUS, cycle.status);
  const isFixed = cycle.service_type_code === 'FIXED_RECURRING';
  const isStatutory = cycle.service_type_code === 'STATUTORY';
  const vendors: any[] = cycle.vendors ?? [];

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={ReceiptText}
              eyebrow="Service PO cycle"
              title={cycle.agreement_no}
              subtitle={[cycle.service_name, vendors.length > 1 ? `${vendors.length} suppliers` : cycle.vendor_name].filter(Boolean).join(' · ')}
              badges={<><TypeBadge type={cycle.service_type_code} /><StatusPill tone={status.tone}>{status.label}</StatusPill></>}
              metrics={[
                { label: 'Net amount', value: amountLabel(cycle), accent: true },
                { label: 'PO generation', value: formatDate(cycle.billing_period_start) },
                { label: 'Quantity', value: cycle.qty ?? '—' },
              ]}
            />

            <Callout tone={isFixed ? 'primary' : isStatutory ? 'info' : 'violet'} icon={isFixed ? Repeat : isStatutory ? Landmark : Wallet}>
              {isFixed
                ? 'Fixed — the amount is pre-filled from the approved agreement; there was nothing to enter for this cycle.'
                : `${isStatutory ? 'Statutory' : 'Unfixed'} — the amount was entered for this cycle${cycle.entered_by ? ` by ${cycle.entered_by}` : ''}${cycle.entered_at ? ` on ${formatDate(cycle.entered_at)}` : ''}.`}
              {isStatutory && cycle.facility_type && (
                <> {facilityLabel(cycle.facility_type)}{cycle.interest_rate_pct != null && <> at <b>{cycle.interest_rate_pct}%</b></>}
                  {cycle.sanctioned_amount != null && <> on a sanctioned <b>{formatINR(cycle.sanctioned_amount)}</b></>}.</>
              )}
            </Callout>

            <CycleAmountBreakdown cycle={cycle} />

            {vendors.length > 1 && (
              <Panel icon={Users} title={`Supplier split (${vendors.length})`} description="Approving raises one PO per supplier for their share">
                <SupplierSplitTable
                  amountLabel="Net amount"
                  suppliers={vendors.map((v) => ({
                    vendor_name: v.vendor_name, amount: v.net_cost, pct: v.share_pct,
                    extra: `Rate ${formatINR(v.rate_amount)} × ${cycle.qty ?? 1}`,
                  }))}
                />
              </Panel>
            )}

            <Panel icon={CalendarClock} title="Cycle details">
              <FactGrid>
                <Fact label="Agreement">{cycle.agreement_no}</Fact>
                <Fact label="Service">{cycle.service_name ?? '—'}</Fact>
                <Fact label={vendors.length > 1 ? 'Suppliers' : 'Supplier'}>
                  {vendors.length > 1 ? vendors.map((v) => v.vendor_name).filter(Boolean).join(', ') : (cycle.vendor_name ?? '—')}
                </Fact>
                <Fact label="PO generation date">{formatDate(cycle.billing_period_start)}</Fact>
                {cycle.entered_by && <Fact label="Entered by">{cycle.entered_by}</Fact>}
                {cycle.entered_at && <Fact label="Entered on">{formatDate(cycle.entered_at)}</Fact>}
              </FactGrid>
            </Panel>

            <ApprovalStepper stages={stages} currentApproverId={cycle.current_approver_id} currentUserEcno={userEcno} />
          </div>

          {/* Actions — a card beside the content when the pane is wide, a sticky bar below it otherwise */}
          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this PO cycle" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canAct ? (
                  <DecisionButtons
                    className="flex-col"
                    approveLabel="Approve PO"
                    rejectLabel="Reject PO"
                    onApprove={() => handleAction('approve')}
                    onReject={() => handleAction('reject')}
                  />
                ) : (
                  <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
                    View only — you are not the current approver
                  </p>
                )}
                <dl className="space-y-2 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd><StatusPill tone={status.tone}>{status.label}</StatusPill></dd>
                  </div>
                  {cycle.current_approver_id && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{cycle.current_approver_id}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <StickyActionBar>
        {canAct ? (
          <DecisionButtons
            className="@md:justify-end @md:[&>button]:min-w-44 @md:[&>button]:flex-none"
            approveLabel="Approve"
            rejectLabel="Reject"
            onApprove={() => handleAction('approve')}
            onReject={() => handleAction('reject')}
          />
        ) : (
          <p className="py-1 text-center text-xs text-muted-foreground">View only — you are not the current approver</p>
        )}
      </StickyActionBar>
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────

export default function ServicePoApprovalScreenLayout({
  approvalName, cycleList, selectedCycle, handleCycleSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, toast,
}: ServicePoApprovalScreenLayoutProps) {
  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={cycleList.length}
        sidebarCountLabel="cycle"
        toast={toast}
        listItems={(closeSheet) =>
          cycleList.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No pending Service PO cycles</p>
          ) : (
            cycleList.map((cycle: any) => (
              <CycleListCard
                key={cycle.cycle_sno}
                cycle={cycle}
                isSelected={selectedCycle?.cycle_sno === cycle.cycle_sno}
                onClick={() => { handleCycleSelect(cycle); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedCycle}
        detailContent={
          selectedCycle
            ? <CycleDetailPanel cycle={selectedCycle} handleAction={handleAction} />
            : null
        }
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={cycleList.length === 0 ? 'Nothing waiting on you' : 'No cycle selected'}
            description={cycleList.length === 0
              ? 'Service PO cycles routed to you for approval will show up here.'
              : 'Pick a Service PO cycle from the list to review its amount and take action.'}
          />
        }
        mobileListLabel="Cycle list"
        mobileSelectionTitle={selectedCycle?.agreement_no}
      />

      <ApprovalDecisionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        actionType={actionType}
        comments={comments}
        setComments={setComments}
        onSubmit={handleSubmit}
        loading={loading}
        entityName="Service PO"
        approveNote={selectedCycle?.vendors?.length > 1
          ? `If this is the final stage, ${selectedCycle.vendors.length} POs are raised immediately — one for each supplier.`
          : 'If this is the final stage, the PO is raised immediately.'}
        summary={selectedCycle ? [
          { label: 'Agreement', value: selectedCycle.agreement_no },
          { label: 'PO generation', value: formatDate(selectedCycle.billing_period_start) },
          { label: 'Net amount', value: <span className="text-emerald-600 dark:text-emerald-400">{amountLabel(selectedCycle)}</span> },
        ] : undefined}
      />
    </>
  );
}
