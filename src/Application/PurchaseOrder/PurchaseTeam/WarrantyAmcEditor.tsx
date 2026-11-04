import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp, X, ShieldCheck, Wrench, Package } from 'lucide-react';
import type { AdditionalCover, AdditionalCoverType, AdditionalCostType, QuotationItem } from './types';

interface Props {
  item: QuotationItem;
  onChange: (additional: AdditionalCover[]) => void;
}

const TYPES: { type: AdditionalCoverType; label: string }[] = [
  { type: 'Warranty', label: 'Warranty' },
  { type: 'AMC', label: 'AMC' },
  { type: 'Other', label: 'Others' },
];
const COST_TYPES: AdditionalCostType[] = ['Free', 'Paid', 'Semi-paid'];

const area =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const coverName = (c: AdditionalCover) => (c.type === "Other" ? c.label || "Other" : c.type);

/** The "Additional" button; the caller owns open/closed so the panel can render elsewhere (a row below). */
export function AdditionalButton({ item, open, onToggle }: { item: QuotationItem; open: boolean; onToggle: () => void }) {
  const covers = item.additional ?? [];
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 whitespace-nowrap text-xs" onClick={onToggle} title={covers.map(coverName).join(", ")}>
      <Plus size={12} /> Additional{covers.length > 0 ? ` (${covers.length})` : ""}
      {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </Button>
  );
}

/** Button + panel together (mobile cards). */
export default function WarrantyAmcEditor({ item, onChange }: Props) {
  const [open, setOpen] = useState((item.additional?.length ?? 0) > 0);
  return (
    <div>
      <AdditionalButton item={item} open={open} onToggle={() => setOpen(o => !o)} />
      {open && <AdditionalPanel item={item} onChange={onChange} />}
    </div>
  );
}

const COVER_ICON: Record<AdditionalCoverType, typeof ShieldCheck> = { Warranty: ShieldCheck, AMC: Wrench, Other: Package };
const COST_TONE: Record<AdditionalCostType, string> = {
  Free: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  Paid: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  'Semi-paid': 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
};
const invalidField = 'border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40';

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-destructive">Required</p>}
    </div>
  );
}

export function AdditionalPanel({ item, onChange }: Props) {
  const covers = item.additional ?? [];
  const has = (t: AdditionalCoverType) => covers.some(c => c.type === t);
  const toggle = (t: AdditionalCoverType) =>
    onChange(has(t) ? covers.filter(c => c.type !== t) : [...covers, { type: t, years: "", cost_type: "Free", terms: "" }]);
  const patch = (t: AdditionalCoverType, p: Partial<AdditionalCover>) =>
    onChange(covers.map(c => (c.type === t ? { ...c, ...p } : c)));

  return (
    <div className="mt-2 space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Extra cover offered by the supplier</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(({ type, label }) => {
            const Icon = COVER_ICON[type];
            const on = has(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(type)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:border-primary/40'}`}
              >
                <Icon size={13} />{label}
              </button>
            );
          })}
        </div>
        {covers.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nothing selected — pick Warranty, AMC or Others to add terms.</p>}
      </div>

      {covers.map(c => {
        const Icon = COVER_ICON[c.type];
        const yearsBad = !(Number(c.years) > 0);
        const nameBad = c.type === 'Other' && !c.label?.trim();
        return (
          <div key={c.type} className="space-y-3 rounded-lg border bg-background p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon size={14} /></span>
                {c.type === 'Other' ? 'Others' : c.type}
              </span>
              <button type="button" onClick={() => toggle(c.type)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${c.type}`}>
                <X size={14} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {c.type === 'Other' && (
                <div className="sm:col-span-2">
                  <Field label="Name" required error={nameBad}>
                    <Input value={c.label ?? ''} onChange={(e) => patch(c.type, { label: e.target.value })} placeholder="e.g. Installation" maxLength={100} className={`h-9 text-sm ${nameBad ? invalidField : ''}`} />
                  </Field>
                </div>
              )}
              <Field label="Period (years)" required error={yearsBad}>
                <Input type="number" min={0} step={0.5} value={c.years} onChange={(e) => patch(c.type, { years: e.target.value })} placeholder="e.g. 2" className={`h-9 text-sm ${yearsBad ? invalidField : ''}`} />
              </Field>
              <Field label="Cost">
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                  {COST_TYPES.map(ct => (
                    <button
                      key={ct}
                      type="button"
                      role="radio"
                      aria-checked={c.cost_type === ct}
                      onClick={() => patch(c.type, { cost_type: ct })}
                      className={`h-9 rounded-md border text-xs font-medium transition-colors ${c.cost_type === ct ? COST_TONE[ct] : 'bg-background text-muted-foreground hover:border-primary/40'}`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Terms & conditions">
              <textarea
                value={c.terms ?? ''}
                onChange={(e) => patch(c.type, { terms: e.target.value })}
                placeholder="Coverage, exclusions, service response time… (optional)"
                maxLength={1000}
                rows={2}
                className={area}
              />
            </Field>
          </div>
        );
      })}
    </div>
  );
}
