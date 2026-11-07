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
  History, RotateCcw, FileSignature, Landmark,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, PageHeader } from '@/CustomComponent/PageComponents';
import {
  Callout, FilterChips, Panel, SearchInput, StatusPill, SupplierSummary, TypeBadge,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, buildSupplierPayload, dateOnly, emptyStatutoryDue, emptySupplierRow,
  entersAmountPerCycle, formatDate, formatINR, isStatutoryAgreement, statusMeta, statutoryDueFromRow, statutoryDuePayload,
  statutoryDueProblem, statutoryDueSummary, suggestRenewalTerm, validateSuppliers,
  type StatutoryDueForm, type StatutoryDueInfo, type SupplierRowValue, type SupplierShare,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import { SupplierSplitEditor } from '@/CustomComponent/ServiceComponents/SupplierSplitEditor';
import { StatutoryDueEditor } from '@/CustomComponent/ServiceComponents/StatutoryDueEditor';
import { AgreementHistoryDialog } from '@/CustomComponent/ServiceComponents/AgreementHistoryDialog';
import { DocLink, SignedAgreementDialog } from '@/CustomComponent/ServiceComponents/ServiceUploads';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useServiceAgreementFields, type ServiceAgreementKind as AgreementType } from '@/FieldDatas/ServiceAgreementData';
import axios from 'axios';
import { createServiceAgreement, updateServiceAgreement, getServiceAgreements } from '@/Services/Api';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import { cn } from '@/lib/utils';
import useFetch from '@/hooks/useFetchHook';
import { useServiceLive } from '@/hooks/useServiceLive';

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
  /** Signed copy uploaded after approval — newest first; signed_doc_url is the current one. */
  signed_docs?: { signed_doc_sno: number; doc_url: string; uploaded_by: string; uploaded_at: string }[];
  signed_doc_url?: string | null;
  facility_type?: string; facility_ref_no?: string; sanctioned_amount?: number; drawing_power?: number;
  rate_type?: string; benchmark_rate_pct?: number; spread_pct?: number; interest_rate_pct?: number;
  benchmark_name?: string; disbursed_amount?: number; disbursement_date?: string;
  interest_payment_day?: number; day_count_basis?: number;
  version_no?: number; renewal_count?: number;
  /** Statutory agreements (sql/157): where each due is paid on Statutory Payments */
  statutory_due?: StatutoryDueInfo;
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
  { value: 'STATUTORY', label: 'Statutory', description: 'PF, ESI, taxes, utility bills — after approval each due is paid on Statutory Payments', Icon: Landmark },
];

type ListTab = 'fixed' | 'variable' | 'statutory';
const TAB_FOR_TYPE: Record<AgreementType, ListTab> = { FIXED_RECURRING: 'fixed', VARIABLE_RECURRING: 'variable', STATUTORY: 'statutory' };

// A Statutory agreement reuses the same sections under names that fit a due (no supplier, no PO).
const STATUTORY_SECTION_TEXT: Record<string, { title?: string; description?: string }> = {
  service: { title: 'Due' },
  pricing: { title: 'Amount' },
  schedule: { description: 'Term and due dates' },
  docs: { title: 'Document & notes' },
};

// The form's fields are grouped into sections purely by field name, so a field
// added to useServiceAgreementFields but not listed here still renders (in a
// trailing "More details" section) instead of silently disappearing. Suppliers
// are not plain fields — they are rendered by
// a dedicated editor, slotted in after the section named in `slots`.
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
  const { inputFields, formData, renewAfter, agreementType } = args;
  const statutory = isStatutoryAgreement(agreementType);
  const errs: FormErrors = {};
  inputFields.forEach((f) => {
    if (f.require && !formData[f.field]) errs[f.field] = `${f.label} is required`;
  });
  if (formData.qty && Number(formData.qty) <= 0) errs.qty = 'Quantity must be greater than 0';
  if (formData.rate_amount && Number(formData.rate_amount) <= 0) errs.rate_amount = statutory ? 'Amount must be greater than 0' : 'Rate must be greater than 0';

  const start = formData.period_start_date, end = formData.period_end_date;
  if (start && end && end <= start) errs.period_end_date = 'Duration To must be after Duration From';
  if (renewAfter && start && start <= renewAfter) errs.period_start_date = `A renewal must start after the previous term ended (${formatDate(renewAfter)})`;

  if (statutory) {
    // a statutory due has no supplier; it says where on Statutory Payments it is paid instead
    const dueError = statutoryDueProblem(formData.statutory_due);
    if (dueError) errs.statutory_due = dueError;
  } else {
    const supplierError = validateSuppliers(formData.vendors ?? [], totalPerCycle(formData));
    if (supplierError) errs.vendors = supplierError;
  }
  return errs;
}

