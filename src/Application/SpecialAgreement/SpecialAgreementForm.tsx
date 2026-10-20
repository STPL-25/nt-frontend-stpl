import React, { useMemo } from 'react';
import { Plus, Trash2, Building2, Truck, Package, FileText, Repeat, Wallet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { useSpecialAgreementOptions } from '@/FieldDatas/SpecialAgreementData';
import { cn } from '@/lib/utils';
import {
  SPECIAL_TYPE_HINT, SPECIAL_TYPE_LABEL, emptyItemDraft,
  type ItemDraft, type SpecialFormValues, type SpecialType,
} from './specialAgreementUtils';

interface Props {
  values: SpecialFormValues;
  items: ItemDraft[];
  errors: Record<string, string>;
  onChange: (patch: Partial<SpecialFormValues>) => void;
  onItemsChange: (items: ItemDraft[]) => void;
  /** Edit mode keeps the current document unless a new one is picked. */
  editing?: boolean;
}

const TYPES: { value: SpecialType; Icon: React.ElementType }[] = [
  { value: 'FIXED', Icon: Repeat },
  { value: 'UNFIXED', Icon: Wallet },
];

const Field: React.FC<{ error?: string; className?: string; children: React.ReactNode }> = ({ error, className, children }) => (
  <div data-error={!!error} className={cn('flex flex-col', className)}>{children}</div>
);

export const SpecialAgreementForm: React.FC<Props> = ({ values, items, errors, onChange, onItemsChange, editing }) => {
  const { companyOptions, divisionOptions, branchOptions, deptOptions, vendorOptions, productOptions } =
    useSpecialAgreementOptions({
      selectedCompany: values.com_sno, selectedDivision: values.div_sno, selectedBranch: values.brn_sno,
    });
  const fixed = values.agreement_type === 'FIXED';

  const productByValue = useMemo(() => new Map(productOptions.map((p) => [String(p.value), p])), [productOptions]);

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    onItemsChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  // a product can only be on one line, so each row offers the products the other rows haven't taken
  const optionsFor = (i: number) => {
    const taken = new Set(items.filter((_, idx) => idx !== i).map((it) => it.prod_sno).filter(Boolean));
    return productOptions.filter((p) => !taken.has(String(p.value)));
  };

  return (
    <div className="space-y-4">
      <Panel icon={Repeat} title="Agreement type" description="Is the rate fixed for the period, or can it change?">
        <div role="radiogroup" aria-label="Agreement type" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {TYPES.map(({ value, Icon }) => {
            const active = values.agreement_type === value;
            return (
              <button
                key={value} type="button" role="radio" aria-checked={active}
                onClick={() => onChange({ agreement_type: value })}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'bg-card hover:bg-muted/50',
                )}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{SPECIAL_TYPE_LABEL[value]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{SPECIAL_TYPE_HINT[value]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel icon={Building2} title="Organisation" description="Who this agreement is raised for">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field error={errors.com_sno}>
            <CustomInputField field="com_sno" label="Company" require type="select" options={companyOptions}
              value={values.com_sno} error={errors.com_sno} className="h-10"
              onChange={(v) => onChange({ com_sno: String(v ?? ''), div_sno: '', brn_sno: '', dept_sno: '' })} />
          </Field>
          <Field error={errors.div_sno}>
            <CustomInputField field="div_sno" label="Division" require type="select" options={divisionOptions}
              value={values.div_sno} error={errors.div_sno} className="h-10"
              onChange={(v) => onChange({ div_sno: String(v ?? ''), brn_sno: '', dept_sno: '' })} />
          </Field>
          <Field error={errors.brn_sno}>
            <CustomInputField field="brn_sno" label="Branch" require type="select" options={branchOptions}
              value={values.brn_sno} error={errors.brn_sno} className="h-10"
              onChange={(v) => onChange({ brn_sno: String(v ?? ''), dept_sno: '' })} />
          </Field>
          <Field error={errors.dept_sno}>
            <CustomInputField field="dept_sno" label="Department" require type="select" options={deptOptions}
              value={values.dept_sno} error={errors.dept_sno} className="h-10"
              onChange={(v) => onChange({ dept_sno: String(v ?? '') })} />
          </Field>
        </div>
      </Panel>

      <Panel icon={Truck} title="Supplier & validity" description="One supplier per agreement, valid for the dates below">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field error={errors.vendor_sno} className="sm:col-span-2 lg:col-span-1">
            <CustomInputField field="vendor_sno" label="Supplier" require type="search-select" options={vendorOptions}
              value={values.vendor_sno} error={errors.vendor_sno} className="h-10"
              onChange={(v) => onChange({ vendor_sno: String(v ?? '') })} />
          </Field>
          <Field error={errors.period_start_date}>
            <CustomInputField field="period_start_date" label="Valid from" require type="date"
              value={values.period_start_date} error={errors.period_start_date} className="h-10"
              onChange={(v) => onChange({ period_start_date: String(v ?? '') })} />
          </Field>
          <Field error={errors.period_end_date}>
            <CustomInputField field="period_end_date" label="Valid to" require type="date"
              value={values.period_end_date} error={errors.period_end_date} className="h-10"
              onChange={(v) => onChange({ period_end_date: String(v ?? '') })} />
          </Field>
        </div>
      </Panel>

      <Panel
        icon={Package} title={`Products (${items.length})`}
        description={fixed ? 'Each product is bought from this supplier at the fixed rate below' : 'Each product is bought from this supplier; the rate is set at the time of buying'}
        action={<Button type="button" size="sm" variant="outline" onClick={() => onItemsChange([...items, emptyItemDraft()])}><Plus size={14} /> Add product</Button>}
      >
        {errors.items && <p className="mb-2 text-sm text-destructive">{errors.items}</p>}
        {!fixed && (
          <Callout tone="info" icon={Info} className="mb-3">
            Unfixed: only the supplier is locked for these products. Rates stay open and can change between purchases.
          </Callout>
        )}
        <div className="space-y-3">
          {items.map((it, i) => {
            const uom = productByValue.get(it.prod_sno)?.uom_name;
            return (
              <div key={i} className="rounded-lg border bg-card p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <Field error={errors[`item_${i}_prod`]} className="sm:col-span-5">
                    <CustomInputField field={`prod_${i}`} label="Product" require type="search-select" options={optionsFor(i)}
                      value={it.prod_sno} error={errors[`item_${i}_prod`]} className="h-10"
                      onChange={(v) => setItem(i, { prod_sno: String(v ?? '') })} />
                  </Field>
                  {fixed && (
                    <Field error={errors[`item_${i}_rate`]} className="sm:col-span-3">
                      <label className="mb-1.5 text-sm font-medium">Fixed rate{uom ? ` (per ${uom})` : ''} <span className="text-destructive">*</span></label>
                      <Input type="number" min="0" step="0.01" inputMode="decimal" className="h-10" placeholder="0.00"
                        value={it.rate_amount} onChange={(e) => setItem(i, { rate_amount: e.target.value })} />
                      {errors[`item_${i}_rate`] && <p className="mt-1 text-xs text-destructive">{errors[`item_${i}_rate`]}</p>}
                    </Field>
                  )}
                  <Field error={errors[`item_${i}_qty`]} className={fixed ? 'sm:col-span-3' : 'sm:col-span-5'}>
                    <label className="mb-1.5 text-sm font-medium">Max quantity{uom ? ` (${uom})` : ''} <span className="text-xs font-normal text-muted-foreground">optional</span></label>
                    <Input type="number" min="0" step="any" inputMode="decimal" className="h-10" placeholder="No limit"
                      value={it.max_qty} onChange={(e) => setItem(i, { max_qty: e.target.value })} />
                    {errors[`item_${i}_qty`] && <p className="mt-1 text-xs text-destructive">{errors[`item_${i}_qty`]}</p>}
                  </Field>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove product"
                      disabled={items.length === 1} onClick={() => onItemsChange(items.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel icon={FileText} title="Document & terms" description="Attach the signed copy if you have one — optional">
        <div className="grid grid-cols-1 gap-4">
          <Field className="sm:max-w-sm">
            <CustomInputField field="agreement_document" label={editing && values.agreement_doc_url ? 'Replace document (optional)' : 'Agreement document (optional)'}
              type="file" value={values.agreement_document ?? null}
              onChange={(f) => onChange({ agreement_document: (f as File) ?? null })} />
          </Field>
          <Field>
            <CustomInputField field="remarks" label="Remarks" type="textarea" rows={2} className="resize-none"
              value={values.remarks} onChange={(v) => onChange({ remarks: String(v ?? '') })} />
          </Field>
          <Field>
            <CustomInputField field="terms_conditions" label="Terms & conditions" type="textarea" rows={3} className="resize-none"
              placeholder="Optional — anything the A4 agreement used to say"
              value={values.terms_conditions} onChange={(v) => onChange({ terms_conditions: String(v ?? '') })} />
          </Field>
        </div>
      </Panel>
    </div>
  );
};
