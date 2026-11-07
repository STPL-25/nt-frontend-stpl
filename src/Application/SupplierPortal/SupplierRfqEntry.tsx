import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Ban, History, Loader2, Paperclip, Send, ClipboardList, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Callout, DetailHero, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { cn } from '@/lib/utils';
import {
  supplierAxios,
  supplierGetRfqDetail,
  supplierRespondRfq,
  supplierDeclineRfq,
  type SupplierRfqDetail,
  type SupplierRfqSubmission,
} from '@/Services/SupplierService';
import WarrantyAmcEditor from '@/Application/PurchaseOrder/PurchaseTeam/WarrantyAmcEditor';
import type { AdditionalCover, QuotationItem } from '@/Application/PurchaseOrder/PurchaseTeam/types';
import { describeCover, warrantyAmcIssue } from '@/Application/PurchaseOrder/PurchaseTeam/helpers';
import { formatDate, formatINR } from './helpers';
import { rfqBadge } from './SupplierRfqList';

const MAX_FILE_MB = 10;
const noSpin = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';
const dateTime = (v?: string | null) => (v ? `${formatDate(v.slice(0, 10))}, ${v.slice(11, 16)}` : '—');
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A priced line as it is being typed (strings, so a field can be empty). */
interface Line {
  rfq_item_sno: number;
  prod_name: string;
  specification: string;
  qty: number;
  unit_name: string;
  is_quoted: boolean;
  unit_price: string;
  discount_pct: string;
  tax_pct: string;
  delivery_days: string;
  remarks: string;
  additional: AdditionalCover[];
}

interface FormState {
  quotation_ref_no: string;
  valid_upto: string;
  payment_terms: string;
  delivery_days: string;
  remarks: string;
  freight_charges: string;
  freight_gst_pct: string;
  other_charges: string;
  other_charges_gst_pct: string;
  change_note: string;
}

const num = (s: string) => (s.trim() === '' ? 0 : Number(s) || 0);
const blankIfZero = (n: number | null | undefined) => (n ? String(n) : '');
const lineTotal = (l: Line) =>
  l.is_quoted && num(l.unit_price) > 0
    ? Math.round(l.qty * num(l.unit_price) * (1 - num(l.discount_pct) / 100) * (1 + num(l.tax_pct) / 100) * 100) / 100
    : 0;

