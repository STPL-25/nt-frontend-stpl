import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText, Building2, RefreshCw, Send, Repeat, Wallet, CalendarClock, Bell, ClipboardList,
  Pencil, Loader2, Briefcase, ScrollText, Check, FilePlus2, AlertCircle, SearchX, Layers,
  Landmark, History, RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, PageHeader } from '@/CustomComponent/PageComponents';
import {
  Callout, FilterChips, Panel, SearchInput, StatusPill, SupplierSummary, TypeBadge,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, buildStatutoryPayload, buildSupplierPayload, dateOnly, emptyStatutory, emptySupplierRow,
  entersAmountPerCycle, facilityLabel, formatDate, formatINR, ordinalDay, statusMeta, statutoryFromRow, suggestRenewalTerm,
  validateStatutory, validateSuppliers,
  type StatutoryForm, type SupplierRowValue, type SupplierShare,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import { SupplierSplitEditor } from '@/CustomComponent/ServiceComponents/SupplierSplitEditor';
import { StatutoryFieldsPanel } from '@/CustomComponent/ServiceComponents/StatutoryFieldsPanel';
import { AgreementHistoryDialog } from '@/CustomComponent/ServiceComponents/AgreementHistoryDialog';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useServiceAgreementFields, type AgreementType } from '@/FieldDatas/ServiceAgreementData';
import axios from 'axios';
import { createServiceAgreement, updateServiceAgreement, getServiceAgreements } from '@/Services/Api';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import { cn } from '@/lib/utils';
import useFetch from '@/hooks/useFetchHook';

interface FormErrors {
  [key: string]: string;
}

interface AgreementRow {
  agreement_sno: number;
  agreement_no: string;
  com_sno: number; div_sno: number; brn_sno: number; dept_sno: number;
  service_sno: number; service_name: string; service_type_code: AgreementType;
  vendor_sno?: number; vendor_name?: string;
  vendors?: SupplierShare[]; supplier_count?: number;
  qty?: number;
  rate_amount?: number; rate_uom_sno?: number; rate_uom_name?: string;
  recurrence_cadence_sno?: number; cadence_name?: string;
  po_generation_day?: number; notify_days_before?: number;
  period_start_date: string; period_end_date: string;
  agreement_doc_url: string; remarks?: string; terms_conditions?: string;
  facility_type?: string; facility_ref_no?: string; sanctioned_amount?: number; drawing_power?: number;
  rate_type?: string; benchmark_rate_pct?: number; spread_pct?: number; interest_rate_pct?: number;
  benchmark_name?: string; disbursed_amount?: number; disbursement_date?: string;
  interest_payment_day?: number; day_count_basis?: number;
  version_no?: number; renewal_count?: number;
  status: 'P' | 'A' | 'R' | 'X';
  dispatch_type?: 'S' | 'I'; incharge_ecno?: string;
  created_by?: string; created_at?: string;
}

const NAME_FIELD_MAP: Record<string, string> = {
  com_sno: 'com_name',
  div_sno: 'div_name',
  brn_sno: 'brn_name',
  dept_sno: 'dept_name',
  service_sno: 'service_name',
  vendor_sno: 'vendor_name',
  rate_uom_sno: 'rate_uom_name',
  recurrence_cadence_sno: 'cadence_name',
};

function resolveNameField(fieldName: string): string {
  return NAME_FIELD_MAP[fieldName] ?? fieldName.replace('_sno', '_name');
}

const AGREEMENT_TYPES: { value: AgreementType; label: string; description: string; Icon: React.ElementType }[] = [
  { value: 'FIXED_RECURRING', label: 'Fixed', description: 'Same amount every cycle, auto-generated on a schedule', Icon: Repeat },
  { value: 'VARIABLE_RECURRING', label: 'Unfixed', description: 'Amount varies by billing cycle — entered per cycle in Service PO', Icon: Wallet },
  { value: 'STATUTORY', label: 'Statutory', description: 'Loans, repo and cash credit — no POs; interest is worked out on the outstanding principal and paid by Bank Payment Voucher', Icon: Landmark },
];

// A loan is priced by its own facility terms and billed through Bank Payment Vouchers, so the
// per-cycle pricing / PO-cadence fields don't apply. The server fills them in (see
// ServiceAgreement.controller's withLoanDefaults); the form just doesn't ask.
const LOAN_HIDDEN_FIELDS = new Set(['qty', 'rate_amount', 'rate_uom_sno', 'recurrence_cadence_sno', 'po_generation_day', 'notify_days_before']);

