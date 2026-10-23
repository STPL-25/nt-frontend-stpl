import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info, Loader2, Minus, Plus, RotateCcw, Search, Send, Truck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AssetRow, AssetSupplier, CreateAssetRequestPayload } from '@/Services/GrnService/assetApi';
import { fmtDate } from './helpers';
import { IconTile } from './badges';
import { TONE, assetIcon } from './tones';

/** What the panel was opened with: nothing (pick an item first), or a register line and a type. */
export interface RaiseIntent {
  row?: AssetRow;
  type?: 'RETURN' | 'SERVICE';
}

type Kind = 'RETURN' | 'OUTPASS' | 'INSTORE';

interface Props {
  intent: RaiseIntent | null;
  assets: AssetRow[];
  suppliers: AssetSupplier[];
  isStoreIncharge: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAssetRequestPayload) => void;
}

const KINDS: { key: Kind; title: string; hint: string; icon: React.ElementType }[] = [
  { key: 'RETURN', title: 'Return to supplier', hint: 'Faulty or not needed. Ends in a debit note.', icon: RotateCcw },
  { key: 'OUTPASS', title: 'Repair outside', hint: 'Goes to a vendor with a DC and gate pass.', icon: Truck },
  { key: 'INSTORE', title: 'Repair on site', hint: 'Technician comes in. No gate pass.', icon: Wrench },
];

const STEPS = ['Item', 'What & why', 'Review'];

const Summary: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className, children }) => (
  <div className={className}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm font-semibold">{children}</dd>
  </div>
);

