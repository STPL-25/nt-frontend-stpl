import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, Banknote, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Download, History, Info, Loader2, RefreshCw, Wallet, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/CustomComponent/PageComponents';
import { Callout, Panel, SearchInput, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { downloadTextFile } from '@/utils/downloadTextFile';
import {
  payNetCancel, payNetEntries, payNetRunBatchFile, payNetRunBatches, payNetRunProceed, payNetRunSenders,
  type PaymentBatch, type PaymentEntries, type PaymentEntry, type PaymentFile, type PaymentSender, type RunResult,
} from '@/Services/GrnService/paymentNetApi';
import { socket, SOCKET_CONNECT, SOCKET_JOIN_PAYMENT, SOCKET_LEAVE_PAYMENT, SOCKET_PAYMENT_UPDATED } from '@/Services/Socket';
import {
  PRIORITY_MODES, amountInWords, blockReason, dueState, groupLines, inBankFile, msmeNote, notInFileReason, parseAmountInput, pickSender, planFund,
  rankEntries, rupees, senderLabel, senderProblem, totalOf,
  type PriorityMode,
} from './paymentRunModel';

const SCREEN = 'PaymentRunPage';
const QUICK_FUNDS = ['10 lakh', '25 lakh', '50 lakh', '1 crore'];
const EMPTY: PaymentEntries = { entries: [], lines: [], settings: {} };

const ymd = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');
const showDate = (d: string | null | undefined) => {
  const s = ymd(d);
  if (!s) return '—';
  const p = new Date(`${s}T00:00:00`);
  return Number.isNaN(p.getTime()) ? s : p.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const maskAccount = (n: string | null) => (n ? `••••${String(n).slice(-4)}` : '—');
const saveFile = (f: PaymentFile) => downloadTextFile(f.file_name, f.content, f.mime_type);

/** Approved payments waiting for money: enter today's fund, pay in priority order, get the payment file. */
const PaymentRunPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const canProceed = canCreate(SCREEN) || canEdit(SCREEN);
  const canCancel = canEdit(SCREEN);

  const [data, setData] = useState<PaymentEntries>(EMPTY);
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [fundText, setFundText] = useState('');
  const [mode, setMode] = useState<PriorityMode>('MSME_FIRST');
  const [comSno, setComSno] = useState('');
  const [manual, setManual] = useState<Set<number> | null>(null);   // null = follow the fund plan
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  // the company's bank accounts (Payment Bank master) the file can be paid from; read when the dialog opens so it is current
  const [senders, setSenders] = useState<PaymentSender[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);
  const [sendersError, setSendersError] = useState('');
  const sendersReq = useRef(0);                      // only the newest read of the accounts may answer
  const [snapKey, setSnapKey] = useState('');        // what the open confirmation was opened for: company + payments
  const [senderSno, setSenderSno] = useState('');
  const [proceeding, setProceeding] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [cancelFor, setCancelFor] = useState<PaymentEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [e, b] = await Promise.all([axios.get(payNetEntries, { params: { view: 'run' } }), axios.get(payNetRunBatches)]);
      setData(e.data?.data ?? EMPTY);
      setBatches(b.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the pending payments'));
    } finally {
      setLoading(false);
    }
  }, []);
  const load = useCallback(() => { setLoading(true); return fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Live: a payment approved / cancelled / paid elsewhere changes this list.
  const reload = useRef(load);
  useEffect(() => { reload.current = load; });
  useEffect(() => {
    const join = () => socket.emit(SOCKET_JOIN_PAYMENT);
    join();
    socket.on(SOCKET_CONNECT, join);   // rooms belong to one connection: join again after a reconnect
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdated = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => reload.current(), 400);
    };
    socket.on(SOCKET_PAYMENT_UPDATED, onUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off(SOCKET_CONNECT, join);
      socket.off(SOCKET_PAYMENT_UPDATED, onUpdated);
      socket.emit(SOCKET_LEAVE_PAYMENT);
    };
  }, []);

  const limitDays = Number(data.settings.MSME_LIMIT_DAYS) || 45;
  const linesBy = useMemo(() => groupLines(data.lines), [data.lines]);

  // A payment file covers one company: show one company's payments at a time.
  const companies = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of data.entries) if (e.com_sno != null) m.set(e.com_sno, e.com_name ?? `Company ${e.com_sno}`);
    return [...m];
  }, [data.entries]);
  const activeCom = companies.some(([id]) => String(id) === comSno) ? comSno : (companies[0] ? String(companies[0][0]) : '');
  const visible = useMemo(() => (activeCom ? data.entries.filter((e) => String(e.com_sno) === activeCom) : data.entries), [data.entries, activeCom]);

  const fund = parseAmountInput(fundText);
  const fundNum = fund ?? 0;
  const ranked = useMemo(() => rankEntries(visible, mode), [visible, mode]);
  const plan = useMemo(() => planFund(ranked, fundNum), [ranked, fundNum]);
  const rankOf = useMemo(() => new Map(ranked.map((e, i) => [e.payment_sno, i + 1])), [ranked]);

  const picked = useMemo(() => {
    if (!manual) return plan.picked;
    const live = new Set(ranked.map((e) => e.payment_sno));
    return new Set([...manual].filter((id) => live.has(id)));
  }, [manual, plan.picked, ranked]);

  const changeFund = (t: string) => { setFundText(t); setManual(null); };
  const changeMode = (m: PriorityMode) => { setMode(m); setManual(null); };
  const changeCompany = (c: string) => { setComSno(c); setManual(null); };

  const toggle = (e: PaymentEntry) => {
    if (blockReason(e)) return;
    const next = new Set(picked);
    if (next.has(e.payment_sno)) next.delete(e.payment_sno); else next.add(e.payment_sno);
    setManual(next);
  };

  const pickedEntries = ranked.filter((e) => picked.has(e.payment_sno));
  const pickedTotal = totalOf(ranked, picked);
  const waitingTotal = ranked.reduce((s, e) => s + Number(e.net_paid || 0), 0);
  const overFund = pickedTotal > fundNum + 0.005;
  const notInFile = pickedEntries.filter((e) => !inBankFile(e));
  const fileLines = pickedEntries.length - notInFile.length;
  const sender = pickSender(senders, senderSno);
  const blockedBySender = senderProblem(fileLines, senders, senderSno);
  const blocked = ranked.filter((e) => blockReason(e));
  const waitingForFund = ranked.filter((e) => !picked.has(e.payment_sno) && !blockReason(e));
  const overdueCount = visible.filter((e) => e.is_overdue).length;
  const msmeCount = visible.filter((e) => e.msme_class).length;

  const q = search.trim().toLowerCase();
  const shown = q
    ? ranked.filter((e) => [e.vendor_name, e.payment_no, e.supp_code, e.po_nos, e.invoice_nos, e.supplier_invoice_nos, e.grn_nos, e.gate_entry_nos].some((v) => String(v ?? '').toLowerCase().includes(q)))
    : ranked;

  const toggleOpen = (id: number) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Opens the confirmation and reads the company's bank accounts - a run with bank transfers is paid from one of them.
  const currentKey = `${activeCom}|${pickedEntries.map((e) => e.payment_sno).join(',')}`;
  // The list can reload under an open confirmation (live updates): then what it was opened for is no longer what would be paid.
  const stale = confirmOpen && snapKey !== '' && snapKey !== currentKey;

  const loadSenders = async () => {
    const mine = ++sendersReq.current;
    setSenders([]);
    setSendersError('');
    setSendersLoading(true);
    try {
      const res = await axios.get(payNetRunSenders, { params: { com_sno: activeCom || undefined } });
      if (mine === sendersReq.current) setSenders(res.data?.data ?? []);
    } catch (err) {
      if (mine === sendersReq.current) setSendersError(getErrorMessage(err, 'Could not read the bank accounts to pay from'));
    } finally {
      if (mine === sendersReq.current) setSendersLoading(false);
    }
  };

  const openConfirm = async () => {
    setPayDate(new Date().toISOString().slice(0, 10));
    setSenderSno('');
    setSnapKey(currentKey);
    setConfirmOpen(true);
    await loadSenders();
  };

  const proceed = async () => {
    setProceeding(true);
    try {
      const res = await axios.post(payNetRunProceed, {
        payment_snos: pickedEntries.map((e) => e.payment_sno),   // in priority order: the order of the lines in the file
        fund_plan_amount: fundNum,
        payment_date: payDate,
        payment_bank_sno: fileLines > 0 && sender ? sender.payment_bank_sno : undefined,
      });
      const run: RunResult = res.data?.data;
      setConfirmOpen(false);
      setResult(run);
      setManual(null);
      if (run.file.line_count) saveFile(run.file);
      toast.success(`Payment run ${run.batch.batch_no} created${run.file.line_count ? ' - file downloaded' : ''}`);
      await load();
    } catch (err) {
      const message = getErrorMessage(err, 'Could not create the payment run');
      toast.error(message);
      if (/was created/.test(message)) { setConfirmOpen(false); setManual(null); }   // paid, only the file failed: do not offer the same payments again
      await load();   // most often a payment another user just paid or cancelled
    } finally {
      setProceeding(false);
    }
  };

  const downloadBatch = async (b: PaymentBatch) => {
    setDownloading(b.batch_sno);
    try {
      const res = await axios.get(payNetRunBatchFile(b.batch_sno));
      saveFile(res.data?.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not download the file'));
    } finally {
      setDownloading(null);
    }
  };

  const cancelPayment = async () => {
    if (!cancelFor) return;
    setCancelling(true);
    try {
      await axios.post(payNetCancel, { payment_sno: cancelFor.payment_sno, reason: cancelReason.trim() });
      toast.success(`${cancelFor.payment_no} cancelled - its invoices can be paid again`);
      setCancelFor(null);
      setCancelReason('');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel the payment'));
    } finally {
      setCancelling(false);
    }
  };

  const th = 'text-xs';
  const tile = (label: string, value: React.ReactNode, hint?: React.ReactNode, tone = '') => (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 truncate text-lg font-bold tabular-nums', tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  const fundPill = (e: PaymentEntry) => {
    if (picked.has(e.payment_sno)) return <StatusPill tone="success">Paying today</StatusPill>;
    if (blockReason(e)) return <StatusPill tone="danger">Bank details missing</StatusPill>;
    if (plan.verdict.get(e.payment_sno) === 'SHORT') return <StatusPill tone="warning">Needs {rupees(plan.needs.get(e.payment_sno))} more</StatusPill>;
    return <StatusPill tone="neutral">Not selected</StatusPill>;
  };

  const detailRow = (e: PaymentEntry) => {
    const lines = linesBy.get(e.payment_sno) ?? [];
    return (
      <TableRow key={`${e.payment_sno}-detail`} className="bg-muted/20 hover:bg-muted/20">
        <TableCell colSpan={10} className="p-0">
          <div className="space-y-3 px-4 py-3 sm:px-6">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>Invoice</TableHead>
                    <TableHead className={th}>Supplier invoice</TableHead>
                    <TableHead className={th}>PO</TableHead>
                    <TableHead className={th}>Gate entry</TableHead>
                    <TableHead className={th}>GRN</TableHead>
                    <TableHead className={th}>Due</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Paying</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.invoice_sno}>
                      <TableCell className="text-xs font-medium">{l.invoice_no}<p className="font-normal text-muted-foreground">{showDate(l.invoice_date)}</p></TableCell>
                      <TableCell className="text-xs">{l.supplier_invoice_no ?? '—'}</TableCell>
                      <TableCell className="text-xs">{l.po_no ?? '—'}</TableCell>
                      <TableCell className="text-xs">{showDate(l.gate_entry_date)}<p className="text-muted-foreground">{l.gate_entry_nos ?? ''}</p></TableCell>
                      <TableCell className="text-xs">{showDate(l.grn_date)}<p className="text-muted-foreground">{l.grn_nos ?? ''}</p></TableCell>
                      <TableCell className="text-xs">{showDate(l.due_date)}</TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">{rupees(l.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Gross</dt><dd className="font-semibold tabular-nums">{rupees(e.gross_amount)}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">TDS / advance / notes</dt>
                <dd className="font-semibold tabular-nums">- {rupees(Number(e.tds_amount || 0) + Number(e.advance_adjusted || 0) + Number(e.note_adjusted || 0))}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode</dt><dd className="font-semibold">{e.mode}{notInFileReason(e) ? ` · ${e.channel === 'BANK' ? 'not in the bank file' : notInFileReason(e)}` : ''}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Debit account</dt><dd className="font-semibold">{e.debit_account || '—'}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Supplier bank</dt>
                <dd className="font-semibold">{e.bank_name ? `${e.bank_name} · ${maskAccount(e.ac_number)}` : '—'}<span className="block font-normal text-muted-foreground">{e.ifsc ?? ''}</span></dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">MSME no</dt><dd className="font-semibold">{e.msme_no || '—'}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Entered by</dt><dd className="font-semibold">{e.created_by ?? '—'}<span className="block font-normal text-muted-foreground">{showDate(e.created_at)}</span></dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Approved</dt><dd className="font-semibold">{showDate(e.approved_at)}</dd></div>
            </dl>
            {e.pay_via_portal && (
              <Callout tone="info" icon={Info}>This supplier is paid on their own portal{e.payment_portal_name ? ` (${e.payment_portal_name})` : ''} - it will not be in the bank file.</Callout>
            )}
            {canCancel && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" className="h-8 border-red-200 text-xs text-red-700 hover:bg-red-50" onClick={() => { setCancelFor(e); setCancelReason(''); }}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />Cancel this payment
                </Button>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <PageHeader
        icon={Banknote}
        title="Payment Run"
        description="Approved payments waiting to be paid - plan today's fund, pay in priority order and generate the payment file"
        stats={[
          { label: 'Waiting', value: visible.length, icon: Wallet },
          { label: 'Overdue', value: overdueCount, icon: CalendarClock },
          { label: 'MSME suppliers', value: msmeCount, icon: Info },
          { label: 'Waiting amount', value: `₹${amountInWords(waitingTotal) || Math.round(waitingTotal).toLocaleString('en-IN')}`, icon: Banknote },
        ]}
      >
        <Button
          variant="outline" size="sm"
          className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={load} disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'mr-1 animate-spin' : 'mr-1'} /> Refresh
        </Button>
      </PageHeader>

      <div className="container mx-auto space-y-6 px-4 py-6">
        <Panel icon={Wallet} title="Today's fund plan" description="Enter the money available to pay out today - the payments it covers are picked in priority order">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="fund" className="text-xs">Fund available today (₹)</Label>
                <Input
                  id="fund" inputMode="decimal" autoComplete="off" placeholder="e.g. 50 lakh or 50,00,000"
                  value={fundText} onChange={(ev) => changeFund(ev.target.value)}
                  className="h-10 text-base font-semibold tabular-nums"
                />
                <p className={cn('min-h-4 text-xs', fundText && fund == null ? 'text-red-600' : 'text-muted-foreground')}>
                  {fund != null ? `${rupees(fund)}${amountInWords(fund) ? ` · ${amountInWords(fund)}` : ''}` : fundText ? 'Not an amount - try 50 lakh or 5000000' : 'Type the amount, e.g. 50 lakh'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {QUICK_FUNDS.map((f) => (
                    <Button key={f} type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => changeFund(f)}>{f}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority order</Label>
                <Select value={mode} onValueChange={(v) => changeMode(v as PriorityMode)}>
                  <SelectTrigger className="h-10 w-full" aria-label="Priority order"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{PRIORITY_MODES.find((m) => m.value === mode)?.hint}</p>
              </div>
              {companies.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Company</Label>
                  <Select value={activeCom} onValueChange={changeCompany}>
                    <SelectTrigger className="h-10 w-full" aria-label="Company"><SelectValue /></SelectTrigger>
                    <SelectContent>{companies.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">One payment file covers one company.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {tile('Waiting', visible.length, rupees(waitingTotal))}
              {tile('Paying today', picked.size, rupees(pickedTotal), 'text-emerald-700 dark:text-emerald-300')}
              {tile('Fund left', rupees(fundNum - pickedTotal), fund == null ? 'No fund entered' : `of ${rupees(fundNum)}`, overFund ? 'text-red-600 dark:text-red-400' : '')}
              {tile('Waiting for fund', waitingForFund.length, rupees(waitingForFund.reduce((s, e) => s + Number(e.net_paid || 0), 0)), waitingForFund.length ? 'text-amber-700 dark:text-amber-300' : '')}
              {tile('Cannot pay yet', blocked.length, blocked.length ? 'Bank details missing' : undefined, blocked.length ? 'text-red-600 dark:text-red-400' : '')}
            </div>

            {fundNum > 0 && (
              <div className="space-y-1.5">
                <div role="progressbar" aria-label="Fund used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((pickedTotal / fundNum) * 100))} className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-all', overFund ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (pickedTotal / fundNum) * 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{rupees(pickedTotal)} of {rupees(fundNum)} used · {Math.round((pickedTotal / fundNum) * 100)}%</p>
              </div>
            )}

            <Callout tone="info" icon={Info}>
              Micro and Small MSME suppliers must be paid within <b>{limitDays} days</b> of the goods being received (MSMED Act). The due date shown is that limit, counted
              from the earlier of the gate entry and GRN date, or the invoice's own due date if that comes first; everyone else is due on the invoice due date
              (else {data.settings.DEFAULT_CREDIT_DAYS ?? 30} days after receipt). A payment that does not fit the fund is skipped so a smaller one below it can still be paid.
            </Callout>
          </div>
        </Panel>

        <Panel
          icon={Banknote}
          title={`Payments waiting (${visible.length})`}
          description="Highest priority first. Tick or untick to change what is paid today."
          bodyClassName="p-0"
          action={manual ? (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setManual(null)}>Re-apply fund plan</Button>
          ) : undefined}
        >
          <div className="border-b px-4 py-3 sm:px-5">
            <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, payment, PO, invoice, GRN…" className="max-w-md" />
          </div>
          {loading && data.entries.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <Wallet className="mx-auto mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">No approved payment is waiting</p>
              <p className="mx-auto mt-1 max-w-md text-xs">Save a payment on the Payment page. Once it is approved it appears here, ready to be paid against the day's fund.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-10" />
                    <TableHead className={cn(th, 'w-10')}>#</TableHead>
                    <TableHead className={th}>Supplier</TableHead>
                    <TableHead className={th}>MSME</TableHead>
                    <TableHead className={th}>Gate entry</TableHead>
                    <TableHead className={th}>GRN</TableHead>
                    <TableHead className={th}>Due</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Net payable</TableHead>
                    <TableHead className={th}>Today's fund</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No matches found</TableCell></TableRow>
                  )}
                  {shown.map((e) => {
                    const block = blockReason(e);
                    const isPicked = picked.has(e.payment_sno);
                    const isOpen = open.has(e.payment_sno);
                    const due = dueState(e);
                    const msme = msmeNote(e, limitDays);
                    return (
                      <React.Fragment key={e.payment_sno}>
                        <TableRow title={block} className={cn(isPicked && 'bg-emerald-50/60 dark:bg-emerald-950/20', block && 'opacity-70')}>
                          <TableCell>
                            <Checkbox checked={isPicked} disabled={!!block || !canProceed} onCheckedChange={() => toggle(e)} aria-label={`Pay ${e.payment_no} today`} />
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">{rankOf.get(e.payment_sno)}</span>
                          </TableCell>
                          <TableCell className="min-w-44 text-xs">
                            <span className="block font-semibold">{e.vendor_name ?? '—'}</span>
                            <span className="block text-muted-foreground">{e.payment_no}{e.po_nos ? ` · ${e.po_nos}` : ''}</span>
                            {notInFileReason(e) && <span className="mt-1 inline-block rounded border bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{notInFileReason(e)}</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {msme ? (
                              <span title={msme.hint} className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium', TONE.violet)}>{msme.label}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs" title={e.gate_entry_nos ?? ''}>{showDate(e.first_gate_entry_date)}<span className="block max-w-32 truncate text-muted-foreground">{e.gate_entry_nos ?? ''}</span></TableCell>
                          <TableCell className="whitespace-nowrap text-xs" title={e.grn_nos ?? ''}>{showDate(e.first_grn_date)}<span className="block max-w-32 truncate text-muted-foreground">{e.grn_nos ?? ''}</span></TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {showDate(e.due_date)}
                            <span className={cn('mt-0.5 block text-[11px] font-medium', due.tone === 'danger' && 'text-red-600 dark:text-red-400', due.tone === 'warning' && 'text-amber-700 dark:text-amber-300', due.tone === 'neutral' && 'text-muted-foreground')}>{due.text}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums">
                            {rupees(e.net_paid)}
                            {Number(e.gross_amount) !== Number(e.net_paid) && <span className="block font-normal text-muted-foreground">gross {rupees(e.gross_amount)}</span>}
                          </TableCell>
                          <TableCell>{fundPill(e)}</TableCell>
                          <TableCell>
                            <button type="button" onClick={() => toggleOpen(e.payment_sno)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} details of ${e.payment_no}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </TableCell>
                        </TableRow>
                        {isOpen && detailRow(e)}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {visible.length > 0 && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-5">
              <div className="min-w-0 text-sm">
                <p className="font-semibold tabular-nums">{picked.size} payment{picked.size === 1 ? '' : 's'} · {rupees(pickedTotal)}</p>
                <p className={cn('text-xs', overFund ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {fund == null ? "Enter today's fund plan above" : overFund ? `${rupees(pickedTotal - fundNum)} more than the fund - untick some payments` : `${rupees(fundNum - pickedTotal)} of the fund left`}
                </p>
              </div>
              {canProceed && (
                <Button type="button" className="h-10" disabled={picked.size === 0 || fund == null || overFund} onClick={openConfirm}>
                  <Banknote className="mr-2 h-4 w-4" />Proceed payment
                </Button>
              )}
            </div>
          )}
        </Panel>

        <Panel icon={History} title="Previous payment runs" description="Download the payment file of an earlier run again" bodyClassName="p-0">
          {batches.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No payment run yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>Run</TableHead>
                    <TableHead className={th}>Date</TableHead>
                    <TableHead className={th}>Company</TableHead>
                    <TableHead className={th}>Paid from</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Payments</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Paid</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Fund plan</TableHead>
                    <TableHead className={th}>By</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.batch_sno}>
                      <TableCell className="text-xs font-medium">{b.batch_no}</TableCell>
                      <TableCell className="text-xs">{showDate(b.batch_date)}</TableCell>
                      <TableCell className="text-xs">{b.com_name ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {b.sender_bank_name ? <>{b.sender_bank_name}<span className="block text-muted-foreground">••••{b.sender_ac_last4}{b.sender_client_code ? ` · ${b.sender_client_code}` : ''}</span></> : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{b.item_count}</TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">{rupees(b.total_amount)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{rupees(b.fund_plan_amount)}</TableCell>
                      <TableCell className="text-xs">{b.created_by ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {b.has_file || b.file_type ? (
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={downloading === b.batch_sno} onClick={() => downloadBatch(b)}>
                            {downloading === b.batch_sno ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}File
                          </Button>
                        ) : <span className="text-xs text-muted-foreground" title="No bank transfer in this run">No file</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      {/* confirm */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!proceeding) setConfirmOpen(o); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Proceed with this payment run?</DialogTitle>
            <DialogDescription>The payments are marked paid, their journals are posted and the payment file is generated.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payments</dt><dd className="font-semibold tabular-nums">{pickedEntries.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total to pay</dt><dd className="font-semibold tabular-nums">{rupees(pickedTotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fund plan</dt><dd className="font-semibold tabular-nums">{rupees(fundNum)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Left after this run</dt><dd className="font-semibold tabular-nums">{rupees(fundNum - pickedTotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">In the bank file</dt><dd className="font-semibold tabular-nums">{fileLines} line{fileLines === 1 ? '' : 's'}</dd></div>
          </dl>
          {fileLines > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Pay from</Label>
              {sendersLoading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading the company's bank accounts…</p>
              ) : sendersError ? (
                <Callout tone="danger" icon={AlertTriangle}>
                  {sendersError}.{' '}<button type="button" className="font-semibold underline" onClick={loadSenders}>Try again</button>
                </Callout>
              ) : senders.length === 0 ? (
                <Callout tone="danger" icon={AlertTriangle}>{blockedBySender}</Callout>
              ) : (
                <>
                  <Select value={sender ? String(sender.payment_bank_sno) : ''} onValueChange={setSenderSno}>
                    <SelectTrigger className="h-10 w-full" aria-label="Pay from"><SelectValue placeholder="Choose the bank account" /></SelectTrigger>
                    <SelectContent>
                      {senders.map((s) => <SelectItem key={s.payment_bank_sno} value={String(s.payment_bank_sno)}>{senderLabel(s)}{s.is_default === 'Y' ? ' · default' : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className={cn('text-xs', sender ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                    {sender ? `Bank upload file for ${sender.bank_name} (client code ${sender.client_code}). Each supplier's account, IFSC and bank come from their KYC.` : blockedBySender}
                  </p>
                </>
              )}
            </div>
          )}
          {notInFile.length > 0 && (
            <Callout tone="warning" icon={AlertTriangle}>
              {notInFile.length} of these {notInFile.length === 1 ? 'is' : 'are'} not a NEFT / RTGS bank transfer ({[...new Set(notInFile.map(notInFileReason))].join(', ')}):
              {' '}{notInFile.map((e) => e.vendor_name ?? e.payment_no).join(', ')}. They are marked paid but are not in the file - pay them separately.
            </Callout>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pay-date" className="text-xs">Payment date</Label>
            <Input id="pay-date" type="date" value={payDate} onChange={(ev) => setPayDate(ev.target.value)} className="h-10" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={proceeding} onClick={() => setConfirmOpen(false)}>Cancel</Button>
            {stale && <p className="mr-auto text-xs text-amber-700 dark:text-amber-300">The list changed while this was open - close it and review the payments again.</p>}
            <Button type="button" disabled={proceeding || stale || !payDate || sendersLoading || !!sendersError || !!blockedBySender} onClick={proceed}>
              {proceeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{fileLines > 0 ? 'Proceed & download file' : 'Proceed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* result */}
      <Dialog open={result != null} onOpenChange={(o) => { if (!o) setResult(null); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
          <DialogHeader className="flex-row items-start gap-3 text-left">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border', TONE.success)}><CheckCircle2 className="h-5 w-5" /></span>
            <div className="min-w-0 space-y-1 pr-6">
              <DialogTitle>Payment run {result?.batch.batch_no} created</DialogTitle>
              <DialogDescription>{result?.items.length} payment{result?.items.length === 1 ? '' : 's'} · {rupees(result?.batch.total_amount)} paid against a fund of {rupees(result?.batch.fund_plan_amount)}.</DialogDescription>
            </div>
          </DialogHeader>
          {result && result.file.line_count ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold">{result.file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {result.file.line_count} bank transfer{result.file.line_count === 1 ? '' : 's'} · {rupees(result.file.total_amount)}
                  {result.batch.sender_bank_name ? ` · from ${result.batch.sender_bank_name} ••••${result.batch.sender_ac_last4}` : ''} · saved to your Downloads folder
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => saveFile(result.file)}><Download className="mr-1.5 h-4 w-4" />Download again</Button>
            </div>
          ) : (
            <Callout tone="info" icon={Info}>None of these payments is a NEFT / RTGS bank transfer, so there is no payment file for this run.</Callout>
          )}
          {result && result.skipped.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Not in the file - pay these separately</p>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableBody>
                    {result.skipped.map((s) => (
                      <TableRow key={s.payment_no}>
                        <TableCell className="text-xs"><span className="font-medium">{s.vendor_name ?? s.payment_no}</span><span className="block text-muted-foreground">{s.payment_no} · {s.reason}</span></TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(s.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter><Button type="button" onClick={() => setResult(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* cancel */}
      <Dialog open={cancelFor != null} onOpenChange={(o) => { if (!o && !cancelling) setCancelFor(null); }}>
        <DialogContent className="w-[calc(100%-1rem)] gap-4 sm:w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {cancelFor?.payment_no}?</DialogTitle>
            <DialogDescription>{cancelFor?.vendor_name} · {rupees(cancelFor?.net_paid)}. Its invoices, advances and notes are freed so the payment can be entered again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason" className="text-xs">Reason <span className="text-destructive">*</span></Label>
            <Textarea id="cancel-reason" rows={3} value={cancelReason} onChange={(ev) => setCancelReason(ev.target.value)} placeholder="Why is this payment being cancelled?" className="resize-none text-sm" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={cancelling} onClick={() => setCancelFor(null)}>Keep payment</Button>
            <Button type="button" variant="destructive" disabled={cancelling || !cancelReason.trim()} onClick={cancelPayment}>
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}Cancel payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentRunPage;
