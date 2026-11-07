import React, { useEffect, useMemo, useState } from 'react';
import { Send, Loader2, X, MailCheck, MailWarning, ClipboardList, Users, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Callout, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { getErrorMessage } from '@/lib/errors';
import type { Vendor, QuotationItem, RfqSupplierContact, RfqEmailResult } from './types';

export const vendorSnoOf = (v: Vendor) => (v.kyc_basic_info_sno ?? v.vendor_sno) as number;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => isoLocal(new Date(Date.now() + n * 864e5));

export interface RfqSendBody {
  vendor_snos: number[];
  items: QuotationItem[];
  response_due_date: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. the PR number, shown in the title. */
  prLabel: string;
  /** e.g. "Group 2" when the RFQ is for one split group of the PR. */
  groupLabel?: string;
  /** Suppliers ticked on the Purchase screen. */
  vendors: Vendor[];
  contacts: Record<number, RfqSupplierContact>;
  /** The lines of the PR (or split group) the suppliers are asked to price. */
  items: QuotationItem[];
  onSend: (body: RfqSendBody) => Promise<{ rfq_no: string; emails: RfqEmailResult[] }>;
}

/**
 * Compose + send a Request For Quotation to several suppliers at once. Each supplier is e-mailed to log in to the
 * supplier portal and give the quotation there; the answers are kept (as versions) in the RFQ tables.
 */
const RfqSendDialog: React.FC<Props> = ({ open, onOpenChange, prLabel, groupLabel, vendors, contacts, items, onSend }) => {
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [dueDate, setDueDate] = useState(inDays(7));
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ rfq_no: string; emails: RfqEmailResult[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setRemoved(new Set());
    setPicked(new Set(items.map((_, i) => i)));
    setDueDate(inDays(7));
    setNotes('');
    setSending(false);
    setError('');
    setResult(null);
  }, [open, items]);

  const chosen = useMemo(() => vendors.filter((v) => !removed.has(vendorSnoOf(v))), [vendors, removed]);
  const noLogin = chosen.filter((v) => contacts[vendorSnoOf(v)] && !contacts[vendorSnoOf(v)].has_login);
  const canSend = chosen.length > 0 && picked.size > 0 && !!dueDate && !sending;

  const handleSend = async () => {
    setError('');
    if (dueDate < inDays(0)) { setError('The response due date cannot be in the past.'); return; }
    setSending(true);
    try {
      const res = await onSend({
        vendor_snos: chosen.map(vendorSnoOf),
        items: items.filter((_, i) => picked.has(i)),
        response_due_date: dueDate,
        notes: notes.trim(),
      });
      setResult(res);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Could not send the request for quotation'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            {result ? `Request sent - ${result.rfq_no}` : 'Request for quotation'}
          </DialogTitle>
          <DialogDescription>
            {result
              ? 'Here is how the e-mails went. Suppliers answer in the supplier portal; you review their quotations on this screen.'
              : `${prLabel}${groupLabel ? ` · ${groupLabel}` : ''} - suppliers are e-mailed to log in to the supplier portal and give their quotation.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="divide-y rounded-lg border">
              {result.emails.map((m) => (
                <div key={m.rfq_supplier_sno} className="flex items-start gap-3 px-3 py-2.5">
                  {m.sent
                    ? <MailCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    : <MailWarning size={16} className="mt-0.5 shrink-0 text-amber-600" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.company_name}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {m.sent ? `E-mailed to ${m.email_to}` : m.error ?? 'The e-mail was not sent'}
                    </p>
                  </div>
                  <StatusPill tone={m.sent ? 'success' : 'warning'}>{m.sent ? 'Sent' : 'Not sent'}</StatusPill>
                </div>
              ))}
            </div>
            {result.emails.some((m) => !m.sent) && (
              <Callout tone="warning">
                The request is saved for every supplier. For the ones marked "Not sent", fix the reason shown and use <b>Resend</b> in the RFQ list.
              </Callout>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            {/* Suppliers */}
            <section className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users size={13} /> Suppliers ({chosen.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {chosen.map((v) => {
                  const sno = vendorSnoOf(v);
                  const c = contacts[sno];
                  return (
                    <span key={sno} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-3 pr-1.5 text-xs font-medium">
                      {v.company_name ?? v.vendor_name}
                      {c && !c.has_login && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">no portal login</span>}
                      <button
                        type="button"
                        aria-label={`Remove ${v.company_name ?? v.vendor_name}`}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => setRemoved((prev) => new Set(prev).add(sno))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                {chosen.length === 0 && <p className="text-xs text-destructive">Select at least one supplier.</p>}
              </div>
              {noLogin.length > 0 && (
                <Callout tone="warning">
                  {noLogin.map((v) => v.company_name ?? v.vendor_name).join(', ')} {noLogin.length === 1 ? 'has' : 'have'} no supplier-portal login yet, so
                  {noLogin.length === 1 ? ' it' : ' they'} cannot answer. The request is still saved, but no e-mail goes out until you send a portal invite from the KYC screen and use Resend.
                </Callout>
              )}
            </section>

            {/* Items */}
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Items to quote ({picked.size} of {items.length})
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-8">
                        <input
                          type="checkbox"
                          aria-label="Select all items"
                          checked={picked.size === items.length && items.length > 0}
                          onChange={(e) => setPicked(e.target.checked ? new Set(items.map((_, i) => i)) : new Set())}
                        />
                      </TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Specification</TableHead>
                      <TableHead className="text-right text-xs">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, i) => (
                      <TableRow key={i} className={picked.has(i) ? '' : 'opacity-40'}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Include ${it.prod_name}`}
                            checked={picked.has(i)}
                            onChange={() => setPicked((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{it.prod_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{it.specification || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{it.qty} {it.unit_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Due date + note */}
            <section className="grid gap-4 sm:grid-cols-[14rem_1fr]">
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="rfq-due"className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarClock size={13} /> Respond by <span className="text-destructive">*</span>
                </label>
                <Input id="rfq-due" type="date" min={inDays(0)} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
                <p className="text-[11px] text-muted-foreground">Suppliers can submit - and re-submit - until this date.</p>
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="rfq-note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note to suppliers (optional)</label>
                {/* The shared Textarea sizes itself to its content (field-sizing), so without min-w-0 / max-w-full a long
                    line widens the grid column and the dialog scrolls sideways. Wrap downward and scroll inside instead. */}
                <Textarea
                  id="rfq-note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="max-h-48 min-w-0 max-w-full overflow-y-auto [overflow-wrap:anywhere]"
                  placeholder="Delivery location, brand preference, packing, anything the supplier should know…"
                />
              </div>
            </section>

            {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="border-t px-4 py-3 sm:px-6">
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSend} disabled={!canSend}>
                {sending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Send size={16} className="mr-1" />}
                Send to {chosen.length} supplier{chosen.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RfqSendDialog;
