import { useMemo } from 'react';
import {
  CalendarClock, ChevronRight, FileSignature, FileText, ExternalLink, GitCompare, Landmark, Layers,
  RotateCcw, ScrollText, StickyNote, Users, Wallet,
} from 'lucide-react';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  ApprovalDecisionDialog, ApprovalStepper, Callout, DecisionButtons, DetailEmptyState,
  DetailHero, Fact, FactGrid, Panel, SelectableCard, StatusPill, StickyActionBar, SupplierSplitTable, SupplierSummary, TypeBadge,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, DAY_COUNT_LABEL, diffTerms, entersAmountPerCycle, facilityLabel, formatDate, formatINR, ordinalDay, parseStages,
  statusMeta, termsFromRow,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

// ─── SP response mapping (sp_nt_GetServiceAgreementsForApproval) ───────────
// agreement_sno | agreement_no | com_sno | div_sno | brn_sno | dept_sno |
// service_sno | service_name | service_type_code | service_type_name |
// vendor_sno | vendor_name | vendors (supplier split, parsed by the API) |
// qty | rate_amount | rate_uom_sno |
// rate_uom_name | recurrence_cadence_sno | cadence_name | po_generation_day |
// notify_days_before | period_start_date | period_end_date |
// agreement_doc_url | remarks | terms_conditions | current_approver_id |
// status | created_by | created_at | stage_order_json (JSON) | ceiling_amount |
// facility_type / facility_ref_no / sanctioned_amount / drawing_power /
// rate_type / benchmark_rate_pct / spread_pct / interest_rate_pct (Statutory) |
// version_no | submit_action (SUBMITTED | RESUBMITTED | RENEWED) |
// prev_terms (the previous version's terms, for the change summary)
//
// Service Agreements have no line items (unlike PR/PO) — the detail panel
// groups the agreement's own fields instead of showing an items table. The
// SP returns org ids only (no company/division names), so org isn't shown.

interface ServiceAgreementApprovalScreenLayoutProps {
  approvalName: string;
  agreementList: any[];
  selectedAgreement: any;
  handleAgreementSelect: (agreement: any) => void;
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

function rateLabel(agreement: any): string {
  if (!agreement?.rate_amount) return '—';
  return `${formatINR(agreement.rate_amount)}${agreement.rate_uom_name ? ` / ${agreement.rate_uom_name}` : ''}`;
}

// ─── Agreement List Card ──────────────────────────────────────────────────

function AgreementListCard({ agreement, isSelected, onClick }: { agreement: any; isSelected: boolean; onClick: () => void }) {
  const status = statusMeta(AGREEMENT_STATUS, agreement.status);
  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{agreement.agreement_no}</span>
          {agreement.service_name && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{agreement.service_name}</span>
          )}
        </span>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60'}`} />
      </span>

      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <TypeBadge type={agreement.service_type_code} />
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </span>

      <span className="mt-3 block space-y-1 text-xs">
        {(agreement.vendors?.length > 0 || agreement.vendor_name) && (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">{agreement.service_type_code === 'STATUTORY' ? 'Lender' : agreement.vendors?.length > 1 ? 'Suppliers' : 'Supplier'}</span>
            <SupplierSummary suppliers={agreement.vendors} fallback={agreement.vendor_name} className="justify-end text-right font-medium" />
          </span>
        )}
        {agreement.submit_action && agreement.submit_action !== 'SUBMITTED' && (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">Submission</span>
            <span className="text-right font-medium">{agreement.submit_action === 'RENEWED' ? 'Renewal' : 'Edited'} · v{agreement.version_no}</span>
          </span>
        )}
        {agreement.period_start_date && (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">Duration</span>
            <span className="text-right font-medium">{formatDate(agreement.period_start_date)} – {formatDate(agreement.period_end_date)}</span>
          </span>
        )}
      </span>

