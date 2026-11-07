import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, ClipboardList, Eye, Loader2, MailCheck, MailWarning, RefreshCw, RotateCcw, Send, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Callout, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { purchaseTeamCloseRfq, purchaseTeamRequestRfqRevision, purchaseTeamResendRfqEmail } from '@/Services/Api';
import { getErrorMessage } from '@/lib/errors';
import type { Rfq, RfqSupplier, RfqSupplierStatus } from './types';
import { formatDate, formatINR } from './helpers';

const unwrap = (res: any) => res?.data?.decrypted?.data ?? res?.data?.data;
const fmtDateTime = (v?: string | null) => (v ? `${formatDate(v.slice(0, 10))}, ${v.slice(11, 16)}` : '—');
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => isoLocal(new Date(Date.now() + n * 864e5));

const STATUS: Record<RfqSupplierStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Awaiting supplier', tone: 'neutral' },
  VIEWED: { label: 'Viewed', tone: 'info' },
  SUBMITTED: { label: 'Quoted', tone: 'success' },
  REVISION_REQUESTED: { label: 'Revision requested', tone: 'warning' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  TAKEN: { label: 'Taken as final', tone: 'primary' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
};

interface Props {
  rfqs: Rfq[];
  loading: boolean;
  onRefresh: () => void;
  /** Buyer may send / resend / ask for revisions / cancel (create permission on the Purchase screen). */
  canAct: boolean;
  onViewResponses: (rfq: Rfq, supplier: RfqSupplier) => void;
}

const EmailCell: React.FC<{ s: RfqSupplier }> = ({ s }) => {
  if (!s.has_login) {
    return <span className="inline-flex items-center gap-1 text-xs text-amber-700" title="No supplier-portal login yet - send an invite from the KYC screen"><MailWarning size={13} /> No portal login</span>;
  }
  if (s.email_sent === 'Y') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title={s.email_to ?? ''}>
        <MailCheck size={13} /> Sent{s.email_count > 1 ? ` ×${s.email_count}` : ''}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 text-xs text-amber-700" title={s.email_error ?? ''}><MailWarning size={13} /> Not sent</span>;
};

/** The RFQs raised for this PR with where every invited supplier stands. */
const RfqPanel: React.FC<Props> = ({ rfqs, loading, onRefresh, canAct, onViewResponses }) => {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [resending, setResending] = useState<number | null>(null);

  const [revision, setRevision] = useState<{ rfq: Rfq; supplier: RfqSupplier } | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [revisionDue, setRevisionDue] = useState('');
  const [revisionBusy, setRevisionBusy] = useState(false);

  const [cancelRfq, setCancelRfq] = useState<Rfq | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const summary = useMemo(() => {
    const all = rfqs.flatMap((r) => r.suppliers);
    return {
      quoted: all.filter((s) => ['SUBMITTED', 'TAKEN', 'REVISION_REQUESTED'].includes(s.status) && s.response_count > 0).length,
      total: all.length,
    };
  }, [rfqs]);

  const isOpen = (r: Rfq) => (openIds.has(r.rfq_sno) ? !(r.status === 'O') : r.status === 'O');
  const toggle = (r: Rfq) => setOpenIds((prev) => { const n = new Set(prev); if (n.has(r.rfq_sno)) n.delete(r.rfq_sno); else n.add(r.rfq_sno); return n; });

  const handleResend = async (s: RfqSupplier) => {
    setResending(s.rfq_supplier_sno);
    try {
      const res = await axios.post(purchaseTeamResendRfqEmail, { rfq_supplier_sno: s.rfq_supplier_sno }, { withCredentials: true });
      const email = unwrap(res)?.email;
      if (email?.sent) toast.success(`E-mail sent to ${email.email_to}`);
      else toast.warning(email?.error ?? 'The e-mail was not sent');
      onRefresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not resend the e-mail'));
    } finally {
      setResending(null);
    }
  };

  const openRevision = (rfq: Rfq, supplier: RfqSupplier) => {
    setRevision({ rfq, supplier });
    setRevisionNote('');
    const keep = supplier.due_date && supplier.due_date >= inDays(0) ? supplier.due_date : inDays(3);
    setRevisionDue(keep);
  };

  const submitRevision = async () => {
    if (!revision) return;
    setRevisionBusy(true);
    try {
      const res = await axios.post(
        purchaseTeamRequestRfqRevision,
        { rfq_supplier_sno: revision.supplier.rfq_supplier_sno, note: revisionNote.trim(), response_due_date: revisionDue },
        { withCredentials: true },
      );
      const email = unwrap(res)?.email;
      if (email?.sent) toast.success(`${revision.supplier.company_name} has been asked to revise its quotation`);
      else toast.warning(`Revision requested, but the e-mail was not sent: ${email?.error ?? 'unknown reason'}`);
      setRevision(null);
      onRefresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not request a revision'));
    } finally {
      setRevisionBusy(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelRfq) return;
    setCancelBusy(true);
    try {
      await axios.post(purchaseTeamCloseRfq, { rfq_sno: cancelRfq.rfq_sno, reason: cancelReason.trim() }, { withCredentials: true });
      toast.success(`${cancelRfq.rfq_no} cancelled`);
      setCancelRfq(null);
      onRefresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel the RFQ'));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <>
      <Panel
        icon={ClipboardList}
        title={`Requests for quotation${rfqs.length ? ` (${rfqs.length})` : ''}`}
        description={rfqs.length ? `${summary.quoted} of ${summary.total} supplier${summary.total === 1 ? '' : 's'} have given a quotation` : 'Tick several suppliers above and send them one request'}
        action={
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={loading} aria-label="Refresh requests for quotation">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        }
        bodyClassName="space-y-3 p-3 sm:p-4"
      >
        {loading && rfqs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : rfqs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No request for quotation has been sent for this PR yet. Tick the suppliers in the list above and choose “Request quotation”.
          </p>
        ) : (
          rfqs.map((r) => {
            const open = isOpen(r);
            const cancelled = r.status === 'X';
            return (
              <div key={r.rfq_sno} className={`overflow-hidden rounded-lg border ${cancelled ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-muted/30 px-3 py-2.5">
                  <button type="button" onClick={() => toggle(r)} className="flex items-center gap-2 text-left" aria-expanded={open}>
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span className="text-sm font-semibold">{r.rfq_no}</span>
                  </button>
                  <StatusPill tone={cancelled ? 'neutral' : 'success'}>{cancelled ? 'Cancelled' : 'Open'}</StatusPill>
                  {r.split_group ? <StatusPill tone="violet">Group {r.split_group}</StatusPill> : null}
                  <span className="text-xs text-muted-foreground">
                    {r.items.length} item{r.items.length === 1 ? '' : 's'} · respond by {formatDate(r.response_due_date)} · sent {fmtDateTime(r.created_at)}
                  </span>
                  {canAct && !cancelled && (
                    <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { setCancelRfq(r); setCancelReason(''); }}>
                      <Ban size={12} /> Cancel RFQ
                    </Button>
                  )}
                </div>

                {open && (
                  <div className="space-y-2 p-3">
                    <p className="text-xs text-muted-foreground">
                      <b className="text-foreground">Items:</b> {r.items.map((i) => `${i.prod_name} (${i.qty} ${i.unit_name ?? ''})`).join(' · ')}
                    </p>
                    {r.notes && <p className="whitespace-pre-line text-xs text-muted-foreground [overflow-wrap:anywhere]"><b className="text-foreground">Note sent:</b> {r.notes}</p>}
                    {cancelled && r.close_reason && <p className="whitespace-pre-line text-xs text-muted-foreground [overflow-wrap:anywhere]"><b className="text-foreground">Cancelled:</b> {r.close_reason}</p>}

                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Supplier</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Latest quotation</TableHead>
                            <TableHead className="text-xs">E-mail</TableHead>
                            <TableHead className="text-right text-xs">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.suppliers.map((s) => {
                            const meta = STATUS[s.status] ?? STATUS.PENDING;
                            const live = !cancelled && !['TAKEN', 'CLOSED'].includes(s.status);
                            return (
                              <TableRow key={s.rfq_supplier_sno}>
                                <TableCell className="text-sm font-medium">
                                  {s.company_name}
                                  {s.supp_code ? <span className="block text-xs font-normal text-muted-foreground">{s.supp_code}</span> : null}
                                </TableCell>
                                <TableCell>
                                  <StatusPill tone={meta.tone}>{s.status === 'SUBMITTED' && s.current_version ? `Quoted · v${s.current_version}` : meta.label}</StatusPill>
                                  {s.status === 'REVISION_REQUESTED' && <span className="mt-0.5 block max-w-[14rem] truncate text-[11px] text-muted-foreground" title={s.revision_note ?? ''}>{s.revision_note}</span>}
                                  {s.status === 'DECLINED' && <span className="mt-0.5 block max-w-[14rem] truncate text-[11px] text-muted-foreground" title={s.decline_reason ?? ''}>{s.decline_reason}</span>}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {s.response_count > 0 ? (
                                    <>
                                      <span className="block text-sm font-semibold tabular-nums">{formatINR(Number(s.grand_total ?? 0))}</span>
                                      <span className="text-muted-foreground">v{s.current_version} · {fmtDateTime(s.last_submitted_at)}{s.response_count > 1 ? ` · ${s.response_count} versions` : ''}</span>
                                    </>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell><EmailCell s={s} /></TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                    {s.response_count > 0 && (
                                      <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onViewResponses(r, s)}>
                                        <Eye size={12} /> {s.status === 'SUBMITTED' && canAct ? 'Review / take' : 'View'}
                                      </Button>
                                    )}
                                    {canAct && live && ['SUBMITTED', 'DECLINED'].includes(s.status) && (
                                      <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openRevision(r, s)}>
                                        <RotateCcw size={12} /> Ask revision
                                      </Button>
                                    )}
                                    {canAct && live && (
                                      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={resending === s.rfq_supplier_sno} onClick={() => handleResend(s)}>
                                        {resending === s.rfq_supplier_sno ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Resend
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </Panel>

      {/* Ask a supplier to revise */}
      <Dialog open={!!revision} onOpenChange={(v) => { if (!v && !revisionBusy) setRevision(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ask {revision?.supplier.company_name} to revise</DialogTitle>
            <DialogDescription>They are e-mailed, the request re-opens for them, and their next submission is stored as a new version.</DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="rev-note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What should change? <span className="text-destructive">*</span></label>
              <Textarea id="rev-note" value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} maxLength={500} rows={3} className="max-h-40 min-w-0 max-w-full overflow-y-auto [overflow-wrap:anywhere]" placeholder="e.g. Please bring the rate of item 2 down by 2% and confirm delivery within 5 days." />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rev-due" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New response due date <span className="text-destructive">*</span></label>
              <Input id="rev-due" type="date" min={inDays(0)} value={revisionDue} onChange={(e) => setRevisionDue(e.target.value)} className="h-9 w-48" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevision(null)} disabled={revisionBusy}>Cancel</Button>
            <Button onClick={submitRevision} disabled={revisionBusy || !revisionNote.trim() || !revisionDue}>
              {revisionBusy && <Loader2 size={16} className="mr-1 animate-spin" />} Send revision request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel an RFQ */}
      <Dialog open={!!cancelRfq} onOpenChange={(v) => { if (!v && !cancelBusy) setCancelRfq(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {cancelRfq?.rfq_no}?</DialogTitle>
            <DialogDescription>No supplier will be able to submit or change a quotation for it. Quotations you already took stay as they are.</DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="cancel-reason" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason (optional)</label>
            <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={250} rows={2} className="max-h-40 min-w-0 max-w-full overflow-y-auto [overflow-wrap:anywhere]" />
          </div>
          <Callout tone="warning">Suppliers are not e-mailed about the cancellation; they will see it as closed the next time they open the portal.</Callout>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelRfq(null)} disabled={cancelBusy}>Keep it</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelBusy}>
              {cancelBusy && <Loader2 size={16} className="mr-1 animate-spin" />} Cancel RFQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RfqPanel;
