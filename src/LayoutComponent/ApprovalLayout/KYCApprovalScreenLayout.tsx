import { useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronRight, Download, ExternalLink, Eye, FileText, History, IdCard, Landmark,
  Layers, MapPin, RefreshCw, ShieldCheck, Star, User, Users, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getAuthFileUrl } from '@/Services/authUrl';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  ApprovalDecisionDialog, ApprovalStepper, DecisionButtons, DetailEmptyState,
  DetailHero, Fact, FactGrid, Panel, SearchInput, SelectableCard, StatusPill, StickyActionBar,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, TONE, formatDate, parseStages, statusMeta,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import type { KYCApprovalRecord } from '@/Application/Kyc-Screen/types/KYCApprovalType';

// ─── Helpers ───────────────────────────────────────────────────────────────

const parseJSON = (raw: string | any[] | undefined | null): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** business_type holds a master id; the SP resolves it to a name. Legacy free-text rows come back unchanged. */
const businessTypeLabel = (kyc: KYCApprovalRecord) => kyc.business_type_name || kyc.business_type || '—';

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isPdfUrl = (url: string) => /\.pdf(\?.*)?$/i.test(url);

interface DocPreview { url: string; name: string; docType?: string }

// ─── Small parts ───────────────────────────────────────────────────────────

function Tag({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', TONE[tone])}>
      {children}
    </span>
  );
}

const PrimaryTag = () => <Tag tone="warning"><Star className="h-2.5 w-2.5" />Primary</Tag>;

/** One address / bank account / contact inside its panel. */
function EntryCard({ icon: Icon, title, primary, children }: {
  icon: LucideIcon; title: string; primary?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border p-3.5 sm:p-4', primary ? 'border-primary/40 bg-primary/5' : 'bg-muted/20')}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        {primary && <PrimaryTag />}
      </div>
      {children}
    </div>
  );
}

const EmptyNote = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

const linkClass = 'text-primary underline-offset-2 hover:underline';

// ─── Sidebar ───────────────────────────────────────────────────────────────

function KycListCard({ kyc, isSelected, onClick }: { kyc: KYCApprovalRecord; isSelected: boolean; onClick: () => void }) {
  const status = statusMeta(AGREEMENT_STATUS, kyc.status ?? 'P');
  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold capitalize">{kyc.company_name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{kyc.contact_person}</span>
        </span>
        <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        {kyc.is_gst_avail === 'Y' && <Tag tone="info">GST</Tag>}
        {kyc.is_msme_avail === 'Y' && <Tag tone="violet">MSME</Tag>}
      </span>
      <span className="mt-3 block space-y-1 text-xs">
        <span className="flex justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">Business type</span>
          <span className="truncate text-right font-medium">{businessTypeLabel(kyc)}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Submitted</span>
          <span className="text-right font-medium">{formatDate(kyc.created_date)}</span>
        </span>
      </span>
    </SelectableCard>
  );
}

// ─── Detail sections ───────────────────────────────────────────────────────

