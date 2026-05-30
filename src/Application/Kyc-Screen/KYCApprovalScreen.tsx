import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle, CheckCircle2, XCircle, FileText,
  ShieldCheck, MapPin, CreditCard, Calendar, Eye, Download,
  ExternalLink, GitBranch, History, Search, RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { apiGetKycPendingApprovals, apiKycApproveAction } from '@/Services/Api';
import { useAppState } from '@/imports';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getAuthFileUrl } from '@/Services/authUrl';
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

const STATUS_MAP: Record<string, { label: string; badgeCls: string; dotCls: string }> = {
  P: { label: 'Pending',  badgeCls: 'bg-amber-100 text-amber-700 border-amber-200',   dotCls: 'bg-amber-500' },
  A: { label: 'Approved', badgeCls: 'bg-green-100 text-green-700 border-green-200',   dotCls: 'bg-green-500' },
  R: { label: 'Rejected', badgeCls: 'bg-red-100 text-red-700 border-red-200',         dotCls: 'bg-red-500' },
};

function getStatus(s: string | undefined) {
  const key = String(s ?? 'P').toUpperCase();
  return STATUS_MAP[key] ?? { label: key, badgeCls: '', dotCls: 'bg-gray-400' };
}

// ─── Sidebar KYC Row ──────────────────────────────────────────────────────────

