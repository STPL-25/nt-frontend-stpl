import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowRightCircle, Banknote, Check, ChevronRight, ClipboardCheck, FileText, Hourglass, Info, Landmark, Loader2, Percent, RefreshCw, Undo2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import ApprovalActionDialog from '@/LayoutComponent/ApprovalLayout/ApprovalActionDialog';
import { ApprovalPath } from '@/LayoutComponent/ApprovalLayout/PrApprovalPath';
import { ForwardTargetPicker, SendBackTargetPicker } from '@/LayoutComponent/ApprovalLayout/PrApprovalActionForm';
import {
  ApprovalActivity, Callout, DetailEmptyState, DetailHero, Fact, FactGrid, FilterChips, Panel, SearchInput, SelectableCard, StatusPill,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE, type Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { formatWhen, personLabel } from '@/Application/PR/prApprovalContext';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  payNetApprove, payNetCancel, payNetEntries, payNetEntryDetail,
  type PaymentApprovalAction, type PaymentDecision, type PaymentDetail, type PaymentEntry, type PaymentStatus, type PaymentUpdatedEvent,
} from '@/Services/GrnService/paymentNetApi';
import { socket, SOCKET_CONNECT, SOCKET_JOIN_PAYMENT, SOCKET_LEAVE_PAYMENT, SOCKET_PAYMENT_UPDATED } from '@/Services/Socket';
import {
  decisionBody, decisionFlags, decisionMessage, defaultTarget, nextStageAfterApprove, paymentApprovalContext, remarksProblem, targetProblem,
} from './paymentApprovalModel';
import { msmeNote, rupees } from './paymentRunModel';

const SCREEN = 'PaymentApprovalScreen';

const STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  'Pending Approval': { label: 'Pending approval', tone: 'warning' },
  Approved: { label: 'Approved · awaiting payment', tone: 'info' },
  Processed: { label: 'Paid', tone: 'success' },
  Rejected: { label: 'Rejected', tone: 'danger' },
  Cancelled: { label: 'Cancelled', tone: 'neutral' },
};
type Tab = 'mine' | 'all';
type StatusFilter = 'ALL' | PaymentStatus;