      <span className="mt-3 flex items-baseline justify-between gap-2 border-t pt-2.5">
        <span className="text-xs font-medium text-muted-foreground">{agreement.service_type_code === 'STATUTORY' ? 'Sanctioned' : 'Rate'}</span>
        <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
          {agreement.service_type_code === 'STATUTORY' ? formatINR(agreement.sanctioned_amount) : rateLabel(agreement)}
        </span>
      </span>
    </SelectableCard>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────

function AgreementDetailPanel({ agreement, handleAction }: { agreement: any; handleAction: (a: string) => void }) {
  const { canEdit } = usePermissions();
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const isCurrentApprover = agreement.current_approver_id && userEcno && String(agreement.current_approver_id).trim() === String(userEcno).trim();
  const canAct = canEdit('ServiceAgreementApprovalScreen') && !!isCurrentApprover;
  const stages = useMemo(() => parseStages(agreement), [agreement]);
  const status = statusMeta(AGREEMENT_STATUS, agreement.status);
  const isStatutory = agreement.service_type_code === 'STATUTORY';
  const perCycleEntry = entersAmountPerCycle(agreement.service_type_code);
  const vendors: any[] = agreement.vendors ?? [];
  const isRevision = agreement.submit_action === 'RENEWED' || agreement.submit_action === 'RESUBMITTED';
  const changes = useMemo(
    () => (isRevision ? diffTerms(agreement.prev_terms, termsFromRow(agreement)) : []),
    [isRevision, agreement],
  );

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={FileSignature}
              eyebrow="Service Agreement"
              title={agreement.agreement_no}
              subtitle={[agreement.service_name, vendors.length > 1 ? `${vendors.length} suppliers` : agreement.vendor_name].filter(Boolean).join(' · ')}
              badges={<><TypeBadge type={agreement.service_type_code} /><StatusPill tone={status.tone}>{status.label}</StatusPill></>}
              metrics={isStatutory ? [
                { label: 'Sanctioned', value: formatINR(agreement.sanctioned_amount), hint: agreement.disbursed_amount != null ? `${formatINR(agreement.disbursed_amount)} disbursed` : undefined, accent: true },
                { label: 'Interest rate', value: agreement.interest_rate_pct != null ? `${agreement.interest_rate_pct}%` : '—', hint: agreement.rate_type === 'FLOATING' ? `${agreement.benchmark_name ?? 'Repo'}-linked` : 'Fixed' },
                { label: 'Interest paid on', value: agreement.interest_payment_day ? `${ordinalDay(agreement.interest_payment_day)} of the month` : '—' },
              ] : [
                { label: perCycleEntry ? 'Baseline rate' : 'Rate', value: agreement.rate_amount ? formatINR(agreement.rate_amount) : '—', hint: agreement.rate_uom_name ? `per ${agreement.rate_uom_name}` : undefined, accent: true },
                { label: 'Quantity', value: agreement.qty ?? '—' },
                { label: 'Cadence', value: agreement.cadence_name ?? '—' },
              ]}
            />

            {isRevision && (
              <Panel
                icon={agreement.submit_action === 'RENEWED' ? RotateCcw : GitCompare}
                title={agreement.submit_action === 'RENEWED' ? `Renewal · version ${agreement.version_no}` : `Edited · version ${agreement.version_no}`}
                description={`What changed since version ${(agreement.version_no ?? 2) - 1}`}
              >
                {changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No term changes — the agreement is being resubmitted as it was.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {changes.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{c.label}</span>
                        {c.note ? <span className="text-muted-foreground">{c.note}</span> : (
                          <span className="tabular-nums">
                            <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.from}</span>
                            <span className="mx-1.5 text-muted-foreground">→</span>
                            <span className="font-semibold">{c.to}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {isStatutory && (
              <Callout tone="info" icon={Landmark}>
                Loan agreement — approving it does <b>not</b> raise any purchase orders. It moves to <b>Loan Payments</b>, where interest is
                calculated on the outstanding principal (split at each rate change) and paid through a Bank Payment Voucher on every interest date.
              </Callout>
            )}
            {perCycleEntry && (
              <Callout tone="warning" icon={Wallet}>
                Unfixed agreement — the rate and quantity above are the baseline entered at creation. The actual amount for each billing cycle is entered separately in Service PO when that cycle is due.
              </Callout>
            )}

            {vendors.length > 0 && !isStatutory && (
              <Panel
                icon={Users}
                title={vendors.length > 1 ? `Suppliers (${vendors.length})` : 'Supplier'}
                description={vendors.length > 1 ? 'The amount per cycle is split across these suppliers — each gets their own PO' : undefined}
              >
                <SupplierSplitTable
                  suppliers={vendors.map((v) => ({ vendor_name: v.vendor_name, amount: v.share_amount, pct: v.share_pct }))}
                  amountLabel="Amount per cycle"
                />
              </Panel>
            )}

            {isStatutory && agreement.facility_type && (
              <Panel icon={Landmark} title="Loan details">
                <FactGrid>
                  <Fact label="Lender">{agreement.vendor_name ?? '—'}</Fact>
                  <Fact label="Facility">{facilityLabel(agreement.facility_type)}</Fact>
                  {agreement.facility_ref_no && <Fact label="Loan / account no.">{agreement.facility_ref_no}</Fact>}
                  <Fact label="Sanctioned">{formatINR(agreement.sanctioned_amount)}</Fact>
                  {agreement.drawing_power != null && <Fact label="Drawing power">{formatINR(agreement.drawing_power)}</Fact>}
                  <Fact label="Disbursed">{agreement.disbursed_amount != null ? formatINR(agreement.disbursed_amount) : '—'}</Fact>
                  <Fact label="Interest starts">{formatDate(agreement.disbursement_date)}</Fact>
                  <Fact label="Rate type">{agreement.rate_type === 'FLOATING' ? `Floating (${agreement.benchmark_name ?? 'Repo'}-linked)` : 'Fixed'}</Fact>
                  {agreement.rate_type === 'FLOATING' && <Fact label={`${agreement.benchmark_name ?? 'Repo'} + spread`}>{agreement.benchmark_rate_pct}% + {agreement.spread_pct}%</Fact>}
                  <Fact label="Interest rate">{agreement.interest_rate_pct}%</Fact>
                  <Fact label="Interest paid on">{agreement.interest_payment_day ? `${ordinalDay(agreement.interest_payment_day)} of every month` : '—'}</Fact>
                  <Fact label="Day-count basis">{DAY_COUNT_LABEL[String(agreement.day_count_basis)] ?? '—'}</Fact>
                </FactGrid>
              </Panel>
            )}

            <Panel icon={CalendarClock} title={isStatutory ? 'Loan term' : 'Schedule'}>
              <FactGrid>
                <Fact label={isStatutory ? 'Term from' : 'Duration from'}>{formatDate(agreement.period_start_date)}</Fact>
                <Fact label={isStatutory ? 'Term to' : 'Duration to'}>{formatDate(agreement.period_end_date)}</Fact>
                {!isStatutory && <Fact label="Recurrence">{agreement.cadence_name ?? '—'}</Fact>}
                {!isStatutory && <Fact label="PO generation day">{agreement.po_generation_day ?? '—'}</Fact>}
                {!isStatutory && <Fact label="Notify before">{agreement.notify_days_before != null ? `${agreement.notify_days_before} day${Number(agreement.notify_days_before) === 1 ? '' : 's'}` : '—'}</Fact>}
                <Fact label="Submitted by">{agreement.created_by ?? '—'}</Fact>
              </FactGrid>
            </Panel>

            {(agreement.remarks || agreement.terms_conditions) && (
              <Panel icon={ScrollText} title="Notes & terms">
                <div className="space-y-4">
                  {agreement.remarks && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <StickyNote className="h-3 w-3" />Remarks
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{agreement.remarks}</p>
                    </div>
                  )}
                  {agreement.terms_conditions && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <ScrollText className="h-3 w-3" />Terms &amp; conditions
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{agreement.terms_conditions}</p>
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {agreement.agreement_doc_url && (
              <a
                href={agreement.agreement_doc_url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Agreement document</span>
                  <span className="block text-xs text-muted-foreground">Opens in a new tab</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            )}

            <ApprovalStepper stages={stages} currentApproverId={agreement.current_approver_id} currentUserEcno={userEcno} />
          </div>

          {/* Actions — a card beside the content when the pane is wide, a sticky bar below it otherwise */}
          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this agreement" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canAct ? (
                  <DecisionButtons
                    className="flex-col"
                    approveLabel="Approve agreement"
                    rejectLabel="Reject agreement"
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
                  {agreement.current_approver_id && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{agreement.current_approver_id}</dd>
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

export default function ServiceAgreementApprovalScreenLayout({
  approvalName, agreementList, selectedAgreement, handleAgreementSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, toast,
}: ServiceAgreementApprovalScreenLayoutProps) {
  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={agreementList.length}
        sidebarCountLabel="agreement"
        toast={toast}
        listItems={(closeSheet) =>
          agreementList.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No pending agreements</p>
          ) : (
            agreementList.map((agreement: any) => (
              <AgreementListCard
                key={agreement.agreement_no}
                agreement={agreement}
                isSelected={selectedAgreement?.agreement_no === agreement.agreement_no}
                onClick={() => { handleAgreementSelect(agreement); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedAgreement}
        detailContent={
          selectedAgreement
            ? <AgreementDetailPanel agreement={selectedAgreement} handleAction={handleAction} />
            : null
        }
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={agreementList.length === 0 ? 'Nothing waiting on you' : 'No agreement selected'}
            description={agreementList.length === 0
              ? 'Agreements routed to you for approval will show up here.'
              : 'Pick an agreement from the list to review its terms and take action.'}
          />
        }
        mobileListLabel="Agreement list"
        mobileSelectionTitle={selectedAgreement?.agreement_no}
      />

      <ApprovalDecisionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        actionType={actionType}
        comments={comments}
        setComments={setComments}
        onSubmit={handleSubmit}
        loading={loading}
        entityName="agreement"
        approveNote="If this is the final stage, the agreement goes live and its first Service PO cycle is scheduled."
        summary={selectedAgreement ? [
          { label: 'Agreement', value: selectedAgreement.agreement_no },
          { label: 'Service', value: selectedAgreement.service_name ?? '—' },
          { label: 'Rate', value: <span className="text-emerald-600 dark:text-emerald-400">{rateLabel(selectedAgreement)}</span> },
        ] : undefined}
      />
    </>
  );
}