function KYCSidebarRow({ kyc, isSelected, onClick }: {
  kyc: KYCApprovalRecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { label, badgeCls, dotCls } = getStatus(kyc.status);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-indigo-50 transition-colors ${
        isSelected
          ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
          : 'border-l-4 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-sm font-semibold truncate capitalize leading-tight ${
          isSelected ? 'text-indigo-700' : 'text-gray-800'
        }`}>
          {kyc.company_name}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${badgeCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
          {label}
        </span>
      </div>
      <div className="text-xs text-gray-500 truncate capitalize">{kyc.business_type}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">{kyc.contact_person}</span>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={11} />
          {formatDate(kyc.created_date)}
        </div>
      </div>
      {(kyc.is_gst_avail === 'Y' || kyc.is_msme_avail === 'Y') && (
        <div className="flex gap-1 mt-1.5">
          {kyc.is_gst_avail === 'Y' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">GST</span>
          )}
          {kyc.is_msme_avail === 'Y' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">MSME</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-0 pb-2 mb-1">
      <Icon className="h-4 w-4 text-indigo-600" />
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {count !== undefined && (
        <span className="ml-1 text-xs text-gray-400">({count})</span>
      )}
    </div>
  );
}

// ─── Data Row ─────────────────────────────────────────────────────────────────

function DataRow({ label, value, mono = false, fullWidth = false }: {
  label: string; value: string | React.ReactNode; mono?: boolean; fullWidth?: boolean;
}) {
  return (
    <div className={`flex ${fullWidth ? 'flex-col gap-0.5' : 'items-start justify-between gap-4'} py-2 border-b border-gray-100 last:border-0`}>
      <span className="text-xs text-gray-400 flex-shrink-0 min-w-[110px]">{label}</span>
      <span className={`text-sm text-gray-800 font-medium capitalize ${fullWidth ? '' : 'text-right'} ${mono ? 'font-mono tracking-wide text-xs uppercase' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── Address Section ──────────────────────────────────────────────────────────

function AddressSection({ addresses }: { addresses: any[] }) {
  if (addresses.length === 0) return (
    <div className="py-6 text-center text-sm text-gray-400">No addresses found</div>
  );
  return (
    <div className="divide-y divide-gray-100">
      {addresses.map((addr: any, idx: number) => (
        <div key={idx} className="py-4 first:pt-0">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {addr.isPrimary ? 'Primary Address' : `Address ${idx + 1}`}
            </span>
            {addr.isPrimary && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">Primary</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {(addr.door_no || addr.street) && (
              <DataRow label="Street / Door" value={[addr.door_no, addr.street].filter(Boolean).join(', ')} />
            )}
            {addr.area && <DataRow label="Area" value={addr.area} />}
            <DataRow label="City" value={addr.city} />
            <DataRow label="State" value={addr.state} />
            <DataRow label="Pincode" value={addr.pincode} />
            {addr.location_link && (
              <div className="py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-400 block mb-1">Location</span>
                <a
                  href={addr.location_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline"
                >
                  <MapPin className="h-3 w-3" /> View on Map
                </a>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Bank Section ─────────────────────────────────────────────────────────────

function BankSection({ bankInfo }: { bankInfo: any[] }) {
  if (bankInfo.length === 0) return (
    <div className="py-6 text-center text-sm text-gray-400">No bank accounts found</div>
  );
  return (
    <div className="divide-y divide-gray-100">
      {bankInfo.map((bank: any, idx: number) => (
        <div key={idx} className="py-4 first:pt-0">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {bank.bank_name || `Bank ${idx + 1}`}
            </span>
            {bank.isPrimary && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200">Primary</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <DataRow label="Bank Name"     value={bank.bank_name} />
            <DataRow label="Branch"        value={bank.bank_branch_name} />
            <DataRow label="Account No."   value={bank.ac_number} mono />
            <DataRow label="IFSC Code"     value={bank.ifsc} mono />
            <DataRow label="Account Type"  value={bank.ac_type} />
            <DataRow label="Holder Name"   value={bank.ac_holder_name} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Contacts Section ─────────────────────────────────────────────────────────

function ContactsSection({ contacts }: { contacts: any[] }) {
  if (contacts.length === 0) return (
    <div className="py-6 text-center text-sm text-gray-400">No contacts found</div>
  );
  return (
    <div className="divide-y divide-gray-100">
      {contacts.map((contact: any, idx: number) => {
        const name   = contact.contact_name  || contact.ownername    || '—';
        const pos    = contact.contact_position || contact.ownerposition || '';
        const mobile = contact.contact_mobile || contact.ownermobile  || '';
        const email  = contact.contact_email  || contact.owneremail   || '';
        return (
          <div key={idx} className="py-4 first:pt-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                {name[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 capitalize">{name}</p>
                {pos && <p className="text-xs text-gray-400 capitalize">{pos}</p>}
              </div>
              {contact.isPrimary && (
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">Primary</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {mobile && (
                <div className="py-2 border-b border-gray-100 last:border-0 flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-400 flex-shrink-0 min-w-[110px]">Mobile</span>
                  <a href={`tel:${mobile}`} className="text-sm font-medium text-indigo-600 hover:underline">{mobile}</a>
                </div>
              )}
              {email && (
                <div className="py-2 border-b border-gray-100 last:border-0 flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-400 flex-shrink-0 min-w-[110px]">Email</span>
                  <a href={`mailto:${email}`} className="text-sm font-medium text-indigo-600 hover:underline truncate">{email}</a>
                </div>
              )}
            </div>
          </div>
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
    <div className="py-6 text-center text-sm text-gray-400">No documents uploaded</div>
  );
  return (
    <div className="divide-y divide-gray-100">
      {documents.map((doc: any, idx: number) => {
        const docUrl  = doc.document_path || doc.url || '';
        const docName = doc.document_name || doc.filename || `Document ${idx + 1}`;
        const docType = doc.document_type || doc.documentType || 'File';
        const authUrl = getAuthFileUrl(docUrl);
        const isImg   = isImageUrl(authUrl);
        const isPdf   = isPdfUrl(authUrl);
        return (
          <div key={idx} className="py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isImg ? 'bg-violet-100' : isPdf ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              <FileText className={`h-4 w-4 ${isImg ? 'text-violet-600' : isPdf ? 'text-red-600' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{docName}</p>
              <p className="text-xs text-gray-400">{docType} · {isImg ? 'Image' : isPdf ? 'PDF' : 'File'}</p>
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
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
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
  if (!history.length) return null;
  return (
    <div className="divide-y divide-gray-100">
      {history.map((entry: any, idx: number) => (
        <div key={idx} className="py-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-800">{entry.ename ?? '—'}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                {entry.status_by}
              </span>
            </div>
            {entry.status_date && (
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.status_date)}</p>
            )}
            {entry.commends && (
              <p className="text-xs text-gray-600 mt-1.5 italic border-l-2 border-green-300 pl-2">"{entry.commends}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Stages Section ───────────────────────────────────────────────────────────

function StagesSection({ stages, currentApproverId }: { stages: any[]; currentApproverId?: string }) {
  if (!stages.length) return null;
  return (
    <div className="divide-y divide-gray-100">
      {stages.map((stage: any, idx: number) => {
        const isCurrent = stage.approver_ecno === currentApproverId;
        return (
          <div key={idx} className="py-3 flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
              isCurrent ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{stage.stage ?? `Stage ${idx + 1}`}</p>
              <p className="text-xs text-gray-400 font-mono">{stage.approver_ecno}</p>
            </div>
            {isCurrent && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Current
              </span>
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
  const { label: statusLabel, badgeCls, dotCls } = getStatus(kyc.status);

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

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* ── Main scrollable content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Company hero bar */}
        <div className="px-6 py-5 border-b bg-white flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {getInitials(kyc.company_name) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 capitalize">{kyc.company_name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeCls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-gray-500 capitalize mt-0.5">{kyc.business_type}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {kyc.supp_code && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {kyc.supp_code}
                </span>
              )}
              {kyc.is_gst_avail === 'Y' && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">GST Registered</span>
              )}
              {kyc.is_msme_avail === 'Y' && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">MSME Certified</span>
              )}
            </div>
          </div>
          {/* Mobile action buttons */}
          {canEdit('KYCApprovalScreen') && (
            <div className="lg:hidden flex flex-col gap-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={() => handleAction('approve')}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs h-8"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('reject')}
                className="border-red-300 text-red-600 hover:bg-red-50 gap-1.5 text-xs h-8"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 pt-5">
          <Tabs defaultValue="basic">
            <TabsList className="h-9 bg-gray-100 border border-gray-200 p-1 rounded-lg mb-5 flex flex-wrap gap-0.5">
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
                  className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:shadow-sm"
                >
                  {label}
                  {count !== null && (
                    <span className="ml-1 text-[10px] font-bold text-gray-400">{count}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
                {basicFields.map(({ label, value, mono }) => (
                  <DataRow key={label} label={label} value={value} mono={mono} />
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
        </div>

        {/* Workflow & History */}
        {(stages.length > 0 || history.length > 0) && (
          <div className="px-6 pb-6 mt-2">
            <Separator className="mb-5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {stages.length > 0 && (
                <div>
                  <SectionHeader icon={GitBranch} title="Approval Workflow" count={stages.length} />
                  <StagesSection stages={stages} currentApproverId={kyc.current_approver_id} />
                </div>
              )}
              {history.length > 0 && (
                <div>
                  <SectionHeader icon={History} title="Approval History" count={history.length} />
                  <HistorySection history={history} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right action panel (sticky on desktop) ───────────────────────── */}
      <div className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 border-l bg-gray-50 flex-col">
        <div className="p-5 border-b bg-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Review Actions</p>
          {canEdit('KYCApprovalScreen') ? (
            <div className="space-y-2">
              <Button
                onClick={() => handleAction('approve')}
                className="w-full h-10 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve KYC
              </Button>
              <Button
                onClick={() => handleAction('reject')}
                variant="outline"
                className="w-full h-10 text-sm font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-2"
              >
                <XCircle className="h-4 w-4" /> Reject KYC
              </Button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">View only — no approval permission</p>
          )}
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Summary</p>
          <div className="space-y-0">
            {[
              { label: 'Status',       value: statusLabel },
              { label: 'Business Type',value: kyc.business_type || '—' },
              { label: 'GST',          value: kyc.is_gst_avail === 'Y' ? (kyc.gst_no || 'Yes') : 'No' },
              { label: 'MSME',         value: kyc.is_msme_avail === 'Y' ? (kyc.msme_no || 'Yes') : 'No' },
              { label: 'Addresses',    value: String(addresses.length) },
              { label: 'Bank Accounts',value: String(bankInfo.length) },
              { label: 'Documents',    value: String(documents.length) },
              ...(kyc.current_approver_id ? [{ label: 'Curr. Approver', value: kyc.current_approver_id }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
                <span className="text-xs font-semibold text-gray-800 text-right capitalize truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Document preview drawer ───────────────────────────────────────── */}
      {docPreview && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] lg:w-[45%] flex flex-col bg-white border-l shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{docPreview.name}</p>
                <p className="text-xs text-gray-400">{docPreview.docType}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              <a href={docPreview.url} download={docPreview.name} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                <Download className="h-3 w-3" /> Save
              </a>
              <button
                onClick={() => setDocPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-gray-100">
            {isImageUrl(docPreview.url) ? (
              <div className="h-full flex items-center justify-center p-4">
                <img src={docPreview.url} alt={docPreview.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
              </div>
            ) : isPdfUrl(docPreview.url) ? (
              <iframe src={docPreview.url} title={docPreview.name} className="w-full h-full border-0" allow="fullscreen" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow">
                  <FileText className="h-8 w-8 text-gray-300" />
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Preview unavailable</p>
                  <p className="text-sm text-gray-400 mt-1">Use Open or Save to access this file</p>
                </div>
                <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium">
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
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [showDialog, setShowDialog]   = useState(false);
  const [actionType, setActionType]   = useState<'approve' | 'reject'>('approve');
  const [comments, setComments]       = useState('');
  const [refreshKey, setRefreshKey]   = useState(0);
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    apiGetKycPendingApprovals, '', null, refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setKycList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_KYC_APPROVAL);
    const onUpdated = (d: { kyc_basic_info_sno: number; action: string; approved_by: string }) => {
      if (d.approved_by === userData[0]?.ecno) return;
      setRefreshKey(k => k + 1);
      setToast({ message: `KYC ${d.action === 'approve' ? 'approved' : 'rejected'} — refreshing…`, type: 'success' });
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
      setToast({ message: `KYC ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || 'Action failed', type: 'error' });
    }
  };

  const filteredList = useMemo(
    () => kycList.filter(k =>
      !search || k.company_name.toLowerCase().includes(search.toLowerCase())
    ),
    [kycList, search],
  );

  // ── Sidebar JSX (shared between desktop & mobile sheet) ────────────────────
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Stats header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3 text-xs font-medium flex-shrink-0">
        <span className="text-gray-500">{kycList.length} pending</span>
        <span className="text-amber-600">
          {kycList.filter(k => (k.status ?? 'P').toUpperCase() === 'P').length} awaiting action
        </span>
        {fetchLoading && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="ml-auto text-gray-400 hover:text-indigo-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>
      {/* Search */}
      <div className="px-3 py-2 border-b flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-white"
          />
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <FileText size={24} />
            <span className="text-sm">{search ? 'No matches found' : 'No pending KYC approvals'}</span>
          </div>
        ) : (
          filteredList.map(kyc => (
            <KYCSidebarRow
              key={kyc.kyc_basic_info_sno}
              kyc={kyc}
              isSelected={selectedKYC?.kyc_basic_info_sno === kyc.kyc_basic_info_sno}
              onClick={() => { setSelectedKYC(kyc); setMobileOpen(false); }}
            />
          ))
        )}
      </div>
    </div>
  );

  // ── Error / Loading states ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Failed to load</h3>
          <p className="text-sm text-gray-500">{error}</p>
          <Button onClick={() => setRefreshKey(k => k + 1)} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (fetchLoading && kycList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-600">Loading KYC Approvals…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
        {/* Page header */}
        <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">KYC Approvals</h1>
              <p className="text-xs text-gray-400">Review and approve supplier KYC submissions</p>
            </div>
          </div>
          {/* Mobile list toggle */}
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden gap-1.5 text-xs"
            onClick={() => setMobileOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" />
            KYC List
            {kycList.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                {kycList.length}
              </span>
            )}
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Desktop sidebar */}
          <div className="hidden lg:flex w-80 flex-shrink-0 bg-white border-r flex-col overflow-hidden">
            {sidebarContent}
          </div>

          {/* Mobile sheet */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[85vw] sm:w-80 p-0 flex flex-col">
              {sidebarContent}
            </SheetContent>
          </Sheet>

          {/* Main content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedKYC ? (
              <div className="flex-1 overflow-hidden">
                <KYCDetailPanel kyc={selectedKYC} handleAction={handleAction} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <div className="bg-gray-100 rounded-full p-6">
                  <ShieldCheck size={40} className="opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-gray-500">Select a KYC Submission</p>
                  <p className="text-sm mt-1">Choose from the list on the left to review details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                actionType === 'approve' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {actionType === 'approve'
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <XCircle className="h-4 w-4 text-red-600" />}
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
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Confirming Approval
                </p>
                <p className="text-xs text-green-700 mt-1">
                  This submission will proceed to the next workflow stage.
                </p>
              </div>
            )}

            {selectedKYC && (
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400">Company</span>
                  <span className="font-semibold capitalize">{selectedKYC.company_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400">Contact</span>
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
                actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
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