type ListTab = 'fixed' | 'variable' | 'statutory';
const TAB_FOR_TYPE: Record<AgreementType, ListTab> = { FIXED_RECURRING: 'fixed', VARIABLE_RECURRING: 'variable', STATUTORY: 'statutory' };

// The form's fields are grouped into sections purely by field name, so a field
// added to useServiceAgreementFields but not listed here still renders (in a
// trailing "More details" section) instead of silently disappearing. Suppliers
// and the Statutory facility block are not plain fields — they are rendered by
// dedicated editors, slotted in after the section named in `slots`.
interface FormSectionDef {
  key: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  fields: string[];
  grid: string;
  compactGrid: string;
}

const FORM_SECTIONS: FormSectionDef[] = [
  {
    key: 'org', title: 'Organisation', description: 'Who this agreement is raised for', icon: Building2,
    fields: ['com_sno', 'div_sno', 'brn_sno', 'dept_sno'],
    grid: 'sm:grid-cols-2 xl:grid-cols-4', compactGrid: 'sm:grid-cols-2',
  },
  {
    key: 'service', title: 'Service', icon: Briefcase,
    fields: ['service_sno'],
    grid: 'sm:grid-cols-2', compactGrid: 'sm:grid-cols-2',
  },
  {
    key: 'pricing', title: 'Pricing', icon: Wallet,
    fields: ['qty', 'rate_amount', 'rate_uom_sno'],
    grid: 'sm:grid-cols-3', compactGrid: 'sm:grid-cols-2',
  },
  {
    key: 'schedule', title: 'Schedule', description: 'Term and PO cadence', icon: CalendarClock,
    fields: ['recurrence_cadence_sno', 'po_generation_day', 'notify_days_before', 'period_start_date', 'period_end_date'],
    grid: 'sm:grid-cols-2 lg:grid-cols-3', compactGrid: 'sm:grid-cols-2',
  },
  {
    key: 'docs', title: 'Document & terms', icon: ScrollText,
    fields: ['agreement_document', 'remarks', 'terms_conditions'],
    grid: 'sm:grid-cols-2', compactGrid: 'sm:grid-cols-2',
  },
];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** What the supplier shares must add up to: the amount per cycle (rate × quantity). */
const totalPerCycle = (formData: Record<string, any>) => round2((Number(formData.qty) || 0) * (Number(formData.rate_amount) || 0));

const defaultPlaceholder = (f: FieldType) =>
  f.placeholder
  ?? (f.type === 'select' || f.type === 'search-select' ? `Select ${f.label.toLowerCase()}`
    : f.type === 'textarea' ? `Enter ${f.label.toLowerCase()}…` : undefined);

