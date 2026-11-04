import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, Building2, CheckCircle2, Download, ExternalLink, Globe, History, Info, Landmark, Loader2, Pencil, Plus, RefreshCw, Users, Wallet, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  STATUTORY_ONLINE_MODES, payNetRunSenders, payNetStatutoryOnlinePay, payNetStatutoryPayables, payNetStatutoryPayablesCancel, payNetStatutoryPayees, payNetStatutoryRun,
  payNetStatutoryRunFile, payNetStatutoryRuns,
  type GstHeldRow, type PaymentFile, type PaymentSender, type StatutoryBatch, type StatutoryKind, type StatutoryOnlineResult, type StatutoryPayable,
  type StatutoryPayableInput, type StatutoryPayee, type StatutoryPayeeInput, type StatutoryRunResult,
} from '@/Services/GrnService/paymentNetApi';
import { KINDS, amountProblem, channelOf, dueState, onlineProblem, payeeLabel, payeeProblem, portalUrl, runProblem, scopeLabel, totalOf } from './statutoryModel';
import { pickSender, rupees, senderLabel, senderProblem } from './paymentRunModel';

const SCREEN = 'StatutoryPaymentPage';
const th = 'text-xs';

const ymd = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');
const showDate = (d: string | null | undefined) => {
  const s = ymd(d);
  if (!s) return '—';
  const p = new Date(`${s}T00:00:00`);
  return Number.isNaN(p.getTime()) ? s : p.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const saveFile = (f: PaymentFile) => downloadTextFile(f.file_name, f.content, f.mime_type);
const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_PAYEE: StatutoryPayeeInput = {
  kind: 'TDS', payee_name: '', pay_via_portal: false, ac_number: '', ifsc: '', bank_name: '', branch_name: '', reference_no: '', pay_mode: 'NEFT',
  payment_portal_name: '', payment_portal_url: '', payment_instructions: '', is_default: true, is_active: true,
};
const EMPTY_AMOUNT = { head_name: '', ref_no: '', period_label: '', amount: '', due_date: '', narration: '', payee_sno: '', scope: '' };
const EMPTY_ONLINE = { mode: '', txnId: '', txnDate: '', remarks: '' };

/** A portal address as a link that opens in a new tab. */
const PortalLink: React.FC<{ url: string | null | undefined; name?: string | null; className?: string }> = ({ url, name, className }) => (url ? (
  <a href={portalUrl(url)} target="_blank" rel="noreferrer" className={cn('inline-flex items-center gap-1 font-medium text-primary hover:underline', className)}>
    <span className="truncate">{name || 'Open portal'}</span><ExternalLink className="h-3 w-3 shrink-0" />
  </a>
) : <span className={className}>{name || '—'}</span>);

/** Bank account vs online payment - the first choice when adding a payee (as the Supplier KYC asks a supplier). */
const PayChannelChooser: React.FC<{ online: boolean; onChange: (online: boolean) => void }> = ({ online, onChange }) => {
  const opts = [
    { value: false, icon: Building2, title: 'Bank account', hint: 'Paid by NEFT / RTGS in the statutory bank file' },
    { value: true, icon: Globe, title: 'Online payment', hint: 'Paid on a website / portal (Income Tax e-Pay, GST portal …) - no bank account' },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How is this payee paid?">
      {opts.map((o) => (
        <button
          key={String(o.value)} type="button" role="radio" aria-checked={online === o.value} onClick={() => onChange(o.value)}
          className={cn('flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors', online === o.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50')}
        >
          <o.icon className={cn('mt-0.5 h-4 w-4 shrink-0', online === o.value ? 'text-primary' : 'text-muted-foreground')} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{o.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
};

/**
 * What is owed to the government and others - TDS, GST and the rest - paid in its own run with its own bank file, apart from the
 * supplier Payment Run. TDS fills itself from the supplier payments that deducted it; GST and other amounts are keyed in.
 */
const StatutoryPaymentPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const canPay = canCreate(SCREEN) || canEdit(SCREEN);
  const canManage = canEdit(SCREEN) || canCreate(SCREEN);

  const [kind, setKind] = useState<StatutoryKind>('TDS');
  const [all, setAll] = useState<StatutoryPayable[]>([]);
  const [gstHeld, setGstHeld] = useState<GstHeldRow[]>([]);
  const [runs, setRuns] = useState<StatutoryBatch[]>([]);
  const [payees, setPayees] = useState<StatutoryPayee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [showPaid, setShowPaid] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [p, r, y] = await Promise.all([
        axios.get(payNetStatutoryPayables), axios.get(payNetStatutoryRuns), axios.get(payNetStatutoryPayees),
      ]);
      setAll(p.data?.data?.payables ?? []);
      setPayees(y.data?.data ?? []);
      setRuns(r.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the statutory payments'));
    } finally {
      setLoading(false);
    }
  }, []);
  // the GST held on supplier bills is only asked for with kind=GST
  const fetchGstHeld = useCallback(async () => {
    const res = await axios.get(payNetStatutoryPayables, { params: { kind: 'GST', status: 'Open' } }).catch(() => null);
    setGstHeld(res?.data?.data?.gstHeld ?? []);
  }, []);
  const load = useCallback(async () => { setLoading(true); await Promise.all([fetchAll(), fetchGstHeld()]); }, [fetchAll, fetchGstHeld]);
  useEffect(() => { fetchAll(); fetchGstHeld(); }, [fetchAll, fetchGstHeld]);

  const changeKind = (k: string) => { setKind(k as StatutoryKind); setPicked(new Set()); setSearch(''); };

  const ofKind = useMemo(() => all.filter((p) => p.kind === kind), [all, kind]);
  const open = useMemo(() => ofKind.filter((p) => p.status === 'Open'), [ofKind]);
  const paid = useMemo(() => ofKind.filter((p) => p.status === 'Paid'), [ofKind]);
  const q = search.trim().toLowerCase();
  const matches = (p: StatutoryPayable) => !q || [p.head_name, p.ref_no, p.party_name, p.payee_name, p.payment_no, p.period_label, p.batch_no].some((v) => String(v ?? '').toLowerCase().includes(q));
  const shownOpen = open.filter(matches);
  const shownPaid = paid.filter(matches);
  const kindRuns = runs.filter((r) => r.kind === kind);

  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k.value, all.filter((p) => p.kind === k.value && p.status === 'Open').length])) as Record<StatutoryKind, number>, [all]);
  const openTotal = open.reduce((s, p) => s + Number(p.amount), 0);
  const overdue = open.filter((p) => (p.days_overdue ?? 0) > 0);
  const pickedList = open.filter((p) => picked.has(p.stat_sno));
  const pickedTotal = totalOf(open, picked);
  const problem = runProblem(pickedList);
  // the ticked amounts' payee is paid online: they are recorded after paying on its portal, not written to a bank file
  const pickedOnline = pickedList.length > 0 && !problem && channelOf(pickedList[0]) === 'ONLINE';
  const kindPayees = payees.filter((y) => y.kind === kind && y.is_active === 'Y');
  const noPayee = open.length > 0 && kindPayees.length === 0;

  const toggle = (id: number) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visibleIds = shownOpen.map((p) => p.stat_sno);
  const allTicked = visibleIds.length > 0 && visibleIds.every((id) => picked.has(id));
  const toggleAll = () => setPicked(allTicked ? new Set() : new Set(visibleIds));

  // ── pay ───────────────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payDate, setPayDate] = useState(today());
  const [senders, setSenders] = useState<PaymentSender[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);
  const [sendersError, setSendersError] = useState('');
  const sendersReq = useRef(0);
  const [senderSno, setSenderSno] = useState('');
  const [snapKey, setSnapKey] = useState('');
  const [proceeding, setProceeding] = useState(false);
  const [result, setResult] = useState<StatutoryRunResult | null>(null);
  const currentKey = pickedList.map((p) => p.stat_sno).join(',');
  const stale = confirmOpen && snapKey !== '' && snapKey !== currentKey;
  const sender = pickSender(senders, senderSno);
  const blockedBySender = senderProblem(pickedList.length, senders, senderSno);

  const loadSenders = async () => {
    const first = pickedList[0];
    const mine = ++sendersReq.current;
    setSenders([]); setSendersError(''); setSendersLoading(true);
    try {
      const res = await axios.get(payNetRunSenders, { params: first ? { com_sno: first.com_sno ?? undefined, div_sno: first.div_sno ?? undefined, brn_sno: first.brn_sno ?? undefined } : undefined });
      if (mine === sendersReq.current) setSenders(res.data?.data ?? []);
    } catch (err) {
      if (mine === sendersReq.current) setSendersError(getErrorMessage(err, 'Could not read the bank accounts to pay from'));
    } finally {
      if (mine === sendersReq.current) setSendersLoading(false);
    }
  };
  const openConfirm = async () => {
    setPayDate(today()); setSenderSno(''); setSnapKey(currentKey); setConfirmOpen(true);
    await loadSenders();
  };
  const proceed = async () => {
    setProceeding(true);
    try {
      const res = await axios.post(payNetStatutoryRun, { stat_snos: pickedList.map((p) => p.stat_sno), payment_date: payDate, payment_bank_sno: sender?.payment_bank_sno });
      const run: StatutoryRunResult = res.data?.data;
      setConfirmOpen(false); setResult(run); setPicked(new Set());
      saveFile(run.file);
      toast.success(`Statutory run ${run.batch.batch_no} created - file downloaded`);
      await load();
    } catch (err) {
      const message = getErrorMessage(err, 'Could not create the statutory run');
      toast.error(message);
      if (/was created/.test(message)) { setConfirmOpen(false); setPicked(new Set()); }   // paid, only the file failed: do not offer the same amounts again
      await load();
    } finally {
      setProceeding(false);
    }
  };

  // ── record an online payment (payee paid on its portal) ─────────────────────
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [onlineForm, setOnlineForm] = useState(EMPTY_ONLINE);
  const [recording, setRecording] = useState(false);
  const onlineStale = onlineOpen && snapKey !== '' && snapKey !== currentKey;
  const onlinePayee = pickedList[0];
  const onlineFormProblem = onlineProblem(onlineForm, today());
  const openOnline = () => { setOnlineForm({ ...EMPTY_ONLINE, txnDate: today() }); setSnapKey(currentKey); setOnlineOpen(true); };
  const recordOnline = async () => {
    setRecording(true);
    try {
      const res = await axios.post(payNetStatutoryOnlinePay, {
        stat_snos: pickedList.map((p) => p.stat_sno), txn_mode: onlineForm.mode, txn_id: onlineForm.txnId.trim(), txn_date: onlineForm.txnDate,
        remarks: onlineForm.remarks.trim() || undefined,
      });
      const rec: StatutoryOnlineResult = res.data?.data;
      setOnlineOpen(false); setPicked(new Set());
      toast.success(`${rec.batch.batch_no} recorded - ${rec.items.length} amount${rec.items.length === 1 ? '' : 's'} (${rupees(rec.batch.total_amount)}) marked paid`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not record the online payment'));
      await load();
    } finally {
      setRecording(false);
    }
  };

  const [downloading, setDownloading] = useState<number | null>(null);
  const downloadRun = async (b: StatutoryBatch) => {
    setDownloading(b.batch_sno);
    try {
      const res = await axios.get(payNetStatutoryRunFile(b.batch_sno));
      saveFile(res.data?.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not download the file'));
    } finally {
      setDownloading(null);
    }
  };

  // ── key in a GST / other amount ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_AMOUNT);
  const [saving, setSaving] = useState(false);
  const [scopes, setScopes] = useState<PaymentSender[]>([]);
  const comScopes = useMemo(() => {
    const m = new Map<string, PaymentSender>();
    for (const s of scopes) m.set(`${s.com_sno}|${s.div_sno}|${s.brn_sno}`, s);
    return [...m.entries()];
  }, [scopes]);
  const openAdd = async () => {
    setForm({ ...EMPTY_AMOUNT, head_name: kind === 'GST' ? 'GST payable' : '' });
    setAddOpen(true);
    try {
      const res = await axios.get(payNetRunSenders);
      const list: PaymentSender[] = res.data?.data ?? [];
      setScopes(list);
      const keys = new Set(list.map((s) => `${s.com_sno}|${s.div_sno}|${s.brn_sno}`));
      if (keys.size === 1) setForm((f) => ({ ...f, scope: [...keys][0] }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not read the companies'));
    }
  };
  const [comStr] = form.scope.split('|');
  const addProblem = amountProblem({ head_name: form.head_name, amount: form.amount, com_sno: comStr ?? '' });
  const saveAmount = async () => {
    const [com, div, brn] = form.scope.split('|').map(Number);
    setSaving(true);
    try {
      const body: StatutoryPayableInput = {
        kind: kind as Exclude<StatutoryKind, 'TDS'>, head_name: form.head_name.trim(), ref_no: form.ref_no.trim() || undefined, period_label: form.period_label.trim() || undefined,
        amount: Number(form.amount), due_date: form.due_date || undefined, narration: form.narration.trim() || undefined,
        payee_sno: form.payee_sno ? Number(form.payee_sno) : undefined, com_sno: com, div_sno: div, brn_sno: brn,
      };
      await axios.post(payNetStatutoryPayables, body);
      toast.success(`${body.head_name} added - ${rupees(body.amount)}`);
      setAddOpen(false);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the amount'));
    } finally {
      setSaving(false);
    }
  };

  const [cancelFor, setCancelFor] = useState<StatutoryPayable | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const cancelAmount = async () => {
    if (!cancelFor) return;
    setCancelling(true);
    try {
      await axios.post(payNetStatutoryPayablesCancel, { stat_sno: cancelFor.stat_sno, reason: cancelReason.trim() });
      toast.success(`${cancelFor.head_name} cancelled`);
      setCancelFor(null); setCancelReason('');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel the amount'));
    } finally {
      setCancelling(false);
    }
  };

  // ── payees ────────────────────────────────────────────────────────────────
  const [payeesOpen, setPayeesOpen] = useState(false);
  const [pf, setPf] = useState<StatutoryPayeeInput>(EMPTY_PAYEE);
  const [savingPayee, setSavingPayee] = useState(false);
  const pfProblem = payeeProblem(pf);
  const editPayee = (y: StatutoryPayee) => setPf({
    payee_sno: y.payee_sno, kind: y.kind, payee_name: y.payee_name, pay_via_portal: y.pay_via_portal === 'Y',
    ac_number: y.ac_number ?? '', ifsc: y.ifsc ?? '', bank_name: y.bank_name ?? '', branch_name: y.branch_name ?? '', pay_mode: y.pay_mode,
    payment_portal_name: y.payment_portal_name ?? '', payment_portal_url: y.payment_portal_url ?? '', payment_instructions: y.payment_instructions ?? '',
    reference_no: y.reference_no ?? '', is_default: y.is_default === 'Y', is_active: y.is_active === 'Y',
  });
  const savePayee = async () => {
    setSavingPayee(true);
    try {
      await axios.post(payNetStatutoryPayees, pf.pay_via_portal
        ? { ...pf, payment_portal_name: pf.payment_portal_name.trim(), payment_portal_url: portalUrl(pf.payment_portal_url) }
        : { ...pf, ac_number: pf.ac_number.replace(/\s+/g, ''), ifsc: pf.ifsc.trim().toUpperCase() });
      toast.success(`${pf.payee_name} saved`);
      setPf({ ...EMPTY_PAYEE, kind });
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the payee'));
    } finally {
      setSavingPayee(false);
    }
  };

  const kindInfo = KINDS.find((k) => k.value === kind)!;
  const overdueTotal = overdue.reduce((s, p) => s + Number(p.amount), 0);
  const isTds = kind === 'TDS';

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <PageHeader
        icon={Landmark}
        title="Statutory Payments"
        stats={[
          { label: `${kindInfo.short} open`, value: open.length, icon: Wallet },
          { label: 'Overdue', value: overdue.length, icon: AlertTriangle },
          { label: 'Open amount', value: rupees(openTotal), icon: Landmark },
          { label: 'Paid runs', value: kindRuns.length, icon: History },
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

      <div className="container mx-auto space-y-6 px-4 py-6">
        <Tabs value={kind} onValueChange={changeKind}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
            {KINDS.map((k) => (
              <TabsTrigger key={k.value} value={k.value} className="gap-2 px-4">
                {k.label}
                <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', counts[k.value] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{counts[k.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Callout tone="info" icon={Info}>
          {kindInfo.hint} A payee paid by <b>bank account</b> gets <b>one {kindInfo.short} payment file</b> per run, in the bank upload layout. A payee paid <b>online</b> is paid on its portal, then the challan / transaction number is recorded here.
        </Callout>
        {noPayee && (
          <Callout tone="warning" icon={AlertTriangle}>
            No payee is set up for {kindInfo.short}. Open <b>Payees</b> and add one - a bank account, or the portal it is paid on - before paying.
          </Callout>
        )}

        <Panel
          icon={Wallet}
          title={`${kindInfo.label} (${open.length})`}
          description={isTds ? 'Each line is the tax taken from one supplier payment - tick what to pay now' : 'Tick what to pay now'}
          bodyClassName="p-0"
          action={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canManage && !isTds && <Button type="button" size="sm" className="h-8 text-xs" onClick={openAdd}><Plus className="mr-1.5 h-3.5 w-3.5" />Add amount</Button>}
              {canManage && <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setPf({ ...EMPTY_PAYEE, kind }); setPayeesOpen(true); }}><Users className="mr-1.5 h-3.5 w-3.5" />Payees</Button>}
            </div>
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <SearchInput value={search} onChange={setSearch} placeholder={isTds ? 'Search supplier, section, payment…' : 'Search head, reference, period…'} className="max-w-md" />
            {overdue.length > 0 && <p className="text-xs font-medium text-red-600 dark:text-red-400">{overdue.length} overdue · {rupees(overdueTotal)}</p>}
          </div>
          {loading && all.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : open.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <Landmark className="mx-auto mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">Nothing is waiting to be paid under {kindInfo.label}</p>
              <p className="mx-auto mt-1 max-w-md text-xs">{isTds ? 'Tax appears here once a supplier payment that deducted TDS has been paid in a Payment Run.' : 'Use Add amount to key in what is owed.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-10"><Checkbox checked={allTicked} disabled={!canPay} onCheckedChange={toggleAll} aria-label="Tick every amount shown" /></TableHead>
                    <TableHead className={th}>{isTds ? 'Section' : 'For'}</TableHead>
                    {isTds && <TableHead className={th}>Deducted from</TableHead>}
                    <TableHead className={th}>Period</TableHead>
                    <TableHead className={th}>Company</TableHead>
                    <TableHead className={th}>Pay to</TableHead>
                    <TableHead className={th}>Due</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownOpen.length === 0 && <TableRow><TableCell colSpan={isTds ? 9 : 8} className="py-8 text-center text-sm text-muted-foreground">No matches found</TableCell></TableRow>}
                  {shownOpen.map((p) => {
                    const due = dueState(p);
                    const ticked = picked.has(p.stat_sno);
                    return (
                      <TableRow key={p.stat_sno} className={cn(ticked && 'bg-emerald-50/60 dark:bg-emerald-950/20')}>
                        <TableCell><Checkbox checked={ticked} disabled={!canPay} onCheckedChange={() => toggle(p.stat_sno)} aria-label={`Pay ${p.head_name}`} /></TableCell>
                        <TableCell className="min-w-40 text-xs">
                          <span className="block font-semibold">{p.head_name}</span>
                          <span className="block text-muted-foreground">{[p.ref_no, p.narration].filter(Boolean).join(' · ') || '—'}</span>
                        </TableCell>
                        {isTds && <TableCell className="text-xs">{p.party_name ?? '—'}<span className="block text-muted-foreground">{p.payment_no ?? ''}</span></TableCell>}
                        <TableCell className="whitespace-nowrap text-xs">{p.period_label ?? '—'}</TableCell>
                        <TableCell className="text-xs">{scopeLabel(p)}</TableCell>
                        <TableCell className="min-w-36 text-xs">
                          {p.pay_to_name ?? p.payee_name ?? <span className="text-muted-foreground">Default {kindInfo.short} payee</span>}
                          {channelOf(p) === 'ONLINE' ? (
                            <span className="mt-0.5 flex items-center gap-1 text-[11px]"><Globe className="h-3 w-3 shrink-0 text-sky-600" /><PortalLink url={p.pay_to_portal_url} name={p.pay_to_portal_name ? `Online · ${p.pay_to_portal_name}` : 'Online'} /></span>
                          ) : p.pay_to_sno != null && <span className="block text-[11px] text-muted-foreground">Bank file</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {showDate(p.due_date)}
                          <span className={cn('mt-0.5 block text-[11px] font-medium', due.tone === 'danger' && 'text-red-600 dark:text-red-400', due.tone === 'warning' && 'text-amber-700 dark:text-amber-300', due.tone === 'neutral' && 'text-muted-foreground')}>{due.text}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums">{rupees(p.amount)}</TableCell>
                        <TableCell>
                          {canManage && p.source_type === 'MANUAL' && (
                            <button type="button" onClick={() => { setCancelFor(p); setCancelReason(''); }} aria-label={`Cancel ${p.head_name}`} title="Cancel this amount" className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700">
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {open.length > 0 && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-5">
              <div className="min-w-0 text-sm">
                <p className="font-semibold tabular-nums">{picked.size} amount{picked.size === 1 ? '' : 's'} · {rupees(pickedTotal)}</p>
                <p className={cn('text-xs', picked.size > 0 && problem ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {picked.size === 0 ? 'Tick the amounts to pay in this run'
                    : problem || (pickedOnline ? `Paid online to ${onlinePayee?.pay_to_name ?? 'the payee'} - pay on the portal, then record it` : `One ${kindInfo.short} payment file for ${scopeLabel(pickedList[0])}`)}
                </p>
              </div>
              {canPay && (pickedOnline ? (
                <Button type="button" className="h-10" onClick={openOnline}>
                  <Globe className="mr-2 h-4 w-4" />Record online payment
                </Button>
              ) : (
                <Button type="button" className="h-10" disabled={picked.size === 0 || !!problem} onClick={openConfirm}>
                  <Landmark className="mr-2 h-4 w-4" />Pay &amp; generate file
                </Button>
              ))}
            </div>
          )}
        </Panel>

        {kind === 'GST' && gstHeld.length > 0 && (
          <Panel icon={Info} title={`GST held on supplier bills (${gstHeld.length})`} description="Kept back until GSTR-2B shows the invoice - it is paid with the bill on the Payment screen, not here" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>Supplier invoice</TableHead><TableHead className={th}>Supplier</TableHead><TableHead className={cn(th, 'text-right')}>GST waiting for 2B</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gstHeld.map((g) => (
                    <TableRow key={g.invoice_sno}>
                      <TableCell className="text-xs font-medium">{g.supplier_invoice_no || <span className="font-normal text-muted-foreground">Not entered</span>}</TableCell>
                      <TableCell className="text-xs">{g.vendor_name ?? '—'}</TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(g.gst_amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={2} className="text-xs font-semibold">Total held</TableCell>
                    <TableCell className="text-right text-xs font-bold tabular-nums">{rupees(gstHeld.reduce((s, g) => s + Number(g.gst_amount || 0), 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}

        <Panel
          icon={CheckCircle2}
          title={`Paid ${kindInfo.short} (${paid.length})`}
          description="Amounts already sent in a bank file, or paid online and recorded"
          bodyClassName="p-0"
          action={<Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowPaid((v) => !v)}>{showPaid ? 'Hide' : 'Show'}</Button>}
        >
          {!showPaid ? null : shownPaid.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing has been paid yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>{isTds ? 'Section' : 'For'}</TableHead><TableHead className={th}>Period</TableHead><TableHead className={th}>Pay to</TableHead>
                    <TableHead className={th}>Run</TableHead><TableHead className={th}>Paid on</TableHead><TableHead className={cn(th, 'text-right')}>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownPaid.map((p) => (
                    <TableRow key={p.stat_sno}>
                      <TableCell className="text-xs font-medium">{p.head_name}{isTds && p.party_name && <span className="block font-normal text-muted-foreground">{p.party_name}</span>}</TableCell>
                      <TableCell className="text-xs">{p.period_label ?? '—'}</TableCell>
                      <TableCell className="text-xs">{p.payee_name ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {p.batch_no ?? '—'}
                        {p.pay_channel === 'ONLINE' && <span className="block text-muted-foreground">Online · {[p.txn_mode, p.txn_id].filter(Boolean).join(' ')}</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{showDate(p.paid_at)}</TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums">{rupees(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel icon={History} title={`Previous ${kindInfo.short} runs`} description="Bank files (download one again) and online payments recorded" bodyClassName="p-0">
          {kindRuns.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No {kindInfo.short} run yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>Run</TableHead><TableHead className={th}>Date</TableHead><TableHead className={th}>Company</TableHead><TableHead className={th}>Paid from</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Lines</TableHead><TableHead className={cn(th, 'text-right')}>Paid</TableHead><TableHead className={th}>By</TableHead><TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kindRuns.map((b) => {
                    const online = b.pay_channel === 'ONLINE';
                    return (
                      <TableRow key={b.batch_sno}>
                        <TableCell className="text-xs font-medium">{b.batch_no}<span className="block font-normal text-muted-foreground">{online ? `${b.txn_mode ?? 'Online'} · ${b.txn_id ?? ''}` : (b.file_name ?? '')}</span></TableCell>
                        <TableCell className="text-xs">{showDate(b.batch_date)}</TableCell>
                        <TableCell className="text-xs">{b.com_name ?? '—'}</TableCell>
                        <TableCell className="text-xs">
                          {online ? (
                            <>
                              <span className="flex items-center gap-1"><Globe className="h-3 w-3 shrink-0 text-sky-600" />Online{b.payee_name ? ` to ${b.payee_name}` : ''}</span>
                              <PortalLink url={b.portal_url} name={b.portal_name} className="text-[11px]" />
                            </>
                          ) : b.sender_bank_name ? <>{b.sender_bank_name}<span className="block text-muted-foreground">••••{b.sender_ac_last4}{b.sender_client_code ? ` · ${b.sender_client_code}` : ''}</span></> : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{b.item_count}</TableCell>
                        <TableCell className="text-right text-xs font-medium tabular-nums">{rupees(b.total_amount)}</TableCell>
                        <TableCell className="text-xs">{b.created_by ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {online ? <StatusPill tone="info">Recorded</StatusPill> : (
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={downloading === b.batch_sno} onClick={() => downloadRun(b)}>
                              {downloading === b.batch_sno ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}File
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            <DialogTitle>Pay these {kindInfo.short} amounts?</DialogTitle>
            <DialogDescription>They are marked paid{isTds ? ', the TDS journal is posted' : ''} and a separate {kindInfo.short} payment file is generated.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amounts</dt><dd className="font-semibold tabular-nums">{pickedList.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total to pay</dt><dd className="font-semibold tabular-nums">{rupees(pickedTotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Company</dt><dd className="text-right font-semibold">{pickedList[0] ? scopeLabel(pickedList[0]) : '—'}</dd></div>
          </dl>
          <div className="space-y-1.5">
            <Label className="text-xs">Pay from</Label>
            {sendersLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading the company's bank accounts…</p>
            ) : sendersError ? (
              <Callout tone="danger" icon={AlertTriangle}>{sendersError}.{' '}<button type="button" className="font-semibold underline" onClick={loadSenders}>Try again</button></Callout>
            ) : senders.length === 0 ? (
              <Callout tone="danger" icon={AlertTriangle}>{blockedBySender}</Callout>
            ) : (
              <>
                <Select value={sender ? String(sender.payment_bank_sno) : ''} onValueChange={setSenderSno}>
                  <SelectTrigger className="h-10 w-full" aria-label="Pay from"><SelectValue placeholder="Choose the bank account" /></SelectTrigger>
                  <SelectContent>{senders.map((s) => <SelectItem key={s.payment_bank_sno} value={String(s.payment_bank_sno)}>{senderLabel(s)}{s.is_default === 'Y' ? ' · default' : ''}</SelectItem>)}</SelectContent>
                </Select>
                <p className={cn('text-xs', sender ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                  {sender ? `Bank upload file for ${sender.bank_name} (client code ${sender.client_code}). The file number carries on from the day's supplier files.` : blockedBySender}
                </p>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stat-date" className="text-xs">Payment date</Label>
            <Input id="stat-date" type="date" value={payDate} onChange={(ev) => setPayDate(ev.target.value)} className="h-10" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={proceeding} onClick={() => setConfirmOpen(false)}>Cancel</Button>
            {stale && <p className="mr-auto text-xs text-amber-700 dark:text-amber-300">The list changed while this was open - close it and review again.</p>}
            <Button type="button" disabled={proceeding || stale || !payDate || sendersLoading || !!sendersError || !!blockedBySender} onClick={proceed}>
              {proceeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Pay &amp; download file
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
              <DialogTitle>Statutory run {result?.batch.batch_no} created</DialogTitle>
              <DialogDescription>{result?.items.length} amount{result?.items.length === 1 ? '' : 's'} · {rupees(result?.batch.total_amount)} paid.</DialogDescription>
            </div>
          </DialogHeader>
          {result && (
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
          )}
          <DialogFooter><Button type="button" onClick={() => setResult(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* record an online payment */}
      <Dialog open={onlineOpen} onOpenChange={(o) => { if (!recording) setOnlineOpen(o); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record online {kindInfo.short} payment</DialogTitle>
            <DialogDescription>Pay on the portal first, then enter what it shows. The amounts are marked paid{isTds ? ' and the TDS journal is posted' : ''} - no bank file is made.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pay to</dt><dd className="text-right font-semibold">{onlinePayee?.pay_to_name ?? '—'}</dd></div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Portal</dt>
              <dd className="min-w-0 text-right"><PortalLink url={onlinePayee?.pay_to_portal_url} name={onlinePayee?.pay_to_portal_name} className="max-w-full" /></dd>
            </div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amounts</dt><dd className="font-semibold tabular-nums">{pickedList.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total to pay</dt><dd className="font-semibold tabular-nums">{rupees(pickedTotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Company</dt><dd className="text-right font-semibold">{onlinePayee ? scopeLabel(onlinePayee) : '—'}</dd></div>
          </dl>
          {onlinePayee?.pay_to_instructions && <Callout tone="info" icon={Info}>{onlinePayee.pay_to_instructions}</Callout>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Paid by <span className="text-destructive">*</span></Label>
              <Select value={onlineForm.mode} onValueChange={(v) => setOnlineForm((f) => ({ ...f, mode: v }))}>
                <SelectTrigger className="h-10 w-full" aria-label="Paid by"><SelectValue placeholder="Net Banking, UPI …" /></SelectTrigger>
                <SelectContent>{STATUTORY_ONLINE_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="so-date" className="text-xs">Payment date <span className="text-destructive">*</span></Label>
              <Input id="so-date" type="date" max={today()} value={onlineForm.txnDate} onChange={(ev) => setOnlineForm((f) => ({ ...f, txnDate: ev.target.value }))} className="h-10" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="so-txn" className="text-xs">Challan / transaction no. <span className="text-destructive">*</span></Label>
              <Input id="so-txn" autoComplete="off" value={onlineForm.txnId} onChange={(ev) => setOnlineForm((f) => ({ ...f, txnId: ev.target.value }))} className="h-10 font-mono" placeholder="CIN / CPIN / UTR shown by the portal" maxLength={100} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="so-rem" className="text-xs">Remarks</Label>
              <Textarea id="so-rem" rows={2} value={onlineForm.remarks} onChange={(ev) => setOnlineForm((f) => ({ ...f, remarks: ev.target.value }))} className="resize-none text-sm" maxLength={500} />
            </div>
          </div>
          {onlineFormProblem && onlineForm.txnId && <p className="text-xs text-amber-700 dark:text-amber-300">{onlineFormProblem}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={recording} onClick={() => setOnlineOpen(false)}>Cancel</Button>
            {onlineStale && <p className="mr-auto text-xs text-amber-700 dark:text-amber-300">The list changed while this was open - close it and review again.</p>}
            <Button type="button" disabled={recording || onlineStale || !!onlineFormProblem} onClick={recordOnline}>
              {recording ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* key in an amount */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!saving) setAddOpen(o); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {kindInfo.short} amount</DialogTitle>
            <DialogDescription>An amount owed that is not from a supplier payment.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Company <span className="text-destructive">*</span></Label>
              <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}>
                <SelectTrigger className="h-10 w-full" aria-label="Company"><SelectValue placeholder={comScopes.length ? 'Choose the company' : 'No company has a bank account yet'} /></SelectTrigger>
                <SelectContent>{comScopes.map(([key, s]) => <SelectItem key={key} value={key}>{`${s.com_name ?? `Company ${s.com_sno}`} · ${s.div_name ?? `Division ${s.div_sno}`} · ${s.brn_name ?? `Branch ${s.brn_sno}`}`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-head" className="text-xs">What is it for? <span className="text-destructive">*</span></Label>
              <Input id="st-head" value={form.head_name} onChange={(ev) => setForm((f) => ({ ...f, head_name: ev.target.value }))} placeholder={kind === 'GST' ? 'GSTR-3B, interest, late fee…' : 'Provident Fund, ESI, professional tax…'} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-amt" className="text-xs">Amount (₹) <span className="text-destructive">*</span></Label>
              <Input id="st-amt" inputMode="decimal" value={form.amount} onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))} className="h-10 tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-due" className="text-xs">Due date</Label>
              <Input id="st-due" type="date" value={form.due_date} onChange={(ev) => setForm((f) => ({ ...f, due_date: ev.target.value }))} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-period" className="text-xs">Period</Label>
              <Input id="st-period" value={form.period_label} onChange={(ev) => setForm((f) => ({ ...f, period_label: ev.target.value }))} placeholder="Sep 2026" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-ref" className="text-xs">Reference</Label>
              <Input id="st-ref" value={form.ref_no} onChange={(ev) => setForm((f) => ({ ...f, ref_no: ev.target.value }))} placeholder="GSTIN / return / registration" className="h-10" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Pay to</Label>
              <Select value={form.payee_sno || 'default'} onValueChange={(v) => setForm((f) => ({ ...f, payee_sno: v === 'default' ? '' : v }))}>
                <SelectTrigger className="h-10 w-full" aria-label="Pay to"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default {kindInfo.short} payee</SelectItem>
                  {kindPayees.map((y) => <SelectItem key={y.payee_sno} value={String(y.payee_sno)}>{payeeLabel(y)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-note" className="text-xs">Note</Label>
              <Textarea id="st-note" rows={2} value={form.narration} onChange={(ev) => setForm((f) => ({ ...f, narration: ev.target.value }))} className="resize-none text-sm" />
            </div>
          </div>
          {addProblem && form.head_name && form.amount && <p className="text-xs text-amber-700 dark:text-amber-300">{addProblem}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="button" disabled={saving || !!addProblem} onClick={saveAmount}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* cancel */}
      <Dialog open={cancelFor != null} onOpenChange={(o) => { if (!o && !cancelling) setCancelFor(null); }}>
        <DialogContent className="w-[calc(100%-1rem)] gap-4 sm:w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {cancelFor?.head_name}?</DialogTitle>
            <DialogDescription>{rupees(cancelFor?.amount)}. It is removed from the list and will not be paid.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="st-cancel" className="text-xs">Reason <span className="text-destructive">*</span></Label>
            <Textarea id="st-cancel" rows={3} value={cancelReason} onChange={(ev) => setCancelReason(ev.target.value)} placeholder="Why is this amount being cancelled?" className="resize-none text-sm" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={cancelling} onClick={() => setCancelFor(null)}>Keep</Button>
            <Button type="button" variant="destructive" disabled={cancelling || !cancelReason.trim()} onClick={cancelAmount}>
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}Cancel amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* payees */}
      <Dialog open={payeesOpen} onOpenChange={(o) => { if (!savingPayee) setPayeesOpen(o); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payees</DialogTitle>
            <DialogDescription>Who the statutory amounts are paid to - the Income Tax Department, the GST department, and so on - by bank account (in the payment file) or online on their portal. The default of each kind is used when an amount names no payee.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead className={th}>Kind</TableHead><TableHead className={th}>Payee</TableHead><TableHead className={th}>Paid to</TableHead><TableHead className={th}>Mode</TableHead><TableHead className="w-10" /></TableRow>
              </TableHeader>
              <TableBody>
                {payees.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No payee yet - add one below.</TableCell></TableRow>}
                {payees.map((y) => {
                  const online = y.pay_via_portal === 'Y';
                  return (
                    <TableRow key={y.payee_sno} className={cn(y.is_active === 'N' && 'opacity-60', pf.payee_sno === y.payee_sno && 'bg-primary/5')}>
                      <TableCell className="text-xs">{y.kind}{y.is_default === 'Y' && <StatusPill tone="success" className="ml-1.5">Default</StatusPill>}{y.is_active === 'N' && <StatusPill tone="neutral" className="ml-1.5">Off</StatusPill>}</TableCell>
                      <TableCell className="text-xs font-medium">{y.payee_name}<span className="block font-normal text-muted-foreground">{y.reference_no ?? ''}</span></TableCell>
                      <TableCell className="max-w-56 text-xs">
                        {online ? (
                          <><PortalLink url={y.payment_portal_url} name={y.payment_portal_name} className="max-w-full" /><span className="block truncate text-muted-foreground" title={y.payment_instructions ?? undefined}>{y.payment_instructions || portalUrl(y.payment_portal_url ?? '')}</span></>
                        ) : (
                          <>••••{y.ac_last4}<span className="block text-muted-foreground">{y.ifsc}{y.bank_name ? ` · ${y.bank_name}` : ''}</span></>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{online ? <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3 text-sky-600" />Online</span> : y.pay_mode}</TableCell>
                      <TableCell><button type="button" onClick={() => editPayee(y)} aria-label={`Edit ${y.payee_name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-semibold">{pf.payee_sno ? 'Edit payee' : 'Add a payee'}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Kind</Label>
                <Select value={pf.kind} onValueChange={(v) => setPf((f) => ({ ...f, kind: v as StatutoryKind }))}>
                  <SelectTrigger className="h-10 w-full" aria-label="Kind"><SelectValue /></SelectTrigger>
                  <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="py-name" className="text-xs">Payee name <span className="text-destructive">*</span></Label><Input id="py-name" value={pf.payee_name} onChange={(ev) => setPf((f) => ({ ...f, payee_name: ev.target.value }))} className="h-10" placeholder="Income Tax Department" maxLength={100} /></div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">How is this payee paid? <span className="text-destructive">*</span></Label>
                <PayChannelChooser online={pf.pay_via_portal} onChange={(v) => setPf((f) => ({ ...f, pay_via_portal: v }))} />
              </div>
              {pf.pay_via_portal ? (
                <>
                  <p className="text-xs text-muted-foreground sm:col-span-2">No bank account is needed. Say where the payment is made - its amounts are paid there and the challan / transaction number is recorded here.</p>
                  <div className="space-y-1.5"><Label htmlFor="py-portal" className="text-xs">Portal / website name <span className="text-destructive">*</span></Label><Input id="py-portal" value={pf.payment_portal_name} onChange={(ev) => setPf((f) => ({ ...f, payment_portal_name: ev.target.value }))} className="h-10" placeholder="e.g. Income Tax e-Filing (e-Pay Tax)" maxLength={150} /></div>
                  <div className="space-y-1.5"><Label htmlFor="py-url" className="text-xs">Portal URL <span className="text-destructive">*</span></Label><Input id="py-url" type="url" inputMode="url" autoComplete="off" value={pf.payment_portal_url} onChange={(ev) => setPf((f) => ({ ...f, payment_portal_url: ev.target.value }))} onBlur={() => setPf((f) => ({ ...f, payment_portal_url: portalUrl(f.payment_portal_url) }))} className="h-10" placeholder="https://eportal.incometax.gov.in" maxLength={500} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="py-inst" className="text-xs">Payment instructions (optional)</Label><Textarea id="py-inst" rows={2} value={pf.payment_instructions ?? ''} onChange={(ev) => setPf((f) => ({ ...f, payment_instructions: ev.target.value }))} className="resize-none text-sm" placeholder="e.g. e-Pay Tax > Challan 281, TDS/TCS payable by taxpayer (0020)" maxLength={500} /></div>
                  <div className="space-y-1.5"><Label htmlFor="py-ref" className="text-xs">Registration (TAN / GSTIN)</Label><Input id="py-ref" value={pf.reference_no ?? ''} onChange={(ev) => setPf((f) => ({ ...f, reference_no: ev.target.value }))} className="h-10" maxLength={40} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5"><Label htmlFor="py-ac" className="text-xs">Account number <span className="text-destructive">*</span></Label><Input id="py-ac" inputMode="numeric" autoComplete="off" value={pf.ac_number} onChange={(ev) => setPf((f) => ({ ...f, ac_number: ev.target.value }))} className="h-10 tabular-nums" /></div>
                  <div className="space-y-1.5"><Label htmlFor="py-ifsc" className="text-xs">IFSC <span className="text-destructive">*</span></Label><Input id="py-ifsc" autoComplete="off" value={pf.ifsc} onChange={(ev) => setPf((f) => ({ ...f, ifsc: ev.target.value.toUpperCase() }))} className="h-10 font-mono" maxLength={11} /></div>
                  <div className="space-y-1.5"><Label htmlFor="py-bank" className="text-xs">Bank</Label><Input id="py-bank" value={pf.bank_name ?? ''} onChange={(ev) => setPf((f) => ({ ...f, bank_name: ev.target.value }))} className="h-10" /></div>
                  <div className="space-y-1.5"><Label htmlFor="py-branch" className="text-xs">Branch</Label><Input id="py-branch" value={pf.branch_name ?? ''} onChange={(ev) => setPf((f) => ({ ...f, branch_name: ev.target.value }))} className="h-10" /></div>
                  <div className="space-y-1.5"><Label htmlFor="py-ref" className="text-xs">Registration (TAN / GSTIN)</Label><Input id="py-ref" value={pf.reference_no ?? ''} onChange={(ev) => setPf((f) => ({ ...f, reference_no: ev.target.value }))} className="h-10" maxLength={40} /></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Transfer mode</Label>
                    <Select value={pf.pay_mode} onValueChange={(v) => setPf((f) => ({ ...f, pay_mode: v as 'NEFT' | 'RTGS' }))}>
                      <SelectTrigger className="h-10 w-full" aria-label="Transfer mode"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="NEFT">NEFT</SelectItem><SelectItem value="RTGS">RTGS</SelectItem></SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <label className="flex items-center gap-2 text-xs"><Switch checked={pf.is_default} onCheckedChange={(v) => setPf((f) => ({ ...f, is_default: v }))} />Default for this kind</label>
              <label className="flex items-center gap-2 text-xs"><Switch checked={pf.is_active} onCheckedChange={(v) => setPf((f) => ({ ...f, is_active: v }))} />Active</label>
            </div>
            {pf.payee_sno != null && pf.pay_via_portal !== (payees.find((y) => y.payee_sno === pf.payee_sno)?.pay_via_portal === 'Y') && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {pf.pay_via_portal ? 'Saving switches this payee to online: its bank account details are removed.' : 'Saving switches this payee to a bank account: its portal details are removed.'}
              </p>
            )}
            {pfProblem && pf.payee_name && <p className="text-xs text-amber-700 dark:text-amber-300">{pfProblem}</p>}
            <div className="flex justify-end gap-2">
              {pf.payee_sno && <Button type="button" variant="outline" size="sm" disabled={savingPayee} onClick={() => setPf({ ...EMPTY_PAYEE, kind })}>New payee</Button>}
              <Button type="button" size="sm" disabled={savingPayee || !!pfProblem} onClick={savePayee}>
                {savingPayee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save payee
              </Button>
            </div>
          </div>
          <DialogFooter><Button type="button" onClick={() => setPayeesOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatutoryPaymentPage;
