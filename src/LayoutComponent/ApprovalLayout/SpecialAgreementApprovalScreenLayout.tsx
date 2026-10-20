import { useMemo } from 'react';
import { CalendarClock, ChevronRight, ExternalLink, FileCheck, FileText, Info, Layers, Package, ScrollText, StickyNote } from 'lucide-react';
import { getAuthFileUrl } from '@/Services/authUrl';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ApprovalActivity, ApprovalDecisionDialog, ApprovalStepper, Callout, DecisionButtons, DetailEmptyState,
  DetailHero, Fact, FactGrid, Panel, SelectableCard, StatusPill, StickyActionBar,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { approvalRoutes, formatDate, formatINR, parseStages, statusMeta, type ApprovalAction } from '@/CustomComponent/ServiceComponents/serviceUtils';
import {
  SPECIAL_STATUS, SPECIAL_TYPE_HINT, SPECIAL_TYPE_LABEL, type SpecialAgreementRow,
} from '@/Application/SpecialAgreement/specialAgreementUtils';

interface Props {
  approvalName: string;
  agreementList: SpecialAgreementRow[];
  selectedAgreement: SpecialAgreementRow | null;
  handleAgreementSelect: (agreement: SpecialAgreementRow) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: ApprovalAction;
  sendBackTarget: string;
  setSendBackTarget: (ecno: string) => void;
  toast?: { message: string; type: 'success' | 'error' } | null;
}

const typeTone = (t: string) => (t === 'FIXED' ? 'primary' : 'violet');

function ListCard({ agreement, isSelected, onClick }: { agreement: SpecialAgreementRow; isSelected: boolean; onClick: () => void }) {
  const status = statusMeta(SPECIAL_STATUS, agreement.status);
  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{agreement.agreement_no}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{agreement.vendor_name}</span>
        </span>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60'}`} />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusPill tone={typeTone(agreement.agreement_type)}>{SPECIAL_TYPE_LABEL[agreement.agreement_type]}</StatusPill>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        {agreement.version_no > 1 && <span className="text-xs text-muted-foreground">v{agreement.version_no}</span>}
      </span>
      <span className="mt-3 block space-y-1 text-xs">
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Products</span>
          <span className="text-right font-medium">{agreement.items.length}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Valid</span>
          <span className="text-right font-medium">{formatDate(agreement.period_start_date)} – {formatDate(agreement.period_end_date)}</span>
        </span>
      </span>
    </SelectableCard>
  );
}

