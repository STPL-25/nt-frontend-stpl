import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, FileText, Star, User,
  ShieldCheck, MapPin, CreditCard, Calendar, Eye, Download,
  ExternalLink, GitBranch, History, Search, RefreshCw,
  Loader2, Menu, Hash, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TwoPaneLayout, EmptyState, LoadingState, ErrorState } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { apiGetKycPendingApprovals, apiKycApproveAction } from '@/Services/Api';
import { useAppState } from '@/imports';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getAuthFileUrl } from '@/Services/authUrl';
import { StatusBadge } from '@/utils/statusUtils';
import { socket, SOCKET_JOIN_KYC_APPROVAL, SOCKET_LEAVE_KYC_APPROVAL, SOCKET_KYC_APPROVAL_UPDATED } from '@/Services/Socket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KYCApprovalRecord {
  kyc_basic_info_sno: number;
  company_name: string;
  contact_person: string;
  email: string;
  mobile_number: string;
  business_type: string;
  is_gst_avail: string;
  gst_no: string;
  is_msme_avail: string;
  msme_no: string | null;
  pan_no: string;
  status: string;
  supp_code: string | null;
  created_date: string;
  created_by: string | null;
  created_by_name?: string;
  current_approver_id?: string;
  workflow_types_id?: number;
  stage_order_json?: string | any[];
  kyc_history_data?: string | any[];
  kyc_address: string;
  kyc_bank_info: string;
  kyc_contact_details: string;
  kyc_uploaded_doc: string;
}

