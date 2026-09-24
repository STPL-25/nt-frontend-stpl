import { useMemo } from 'react';
import { ChevronRight, IdCard, Landmark, Layers, ShieldCheck } from 'lucide-react';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  ApprovalDecisionDialog, ApprovalStepper, DecisionButtons, DetailEmptyState,
  DetailHero, Fact, FactGrid, Panel, SelectableCard, StatusPill, StickyActionBar,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { AGREEMENT_STATUS, parseStages, statusMeta } from '@/CustomComponent/ServiceComponents/serviceUtils';

// ─── SP response mapping (sp_nt_GetServiceVendorKycsForApproval) ───────────
// service_vendor_kyc_sno | service_vendor_code | com_sno/div_sno/brn_sno/dept_sno |
// company_name | contact_person | email | mobile_number | business_type |
// is_gst_avail | gst_no | is_msme_avail | msme_no | pan_no | supplier_cat_code |
// legal_name | trade_name | gst_status | gst_blk_status | date_of_reg |
// ac_holder_name | ac_number | ac_type | ifsc | bank_name | bank_branch_name |
// bank_address | preferred_payment_mode | document (JSON) | remarks |
// workflow_types_id | current_approver_id | status | stage_order_json (JSON)

interface ServiceVendorKycApprovalScreenLayoutProps {
  approvalName: string;
  kycList: any[];
  selectedKyc: any;
  handleKycSelect: (kyc: any) => void;
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

function parseDocuments(kyc: any): { documentType: string; url: string; filename: string }[] {
  try {
    const raw = kyc?.document;
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function KycListCard({ kyc, isSelected, onClick }: { kyc: any; isSelected: boolean; onClick: () => void }) {
  const status = statusMeta(AGREEMENT_STATUS, kyc.status);
  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{kyc.company_name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{kyc.contact_person}</span>
        </span>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60'}`} />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </span>
      <span className="mt-3 block space-y-1 text-xs">
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Mobile</span>
          <span className="text-right font-medium">{kyc.mobile_number}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">PAN</span>
          <span className="text-right font-medium">{kyc.pan_no}</span>
        </span>
      </span>
    </SelectableCard>
  );
}

function KycDetailPanel({ kyc, handleAction }: { kyc: any; handleAction: (a: string) => void }) {
  const { canEdit } = usePermissions();
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const isCurrentApprover = kyc.current_approver_id && userEcno && String(kyc.current_approver_id).trim() === String(userEcno).trim();
  const canAct = canEdit('ServiceVendorKycApprovalScreen') && !!isCurrentApprover;
  const stages = useMemo(() => parseStages(kyc), [kyc]);
  const documents = useMemo(() => parseDocuments(kyc), [kyc]);
  const status = statusMeta(AGREEMENT_STATUS, kyc.status);

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={ShieldCheck}
              eyebrow="Service Vendor KYC"
              title={kyc.company_name}
              subtitle={kyc.contact_person}
              badges={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
              metrics={[
                { label: 'Business type', value: kyc.business_type ?? '—' },
                { label: 'PAN', value: kyc.pan_no ?? '—' },
                { label: 'GST', value: kyc.gst_no ?? '—' },
              ]}
            />

            <Panel icon={IdCard} title="Contact & registration">
              <FactGrid>
                <Fact label="Mobile">{kyc.mobile_number ?? '—'}</Fact>
                <Fact label="Email">{kyc.email ?? '—'}</Fact>
                <Fact label="Category">{kyc.supplier_cat_code ?? '—'}</Fact>
                <Fact label="MSME No.">{kyc.msme_no ?? '—'}</Fact>
                <Fact label="Legal name">{kyc.legal_name ?? '—'}</Fact>
                <Fact label="Trade name">{kyc.trade_name ?? '—'}</Fact>
              </FactGrid>
            </Panel>

            <Panel icon={Landmark} title="Bank details">
              <FactGrid>
                <Fact label="Account holder">{kyc.ac_holder_name ?? '—'}</Fact>
                <Fact label="Account number">{kyc.ac_number ?? '—'}</Fact>
                <Fact label="Account type">{kyc.ac_type ?? '—'}</Fact>
                <Fact label="IFSC">{kyc.ifsc ?? '—'}</Fact>
                <Fact label="Bank">{kyc.bank_name ?? '—'}</Fact>
                <Fact label="Branch">{kyc.bank_branch_name ?? '—'}</Fact>
                <Fact label="Preferred payment mode">{kyc.preferred_payment_mode ?? '—'}</Fact>
              </FactGrid>
            </Panel>

            {documents.length > 0 && (
              <Panel icon={IdCard} title="Documents">
                <ul className="space-y-2">
                  {documents.map((d, i) => (
                    <li key={i}>
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-2">
                        {d.filename || d.documentType || `Document ${i + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {kyc.remarks && (
              <Panel icon={IdCard} title="Remarks">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{kyc.remarks}</p>
              </Panel>
            )}

            <ApprovalStepper stages={stages} currentApproverId={kyc.current_approver_id} currentUserEcno={userEcno} />
          </div>

          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this KYC" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canAct ? (
                  <DecisionButtons
                    className="flex-col"
                    approveLabel="Approve KYC"
                    rejectLabel="Reject KYC"
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
                  {kyc.current_approver_id && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{kyc.current_approver_id}</dd>
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

export default function ServiceVendorKycApprovalScreenLayout({
  approvalName, kycList, selectedKyc, handleKycSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, toast,
}: ServiceVendorKycApprovalScreenLayoutProps) {
  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={kycList.length}
        sidebarCountLabel="KYC"
        toast={toast}
        listItems={(closeSheet) =>
          kycList.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No pending KYCs</p>
          ) : (
            kycList.map((kyc: any) => (
              <KycListCard
                key={kyc.service_vendor_kyc_sno}
                kyc={kyc}
                isSelected={selectedKyc?.service_vendor_kyc_sno === kyc.service_vendor_kyc_sno}
                onClick={() => { handleKycSelect(kyc); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedKyc}
        detailContent={
          selectedKyc
            ? <KycDetailPanel kyc={selectedKyc} handleAction={handleAction} />
            : null
        }
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={kycList.length === 0 ? 'Nothing waiting on you' : 'No KYC selected'}
            description={kycList.length === 0
              ? 'Service vendor KYCs routed to you for approval will show up here.'
              : 'Pick a KYC from the list to review its details and take action.'}
          />
        }
        mobileListLabel="KYC list"
        mobileSelectionTitle={selectedKyc?.company_name}
      />

      <ApprovalDecisionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        actionType={actionType}
        comments={comments}
        setComments={setComments}
        onSubmit={handleSubmit}
        loading={loading}
        entityName="KYC"
        approveNote="If this is the final stage, the vendor is approved and becomes available for Service Agreements."
        summary={selectedKyc ? [
          { label: 'Company', value: selectedKyc.company_name },
          { label: 'PAN', value: selectedKyc.pan_no ?? '—' },
        ] : undefined}
      />
    </>
  );
}
