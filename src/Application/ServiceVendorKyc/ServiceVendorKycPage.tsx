import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertCircle, Building2, ClipboardList, FilePlus2, IdCard, Landmark, RefreshCw, Send, ShieldCheck, SearchX,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { EmptyState, PageHeader } from '@/CustomComponent/PageComponents';
import { Callout, FilterChips, Panel, SearchInput, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { AGREEMENT_STATUS, formatDate, statusMeta } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useServiceVendorKycFields } from '@/FieldDatas/ServiceVendorKycData';
import { apiGetGSTNDetails, createServiceVendorKyc, getServiceVendorKycs } from '@/Services/Api';
import { unwrapGstRecord, buildGstSubmissionFields, derivePanFromGstin, GSTIN_PATTERN } from '@/Application/Kyc-Screen/gstUtils';
import { buildIfscBankPatch, IFSC_PATTERN } from '@/Application/Kyc-Screen/ifscUtils';
import { getErrorMessage } from '@/lib/errors';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import { cn } from '@/lib/utils';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';

interface FormErrors {
  [key: string]: string;
}

interface KycRow {
  service_vendor_kyc_sno: number;
  service_vendor_code?: string;
  com_sno: number; div_sno: number; brn_sno: number; dept_sno: number;
  company_name: string; contact_person: string; email: string; mobile_number: string;
  business_type: string; pan_no: string; gst_no?: string; msme_no?: string;
  status: 'P' | 'A' | 'R' | 'X';
  current_approver_id?: string | null;
  created_by?: string; created_at?: string;
}

const NAME_FIELD_MAP: Record<string, string> = {
  com_sno: 'com_name', div_sno: 'div_name', brn_sno: 'brn_name', dept_sno: 'dept_name',
};
const resolveNameField = (fieldName: string) => NAME_FIELD_MAP[fieldName] ?? `${fieldName}_name`;

interface FormSectionDef {
  key: string; title: string; description?: string; icon: LucideIcon; fields: string[]; grid: string;
}

const FORM_SECTIONS: FormSectionDef[] = [
  { key: 'org', title: 'Organisation', description: 'Who this vendor is being onboarded for', icon: Building2, fields: ['com_sno', 'div_sno', 'brn_sno', 'dept_sno'], grid: 'sm:grid-cols-2 xl:grid-cols-4' },
  { key: 'basic', title: 'Basic information', icon: IdCard, fields: ['company_name', 'contact_person', 'mobile_number', 'email', 'business_type', 'supplier_cat_code', 'pan_no', 'is_gst_avail', 'gst_no', 'is_msme_avail', 'msme_no'], grid: 'sm:grid-cols-2 lg:grid-cols-3' },
  { key: 'bank', title: 'Bank & payment', description: 'Primary account used to pay this vendor', icon: Landmark, fields: ['ac_holder_name', 'ac_number', 'ac_type', 'ifsc', 'bank_name', 'bank_branch_name', 'bank_address', 'preferred_payment_mode'], grid: 'sm:grid-cols-2 lg:grid-cols-3' },
  { key: 'docs', title: 'Document & remarks', icon: ClipboardList, fields: ['document', 'remarks'], grid: 'sm:grid-cols-2' },
];

const defaultPlaceholder = (f: FieldType) =>
  f.placeholder ?? (f.type === 'select' ? `Select ${f.label.toLowerCase()}` : f.type === 'textarea' ? `Enter ${f.label.toLowerCase()}…` : undefined);

