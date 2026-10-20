import type { StatusMeta } from '@/CustomComponent/ServiceComponents/serviceUtils';

// Special Agreement = a supplier fixed per product for a period, with either a fixed rate (FIXED)
// or a rate that may change (UNFIXED). See sql/133_special_agreement.sql.

export type SpecialType = 'FIXED' | 'UNFIXED';

export const SPECIAL_TYPE_LABEL: Record<SpecialType, string> = { FIXED: 'Fixed rate', UNFIXED: 'Unfixed rate' };

export const SPECIAL_TYPE_HINT: Record<SpecialType, string> = {
  FIXED: 'Supplier and rate are both fixed for each product until the end date.',
  UNFIXED: 'Supplier is fixed for each product, but the rate can change — it is set when buying.',
};

export const SPECIAL_STATUS: Record<string, StatusMeta> = {
  P: { label: 'Pending', tone: 'warning' },
  A: { label: 'Approved', tone: 'success' },
  R: { label: 'Rejected', tone: 'danger' },
  X: { label: 'Expired', tone: 'neutral' },
};

export interface SpecialItem {
  item_sno?: number;
  prod_sno: number;
  prod_name: string;
  prod_code?: string;
  uom_name?: string;
  rate_amount: number | null;
  max_qty: number | null;
  remarks?: string | null;
}

export interface SpecialHistoryEntry { action_type: string; status_by?: string; comment?: string; version_no?: number; created_at?: string }

export interface SpecialAgreementRow {
  special_agreement_sno: number;
  agreement_no: string;
  agreement_type: SpecialType;
  com_sno: number; div_sno: number; brn_sno: number; dept_sno: number;
  com_name?: string; div_name?: string; brn_name?: string; dept_name?: string;
  vendor_sno: number; vendor_name?: string; supp_code?: string;
  period_start_date: string; period_end_date: string;
  agreement_doc_url?: string | null;
  remarks?: string | null; terms_conditions?: string | null;
  status: 'P' | 'A' | 'R' | 'X';
  version_no: number;
  current_approver_id?: string | null;
  created_by?: string; created_at?: string;
  items: SpecialItem[];
  history: SpecialHistoryEntry[];
  stage_order_json?: string | null;
}

/** One editable product line in the form (strings, so inputs stay controlled). */
export interface ItemDraft { prod_sno: string; rate_amount: string; max_qty: string; remarks: string }
export const emptyItemDraft = (): ItemDraft => ({ prod_sno: '', rate_amount: '', max_qty: '', remarks: '' });

export interface SpecialFormValues {
  com_sno: string; div_sno: string; brn_sno: string; dept_sno: string;
  agreement_type: SpecialType;
  vendor_sno: string;
  period_start_date: string; period_end_date: string;
  remarks: string; terms_conditions: string;
  agreement_document: File | null;
  /** Existing document when editing; kept unless a new file is chosen. */
  agreement_doc_url: string;
}

export const emptyFormValues = (): SpecialFormValues => ({
  com_sno: '', div_sno: '', brn_sno: '', dept_sno: '', agreement_type: 'FIXED', vendor_sno: '',
  period_start_date: '', period_end_date: '', remarks: '', terms_conditions: '',
  agreement_document: null, agreement_doc_url: '',
});

export function validateSpecialForm(values: SpecialFormValues, items: ItemDraft[]): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!values.com_sno) errs.com_sno = 'Company is required';
  if (!values.div_sno) errs.div_sno = 'Division is required';
  if (!values.brn_sno) errs.brn_sno = 'Branch is required';
  if (!values.dept_sno) errs.dept_sno = 'Department is required';
  if (!values.vendor_sno) errs.vendor_sno = 'Supplier is required';
  if (!values.period_start_date) errs.period_start_date = 'Start date is required';
  if (!values.period_end_date) errs.period_end_date = 'End date is required';
  if (values.period_start_date && values.period_end_date && values.period_end_date < values.period_start_date) {
    errs.period_end_date = 'End date cannot be before the start date';
  }
  if (items.length === 0) errs.items = 'Add at least one product';
  const seen = new Set<string>();
  items.forEach((it, i) => {
    if (!it.prod_sno) { errs[`item_${i}_prod`] = 'Choose a product'; return; }
    if (seen.has(it.prod_sno)) errs[`item_${i}_prod`] = 'Product is already added';
    seen.add(it.prod_sno);
    if (values.agreement_type === 'FIXED' && !(Number(it.rate_amount) > 0)) errs[`item_${i}_rate`] = 'Rate must be greater than 0';
    if (it.max_qty !== '' && !(Number(it.max_qty) > 0)) errs[`item_${i}_qty`] = 'Must be greater than 0';
  });
  return errs;
}

export function buildSpecialFormData(values: SpecialFormValues, items: ItemDraft[], extra?: Record<string, string>): FormData {
  const fd = new FormData();
  const scalars: (keyof SpecialFormValues)[] = [
    'com_sno', 'div_sno', 'brn_sno', 'dept_sno', 'agreement_type', 'vendor_sno',
    'period_start_date', 'period_end_date', 'remarks', 'terms_conditions', 'agreement_doc_url',
  ];
  scalars.forEach((k) => fd.append(k, String(values[k] ?? '')));
  fd.append('items', JSON.stringify(items.map((it) => ({
    prod_sno: Number(it.prod_sno),
    rate_amount: values.agreement_type === 'FIXED' ? Number(it.rate_amount) : null,
    max_qty: it.max_qty === '' ? null : Number(it.max_qty),
    remarks: it.remarks.trim() || null,
  }))));
  if (values.agreement_document instanceof File) fd.append('agreement_document', values.agreement_document);
  Object.entries(extra ?? {}).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

/** Pre-fills the form from an existing agreement (edit / resubmit). */
export function valuesFromRow(row: SpecialAgreementRow): { values: SpecialFormValues; items: ItemDraft[] } {
  return {
    values: {
      com_sno: String(row.com_sno), div_sno: String(row.div_sno), brn_sno: String(row.brn_sno), dept_sno: String(row.dept_sno),
      agreement_type: row.agreement_type, vendor_sno: String(row.vendor_sno),
      period_start_date: row.period_start_date?.slice(0, 10) ?? '', period_end_date: row.period_end_date?.slice(0, 10) ?? '',
      remarks: row.remarks ?? '', terms_conditions: row.terms_conditions ?? '',
      agreement_document: null, agreement_doc_url: row.agreement_doc_url ?? '',
    },
    items: row.items.map((i) => ({
      prod_sno: String(i.prod_sno),
      rate_amount: i.rate_amount != null ? String(i.rate_amount) : '',
      max_qty: i.max_qty != null ? String(i.max_qty) : '',
      remarks: i.remarks ?? '',
    })),
  };
}
