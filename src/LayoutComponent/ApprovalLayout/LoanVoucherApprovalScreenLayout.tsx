import { useMemo } from 'react';
import { CalendarClock, Calculator, ChevronRight, Landmark, Layers, Receipt, StickyNote } from 'lucide-react';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  ApprovalDecisionDialog, ApprovalStepper, Callout, DecisionButtons, DetailEmptyState,
  DetailHero, Fact, FactGrid, Panel, SelectableCard, StatusPill, StickyActionBar,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  DAY_COUNT_LABEL, facilityLabel, formatDate, formatINR, ordinalDay, parseStages, statusMeta,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import { NextInterestPanel, SegmentsTable, VoucherFigures } from '@/CustomComponent/LoanComponents/InterestBreakdown';
import { VOUCHER_STATUS, addDaysIso } from '@/CustomComponent/LoanComponents/loanUtils';

// ─── SP response mapping (sp_nt_GetBankPaymentVouchersForApproval) ─────────
// voucher_sno | voucher_no | agreement_sno | agreement_no | service_name | vendor_name |
// facility_type | facility_ref_no | rate_type | benchmark_name | sanctioned_amount | interest_payment_day |
// period_from | period_to (= payment date) | days | day_count_basis | opening_principal |
// principal_on_payment | interest_amount | principal_repayment | total_payable | principal_after | rate_pct |
// segments / next_segments (parsed by the API) | next_due_date | next_days | next_est_interest |
// remarks | status | current_approver_id | created_by | created_at | stage_order_json
//
// Everything the approver needs is here: the frozen calculation, what is left after paying, and the
// projected next interest. Approving the final stage writes any principal repayment into the loan.

interface LoanVoucherApprovalScreenLayoutProps {
  approvalName: string;
  voucherList: any[];
  selectedVoucher: any;
  handleVoucherSelect: (voucher: any) => void;
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

// ─── List card ─────────────────────────────────────────────────────────────

function VoucherListCard({ voucher, isSelected, onClick }: { voucher: any; isSelected: boolean; onClick: () => void }) {
  const status = statusMeta(VOUCHER_STATUS, voucher.status);
  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{voucher.voucher_no}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{voucher.vendor_name ?? voucher.agreement_no}</span>
        </span>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60'}`} />
      </span>

      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusPill tone="info">{facilityLabel(voucher.facility_type)}</StatusPill>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </span>

      <span className="mt-3 block space-y-1 text-xs">
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Loan</span>
          <span className="truncate text-right font-medium">{voucher.agreement_no}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Payment date</span>
          <span className="text-right font-medium">{formatDate(voucher.period_to)}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Interest</span>
          <span className="text-right font-medium tabular-nums">{formatINR(voucher.interest_amount)}</span>
        </span>
      </span>

      <span className="mt-3 flex items-baseline justify-between gap-2 border-t pt-2.5">
        <span className="text-xs font-medium text-muted-foreground">Total payable</span>
        <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(voucher.total_payable)}</span>
      </span>
    </SelectableCard>
  );
}

// ─── Detail panel ──────────────────────────────────────────────────────────