function DetailPanel({ agreement, handleAction }: { agreement: SpecialAgreementRow; handleAction: (a: string) => void }) {
  const { canEdit } = usePermissions();
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const isCurrentApprover = agreement.current_approver_id && userEcno && String(agreement.current_approver_id).trim() === String(userEcno).trim();
  const canAct = canEdit('SpecialAgreementApprovalScreen') && !!isCurrentApprover;
  const stages = useMemo(() => parseStages(agreement), [agreement]);
  const routes = useMemo(() => approvalRoutes(stages, userEcno), [stages, userEcno]);
  const onForward = canAct && routes.canForward ? () => handleAction('forward') : undefined;
  const onSendBack = canAct && routes.canSendBack ? () => handleAction('send_back') : undefined;
  const status = statusMeta(SPECIAL_STATUS, agreement.status);
  const fixed = agreement.agreement_type === 'FIXED';
  const org = [agreement.com_name, agreement.div_name, agreement.brn_name, agreement.dept_name].filter(Boolean).join(' · ');

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={FileCheck}
              eyebrow="Special Agreement"
              title={agreement.agreement_no}
              subtitle={[agreement.vendor_name, org].filter(Boolean).join(' · ')}
              badges={<><StatusPill tone={typeTone(agreement.agreement_type)}>{SPECIAL_TYPE_LABEL[agreement.agreement_type]}</StatusPill><StatusPill tone={status.tone}>{status.label}</StatusPill></>}
              metrics={[
                { label: 'Products', value: agreement.items.length, accent: true },
                { label: 'Valid from', value: formatDate(agreement.period_start_date) },
                { label: 'Valid to', value: formatDate(agreement.period_end_date) },
              ]}
            />

            {agreement.version_no > 1 && (
              <Callout tone="info" icon={Info}>
                Version {agreement.version_no} — resubmitted after a change. See the activity below for what happened to the earlier version.
              </Callout>
            )}
            <Callout tone={fixed ? 'primary' : 'warning'} icon={Info}>{SPECIAL_TYPE_HINT[agreement.agreement_type]}</Callout>

            <Panel icon={Package} title={`Products (${agreement.items.length})`} description={`All from ${agreement.vendor_name ?? 'the supplier'}`}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">{fixed ? 'Fixed rate' : 'Rate'}</TableHead>
                      <TableHead className="text-right">Max qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreement.items.map((it) => (
                      <TableRow key={it.item_sno ?? it.prod_sno}>
                        <TableCell>
                          <span className="font-medium">{it.prod_name}</span>
                          {it.prod_code && <span className="ml-2 text-xs text-muted-foreground">{it.prod_code}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fixed
                            ? <>{formatINR(it.rate_amount)}{it.uom_name && <span className="text-xs text-muted-foreground"> / {it.uom_name}</span>}</>
                            : <span className="text-muted-foreground">Varies</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.max_qty != null ? <>{it.max_qty}{it.uom_name && <span className="text-xs text-muted-foreground"> {it.uom_name}</span>}</> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>

            <Panel icon={CalendarClock} title="Details">
              <FactGrid>
                <Fact label="Supplier">{agreement.vendor_name ?? '—'}{agreement.supp_code ? ` (${agreement.supp_code})` : ''}</Fact>
                <Fact label="Valid from">{formatDate(agreement.period_start_date)}</Fact>
                <Fact label="Valid to">{formatDate(agreement.period_end_date)}</Fact>
                <Fact label="Submitted by">{agreement.created_by ?? '—'}</Fact>
              </FactGrid>
            </Panel>

            {(agreement.remarks || agreement.terms_conditions) && (
              <Panel icon={ScrollText} title="Notes & terms">
                <div className="space-y-4">
                  {agreement.remarks && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><StickyNote className="h-3 w-3" />Remarks</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{agreement.remarks}</p>
                    </div>
                  )}
                  {agreement.terms_conditions && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><ScrollText className="h-3 w-3" />Terms &amp; conditions</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{agreement.terms_conditions}</p>
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {agreement.agreement_doc_url && (
              <a
                href={getAuthFileUrl(agreement.agreement_doc_url)} target="_blank" rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Agreement document</span>
                  <span className="block text-xs text-muted-foreground">Opens in a new tab</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            )}

            <ApprovalStepper stages={stages} currentApproverId={agreement.current_approver_id ?? undefined} currentUserEcno={userEcno} />
            <ApprovalActivity history={agreement.history} />
          </div>

          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this agreement" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canAct ? (
                  <DecisionButtons
                    className="flex-col" approveLabel="Approve agreement" rejectLabel="Reject agreement"
                    onApprove={() => handleAction('approve')} onReject={() => handleAction('reject')}
                    onForward={onForward} onSendBack={onSendBack}
                  />
                ) : (
                  <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-center text-xs text-muted-foreground">View only — you are not the current approver</p>
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
            className="flex-wrap @md:justify-end @md:[&>button]:min-w-40 @md:[&>button]:flex-none"
            approveLabel="Approve" rejectLabel="Reject"
            onApprove={() => handleAction('approve')} onReject={() => handleAction('reject')}
            onForward={onForward} onSendBack={onSendBack}
          />
        ) : (
          <p className="py-1 text-center text-xs text-muted-foreground">View only — you are not the current approver</p>
        )}
      </StickyActionBar>
    </div>
  );
}

export default function SpecialAgreementApprovalScreenLayout({
  approvalName, agreementList, selectedAgreement, handleAgreementSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, sendBackTarget, setSendBackTarget, toast,
}: Props) {
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const routes = useMemo(() => approvalRoutes(parseStages(selectedAgreement), userEcno), [selectedAgreement, userEcno]);
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
            agreementList.map((agreement) => (
              <ListCard
                key={agreement.special_agreement_sno}
                agreement={agreement}
                isSelected={selectedAgreement?.special_agreement_sno === agreement.special_agreement_sno}
                onClick={() => { handleAgreementSelect(agreement); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedAgreement}
        detailContent={selectedAgreement ? <DetailPanel agreement={selectedAgreement} handleAction={handleAction} /> : null}
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={agreementList.length === 0 ? 'Nothing waiting on you' : 'No agreement selected'}
            description={agreementList.length === 0
              ? 'Special agreements routed to you for approval will show up here.'
              : 'Pick an agreement from the list to review its products and take action.'}
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
        forwardTo={routes.forwardTo}
        sendBackOptions={routes.sendBackOptions}
        sendBackTarget={sendBackTarget}
        setSendBackTarget={setSendBackTarget}
        approveNote="If this is the final stage, the agreement becomes active for its validity period."
        summary={selectedAgreement ? [
          { label: 'Agreement', value: selectedAgreement.agreement_no },
          { label: 'Supplier', value: selectedAgreement.vendor_name ?? '—' },
          { label: 'Type', value: SPECIAL_TYPE_LABEL[selectedAgreement.agreement_type] },
        ] : undefined}
      />
    </>
  );
}
