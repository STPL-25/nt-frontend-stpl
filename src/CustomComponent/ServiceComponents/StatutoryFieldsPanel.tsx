import React from 'react';
import { CalendarClock, Check, Info, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  DAY_COUNT_LABEL, FACILITY_META, effectiveRate, ordinalDay,
  type FacilityType, type RateType, type StatutoryForm,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

interface Props {
  value: StatutoryForm;
  onChange: (next: StatutoryForm) => void;
  errors: Record<string, string>;
  /** The lender (bank / NBFC) — an approved vendor. It lives beside the facility block in the form data. */
  lender: string;
  onLenderChange: (vendorSno: string) => void;
  lenderError?: string;
}

const FACILITIES = Object.entries(FACILITY_META) as [FacilityType, (typeof FACILITY_META)[FacilityType]][];

const RATE_TYPES: { value: RateType; label: string; hint: string }[] = [
  { value: 'FIXED', label: 'Fixed rate', hint: 'One interest rate for the term' },
  { value: 'FLOATING', label: 'Floating (repo-linked)', hint: 'Benchmark rate + spread — the benchmark is updated from Loan Payments whenever it moves' },
];

const BASIS_OPTIONS = [
  { value: '365', label: DAY_COUNT_LABEL['365'] },
  { value: '360', label: DAY_COUNT_LABEL['360'] },
];

/**
 * Everything the loan needs to be tracked: lender, amounts, disbursement date, fixed or
 * floating interest, and the day of the month interest is paid. Once the agreement is
 * approved the loan appears under Loan Payments, where interest is calculated on the
 * outstanding principal and paid through a Bank Payment Voucher for each interest date.
 */
export const StatutoryFieldsPanel: React.FC<Props> = ({ value, onChange, errors, lender, onLenderChange, lenderError }) => {
  const { options } = useMasterOptions(['VendorMaster']);
  const vendorOptions: { label: string; value: string | number }[] = options?.VendorMaster ?? [];

  const set = (patch: Partial<StatutoryForm>) => onChange({ ...value, ...patch });
  const facility = value.facility_type ? FACILITY_META[value.facility_type] : null;
  const effective = effectiveRate(value);
  const floating = value.rate_type === 'FLOATING';
  const isCC = value.facility_type === 'CASH_CREDIT';

  // The amount drawn follows the sanctioned amount until the user types something different
  // (staged disbursements, or a cash-credit limit that starts undrawn).
  const setSanctioned = (v: string) => {
    const follows = !isCC && (value.disbursed_amount === '' || value.disbursed_amount === value.sanctioned_amount);
    set({ sanctioned_amount: v, ...(follows ? { disbursed_amount: v } : {}) });
  };

  const cell = (key: string, children: React.ReactNode, className?: string) => (
    <div data-error={!!errors[key]} className={cn('flex flex-col', className)}>{children}</div>
  );

  return (
    <Panel
      icon={Landmark}
      title="Loan details"
      description="Lender, amounts, interest and the day interest is paid — interest is then calculated for you on the outstanding principal"
      bodyClassName="space-y-5"
    >
      <div data-error={!!errors.stat_facility_type} className="space-y-2">
        <p className="text-sm font-medium">Facility type <span className="text-destructive">*</span></p>
        <div role="radiogroup" aria-label="Facility type" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FACILITIES.map(([type, meta]) => {
            const active = value.facility_type === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({
                  facility_type: type,
                  ...(type !== 'CASH_CREDIT' ? { drawing_power: '' } : {}),
                  // A cash-credit limit starts undrawn; a term loan / repo is drawn in full unless changed.
                  ...(type === 'CASH_CREDIT' && value.disbursed_amount === value.sanctioned_amount ? { disbursed_amount: '0' } : {}),
                })}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <span className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                )}>
                  {active && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{meta.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.stat_facility_type && <p className="text-xs font-medium text-destructive">{errors.stat_facility_type}</p>}
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <div data-error={!!lenderError} className="flex flex-col sm:col-span-2">
          <CustomInputField
            field="stat_lender" label="Lender (bank / NBFC)" require type="search-select"
            options={vendorOptions} value={lender} onChange={(v: string) => onLenderChange(v)}
            error={lenderError} placeholder="Select the lender — it must be an approved vendor" className="h-10"
          />
        </div>
        {cell('stat_facility_ref_no', (
          <CustomInputField
            field="stat_facility_ref_no" label="Loan / account no." type="text"
            value={value.facility_ref_no} onChange={(v: string) => set({ facility_ref_no: v })}
            placeholder="Loan a/c, sanction letter or CC a/c no." className="h-10"
          />
        ))}
        {cell('stat_sanctioned_amount', (
          <CustomInputField
            field="stat_sanctioned_amount" label={facility?.amountLabel ?? 'Sanctioned amount'} require type="number"
            value={value.sanctioned_amount} onChange={setSanctioned}
            error={errors.stat_sanctioned_amount} placeholder="0.00" className="h-10"
          />
        ))}
        {cell('stat_disbursed_amount', (
          <CustomInputField
            field="stat_disbursed_amount" label={isCC ? 'Amount drawn at the start' : 'Amount disbursed'} require type="number"
            value={value.disbursed_amount} onChange={(v: string) => set({ disbursed_amount: v })}
            error={errors.stat_disbursed_amount} placeholder={isCC ? '0 if nothing is drawn yet' : 'Amount actually received'} className="h-10"
          />
        ))}
        {cell('stat_disbursement_date', (
          <CustomInputField
            field="stat_disbursement_date" label={isCC ? 'Limit start date' : 'Disbursement date'} require type="date"
            value={value.disbursement_date} onChange={(v: string) => set({ disbursement_date: v })}
            error={errors.stat_disbursement_date} className="h-10"
          />
        ))}
        {isCC && cell('stat_drawing_power', (
          <CustomInputField
            field="stat_drawing_power" label="Drawing power (optional)" type="number"
            value={value.drawing_power} onChange={(v: string) => set({ drawing_power: v })}
            error={errors.stat_drawing_power} placeholder="Within the sanctioned limit" className="h-10"
          />
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Interest rate</p>
        <div role="radiogroup" aria-label="Rate type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RATE_TYPES.map((r) => {
            const active = value.rate_type === r.value;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ rate_type: r.value })}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <span className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                )}>
                  {active && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{r.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
          {floating ? (
            <>
              {cell('stat_benchmark_rate_pct', (
                <CustomInputField
                  field="stat_benchmark_rate_pct" label={`${value.benchmark_name.trim() || 'Repo'} rate at disbursement (%)`} require type="number"
                  value={value.benchmark_rate_pct} onChange={(v: string) => set({ benchmark_rate_pct: v })}
                  error={errors.stat_benchmark_rate_pct} placeholder="e.g. 6.50" className="h-10"
                />
              ))}
              {cell('stat_spread_pct', (
                <CustomInputField
                  field="stat_spread_pct" label="Spread (%)" require type="number"
                  value={value.spread_pct} onChange={(v: string) => set({ spread_pct: v })}
                  error={errors.stat_spread_pct} placeholder="e.g. 2.25" className="h-10"
                />
              ))}
              <div className="flex flex-col justify-end">
                <div className="flex h-10 items-center justify-between rounded-md border bg-muted/30 px-3 text-sm">
                  <span className="text-muted-foreground">Effective rate</span>
                  <span className="font-bold tabular-nums text-primary">{effective !== null ? `${effective}%` : '—'}</span>
                </div>
              </div>
            </>
          ) : (
            cell('stat_interest_rate_pct', (
              <CustomInputField
                field="stat_interest_rate_pct" label="Interest rate (% p.a.)" require type="number"
                value={value.interest_rate_pct} onChange={(v: string) => set({ interest_rate_pct: v })}
                error={errors.stat_interest_rate_pct} placeholder="e.g. 9.25" className="h-10"
              />
            ))
          )}
        </div>
        {errors.stat_interest_rate_pct && floating && <p className="text-xs font-medium text-destructive">{errors.stat_interest_rate_pct}</p>}
      </div>

      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Interest payment</p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
          {cell('stat_interest_payment_day', (
            <CustomInputField
              field="stat_interest_payment_day" label="Paid on day of month" require type="number"
              value={value.interest_payment_day} onChange={(v: string) => set({ interest_payment_day: v })}
              error={errors.stat_interest_payment_day} placeholder="e.g. 7" className="h-10"
            />
          ))}
          {cell('stat_day_count_basis', (
            <CustomInputField
              field="stat_day_count_basis" label="Day-count basis" type="select"
              options={BASIS_OPTIONS} value={value.day_count_basis}
              onChange={(v: string) => set({ day_count_basis: v === '360' ? '360' : '365' })} className="h-10"
            />
          ))}
          <div className="flex flex-col justify-end">
            <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
              {value.interest_payment_day ? <>Every <b className="mx-1 text-foreground">{ordinalDay(value.interest_payment_day)}</b> of the month</> : 'Pick the payment day'}
            </div>
          </div>
        </div>
      </div>

      <Callout tone="info" icon={Info}>
        This loan raises <b>no purchase orders</b>. Once approved it appears under <b>Loan Payments</b>: enter each repo / rate change with its
        effective date there, and raise a <b>Bank Payment Voucher</b> for every interest date — interest is worked out on the outstanding
        principal, split at each rate change, up to the payment date.
      </Callout>
    </Panel>
  );
};
