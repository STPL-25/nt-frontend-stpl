import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, FileText, History, Loader2, ShieldCheck, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Callout, Fact, FactGrid, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { purchaseTeamGetRfqResponses, purchaseTeamTakeRfqResponse } from '@/Services/Api';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Rfq, RfqSupplier, RfqResponseVersion, RfqLogEntry } from './types';
import { describeCover, formatDate, formatINR } from './helpers';

const unwrap = (res: any) => res?.data?.decrypted?.data ?? res?.data?.data;
const fmtDateTime = (v?: string | null) => (v ? `${formatDate(v.slice(0, 10))}, ${v.slice(11, 16)}` : '—');

const LOG_LABEL: Record<string, string> = {
  CREATED: 'RFQ raised', EMAILED: 'Request e-mailed', REMINDED: 'Reminder e-mailed', REVISION_EMAILED: 'Revision request e-mailed',
  EMAIL_FAILED: 'E-mail not sent', VIEWED: 'Supplier opened the request', SUBMITTED: 'Quotation submitted',
  REVISION_REQUESTED: 'Revision requested', DECLINED: 'Supplier declined', TAKEN: 'Taken as final quotation', CLOSED: 'RFQ cancelled',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfq: Rfq | null;
  supplier: RfqSupplier | null;
  /** Buyer may take a version as the final quotation (create permission on the Purchase screen). */
  canTake: boolean;
  /** Called after a version was taken (parent refreshes the RFQ list + the quotation list). */
  onTaken: () => void;
}

/**
 * Every version a supplier submitted for one RFQ, newest first, with what changed against the version before it, and the
 * button that takes ONE version as the final supplier quotation (goes into the normal quotation list / PO approval).
 */