function VoucherDetailPanel({ voucher, handleAction }: { voucher: any; handleAction: (a: string) => void }) {
  const { canEdit } = usePermissions();
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const isCurrentApprover = voucher.current_approver_id && userEcno && String(voucher.current_approver_id).trim() === String(userEcno).trim();
  const canAct = canEdit('LoanVoucherApprovalScreen') && !!isCurrentApprover;
  const stages = useMemo(() => parseStages(voucher), [voucher]);
  const status = statusMeta(VOUCHER_STATUS, voucher.status);
  const repay = Number(voucher.principal_repayment) || 0;

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={Receipt}
              eyebrow="Bank payment voucher"
              title={voucher.voucher_no}
              subtitle={[voucher.vendor_name, voucher.agreement_no].filter(Boolean).join(' · ')}
              badges={<><StatusPill tone="info">{facilityLabel(voucher.facility_type)}</StatusPill><StatusPill tone={status.tone}>{status.label}</StatusPill></>}
              metrics={[
                { label: 'Total payable', value: formatINR(voucher.total_payable), accent: true, hint: `on ${formatDate(voucher.period_to)}` },
                { label: 'Interest', value: formatINR(voucher.interest_amount), hint: `${voucher.days} days @ ${Number(voucher.rate_pct)}%` },
                { label: 'Principal repaid', value: repay > 0 ? formatINR(repay) : '—', hint: `${formatINR(voucher.principal_after)} left` },
              ]}
            />

            {repay > 0 && (
              <Callout tone="info" icon={Landmark}>
                Approving this voucher also records a <b>{formatINR(repay)}</b> principal repayment against the loan on {formatDate(voucher.period_to)}, so the next
                interest is charged on {formatINR(voucher.principal_after)}.
              </Callout>
            )}

            <Panel
              icon={Calculator}
              title="Interest calculation"
              description={`${formatDate(voucher.period_from)} – ${formatDate(addDaysIso(voucher.period_to, -1))} · ${voucher.days} days · ${DAY_COUNT_LABEL[String(voucher.day_count_basis)] ?? ''}`}
              bodyClassName="space-y-4"
            >
              <SegmentsTable segments={voucher.segments} benchmarkName={voucher.benchmark_name} basis={voucher.day_count_basis} />
              <VoucherFigures
                principalOnPayment={voucher.principal_on_payment} interest={voucher.interest_amount} days={voucher.days}
                repayment={repay} total={voucher.total_payable} principalAfter={voucher.principal_after}
              />
            </Panel>

            <NextInterestPanel
              nextDue={voucher.next_due_date} nextDays={voucher.next_days} nextInterest={voucher.next_est_interest}
              segments={voucher.next_segments} benchmarkName={voucher.benchmark_name} basis={voucher.day_count_basis}
              principalAfter={voucher.principal_after} floating={voucher.rate_type === 'FLOATING'} finalPayment={!voucher.next_due_date}
            />

            <Panel icon={CalendarClock} title="Loan">
              <FactGrid>
                <Fact label="Lender">{voucher.vendor_name ?? '—'}</Fact>
                <Fact label="Facility">{facilityLabel(voucher.facility_type)}</Fact>
                {voucher.facility_ref_no && <Fact label="Loan / account no.">{voucher.facility_ref_no}</Fact>}
                <Fact label="Sanctioned">{formatINR(voucher.sanctioned_amount)}</Fact>
                <Fact label="Rate type">{voucher.rate_type === 'FLOATING' ? `Floating (${voucher.benchmark_name ?? 'Repo'}-linked)` : 'Fixed'}</Fact>
                <Fact label="Interest paid on">{voucher.interest_payment_day ? `${ordinalDay(voucher.interest_payment_day)} of the month` : '—'}</Fact>
                <Fact label="Raised by">{voucher.created_by}</Fact>
              </FactGrid>
            </Panel>

            {voucher.remarks && (
              <Panel icon={StickyNote} title="Narration">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{voucher.remarks}</p>
              </Panel>
            )}

            <ApprovalStepper stages={stages} currentApproverId={voucher.current_approver_id} currentUserEcno={userEcno} />
          </div>

          {/* Actions — a card beside the content when the pane is wide, a sticky bar below it otherwise */}
          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this voucher" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canAct ? (
                  <DecisionButtons
                    className="flex-col"
                    approveLabel="Approve voucher"
                    rejectLabel="Reject voucher"
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
                  {voucher.current_approver_id && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{voucher.current_approver_id}</dd>
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

export default function LoanVoucherApprovalScreenLayout({
  approvalName, voucherList, selectedVoucher, handleVoucherSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, toast,
}: LoanVoucherApprovalScreenLayoutProps) {
  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={voucherList.length}
        sidebarCountLabel="voucher"
        toast={toast}
        listItems={(closeSheet) =>
          voucherList.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No pending bank payment vouchers</p>
          ) : (
            voucherList.map((voucher: any) => (
              <VoucherListCard
                key={voucher.voucher_sno}
                voucher={voucher}
                isSelected={selectedVoucher?.voucher_sno === voucher.voucher_sno}
                onClick={() => { handleVoucherSelect(voucher); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedVoucher}
        detailContent={selectedVoucher ? <VoucherDetailPanel voucher={selectedVoucher} handleAction={handleAction} /> : null}
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={voucherList.length === 0 ? 'Nothing waiting on you' : 'No voucher selected'}
            description={voucherList.length === 0
              ? 'Bank payment vouchers routed to you for approval will show up here.'
              : 'Pick a voucher from the list to review the interest calculation and take action.'}
          />
        }
        mobileListLabel="Voucher list"
        mobileSelectionTitle={selectedVoucher?.voucher_no}
      />

      <ApprovalDecisionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        actionType={actionType}
        comments={comments}
        setComments={setComments}
        onSubmit={handleSubmit}
        loading={loading}
        entityName="Bank Payment Voucher"
        approveNote={Number(selectedVoucher?.principal_repayment) > 0
          ? 'If this is the final stage, the voucher is approved for payment and its principal repayment is recorded against the loan.'
          : 'If this is the final stage, the voucher is approved for payment.'}
        summary={selectedVoucher ? [
          { label: 'Voucher', value: selectedVoucher.voucher_no },
          { label: 'Payment date', value: formatDate(selectedVoucher.period_to) },
          { label: 'Total payable', value: <span className="text-emerald-600 dark:text-emerald-400">{formatINR(selectedVoucher.total_payable)}</span> },
        ] : undefined}
      />
    </>
  );
}