function parseCovers(json: string | null): AdditionalCover[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function buildLines(detail: SupplierRfqDetail): Line[] {
  const quotedBefore = detail.response !== null;
  return detail.items.map((it) => ({
    rfq_item_sno: it.rfq_item_sno,
    prod_name: it.prod_name,
    specification: it.specification ?? '',
    qty: Number(it.qty),
    unit_name: it.unit_name ?? '',
    is_quoted: quotedBefore ? !!it.is_quoted : true,
    unit_price: blankIfZero(it.unit_price),
    discount_pct: blankIfZero(it.discount_pct),
    tax_pct: blankIfZero(it.tax_pct),
    delivery_days: blankIfZero(it.delivery_days),
    remarks: it.remarks ?? '',
    additional: parseCovers(it.additional_json),
  }));
}

function buildForm(detail: SupplierRfqDetail): FormState {
  const r = detail.response;
  // A reference the system generated for the last version ("RFQ-00012-V1") must not be carried into the next version.
  const ownRef = r?.quotation_ref_no && !/^RFQ-\d+-V\d+$/.test(r.quotation_ref_no) ? r.quotation_ref_no : '';
  return {
    quotation_ref_no: ownRef,
    valid_upto: r?.valid_upto ?? '',
    payment_terms: r?.payment_terms ?? '',
    delivery_days: blankIfZero(r?.delivery_days),
    remarks: r?.remarks ?? '',
    freight_charges: blankIfZero(r?.freight_charges),
    freight_gst_pct: blankIfZero(r?.freight_gst_pct),
    other_charges: blankIfZero(r?.other_charges),
    other_charges_gst_pct: blankIfZero(r?.other_charges_gst_pct),
    change_note: '',
  };
}

const Field: React.FC<{ id: string; label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }> = ({
  id, label, required, hint, className, children,
}) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}{required && <span className="text-destructive"> *</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

interface Props {
  rfq_supplier_sno: number;
  onBack: () => void;
}

/**
 * Quotation Entry: the supplier prices the requested items and submits. Every submission becomes a new version - the
 * purchase team sees them all and picks the one it takes - so the form re-opens pre-filled with the latest version and
 * asks what changed.
 */
const SupplierRfqEntry: React.FC<Props> = ({ rfq_supplier_sno, onBack }) => {
  const [detail, setDetail] = useState<SupplierRfqDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await supplierAxios.get(supplierGetRfqDetail(rfq_supplier_sno));
      const d: SupplierRfqDetail = res.data?.data;
      setDetail(d);
      setForm(buildForm(d));
      setLines(buildLines(d));
      setFile(null);
      setFormError('');
    } catch (err: any) {
      setLoadError(err?.response?.data?.error ?? 'Failed to load this request');
    } finally {
      setLoading(false);
    }
  }, [rfq_supplier_sno]);

  useEffect(() => { load(); }, [load]);

  const header = detail?.header;
  const readOnly = !header?.can_respond;
  const resubmitting = (detail?.versions.length ?? 0) > 0;

  const totals = useMemo(() => {
    const items = lines.reduce((s, l) => s + lineTotal(l), 0);
    const f = form ? Math.round(num(form.freight_charges) * (1 + num(form.freight_gst_pct) / 100) * 100) / 100 : 0;
    const o = form ? Math.round(num(form.other_charges) * (1 + num(form.other_charges_gst_pct) / 100) * 100) / 100 : 0;
    return { items, freight: f, other: o, grand: items + f + o };
  }, [lines, form]);

  const setF = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const validate = (): string => {
    if (!form) return 'The form is not ready.';
    if (!form.valid_upto) return 'Enter how long your quotation is valid (Valid until).';
    if (form.valid_upto < todayLocal()) return 'Valid until cannot be in the past.';
    const quoted = lines.filter((l) => l.is_quoted);
    if (quoted.length === 0 || quoted.every((l) => num(l.unit_price) <= 0)) return 'Quote a price for at least one item.';
    const unpriced = quoted.find((l) => num(l.unit_price) <= 0);
    if (unpriced) return `Enter a unit price for "${unpriced.prod_name}" - or untick it if you are not quoting it.`;
    const badPct = quoted.find((l) => num(l.discount_pct) < 0 || num(l.discount_pct) > 100 || num(l.tax_pct) < 0 || num(l.tax_pct) > 100);
    if (badPct) return `Discount % and GST % must be between 0 and 100 ("${badPct.prod_name}").`;
    const cover = quoted.map((l) => warrantyAmcIssue({ prod_name: l.prod_name, additional: l.additional } as unknown as QuotationItem)).find(Boolean);
    if (cover) return cover;
    if ([form.freight_charges, form.other_charges].some((v) => num(v) < 0)) return 'Freight / other charges cannot be negative.';
    if ([form.freight_gst_pct, form.other_charges_gst_pct].some((v) => num(v) < 0 || num(v) > 100)) return 'GST % on charges must be between 0 and 100.';
    if (resubmitting && !form.change_note.trim()) return 'Tell us what changed since your previous submission.';
    return '';
  };

  const handleSubmit = async () => {
    const problem = validate();
    setFormError(problem);
    if (problem || !form) return;

    const submission: SupplierRfqSubmission = {
      quotation_ref_no: form.quotation_ref_no.trim() || undefined,
      quotation_date: todayLocal(),
      valid_upto: form.valid_upto,
      currency_code: 'INR',
      payment_terms: form.payment_terms || undefined,
      delivery_days: form.delivery_days.trim() === '' ? null : num(form.delivery_days),
      remarks: form.remarks.trim() || undefined,
      change_note: form.change_note.trim() || undefined,
      freight_charges: num(form.freight_charges),
      freight_gst_pct: num(form.freight_gst_pct),
      other_charges: num(form.other_charges),
      other_charges_gst_pct: num(form.other_charges_gst_pct),
      items: lines.map((l) => ({
        rfq_item_sno: l.rfq_item_sno,
        is_quoted: l.is_quoted,
        unit_price: l.is_quoted ? num(l.unit_price) : 0,
        discount_pct: num(l.discount_pct),
        tax_pct: num(l.tax_pct),
        delivery_days: l.delivery_days.trim() === '' ? null : num(l.delivery_days),
        remarks: l.remarks.trim() || undefined,
        additional: l.is_quoted ? l.additional : [],
      })),
    };

    const body = new FormData();
    body.append('payload', JSON.stringify(submission));
    if (file) body.append('quotation_file', file);

    setSubmitting(true);
    try {
      const res = await supplierAxios.post(supplierRespondRfq(rfq_supplier_sno), body);
      toast.success(res.data?.message ?? 'Quotation submitted');
      await load();
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? 'Could not submit your quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await supplierAxios.post(supplierDeclineRfq(rfq_supplier_sno), { reason: declineReason.trim() });
      toast.success('You have declined this request');
      setDeclineOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not decline the request');
    } finally {
      setDeclining(false);
    }
  };

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`The document must be under ${MAX_FILE_MB} MB`); return; }
    if (f && !(f.type === 'application/pdf' || f.type.startsWith('image/'))) { toast.error('Upload a PDF or an image'); return; }
    setFile(f);
  };

  if (loading && !detail) {
    return <div className="flex h-60 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (loadError || !detail || !header || !form) {
    return (
      <div className="space-y-3 px-3 py-4 sm:px-5">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Back to requests</Button>
        <Callout tone="danger">{loadError || 'This request could not be found.'}</Callout>
      </div>
    );
  }

  const badge = rfqBadge({ status: header.status, can_respond: header.can_respond, current_version: header.current_version });
  const termsOptions = form.payment_terms && !detail.payment_terms.includes(form.payment_terms) ? [form.payment_terms, ...detail.payment_terms] : detail.payment_terms;

  return (
    <div className="@container">
      <div className="space-y-4 px-3 py-4 sm:px-5">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Quotation requests
        </Button>

        <DetailHero
          icon={ClipboardList}
          eyebrow="Request for quotation"
          title={header.rfq_no}
          subtitle={header.com_name ? `Requested by ${header.com_name}` : undefined}
          badges={
            <>
              <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
              <StatusPill tone={header.can_respond ? 'info' : 'neutral'}>Respond by {formatDate(header.due_date)}</StatusPill>
            </>
          }
        />

        {/* What the supplier needs to know first */}
        {header.status === 'TAKEN' && (
          <Callout tone="success" icon={PackageCheck}>
            Your quotation{header.current_version ? ` (version ${header.current_version})` : ''} has been accepted by the purchase team and is going forward. You cannot change it any more.
          </Callout>
        )}
        {header.status === 'REVISION_REQUESTED' && header.revision_note && (
          <Callout tone="warning"><b>The purchase team asked you to revise:</b> {header.revision_note}</Callout>
        )}
        {header.status === 'DECLINED' && (
          <Callout tone="danger">
            You declined this request{header.decline_reason ? `: “${header.decline_reason}”` : ''}.
            {header.can_respond ? ' If you changed your mind, you can still submit a quotation below until the due date.' : ''}
          </Callout>
        )}
        {readOnly && header.status !== 'TAKEN' && (
          <Callout tone="neutral">
            {header.rfq_status === 'X' || header.status === 'CLOSED'
              ? 'The purchase team has closed this request, so it can no longer be answered.'
              : 'The response date has passed, so this request can no longer be changed. Please contact the purchase team if you still want to quote.'}
          </Callout>
        )}
        {header.notes && (
          <Callout tone="info"><b>Note from the purchase team:</b> {header.notes}</Callout>
        )}

        {/* Quotation details */}
        <Panel icon={ClipboardList} title="Your quotation" description={resubmitting ? `Version ${header.current_version} is the latest you submitted - changes are saved as a new version.` : 'Fill in your terms and the rates below.'}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="rfq-ref" label="Your quotation reference" hint={`Optional - your own quotation number. Blank = ${header.rfq_no}-V${(header.current_version ?? 0) + 1}.`}>
              <Input id="rfq-ref" value={form.quotation_ref_no} onChange={(e) => setF({ quotation_ref_no: e.target.value })} maxLength={50} disabled={readOnly} className="h-9" />
            </Field>
            <Field id="rfq-valid" label="Valid until" required>
              <Input id="rfq-valid" type="date" min={todayLocal()} value={form.valid_upto} onChange={(e) => setF({ valid_upto: e.target.value })} disabled={readOnly} className="h-9" />
            </Field>
            <Field id="rfq-terms" label="Payment terms">
              <select id="rfq-terms" className={selectCls} value={form.payment_terms} onChange={(e) => setF({ payment_terms: e.target.value })} disabled={readOnly}>
                <option value="">Select…</option>
                {termsOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field id="rfq-days" label="Delivery within (days)">
              <Input id="rfq-days" type="number" inputMode="numeric" min={0} value={form.delivery_days} onChange={(e) => setF({ delivery_days: e.target.value })} disabled={readOnly} className={cn('h-9', noSpin)} />
            </Field>
            <Field id="rfq-remarks" label="Remarks" className="sm:col-span-2">
              <Input id="rfq-remarks" value={form.remarks} onChange={(e) => setF({ remarks: e.target.value })} maxLength={200} disabled={readOnly} className="h-9" placeholder="Anything the buyer should know" />
            </Field>
          </div>
        </Panel>

        {/* Items */}
        <Panel icon={PackageCheck} title={`Items (${lines.length})`} description="Untick an item you are not quoting. Price is per unit, before discount and GST.">
          <div className="space-y-3">
            {lines.map((l, i) => {
              const total = lineTotal(l);
              const amber = l.is_quoted && num(l.unit_price) <= 0;
              return (
                <div key={l.rfq_item_sno} className={cn('rounded-lg border bg-card p-3', !l.is_quoted && 'bg-muted/30 opacity-70')}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      aria-label={`Quote ${l.prod_name}`}
                      checked={l.is_quoted}
                      disabled={readOnly}
                      onChange={(e) => setLine(i, { is_quoted: e.target.checked })}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-tight">{i + 1}. {l.prod_name}</p>
                      {l.specification && <p className="mt-0.5 break-words text-xs text-muted-foreground">{l.specification}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">Quantity: <b className="text-foreground">{l.qty} {l.unit_name}</b></p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Line total</p>
                      <p className="text-sm font-bold tabular-nums">{l.is_quoted ? formatINR(total) : '—'}</p>
                    </div>
                  </div>

                  {l.is_quoted && (
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                      <Field id={`up-${i}`} label="Unit price (₹)" required>
                        <Input id={`up-${i}`} type="number" inputMode="decimal" min={0} step="0.01" value={l.unit_price} disabled={readOnly}
                          onChange={(e) => setLine(i, { unit_price: e.target.value })} placeholder="0.00"
                          className={cn('h-9 text-right', noSpin, amber && 'border-amber-400 bg-amber-50')} />
                      </Field>
                      <Field id={`dc-${i}`} label="Discount %">
                        <Input id={`dc-${i}`} type="number" inputMode="decimal" min={0} max={100} step="0.5" value={l.discount_pct} disabled={readOnly}
                          onChange={(e) => setLine(i, { discount_pct: e.target.value })} placeholder="0" className={cn('h-9 text-right', noSpin)} />
                      </Field>
                      <Field id={`gst-${i}`} label="GST %">
                        <Input id={`gst-${i}`} type="number" inputMode="decimal" min={0} max={100} step="0.5" value={l.tax_pct} disabled={readOnly}
                          onChange={(e) => setLine(i, { tax_pct: e.target.value })} placeholder="0" className={cn('h-9 text-right', noSpin)} />
                      </Field>
                      <Field id={`dd-${i}`} label="Delivery (days)">
                        <Input id={`dd-${i}`} type="number" inputMode="numeric" min={0} value={l.delivery_days} disabled={readOnly}
                          onChange={(e) => setLine(i, { delivery_days: e.target.value })} placeholder="0" className={cn('h-9 text-right', noSpin)} />
                      </Field>
                      <Field id={`rm-${i}`} label="Line remarks" className="col-span-2 md:col-span-1">
                        <Input id={`rm-${i}`} value={l.remarks} disabled={readOnly} maxLength={200}
                          onChange={(e) => setLine(i, { remarks: e.target.value })} className="h-9" />
                      </Field>
                    </div>
                  )}

                  {l.is_quoted && !readOnly && (
                    <div className="mt-3">
                      <WarrantyAmcEditor
                        item={{ prod_name: l.prod_name, additional: l.additional } as unknown as QuotationItem}
                        onChange={(additional) => setLine(i, { additional })}
                      />
                    </div>
                  )}
                  {l.is_quoted && readOnly && l.additional.length > 0 && (
                    <p className="mt-2 text-xs text-blue-700">{l.additional.map(describeCover).join(' | ')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Charges, document, totals */}
        <Panel icon={Paperclip} title="Charges & document">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="fr" label="Freight (₹)">
              <Input id="fr" type="number" inputMode="decimal" min={0} step="0.01" value={form.freight_charges} disabled={readOnly}
                onChange={(e) => setF({ freight_charges: e.target.value })} placeholder="0.00" className={cn('h-9 text-right', noSpin)} />
            </Field>
            <Field id="frg" label="GST on freight %">
              <Input id="frg" type="number" inputMode="decimal" min={0} max={100} step="0.5" value={form.freight_gst_pct} disabled={readOnly}
                onChange={(e) => setF({ freight_gst_pct: e.target.value })} placeholder="0" className={cn('h-9 text-right', noSpin)} />
            </Field>
            <Field id="oc" label="Other charges (₹)">
              <Input id="oc" type="number" inputMode="decimal" min={0} step="0.01" value={form.other_charges} disabled={readOnly}
                onChange={(e) => setF({ other_charges: e.target.value })} placeholder="0.00" className={cn('h-9 text-right', noSpin)} />
            </Field>
            <Field id="ocg" label="GST on other charges %">
              <Input id="ocg" type="number" inputMode="decimal" min={0} max={100} step="0.5" value={form.other_charges_gst_pct} disabled={readOnly}
                onChange={(e) => setF({ other_charges_gst_pct: e.target.value })} placeholder="0" className={cn('h-9 text-right', noSpin)} />
            </Field>
          </div>

          {!readOnly && (
            <Field id="rfq-file" label="Quotation document" hint={`PDF or image, up to ${MAX_FILE_MB} MB. Optional${detail.response?.quotation_file ? ' - your earlier document is kept unless you upload a new one' : ''}.`} className="mt-4">
              <Input id="rfq-file" type="file" accept="application/pdf,image/*" className="h-9 cursor-pointer" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}
            </Field>
          )}

          <div className="ml-auto mt-5 w-full max-w-sm space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Items (incl. GST)</span><span className="tabular-nums">{formatINR(totals.items)}</span></div>
            {totals.freight > 0 && <div className="flex justify-between text-muted-foreground"><span>Freight (incl. GST)</span><span className="tabular-nums">{formatINR(totals.freight)}</span></div>}
            {totals.other > 0 && <div className="flex justify-between text-muted-foreground"><span>Other charges (incl. GST)</span><span className="tabular-nums">{formatINR(totals.other)}</span></div>}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold"><span>Grand total</span><span className="tabular-nums text-primary">{formatINR(totals.grand)}</span></div>
          </div>
        </Panel>

        {/* Submit */}
        {!readOnly && (
          <Panel icon={Send} title={resubmitting ? `Submit version ${(header.current_version ?? 0) + 1}` : 'Submit your quotation'}>
            {resubmitting && (
              <Field id="rfq-change" label="What changed?" required hint="The purchase team sees this note next to the new version." className="mb-4">
                <Textarea id="rfq-change" rows={2} maxLength={500} value={form.change_note} onChange={(e) => setF({ change_note: e.target.value })} placeholder="e.g. Reduced the rate of item 2 by 2% as discussed" />
              </Field>
            )}
            {formError && <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => { setDeclineReason(''); setDeclineOpen(true); }} disabled={submitting}>
                <Ban className="h-4 w-4" /> Not able to quote
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                {resubmitting ? `Submit revised quotation (v${(header.current_version ?? 0) + 1})` : 'Submit quotation'}
              </Button>
            </div>
          </Panel>
        )}

        {/* History */}
        {detail.versions.length > 0 && (
          <Panel icon={History} title={`Your submissions (${detail.versions.length})`} bodyClassName="p-0 sm:p-0">
            <ul className="divide-y">
              {detail.versions.map((v) => (
                <li key={v.version_no} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:px-5">
                  <span className="font-semibold">Version {v.version_no}</span>
                  <span className="tabular-nums">{formatINR(v.grand_total)}</span>
                  <span className="text-xs text-muted-foreground">{dateTime(v.submitted_at)}</span>
                  <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">{v.change_note ? `“${v.change_note}”` : v.version_no === 1 ? 'First submission' : ''}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

      </div>

      <Dialog open={declineOpen} onOpenChange={(v) => { if (!declining) setDeclineOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this request?</DialogTitle>
            <DialogDescription>Let the purchase team know why you cannot quote.{resubmitting ? ' Your earlier submission stays on record but will not be considered.' : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="decline-reason" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason <span className="text-destructive">*</span></label>
            <Textarea id="decline-reason" rows={3} maxLength={500} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="e.g. We do not stock this item" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={declining}>Back</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={declining || !declineReason.trim()}>
              {declining && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierRfqEntry;