const ymd = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');
const showDate = (d: string | null | undefined) => {
  const s = ymd(d);
  if (!s) return '—';
  const p = new Date(`${s}T00:00:00`);
  return Number.isNaN(p.getTime()) ? s : p.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const maskAccount = (n: string | null) => (n ? `••••${String(n).slice(-4)}` : '—');
const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const ADJ_LABEL: Record<string, string> = { TDS: 'TDS', ADVANCE: 'Advance adjusted', DEBIT_NOTE: 'Debit note', CREDIT_NOTE: 'Credit note' };
// ApprovalActivity knows APPROVED / REJECTED / SUBMITTED; the others are passed as the label they should show
const HISTORY_LABEL: Record<string, string> = { AUTO_APPROVED: 'Auto-approved', CANCELLED: 'Cancelled', PAID: 'Paid' };

/** Saved payments: the ones waiting on the signed-in approver, and every payment with where it stands. */
const PaymentApprovalPage: React.FC = () => {
  const { canEdit } = usePermissions();
  const canWithdraw = canEdit(SCREEN);

  const [tab, setTab] = useState<Tab>('mine');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [mine, setMine] = useState<PaymentEntry[]>([]);
  const [all, setAll] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // Forward / Send back are decided in a dialog (which stage, and why); Approve / Reject use the remarks box in the panel.
  const [dialog, setDialog] = useState<'forward' | 'send_back' | null>(null);
  const [dialogRemarks, setDialogRemarks] = useState('');
  const [target, setTarget] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([
        axios.get(payNetEntries, { params: { view: 'mine', with_lines: 0 } }),
        axios.get(payNetEntries, { params: { view: 'all', with_lines: 0 } }),
      ]);
      setMine(m.data?.data?.entries ?? []);
      setAll(a.data?.data?.entries ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load payments'));
    } finally {
      setLoading(false);
    }
  }, []);
  const load = useCallback(() => { setLoading(true); return fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await axios.get(payNetEntryDetail(id));
      setDetail(res.data?.data ?? null);
    } catch (err) {
      setDetail(null);
      toast.error(getErrorMessage(err, 'Failed to load the payment'));
    }
  }, []);
  const selectPayment = useCallback((id: number | null) => {
    setSelectedId(id);
    setComments('');
    setDialog(null);
    setDetail(null);
    if (id != null) loadDetail(id);
  }, [loadDetail]);

  // Live: a payment saved / approved / paid elsewhere changes these lists (and maybe the open payment).
  const live = useRef({ load, loadDetail, selectedId });
  useEffect(() => { live.current = { load, loadDetail, selectedId }; });
  useEffect(() => {
    const join = () => socket.emit(SOCKET_JOIN_PAYMENT);
    join();
    socket.on(SOCKET_CONNECT, join);   // rooms belong to one connection: join again after a reconnect
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdated = (ev: PaymentUpdatedEvent) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        live.current.load();
        const id = live.current.selectedId;
        if (id != null && (ev.payment_sno === id || ev.payment_snos?.includes(id))) live.current.loadDetail(id);
      }, 400);
    };
    socket.on(SOCKET_PAYMENT_UPDATED, onUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off(SOCKET_CONNECT, join);
      socket.off(SOCKET_PAYMENT_UPDATED, onUpdated);
      socket.emit(SOCKET_LEAVE_PAYMENT);
    };
  }, []);

  const rows = useMemo(() => {
    const base = tab === 'mine' ? mine : all.filter((e) => statusFilter === 'ALL' || e.status === statusFilter);
    const q = search.trim().toLowerCase();
    return q ? base.filter((e) => [e.payment_no, e.vendor_name, e.supp_code, e.po_nos, e.invoice_nos, e.supplier_invoice_nos].some((v) => String(v ?? '').toLowerCase().includes(q))) : base;
  }, [tab, mine, all, statusFilter, search]);

  const countBy = (s: PaymentStatus) => all.filter((e) => e.status === s).length;
  const waitingOnMe = detail != null && mine.some((m) => m.payment_sno === detail.entry.payment_sno);
  // The database's view of this payment's approval (stage chain, what the user may do, where Forward / Send back can go)
  const approvalCtx = useMemo(() => paymentApprovalContext(detail), [detail]);
  const flags = decisionFlags(approvalCtx, waitingOnMe);
  const canAct = flags.approve || flags.reject;

  const decide = async (action: PaymentApprovalAction, remarks: string, targetValue = '') => {
    if (!detail) return;
    const e = detail.entry;
    setBusy(true);
    try {
      const res = await axios.post(payNetApprove, decisionBody(e.payment_sno, action, remarks, targetValue));
      toast.success(decisionMessage(res.data?.data as PaymentDecision, detail.stages));
      setComments('');
      setDialog(null);
      await Promise.all([load(), loadDetail(e.payment_sno)]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record the decision'));
    } finally {
      setBusy(false);
    }
  };

  const openDialog = (action: 'forward' | 'send_back') => {
    setTarget(defaultTarget(action, approvalCtx));
    setDialogRemarks(comments);
    setDialog(action);
  };

  const cancelPayment = async () => {
    if (!detail) return;
    const e = detail.entry;
    setBusy(true);
    try {
      await axios.post(payNetCancel, { payment_sno: e.payment_sno, reason: cancelReason.trim() });
      toast.success(`${e.payment_no} cancelled - its invoices can be paid again`);
      setCancelOpen(false);
      setCancelReason('');
      await Promise.all([load(), loadDetail(e.payment_sno)]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel the payment'));
    } finally {
      setBusy(false);
    }
  };

  const detailContent = detail ? (() => {
    const e = detail.entry;
    const meta = STATUS_META[e.status];
    const deductions = Number(e.tds_amount || 0) + Number(e.advance_adjusted || 0) + Number(e.note_adjusted || 0);
    const msme = msmeNote(e, 45);
    const history = detail.history.map((h) => ({
      action_type: HISTORY_LABEL[h.action_type] ?? h.action_type, status_by: h.status_by ?? undefined, comment: h.comment ?? undefined, created_at: h.created_at,
    }));
    const waiting = e.status === 'Pending Approval';
    const next = nextStageAfterApprove(approvalCtx);
    const afterApprove = !approvalCtx
      ? "Once the last approver approves, the payment waits in Payment Run to be paid against the day's fund."
      : next
        ? `Approving sends it to ${personLabel(next.approver_name, next.approver_ecno)} for ${next.stage_name}.`
        : "This is the last approval needed - once you approve, the payment waits in Payment Run to be paid against the day's fund.";
    return (
      <div className="space-y-4 px-3 py-4 sm:px-5">
        <DetailHero
          icon={ClipboardCheck}
          eyebrow="Payment"
          title={e.payment_no}
          subtitle={`${e.vendor_name ?? '—'}${e.supp_code ? ` · ${e.supp_code}` : ''}`}
          badges={(
            <>
              <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
              {msme && <span title={msme.hint} className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium', TONE.violet)}>{msme.label}</span>}
              <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE.neutral)}>{e.mode}</span>
              {e.batch_no && <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE.neutral)}>Run {e.batch_no}</span>}
            </>
          )}
          metrics={[
            { label: 'Invoices', value: rupees(e.gross_amount), valueClassName: 'text-base @md:text-lg' },
            { label: 'TDS, advance, notes', value: `- ${rupees(deductions)}`, valueClassName: 'text-base @md:text-lg text-red-600 dark:text-red-400' },
            { label: 'Net to pay supplier', value: rupees(e.net_paid), valueClassName: 'text-emerald-700 dark:text-emerald-300' },
          ]}
        />

        <Panel icon={FileText} title={`Invoices in this payment (${detail.lines.length})`} description="With when the goods came in and when each is due" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className={th}>Invoice</th><th className={th}>Supplier invoice</th><th className={th}>PO</th><th className={th}>Gate entry</th>
                  <th className={th}>GRN</th><th className={th}>Due</th><th className={cn(th, 'text-right')}>Paying</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l) => (
                  <tr key={l.invoice_sno} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{l.invoice_no}<span className="block text-xs font-normal text-muted-foreground">{showDate(l.invoice_date)}</span></td>
                    <td className="px-3 py-2">{l.supplier_invoice_no ?? '—'}</td>
                    <td className="px-3 py-2">{l.po_no ?? '—'}</td>
                    <td className="px-3 py-2">{showDate(l.gate_entry_date)}<span className="block text-xs text-muted-foreground">{l.gate_entry_nos ?? ''}</span></td>
                    <td className="px-3 py-2">{showDate(l.grn_date)}<span className="block text-xs text-muted-foreground">{l.grn_nos ?? ''}</span></td>
                    <td className="px-3 py-2">{showDate(l.due_date)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{rupees(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel icon={Percent} title="TDS, advances and notes" description="What was taken off the invoices to arrive at the net amount">
          {detail.adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was deducted - the net amount is the invoice amount{e.status === 'Rejected' || e.status === 'Cancelled' ? ' (the adjustments were released when this payment ended)' : ''}.</p>
          ) : (
            <ul className="divide-y text-sm">
              {detail.adjustments.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span>{ADJ_LABEL[a.adj_type] ?? a.adj_type}{a.ref_no ? ` · ${a.ref_no}` : ''}{a.invoice_no ? ` · ${a.invoice_no}` : ''}</span>
                  <span className={cn('font-semibold tabular-nums', a.adj_type === 'CREDIT_NOTE' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400')}>
                    {a.adj_type === 'CREDIT_NOTE' ? '+' : '-'} {rupees(a.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={Landmark} title="Supplier and payment details">
          <FactGrid>
            <Fact label="Supplier">{e.vendor_name ?? '—'}</Fact>
            <Fact label="MSME">{e.msme_label ? `${e.msme_label}${e.msme_no ? ` · ${e.msme_no}` : ''}` : 'Not an MSME'}</Fact>
            <Fact label="Company">{e.com_name ?? '—'}</Fact>
            <Fact label="Payment date">{showDate(e.payment_date)}</Fact>
            <Fact label="Mode">{e.mode}</Fact>
            <Fact label="Debit account">{e.debit_account || '—'}</Fact>
            <Fact label="Supplier bank">{e.bank_name ? `${e.bank_name} · ${maskAccount(e.ac_number)}` : e.pay_via_portal ? `Portal${e.payment_portal_name ? ` · ${e.payment_portal_name}` : ''}` : 'Not on file'}</Fact>
            <Fact label="IFSC">{e.ifsc ?? '—'}</Fact>
            <Fact label="Reference no">{e.reference_no || '—'}</Fact>
            <Fact label="Entered by">{e.created_by ?? '—'}</Fact>
            <Fact label="Entered on">{showDate(e.created_at)}</Fact>
            {e.remarks && <Fact label="Remarks" className="col-span-2 @xl:col-span-3">{e.remarks}</Fact>}
          </FactGrid>
        </Panel>

        {approvalCtx && <ApprovalPath context={approvalCtx} noun="payment" basis="amount" amountLabel="net payable" />}
        {history.length > 0 && <ApprovalActivity history={history} />}

        {waiting && approvalCtx?.summary?.my_role === 'ALTERNATE_WAITING' && (
          <Callout tone="neutral" icon={Hourglass}>
            You are the alternate approver for this stage. You can act from {formatWhen(approvalCtx.summary.alternate_available_at)}, if it is still waiting.
          </Callout>
        )}

        {waiting && canAct && (
          <Panel icon={ClipboardCheck} title="Your decision" description={afterApprove}>
            {approvalCtx?.summary?.my_role === 'ALTERNATE' && (
              <Callout tone="info" icon={Hourglass} className="mb-3">You are acting as an alternate approver - this has waited past the stage's escalation time.</Callout>
            )}
            <Textarea placeholder={`Remarks (required to reject${flags.sendBack ? ' or send back' : ''})`} value={comments} onChange={(ev) => setComments(ev.target.value)} className="min-h-[72px] text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              {flags.approve && (
                <Button className="bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => decide('approve', comments)}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Approve
                </Button>
              )}
              {flags.forward && (
                <Button variant="outline" disabled={busy} onClick={() => openDialog('forward')}>
                  <ArrowRightCircle className="mr-1 h-4 w-4" /> Forward
                </Button>
              )}
              {flags.sendBack && (
                <Button variant="outline" disabled={busy} onClick={() => openDialog('send_back')}>
                  <Undo2 className="mr-1 h-4 w-4" /> Send back
                </Button>
              )}
              {flags.reject && (
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={busy || !!remarksProblem('reject', comments)} onClick={() => decide('reject', comments)}>
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
              )}
            </div>
          </Panel>
        )}

        {!canAct && (e.status === 'Pending Approval' || e.status === 'Approved') && canWithdraw && (
          <Panel icon={Undo2} title="Withdraw this payment" description="It has not been paid yet - cancelling frees its invoices, advances and notes so the payment can be entered again.">
            {waiting && e.current_approver_id && <Callout tone="info" icon={Info} className="mb-3">Waiting on {e.current_approver_id}.</Callout>}
            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setCancelReason(''); setCancelOpen(true); }}>
              <XCircle className="mr-1.5 h-4 w-4" />Cancel payment
            </Button>
          </Panel>
        )}
      </div>
    );
  })() : null;

  const cardTotal = (r: PaymentEntry) => rupees(r.net_paid);

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle="Payment Approvals"
        sidebarCount={rows.length}
        sidebarCountLabel="payment"
        sidebarCountQualifier={tab === 'mine' ? 'pending' : 'saved'}
        listItems={(closeSheet) => (
          <>
            <div className="sticky top-0 z-10 -mx-2 -mt-2 space-y-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
              <FilterChips<Tab>
                value={tab}
                onChange={(t) => { setTab(t); selectPayment(null); }}
                options={[{ value: 'mine', label: 'Awaiting me', count: mine.length }, { value: 'all', label: 'All payments', count: all.length }]}
              />
              {tab === 'all' && (
                <FilterChips<StatusFilter>
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'ALL', label: 'All' },
                    { value: 'Pending Approval', label: 'Pending', count: countBy('Pending Approval') },
                    { value: 'Approved', label: 'Approved', count: countBy('Approved') },
                    { value: 'Processed', label: 'Paid', count: countBy('Processed') },
                    { value: 'Rejected', label: 'Rejected', count: countBy('Rejected') },
                    { value: 'Cancelled', label: 'Cancelled', count: countBy('Cancelled') },
                  ]}
                />
              )}
              <div className="flex items-center gap-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Search payment, supplier, PO, invoice…" className="min-w-0 flex-1" />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={load} disabled={loading} aria-label="Refresh list">
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              </div>
            </div>
            {loading && rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'No matches found' : tab === 'mine' ? 'No payments awaiting your approval' : 'No payments yet'}
              </p>
            ) : rows.map((r) => {
              const active = r.payment_sno === selectedId;
              const meta = STATUS_META[r.status];
              return (
                <SelectableCard key={r.payment_sno} selected={active} onClick={() => { selectPayment(r.payment_sno); closeSheet(); }}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="block min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.payment_no}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.vendor_name ?? '—'}</span>
                    </span>
                    <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', active ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
                  </span>
                  <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    {r.msme_label && <span className={cn('inline-flex items-center rounded-md border px-1.5 py-px text-[11px] font-medium', TONE.violet)}>{r.msme_label}</span>}
                  </span>
                  <span className="mt-3 block space-y-1 text-xs">
                    <span className="flex justify-between gap-3"><span className="text-muted-foreground">Net payable</span><span className="font-semibold tabular-nums">{cardTotal(r)}</span></span>
                    <span className="flex justify-between gap-3"><span className="text-muted-foreground">PO</span><span className="truncate font-medium">{r.po_nos ?? '—'}</span></span>
                    <span className="flex justify-between gap-3"><span className="text-muted-foreground">Entered</span><span className="font-medium">{showDate(r.created_at)}</span></span>
                    {r.status === 'Pending Approval' && r.current_approver_id && (
                      <span className="flex justify-between gap-3"><span className="text-muted-foreground">With</span><span className="truncate font-medium">{r.current_approver_id}</span></span>
                    )}
                  </span>
                </SelectableCard>
              );
            })}
          </>
        )}
        hasSelection={!!detail}
        detailContent={detailContent}
        emptyContent={(
          <DetailEmptyState
            icon={Banknote}
            title={selectedId != null ? 'Loading payment…' : 'Select a payment'}
            description="Choose a payment from the list to review its invoices, deductions and approval path, then approve, forward, send back or reject it. Approved payments are paid from Payment Run."
          />
        )}
        mobileListLabel="Payments"
        mobileSelectionTitle={detail?.entry.payment_no}
      />

      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!busy) setCancelOpen(o); }}>
        <DialogContent className="w-[calc(100%-1rem)] gap-4 sm:w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {detail?.entry.payment_no}?</DialogTitle>
            <DialogDescription>{detail?.entry.vendor_name} · {rupees(detail?.entry.net_paid)}. Its invoices, advances and notes are freed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason" className="text-xs">Reason <span className="text-destructive">*</span></Label>
            <Textarea id="cancel-reason" rows={3} value={cancelReason} onChange={(ev) => setCancelReason(ev.target.value)} placeholder="Why is this payment being cancelled?" className="resize-none text-sm" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep payment</Button>
            <Button type="button" variant="destructive" disabled={busy || !cancelReason.trim()} onClick={cancelPayment}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}Cancel payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApprovalActionDialog
        open={dialog != null}
        onOpenChange={(o) => { if (!busy && !o) setDialog(null); }}
        tone="warning"
        icon={dialog === 'send_back' ? Undo2 : ArrowRightCircle}
        title={dialog === 'send_back' ? 'Send back payment' : 'Forward payment'}
        description={dialog === 'send_back'
          ? 'Return it to someone who already handled it, with your reason.'
          : 'Pass this payment to a later stage for their decision - including one its amount does not require.'}
        summary={detail ? [
          { label: 'Payment', value: detail.entry.payment_no },
          { label: 'Supplier', value: detail.entry.vendor_name ?? '—' },
          { label: 'Net payable', value: <span className="text-primary">{rupees(detail.entry.net_paid)}</span> },
        ] : undefined}
        commentsLabel={dialog === 'send_back' ? 'Reason' : 'Remarks'}
        commentsRequired={dialog === 'send_back'}
        commentsPlaceholder={dialog === 'send_back' ? 'What needs to be checked or corrected…' : 'Anything the next approver should know…'}
        comments={dialogRemarks}
        setComments={setDialogRemarks}
        blockedReason={dialog ? targetProblem(dialog, target, approvalCtx) : null}
        loading={busy}
        disabled={!dialog || !!targetProblem(dialog, target, approvalCtx) || !!remarksProblem(dialog, dialogRemarks)}
        onSubmit={() => { if (dialog) decide(dialog, dialogRemarks, target); }}
        confirmLabel={dialog === 'send_back' ? 'Confirm send back' : 'Confirm forward'}
        confirmIcon={dialog === 'send_back' ? Undo2 : ArrowRightCircle}
      >
        {dialog === 'forward' && <ForwardTargetPicker targets={approvalCtx?.forwardTargets ?? []} value={target} onChange={setTarget} noun="payment" />}
        {dialog === 'send_back' && (
          <SendBackTargetPicker targets={approvalCtx?.sendBackTargets ?? []} value={target} onChange={setTarget} hint="When they approve it again it comes straight back to you." />
        )}
      </ApprovalActionDialog>
    </>
  );
};

export default PaymentApprovalPage;