/** Multipart body for create / edit / renew. Suppliers (or a Statutory agreement's payment block) go as a JSON string. */
function buildAgreementFormData(formData: Record<string, any>, agreementType: AgreementType, extra?: Record<string, string>): FormData {
  const fd = new FormData();
  const skip = new Set(['agreement_document', 'vendors', 'vendor_sno', 'vendor_name', 'statutory_due']);
  Object.entries(formData).forEach(([key, value]) => {
    if (skip.has(key) || value === null || value === undefined || value === '') return;
    fd.append(key, String(value));
  });
  Object.entries(extra ?? {}).forEach(([k, v]) => fd.append(k, v));
  if (isStatutoryAgreement(agreementType)) {
    fd.append('agreement_type', 'STATUTORY');
    fd.append('statutory_due', JSON.stringify(statutoryDuePayload((formData.statutory_due as StatutoryDueForm) ?? emptyStatutoryDue())));
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
  const perCycleEntry = entersAmountPerCycle(agreementType);
  const statutory = isStatutoryAgreement(agreementType);
  const due = (formData.statutory_due as StatutoryDueForm | undefined) ?? emptyStatutoryDue();
  const sections = useMemo(() => {
    const placed = new Set(FORM_SECTIONS.flatMap((s) => s.fields));
    const leftovers = fields.filter((f) => !placed.has(f.field)).map((f) => f.field);
    const more: FormSectionDef = {
      key: 'more', title: 'More details', icon: Layers, fields: leftovers, grid: 'sm:grid-cols-2', compactGrid: 'sm:grid-cols-2',
    };
    const all: FormSectionDef[] = leftovers.length ? [...FORM_SECTIONS, more] : FORM_SECTIONS;
    return all
      .map((s) => ({
        ...s,
        ...(statutory ? STATUTORY_SECTION_TEXT[s.key] : {}),
        defs: s.fields
          .map((n) => byName.get(n))
          .filter((f): f is FieldType => !!f),
      }))
      .filter((s) => s.defs.length > 0);
  }, [fields, byName, statutory]);

  // Dedicated editors, each placed right after the section it belongs with.
  const slots: Record<string, React.ReactNode> = {
    pricing: statutory ? (
      <StatutoryDueEditor
        value={due}
        onChange={(next) => onChange('statutory_due', next)}
        comSno={formData.com_sno}
        error={errors.statutory_due}
      />
    ) : (
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

            {s.key === 'schedule' && (statutory ? (
              <Callout tone="primary" icon={Bell}>
                <b>Due day</b> is the day of the month the payment is due (e.g. 15 for PF and ESI), needed for monthly, quarterly and annual dues.
                {' '}Each due shows on <b>Statutory Payments</b> that many days before it is due, and you get an in-app reminder then. Only dues on or after the day this agreement is approved are shown.
              </Callout>
            ) : (
              <Callout tone="primary" icon={Bell}>
                <b>PO Generation Day</b> is required for monthly, bi-monthly, quarterly and annual cadences (e.g. 5 = generate on the 5th of every eligible month).
                {' '}<b>Notify Before</b> sends an in-app reminder that many days before each auto-generation.
              </Callout>
            ))}
            {s.key === 'pricing' && statutory && (
              <Callout tone="violet" icon={Landmark}>
                {due.amount_type === 'FIXED'
                  ? 'Fixed: this exact amount is ready to pay on Statutory Payments on every due date.'
                  : 'Unfixed: this amount is only an estimate — the actual amount for each due is entered on Statutory Payments from the challan or bill, then paid.'}
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
      vendor_sno: row.vendor_sno ? String(row.vendor_sno) : '',
      qty: row.qty ?? 1,
      rate_amount: row.rate_amount ?? '', rate_uom_sno: row.rate_uom_sno ?? '', rate_uom_name: row.rate_uom_name ?? '',
      recurrence_cadence_sno: row.recurrence_cadence_sno ?? '',
      po_generation_day: row.po_generation_day ?? '', notify_days_before: row.notify_days_before ?? 0,
      period_start_date: term.start, period_end_date: term.end,
      agreement_document: null, agreement_doc_url: row.agreement_doc_url,
      remarks: row.remarks ?? '', terms_conditions: row.terms_conditions ?? '',
      statutory_due: statutoryDueFromRow(row.statutory_due),
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
      if (!prev[fieldName]) return prev;
      const e = { ...prev };
      delete e[fieldName];
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
              {row.rate_amount != null && <> at <b>{formatINR(row.rate_amount)}</b></>}. The new term must start after it ended —
              review the dates, rate and suppliers below, which are pre-filled from the last version.
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

/** A Statutory agreement in the list: where its dues are paid, and how many wait for an amount on Statutory Payments. */
const StatutoryRowNote: React.FC<{ row: AgreementRow }> = ({ row }) => {
  const d = row.statutory_due;
  if (!d) return <p className="text-xs text-muted-foreground">Paid on Statutory Payments</p>;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="block truncate" title={statutoryDueSummary(d)}>{statutoryDueSummary(d)}</span>
      {d.reference_no && <span className="block truncate">Ref {d.reference_no}</span>}
      {(d.waiting_count ?? 0) > 0 && (
        <span className="mt-0.5 block font-medium text-amber-700 dark:text-amber-300">
          {d.waiting_count} due{d.waiting_count === 1 ? '' : 's'} waiting for the amount on Statutory Payments
        </span>
      )}
    </p>
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
    d.statutory_due = emptyStatutoryDue();
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
      if (!prev[fieldName]) return prev;
      const e = { ...prev };
      delete e[fieldName];
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
  const [signingRow, setSigningRow] = useState<AgreementRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { scrollToFirstError(); return; }

    // a Statutory due may have no document (sql/157)
    if (!isStatutoryAgreement(agreementType) && !(formData.agreement_document instanceof File)) {
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

  // Real time: anyone creating / approving / uploading refreshes this list without a manual reload.
  useServiceLive('agreement', refresh);

  const { data: agreementsRes, loading: loadingAgreements } = useFetch<{ success: boolean; data: AgreementRow[] }>(
    getServiceAgreements, '', null, refreshKey
  );
  // The old Statutory LOAN agreements (they carry a facility type) stay in the database but are not listed;
  // Statutory due agreements (sql/157) are.
  const agreements = useMemo(
    () => (agreementsRes?.data ?? []).filter((a) => !(isStatutoryAgreement(a.service_type_code) && a.facility_type)),
    [agreementsRes],
  );

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
      return [a.agreement_no, a.service_name, a.vendor_name, a.statutory_due?.payee_name, a.statutory_due?.reference_no, ...supplierNames]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [agreements, statusFilter, search]);
  const rowsByTab = useMemo<Record<ListTab, AgreementRow[]>>(() => ({
    fixed: filtered.filter((a) => a.service_type_code === 'FIXED_RECURRING'),
    variable: filtered.filter((a) => a.service_type_code === 'VARIABLE_RECURRING'),
    statutory: filtered.filter((a) => isStatutoryAgreement(a.service_type_code)),
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
      {row.status === 'A' && row.signed_doc_url && (
        <DocLink url={row.signed_doc_url} label={`Signed copy${(row.signed_docs?.length ?? 0) > 1 ? ` (${row.signed_docs?.length})` : ''}`} className="inline-flex items-center gap-1 px-2 text-xs font-medium text-primary hover:underline" />
      )}
      {canEditAgreements && row.status === 'A' && (
        <Button size="sm" variant="outline" onClick={() => setSigningRow(row)} className={className ? 'flex-1' : undefined}>
          <FileSignature size={14} /> {row.signed_doc_url ? 'Replace signed' : 'Upload signed'}
        </Button>
      )}
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
                return (
                  <TableRow key={row.agreement_sno} className={cn(row.status === 'X' && 'bg-muted/30')}>
                    <TableCell>
                      <div className="font-semibold">{row.agreement_no}</div>
                      {versionNote(row) && <div className="text-[11px] text-muted-foreground">{versionNote(row)}</div>}
                    </TableCell>
                    <TableCell className="max-w-[18rem]">
                      <div className="truncate font-medium">{row.service_name}</div>
                      {isStatutoryAgreement(row.service_type_code)
                        ? <StatutoryRowNote row={row} />
                        : <SupplierSummary suppliers={row.vendors} fallback={row.vendor_name} className="text-xs text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{isStatutoryAgreement(row.service_type_code) ? '—' : row.qty ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.rate_amount != null ? formatINR(row.rate_amount) : '—'}
                      {row.rate_uom_name && <span className="ml-1 text-xs text-muted-foreground">/ {row.rate_uom_name}</span>}
                      {row.statutory_due?.amount_type === 'UNFIXED' && <span className="block text-[11px] text-muted-foreground">estimate per due</span>}
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
            return (
              <li key={row.agreement_sno} className="rounded-xl border bg-card p-3.5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.agreement_no}
                      {versionNote(row) && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{versionNote(row)}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.service_name}</p>
                    {isStatutoryAgreement(row.service_type_code)
                      ? <StatutoryRowNote row={row} />
                      : <SupplierSummary suppliers={row.vendors} fallback={row.vendor_name} className="text-xs text-muted-foreground" />}
                  </div>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs">
                  {isStatutoryAgreement(row.service_type_code) ? (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">{row.statutory_due?.amount_type === 'UNFIXED' ? 'Estimate per due' : 'Amount per due'}</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{row.rate_amount != null ? formatINR(row.rate_amount) : '—'}</dd>
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
        description="Fixed and Unfixed agreements raise a PO each cycle; Statutory dues are paid on Statutory Payments"
      />

      <div className="w-full space-y-5 px-2 pb-6 pt-1 sm:px-3 lg:px-5">
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

      {signingRow && (
        <SignedAgreementDialog
          agreement={signingRow}
          onClose={() => setSigningRow(null)}
          onSaved={() => { setSigningRow(null); refresh(); }}
        />
      )}
    </div>
  );
};

export default ServiceAgreementPage;