const scrollToFirstError = () => {
  requestAnimationFrame(() => {
    document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};

function buildKycFormData(formData: Record<string, any>): FormData {
  const fd = new FormData();
  Object.entries(formData).forEach(([key, value]) => {
    if (key === 'document' || value === null || value === undefined || value === '') return;
    fd.append(key, String(value));
  });
  if (formData.document instanceof File) fd.append('document', formData.document);
  return fd;
}

const FieldCell: React.FC<{
  field: FieldType; formData: Record<string, any>; errors: Record<string, string>;
  onChange: (field: string, value: any) => void; onBlurValue?: (field: string, value: any) => void;
}> = ({ field, formData, errors, onChange, onBlurValue }) => {
  const isTextarea = field.type === 'textarea';
  const isFile = field.type === 'file';
  return (
    <div data-error={!!errors[field.field]} className={cn('flex flex-col', (isTextarea || isFile) && 'sm:col-span-full', isFile && 'sm:max-w-sm')}>
      <CustomInputField
        field={field.field}
        label={field.label}
        require={field.require}
        type={field.type}
        options={field.options}
        value={formData[field.field] ?? (isFile ? null : '')}
        onChange={(value) => onChange(field.field, value)}
        onBlur={() => onBlurValue?.(field.field, formData[field.field])}
        error={errors[field.field]}
        placeholder={defaultPlaceholder(field)}
        {...(isTextarea ? { rows: 3, className: 'resize-none' } : isFile ? {} : { className: 'h-10' })}
      />
    </div>
  );
};

const ServiceVendorKycPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'ServiceVendorKycPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);

  const [view, setView] = useState<'create' | 'list'>('create');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const fields = useServiceVendorKycFields({ selectedCompany, selectedDivision, selectedBranch });
  const byName = useMemo(() => new Map(fields.map((f) => [f.field, f])), [fields]);
  const inputFields = useMemo(() => fields.filter((f) => f.input), [fields]);

  const [formData, setFormData] = useState<Record<string, any>>({ is_gst_avail: 'false', is_msme_avail: 'false' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { postData: fetchGst } = usePost();

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [fieldName]: value };
      if (fieldName === 'com_sno') {
        updated.div_sno = ''; updated.div_name = ''; updated.brn_sno = ''; updated.brn_name = '';
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedCompany(String(value)); setSelectedDivision(''); setSelectedBranch('');
      } else if (fieldName === 'div_sno') {
        updated.brn_sno = ''; updated.brn_name = ''; updated.dept_sno = ''; updated.dept_name = '';
        setSelectedDivision(String(value)); setSelectedBranch('');
      } else if (fieldName === 'brn_sno') {
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedBranch(String(value));
      }
      const field = fields.find((f) => f.field === fieldName);
      if (field?.options && Array.isArray(field.options)) {
        const opt = (field.options as any[]).find((o) => String(o.value) === String(value));
        if (opt) updated[resolveNameField(fieldName)] = opt.label;
      }
      return updated;
    });
    setErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const e = { ...prev };
      delete e[fieldName];
      return e;
    });
  };

  // GST auto-fetch — populates legal/trade name + PAN, same lookup the goods
  // KYC form uses, minus address patching (this table has no address columns).
  const handleGstBlur = async (fieldName: string, value: any) => {
    if (fieldName !== 'gst_no') return;
    const gst = String(value ?? '').trim().toUpperCase();
    if (!GSTIN_PATTERN.test(gst)) return;
    try {
      const response = await fetchGst(apiGetGSTNDetails, { gst });
      const record = unwrapGstRecord((response as any)?.data);
      if (!record) return;
      const gstFields = buildGstSubmissionFields(record);
      setFormData((prev) => ({ ...prev, ...gstFields, pan_no: prev.pan_no || derivePanFromGstin(gst) }));
    } catch {
      // Lookup failures are non-blocking — the vendor can still enter fields manually.
    }
  };

  // IFSC auto-fetch — same public lookup KycEntry uses.
  const handleIfscBlur = async (fieldName: string, value: any) => {
    if (fieldName !== 'ifsc') return;
    const ifsc = String(value ?? '').trim().toUpperCase();
    if (!IFSC_PATTERN.test(ifsc)) return;
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (!res.ok) return;
      const patch = buildIfscBankPatch(await res.json());
      setFormData((prev) => ({ ...prev, ...patch }));
    } catch {
      // Non-blocking — bank fields can still be entered manually.
    }
  };

  const handleFieldBlur = (fieldName: string, value: any) => {
    handleGstBlur(fieldName, value);
    handleIfscBlur(fieldName, value);
  };

  const sections = useMemo(() => FORM_SECTIONS
    .map((s) => ({ ...s, defs: s.fields.map((n) => byName.get(n)).filter((f): f is FieldType => !!f && !!f.input) }))
    .filter((s) => s.defs.length > 0), [byName]);

  const validateForm = (): boolean => {
    const errs: FormErrors = {};
    inputFields.forEach((f) => {
      if (f.require && !formData[f.field]) errs[f.field] = `${f.label} is required`;
    });
    if (formData.is_gst_avail === 'true' && !formData.gst_no) errs.gst_no = 'GST Number is required';
    if (formData.is_msme_avail === 'true' && !formData.msme_no) errs.msme_no = 'MSME Number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReset = () => {
    setFormData({ is_gst_avail: 'false', is_msme_avail: 'false' });
    setErrors({});
    setSelectedCompany(''); setSelectedDivision(''); setSelectedBranch('');
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { scrollToFirstError(); return; }

    setSubmitting(true);
    try {
      const res = await axios.post(createServiceVendorKyc, buildKycFormData(formData), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res?.data?.data?.[0] ?? res?.data?.data;
      toast.success(`Service Vendor KYC ${data?.service_vendor_kyc_sno ? `#${data.service_vendor_kyc_sno} ` : ''}submitted for approval`);
      handleReset();
      refresh();
      setView('list');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Submission failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Existing KYCs list ──────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'P' | 'A' | 'R' | 'X'>('ALL');
  const [search, setSearch] = useState('');
  const { data: kycsRes, loading: loadingKycs } = useFetch<{ success: boolean; data: KycRow[] }>(getServiceVendorKycs, '', null, refreshKey);
  const kycs = useMemo(() => kycsRes?.data ?? [], [kycsRes]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: kycs.length };
    kycs.forEach((k) => { counts[k.status] = (counts[k.status] ?? 0) + 1; });
    return counts;
  }, [kycs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return kycs.filter((k) => {
      if (statusFilter !== 'ALL' && k.status !== statusFilter) return false;
      if (!q) return true;
      return [k.company_name, k.contact_person, k.pan_no, k.service_vendor_code].some((v) => v?.toLowerCase().includes(q));
    });
  }, [kycs, statusFilter, search]);
  const isFiltering = statusFilter !== 'ALL' || search.trim() !== '';

  const statusChips = [
    { value: 'ALL' as const, label: 'All', count: statusCounts.ALL },
    { value: 'P' as const, label: 'Pending', count: statusCounts.P ?? 0 },
    { value: 'A' as const, label: 'Approved', count: statusCounts.A ?? 0 },
    { value: 'R' as const, label: 'Rejected', count: statusCounts.R ?? 0 },
  ];

  return (
    <div className="min-h-full bg-muted/30">
      <PageHeader
        icon={ShieldCheck}
        title="Service Vendor KYC"
        description="Separate onboarding and approval for service vendors — once approved, they become available for Service Agreements"
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={canSubmit ? view : 'list'} onValueChange={(v) => setView(v as 'create' | 'list')}>
          <TabsList className="h-10 w-full sm:w-fit">
            {canSubmit && (
              <TabsTrigger value="create" className="px-4"><FilePlus2 size={15} /> New KYC</TabsTrigger>
            )}
            <TabsTrigger value="list" className="px-4">
              <ClipboardList size={15} /> All KYCs
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{statusCounts.ALL}</span>
            </TabsTrigger>
          </TabsList>

          {canSubmit && (
            <TabsContent value="create" className="mt-5">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {sections.map((s) => (
                  <Panel key={s.key} icon={s.icon} title={s.title} description={s.description} bodyClassName="space-y-4">
                    <div className={cn('grid grid-cols-1 gap-x-4 gap-y-5', s.grid)}>
                      {s.defs.map((f) => (
                        <FieldCell key={f.field} field={f} formData={formData} errors={errors} onChange={handleFieldChange} onBlurValue={handleFieldBlur} />
                      ))}
                    </div>
                  </Panel>
                ))}

                {Object.keys(errors).length > 0 && (
                  <Callout tone="danger" icon={AlertCircle}>
                    <p className="font-semibold">Please fix {Object.keys(errors).length} field{Object.keys(errors).length !== 1 ? 's' : ''} before submitting</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {Object.values(errors).map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </Callout>
                )}

                <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85">
                  <Button type="button" variant="outline" onClick={handleReset} disabled={submitting}>
                    <RefreshCw className="h-4 w-4" />Reset
                  </Button>
                  <Button type="submit" disabled={submitting} className="min-w-44">
                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit for Approval
                  </Button>
                </div>
              </form>
            </TabsContent>
          )}

          <TabsContent value="list" className="mt-5">
            <Panel
              icon={ClipboardList}
              title="Service vendor KYCs"
              action={<Button variant="outline" size="sm" onClick={refresh} disabled={loadingKycs}><RefreshCw size={14} className={cn(loadingKycs && 'animate-spin')} /> <span className="hidden sm:inline">Refresh</span></Button>}
              bodyClassName="space-y-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterChips options={statusChips} value={statusFilter} onChange={setStatusFilter} />
                <SearchInput value={search} onChange={setSearch} placeholder="Search KYCs" className="w-full md:w-72" />
              </div>

              {loadingKycs ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={isFiltering ? SearchX : ClipboardList}
                  message={isFiltering ? 'No KYCs match your filters' : 'No service vendor KYCs yet'}
                  description={isFiltering ? 'Try a different status or search term.' : 'KYCs you submit will be listed here.'}
                  action={isFiltering ? <Button variant="outline" size="sm" onClick={() => { setStatusFilter('ALL'); setSearch(''); }}>Clear filters</Button> : undefined}
                />
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>PAN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approver</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((k) => {
                        const status = statusMeta(AGREEMENT_STATUS, k.status);
                        return (
                          <TableRow key={k.service_vendor_kyc_sno}>
                            <TableCell>
                              <div className="font-semibold">{k.company_name}</div>
                              {k.service_vendor_code && <div className="text-[11px] text-muted-foreground">{k.service_vendor_code}</div>}
                            </TableCell>
                            <TableCell>{k.contact_person}</TableCell>
                            <TableCell className="tabular-nums">{k.pan_no}</TableCell>
                            <TableCell><StatusPill tone={status.tone}>{status.label}</StatusPill></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{k.current_approver_id ?? '—'}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(k.created_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ServiceVendorKycPage;
