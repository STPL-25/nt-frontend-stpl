import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, Globe, Info, Loader2, Pencil, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Panel, SearchInput } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  payNetPortalDetails, payNetPortalPay, payNetTdsRecords,
  type PaymentEntry, type TdsRecord,
} from '@/Services/GrnService/paymentNetApi';
import {
  PORTAL_MODES, paidAfterDiscount, portalAddress, portalDetailsProblem, portalDetailsUnchanged, portalDetailsUrl, portalProblem, rupees,
  type PortalDetailsForm,
} from './paymentRunModel';
import { portalUrl } from './statutoryModel';

const th = 'text-xs';
const ymd = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');
const showDate = (d: string | null | undefined) => {
  const s = ymd(d);
  if (!s) return '—';
  const p = new Date(`${s}T00:00:00`);
  return Number.isNaN(p.getTime()) ? s : p.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().slice(0, 10);
const portalHref = (e: PaymentEntry | null) => (e?.payment_portal_url?.trim() ? portalUrl(e.payment_portal_url) : '');

const hasPortalDetails = (e: PaymentEntry | null) => Boolean(e?.payment_portal_name?.trim() || e?.payment_portal_url?.trim());
const editedNote = (e: PaymentEntry | null) => (e?.portal_edited_by ? `Edited by ${e.portal_edited_by}${e.portal_edited_at ? ` · ${showDate(e.portal_edited_at)}` : ''}` : '');

/** The portal details from the supplier's KYC, in the list: name (link), address, instructions - or that KYC has none. */
const PortalCell: React.FC<{ e: PaymentEntry; onEdit?: () => void }> = ({ e, onEdit }) => {
  const href = portalHref(e);
  const name = e.payment_portal_name?.trim();
  if (!hasPortalDetails(e)) {
    return (
      <div className="space-y-1">
        <span className="block text-amber-700 dark:text-amber-300">No portal details in KYC</span>
        {onEdit && (
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onEdit} aria-label={`Add portal details for ${e.vendor_name ?? 'this supplier'}`}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add portal details
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline">
            <span className="truncate">{name || 'Open portal'}</span><ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : <span className="block font-medium">{name}</span>}
        {href
          ? <span className="block truncate text-muted-foreground" title={href}>{portalAddress(href)}</span>
          : <span className="block text-amber-700 dark:text-amber-300">No portal address in KYC</span>}
        {e.payment_instructions && <span className="line-clamp-2 whitespace-normal break-words text-muted-foreground" title={e.payment_instructions}>{e.payment_instructions}</span>}
        {e.portal_edited_by && <span className="block text-[11px] text-muted-foreground/80">{editedNote(e)}</span>}
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit portal details of ${e.vendor_name ?? 'this supplier'}`} title="Edit portal details"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

/**
 * Add / fix a portal supplier's portal details (sql/91). It writes the supplier's KYC - every payment to the supplier uses it - so
 * the dialog says so, shows the address it replaces, and the change is logged with the caller's login on the server.
 */
const PortalDetailsDialog: React.FC<{ entry: PaymentEntry | null; onClose: () => void; onSaved: () => void }> = ({ entry, onClose, onSaved }) => {
  const [form, setForm] = useState<PortalDetailsForm>({ name: '', url: '', instructions: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (entry) setForm({ name: entry.payment_portal_name ?? '', url: entry.payment_portal_url ?? '', instructions: entry.payment_instructions ?? '' });
  }, [entry]);

  const problem = portalDetailsProblem(form);
  const unchanged = entry ? portalDetailsUnchanged(form, entry) : true;
  const oldUrl = entry?.payment_portal_url?.trim() ?? '';
  const urlChanged = !!oldUrl && portalDetailsUrl(form.url) !== oldUrl;
  const adding = !hasPortalDetails(entry);

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await axios.post(payNetPortalDetails, {
        payment_sno: entry.payment_sno, payment_portal_name: form.name.trim(), payment_portal_url: portalDetailsUrl(form.url),
        payment_instructions: form.instructions.trim(),
      });
      toast.success(`Portal details saved for ${entry.vendor_name ?? 'the supplier'}`);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the portal details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={entry != null} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{adding ? 'Add portal details' : 'Edit portal details'}</DialogTitle>
          <DialogDescription>{entry?.vendor_name ?? 'Supplier'} · where and how this supplier is paid on its own portal.</DialogDescription>
        </DialogHeader>
        <p className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>This updates the supplier's KYC, so every payment to this supplier uses these details. The change is logged with your login.</span>
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pd-name" className="text-xs">Portal / website name <span className="text-destructive">*</span></Label>
            <Input id="pd-name" value={form.name} maxLength={150} onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))} className="h-10" placeholder="e.g. AWS Billing console" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-url" className="text-xs">Portal address <span className="text-destructive">*</span></Label>
            <Input id="pd-url" value={form.url} maxLength={500} inputMode="url" autoComplete="off" spellCheck={false} onChange={(ev) => setForm((f) => ({ ...f, url: ev.target.value }))} className="h-10" placeholder="https://pay.example.com" />
            {urlChanged && <p className="break-all text-xs text-amber-700 dark:text-amber-300">Replaces {portalAddress(oldUrl)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-inst" className="text-xs">Payment instructions</Label>
            <Textarea id="pd-inst" rows={4} maxLength={1000} value={form.instructions} onChange={(ev) => setForm((f) => ({ ...f, instructions: ev.target.value }))} className="resize-none text-sm" placeholder="e.g. Sign in with the accounts e-mail, open Bills, pay the invoice by Net Banking" />
            <p className="text-right text-[11px] text-muted-foreground tabular-nums">{form.instructions.trim().length}/1000</p>
          </div>
        </div>
        {problem && (form.name || form.url) && <p className="text-xs text-amber-700 dark:text-amber-300">{problem}</p>}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={saving || !!problem || unchanged} onClick={save}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Suppliers whose KYC says "pay via portal": no bank file, no run. They are approved like any payment, then paid on the supplier's
 * portal (UPI, card ...) and the transaction is recorded here: how it was paid, transaction id, date, amount and any discount.
 */
export const PortalPaymentsSection: React.FC<{
  entries: PaymentEntry[]; canRecord: boolean; onRecorded: () => void;
  /** how many are already recorded as paid on a portal - listed in Payment history */
  paidCount: number; onShowPaid: () => void;
}> = ({ entries, canRecord, onRecorded, paidCount, onShowPaid }) => {
  const [target, setTarget] = useState<PaymentEntry | null>(null);
  /** the payment whose supplier's portal details are being added / changed (sql/91) */
  const [editTarget, setEditTarget] = useState<PaymentEntry | null>(null);
  const [form, setForm] = useState({ mode: '', txnId: '', txnDate: today(), paid: '', discount: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const net = Number(target?.net_paid ?? 0);
  const problem = target ? portalProblem(net, { mode: form.mode, txnId: form.txnId, txnDate: form.txnDate, paid: form.paid, discount: form.discount }, today()) : null;

  const open = (e: PaymentEntry) => {
    setTarget(e);
    setForm({ mode: '', txnId: '', txnDate: today(), paid: String(Number(e.net_paid)), discount: '', remarks: '' });
  };

  const save = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await axios.post(payNetPortalPay, {
        payment_sno: target.payment_sno, txn_mode: form.mode, txn_id: form.txnId.trim(), txn_date: form.txnDate,
        amount_paid: Number(form.paid), discount_amount: form.discount === '' ? 0 : Number(form.discount), remarks: form.remarks.trim() || undefined,
      });
      toast.success(`${target.payment_no} recorded as paid on the portal`);
      setTarget(null);
      onRecorded();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  if (entries.length === 0) return null;
  return (
    <>
      {entries.length > 0 && (
        <Panel
          icon={Globe} title={`Pay on supplier portals (${entries.length})`} description="These suppliers are paid on their own portal - no bank file. Pay there, then record the transaction." bodyClassName="p-0"
          action={paidCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={onShowPaid}>{paidCount} paid on portal · history</Button>
          ) : undefined}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className={th}>Supplier</TableHead><TableHead className={th}>Portal</TableHead><TableHead className={th}>Due</TableHead>
                  <TableHead className={cn(th, 'text-right')}>Net payable</TableHead><TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.payment_sno}>
                    <TableCell className="text-xs"><span className="block font-semibold">{e.vendor_name ?? '—'}</span><span className="block text-muted-foreground">{e.supplier_invoice_nos ? `Invoice ${e.supplier_invoice_nos}` : 'Invoice no. not entered'}</span></TableCell>
                    <TableCell className="max-w-[18rem] text-xs"><PortalCell e={e} onEdit={canRecord ? () => setEditTarget(e) : undefined} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{showDate(e.due_date)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(e.net_paid)}</TableCell>
                    <TableCell className="text-right">
                      {canRecord && <Button type="button" size="sm" className="h-8 text-xs" onClick={() => open(e)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Record payment</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      <Dialog open={target != null} onOpenChange={(o) => { if (!o && !saving) setTarget(null); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record portal payment · {target?.payment_no}</DialogTitle>
            <DialogDescription>{target?.vendor_name}. Pay on the portal below, then enter what it shows once it is paid.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pay on</p>
                <p className="font-semibold">{target?.payment_portal_name?.trim() || 'Supplier portal'}</p>
                {portalHref(target)
                  ? <a href={portalHref(target)} target="_blank" rel="noreferrer" className="block break-all text-xs text-primary hover:underline">{portalAddress(portalHref(target))}</a>
                  : <p className="text-xs text-amber-700 dark:text-amber-300">No portal address in this supplier's KYC{canRecord ? ' - add it once you have it from the supplier.' : ' - get it from the supplier.'}</p>}
                {target?.portal_edited_by && <p className="mt-0.5 text-[11px] text-muted-foreground">{editedNote(target)}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {portalHref(target) && (
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                    <a href={portalHref(target)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open portal</a>
                  </Button>
                )}
                {canRecord && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={saving} onClick={() => { const t = target; setTarget(null); setEditTarget(t); }}>
                    {hasPortalDetails(target) ? <><Pencil className="mr-1 h-3.5 w-3.5" />Edit details</> : <><Plus className="mr-1 h-3.5 w-3.5" />Add details</>}
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment instructions</p>
              {target?.payment_instructions
                ? <p className="whitespace-pre-line break-words">{target.payment_instructions}</p>
                : <p className="text-muted-foreground">None given in KYC</p>}
            </div>
            <dl className="space-y-2 border-t pt-2">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Supplier invoice</dt><dd className="min-w-0 break-words text-right font-medium">{target?.supplier_invoice_nos || 'Not entered'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Net payable</dt><dd className="font-semibold tabular-nums">{rupees(net)}</dd></div>
            </dl>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Payment mode <span className="text-destructive">*</span></Label>
              <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                <SelectTrigger className="h-10 w-full" aria-label="Payment mode"><SelectValue placeholder="UPI, card ..." /></SelectTrigger>
                <SelectContent>{PORTAL_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-date" className="text-xs">Transaction date <span className="text-destructive">*</span></Label>
              <Input id="pt-date" type="date" max={today()} value={form.txnDate} onChange={(ev) => setForm((f) => ({ ...f, txnDate: ev.target.value }))} className="h-10" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pt-id" className="text-xs">Transaction id <span className="text-destructive">*</span></Label>
              <Input id="pt-id" autoComplete="off" value={form.txnId} onChange={(ev) => setForm((f) => ({ ...f, txnId: ev.target.value }))} className="h-10 font-mono" placeholder="Reference shown by the portal / UPI app" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-disc" className="text-xs">Discount, if any (₹)</Label>
              <Input id="pt-disc" inputMode="decimal" value={form.discount} onChange={(ev) => setForm((f) => ({ ...f, discount: ev.target.value, paid: paidAfterDiscount(net, ev.target.value) }))} className="h-10 tabular-nums" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-paid" className="text-xs">Amount paid (₹) <span className="text-destructive">*</span></Label>
              <Input id="pt-paid" inputMode="decimal" value={form.paid} onChange={(ev) => setForm((f) => ({ ...f, paid: ev.target.value }))} className="h-10 tabular-nums" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pt-rem" className="text-xs">Remarks</Label>
              <Textarea id="pt-rem" rows={2} value={form.remarks} onChange={(ev) => setForm((f) => ({ ...f, remarks: ev.target.value }))} className="resize-none text-sm" />
            </div>
          </div>
          {problem && form.txnId && <p className="text-xs text-amber-700 dark:text-amber-300">{problem}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setTarget(null)}>Cancel</Button>
            <Button type="button" disabled={saving || !!problem} onClick={save}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PortalDetailsDialog entry={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); onRecorded(); }} />
    </>
  );
};

/** One line per invoice the TDS was taken on: invoice, supplier (deductee), company and TAN (deductor), section, rate, base, amount. */
export const TdsRecordsPanel: React.FC<{ version: unknown }> = ({ version }) => {
  const [rows, setRows] = useState<TdsRecord[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let live = true;
    axios.get(payNetTdsRecords).then((r) => { if (live) setRows(r.data?.data ?? []); }).catch((err) => toast.error(getErrorMessage(err, 'Failed to load the TDS records')));
    return () => { live = false; };
  }, [version]);

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => (q ? rows.filter((r) => [r.supplier_invoice_no, r.vendor_name, r.payment_no, r.section_code, r.deductor_name].some((v) => String(v ?? '').toLowerCase().includes(q))) : rows), [rows, q]);
  const total = shown.reduce((s, r) => s + Number(r.tds_amount || 0), 0);

  return (
    <Panel icon={Receipt} title={`TDS deducted (${rows.length})`} description="TDS taken on each invoice - who deducted it, from whom, under which section" bodyClassName="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoice, supplier, payment, section…" className="max-w-md" />
        <p className="text-xs text-muted-foreground">Total TDS shown: <b className="tabular-nums text-foreground">{rupees(total)}</b></p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No TDS has been deducted yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className={th}>Supplier invoice</TableHead><TableHead className={th}>Payment</TableHead><TableHead className={th}>Deductee (supplier)</TableHead>
                <TableHead className={th}>Deductor (company)</TableHead><TableHead className={th}>Section</TableHead>
                <TableHead className={cn(th, 'text-right')}>Base</TableHead><TableHead className={cn(th, 'text-right')}>Rate</TableHead><TableHead className={cn(th, 'text-right')}>TDS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.deduction_sno}>
                  <TableCell className="text-xs font-medium">{r.supplier_invoice_no || <span className="font-normal text-muted-foreground">Not entered</span>}</TableCell>
                  <TableCell className="text-xs">{r.payment_no}<span className="block text-muted-foreground">{r.payment_status}{r.payment_date ? ` · ${showDate(r.payment_date)}` : ''}</span></TableCell>
                  <TableCell className="text-xs">{r.vendor_name ?? '—'}<span className="block text-muted-foreground">{r.vendor_pan ? `PAN ${r.vendor_pan}` : 'No PAN on file'}</span></TableCell>
                  <TableCell className="text-xs">{r.deductor_name ?? '—'}<span className="block text-muted-foreground">{r.deductor_tan ? `TAN ${r.deductor_tan}` : ''}</span></TableCell>
                  <TableCell className="text-xs" title={r.section_description ?? ''}>{r.section_code}{r.fin_year && <span className="block text-muted-foreground">FY {r.fin_year}</span>}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{rupees(r.base_deducted ?? r.base_amount)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {Number(r.rate_pct)}%
                    {r.rate_entered_by && <span className="block text-muted-foreground" title="Rate typed on the Payment screen - the login that entered it">typed by {r.rate_entered_by}{r.section_rate_pct != null ? ` (section ${Number(r.section_rate_pct)}%)` : ''}</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(r.tds_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
};