const RaiseRequestSheet: React.FC<Props> = ({ intent, assets, suppliers, isStoreIncharge, saving, onClose, onSubmit }) => {
  const [step, setStep] = useState(0);
  const [row, setRow] = useState<AssetRow | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>('OUTPASS');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [supplier, setSupplier] = useState('');
  const [vendor, setVendor] = useState('');
  const [expected, setExpected] = useState('');
  const [cost, setCost] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const pickRow = (r: AssetRow) => {
    setRow(r);
    setQty(1);
    setSupplier(r.default_supplier_sno ? String(r.default_supplier_sno) : '');
  };

  // Start fresh each time the panel is opened (a new intent object).
  const [shownIntent, setShownIntent] = useState<RaiseIntent | null>(null);
  if (intent !== shownIntent) {
    setShownIntent(intent);
    if (intent) {
      setSearch(''); setReason(''); setVendor(''); setExpected(''); setCost(false); setAmount(''); setError('');
      setKind(intent.type === 'RETURN' ? 'RETURN' : 'OUTPASS');
      if (intent.row) { pickRow(intent.row); setStep(1); } else { setRow(null); setStep(0); }
    }
  }

  const choices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets
      .filter(a => a.in_use_qty > 0)
      .filter(a => !q || `${a.item_name} ${a.item_code} ${a.issue_ref} ${a.dept_name ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => a.item_name.localeCompare(b.item_name) || (a.dept_name ?? '').localeCompare(b.dept_name ?? ''))
      .slice(0, 60);
  }, [assets, search]);

  const isReturn = kind === 'RETURN';
  const supplierName = suppliers.find(s => String(s.supplier_sno) === supplier)?.company_name ?? null;

  const validate = () => {
    if (!row) return 'Choose the item first.';
    if (!qty || qty <= 0) return 'Enter a quantity greater than 0.';
    if (qty > row.in_use_qty) return `Only ${row.in_use_qty} ${row.uom} in use.`;
    if (!reason.trim()) return isReturn ? 'Enter the reason for the return.' : 'Describe what is wrong.';
    if (isReturn && !supplier) return 'Choose the supplier the item goes back to.';
    if (kind === 'OUTPASS' && !vendor.trim()) return 'Enter the repair vendor.';
    if (!isReturn && cost && !(Number(amount) > 0)) return 'Enter the estimated cost.';
    return '';
  };

  const next = () => {
    if (step === 0) { if (!row) { setError('Choose the item first.'); return; } setError(''); setStep(1); return; }
    if (step === 1) { const e = validate(); setError(e); if (!e) setStep(2); return; }
    const e = validate();
    if (e) { setError(e); setStep(1); return; }
    if (!row) return;
    onSubmit({
      request_type: isReturn ? 'RETURN' : 'SERVICE',
      sr_item_sno: row.sr_item_sno,
      qty,
      reason: reason.trim(),
      supplier_sno: supplier ? Number(supplier) : null,
      ...(isReturn ? {} : {
        service_mode: kind === 'OUTPASS' ? 'OUTPASS' : 'INSTORE',
        payment_applicable: cost ? 'Y' : 'N',
        est_amount: cost ? Number(amount) : null,
        service_vendor: vendor.trim() || undefined,
        expected_return_date: kind === 'OUTPASS' && expected ? expected : undefined,
      }),
    } as CreateAssetRequestPayload);
  };

  const back = () => { setError(''); if (step === 0) onClose(); else setStep(step - 1); };

  const route = isStoreIncharge
    ? ['Department approval', isReturn ? 'Purchase approval' : 'Service approval']
    : [isReturn ? 'Purchase approval' : 'Service approval'];
  const afterRoute = isReturn ? 'Return Order + gate pass OUT' : kind === 'OUTPASS' ? 'Store: gate pass OUT with DC' : 'Service starts on site';

  return (
    <Sheet open={!!intent} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <div className="space-y-4 border-b bg-muted/30 px-5 pb-4 pt-5 pr-12">
          <div>
            <SheetTitle className="text-lg font-semibold tracking-tight">Raise request</SheetTitle>
            <SheetDescription className="sr-only">Return an asset to its supplier or send it for service, in three steps.</SheetDescription>
          </div>
          <ol aria-label="Steps" className="flex items-center">
            {STEPS.map((s, i) => {
              const state = i < step ? 'done' : i === step ? 'current' : 'todo';
              return (
                <React.Fragment key={s}>
                  <li aria-current={i === step ? 'step' : undefined} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                        state === 'done' && 'bg-primary text-primary-foreground',
                        state === 'current' && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                        state === 'todo' && 'bg-card text-muted-foreground ring-1 ring-border',
                      )}
                    >
                      {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        'text-[13px]',
                        state === 'current' ? 'font-semibold text-foreground' : 'hidden font-medium sm:inline',
                        state === 'done' && 'text-foreground/80',
                        state === 'todo' && 'text-muted-foreground',
                      )}
                    >
                      {s}
                    </span>
                  </li>
                  {i < STEPS.length - 1 && (
                    <li role="presentation" aria-hidden="true" className={cn('mx-2 h-0.5 min-w-3 flex-1 rounded-full', i < step ? 'bg-primary' : 'bg-border')} />
                  )}
                </React.Fragment>
              );
            })}
          </ol>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {step === 0 && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="h-10 pl-9" autoFocus placeholder="Search product, issue no or department" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search items" />
              </div>
              {choices.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No issued item matches. Only Non-Regular items in use can be returned or serviced.</p>
              ) : (
                <ul role="radiogroup" aria-label="Item" className="space-y-2">
                  {choices.map(a => {
                    const active = row?.sr_item_sno === a.sr_item_sno;
                    return (
                      <li key={a.sr_item_sno}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => pickRow(a)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-all hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active && 'border-primary bg-primary/5 ring-4 ring-primary/10 hover:bg-primary/5',
                          )}
                        >
                          <IconTile icon={assetIcon(a.category, a.sub_category)} className={cn('h-10 w-10', active && 'bg-primary text-primary-foreground')} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{a.item_name}</span>
                            <span className="text-xs text-muted-foreground">{a.dept_name ?? 'Unassigned'} · {a.issue_ref} · {fmtDate(a.issue_date)}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-base font-semibold leading-none tabular-nums">{a.in_use_qty}</span>
                            <span className="text-[11px] text-muted-foreground">{a.uom} in use</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {step >= 1 && row && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <IconTile icon={assetIcon(row.category, row.sub_category)} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{row.item_name}</div>
                <div className="text-xs text-muted-foreground">{row.dept_name ?? 'Unassigned'} · {row.issue_ref} · {row.in_use_qty} {row.uom} in use</div>
              </div>
              {step === 1 && <Button variant="link" size="sm" className="px-0 text-foreground" onClick={() => setStep(0)}>Change</Button>}
            </div>
          )}

          {step === 1 && row && (
            <>
              <fieldset>
                <legend className="mb-2.5 text-sm font-medium">What needs to happen?</legend>
                <div role="radiogroup" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {KINDS.map(k => {
                    const active = kind === k.key;
                    const Icon = k.icon;
                    return (
                      <button
                        key={k.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setKind(k.key)}
                        className={cn(
                          'relative flex flex-row items-start gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-col sm:gap-2',
                          active ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'bg-card hover:border-primary/40 hover:bg-muted/40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-[13px] font-semibold">{k.title}</span>
                          <span className="text-xs leading-relaxed text-muted-foreground">{k.hint}</span>
                        </span>
                        {active && (
                          <span aria-hidden="true" className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <Label id="qty-label">Quantity</Label>
                  <div role="group" aria-labelledby="qty-label" className="flex h-10 overflow-hidden rounded-lg border bg-card">
                    <button type="button" aria-label="Decrease" className="w-10 bg-muted/60 transition-colors hover:bg-muted disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))}><Minus className="mx-auto h-4 w-4" /></button>
                    <input
                      type="number"
                      aria-label="Quantity"
                      min={1}
                      max={row.in_use_qty}
                      value={qty}
                      onChange={e => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="w-full min-w-0 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button type="button" aria-label="Increase" className="w-10 bg-muted/60 transition-colors hover:bg-muted disabled:opacity-40" disabled={qty >= row.in_use_qty} onClick={() => setQty(q => Math.min(row.in_use_qty, q + 1))}><Plus className="mx-auto h-4 w-4" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground">of {row.in_use_qty} in use</p>
                </div>
                {isReturn ? (
                  <div className="space-y-1.5">
                    <Label>Return to supplier</Label>
                    <Select value={supplier} onValueChange={setSupplier}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.supplier_sno} value={String(s.supplier_sno)}>{s.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {row.default_supplier_name && <p className="text-xs text-muted-foreground">Usual supplier: {row.default_supplier_name}</p>}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="vendor">{kind === 'OUTPASS' ? 'Repair vendor' : 'Technician / vendor on site (optional)'}</Label>
                    <Input id="vendor" value={vendor} onChange={e => setVendor(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">{isReturn ? 'Why is it going back?' : "What's wrong?"}</Label>
                <Textarea id="reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
              </div>

              {!isReturn && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {kind === 'OUTPASS' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="expected">Expected back by</Label>
                      <Input id="expected" type="date" value={expected} onChange={e => setExpected(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Marks it late on the board after this date</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="cost">Cost involved?</Label>
                    <label htmlFor="cost" className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 text-sm">
                      <span>{cost ? 'Yes — payment + repair approval' : 'No — e.g. under warranty'}</span>
                      <Switch id="cost" checked={cost} onCheckedChange={setCost} />
                    </label>
                  </div>
                  {cost && (
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Estimated cost (₹)</Label>
                      <Input id="amount" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && row && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-2xl border bg-card p-4 shadow-sm">
                <Summary label="Request">{KINDS.find(k => k.key === kind)?.title}</Summary>
                <Summary label="Quantity">{qty} {row.uom}</Summary>
                {isReturn
                  ? <Summary label="Supplier" className="col-span-2">{supplierName ?? '—'}</Summary>
                  : (
                    <>
                      <Summary label={kind === 'OUTPASS' ? 'Vendor' : 'Technician'}>{vendor || '—'}</Summary>
                      <Summary label="Cost">{cost ? `₹ ${Number(amount).toLocaleString('en-IN')}` : 'No cost'}</Summary>
                      {kind === 'OUTPASS' && <Summary label="Expected back">{fmtDate(expected || null)}</Summary>}
                    </>
                  )}
                <div className="col-span-2 border-t pt-3">
                  <dt className="text-xs text-muted-foreground">{isReturn ? 'Reason' : 'Problem'}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed">{reason}</dd>
                </div>
              </dl>

              <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">This request will go to</p>
                <ol className="flex flex-wrap items-center gap-2 text-[13px]">
                  {route.map((s, i) => (
                    <React.Fragment key={s}>
                      <li className="inline-flex items-center gap-2 rounded-full bg-primary/10 py-1 pl-1 pr-3 font-medium">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>{s}
                      </li>
                      <li aria-hidden="true" className="text-muted-foreground">→</li>
                    </React.Fragment>
                  ))}
                  <li className="inline-flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3 font-medium text-muted-foreground">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-card text-[11px] font-bold ring-1 ring-border">{route.length + 1}</span>{afterRoute}
                  </li>
                </ol>
              </div>

              <div className={cn('flex gap-2.5 rounded-xl p-3.5 text-sm ring-1 ring-inset', TONE.sky.chip)}>
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{qty} {row.uom} leaves the Assets list as soon as you submit. It comes back if the request is rejected or cancelled.</span>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-card px-5 py-3">
          <Button variant="outline" onClick={back} disabled={saving}>
            {step === 0 ? 'Cancel' : <><ArrowLeft className="h-4 w-4" /> Back</>}
          </Button>
          <Button className="shadow-sm" onClick={next} disabled={saving || (step === 0 && !row)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === 0 && <>Next <ArrowRight className="h-4 w-4" /></>}
            {step === 1 && <>Next: review <ArrowRight className="h-4 w-4" /></>}
            {step === 2 && !saving && <><Send className="h-4 w-4" /> Submit request</>}
            {step === 2 && saving && 'Submitting…'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RaiseRequestSheet;
