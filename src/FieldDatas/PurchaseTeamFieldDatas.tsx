import { useMemo } from 'react';
import { FieldType } from './fieldType/fieldType';

// ── Payment terms options ────────────────────────────────────────────────────
const PAYMENT_TERMS = [
  'Net 30', 'Net 45', 'Net 60',
  'Advance 100%', 'Advance 50%, Balance on Delivery', 'On Delivery',
];

const paymentTermOptions = PAYMENT_TERMS.map(t => ({ value: t, label: t }));

// ── PR Summary Fields (view-only display) ────────────────────────────────────
export const usePRSummaryFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'com_name',       label: 'Company',       type: 'text', view: true, input: false },
    { field: 'div_brn',        label: 'Division / Branch', type: 'text', view: true, input: false },
    { field: 'dept_name',      label: 'Department',    type: 'text', view: true, input: false },
    { field: 'priority_name',  label: 'Priority',      type: 'text', view: true, input: false },
    { field: 'request_date',   label: 'Request Date',  type: 'date', view: true, input: false },
    { field: 'required_date',  label: 'Required By',   type: 'date', view: true, input: false },
    { field: 'created_by_name', label: 'Requested By', type: 'text', view: true, input: false },
    { field: 'purpose',        label: 'Purpose',       type: 'text', view: true, input: false },
  ], []);
};

// ── PR Item Table Fields ─────────────────────────────────────────────────────
export const usePRItemFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'prod_name',      label: 'Item / Product',   type: 'text',   view: true, input: false },
    { field: 'specification',  label: 'Specification',    type: 'text',   view: true, input: false },
    { field: 'qty',            label: 'Qty',              type: 'number', view: true, input: true  },
    { field: 'unit_name',      label: 'Unit',             type: 'text',   view: true, input: false },
    { field: 'est_cost',       label: 'Est. Cost',        type: 'number', view: true, input: false },
  ], []);
};

// ── Vendor Table Fields ──────────────────────────────────────────────────────
export const useVendorFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'company_name',   label: 'Vendor Name',      type: 'text', view: true, input: false },
    { field: 'contact_person', label: 'Contact Person',   type: 'text', view: true, input: false },
    { field: 'gst_no',         label: 'GST No',           type: 'text', view: true, input: false },
    { field: 'mobile_number',  label: 'Mobile / Email',   type: 'text', view: true, input: false },
  ], []);
};

// ── Quotation Header Fields (form) ───────────────────────────────────────────
export const useQuotationHeaderFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'quotation_ref_no', label: 'Quotation Ref No', type: 'text',   require: true,  input: true, view: true,  placeholder: 'e.g. SQ-2026-001' },
    { field: 'quotation_date',   label: 'Quotation Date',   type: 'date',   require: false, input: true, view: true  },
    { field: 'valid_upto',       label: 'Valid Upto',       type: 'date',   require: true,  input: true, view: true  },
    { field: 'payment_terms',    label: 'Payment Terms',    type: 'select', require: false, input: true, view: true, options: paymentTermOptions },
    { field: 'delivery_days',    label: 'Delivery Days',    type: 'number', require: false, input: true, view: true, placeholder: 'e.g. 15' },
    { field: 'currency_code',    label: 'Currency',         type: 'text',   require: false, input: true, view: true  },
    { field: 'remarks',          label: 'Remarks',          type: 'textarea', require: false, input: true, view: true, placeholder: 'Additional notes...' },
  ], []);
};

// ── Quotation Item Fields (table with editable columns) ──────────────────────
export const useQuotationItemFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'prod_name',     label: 'Item',        type: 'text',   view: true, input: false },
    { field: 'qty',           label: 'Qty',         type: 'number', view: true, input: true  },
    { field: 'unit_name',     label: 'Unit',        type: 'text',   view: true, input: false },
    { field: 'unit_price',    label: 'Unit Price',   type: 'number', view: true, input: true, require: true },
    { field: 'discount_pct',  label: 'Disc %',      type: 'number', view: true, input: true  },
    { field: 'tax_pct',       label: 'Tax %',       type: 'number', view: true, input: true  },
    { field: 'total_amount',  label: 'Total',       type: 'number', view: true, input: false },
  ], []);
};

// ── Quotation Compare Fields (parameter rows) ───────────────────────────────
export const useQuotationCompareFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'quotation_ref_no', label: 'Ref No',         type: 'text', view: true, input: false },
    { field: 'valid_upto',       label: 'Valid Upto',     type: 'date', view: true, input: false },
    { field: 'payment_terms',    label: 'Payment Terms',  type: 'text', view: true, input: false },
    { field: 'delivery_days',    label: 'Delivery Days',  type: 'number', view: true, input: false },
    { field: 'total_amount',     label: 'Total Amount',   type: 'number', view: true, input: false },
  ], []);
};

// ── PO Form Fields ───────────────────────────────────────────────────────────
export const usePOFormFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'po_date',           label: 'PO Date',             type: 'date',     require: false, input: true, view: true  },
    { field: 'required_date',     label: 'Required Date',       type: 'date',     require: true,  input: true, view: true  },
    { field: 'delivery_address',  label: 'Delivery Address',    type: 'textarea', require: false, input: true, view: false, placeholder: 'Shipping / delivery address' },
    { field: 'terms_conditions',  label: 'Terms & Conditions',  type: 'textarea', require: false, input: true, view: false, placeholder: 'Payment terms, warranty, etc.' },
  ], []);
};

// ── Split Item Assignment Fields ─────────────────────────────────────────────
export const useSplitItemFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'prod_name',  label: 'Item / Product', type: 'text',   view: true, input: false },
    { field: 'qty',        label: 'Qty',            type: 'number', view: true, input: false },
    { field: 'unit_name',  label: 'Unit',           type: 'text',   view: true, input: false },
    { field: 'assign_to',  label: 'Assign to Quotation', type: 'select', view: true, input: true },
  ], []);
};

// ── Merge PR Selection Fields ────────────────────────────────────────────────
export const useMergePRFields = (): FieldType[] => {
  return useMemo<FieldType[]>(() => [
    { field: 'pr_no',      label: 'PR No',        type: 'text', view: true, input: false },
    { field: 'com_name',   label: 'Company',      type: 'text', view: true, input: false },
    { field: 'dept_name',  label: 'Department',   type: 'text', view: true, input: false },
    { field: 'item_count', label: 'Items',        type: 'number', view: true, input: false },
    { field: 'request_date', label: 'Request Date', type: 'date', view: true, input: false },
  ], []);
};