interface APIResponse {
  success: boolean;
  data: KYCApprovalRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseJSON = (raw: string | any[] | undefined) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const getInitials = (name: string) =>
  name?.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('');

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isPdfUrl   = (url: string) => /\.pdf(\?.*)?$/i.test(url);

// ─── Field (label-over-value display cell) ─────────────────────────────────────

function Field({ label, value, mono = false, fullWidth = false }: {
  label: string; value?: string | React.ReactNode; mono?: boolean; fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-medium text-foreground mt-0.5 ${mono ? 'font-mono text-xs' : 'capitalize'}`}>
        {value || '—'}
      </p>
    </div>
  );
}

// ─── ItemCard (address / bank / contact entry wrapper) ─────────────────────────

function ItemCard({ icon: Icon, title, isPrimary, children }: {
  icon: any; title: string; isPrimary?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      isPrimary ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground capitalize truncate">{title}</span>
        {isPrimary && (
          <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-white text-[10px] gap-1 flex-shrink-0">
            <Star className="h-3 w-3" /> Primary
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Sidebar KYC Row ──────────────────────────────────────────────────────────

function KYCSidebarRow({ kyc, isSelected, onClick }: {
  kyc: KYCApprovalRecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border hover:bg-primary/10 transition-colors border-l-4 ${
        isSelected ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-sm font-semibold truncate capitalize leading-tight ${
          isSelected ? 'text-primary' : 'text-foreground'
        }`}>
          {kyc.company_name}
        </span>
        <StatusBadge status={kyc.status ?? 'P'} withDot className="flex-shrink-0" />
      </div>
      <div className="text-xs text-muted-foreground truncate capitalize">{kyc.business_type}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground/70">{kyc.contact_person}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
          <Calendar size={11} />
          {formatDate(kyc.created_date)}
        </div>
      </div>
      {(kyc.is_gst_avail === 'Y' || kyc.is_msme_avail === 'Y') && (
        <div className="flex gap-1 mt-1.5">
          {kyc.is_gst_avail === 'Y' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800">GST</span>
          )}
          {kyc.is_msme_avail === 'Y' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800">MSME</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Address Section ──────────────────────────────────────────────────────────

function AddressSection({ addresses }: { addresses: any[] }) {
  if (addresses.length === 0) return (
    <div className="py-6 text-center text-sm text-muted-foreground/70">No addresses found</div>
  );
  return (
    <div className="space-y-3">
      {addresses.map((addr: any, idx: number) => (
        <ItemCard
          key={idx}
          icon={MapPin}
          title={addr.isPrimary ? 'Primary Address' : `Address ${idx + 1}`}
          isPrimary={addr.isPrimary}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {(addr.door_no || addr.street) && (
              <Field label="Street / Door" value={[addr.door_no, addr.street].filter(Boolean).join(', ')} />
            )}
            {addr.area && <Field label="Area" value={addr.area} />}
            <Field label="City" value={addr.city} />
            <Field label="State" value={addr.state} />
            <Field label="Pincode" value={addr.pincode} mono />
            {addr.location_link && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Location</p>
                <a
                  href={addr.location_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <MapPin className="h-3 w-3" /> View on Map
                </a>
              </div>
            )}
          </div>
        </ItemCard>
      ))}
    </div>
  );
}

// ─── Bank Section ─────────────────────────────────────────────────────────────

function BankSection({ bankInfo }: { bankInfo: any[] }) {
  if (bankInfo.length === 0) return (
    <div className="py-6 text-center text-sm text-muted-foreground/70">No bank accounts found</div>
  );
  return (
    <div className="space-y-3">
      {bankInfo.map((bank: any, idx: number) => (
        <ItemCard
          key={idx}
          icon={CreditCard}
          title={bank.bank_name || `Bank ${idx + 1}`}
          isPrimary={bank.isPrimary}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Bank Name"    value={bank.bank_name} />
            <Field label="Branch"       value={bank.bank_branch_name} />
            <Field label="Account No."  value={bank.ac_number} mono />
            <Field label="IFSC Code"    value={bank.ifsc} mono />
            <Field label="Account Type" value={bank.ac_type} />
            <Field label="Holder Name"  value={bank.ac_holder_name} />
          </div>
        </ItemCard>
      ))}
    </div>
  );
}

// ─── Contacts Section ─────────────────────────────────────────────────────────

function ContactsSection({ contacts }: { contacts: any[] }) {
  if (contacts.length === 0) return (
    <div className="py-6 text-center text-sm text-muted-foreground/70">No contacts found</div>
  );
  return (
    <div className="space-y-3">
      {contacts.map((contact: any, idx: number) => {
        const name   = contact.contact_name  || contact.ownername    || '—';
        const pos    = contact.contact_position || contact.ownerposition || '';
        const mobile = contact.contact_mobile || contact.ownermobile  || '';
        const email  = contact.contact_email  || contact.owneremail   || '';
        return (
          <ItemCard key={idx} icon={User} title={pos ? `${name} — ${pos}` : name} isPrimary={contact.isPrimary}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {mobile && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Mobile</p>
                  <a href={`tel:${mobile}`} className="text-sm font-medium text-primary hover:underline">{mobile}</a>
                </div>
              )}
              {email && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Email</p>
                  <a href={`mailto:${email}`} className="text-sm font-medium text-primary hover:underline truncate block">{email}</a>
                </div>
              )}
            </div>
          </ItemCard>
        );
      })}
    </div>
  );
}

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentsSection({
  documents,
  onPreview,
}: {
  documents: any[];
  onPreview: (d: { url: string; name: string; docType?: string }) => void;
}) {
  if (documents.length === 0) return (
    <div className="py-6 text-center text-sm text-muted-foreground/70">No documents uploaded</div>
  );
  return (
    <div className="space-y-2">
      {documents.map((doc: any, idx: number) => {
        const docUrl  = doc.document_path || doc.url || '';
        const docName = doc.document_name || doc.filename || `Document ${idx + 1}`;
        const docType = doc.document_type || doc.documentType || 'File';
        const authUrl = getAuthFileUrl(docUrl);
        const isImg   = isImageUrl(authUrl);
        const isPdf   = isPdfUrl(authUrl);
        return (
          <div key={idx} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isImg ? 'bg-violet-100 dark:bg-violet-950/30' : isPdf ? 'bg-red-100 dark:bg-red-950/30' : 'bg-muted'
            }`}>
              <FileText className={`h-4 w-4 ${isImg ? 'text-violet-600 dark:text-violet-400' : isPdf ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{docName}</p>
              <p className="text-xs text-muted-foreground/70">{docType} · {isImg ? 'Image' : isPdf ? 'PDF' : 'File'}</p>
            </div>
            {docUrl && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => onPreview({ url: authUrl, name: docName, docType })}
                >
                  <Eye className="h-3 w-3" /> Preview
                </Button>
                <a
                  href={authUrl}
                  download={docName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <Download className="h-3 w-3" /> Save
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── History Section ──────────────────────────────────────────────────────────

function HistorySection({ history }: { history: any[] }) {
  if (!history.length) return <p className="text-sm text-muted-foreground/70 text-center py-6">No history yet</p>;
  return (
    <div className="space-y-3">
      {history.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{entry.ename ?? '—'}</p>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800">
                {entry.status_by}
              </Badge>
            </div>
            {entry.status_date && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">{formatDate(entry.status_date)}</p>
            )}
            {entry.commends && (
              <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-emerald-300 dark:border-emerald-700 pl-2">"{entry.commends}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Stages Section ───────────────────────────────────────────────────────────

function StagesSection({ stages, currentApproverId }: { stages: any[]; currentApproverId?: string }) {
  if (!stages.length) return <p className="text-sm text-muted-foreground/70 text-center py-6">No workflow configured</p>;
  return (
    <div className="space-y-3">
      {stages.map((stage: any, idx: number) => {
        const isCurrent = stage.approver_ecno === currentApproverId;
        return (
          <div key={idx} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
              isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{stage.stage ?? `Stage ${idx + 1}`}</p>
              <p className="text-xs text-muted-foreground/70 font-mono">{stage.approver_ecno}</p>
            </div>
            {isCurrent && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                Current
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── KYC Detail Panel ─────────────────────────────────────────────────────────

function KYCDetailPanel({
  kyc,
  handleAction,
}: {
  kyc: KYCApprovalRecord;
  handleAction: (action: string) => void;
}) {
  const { canEdit } = usePermissions();
  const [docPreview, setDocPreview] = useState<{ url: string; name: string; docType?: string } | null>(null);

  const addresses = useMemo(() => parseJSON(kyc.kyc_address), [kyc]);
  const bankInfo  = useMemo(() => parseJSON(kyc.kyc_bank_info), [kyc]);
  const contacts  = useMemo(() => parseJSON(kyc.kyc_contact_details), [kyc]);
  const documents = useMemo(() => parseJSON(kyc.kyc_uploaded_doc), [kyc]);
  const stages    = useMemo(() => parseJSON(kyc.stage_order_json), [kyc]);
  const history   = useMemo(() => parseJSON(kyc.kyc_history_data), [kyc]);

  const basicFields: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Company Name',   value: kyc.company_name },
    { label: 'Business Type',  value: kyc.business_type },
    { label: 'Contact Person', value: kyc.contact_person },
    { label: 'Email',          value: kyc.email },
    { label: 'Mobile',         value: kyc.mobile_number },
    { label: 'PAN Number',     value: kyc.pan_no,         mono: true },
    { label: 'GST Number',     value: kyc.gst_no || '—',  mono: true },
    { label: 'MSME Number',    value: kyc.msme_no || '—', mono: true },
    { label: 'Submitted On',   value: formatDate(kyc.created_date) },
  ];

  const canReview = canEdit('KYCApprovalScreen');

  return (
    <div className="space-y-4">
      {/* Hero card: identity + review actions */}
      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className="h-11 w-11 rounded-xl flex-shrink-0">
                <AvatarFallback className="rounded-xl bg-primary text-primary-foreground font-bold text-base">
                  {getInitials(kyc.company_name) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base capitalize">{kyc.company_name}</CardTitle>
                  <StatusBadge status={kyc.status ?? 'P'} withDot />
                </div>
                <p className="text-sm text-muted-foreground capitalize mt-0.5">{kyc.business_type}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {kyc.supp_code && (
                    <Badge variant="outline" className="font-mono text-[10px]">{kyc.supp_code}</Badge>
                  )}
                  {kyc.is_gst_avail === 'Y' && (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800">GST Registered</Badge>
                  )}
                  {kyc.is_msme_avail === 'Y' && (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800">MSME Certified</Badge>
                  )}
                </div>
              </div>
            </div>
            {canReview ? (
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleAction('approve')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('reject')}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30 gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 flex-shrink-0">View only — no approval permission</p>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <Tabs defaultValue="basic">
            <TabsList className="h-9 bg-muted border border-border p-1 rounded-lg mb-5 flex flex-wrap gap-0.5">
              {[
                { value: 'basic',     label: 'Basic Info',  count: null },
                { value: 'address',   label: 'Address',     count: addresses.length },
                { value: 'bank',      label: 'Bank',        count: bankInfo.length },
                { value: 'contacts',  label: 'Contacts',    count: contacts.length },
                { value: 'documents', label: 'Documents',   count: documents.length },
              ].map(({ value, label, count }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm"
                >
                  {label}
                  {count !== null && (
                    <span className="ml-1 text-[10px] font-bold text-muted-foreground/70">{count}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {basicFields.map(({ label, value, mono }) => (
                  <Field key={label} label={label} value={value} mono={mono} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="address" className="mt-0">
              <AddressSection addresses={addresses} />
            </TabsContent>

            <TabsContent value="bank" className="mt-0">
              <BankSection bankInfo={bankInfo} />
            </TabsContent>

            <TabsContent value="contacts" className="mt-0">
              <ContactsSection contacts={contacts} />
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <DocumentsSection documents={documents} onPreview={setDocPreview} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Workflow & History */}
      {(stages.length > 0 || history.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stages.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" /> Approval Workflow
                  <Badge variant="secondary" className="text-xs">{stages.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <StagesSection stages={stages} currentApproverId={kyc.current_approver_id} />
              </CardContent>
            </Card>
          )}
          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Approval History
                  <Badge variant="secondary" className="text-xs">{history.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <HistorySection history={history} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Document preview drawer */}
      {docPreview && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] lg:w-[45%] flex flex-col bg-card border-l shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{docPreview.name}</p>
                <p className="text-xs text-muted-foreground/70">{docPreview.docType}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              <a href={docPreview.url} download={docPreview.name} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <Download className="h-3 w-3" /> Save
              </a>
              <button
                onClick={() => setDocPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-muted">
            {isImageUrl(docPreview.url) ? (
              <div className="h-full flex items-center justify-center p-4">
                <img src={docPreview.url} alt={docPreview.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
              </div>
            ) : isPdfUrl(docPreview.url) ? (
              <iframe src={docPreview.url} title={docPreview.name} className="w-full h-full border-0" allow="fullscreen" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center shadow">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Preview unavailable</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Use Open or Save to access this file</p>
                </div>
                <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors font-medium">
                  <ExternalLink className="h-4 w-4" /> Open in new tab
                </a>
              </div>
            )}
          </div>
        </div>
      )}
      {docPreview && (
        <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={() => setDocPreview(null)} />
      )}
    </div>
  );
}

// ─── Root Screen ──────────────────────────────────────────────────────────────

const KYCApprovalScreen: React.FC = () => {
  const [selectedKYC, setSelectedKYC] = useState<KYCApprovalRecord | null>(null);
  const [kycList, setKycList]         = useState<KYCApprovalRecord[]>([]);
  const [search, setSearch]           = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDialog, setShowDialog]   = useState(false);
  const [actionType, setActionType]   = useState<'approve' | 'reject'>('approve');
  const [comments, setComments]       = useState('');
  const [refreshKey, setRefreshKey]   = useState(0);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    apiGetKycPendingApprovals, '', null, refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setKycList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_KYC_APPROVAL);
    const onUpdated = (d: { kyc_basic_info_sno: number; action: string; approved_by: string }) => {
      if (d.approved_by === userData[0]?.ecno) return;
      setRefreshKey(k => k + 1);
      toast.info(`KYC ${d.action === 'approve' ? 'approved' : 'rejected'} — refreshing…`);
    };
    socket.on(SOCKET_KYC_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_KYC_APPROVAL);
      socket.off(SOCKET_KYC_APPROVAL_UPDATED, onUpdated);
    };
  }, [userData]);

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedKYC) return;
    let approval_stages: any[] = [];
    if (selectedKYC.stage_order_json) {
      try {
        approval_stages = typeof selectedKYC.stage_order_json === 'string'
          ? JSON.parse(selectedKYC.stage_order_json)
          : selectedKYC.stage_order_json;
      } catch { /* ignore */ }
    }
    const payload = {
      kyc_basic_info_sno: selectedKYC.kyc_basic_info_sno,
      ecno: userData[0]?.ecno,
      action: actionType,
      comments: comments.trim(),
      approval_stages,
    };
    try {
      await postData(apiKycApproveAction, payload);
      setKycList(prev => prev.filter(k => k.kyc_basic_info_sno !== selectedKYC.kyc_basic_info_sno));
      setSelectedKYC(null);
      setShowDialog(false);
      setComments('');
      toast.success(`KYC ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Action failed');
    }
  };

  const filteredList = useMemo(
    () => kycList.filter(k =>
      !search || k.company_name.toLowerCase().includes(search.toLowerCase())
    ),
    [kycList, search],
  );

  const gstCount  = useMemo(() => kycList.filter(k => k.is_gst_avail === 'Y').length, [kycList]);
  const msmeCount = useMemo(() => kycList.filter(k => k.is_msme_avail === 'Y').length, [kycList]);

  // ── Sidebar JSX ──────────────────────────────────────────────────────────
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-card"
          />
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <FileText size={24} />
            <span className="text-sm">{search ? 'No matches found' : 'No pending KYC approvals'}</span>
          </div>
        ) : (
          filteredList.map(kyc => (
            <KYCSidebarRow
              key={kyc.kyc_basic_info_sno}
              kyc={kyc}
              isSelected={selectedKYC?.kyc_basic_info_sno === kyc.kyc_basic_info_sno}
              onClick={() => { setSelectedKYC(kyc); setSidebarOpen(false); }}
            />
          ))
        )}
      </div>
    </div>
  );

  // ── Error / Loading states ─────────────────────────────────────────────────
  if (error) {
    return <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} fullPage />;
  }

  if (fetchLoading && kycList.length === 0) {
    return <LoadingState message="Loading KYC Approvals…" fullPage />;
  }

  return (
    <>
      <TwoPaneLayout
        icon={ShieldCheck}
        title="KYC Approvals"
        description="Review and approve supplier KYC submissions"
        stats={[
          { label: 'Pending',         value: kycList.length, icon: FileText },
          { label: 'GST Registered',  value: gstCount,        icon: Hash },
          { label: 'MSME Certified',  value: msmeCount,       icon: Building2 },
        ]}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        sidebar={sidebarContent}
        headerChildren={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={16} className="mr-1" /> KYC List
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={fetchLoading}
            >
              <RefreshCw size={15} className={fetchLoading ? 'animate-spin mr-1' : 'mr-1'} />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="px-4 sm:px-6 py-4">
          {selectedKYC ? (
            <KYCDetailPanel kyc={selectedKYC} handleAction={handleAction} />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              message="Select a KYC Submission"
              description="Choose a submission from the list on the left to review its details"
            />
          )}
        </div>
      </TwoPaneLayout>

      {/* Confirmation dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                actionType === 'approve' ? 'bg-emerald-100 dark:bg-emerald-950/30' : 'bg-red-100 dark:bg-red-950/30'
              }`}>
                {actionType === 'approve'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
              </div>
              {actionType === 'approve' ? 'Approve KYC' : 'Reject KYC'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {actionType === 'approve'
                ? 'Optionally add a note before approving.'
                : 'Provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {actionType === 'approve' && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Confirming Approval
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  This submission will proceed to the next workflow stage.
                </p>
              </div>
            )}

            {selectedKYC && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground/70">Company</span>
                  <span className="font-semibold capitalize">{selectedKYC.company_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground/70">Contact</span>
                  <span className="font-semibold">{selectedKYC.contact_person}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="kyc-comments" className="text-sm font-medium">
                Comments {actionType === 'reject' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="kyc-comments"
                placeholder={actionType === 'approve' ? 'Optional notes…' : 'Reason for rejection (required)…'}
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={loading}
              className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (actionType === 'reject' && !comments.trim())}
              className={`w-full sm:w-auto text-sm font-semibold gap-2 ${
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : actionType === 'approve' ? (
                <><CheckCircle2 className="h-4 w-4" /> Confirm Approval</>
              ) : (
                <><XCircle className="h-4 w-4" /> Confirm Rejection</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KYCApprovalScreen;