function AddressesPanel({ addresses }: { addresses: any[] }) {
  return (
    <Panel icon={MapPin} title="Addresses" description={`${addresses.length} on file`}>
      {addresses.length === 0 ? <EmptyNote>No addresses found.</EmptyNote> : (
        <div className="space-y-3">
          {addresses.map((addr, idx) => (
            <EntryCard key={idx} icon={MapPin} title={`Address ${idx + 1}`} primary={String(addr.address_type).toUpperCase() === 'PRIMARY'}>
              <FactGrid>
                <Fact label="Street / Door">{[addr.door_no, addr.street].filter(Boolean).join(', ') || '—'}</Fact>
                <Fact label="Area">{addr.area || '—'}</Fact>
                <Fact label="City">{addr.city || '—'}</Fact>
                {addr.taluk && <Fact label="Taluk">{addr.taluk}</Fact>}
                <Fact label="State">{addr.state || '—'}</Fact>
                <Fact label="Pincode"><span className="font-mono">{addr.pincode || '—'}</span></Fact>
                {addr.location_link && (
                  <Fact label="Location">
                    <a href={addr.location_link} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1', linkClass)}>
                      <MapPin className="h-3 w-3" />View on map
                    </a>
                  </Fact>
                )}
              </FactGrid>
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}

function BankPanel({ banks }: { banks: any[] }) {
  return (
    <Panel icon={Landmark} title="Bank details" description={`${banks.length} account${banks.length !== 1 ? 's' : ''}`}>
      {banks.length === 0 ? <EmptyNote>No bank accounts found.</EmptyNote> : (
        <div className="space-y-3">
          {banks.map((bank, idx) => (
            <EntryCard key={idx} icon={Landmark} title={bank.bank_name || `Bank ${idx + 1}`} primary={bank.is_primary === 'Y'}>
              <FactGrid>
                <Fact label="Account holder">{bank.ac_holder_name || '—'}</Fact>
                <Fact label="Account number"><span className="font-mono">{bank.ac_number || '—'}</span></Fact>
                {/* ac_type is the master id; ac_type_name is what the SP resolved it to */}
                <Fact label="Account type">{bank.ac_type_name || bank.ac_type || '—'}</Fact>
                <Fact label="IFSC"><span className="font-mono">{bank.ifsc || '—'}</span></Fact>
                <Fact label="Bank">{bank.bank_name || '—'}</Fact>
                <Fact label="Branch">{bank.bank_branch_name || '—'}</Fact>
              </FactGrid>
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ContactsPanel({ contacts }: { contacts: any[] }) {
  return (
    <Panel icon={Users} title="Contacts" description={`${contacts.length} on file`}>
      {contacts.length === 0 ? <EmptyNote>No contacts found.</EmptyNote> : (
        <div className="space-y-3">
          {contacts.map((c, idx) => {
            const name = c.contact_name || c.ownername || '—';
            const position = c.contact_position || c.ownerposition || '';
            const mobile = c.contact_mobile || c.ownermobile || '';
            const email = c.contact_email || c.owneremail || '';
            return (
              <EntryCard key={idx} icon={User} title={position ? `${name} — ${position}` : name} primary={String(c.contact_type).toUpperCase() === 'PRIMARY'}>
                <FactGrid>
                  <Fact label="Mobile">
                    {mobile ? <a href={`tel:${mobile}`} className={linkClass}>{mobile}</a> : '—'}
                  </Fact>
                  <Fact label="Email">
                    {email ? <a href={`mailto:${email}`} className={cn('break-all', linkClass)}>{email}</a> : '—'}
                  </Fact>
                </FactGrid>
              </EntryCard>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function DocumentsPanel({ documents, onPreview }: { documents: any[]; onPreview: (d: DocPreview) => void }) {
  return (
    <Panel icon={FileText} title="Documents" description={`${documents.length} uploaded`}>
      {documents.length === 0 ? <EmptyNote>No documents uploaded.</EmptyNote> : (
        <ul className="space-y-2">
          {documents.map((doc, idx) => {
            const docUrl = doc.document_path || doc.url || '';
            const docName = doc.document_name || doc.filename || `Document ${idx + 1}`;
            const docType = doc.document_type || doc.documentType || 'File';
            const authUrl = getAuthFileUrl(docUrl);
            const isImg = isImageUrl(authUrl);
            const isPdf = isPdfUrl(authUrl);
            return (
              <li key={idx} className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-nowrap">
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  isImg ? TONE.violet : isPdf ? TONE.danger : TONE.neutral, 'border',
                )}>
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{docName}</p>
                  <p className="text-xs text-muted-foreground">{docType} · {isImg ? 'Image' : isPdf ? 'PDF' : 'File'}</p>
                </div>
                {docUrl && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs" onClick={() => onPreview({ url: authUrl, name: docName, docType })}>
                      <Eye className="h-3.5 w-3.5" />Preview
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs">
                      <a href={authUrl} download={docName} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />Save
                      </a>
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function HistoryPanel({ history }: { history: any[] }) {
  return (
    <Panel icon={History} title="Approval history" description={`${history.length} action${history.length !== 1 ? 's' : ''}`}>
      <ol className="space-y-4">
        {history.map((entry, idx) => (
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

function DocPreviewDrawer({ doc, onClose }: { doc: DocPreview; onClose: () => void }) {
  const headerLink = 'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted';
  return (
    <>
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-card shadow-2xl sm:w-[520px] lg:w-[45%]">
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{doc.docType}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className={headerLink}><ExternalLink className="h-3 w-3" />Open</a>
            <a href={doc.url} download={doc.name} target="_blank" rel="noopener noreferrer" className={headerLink}><Download className="h-3 w-3" />Save</a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-muted">
          {isImageUrl(doc.url) ? (
            <div className="flex h-full items-center justify-center p-4">
              <img src={doc.url} alt={doc.name} className="max-h-full max-w-full rounded-lg object-contain shadow-md" />
            </div>
          ) : isPdfUrl(doc.url) ? (
            <iframe src={doc.url} title={doc.name} className="h-full w-full border-0" allow="fullscreen" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </span>
              <div>
                <p className="font-semibold">Preview unavailable</p>
                <p className="mt-1 text-sm text-muted-foreground">Use Open or Save to access this file</p>
              </div>
              <Button asChild>
                <a href={doc.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open in new tab</a>
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={onClose} />
    </>
  );
}

// ─── Detail panel ──────────────────────────────────────────────────────────

function KycDetailPanel({ kyc, handleAction }: { kyc: KYCApprovalRecord; handleAction: (a: string) => void }) {
  const { canEdit } = usePermissions();
  const [docPreview, setDocPreview] = useState<DocPreview | null>(null);

  const addresses = useMemo(() => parseJSON(kyc.kyc_address), [kyc]);
  const banks = useMemo(() => parseJSON(kyc.kyc_bank_info), [kyc]);
  const contacts = useMemo(() => parseJSON(kyc.kyc_contact_details), [kyc]);
  const documents = useMemo(() => parseJSON(kyc.kyc_uploaded_doc), [kyc]);
  const history = useMemo(() => parseJSON(kyc.kyc_history_data), [kyc]);
  const stages = useMemo(() => parseStages(kyc), [kyc]);

  const status = statusMeta(AGREEMENT_STATUS, kyc.status ?? 'P');
  const currentApprover = kyc.current_approver_id ?? kyc.approver_ecno;
  const canReview = canEdit('KYCApprovalScreen');

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={ShieldCheck}
              eyebrow="Supplier KYC"
              title={kyc.company_name}
              subtitle={kyc.contact_person}
              badges={
                <>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  {kyc.supp_code && <Tag tone="neutral"><span className="font-mono">{kyc.supp_code}</span></Tag>}
                  {kyc.is_gst_avail === 'Y' && <Tag tone="info">GST registered</Tag>}
                  {kyc.is_msme_avail === 'Y' && <Tag tone="violet">MSME certified</Tag>}
                </>
              }
              metrics={[
                { label: 'Business type', value: businessTypeLabel(kyc) },
                // Identifiers, not headline figures — the default metric size wraps a 15-char GSTIN mid-token
                { label: 'PAN', value: kyc.pan_no || '—', valueClassName: 'text-base @md:text-base' },
                { label: 'GST', value: kyc.gst_no || '—', valueClassName: 'text-base @md:text-base' },
              ]}
            />

            <Panel icon={IdCard} title="Contact & registration">
              <FactGrid>
                <Fact label="Contact person">{kyc.contact_person || '—'}</Fact>
                <Fact label="Mobile">
                  {kyc.mobile_number ? <a href={`tel:${kyc.mobile_number}`} className={linkClass}>{kyc.mobile_number}</a> : '—'}
                </Fact>
                <Fact label="Email">
                  {kyc.email ? <a href={`mailto:${kyc.email}`} className={cn('break-all', linkClass)}>{kyc.email}</a> : '—'}
                </Fact>
                <Fact label="MSME no.">{kyc.msme_no || '—'}</Fact>
                {kyc.legal_name && <Fact label="Legal name">{kyc.legal_name}</Fact>}
                {kyc.trade_name && <Fact label="Trade name">{kyc.trade_name}</Fact>}
                <Fact label="Submitted on">{formatDate(kyc.created_date)}</Fact>
              </FactGrid>
            </Panel>

            <AddressesPanel addresses={addresses} />
            <BankPanel banks={banks} />
            <ContactsPanel contacts={contacts} />
            <DocumentsPanel documents={documents} onPreview={setDocPreview} />

            <ApprovalStepper stages={stages} currentApproverId={currentApprover} />
            {history.length > 0 && <HistoryPanel history={history} />}
          </div>

          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this KYC" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canReview ? (
                  <DecisionButtons
                    className="flex-col"
                    approveLabel="Approve KYC"
                    rejectLabel="Reject KYC"
                    onApprove={() => handleAction('approve')}
                    onReject={() => handleAction('reject')}
                  />
                ) : (
                  <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
                    View only — no approval permission
                  </p>
                )}
                <dl className="space-y-2 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd><StatusPill tone={status.tone}>{status.label}</StatusPill></dd>
                  </div>
                  {currentApprover && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{currentApprover}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <StickyActionBar>
        {canReview ? (
          <DecisionButtons
            className="@md:justify-end @md:[&>button]:min-w-44 @md:[&>button]:flex-none"
            approveLabel="Approve"
            rejectLabel="Reject"
            onApprove={() => handleAction('approve')}
            onReject={() => handleAction('reject')}
          />
        ) : (
          <p className="py-1 text-center text-xs text-muted-foreground">View only — no approval permission</p>
        )}
      </StickyActionBar>

      {docPreview && <DocPreviewDrawer doc={docPreview} onClose={() => setDocPreview(null)} />}
    </div>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────

interface KYCApprovalScreenLayoutProps {
  approvalName: string;
  /** Every pending KYC (drives the sidebar count). */
  totalCount: number;
  /** The pending KYCs after the search filter. */
  kycList: KYCApprovalRecord[];
  search: string;
  setSearch: (search: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  selectedKyc: KYCApprovalRecord | null;
  handleKycSelect: (kyc: KYCApprovalRecord) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: 'approve' | 'reject';
}

export default function KYCApprovalScreenLayout({
  approvalName, totalCount, kycList, search, setSearch, onRefresh, refreshing,
  selectedKyc, handleKycSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType,
}: KYCApprovalScreenLayoutProps) {
  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={totalCount}
        sidebarCountLabel="KYC"
        listItems={(closeSheet) => (
          <>
            {/* Pinned above the scrolling list; the negative margins cancel the list container's padding */}
            <div className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
              <SearchInput value={search} onChange={setSearch} placeholder="Search company…" className="min-w-0 flex-1" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh list"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </div>
            {kycList.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'No matches found' : 'No pending KYCs'}
              </p>
            ) : (
              kycList.map((kyc) => (
                <KycListCard
                  key={kyc.kyc_basic_info_sno}
                  kyc={kyc}
                  isSelected={selectedKyc?.kyc_basic_info_sno === kyc.kyc_basic_info_sno}
                  onClick={() => { handleKycSelect(kyc); closeSheet(); }}
                />
              ))
            )}
          </>
        )}
        hasSelection={!!selectedKyc}
        detailContent={selectedKyc ? <KycDetailPanel kyc={selectedKyc} handleAction={handleAction} /> : null}
        emptyContent={
          <DetailEmptyState
            icon={Layers}
            title={totalCount === 0 ? 'Nothing waiting on you' : 'No KYC selected'}
            description={totalCount === 0
              ? 'Supplier KYC submissions routed to you for approval will show up here.'
              : 'Pick a submission from the list to review its details and take action.'}
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
        approveNote="If this is the final stage, the supplier is approved and receives a supplier code and portal invite; otherwise it moves to the next approver."
        summary={selectedKyc ? [
          { label: 'Company', value: selectedKyc.company_name },
          { label: 'Contact', value: selectedKyc.contact_person || '—' },
        ] : undefined}
      />
    </>
  );
}
