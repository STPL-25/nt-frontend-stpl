import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, Equal, ArrowDownToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { emptySupplierRow, formatINR, type SupplierRowValue } from '@/CustomComponent/ServiceComponents/serviceUtils';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Props {
  rows: SupplierRowValue[];
  onChange: (rows: SupplierRowValue[]) => void;
  /** rate × quantity — what the shares must add up to. 0 while those aren't filled in yet. */
  total: number;
  error?: string;
}

/**
 * Supplier split for an agreement. One supplier is the common case and stays a single
 * dropdown (it always carries the whole amount). Adding more turns on per-supplier amounts,
 * which must add up to the amount per cycle (rate × quantity) — e.g. rent of 50,000 as
 * 10,000 + 20,000 + 20,000. The backend re-checks this; the live meter here just makes it
 * hard to get wrong.
 */
export const SupplierSplitEditor: React.FC<Props> = ({ rows, onChange, total, error }) => {
  const { options } = useMasterOptions(['VendorMaster']);
  const vendorOptions: { label: string; value: string | number }[] = options?.VendorMaster ?? [];

  const multi = rows.length > 1;
  const amountOf = (r: SupplierRowValue) => Number(r.share_amount) || 0;
  const allocated = multi ? round2(rows.reduce((s, r) => s + amountOf(r), 0)) : total;
  const remaining = round2(total - allocated);
  const balanced = total > 0 && Math.abs(remaining) <= 0.01;
  const usedPct = total > 0 ? Math.min(100, (allocated / total) * 100) : 0;
  const tone = !multi || total <= 0 ? 'neutral' : balanced ? 'ok' : remaining < 0 ? 'over' : 'short';

  const setRow = (i: number, patch: Partial<SupplierRowValue>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const add = () => {
    // Going from one supplier to two: the first keeps the whole amount until the user carves it up.
    const seeded = rows.length === 1 && total > 0 ? [{ ...rows[0], share_amount: String(total) }] : rows;
    onChange([...seeded, emptySupplierRow()]);
  };

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const splitEqually = () => {
    if (total <= 0) return;
    const base = Math.floor((total * 100) / rows.length) / 100;
    onChange(rows.map((r, idx) => ({
      ...r,
      share_amount: String(idx === rows.length - 1 ? round2(total - base * (rows.length - 1)) : base),
    })));
  };

  const fillRemaining = (i: number) => {
    const next = round2(amountOf(rows[i]) + remaining);
    if (next > 0) setRow(i, { share_amount: String(next) });
  };

  const takenElsewhere = (i: number) => new Set(rows.filter((_, idx) => idx !== i).map((r) => r.vendor_sno).filter(Boolean));

  return (
    <Panel
      icon={Users}
      title="Suppliers"
      description="One supplier, or split the amount per cycle across several — each gets their own PO"
      bodyClassName="space-y-4"
    >
      {multi && (
        <div className="space-y-2">
          <dl className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Per cycle</dt>
              <dd className="text-sm font-bold tabular-nums sm:text-base">{total > 0 ? formatINR(total) : '—'}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Allocated</dt>
              <dd className="text-sm font-bold tabular-nums sm:text-base">{formatINR(allocated)}</dd>
            </div>
            <div className={cn(
              'rounded-lg border px-2 py-2',
              tone === 'ok' && 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
              tone === 'over' && 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
              tone === 'short' && 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
              tone === 'neutral' && 'bg-muted/30',
            )}>
              <dt className="text-[11px] font-medium uppercase tracking-wide opacity-80">{remaining < 0 ? 'Over by' : 'Remaining'}</dt>
              <dd className="text-sm font-bold tabular-nums sm:text-base">{total > 0 ? formatINR(Math.abs(remaining)) : '—'}</dd>
            </div>
          </dl>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPct)}
            aria-label="Share of the amount per cycle allocated to suppliers"
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                tone === 'ok' && 'bg-emerald-500', tone === 'over' && 'bg-red-500', tone === 'short' && 'bg-amber-500', tone === 'neutral' && 'bg-primary/40',
              )}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          {total <= 0 && (
            <Callout tone="warning">Enter the quantity and rate first — the supplier amounts must add up to rate × quantity.</Callout>
          )}
        </div>
      )}

      <ul className="space-y-3" data-error={!!error}>
        {rows.map((row, i) => {
          const taken = takenElsewhere(i);
          const rowOptions = vendorOptions.filter((o) => !taken.has(String(o.value)));
          const pct = total > 0 ? (amountOf(row) / total) * 100 : 0;
          return (
            <li key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
              <div className="min-w-0">
                <CustomInputField
                  field={`supplier_${i}`}
                  label={i === 0 ? 'Primary supplier' : `Supplier ${i + 1}`}
                  type="search-select"
                  options={rowOptions}
                  value={row.vendor_sno}
                  onChange={(v: string) => setRow(i, { vendor_sno: v })}
                  placeholder={i === 0 ? 'Select primary supplier' : 'Select supplier'}
                  className="h-10"
                />
              </div>

              {/* On phones the amount and the row's buttons share one line under the supplier;
                  from `sm` up `contents` lets them slot into the grid's own columns. */}
              <div className="flex items-end gap-2 sm:contents">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`supplier_amount_${i}`} className="text-sm font-medium leading-none">
                    {multi ? 'Amount' : 'Amount per cycle'}
                  </Label>
                  {multi ? (
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                      <Input
                        id={`supplier_amount_${i}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={row.share_amount}
                        onChange={(e) => setRow(i, { share_amount: e.target.value })}
                        placeholder="0.00"
                        className="h-10 pl-7 pr-12 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      {total > 0 && amountOf(row) > 0 && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground" title="Share of the amount per cycle">
                          {pct.toFixed(pct % 1 === 0 ? 0 : 1)}%
                        </span>
                      )}
                    </div>
                  ) : (
                    <div id={`supplier_amount_${i}`} className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">
                      <span className="font-semibold tabular-nums">{total > 0 ? formatINR(total) : '—'}</span>
                      <span className="ml-auto text-xs text-muted-foreground">100%</span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 pb-0.5">
                  {multi && (
                    <Button
                      type="button" variant="ghost" size="icon" className="h-9 w-9"
                      onClick={() => fillRemaining(i)}
                      disabled={remaining <= 0.009 && amountOf(row) > 0}
                      title="Put the remaining amount on this supplier"
                      aria-label={`Assign the remaining amount to supplier ${i + 1}`}
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                    </Button>
                  )}
                  {rows.length > 1 && (
                    <Button
                      type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(i)} title="Remove supplier" aria-label={`Remove supplier ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Add supplier
        </Button>
        {multi && (
          <Button type="button" variant="ghost" size="sm" onClick={splitEqually} disabled={total <= 0}>
            <Equal className="h-4 w-4" /> Split equally
          </Button>
        )}
      </div>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </Panel>
  );
};
