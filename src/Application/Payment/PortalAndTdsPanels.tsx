import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, Globe, Loader2, Receipt } from 'lucide-react';
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
  payNetPortalPay, payNetPortalPayments, payNetTdsRecords,
  type PaymentEntry, type PortalPayment, type TdsRecord,
} from '@/Services/GrnService/paymentNetApi';
import { PORTAL_MODES, paidAfterDiscount, portalProblem, rupees } from './paymentRunModel';

const th = 'text-xs';
const ymd = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');
const showDate = (d: string | null | undefined) => {
  const s = ymd(d);
  if (!s) return '—';
  const p = new Date(`${s}T00:00:00`);
  return Number.isNaN(p.getTime()) ? s : p.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Suppliers whose KYC says "pay via portal": no bank file, no run. They are approved like any payment, then paid on the supplier's
 * portal (UPI, card ...) and the transaction is recorded here: how it was paid, transaction id, date, amount and any discount.
 */
export const PortalPaymentsSection: React.FC<{ entries: PaymentEntry[]; canRecord: boolean; onRecorded: () => void; version: unknown }> = ({ entries, canRecord, onRecorded, version }) => {
  const [recorded, setRecorded] = useState<PortalPayment[]>([]);
  const [target, setTarget] = useState<PaymentEntry | null>(null);
  const [form, setForm] = useState({ mode: '', txnId: '', txnDate: today(), paid: '', discount: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const loadRecorded = useCallback(async () => {
    try {
      const res = await axios.get(payNetPortalPayments);
      setRecorded(res.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the portal payments'));
    }
  }, []);
  useEffect(() => { loadRecorded(); }, [loadRecorded, version]);

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

  if (entries.length === 0 && recorded.length === 0) return null;
  return (
    <>
      {entries.length > 0 && (
        <Panel icon={Globe} title={`Pay on supplier portals (${entries.length})`} description="These suppliers are paid on their own portal - no bank file. Pay there, then record the transaction." bodyClassName="p-0">
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
                    <TableCell className="text-xs"><span className="block font-semibold">{e.vendor_name ?? '—'}</span><span className="block text-muted-foreground">{e.payment_no}{e.invoice_nos ? ` · ${e.invoice_nos}` : ''}</span></TableCell>
                    <TableCell className="text-xs">
                      {e.payment_portal_url ? (
                        <a href={/^https?:\/\//i.test(e.payment_portal_url) ? e.payment_portal_url : `https://${e.payment_portal_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          {e.payment_portal_name || 'Open portal'}<ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (e.payment_portal_name || '—')}
                    </TableCell>
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

      {recorded.length > 0 && (
        <Panel icon={CheckCircle2} title="Paid on portals" description="Transactions recorded for portal suppliers" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className={th}>Date</TableHead><TableHead className={th}>Payment</TableHead><TableHead className={th}>Supplier</TableHead><TableHead className={th}>Mode</TableHead>
                  <TableHead className={th}>Transaction id</TableHead><TableHead className={cn(th, 'text-right')}>Paid</TableHead><TableHead className={cn(th, 'text-right')}>Discount</TableHead><TableHead className={th}>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recorded.map((r) => (
                  <TableRow key={r.txn_sno}>
                    <TableCell className="whitespace-nowrap text-xs">{showDate(r.txn_date)}</TableCell>
                    <TableCell className="text-xs font-medium">{r.payment_no}</TableCell>
                    <TableCell className="text-xs">{r.vendor_name ?? '—'}{r.portal_name && <span className="block text-muted-foreground">{r.portal_name}</span>}</TableCell>
                    <TableCell className="text-xs">{r.txn_mode}</TableCell>
                    <TableCell className="text-xs font-mono">{r.txn_id}</TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(r.amount_paid)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{Number(r.discount_amount) ? rupees(r.discount_amount) : '—'}</TableCell>
                    <TableCell className="text-xs">{r.recorded_by ?? '—'}</TableCell>
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
            <DialogDescription>{target?.vendor_name}{target?.payment_portal_name ? ` · ${target.payment_portal_name}` : ''}. Enter what the portal shows once it is paid.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Net payable</dt><dd className="font-semibold tabular-nums">{rupees(net)}</dd></div>
          </dl>
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
  const shown = useMemo(() => (q ? rows.filter((r) => [r.invoice_no, r.supplier_invoice_no, r.vendor_name, r.payment_no, r.section_code, r.deductor_name].some((v) => String(v ?? '').toLowerCase().includes(q))) : rows), [rows, q]);
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
                <TableHead className={th}>Invoice</TableHead><TableHead className={th}>Payment</TableHead><TableHead className={th}>Deductee (supplier)</TableHead>
                <TableHead className={th}>Deductor (company)</TableHead><TableHead className={th}>Section</TableHead>
                <TableHead className={cn(th, 'text-right')}>Base</TableHead><TableHead className={cn(th, 'text-right')}>Rate</TableHead><TableHead className={cn(th, 'text-right')}>TDS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.deduction_sno}>
                  <TableCell className="text-xs font-medium">{r.invoice_no ?? '—'}{r.supplier_invoice_no && <span className="block font-normal text-muted-foreground">{r.supplier_invoice_no}</span>}</TableCell>
                  <TableCell className="text-xs">{r.payment_no}<span className="block text-muted-foreground">{r.payment_status}{r.payment_date ? ` · ${showDate(r.payment_date)}` : ''}</span></TableCell>
                  <TableCell className="text-xs">{r.vendor_name ?? '—'}<span className="block text-muted-foreground">{r.vendor_pan ? `PAN ${r.vendor_pan}` : 'No PAN on file'}</span></TableCell>
                  <TableCell className="text-xs">{r.deductor_name ?? '—'}<span className="block text-muted-foreground">{r.deductor_tan ? `TAN ${r.deductor_tan}` : ''}</span></TableCell>
                  <TableCell className="text-xs" title={r.section_description ?? ''}>{r.section_code}{r.fin_year && <span className="block text-muted-foreground">FY {r.fin_year}</span>}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{rupees(r.base_deducted ?? r.base_amount)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{Number(r.rate_pct)}%</TableCell>
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
