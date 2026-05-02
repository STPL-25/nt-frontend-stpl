import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle, Clock, CheckCircle2, XCircle, FileText, Building2,
  ChevronRight, Mail, Phone, User, Hash, ShieldCheck, Landmark,
  MapPin, CreditCard, Users, Calendar, Eye, Download,
  ExternalLink, GitBranch, History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { EmptyState } from '@/CustomComponent/PageComponents';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  socket,
  SOCKET_JOIN_KYC_APPROVAL,
  SOCKET_LEAVE_KYC_APPROVAL,
  SOCKET_KYC_APPROVAL_UPDATED,
} from '@/Services/Socket';

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
  name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('');

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isPdfUrl   = (url: string) => /\.pdf(\?.*)?$/i.test(url);

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  P: { label: 'Pending',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800' },
  A: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800' },
  R: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800' },
};

function getStatus(s: string | undefined) {
  const key = String(s ?? 'P').toUpperCase();
  return STATUS_MAP[key] ?? { label: key, cls: '' };
}

// ─── KYC List Card ────────────────────────────────────────────────────────────

function KYCListCard({ kyc, isSelected, onClick }: { kyc: KYCApprovalRecord; isSelected: boolean; onClick: () => void }) {
  const { label, cls } = getStatus(kyc.status);
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
              isSelected ? 'bg-blue-600 text-white' : 'bg-primary/10 text-primary'
            }`}>
              {getInitials(kyc.company_name) || '?'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate capitalize">{kyc.company_name}</p>
              {kyc.supp_code && (
                <p className="text-xs text-slate-500 truncate">#{kyc.supp_code}</p>
              )}
            </div>
          </div>
          <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-xs border ${cls}`}>{label}</Badge>
          {kyc.is_gst_avail === 'Y' && (
            <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400">GST</Badge>
          )}
          {kyc.is_msme_avail === 'Y' && (
            <Badge className="text-xs bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/20 dark:text-purple-400">MSME</Badge>
          )}
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 flex items-center gap-1"><User className="h-3 w-3" />Contact</span>
            <span className="font-medium truncate text-right capitalize">{kyc.contact_person}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Submitted</span>
            <span className="font-medium">{formatDate(kyc.created_date)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Approval history ─────────────────────────────────────────────────────────

function KYCHistorySection({ history }: { history: any[] }) {
  if (!history.length) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <History className="h-4 w-4 sm:h-5 sm:w-5" />
          Approval History
          <Badge variant="secondary" className="ml-1 text-xs">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="space-y-2">
          {history.map((entry: any, idx: number) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{entry.ename ?? '—'}</p>
                  <span className="text-xs text-slate-400">{entry.status_by}</span>
                </div>
                {entry.status_date && (
                  <p className="text-xs text-slate-500">{formatDate(entry.status_date)}</p>
                )}
                {entry.commends && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">"{entry.commends}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Approval stages ──────────────────────────────────────────────────────────

function KYCApprovalStages({ stages, currentApproverId }: { stages: any[]; currentApproverId?: string }) {
  if (!stages.length) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
          Approval Workflow
          <Badge variant="secondary" className="ml-1 text-xs">{stages.length} stage{stages.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="space-y-2">
          {stages.map((stage: any, idx: number) => {
            const isCurrent = stage.approver_ecno === currentApproverId;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  isCurrent
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                  isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{stage.stage ?? `Stage ${idx + 1}`}</p>
                    {isCurrent && (
                      <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Approver: <span className="font-medium text-slate-700 dark:text-slate-300">{stage.approver_ecno}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KYC Detail Panel ─────────────────────────────────────────────────────────

function KYCDetailPanel({
  kyc, handleAction,
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
  const { label: statusLabel, cls: statusCls } = getStatus(kyc.status);

  const basicFields = [
    { label: 'Company Name',   value: kyc.company_name,   icon: Building2 },
    { label: 'Business Type',  value: kyc.business_type,  icon: FileText },
    { label: 'Contact Person', value: kyc.contact_person, icon: User },
    { label: 'Email',          value: kyc.email,          icon: Mail },
    { label: 'Mobile',         value: kyc.mobile_number,  icon: Phone },
    { label: 'PAN Number',     value: kyc.pan_no,         icon: Hash },
    { label: 'GST Number',     value: kyc.gst_no || '—',  icon: ShieldCheck },
    { label: 'MSME Number',    value: kyc.msme_no || '—', icon: Landmark },
    { label: 'Submitted On',   value: formatDate(kyc.created_date), icon: Calendar },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">KYC Verification</h1>
        <Badge variant="outline" className={`text-xs sm:text-sm border ${statusCls}`}>
          <Clock className="h-3 w-3 mr-1" />{statusLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                  {getInitials(kyc.company_name) || '?'}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg sm:text-xl capitalize">{kyc.company_name}</CardTitle>
                  {kyc.supp_code && (
                    <p className="text-xs text-slate-500 mt-0.5">Supplier Code: {kyc.supp_code}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className={`text-xs border ${statusCls}`}>{statusLabel}</Badge>
                    {kyc.is_gst_avail === 'Y' && (
                      <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200">GST</Badge>
                    )}
                    {kyc.is_msme_avail === 'Y' && (
                      <Badge className="text-xs bg-purple-50 text-purple-700 border border-purple-200">MSME</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="basic">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 border border-border p-1 rounded-xl mb-5">
                  <TabsTrigger value="basic" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <User className="h-3.5 w-3.5" /> Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="address" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <MapPin className="h-3.5 w-3.5" /> Address
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted">{addresses.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <CreditCard className="h-3.5 w-3.5" /> Bank
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted">{bankInfo.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <Users className="h-3.5 w-3.5" /> Contacts
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted">{contacts.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <FileText className="h-3.5 w-3.5" /> Docs
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted">{documents.length}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {basicFields.map(({ label, value, icon: Icon }) => (
                      <div key={label} className="relative bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/70 rounded-l-xl" />
                        <div className="pl-4 pr-3 py-3 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5 capitalize">{value || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="address">
                  {addresses.length === 0 ? (
                    <EmptyState icon={MapPin} message="No addresses found" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {addresses.map((addr: any, idx: number) => (
                        <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm ${addr.isPrimary ? 'border-amber-200 dark:border-amber-800' : 'border-border'}`}>
                          <div className={`px-4 py-2.5 flex items-center justify-between ${addr.isPrimary ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/40'}`}>
                            <div className="flex items-center gap-2">
                              <MapPin className={`h-3.5 w-3.5 ${addr.isPrimary ? 'text-amber-600' : 'text-muted-foreground'}`} />
                              <span className="text-xs font-semibold">{addr.isPrimary ? 'Primary Address' : `Address ${idx + 1}`}</span>
                            </div>
                            {addr.isPrimary && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300">Primary</Badge>
                            )}
                          </div>
                          <div className="p-4 space-y-2 bg-card">
                            <div className="space-y-1">
                              {(addr.door_no || addr.street) && (
                                <p className="text-sm font-medium text-foreground">
                                  {[addr.door_no, addr.street].filter(Boolean).join(', ')}
                                </p>
                              )}
                              {addr.area && <p className="text-sm text-muted-foreground">{addr.area}</p>}
                              <p className="text-sm text-muted-foreground">
                                {[addr.city, addr.state].filter(Boolean).join(', ')}
                                {addr.pincode && ` – ${addr.pincode}`}
                              </p>
                            </div>
                            {addr.location_link && (
                              <a href={addr.location_link} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium text-primary hover:underline">
                                <MapPin className="h-3 w-3" /> View on Map
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="bank">
                  {bankInfo.length === 0 ? (
                    <EmptyState icon={CreditCard} message="No bank accounts found" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bankInfo.map((bank: any, idx: number) => (
                        <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm ${bank.isPrimary ? 'border-emerald-200 dark:border-emerald-800' : 'border-border'}`}>
                          <div className={`px-4 py-3 flex items-center justify-between ${bank.isPrimary ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-muted/40'}`}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                                {(bank.bank_name || 'B')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold leading-tight">{bank.bank_name || '—'}</p>
                                <p className="text-xs text-muted-foreground">{bank.bank_branch_name || '—'}</p>
                              </div>
                            </div>
                            {bank.isPrimary && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300">Primary</Badge>
                            )}
                          </div>
                          <div className="p-4 space-y-3 bg-card">
                            <div className="bg-muted/50 rounded-lg px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account Number</p>
                              <p className="font-mono text-base font-bold tracking-widest mt-0.5">{bank.ac_number || '—'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Holder</p>
                                <p className="font-medium capitalize mt-0.5">{bank.ac_holder_name || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account Type</p>
                                <p className="font-medium capitalize mt-0.5">{bank.ac_type || '—'}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">IFSC Code</p>
                                <p className="font-mono font-semibold mt-0.5">{bank.ifsc || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="contacts">
                  {contacts.length === 0 ? (
                    <EmptyState icon={Users} message="No contacts found" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {contacts.map((contact: any, idx: number) => (
                        <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm ${contact.isPrimary ? 'border-blue-200 dark:border-blue-800' : 'border-border'}`}>
                          <div className={`px-4 py-3 flex items-center justify-between ${contact.isPrimary ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-muted/40'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                                {(contact.contact_name || contact.ownername || '?')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold capitalize leading-tight">{contact.contact_name || contact.ownername || '—'}</p>
                                <p className="text-xs text-muted-foreground capitalize">{contact.contact_position || contact.ownerposition || '—'}</p>
                              </div>
                            </div>
                            {contact.isPrimary && (
                              <Badge className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300">Primary</Badge>
                            )}
                          </div>
                          <div className="px-4 py-3 space-y-2 bg-card">
                            <a href={`tel:${contact.contact_mobile || contact.ownermobile}`} className="flex items-center gap-2.5 text-sm group">
                              <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                                <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              </div>
                              <span className="text-foreground group-hover:text-primary transition-colors">{contact.contact_mobile || contact.ownermobile || '—'}</span>
                            </a>
                            <a href={`mailto:${contact.contact_email || contact.owneremail}`} className="flex items-center gap-2.5 text-sm group">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                                <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-foreground group-hover:text-primary transition-colors truncate">{contact.contact_email || contact.owneremail || '—'}</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents">
                  {documents.length === 0 ? (
                    <EmptyState icon={FileText} message="No documents uploaded" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {documents.map((doc: any, idx: number) => {
                        const docUrl  = doc.document_path || doc.url || '';
                        const docName = doc.document_name || doc.filename || `Document ${idx + 1}`;
                        const docType = doc.document_type || doc.documentType || 'File';
                        const authUrl = getAuthFileUrl(docUrl);
                        const isImg   = isImageUrl(authUrl);
                        const isPdf   = isPdfUrl(authUrl);
                        return (
                          <div key={idx} className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
                            <div className={`px-4 py-3 flex items-center gap-3 border-b ${isImg ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900' : isPdf ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900' : 'bg-muted/40 border-border'}`}>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isImg ? 'bg-violet-100 dark:bg-violet-900/40' : isPdf ? 'bg-red-100 dark:bg-red-900/40' : 'bg-muted'}`}>
                                <FileText className={`h-5 w-5 ${isImg ? 'text-violet-600' : isPdf ? 'text-red-600' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{docName}</p>
                                <Badge className={`text-[10px] mt-0.5 border ${isImg ? 'bg-violet-100 text-violet-700 border-violet-200' : isPdf ? 'bg-red-100 text-red-700 border-red-200' : 'bg-muted text-muted-foreground border-border'}`}>{docType}</Badge>
                              </div>
                            </div>
                            {docUrl && (
                              <div className="px-4 py-3 flex items-center gap-2">
                                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5"
                                  onClick={() => setDocPreview({ url: authUrl, name: docName, docType })}>
                                  <Eye className="h-3 w-3" /> Preview
                                </Button>
                                <a href={authUrl} download={docName} target="_blank" rel="noopener noreferrer"
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">
                                  <Download className="h-3 w-3" /> Download
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <KYCApprovalStages stages={stages} currentApproverId={kyc.current_approver_id} />
          <KYCHistorySection history={history} />
        </div>

        <div className="xl:col-span-1">
          <Card className="shadow-sm xl:sticky xl:top-6">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base sm:text-lg">Approval Actions</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Review and take action on this KYC submission
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
              {canEdit('KYCApprovalScreen') ? (
                <div className="space-y-2.5">
                  <Button
                    onClick={() => handleAction('approve')}
                    className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm"
                    size="lg"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve KYC
                  </Button>
                  <Button
                    onClick={() => handleAction('reject')}
                    variant="outline"
                    className="w-full h-11 text-sm font-semibold border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                    size="lg"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject KYC
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  View only — no approval permission
                </p>
              )}

              <Separator />

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status</span>
                  <Badge variant="outline" className={`text-xs border ${statusCls}`}>{statusLabel}</Badge>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Business Type</span>
                  <span className="font-semibold truncate text-right capitalize">{kyc.business_type || '—'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">GST</span>
                  <span className="font-semibold">{kyc.is_gst_avail === 'Y' ? kyc.gst_no || 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">MSME</span>
                  <span className="font-semibold">{kyc.is_msme_avail === 'Y' ? kyc.msme_no || 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Addresses</span>
                  <span className="font-semibold">{addresses.length}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Bank Accounts</span>
                  <span className="font-semibold">{bankInfo.length}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Documents</span>
                  <span className="font-semibold">{documents.length}</span>
                </div>
                {kyc.current_approver_id && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 shrink-0">Current Approver</span>
                      <span className="font-semibold truncate text-right">{kyc.current_approver_id}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Doc preview panel */}
      {docPreview && (
        <div className="fixed inset-y-0 right-0 z-50 w-full lg:w-[45%] xl:w-[40%] flex flex-col bg-card border-l border-border shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{docPreview.name}</p>
                <p className="text-xs text-muted-foreground">{docPreview.docType}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              <a href={docPreview.url} download={docPreview.name} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <Download className="h-3 w-3" /> Save
              </a>
              <button
                onClick={() => setDocPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-muted/30">
            {isImageUrl(docPreview.url) ? (
              <div className="h-full flex items-center justify-center p-4">
                <img src={docPreview.url} alt={docPreview.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
              </div>
            ) : isPdfUrl(docPreview.url) ? (
              <iframe src={docPreview.url} title={docPreview.name} className="w-full h-full border-0" allow="fullscreen" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 text-center">
                <FileText className="h-16 w-16 text-muted-foreground/30" />
                <div>
                  <p className="font-medium text-foreground">Preview not available</p>
                  <p className="text-sm text-muted-foreground mt-1">Use the Open or Save button above</p>
                </div>
                <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors">
                  <ExternalLink className="h-4 w-4" /> Open in new tab
                </a>
              </div>
            )}
          </div>
        </div>
      )}
      {docPreview && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setDocPreview(null)} />
      )}
    </div>
  );
}

// ─── Root screen ──────────────────────────────────────────────────────────────

const KYCApprovalScreen: React.FC = () => {
  const [selectedKYC, setSelectedKYC]  = useState<KYCApprovalRecord | null>(null);
  const [kycList, setKycList]          = useState<KYCApprovalRecord[]>([]);
  const [showDialog, setShowDialog]    = useState(false);
  const [actionType, setActionType]    = useState<'approve' | 'reject'>('approve');
  const [comments, setComments]        = useState('');
  const [refreshKey, setRefreshKey]    = useState(0);
  const [toast, setToast]              = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    apiGetKycPendingApprovals,
    '',
    '',
    refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setKycList(data.data ?? []);
  }, [data, fetchLoading]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Socket: join kyc:approval room and refresh on remote changes
  useEffect(() => {
    socket.emit(SOCKET_JOIN_KYC_APPROVAL);

    const onApprovalUpdated = (data: { kyc_basic_info_sno: number; action: string; approved_by: string }) => {
      if (data.approved_by === userData[0]?.ecno) return; // own action — already updated locally
      setRefreshKey(k => k + 1);
      setToast({ message: `KYC ${data.action === 'approve' ? 'approved' : 'rejected'} — refreshing list…`, type: 'success' });
    };

    socket.on(SOCKET_KYC_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_KYC_APPROVAL);
      socket.off(SOCKET_KYC_APPROVAL_UPDATED, onApprovalUpdated);
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
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">Error Loading Data</h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (fetchLoading && kycList.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Clock className="h-16 w-16 text-slate-300 dark:text-slate-700 mx-auto animate-spin" />
          <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">Loading KYC Approvals…</h3>
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle="KYC Approvals"
        sidebarCount={kycList.length}
        toast={toast}
        listItems={(closeSheet) =>
          kycList.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No pending KYC approvals</p>
          ) : (
            kycList.map((k) => (
              <KYCListCard
                key={k.kyc_basic_info_sno}
                kyc={k}
                isSelected={selectedKYC?.kyc_basic_info_sno === k.kyc_basic_info_sno}
                onClick={() => { setSelectedKYC(k); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedKYC}
        detailContent={
          selectedKYC
            ? <KYCDetailPanel kyc={selectedKYC} handleAction={handleAction} />
            : null
        }
        emptyContent={
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center space-y-3">
              <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 dark:text-slate-700 mx-auto" />
              <h3 className="text-lg sm:text-xl font-semibold text-slate-600 dark:text-slate-400">No KYC Selected</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
                Select a KYC submission from the list to review and take action
              </p>
            </div>
          </div>
        }
        mobileListLabel="KYC List"
        mobileSelectionTitle={selectedKYC?.company_name}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {actionType === 'approve'
                ? <><CheckCircle2 className="h-5 w-5 text-green-600" /> Approve KYC</>
                : <><XCircle className="h-5 w-5 text-red-600" /> Reject KYC</>}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {actionType === 'approve'
                ? 'Optionally add a comment before approving.'
                : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {actionType === 'approve' && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-100">Confirming Approval</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  This KYC submission will proceed to the next stage.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="kyc-comments" className="text-xs sm:text-sm">
                Comments {actionType === 'reject' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="kyc-comments"
                placeholder={actionType === 'approve' ? 'Any additional notes…' : 'Reason for rejection…'}
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {selectedKYC && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Company</span>
                  <span className="font-semibold capitalize truncate ml-2">{selectedKYC.company_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Contact</span>
                  <span className="font-semibold truncate ml-2">{selectedKYC.contact_person}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline" onClick={() => setShowDialog(false)}
              disabled={loading} className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (actionType === 'reject' && !comments.trim())}
              className={`w-full sm:w-auto text-sm ${actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {loading ? (
                <><Clock className="mr-2 h-4 w-4 animate-spin" />Processing…</>
              ) : actionType === 'approve' ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm Approval</>
              ) : (
                <><XCircle className="mr-2 h-4 w-4" />Confirm Rejection</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KYCApprovalScreen;