const scrollToFirstError = () => {
  requestAnimationFrame(() => {
    document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};

/** One validation pass shared by the create form and the edit/renew dialog. */
function validateAgreementForm(args: {
  inputFields: FieldType[]; formData: Record<string, any>; agreementType: AgreementType; renewAfter?: string;
}): FormErrors {
  const { inputFields, formData, agreementType, renewAfter } = args;
  const isLoan = agreementType === 'STATUTORY';
  const errs: FormErrors = {};
  inputFields.forEach((f) => {
    if (isLoan && LOAN_HIDDEN_FIELDS.has(f.field)) return;
    if (f.require && !formData[f.field]) errs[f.field] = `${f.label} is required`;
  });
  if (!isLoan) {
    if (formData.qty && Number(formData.qty) <= 0) errs.qty = 'Quantity must be greater than 0';
    if (formData.rate_amount && Number(formData.rate_amount) <= 0) errs.rate_amount = 'Rate must be greater than 0';
  }

  const start = formData.period_start_date, end = formData.period_end_date;
  if (start && end && end <= start) errs.period_end_date = 'Duration To must be after Duration From';
  if (renewAfter && start && start <= renewAfter) errs.period_start_date = `A renewal must start after the previous term ended (${formatDate(renewAfter)})`;

  if (isLoan) {
    if (!formData.vendor_sno) errs.vendor_sno = 'Select the lender';
    Object.assign(errs, validateStatutory(formData.statutory ?? emptyStatutory(), { start, end }));
  } else {
    const supplierError = validateSuppliers(formData.vendors ?? [], totalPerCycle(formData));
    if (supplierError) errs.vendors = supplierError;
  }
  return errs;
}

/** Multipart body for create / edit / renew. Suppliers and the facility block go as JSON strings. */
function buildAgreementFormData(formData: Record<string, any>, agreementType: AgreementType, extra?: Record<string, string>): FormData {
  const fd = new FormData();
  const isLoan = agreementType === 'STATUTORY';
  const skip = new Set(['agreement_document', 'vendors', 'statutory', 'vendor_sno', 'vendor_name']);
  Object.entries(formData).forEach(([key, value]) => {
    if (skip.has(key) || value === null || value === undefined || value === '') return;
    if (isLoan && LOAN_HIDDEN_FIELDS.has(key)) return;
    fd.append(key, String(value));
  });
  Object.entries(extra ?? {}).forEach(([k, v]) => fd.append(k, v));
  if (isLoan) {
    // One lender; the server derives the rest (amount, monthly cadence, payment day).
    fd.append('vendor_sno', String(formData.vendor_sno));
    fd.append('statutory', JSON.stringify(buildStatutoryPayload(formData.statutory ?? emptyStatutory())));
  } else {
    fd.append('vendors', JSON.stringify(buildSupplierPayload(formData.vendors ?? [], totalPerCycle(formData))));
  }
  if (formData.agreement_document instanceof File) fd.append('agreement_document', formData.agreement_document);
  return fd;
}

const FieldCell: React.FC<{
  field: FieldType;
  formData: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}> = ({ field, formData, errors, onChange }) => {
  const isTextarea = field.type === 'textarea';
  const isFile = field.type === 'file';
  return (
    <div
      data-error={!!errors[field.field]}
      className={cn('flex flex-col', (isTextarea || isFile) && 'sm:col-span-full', isFile && 'sm:max-w-sm')}
    >
      <CustomInputField
        field={field.field}
        label={field.label}
        require={field.require}
        type={field.type}
        options={field.options}
        value={formData[field.field] ?? (isFile ? null : '')}
        onChange={(value) => onChange(field.field, value)}
        error={errors[field.field]}
        placeholder={defaultPlaceholder(field)}
        {...(isTextarea ? { rows: 3, className: 'resize-none' } : isFile ? {} : { className: 'h-10' })}
      />
    </div>
  );
};

// Shared by the create form and the edit dialog so the two can't drift apart.
const AgreementFormSections: React.FC<{
  fields: FieldType[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
  agreementType: AgreementType;
  compact?: boolean;
}> = ({ fields, formData, errors, onChange, agreementType, compact }) => {
  const byName = useMemo(() => new Map(fields.map((f) => [f.field, f])), [fields]);
  const isLoan = agreementType === 'STATUTORY';
  const perCycleEntry = entersAmountPerCycle(agreementType);
  const sections = useMemo(() => {
    const placed = new Set(FORM_SECTIONS.flatMap((s) => s.fields));
    const leftovers = fields.filter((f) => !placed.has(f.field)).map((f) => f.field);
    const more: FormSectionDef = {
      key: 'more', title: 'More details', icon: Layers, fields: leftovers, grid: 'sm:grid-cols-2', compactGrid: 'sm:grid-cols-2',
    };
    const all: FormSectionDef[] = (leftovers.length ? [...FORM_SECTIONS, more] : FORM_SECTIONS)
      // A loan's tenure is just its start and end — the pricing / PO-cadence fields don't apply.
      .map((s) => (isLoan && s.key === 'schedule'
        ? { ...s, title: 'Loan term', description: 'Tenure of the facility — interest is billed monthly on the payment day set under Loan details' }
        : s));
    return all
      .map((s) => ({
        ...s,
        defs: s.fields
          .filter((n) => !(isLoan && LOAN_HIDDEN_FIELDS.has(n)))
          .map((n) => byName.get(n))
          .filter((f): f is FieldType => !!f),
      }))
      .filter((s) => s.defs.length > 0);
  }, [fields, byName, isLoan]);

  // Dedicated editors, each placed right after the section it belongs with.
  const slots: Record<string, React.ReactNode> = {
    service: isLoan ? (
      <StatutoryFieldsPanel
        value={(formData.statutory as StatutoryForm) ?? emptyStatutory()}
        onChange={(v) => onChange('statutory', v)}
        errors={errors}
        lender={formData.vendor_sno ? String(formData.vendor_sno) : ''}
        onLenderChange={(v) => onChange('vendor_sno', v)}
        lenderError={errors.vendor_sno}
      />
    ) : null,
    pricing: isLoan ? null : (
      <SupplierSplitEditor
        rows={(formData.vendors as SupplierRowValue[]) ?? [emptySupplierRow()]}
        onChange={(rows) => onChange('vendors', rows)}
        total={totalPerCycle(formData)}
        error={errors.vendors}
      />
    ),
  };

  return (
    <>
      {sections.map((s) => (
        <React.Fragment key={s.key}>
          <Panel icon={s.icon} title={s.title} description={s.description} bodyClassName="space-y-4">
            <div className={cn('grid grid-cols-1 gap-x-4 gap-y-5', compact ? s.compactGrid : s.grid)}>
              {s.defs.map((f) => (
                <FieldCell key={f.field} field={f} formData={formData} errors={errors} onChange={onChange} />
              ))}
            </div>

            {s.key === 'schedule' && !isLoan && (
              <Callout tone="primary" icon={Bell}>
                <b>PO Generation Day</b> is required for monthly, bi-monthly, quarterly and annual cadences (e.g. 5 = generate on the 5th of every eligible month).
                {' '}<b>Notify Before</b> sends an in-app reminder that many days before each auto-generation.
              </Callout>
            )}
            {s.key === 'pricing' && perCycleEntry && (
              <Callout tone="violet" icon={Wallet}>
                The rate and quantity entered here are the agreed baseline — the actual amount for each billing cycle is entered separately in Service PO.
              </Callout>
            )}
          </Panel>
          {slots[s.key]}
        </React.Fragment>
      ))}
    </>
  );
};

// ── Edit / renew dialog — reuses the exact field set the create form uses
// (useServiceAgreementFields), pre-filled from the selected row, submitting
// to updateServiceAgreement (re-enters approval). For an Expired agreement it
// is a renewal: same agreement number, a new version, a new term.
const EditAgreementDialog: React.FC<{
  row: AgreementRow; mode: 'edit' | 'renew'; onClose: () => void; onSaved: () => void;
}> = ({ row, mode, onClose, onSaved }) => {
  const renewing = mode === 'renew';
  const agreementType = row.service_type_code;
  const [selectedCompany, setSelectedCompany] = useState(String(row.com_sno));
  const [selectedDivision, setSelectedDivision] = useState(String(row.div_sno));
  const [selectedBranch, setSelectedBranch] = useState(String(row.brn_sno));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const baseFields = useServiceAgreementFields({ agreementType, selectedCompany, selectedDivision, selectedBranch });
  // Editing never forces a fresh document upload — the existing
  // agreement_doc_url carries forward unless the user picks a new file.
  const fields = useMemo(
    () => baseFields.map((f) => (f.field === 'agreement_document'
      ? { ...f, require: false, label: renewing ? 'Renewed Agreement Document (recommended)' : 'Replace Agreement Document (optional)' }
      : f)),
    [baseFields, renewing]
  );

  const prevStart = dateOnly(row.period_start_date);
  const prevEnd = dateOnly(row.period_end_date);

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const term = renewing ? suggestRenewalTerm(prevStart, prevEnd) : { start: prevStart, end: prevEnd };
    const vendors: SupplierRowValue[] = row.vendors?.length
      ? row.vendors.map((v) => ({ vendor_sno: String(v.vendor_sno), share_amount: String(v.share_amount) }))
      : [{ vendor_sno: row.vendor_sno ? String(row.vendor_sno) : '', share_amount: '' }];
    return {
      com_sno: row.com_sno, div_sno: row.div_sno, brn_sno: row.brn_sno, dept_sno: row.dept_sno,
      service_sno: row.service_sno, service_name: row.service_name,
      vendors,
      vendor_sno: row.vendor_sno ? String(row.vendor_sno) : '',   // a loan has one lender
      statutory: statutoryFromRow(row),
      qty: row.qty ?? 1,
      rate_amount: row.rate_amount ?? '', rate_uom_sno: row.rate_uom_sno ?? '', rate_uom_name: row.rate_uom_name ?? '',
      recurrence_cadence_sno: row.recurrence_cadence_sno ?? '',
      po_generation_day: row.po_generation_day ?? '', notify_days_before: row.notify_days_before ?? 0,
      period_start_date: term.start, period_end_date: term.end,
      agreement_document: null, agreement_doc_url: row.agreement_doc_url,
      remarks: row.remarks ?? '', terms_conditions: row.terms_conditions ?? '',
    };
  });

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
      if (!prev[fieldName] && !(fieldName === 'statutory' && Object.keys(prev).some((k) => k.startsWith('stat_')))) return prev;
      const e = { ...prev };
      delete e[fieldName];
      if (fieldName === 'statutory') Object.keys(e).forEach((k) => { if (k.startsWith('stat_')) delete e[k]; });
      return e;
    });
  };

  const inputFields = useMemo(() => fields.filter((f) => f.input), [fields]);

  const validate = (): boolean => {
    const errs = validateAgreementForm({ inputFields, formData, agreementType, renewAfter: renewing ? prevEnd : undefined });
    setErrors(errs);
    if (Object.keys(errs).length > 0) scrollToFirstError();
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = buildAgreementFormData(formData, agreementType, { agreement_sno: String(row.agreement_sno) });
      await axios.post(updateServiceAgreement, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(renewing
        ? `${row.agreement_no} renewed and submitted for approval`
        : `${row.agreement_no} updated and resubmitted for approval`);
      onSaved();
    } catch (error: any) {
      toast.error(error?.response?.data?.error ?? (renewing ? 'Failed to renew agreement' : 'Failed to update agreement'));
    } finally {
      setSubmitting(false);
    }
  };

  const nextVersion = (row.version_no ?? 1) + 1;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {renewing ? 'Renew' : 'Edit'} {row.agreement_no} <TypeBadge type={agreementType} />
          </DialogTitle>
          <DialogDescription>
            {renewing
              ? `Renewing creates version ${nextVersion} of this agreement for a new term. It goes through approval again; the expired terms stay available under History.`
              : `Saving resubmits this agreement for approval as version ${nextVersion} — the current Approved values stay in effect until it's approved again, and the earlier version is kept under History.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          {renewing && (
            <Callout tone="violet" icon={RotateCcw}>
              Previous term: <b>{formatDate(row.period_start_date)} – {formatDate(row.period_end_date)}</b>
              {agreementType === 'STATUTORY'
                ? (row.sanctioned_amount != null && <> on a sanctioned <b>{formatINR(row.sanctioned_amount)}</b></>)
                : (row.rate_amount != null && <> at <b>{formatINR(row.rate_amount)}</b></>)}. The new term must start after it ended —
              review the dates, {agreementType === 'STATUTORY' ? 'interest rate and lender' : 'rate and suppliers'} below, which are pre-filled from the last version.
            </Callout>
          )}
          <AgreementFormSections
            compact
            fields={inputFields}
            formData={formData}
            errors={errors}
            onChange={handleFieldChange}
            agreementType={agreementType}
          />
        </div>

        <DialogFooter className="border-t bg-card px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : renewing ? <><RotateCcw size={15} /> Renew & Submit</> : <><Send size={15} /> Save & Resubmit</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type StatusFilter = 'ALL' | 'P' | 'A' | 'R' | 'X';
type PageView = 'create' | 'list';

const ServiceAgreementPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'ServiceAgreementPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);

  // View-only users have nothing to do on the create form, so they only get the list.
  const [requestedView, setView] = useState<PageView>('create');
  const view: PageView = canSubmit ? requestedView : 'list';

  const [agreementType, setAgreementType] = useState<AgreementType>('FIXED_RECURRING');

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const activeFields = useServiceAgreementFields({
    agreementType,
    selectedCompany, selectedDivision, selectedBranch,
  });

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const buildInitialFormData = useCallback((fields: FieldType[]) => {
    const d: Record<string, any> = {};
    fields.forEach((field) => {
      if (!field.input) return;
      if (field.defaultValue !== undefined) d[field.field] = field.defaultValue;
      else if (field.type === 'date') d[field.field] = '';
      else if (field.type === 'number') d[field.field] = '';
      else if (field.type === 'file') d[field.field] = null;
      else d[field.field] = '';
    });
    d.vendors = [emptySupplierRow()];
    d.statutory = emptyStatutory();
    return d;
  }, []);

  // Reset the form whenever the type changes — Fixed, Unfixed and Statutory
  // share no required values whose meaning would still be valid across the switch.
  useEffect(() => {
    setFormData(buildInitialFormData(activeFields));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreementType]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [fieldName]: value };

      if (fieldName === 'com_sno') {
        updated.div_sno = ''; updated.div_name = '';
        updated.brn_sno = ''; updated.brn_name = '';
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedCompany(String(value));
        setSelectedDivision('');
        setSelectedBranch('');
      } else if (fieldName === 'div_sno') {
        updated.brn_sno = ''; updated.brn_name = '';
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedDivision(String(value));
        setSelectedBranch('');
      } else if (fieldName === 'brn_sno') {
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedBranch(String(value));
      }

      const field = activeFields.find((f) => f.field === fieldName);
      if (field?.options && Array.isArray(field.options)) {
        const selectedOption = (field.options as any[]).find((opt) => String(opt.value) === String(value));
        if (selectedOption) updated[resolveNameField(fieldName)] = selectedOption.label;
      }

      return updated;
    });

    setErrors((prev) => {
      const clearsStatutory = fieldName === 'statutory' && Object.keys(prev).some((k) => k.startsWith('stat_'));
      if (!prev[fieldName] && !clearsStatutory) return prev;
      const e = { ...prev };
      delete e[fieldName];
      if (fieldName === 'statutory') Object.keys(e).forEach((k) => { if (k.startsWith('stat_')) delete e[k]; });
      return e;
    });
  };

  const inputFields = useMemo(() => activeFields.filter((f) => f.input), [activeFields]);

  const validateForm = (): boolean => {
    const errs = validateAgreementForm({ inputFields, formData, agreementType });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReset = () => {
    setFormData(buildInitialFormData(activeFields));
    setErrors({});
    setSelectedCompany(''); setSelectedDivision(''); setSelectedBranch('');
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // ── Existing agreements list ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ListTab>('fixed');
  const [editing, setEditing] = useState<{ row: AgreementRow; mode: 'edit' | 'renew' } | null>(null);
  const [historyRow, setHistoryRow] = useState<AgreementRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { scrollToFirstError(); return; }

    if (!(formData.agreement_document instanceof File)) {
      setErrors((prev) => ({ ...prev, agreement_document: 'Agreement document is required' }));
      scrollToFirstError();
      return;
    }

    const submittedType = agreementType;
    setSubmitting(true);
    try {
      const res = await axios.post(createServiceAgreement, buildAgreementFormData(formData, submittedType), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res?.data?.data;
      toast.success(`Service Agreement ${data?.agreement_no ?? ''} submitted for approval`);
      handleReset();
      refresh();
      // Land on the list, on the right tab, so the new agreement is visible.
      setStatusFilter('ALL');
      setSearch('');
      setActiveTab(TAB_FOR_TYPE[submittedType]);
      setView('list');
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || 'Submission failed. Please try again.';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const { data: agreementsRes, loading: loadingAgreements } = useFetch<{ success: boolean; data: AgreementRow[] }>(
    getServiceAgreements, '', null, refreshKey
  );
  const agreements = useMemo(() => agreementsRes?.data ?? [], [agreementsRes]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: agreements.length };
    agreements.forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return counts;
  }, [agreements]);

  // Client-side filters — the fetched list is already small enough that a
  // second API round-trip isn't worth it (same scale as the type tab split below).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agreements.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!q) return true;
      const supplierNames = (a.vendors ?? []).map((v) => v.vendor_name);
      return [a.agreement_no, a.service_name, a.vendor_name, ...supplierNames].some((v) => v?.toLowerCase().includes(q));
    });
  }, [agreements, statusFilter, search]);
  const rowsByTab = useMemo<Record<ListTab, AgreementRow[]>>(() => ({
    fixed: filtered.filter((a) => a.service_type_code === 'FIXED_RECURRING'),
    variable: filtered.filter((a) => a.service_type_code === 'VARIABLE_RECURRING'),
    statutory: filtered.filter((a) => a.service_type_code === 'STATUTORY'),
  }), [filtered]);
  const canEditAgreements = canEdit('ServiceAgreementPage');
  const isFiltering = statusFilter !== 'ALL' || search.trim() !== '';

  const statusChips = [
    { value: 'ALL' as const, label: 'All', count: statusCounts.ALL },
    { value: 'P' as const, label: 'Pending', count: statusCounts.P ?? 0 },
    { value: 'A' as const, label: 'Approved', count: statusCounts.A ?? 0 },
    { value: 'R' as const, label: 'Rejected', count: statusCounts.R ?? 0 },
    { value: 'X' as const, label: 'Expired', count: statusCounts.X ?? 0 },
  ];

  // History is open to everyone who can see the list; Edit / Renew need edit rights.
  // Expired agreements are renewed (new term, same number); Approved / Rejected ones edited.
  const rowActions = (row: AgreementRow, className?: string) => (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      <Button size="sm" variant="ghost" onClick={() => setHistoryRow(row)} className={className ? 'flex-1' : undefined}>
        <History size={14} /> History
      </Button>
      {canEditAgreements && row.status === 'X' && (
        <Button size="sm" onClick={() => setEditing({ row, mode: 'renew' })} className={className ? 'flex-1' : undefined}>
          <RotateCcw size={14} /> Renew
        </Button>
      )}
      {canEditAgreements && (row.status === 'A' || row.status === 'R') && (
        <Button size="sm" variant="outline" onClick={() => setEditing({ row, mode: 'edit' })} className={className ? 'flex-1' : undefined}>
          <Pencil size={14} /> Edit
        </Button>
      )}
    </div>
  );

  const versionNote = (row: AgreementRow) =>
    (row.version_no ?? 1) > 1
      ? <>v{row.version_no}{row.renewal_count ? ` · renewed ${row.renewal_count}×` : ''}</>
      : null;

  const statutoryLine = (row: AgreementRow) =>
    row.service_type_code === 'STATUTORY' && row.facility_type
      ? [
          facilityLabel(row.facility_type),
          `${row.interest_rate_pct}%${row.rate_type === 'FLOATING' ? ` ${row.benchmark_name ?? 'Repo'}-linked` : ' fixed'}`,
          row.interest_payment_day ? `interest on the ${ordinalDay(row.interest_payment_day)}` : null,
        ].filter(Boolean).join(' · ')
      : null;

  const renderRows = (rows: AgreementRow[]) => {
    if (loadingAgreements) {
      return (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={isFiltering ? SearchX : ClipboardList}
          message={isFiltering ? 'No agreements match your filters' : 'No agreements yet'}
          description={isFiltering ? 'Try a different status or search term.' : 'Agreements you submit will be listed here.'}
          action={isFiltering ? (
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter('ALL'); setSearch(''); }}>Clear filters</Button>
          ) : undefined}
        />
      );
    }
    return (
      <>
        {/* Wide screens: table */}
        <div className="hidden overflow-hidden rounded-lg border lg:block">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Agreement</TableHead>
                <TableHead>Service / Suppliers</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate / Sanctioned</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-60" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = statusMeta(AGREEMENT_STATUS, row.status);
                const facility = statutoryLine(row);
                return (
                  <TableRow key={row.agreement_sno} className={cn(row.status === 'X' && 'bg-muted/30')}>
                    <TableCell>
                      <div className="font-semibold">{row.agreement_no}</div>
                      {versionNote(row) && <div className="text-[11px] text-muted-foreground">{versionNote(row)}</div>}
                    </TableCell>
                    <TableCell className="max-w-[18rem]">
                      <div className="truncate font-medium">{row.service_name}</div>
                      <SupplierSummary suppliers={row.vendors} fallback={row.vendor_name} className="text-xs text-muted-foreground" />
                      {facility && <div className="truncate text-xs text-sky-700 dark:text-sky-300">{facility}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.service_type_code === 'STATUTORY' ? '—' : (row.qty ?? '—')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.service_type_code === 'STATUTORY'
                        ? (row.sanctioned_amount != null ? formatINR(row.sanctioned_amount) : '—')
                        : (row.rate_amount != null ? formatINR(row.rate_amount) : '—')}
                      {row.service_type_code !== 'STATUTORY' && row.rate_uom_name && <span className="ml-1 text-xs text-muted-foreground">/ {row.rate_uom_name}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.period_start_date)} – {formatDate(row.period_end_date)}
                    </TableCell>
                    <TableCell><StatusPill tone={status.tone}>{status.label}</StatusPill></TableCell>
                    <TableCell className="text-right">{rowActions(row)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Narrow screens: cards */}
        <ul className="space-y-3 lg:hidden">
          {rows.map((row) => {
            const status = statusMeta(AGREEMENT_STATUS, row.status);
            const facility = statutoryLine(row);
            return (
              <li key={row.agreement_sno} className="rounded-xl border bg-card p-3.5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.agreement_no}
                      {versionNote(row) && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{versionNote(row)}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.service_name}</p>
                    <SupplierSummary suppliers={row.vendors} fallback={row.vendor_name} className="text-xs text-muted-foreground" />
                    {facility && <p className="truncate text-xs text-sky-700 dark:text-sky-300">{facility}</p>}
                  </div>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs">
                  {row.service_type_code === 'STATUTORY' ? (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Sanctioned</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{row.sanctioned_amount != null ? formatINR(row.sanctioned_amount) : '—'}</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt className="text-muted-foreground">Rate</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                          {row.rate_amount != null ? formatINR(row.rate_amount) : '—'}
                          {row.rate_uom_name && <span className="ml-1 text-xs font-normal text-muted-foreground">/ {row.rate_uom_name}</span>}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Quantity</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">{row.qty ?? '—'}</dd>
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Period</dt>
                    <dd className="mt-0.5 font-medium">{formatDate(row.period_start_date)} – {formatDate(row.period_end_date)}</dd>
                  </div>
                </dl>
                {rowActions(row, 'mt-3')}
              </li>
            );
          })}
        </ul>
      </>
    );
  };

  return (
    <div className="min-h-full bg-muted/30">
      <PageHeader
        icon={FileText}
        title="Service Agreements"
        description="Fixed and Unfixed agreements raise a PO each cycle; Statutory (loan / repo / cash credit) agreements are billed through Bank Payment Vouchers under Loan Payments"
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={view} onValueChange={(v) => setView(v as PageView)}>
          <TabsList className="h-10 w-full sm:w-fit">
            {canSubmit && (
              <TabsTrigger value="create" className="px-4"><FilePlus2 size={15} /> New agreement</TabsTrigger>
            )}
            <TabsTrigger value="list" className="px-4">
              <ClipboardList size={15} /> All agreements
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{statusCounts.ALL}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Create ─────────────────────────────────────────────────── */}
          {canSubmit && (
            <TabsContent value="create" className="mt-5">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <Panel icon={Repeat} title="Agreement type" description="Decides how each cycle's amount is set">
                  <div role="radiogroup" aria-label="Agreement type" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {AGREEMENT_TYPES.map(({ value, label, description, Icon }) => {
                      const active = agreementType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setAgreementType(value)}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            active
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
                          )}
                        >
                          <span className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                          )}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                          </span>
                          <span className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                            active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                          )}>
                            {active && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                <AgreementFormSections
                  fields={inputFields}
                  formData={formData}
                  errors={errors}
                  onChange={handleFieldChange}
                  agreementType={agreementType}
                />

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

          {/* ── List ───────────────────────────────────────────────────── */}
          <TabsContent value="list" className="mt-5">
            <Panel
              icon={ClipboardList}
              title="Existing agreements"
              action={
                <Button variant="outline" size="sm" onClick={refresh} disabled={loadingAgreements}>
                  <RefreshCw size={14} className={cn(loadingAgreements && 'animate-spin')} /> <span className="hidden sm:inline">Refresh</span>
                </Button>
              }
              bodyClassName="space-y-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterChips options={statusChips} value={statusFilter} onChange={setStatusFilter} />
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search agreements"
                  className="w-full md:w-72"
                />
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ListTab)}>
                <TabsList className="w-full sm:w-fit">
                  <TabsTrigger value="fixed" className="sm:px-4"><Repeat size={14} /> Fixed ({rowsByTab.fixed.length})</TabsTrigger>
                  <TabsTrigger value="variable" className="sm:px-4"><Wallet size={14} /> Unfixed ({rowsByTab.variable.length})</TabsTrigger>
                  <TabsTrigger value="statutory" className="sm:px-4"><Landmark size={14} /> Statutory ({rowsByTab.statutory.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="fixed" className="mt-4">{renderRows(rowsByTab.fixed)}</TabsContent>
                <TabsContent value="variable" className="mt-4">{renderRows(rowsByTab.variable)}</TabsContent>
                <TabsContent value="statutory" className="mt-4">{renderRows(rowsByTab.statutory)}</TabsContent>
              </Tabs>
            </Panel>
          </TabsContent>
        </Tabs>
      </div>

      {editing && (
        <EditAgreementDialog
          row={editing.row}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {historyRow && (
        <AgreementHistoryDialog agreement={historyRow} onClose={() => setHistoryRow(null)} />
      )}
    </div>
  );
};

export default ServiceAgreementPage;