const RfqResponseDialog: React.FC<Props> = ({ open, onOpenChange, rfq, supplier, canTake, onTaken }) => {
  const [versions, setVersions] = useState<RfqResponseVersion[]>([]);
  const [log, setLog] = useState<RfqLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [taking, setTaking] = useState(false);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (!open || !supplier) return;
    let cancelled = false;
    setLoading(true);
    setConfirming(false);
    setShowLog(false);
    axios
      .get(purchaseTeamGetRfqResponses(supplier.rfq_supplier_sno), { withCredentials: true })
      .then((res) => {
        if (cancelled) return;
        const data = unwrap(res) ?? { versions: [], log: [] };
        setVersions(data.versions ?? []);
        setLog(data.log ?? []);
        setSelected((data.versions ?? [])[0]?.rfq_response_sno ?? null);
      })
      .catch((err) => { if (!cancelled) toast.error(getErrorMessage(err, 'Failed to load the supplier responses')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, supplier]);

  const current = versions.find((v) => v.rfq_response_sno === selected) ?? null;
  const previous = useMemo(
    () => (current ? versions.find((v) => v.version_no === current.version_no - 1) ?? null : null),
    [versions, current],
  );
  const priceBefore = (rfqItemSno: number) => previous?.items.find((i) => i.rfq_item_sno === rfqItemSno);

  const canTakeNow = canTake && rfq?.status === 'O' && supplier?.status === 'SUBMITTED' && !!current;

  const openDocument = async (url: string) => {
    try {
      const res = await axios.get(url, { responseType: 'blob', withCredentials: true });
      window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
    } catch {
      toast.error('Could not open the document');
    }
  };

  const handleTake = async () => {
    if (!current || !rfq) return;
    setTaking(true);
    try {
      await axios.post(purchaseTeamTakeRfqResponse, { rfq_response_sno: current.rfq_response_sno, pr_basic_sno: rfq.pr_basic_sno }, { withCredentials: true });
      toast.success(`Version ${current.version_no} taken as the final quotation. It is now in the quotation list.`);
      onTaken();
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not take this quotation'));
    } finally {
      setTaking(false);
      setConfirming(false);
    }
  };

  const th = 'whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Layers size={18} className="text-primary" />
            {supplier?.company_name}
            <span className="text-sm font-normal text-muted-foreground">· {rfq?.rfq_no}</span>
          </DialogTitle>
          <DialogDescription>
            {versions.length > 0
              ? `${versions.length} version${versions.length === 1 ? '' : 's'} submitted - take the one you want as the final quotation.`
              : 'This supplier has not submitted a quotation yet.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
          ) : (
            <>
              {supplier?.status === 'TAKEN' && (
                <Callout tone="success" icon={CheckCircle2}>
                  A version of this supplier's quotation has already been taken as the final quotation (quotation #{supplier.taken_sq_basic_sno}). It is in the quotation list and goes through PO approval.
                </Callout>
              )}
              {supplier?.status === 'REVISION_REQUESTED' && (
                <Callout tone="warning">Waiting for the supplier's revised quotation: “{supplier.revision_note}”. You can take a version once they submit again.</Callout>
              )}
              {supplier?.status === 'DECLINED' && (
                <Callout tone="danger">The supplier declined to quote: “{supplier.decline_reason}”.</Callout>
              )}

              {versions.length > 0 && (
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Quotation versions">
                  {versions.map((v) => (
                    <button
                      key={v.rfq_response_sno}
                      type="button"
                      role="tab"
                      aria-selected={v.rfq_response_sno === selected}
                      onClick={() => { setSelected(v.rfq_response_sno); setConfirming(false); }}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                        v.rfq_response_sno === selected ? 'border-primary bg-primary/10' : 'bg-card hover:border-primary/40',
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        Version {v.version_no}
                        {v.is_current === 'Y' && <StatusPill tone="info">Latest</StatusPill>}
                        {v.is_taken && <StatusPill tone="success">Taken</StatusPill>}
                      </span>
                      <span className="mt-0.5 block tabular-nums">{formatINR(v.grand_total)}</span>
                      <span className="block text-muted-foreground">{fmtDateTime(v.submitted_at)}</span>
                    </button>
                  ))}
                </div>
              )}

              {current && (
                <>
                  {current.change_note && (
                    <Callout tone="primary">What the supplier says changed in version {current.version_no}: “{current.change_note}”</Callout>
                  )}

                  <FactGrid>
                    <Fact label="Quotation ref">{current.quotation_ref_no || '—'}</Fact>
                    <Fact label="Quotation date">{formatDate(current.quotation_date ?? undefined)}</Fact>
                    <Fact label="Valid until">{formatDate(current.valid_upto ?? undefined)}</Fact>
                    <Fact label="Payment terms">{current.payment_terms || '—'}</Fact>
                    <Fact label="Delivery">{current.delivery_days != null ? `${current.delivery_days} day${current.delivery_days === 1 ? '' : 's'}` : '—'}</Fact>
                    <Fact label="Submitted by">{current.submitted_by || '—'}</Fact>
                  </FactGrid>
                  {current.remarks && <p className="whitespace-pre-line text-sm text-muted-foreground [overflow-wrap:anywhere]">Remarks: {current.remarks}</p>}
                  {current.quotation_file && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => openDocument(current.quotation_file!)}>
                      <FileText size={14} /> View supplier's document
                    </Button>
                  )}

                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className={th}>#</TableHead>
                          <TableHead className={th}>Product</TableHead>
                          <TableHead className={cn(th, 'text-right')}>Qty</TableHead>
                          <TableHead className={cn(th, 'text-right')}>Unit price</TableHead>
                          <TableHead className={cn(th, 'text-right')}>Disc %</TableHead>
                          <TableHead className={cn(th, 'text-right')}>GST %</TableHead>
                          <TableHead className={cn(th, 'text-right')}>Delivery</TableHead>
                          <TableHead className={cn(th, 'text-right')}>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {current.items.map((it, idx) => {
                          const before = priceBefore(it.rfq_item_sno);
                          const changed = !!before && before.is_quoted && it.is_quoted && Number(before.unit_price) !== Number(it.unit_price);
                          return (
                            <React.Fragment key={it.rfq_item_sno}>
                              <TableRow className={it.is_quoted ? '' : 'opacity-50'}>
                                <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="text-sm font-medium">
                                  {it.prod_name}
                                  {it.specification ? <span className="block text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">{it.specification}</span> : null}
                                  {it.remarks ? <span className="block text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">Note: {it.remarks}</span> : null}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{it.qty} {it.unit_name}</TableCell>
                                {it.is_quoted ? (
                                  <>
                                    <TableCell className="text-right text-sm tabular-nums">
                                      {formatINR(it.unit_price)}
                                      {changed && <span className="block text-[11px] text-muted-foreground">was {formatINR(before!.unit_price)}</span>}
                                    </TableCell>
                                    <TableCell className="text-right text-sm tabular-nums">{it.discount_pct}%</TableCell>
                                    <TableCell className="text-right text-sm tabular-nums">{it.tax_pct}%</TableCell>
                                    <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{it.delivery_days != null ? `${it.delivery_days} d` : '—'}</TableCell>
                                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatINR(it.total_amount)}</TableCell>
                                  </>
                                ) : (
                                  <TableCell colSpan={5} className="text-right text-xs italic text-muted-foreground">Not quoted by the supplier</TableCell>
                                )}
                              </TableRow>
                              {(it.additional?.length ?? 0) > 0 && (
                                <TableRow>
                                  <TableCell />
                                  <TableCell colSpan={7} className="whitespace-normal pb-2 pt-0 text-[11px] text-blue-700">
                                    <div className="w-0 min-w-full whitespace-pre-line [overflow-wrap:anywhere]">
                                      <ShieldCheck size={11} className="mr-1 inline" />
                                      {it.additional!.map(describeCover).join(' | ')}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Items total (incl. GST)</span><span className="tabular-nums">{formatINR(current.items_total)}</span></div>
                    {Number(current.freight_charges) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Freight{Number(current.freight_gst_pct) > 0 ? ` + ${current.freight_gst_pct}% GST` : ''}</span>
                        <span className="tabular-nums">{formatINR(Number(current.freight_charges) * (1 + Number(current.freight_gst_pct) / 100))}</span>
                      </div>
                    )}
                    {Number(current.other_charges) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Other charges{Number(current.other_charges_gst_pct) > 0 ? ` + ${current.other_charges_gst_pct}% GST` : ''}</span>
                        <span className="tabular-nums">{formatINR(Number(current.other_charges) * (1 + Number(current.other_charges_gst_pct) / 100))}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Grand total</span><span className="tabular-nums">{formatINR(current.grand_total)}</span></div>
                    {previous && (
                      <p className={cn('text-right text-xs', Number(current.grand_total) < Number(previous.grand_total) ? 'text-emerald-700' : 'text-amber-700')}>
                        {Number(current.grand_total) === Number(previous.grand_total)
                          ? `Same total as version ${previous.version_no}`
                          : `${formatINR(Math.abs(Number(current.grand_total) - Number(previous.grand_total)))} ${Number(current.grand_total) < Number(previous.grand_total) ? 'lower' : 'higher'} than version ${previous.version_no}`}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Activity */}
              {log.length > 0 && (
                <div className="rounded-lg border">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setShowLog((s) => !s)}>
                    <History size={13} /> Activity ({log.length}) <span className="ml-auto">{showLog ? 'Hide' : 'Show'}</span>
                  </button>
                  {showLog && (
                    <ul className="divide-y border-t">
                      {log.map((l) => (
                        <li key={l.log_sno} className="flex flex-wrap items-baseline gap-x-3 px-3 py-1.5 text-xs">
                          <span className="font-medium">{LOG_LABEL[l.event_type] ?? l.event_type}</span>
                          {l.event_note && <span className="min-w-0 flex-1 break-words text-muted-foreground">{l.event_note}</span>}
                          <span className="ml-auto whitespace-nowrap text-muted-foreground">{fmtDateTime(l.event_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {canTakeNow && current && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
            {confirming ? (
              <>
                <span className="mr-auto text-sm">
                  Create the supplier quotation from <b>version {current.version_no}</b> ({formatINR(current.grand_total)})?
                </span>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={taking}>Not yet</Button>
                <Button onClick={handleTake} disabled={taking}>
                  {taking && <Loader2 size={16} className="mr-1 animate-spin" />} Yes, take it
                </Button>
              </>
            ) : (
              <Button onClick={() => setConfirming(true)}>
                <CheckCircle2 size={16} className="mr-1" /> Take version {current.version_no} as final quotation
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RfqResponseDialog;
