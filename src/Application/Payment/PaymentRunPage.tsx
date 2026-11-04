import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowRight, Banknote, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Download, History, Info, Loader2, RefreshCw, Send, Wallet, XCircle,
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
import { Callout, FilterChips, Panel, SearchInput, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { downloadTextFile } from '@/utils/downloadTextFile';
import {
  payNetCancel, payNetEntries, payNetPortalPayments, payNetRunBatches, payNetRunProceed, payNetRunSenders,
  type PaymentBatch, type PaymentEntries, type PaymentEntry, type PaymentFile, type PaymentSender, type PortalPayment, type RunResult,
} from '@/Services/GrnService/paymentNetApi';
import { PortalPaymentsSection } from './PortalAndTdsPanels';
import { PaymentHistoryTab } from './PaymentHistory';
import { BankFailureBox } from './BankReply';
import { bankFailureText } from './bankReplyModel';
import { compactRupees, localYmd, monthSummary, toHistoryItems } from './paymentHistoryModel';
import { socket, SOCKET_CONNECT, SOCKET_JOIN_PAYMENT, SOCKET_LEAVE_PAYMENT, SOCKET_PAYMENT_UPDATED } from '@/Services/Socket';
import {
  PRIORITY_MODES, amountInWords, blockReason, dueState, groupLines, inBankFile, msmeNote, notInFileReason, parseAmountInput, pickSender, planFund,
  rankEntries, rupees, senderLabel, senderProblem, totalOf,
  type PriorityMode,
} from './paymentRunModel';

const SCREEN = 'PaymentRunPage';
const QUICK_FUNDS = ['10 lakh', '25 lakh', '50 lakh', '1 crore'];
/** how many previous runs the History tab loads (newest first) */
const HISTORY_LIMIT = 500;
type Tab = 'pay' | 'history';
const TAB_KEY = 'paymentRun.tab';
const readTab = (): Tab => { try { return localStorage.getItem(TAB_KEY) === 'history' ? 'history' : 'pay'; } catch { return 'pay'; } };
type ListFilter = 'ALL' | 'PAYING' | 'WAITING' | 'OVERDUE' | 'MSME' | 'ADVANCE' | 'BANK_FAILED' | 'BLOCKED';
interface RunScope { key: string; com_sno: number | null; div_sno: number | null; brn_sno: number | null; label: string; entries: PaymentEntry[]; fileLines: number; total: number }

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
  const [portalPaid, setPortalPaid] = useState<PortalPayment[]>([]);   // recorded as paid on a supplier's portal (shown in history)
  const [loading, setLoading] = useState(true);
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* remembered for this visit only */ } };
  const [openRunId, setOpenRunId] = useState<number | null>(null);   // the past run open in the History side panel
  const showRun = (batch_sno: number) => { setTab('history'); setOpenRunId(batch_sno); };
  const [listFilter, setListFilter] = useState<ListFilter>('ALL');

  const [fundText, setFundText] = useState('');
  const [mode, setMode] = useState<PriorityMode>('MSME_FIRST');
  const [scopeKey, setScopeKey] = useState('');
  const [manual, setManual] = useState<Set<number> | null>(null);   // null = follow the fund plan
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payDate, setPayDate] = useState(() => localYmd(new Date()));
  // the company's bank accounts (Payment Bank master) the file can be paid from; read when the dialog opens so it is current
  // one entry per company/division/branch being paid: a run (and its file) is made for each
  const [senderState, setSenderState] = useState<Record<string, { list: PaymentSender[]; loading: boolean; error: string }>>({});
  const sendersReq = useRef(0);                      // only the newest read of the accounts may answer
  const [snapKey, setSnapKey] = useState('');        // what the open confirmation was opened for: companies + payments
  const [senderPick, setSenderPick] = useState<Record<string, string>>({});
  const [proceeding, setProceeding] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [cancelFor, setCancelFor] = useState<PaymentEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [e, b, p] = await Promise.all([
        axios.get(payNetEntries, { params: { view: 'run' } }),
        axios.get(payNetRunBatches, { params: { limit: HISTORY_LIMIT } }),
        // history still works without the portal list (e.g. before grn-service sql/69)
        axios.get(payNetPortalPayments, { params: { limit: HISTORY_LIMIT } }).catch(() => null),
      ]);
      setData(e.data?.data ?? EMPTY);
      setBatches(b.data?.data ?? []);
      if (p) setPortalPaid(p.data?.data ?? []);
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

  // A payment file and its sender master are scoped to one company/division/branch.
  const scopes = useMemo(() => {
    const m = new Map<string, { key: string; com_sno: number; div_sno: number; brn_sno: number; label: string }>();
    for (const e of data.entries) {
      if (e.com_sno == null || e.div_sno == null || e.brn_sno == null) continue;
      const key = `${e.com_sno}|${e.div_sno}|${e.brn_sno}`;
      m.set(key, {
        key, com_sno: e.com_sno, div_sno: e.div_sno, brn_sno: e.brn_sno,
        label: `${e.com_name ?? `Company ${e.com_sno}`} · Division ${e.div_sno} · Branch ${e.brn_sno}`,
      });
    }
    return [...m.values()];
  }, [data.entries]);
  // every approved payment is listed; narrowing to one company/division/branch is optional (a file still covers only one)
  const activeScope = scopes.length === 1 ? scopes[0] : scopes.find((s) => s.key === scopeKey) ?? null;
  const scoped = useMemo(() => activeScope
    ? data.entries.filter((e) => `${e.com_sno}|${e.div_sno}|${e.brn_sno}` === activeScope.key)
    : data.entries, [data.entries, activeScope]);
  // portal suppliers are not part of the fund plan or a bank file: they are paid on their portal and recorded below
  const visible = useMemo(() => scoped.filter((e) => e.channel !== 'PORTAL'), [scoped]);
  const portalEntries = useMemo(() => scoped.filter((e) => e.channel === 'PORTAL'), [scoped]);

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
  const changeScope = (key: string) => { setScopeKey(key); setManual(null); };

  const toggle = (e: PaymentEntry) => {
    if (blockReason(e)) return;
    const next = new Set(picked);
    // payments saved together (one group) are paid together: tick / untick the whole group
    const mates = e.group_sno ? ranked.filter((x) => x.group_sno === e.group_sno && !blockReason(x)) : [e];
    const on = !next.has(e.payment_sno);
    mates.forEach((x) => (on ? next.add(x.payment_sno) : next.delete(x.payment_sno)));
    setManual(next);
  };

  const pickedEntries = ranked.filter((e) => picked.has(e.payment_sno));
  const pickedTotal = totalOf(ranked, picked);
  const waitingTotal = ranked.reduce((s, e) => s + Number(e.net_paid || 0), 0);
  const overFund = pickedTotal > fundNum + 0.005;
  const notInFile = pickedEntries.filter((e) => !inBankFile(e));
  const fileLines = pickedEntries.length - notInFile.length;
  const blocked = ranked.filter((e) => blockReason(e));
  const waitingForFund = ranked.filter((e) => !picked.has(e.payment_sno) && !blockReason(e));
  const overdueCount = visible.filter((e) => e.is_overdue).length;
  const msmeCount = visible.filter((e) => e.msme_class).length;

  const advanceCount = visible.filter((e) => e.payment_type === 'ADVANCE').length;
  const bankFailedCount = visible.filter((e) => e.bank_failure).length;
  const inList = (e: PaymentEntry): boolean => {
    switch (listFilter) {
      case 'PAYING': return picked.has(e.payment_sno);
      case 'WAITING': return !picked.has(e.payment_sno) && !blockReason(e);
      case 'OVERDUE': return !!e.is_overdue;
      case 'MSME': return !!e.msme_class;
      case 'ADVANCE': return e.payment_type === 'ADVANCE';
      case 'BANK_FAILED': return !!e.bank_failure;
      case 'BLOCKED': return !!blockReason(e);
      default: return true;
    }
  };
  const listOptions = ([
    { value: 'ALL', label: 'All', count: ranked.length },
    { value: 'PAYING', label: 'Paying today', count: picked.size },
    { value: 'WAITING', label: 'Waiting for fund', count: waitingForFund.length },
    { value: 'OVERDUE', label: 'Overdue', count: overdueCount },
    { value: 'MSME', label: 'MSME', count: msmeCount },
    { value: 'ADVANCE', label: 'Advances', count: advanceCount },
    { value: 'BANK_FAILED', label: 'Not paid by bank', count: bankFailedCount },
    { value: 'BLOCKED', label: 'Cannot pay', count: blocked.length },
  ] as { value: ListFilter; label: string; count: number }[]).filter((o) => o.value === 'ALL' || o.count > 0 || o.value === listFilter);
  const q = search.trim().toLowerCase();
  const shown = ranked.filter((e) => inList(e) && (!q
    || [e.vendor_name, e.payment_no, e.supp_code, e.po_nos, e.invoice_nos, e.supplier_invoice_nos, e.grn_nos, e.gate_entry_nos].some((v) => String(v ?? '').toLowerCase().includes(q))));
  const today = localYmd(new Date());
  const month = monthSummary(toHistoryItems(batches, portalPaid), today);
  const lastRun = batches[0] ?? null;
  const usedPct = fundNum > 0 ? Math.round((pickedTotal / fundNum) * 100) : 0;

  const toggleOpen = (id: number) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // The ticked payments may belong to several companies / branches. A bank file is made for one company's account, so the
  // run is split: one run + one file per company/division/branch, all created by the one click.
  const scopeKeyOf = (e: PaymentEntry) => `${e.com_sno}|${e.div_sno}|${e.brn_sno}`;
  const runScopes: RunScope[] = [];
  for (const e of pickedEntries) {
    const key = scopeKeyOf(e);
    let sc = runScopes.find((x) => x.key === key);
    if (!sc) {
      const made: RunScope = { key, com_sno: e.com_sno, div_sno: e.div_sno, brn_sno: e.brn_sno, label: `${e.com_name ?? `Company ${e.com_sno}`} · Division ${e.div_sno} · Branch ${e.brn_sno}`, entries: [], fileLines: 0, total: 0 };
      runScopes.push(made);
      sc = made;
    }
    sc.entries.push(e);
    sc.total += Number(e.net_paid) || 0;
    if (inBankFile(e)) sc.fileLines += 1;
  }
  const multiScope = runScopes.length > 1;
  const senderOf = (sc: RunScope) => pickSender(senderState[sc.key]?.list ?? [], senderPick[sc.key] ?? '');
  const problemOf = (sc: RunScope) => senderProblem(sc.fileLines, senderState[sc.key]?.list ?? [], senderPick[sc.key] ?? '');
  const sendersLoading = runScopes.some((sc) => senderState[sc.key]?.loading);
  const sendersError = runScopes.map((sc) => senderState[sc.key]?.error).find(Boolean) ?? '';
  const blockedBySender = runScopes.map(problemOf).find(Boolean) ?? null;
  const currentKey = `${runScopes.map((x) => x.key).join(';')}|${pickedEntries.map((e) => e.payment_sno).join(',')}`;
  // The list can reload under an open confirmation (live updates): then what it was opened for is no longer what would be paid.
  const stale = confirmOpen && snapKey !== '' && snapKey !== currentKey;

  const loadSenders = async () => {
    const mine = ++sendersReq.current;
    const wanted = runScopes.filter((sc) => sc.fileLines > 0);
    setSenderState(Object.fromEntries(wanted.map((sc) => [sc.key, { list: [], loading: true, error: '' }])));
    await Promise.all(wanted.map(async (sc) => {
      let next = { list: [] as PaymentSender[], loading: false, error: '' };
      try {
        const res = await axios.get(payNetRunSenders, { params: { com_sno: sc.com_sno, div_sno: sc.div_sno, brn_sno: sc.brn_sno } });
        next = { ...next, list: res.data?.data ?? [] };
      } catch (err) {
        next = { ...next, error: getErrorMessage(err, `Could not read the bank accounts of ${sc.label}`) };
      }
      if (mine === sendersReq.current) setSenderState((prev) => ({ ...prev, [sc.key]: next }));
    }));
  };

  const openConfirm = async () => {
    setPayDate(localYmd(new Date()));
    setSenderPick({});
    setSnapKey(currentKey);
    setConfirmOpen(true);
    await loadSenders();
  };

  // Each company's share of the day's fund plan, in proportion to what it pays (the shares add up to the fund plan).
  const fundShares = (): number[] => {
    const shares: number[] = [];
    let used = 0;
    runScopes.forEach((sc, i) => {
      const raw = i === runScopes.length - 1 ? fundNum - used : Math.round((fundNum * sc.total / (pickedTotal || 1)) * 100) / 100;
      const share = Math.max(Math.round(raw * 100) / 100, Math.round(sc.total * 100) / 100);
      shares.push(share);
      used += share;
    });
    return shares;
  };

  const proceed = async () => {
    setProceeding(true);
    const made: RunResult[] = [];
    const shares = fundShares();
    try {
      for (const [i, sc] of runScopes.entries()) {
        const sender = senderOf(sc);
        const res = await axios.post(payNetRunProceed, {
          payment_snos: sc.entries.map((e) => e.payment_sno),   // in priority order: the order of the lines in the file
          fund_plan_amount: runScopes.length === 1 ? fundNum : shares[i],
          payment_date: payDate,
          payment_bank_sno: sc.fileLines > 0 && sender ? sender.payment_bank_sno : undefined,
        });
        const run: RunResult = res.data?.data;
        made.push(run);
        if (run.file.line_count) saveFile(run.file);
      }
      setConfirmOpen(false);
      setResults(made);
      setManual(null);
      toast.success(made.length === 1 ? `Payment run ${made[0].batch.batch_no} created${made[0].file.line_count ? ' - file downloaded' : ''}` : `${made.length} payment runs created - ${made.filter((r) => r.file.line_count).length} file(s) downloaded`);
      await load();
    } catch (err) {
      const message = getErrorMessage(err, 'Could not create the payment run');
      const done = made.length > 0 ? ` ${made.length} of ${runScopes.length} run(s) were already created (${made.map((r) => r.batch.batch_no).join(', ')}); the rest were not.` : '';
      toast.error(message + done);
      if (made.length > 0) { setConfirmOpen(false); setResults(made); setManual(null); }
      else if (/was created/.test(message)) { setConfirmOpen(false); setManual(null); }   // paid, only the file failed: do not offer the same payments again
      await load();   // most often a payment another user just paid or cancelled
    } finally {
      setProceeding(false);
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
  // one line of the fund meter's legend
  const legend = (dot: string, label: string, value: React.ReactNode, hint: React.ReactNode, onClick?: () => void) => (
    <button
      type="button" onClick={onClick} disabled={!onClick}
      className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-card disabled:cursor-default"
    >
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-bold tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
  const TABS: { key: Tab; label: string; short: string; icon: typeof Send; count: number }[] = [
    { key: 'pay', label: 'Make payment', short: 'Pay', icon: Send, count: visible.length },
    { key: 'history', label: 'Payment history', short: 'History', icon: History, count: batches.length + portalPaid.length },
  ];

  const fundPill = (e: PaymentEntry) => {
    if (picked.has(e.payment_sno)) return <StatusPill tone="success">Paying today</StatusPill>;
    if (blockReason(e)) return <StatusPill tone="danger">Bank details missing</StatusPill>;
    if (plan.verdict.get(e.payment_sno) === 'SHORT') return <StatusPill tone="warning">Needs {rupees(plan.needs.get(e.payment_sno))} more</StatusPill>;
    return <StatusPill tone="neutral">Not selected</StatusPill>;
  };

  const detailRow = (e: PaymentEntry) => {
    const lines = linesBy.get(e.payment_sno) ?? [];
    const isAdvance = e.payment_type === 'ADVANCE';
    return (
      <TableRow key={`${e.payment_sno}-detail`} className="bg-muted/20 hover:bg-muted/20">
        <TableCell colSpan={10} className="p-0">
          <div className="space-y-3 px-4 py-3 sm:px-6">
            {isAdvance ? (
              <Callout tone="info" icon={Info}>
                Advance agreed on the quotation of PO <b>{e.po_nos ?? '—'}</b>{e.adv_stage_no && e.adv_stage_no > 1 ? ` (stage ${e.adv_stage_no})` : ''}. It fell due when the PO was approved.
                Once paid it is held as the supplier's advance, and the Payment screen nets it off the PO's bills.
              </Callout>
            ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>Supplier invoice</TableHead>
                    <TableHead className={th}>PO</TableHead>
                    <TableHead className={th}>Gate entry</TableHead>
                    <TableHead className={th}>GRN</TableHead>
                    <TableHead className={th}>Due</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Invoice amount paying</TableHead>
                    <TableHead className={cn(th, 'text-right')}>GST held</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.invoice_sno}>
                      <TableCell className="text-xs font-medium">{l.supplier_invoice_no || <span className="font-normal text-muted-foreground">Not entered</span>}<p className="font-normal text-muted-foreground">{showDate(l.invoice_date)}</p></TableCell>
                      <TableCell className="text-xs">{l.po_no ?? '—'}</TableCell>
                      <TableCell className="text-xs">{showDate(l.gate_entry_date)}<p className="text-muted-foreground">{l.gate_entry_nos ?? ''}</p></TableCell>
                      <TableCell className="text-xs">{showDate(l.grn_date)}<p className="text-muted-foreground">{l.grn_nos ?? ''}</p></TableCell>
                      <TableCell className="text-xs">{showDate(l.due_date)}</TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">{rupees(l.amount)}</TableCell>
                      <TableCell className={cn('text-right text-xs tabular-nums', Number(l.gst_held) > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                        {Number(l.gst_held) > 0 ? rupees(l.gst_held) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
            <div className="max-w-md overflow-hidden rounded-lg border bg-card text-xs">
              <p className="border-b bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment breakup</p>
              <dl className="divide-y">
                <div className="flex justify-between gap-3 px-3 py-2"><dt>Gross (invoices being paid)</dt><dd className="font-semibold tabular-nums">{rupees(e.gross_amount)}</dd></div>
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Less TDS</dt><dd className="tabular-nums">- {rupees(e.tds_amount)}</dd></div>
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Less advance adjusted</dt><dd className="tabular-nums">- {rupees(e.advance_adjusted)}</dd></div>
                <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Less debit / credit notes</dt><dd className="tabular-nums">- {rupees(e.note_adjusted)}</dd></div>
                <div className="flex justify-between gap-3 bg-muted/30 px-3 py-2 text-sm font-semibold"><dt>Net payable</dt><dd className="tabular-nums">{rupees(e.net_paid)}</dd></div>
                {Number(e.gst_held) > 0 && (
                  <div className="flex justify-between gap-3 bg-red-50 px-3 py-2 font-semibold text-red-600 dark:bg-red-950/20 dark:text-red-400">
                    <dt>GST held - not paid now<span className="block text-[11px] font-normal">Paid after the invoice shows in GSTR-2B</span></dt>
                    <dd className="tabular-nums">{rupees(e.gst_held)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
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
            {e.bank_failure && <BankFailureBox entry={e} canChange={canProceed} onChanged={load} />}
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
        stats={[
          { label: 'Waiting', value: visible.length, icon: Wallet },
          { label: 'Waiting amount', value: `₹${amountInWords(waitingTotal) || Math.round(waitingTotal).toLocaleString('en-IN')}`, icon: Banknote },
          { label: 'Overdue', value: overdueCount, icon: CalendarClock },
          { label: 'MSME suppliers', value: msmeCount, icon: Info },
          { label: 'Paid this month', value: compactRupees(month.thisMonth.amount), icon: History },
        ]}
      >
        <Button
          variant="outline" size="sm"
          className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          onClick={load} disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'mr-1 animate-spin' : 'mr-1'} /> Refresh
        </Button>
      </PageHeader>

      <div className="container mx-auto space-y-6 px-4 pb-6 pt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <nav role="tablist" aria-label="Payment Run sections" className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto">
            {TABS.map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                  className={cn(
                    'inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:px-4',
                    active ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground/10 px-1.5 text-[11px] font-semibold tabular-nums text-foreground/70">{t.count}</span>
                </button>
              );
            })}
          </nav>
          {tab === 'pay' && lastRun && (
            <button
              type="button" onClick={() => showRun(lastRun.batch_sno)}
              className="group inline-flex min-w-0 items-center gap-2 self-start rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground sm:self-auto"
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Last run <b className="font-semibold text-foreground">{lastRun.batch_no}</b> · {showDate(lastRun.batch_date)} · {rupees(lastRun.total_amount)}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {tab === 'history' ? (
          <PaymentHistoryTab runs={batches} portal={portalPaid} loading={loading} limit={HISTORY_LIMIT} openRunId={openRunId} onOpenRun={setOpenRunId}
            canUpload={canProceed} onChanged={load} />
        ) : (<>
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
              {scopes.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment scope</Label>
                  <Select value={activeScope?.key ?? 'ALL'} onValueChange={(v) => changeScope(v === 'ALL' ? '' : v)}>
                    <SelectTrigger className="h-10 w-full" aria-label="Payment scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All companies / branches</SelectItem>
                      {scopes.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Pick one to look at a single company. Payments of several companies can be paid together - each gets its own run and file.</p>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-muted-foreground">
                  <span className={cn('text-2xl font-bold tabular-nums', overFund ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{rupees(pickedTotal)}</span>
                  {' '}{fund == null ? 'selected · no fund entered yet' : `of ${rupees(fundNum)} fund`}
                </p>
                <p className={cn('text-xs font-medium tabular-nums', overFund ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {fund == null ? "Enter today's fund to plan the run" : overFund ? `${rupees(pickedTotal - fundNum)} over the fund` : `${usedPct}% used · ${rupees(fundNum - pickedTotal)} left`}
                </p>
              </div>
              <div role="progressbar" aria-label="Fund used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, usedPct)} className="h-2.5 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border">
                <div className={cn('h-full rounded-full transition-all', overFund ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${fundNum > 0 ? Math.min(100, (pickedTotal / fundNum) * 100) : 0}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
                {legend('bg-emerald-500', 'Paying today', `${picked.size} · ${compactRupees(pickedTotal)}`, rupees(pickedTotal), picked.size ? () => setListFilter('PAYING') : undefined)}
                {legend('bg-amber-500', 'Waiting for fund', `${waitingForFund.length} · ${compactRupees(waitingForFund.reduce((s, e) => s + Number(e.net_paid || 0), 0))}`, waitingForFund.length ? 'Not covered by the fund' : 'Nothing left out', waitingForFund.length ? () => setListFilter('WAITING') : undefined)}
                {legend('bg-red-500', 'Cannot pay yet', blocked.length, blocked.length ? 'Bank details missing' : 'All payable', blocked.length ? () => setListFilter('BLOCKED') : undefined)}
                {legend('bg-muted-foreground/40', 'All waiting', `${visible.length} · ${compactRupees(waitingTotal)}`, rupees(waitingTotal), () => setListFilter('ALL'))}
              </div>
            </div>
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
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
            <FilterChips options={listOptions} value={listFilter} onChange={setListFilter} />
            <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, payment, PO, invoice, GRN…" className="w-full xl:max-w-sm" />
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
            // @container: the detail row's boxes size themselves to the visible width (cqw) while the table scrolls sideways
            <div className="@container overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-10" />
                    <TableHead className={cn(th, 'w-10')}>#</TableHead>
                    <TableHead className={th}>Supplier / invoice</TableHead>
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
                            <span className="block font-semibold">
                              {e.vendor_name ?? '—'}
                              {e.payment_type === 'ADVANCE' && <span className={cn('ml-1.5 inline-flex items-center rounded-md border px-1.5 py-px align-middle text-[10px] font-medium', TONE.violet)} title="Advance on an approved PO - not a bill">Advance</span>}
                            </span>
                            <span className="block text-muted-foreground" title="Supplier invoice no.">
                              {e.payment_type === 'ADVANCE' ? 'Advance' : `Invoice ${e.supplier_invoice_nos || 'no. not entered'}`}{e.po_nos ? ` · PO ${e.po_nos}` : ''}
                            </span>
                            {notInFileReason(e) && <span className="mt-1 inline-block rounded border bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{notInFileReason(e)}</span>}
                            {e.bank_failure && (
                              <button type="button" onClick={() => { if (!isOpen) toggleOpen(e.payment_sno); }} title={bankFailureText(e.bank_failure)}
                                className={cn('mt-1 flex max-w-64 items-center gap-1 truncate rounded border px-1.5 py-px text-left text-[10px] font-medium', TONE.danger)}>
                                <XCircle className="h-3 w-3 shrink-0" /><span className="truncate">Not paid by bank{e.bank_failure.bank_reason ? ` · ${e.bank_failure.bank_reason}` : ''}</span>
                              </button>
                            )}
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
                            {Number(e.gst_held) > 0 && <span className="block font-medium text-red-600 dark:text-red-400" title="GST kept back until the invoice shows in GSTR-2B">GST held {rupees(e.gst_held)}</span>}
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
                  {fund == null ? "Enter today's fund plan above" : overFund ? `${rupees(pickedTotal - fundNum)} more than the fund - untick some payments` : `${rupees(fundNum - pickedTotal)} of the fund left`}{multiScope ? ` · ${runScopes.length} companies / branches - a separate run and file for each` : ''}
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

        <PortalPaymentsSection entries={portalEntries} canRecord={canProceed} onRecorded={load} paidCount={portalPaid.length} onShowPaid={() => setTab('history')} />
        </>)}
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
          {runScopes.filter((sc) => sc.fileLines > 0).map((sc) => {
            const st = senderState[sc.key];
            const sender = senderOf(sc);
            const problem = problemOf(sc);
            return (
              <div key={sc.key} className="space-y-1.5">
                <Label className="text-xs">{multiScope ? `Pay from - ${sc.label} (${sc.fileLines} line${sc.fileLines === 1 ? '' : 's'}, ${rupees(sc.total)})` : 'Pay from'}</Label>
                {!st || st.loading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading the company's bank accounts…</p>
                ) : st.error ? (
                  <Callout tone="danger" icon={AlertTriangle}>
                    {st.error}.{' '}<button type="button" className="font-semibold underline" onClick={loadSenders}>Try again</button>
                  </Callout>
                ) : st.list.length === 0 ? (
                  <Callout tone="danger" icon={AlertTriangle}>{problem}</Callout>
                ) : (
                  <>
                    <Select value={sender ? String(sender.payment_bank_sno) : ''} onValueChange={(v) => setSenderPick((prev) => ({ ...prev, [sc.key]: v }))}>
                      <SelectTrigger className="h-10 w-full" aria-label={`Pay from - ${sc.label}`}><SelectValue placeholder="Choose the bank account" /></SelectTrigger>
                      <SelectContent>
                        {st.list.map((x) => <SelectItem key={x.payment_bank_sno} value={String(x.payment_bank_sno)}>{senderLabel(x)}{x.is_default === 'Y' ? ' · default' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className={cn('text-xs', sender ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                      {sender ? `Bank upload file for ${sender.bank_name} (client code ${sender.client_code}; daily file numbers start at .${sender.file_code}). Each supplier's account, IFSC and bank come from their KYC.` : problem}
                    </p>
                  </>
                )}
              </div>
            );
          })}
          {multiScope && (
            <Callout tone="info" icon={Info}>
              The ticked payments belong to {runScopes.length} companies / branches. One payment run and one bank file is created for each ({runScopes.map((x) => x.label).join(' | ')}),
              and the fund plan is split between them in proportion to what each pays.
            </Callout>
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
      <Dialog open={results != null} onOpenChange={(o) => { if (!o) setResults(null); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
          <DialogHeader className="flex-row items-start gap-3 text-left">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border', TONE.success)}><CheckCircle2 className="h-5 w-5" /></span>
            <div className="min-w-0 space-y-1 pr-6">
              <DialogTitle>{results && results.length > 1 ? `${results.length} payment runs created` : `Payment run ${results?.[0]?.batch.batch_no} created`}</DialogTitle>
              <DialogDescription>
                {results?.reduce((t, r) => t + r.items.length, 0)} payment{results?.reduce((t, r) => t + r.items.length, 0) === 1 ? '' : 's'} · {rupees(results?.reduce((t, r) => t + Number(r.batch.total_amount || 0), 0))} paid.
              </DialogDescription>
            </div>
          </DialogHeader>
          {(results ?? []).map((result) => (
            <div key={result.batch.batch_no} className="space-y-3">
              {results && results.length > 1 && (
                <p className="text-sm font-semibold">{result.batch.batch_no} · {rupees(result.batch.total_amount)} · {result.items.length} payment{result.items.length === 1 ? '' : 's'}</p>
              )}
              {result.file.line_count ? (
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
              {result.verification && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">Check sheet for the bank upload</p>
                    <p className="text-xs text-muted-foreground">
                      Invoice-wise: what each transfer pays, part payments, TDS and what is left. The auditor / payment inputter checks the bank's screen against it - the bank only shows the file's lines.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => saveFile(result.verification!)}><ClipboardCheck className="mr-1.5 h-4 w-4" />Download check sheet</Button>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Not in the file - pay these separately</p>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableBody>
                        {result.skipped.map((sk) => (
                          <TableRow key={sk.payment_no}>
                            <TableCell className="text-xs"><span className="font-medium">{sk.vendor_name ?? sk.payment_no}</span><span className="block text-muted-foreground">{sk.payment_no} · {sk.reason}</span></TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(sk.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ))}
          <DialogFooter className="gap-2 sm:gap-2">
            {results?.[0]?.batch.batch_sno != null && (
              <Button type="button" variant="outline" onClick={() => { const id = results[0].batch.batch_sno; setResults(null); showRun(id); }}>
                <History className="mr-1.5 h-4 w-4" />View in history
              </Button>
            )}
            <Button type="button" onClick={() => setResults(null)}>Done</Button>
          </DialogFooter>
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
