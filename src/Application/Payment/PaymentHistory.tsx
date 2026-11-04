import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, Banknote, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardCheck, Copy, Download, FileText, Gauge, Globe, History, Info, Landmark,
  Loader2, ReceiptText, RotateCcw, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Callout, FilterChips, SearchInput, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { downloadTextFile } from '@/utils/downloadTextFile';
import {
  payNetRunBatchDetail, payNetRunBatchFile, payNetRunBatchVerification,
  type PaymentBatch, type PaymentBatchDetail, type PaymentBatchItem, type PaymentFile, type PortalPayment,
} from '@/Services/GrnService/paymentNetApi';
import { inBankFile, notInFileReason, rupees } from './paymentRunModel';
import { BankChip, RunBankReply } from './BankReply';
import { bankWhen, isNotPaid, itemBankState, runBankState } from './bankReplyModel';
import {
  HISTORY_RANGES, bankKeyOfRun, bankLabelOfRun, compactRupees, countWords, filterHistory, fundUsePct, groupHistoryByDay, hasRunFile, itemTotals,
  lineKind, linesByItem, localYmd, monthSummary, payeeSummary, portalDay, rangeBounds, runDay, runStatus, scopeKeyOfRun, scopeLabelOfRun, sumHistory,
  toHistoryItems,
  type HistoryKind, type HistoryRange,
} from './paymentHistoryModel';

const saveFile = (f: PaymentFile) => downloadTextFile(f.file_name, f.content, f.mime_type);
const mask = (n: string | null | undefined) => (n ? `••••${String(n).slice(-4)}` : '—');
const longDay = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const shortDay = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const timeOf = (s: string | null | undefined) => (s && s.length >= 16 ? s.slice(11, 16) : '');
const dayHeading = (ymd: string, today: string) => {
  if (ymd === today) return `Today · ${longDay(ymd)}`;
  const y = new Date(`${today}T00:00:00`);
  y.setDate(y.getDate() - 1);
  return ymd === localYmd(y) ? `Yesterday · ${longDay(ymd)}` : longDay(ymd);
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Run downloads (the bank file again, and the auditor's check sheet). */
function useRunDownloads() {
  const [busy, setBusy] = useState<string | null>(null);
  const get = async (b: PaymentBatch, kind: 'file' | 'sheet') => {
    setBusy(`${b.batch_sno}:${kind}`);
    try {
      const res = await axios.get(kind === 'file' ? payNetRunBatchFile(b.batch_sno) : payNetRunBatchVerification(b.batch_sno));
      saveFile(res.data?.data);
    } catch (err) {
      toast.error(getErrorMessage(err, kind === 'file' ? 'Could not download the file' : 'Could not download the check sheet'));
    } finally {
      setBusy(null);
    }
  };
  return { busy, get };
}

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', tone ?? TONE.neutral)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums leading-tight">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function FundMeter({ pct, className }: { pct: number | null; className?: string }) {
  if (pct == null) return null;
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)} role="meter" aria-label="Fund plan used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={cn('h-full rounded-full', pct >= 95 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-amber-500')} style={{ width: `${Math.max(pct, 3)}%` }} />
    </div>
  );
}

const KINDS: { value: HistoryKind; label: string; short: string; icon: LucideIcon }[] = [
  { value: 'ALL', label: 'All', short: 'All', icon: History },
  { value: 'RUN', label: 'Bank runs', short: 'Bank', icon: Landmark },
  { value: 'PORTAL', label: 'Paid on portal', short: 'Portal', icon: Globe },
];

// ─── History tab ───────────────────────────────────────────────────────────

/**
 * Payment history: every bank run (with its file and check sheet) and every payment recorded as paid on a supplier's portal,
 * newest first and grouped by day. Filter by period, kind, company and bank account; search by run, supplier, payment, file
 * or transaction id.
 */
export function PaymentHistoryTab({ runs, portal, loading, limit, openRunId, onOpenRun, canUpload = false, onChanged }: {
  runs: PaymentBatch[]; portal: PortalPayment[]; loading: boolean; limit: number;
  openRunId: number | null; onOpenRun: (batch_sno: number | null) => void;
  /** may upload the bank's reverse file of a run (sql/83) */
  canUpload?: boolean;
  /** a reverse file changed runs / payments: reload the lists */
  onChanged?: () => void;
}) {
  const today = localYmd(new Date());
  const [range, setRange] = useState<HistoryRange>('30D');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [kind, setKind] = useState<HistoryKind>('ALL');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');
  const [bank, setBank] = useState('');
  const [openTxnSno, setOpenTxnSno] = useState<number | null>(null);
  const downloads = useRunDownloads();

  const all = useMemo(() => toHistoryItems(runs, portal), [runs, portal]);
  const scopes = useMemo(() => {
    const m = new Map<string, string>();
    runs.forEach((b) => m.set(scopeKeyOfRun(b), scopeLabelOfRun(b)));
    return [...m.entries()].map(([key, label]) => ({ key, label }));
  }, [runs]);
  const banks = useMemo(() => {
    const m = new Map<string, string>();
    runs.forEach((b) => { const k = bankKeyOfRun(b); if (k) m.set(k, bankLabelOfRun(b)); });
    return [...m.entries()].map(([key, label]) => ({ key, label }));
  }, [runs]);

  const { from, to } = rangeBounds(range, today, custom);
  // at most a few hundred rows: filtered on every render
  const shown = filterHistory(all, { from, to, search, scope, bank, kind });
  const days = groupHistoryByDay(shown);
  const inView = sumHistory(shown);
  const month = monthSummary(all, today);
  const runsInView = shown.flatMap((it) => (it.kind === 'RUN' ? [it.run] : []));
  const plannedInView = runsInView.reduce((s, b) => s + (Number(b.fund_plan_amount) || 0), 0);
  const paidInRuns = runsInView.reduce((s, b) => s + (Number(b.total_amount) || 0), 0);
  const last = runs[0];
  const filtered = range !== 'ALL' || kind !== 'ALL' || !!search || !!scope || !!bank;
  const clear = () => { setRange('ALL'); setCustom({ from: '', to: '' }); setKind('ALL'); setSearch(''); setScope(''); setBank(''); };
  const openRun = runs.find((b) => b.batch_sno === openRunId) ?? null;
  const openTxn = portal.find((t) => t.txn_sno === openTxnSno) ?? null;
  const counts: Record<HistoryKind, number> = { ALL: all.length, RUN: runs.length, PORTAL: portal.length };

  const setCustomDate = (k: 'from' | 'to', v: string) => {
    // start the custom period from what the chosen range showed, so changing one end keeps the other
    const base = range === 'CUSTOM' ? custom : { from: from ?? '', to: to ?? '' };
    setCustom({ ...base, [k]: v });
    setRange('CUSTOM');
  };

  return (
    <div className="@container space-y-4">
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @5xl:grid-cols-4">
        <Kpi icon={Banknote} tone={TONE.success} label="Paid this month" value={compactRupees(month.thisMonth.amount)}
          hint={`${countWords(month.thisMonth)} · last month ${compactRupees(month.lastMonth.amount)}`} />
        <Kpi icon={CalendarDays} tone={TONE.info} label={filtered ? 'In this view' : 'All history'} value={compactRupees(inView.amount)}
          hint={`${countWords(inView)} · ${plural(inView.payments, 'payment')}`} />
        <Kpi icon={Gauge} tone={TONE.violet} label="Fund plan used" value={plannedInView > 0 ? `${Math.round((paidInRuns / plannedInView) * 100)}%` : '—'}
          hint={plannedInView > 0 ? `Bank runs: ${compactRupees(paidInRuns)} of ${compactRupees(plannedInView)} planned` : 'No bank run in this view'} />
        <Kpi icon={History} label="Last bank run" value={last ? last.batch_no : '—'}
          hint={last ? <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => onOpenRun(last.batch_sno)}>{shortDay(runDay(last))} · {rupees(last.total_amount)}</button> : 'No run yet'} />
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm @2xl:p-4">
        <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-center @4xl:justify-between">
          <FilterChips
            options={HISTORY_RANGES.map((r) => ({ value: r.value, label: r.label }))}
            value={range === 'CUSTOM' ? ('' as never) : range}
            onChange={(v) => { setRange(v); setCustom({ from: '', to: '' }); }}
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">From</span>
            <Input type="date" aria-label="From date" value={from ?? ''} max={to ?? undefined} onChange={(e) => setCustomDate('from', e.target.value)} className="h-8 w-full min-w-0 text-xs @4xl:w-36" />
            <span className="shrink-0 text-muted-foreground">to</span>
            <Input type="date" aria-label="To date" value={to ?? ''} min={from ?? undefined} onChange={(e) => setCustomDate('to', e.target.value)} className="h-8 w-full min-w-0 text-xs @4xl:w-36" />
          </div>
        </div>
        <div className="flex flex-col gap-2 @3xl:flex-row @3xl:flex-wrap @3xl:items-center">
          <div role="tablist" aria-label="What was paid" className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
            {KINDS.map((k) => {
              const active = kind === k.value;
              const Icon = k.icon;
              return (
                <button
                  key={k.value} type="button" role="tab" aria-selected={active} onClick={() => setKind(k.value)}
                  className={cn(
                    'inline-flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="@md:hidden">{k.short}</span><span className="hidden @md:inline">{k.label}</span>
                  <span className="tabular-nums text-muted-foreground">{counts[k.value]}</span>
                </button>
              );
            })}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search run, supplier, payment no, file, txn id…" className="w-full @3xl:min-w-56 @3xl:max-w-sm @3xl:flex-1" />
          {scopes.length > 1 && (
            <Select value={scope || 'ALL'} onValueChange={(v) => setScope(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="h-9 w-full @3xl:w-60" aria-label="Company / branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All companies / branches</SelectItem>
                {scopes.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {banks.length > 1 && (
            <Select value={bank || 'ALL'} onValueChange={(v) => setBank(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="h-9 w-full @3xl:w-56" aria-label="Paid from"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All bank accounts</SelectItem>
                {banks.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {filtered && (
            <Button type="button" variant="ghost" size="sm" className="h-9 self-start text-xs @3xl:ml-auto @3xl:self-auto" onClick={clear}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Show everything
            </Button>
          )}
        </div>
      </div>

      {loading && all.length === 0 ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl border bg-card" />)}</div>
      ) : all.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-14 text-center text-muted-foreground">
          <History className="mx-auto mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm font-medium text-foreground">Nothing paid yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs">Every run made from the Make payment tab is kept here with its bank file and check sheet, and so is every payment recorded as paid on a supplier's portal.</p>
        </div>
      ) : days.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
          <p className="text-sm font-medium text-foreground">Nothing matches</p>
          <p className="mt-1 text-xs">Try a longer period or a different search.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={clear}>Show everything</Button>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d.day} aria-label={longDay(d.day)}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayHeading(d.day, today)}</h3>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {countWords(d)} · {plural(d.payments, 'payment')} · <span className="font-semibold text-foreground">{rupees(d.amount)}</span>
                </p>
              </div>
              <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
                {d.items.map((it) => (it.kind === 'RUN'
                  ? <RunRow key={it.key} run={it.run} active={it.run.batch_sno === openRunId} busy={downloads.busy} onOpen={() => onOpenRun(it.run.batch_sno)} onDownload={downloads.get} />
                  : <PortalRow key={it.key} txn={it.txn} active={it.txn.txn_sno === openTxnSno} onOpen={() => setOpenTxnSno(it.txn.txn_sno)} />))}
              </div>
            </section>
          ))}
          {(runs.length >= limit || portal.length >= limit) && (
            <p className="text-center text-xs text-muted-foreground">Showing the latest {limit} runs and {limit} portal payments.</p>
          )}
        </div>
      )}

      <RunDetailSheet run={openRun} onClose={() => onOpenRun(null)} busy={downloads.busy} onDownload={downloads.get} canUpload={canUpload} onChanged={onChanged} />
      <PortalDetailSheet txn={openTxn} onClose={() => setOpenTxnSno(null)} />
    </div>
  );
}

// Shared row frame: icon | title | amount, with two detail columns and actions that move into one line on wide screens.
const ROW = cn(
  'group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @2xl:px-4',
  '@4xl:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,1fr)_9.5rem_auto]',
);
const rowKeys = (onOpen: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } };
const COL = 'col-span-3 min-w-0 pl-12 @4xl:col-span-1 @4xl:pl-0';

function RunRow({ run: b, active, busy, onOpen, onDownload }: {
  run: PaymentBatch; active: boolean; busy: string | null; onOpen: () => void; onDownload: (b: PaymentBatch, kind: 'file' | 'sheet') => void;
}) {
  const pct = fundUsePct(b);
  const st = runStatus(b);
  const payees = payeeSummary(b.vendor_names);
  const file = hasRunFile(b);
  const bank = runBankState(b);
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={rowKeys(onOpen)} aria-label={`Open payment run ${b.batch_no}`} className={cn(ROW, active && 'bg-muted/50')}>
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', bank?.tone === 'danger' ? TONE.danger : file ? TONE.success : TONE.neutral)} title={file ? 'Bank run with a file' : 'Run with no bank transfer'}>
        {file ? <FileText className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
      </span>

      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold">
          <span className="truncate">{b.batch_no}</span>
          <span className="text-xs font-normal text-muted-foreground">{timeOf(b.created_at)}</span>
          <BankChip meta={bank} title={b.last_reverse_at ? `Last reverse file ${bankWhen(b.last_reverse_at)}` : 'No reverse file uploaded yet'} />
        </p>
        <p className="truncate text-xs text-muted-foreground" title={b.file_name ?? st.label}>{b.file_name ?? st.label}</p>
      </div>

      <div className="text-right @4xl:order-5">
        <p className="text-sm font-bold tabular-nums">{rupees(b.total_amount)}</p>
        {pct != null && (
          <div className="mt-1 flex items-center justify-end gap-1.5" title={`${pct}% of the fund plan ${rupees(b.fund_plan_amount)}`}>
            <FundMeter pct={pct} className="hidden w-16 @md:block" />
            <span className="text-[11px] tabular-nums text-muted-foreground">{pct}% of fund</span>
          </div>
        )}
      </div>

      <div className={cn(COL, '@4xl:order-3')}>
        <p className="flex items-center gap-1.5 truncate text-sm font-medium" title={(b.vendor_names ?? []).join(', ')}>
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{payees || plural(b.item_count, 'payment')}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{plural(b.item_count, 'payment')}{b.created_by ? ` · by ${b.created_by}` : ''}</p>
      </div>

      <div className={cn(COL, '@4xl:order-4')}>
        <p className="flex items-center gap-1.5 truncate text-xs font-medium" title={bankLabelOfRun(b)}>
          <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{b.sender_bank_name ? `${b.sender_bank_name}${b.sender_ac_last4 ? ` ••••${b.sender_ac_last4}` : ''}` : 'No bank file'}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground" title={scopeLabelOfRun(b)}>{[b.div_name, b.brn_name].filter(Boolean).join(' · ') || scopeLabelOfRun(b)}</p>
      </div>

      <div className={cn(COL, 'flex items-center justify-end gap-1 @4xl:order-6')}>
        {file ? (
          <>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={busy === `${b.batch_sno}:file`} onClick={stop(() => onDownload(b, 'file'))} title="Download the bank file again" aria-label={`Download the bank file of ${b.batch_no}`}>
              {busy === `${b.batch_sno}:file` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="ml-1 @4xl:hidden @6xl:inline">File</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={busy === `${b.batch_sno}:sheet`} onClick={stop(() => onDownload(b, 'sheet'))} title="Invoice-wise sheet to check the bank file against" aria-label={`Download the check sheet of ${b.batch_no}`}>
              {busy === `${b.batch_sno}:sheet` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}<span className="ml-1 @4xl:hidden @6xl:inline">Check sheet</span>
            </Button>
          </>
        ) : <span className="px-2 text-xs text-muted-foreground">No file</span>}
        <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 @4xl:block" aria-hidden />
      </div>
    </div>
  );
}

function PortalRow({ txn: t, active, onOpen }: { txn: PortalPayment; active: boolean; onOpen: () => void }) {
  const discount = Number(t.discount_amount) || 0;
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={rowKeys(onOpen)} aria-label={`Open portal payment ${t.payment_no}`} className={cn(ROW, active && 'bg-muted/50')}>
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', TONE.info)} title="Paid on the supplier's portal"><Globe className="h-4 w-4" /></span>

      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">{t.payment_no}</span>
          <span className="text-xs font-normal text-muted-foreground">{timeOf(t.recorded_at)}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">Paid on portal{t.portal_name ? ` · ${t.portal_name}` : ''}</p>
      </div>

      <div className="text-right @4xl:order-5">
        <p className="text-sm font-bold tabular-nums">{rupees(t.amount_paid)}</p>
        {discount > 0 && <p className="mt-1 text-[11px] tabular-nums text-emerald-700 dark:text-emerald-300">{rupees(discount)} discount</p>}
      </div>

      <div className={cn(COL, '@4xl:order-3')}>
        <p className="flex items-center gap-1.5 truncate text-sm font-medium" title={t.vendor_name ?? ''}>
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{t.vendor_name ?? '—'}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">1 payment{t.recorded_by ? ` · by ${t.recorded_by}` : ''}</p>
      </div>

      <div className={cn(COL, '@4xl:order-4')}>
        <p className="flex items-center gap-1.5 truncate text-xs font-medium" title={`Transaction ${t.txn_id}`}>
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{t.txn_mode} · <span className="font-mono">{t.txn_id}</span></span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{t.com_name ?? '—'}</p>
      </div>

      <div className={cn(COL, 'flex items-center justify-end gap-1 @4xl:order-6')}>
        <span className="px-2 text-xs text-muted-foreground">No bank file</span>
        <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 @4xl:block" aria-hidden />
      </div>
    </div>
  );
}

// ─── Detail side panels ────────────────────────────────────────────────────

function SheetHead({ icon: Icon, tone, title, pill, sub }: { icon: LucideIcon; tone: string; title: string; pill: React.ReactNode; sub: string }) {
  return (
    <div className="border-b bg-card px-5 py-4 pr-12">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', tone)}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {pill}
          </div>
          <SheetDescription className="text-xs">{sub}</SheetDescription>
        </div>
      </div>
    </div>
  );
}
const Fact = ({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) => (
  <div className={cn('min-w-0', className)}>
    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-semibold">{value}{sub ? <span className="block text-xs font-normal text-muted-foreground">{sub}</span> : null}</dd>
  </div>
);
const Figure = ({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) => (
  <div className="rounded-xl border bg-card p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    {children}
  </div>
);

function RunDetailSheet({ run, onClose, busy, onDownload, canUpload, onChanged }: {
  run: PaymentBatch | null; onClose: () => void; busy: string | null; onDownload: (b: PaymentBatch, kind: 'file' | 'sheet') => void;
  canUpload: boolean; onChanged?: () => void;
}) {
  // A run is read once per visit - again only when the bank's answer on it changed (a reverse file, here or by someone else: the
  // list reloads on payment:updated and brings new bank counts, which change the key).
  const [details, setDetails] = useState<Record<string, PaymentBatchDetail>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const [openPay, setOpenPay] = useState<Set<string>>(new Set());
  const id = run?.batch_sno ?? null;
  const key = run ? [run.batch_sno, run.reverse_files ?? 0, run.last_reverse_at ?? '', run.bank_paid ?? 0, run.bank_failed ?? 0, run.bank_pending ?? 0].join('|') : '';
  const detail = key ? details[key] : undefined;
  const error = key ? errors[key] : undefined;

  useEffect(() => {
    if (id == null || !key || details[key] || errors[key]) return;
    let live = true;
    axios.get(payNetRunBatchDetail(id))
      .then((res) => {
        if (!live) return;
        const d = res.data?.data;
        setDetails((p) => ({ ...p, [key]: { batch: d?.batch, items: d?.items ?? [], lines: d?.lines ?? [], reverse_files: d?.reverse_files ?? [] } }));
      })
      .catch((err) => { if (live) setErrors((p) => ({ ...p, [key]: getErrorMessage(err, 'Could not load this payment run') })); });
    return () => { live = false; };
  }, [id, key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- read once per key; retry bumps `attempt`

  const retry = () => {
    if (!key) return;
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
    setAttempt((a) => a + 1);
  };
  // after a reverse file: drop what was read and reload the lists (the new bank counts give the run a new key)
  const applied = () => {
    setDetails({});
    onChanged?.();
  };
  const items = useMemo(() => detail?.items ?? [], [detail]);
  const byPay = useMemo(() => linesByItem(detail?.items ?? [], detail?.lines ?? []), [detail]);
  const totals = itemTotals(items);
  const pct = run ? fundUsePct(run) : null;
  const st = run ? runStatus(run) : null;
  const payKey = (sno: number) => `${id}:${sno}`;
  const toggle = (sno: number) => setOpenPay((p) => { const n = new Set(p); const k = payKey(sno); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <Sheet open={run != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[720px]">
        {run && st && (
          <div className="flex h-full min-h-0 flex-col">
            <SheetHead icon={Banknote} tone={TONE.success} title={run.batch_no} pill={<StatusPill tone={st.tone}>{st.label}</StatusPill>}
              sub={`Paid ${longDay(runDay(run))}${timeOf(run.created_at) ? ` · made ${timeOf(run.created_at)}` : ''}${run.created_by ? ` by ${run.created_by}` : ''}`} />

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Figure label="Amount paid" value={rupees(run.total_amount)}>
                  {Number(run.bank_failed_amount) > 0 && <p className="mt-1 text-[11px] font-medium text-red-700 dark:text-red-300">{rupees(run.bank_failed_amount)} not paid by the bank</p>}
                </Figure>
                <Figure label="Payments" value={run.item_count} />
                <Figure label="Fund plan" value={<span className="text-base">{rupees(run.fund_plan_amount)}</span>}>
                  {pct != null && <><FundMeter pct={pct} className="mt-1.5" /><p className="mt-1 text-[11px] text-muted-foreground">{pct}% used · {rupees(Math.max(0, Number(run.fund_plan_amount) - Number(run.total_amount)))} left</p></>}
                </Figure>
              </div>

              {hasRunFile(run) && (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold" title={run.file_name ?? ''}>{run.file_name ?? 'Bank file'}</p>
                    <p className="text-xs text-muted-foreground">Upload file for the bank, and the invoice-wise check sheet for the auditor.</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy === `${run.batch_sno}:file`} onClick={() => onDownload(run, 'file')}>
                      {busy === `${run.batch_sno}:file` ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Bank file
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={busy === `${run.batch_sno}:sheet`} onClick={() => onDownload(run, 'sheet')}>
                      {busy === `${run.batch_sno}:sheet` ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}Check sheet
                    </Button>
                  </div>
                </div>
              )}

              {hasRunFile(run) && (
                <RunBankReply run={run} reverseFiles={detail?.reverse_files ?? []} items={items} canUpload={canUpload && !!detail} onApplied={applied} />
              )}

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border bg-muted/20 p-4">
                <Fact label="Paid from" value={run.sender_bank_name ? `${run.sender_bank_name}${run.sender_ac_last4 ? ` ••••${run.sender_ac_last4}` : ''}` : 'No bank file'}
                  sub={[run.sender_name, run.sender_client_code ? `client ${run.sender_client_code}` : null].filter(Boolean).join(' · ')} />
                <Fact label="Company" value={run.com_name ?? '—'} sub={[run.div_name, run.brn_name].filter(Boolean).join(' · ')} />
                <Fact label="Made by" value={run.created_by ?? '—'} sub={run.created_at ? `${shortDay(String(run.created_at).slice(0, 10))} ${timeOf(run.created_at)}` : undefined} />
                <Fact label="File no" value={run.file_no != null ? `.${run.file_no}` : '—'} sub={run.file_type ? run.file_type.replace(/_/g, ' ').toLowerCase() : undefined} />
              </dl>

              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><ReceiptText className="h-4 w-4 text-muted-foreground" />Payments in this run</h4>
                {error ? (
                  <Callout tone="danger" icon={AlertTriangle}>{error}. <button type="button" className="font-semibold underline" onClick={retry}>Try again</button></Callout>
                ) : !detail ? (
                  <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />)}</div>
                ) : items.length === 0 ? (
                  <Callout tone="neutral" icon={Info}>The payment lines of this run were not kept, so only its totals are shown.</Callout>
                ) : (
                  <div className="space-y-2">
                    {items.map((it) => <RunPaymentCard key={`${it.payment_sno}-${it.line_no}`} item={it} lines={byPay.get(it.payment_sno) ?? []} open={openPay.has(payKey(it.payment_sno))} onToggle={() => toggle(it.payment_sno)} />)}
                    <dl className="divide-y overflow-hidden rounded-lg border bg-card text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Gross (invoices)</dt><dd className="tabular-nums">{rupees(totals.gross)}</dd></div>
                      {([['TDS', totals.tds], ['advance adjusted', totals.advance], ['debit / credit notes', totals.notes]] as const).filter(([, v]) => Math.abs(v) > 0.004).map(([label, v]) => (
                        <div key={label} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{v > 0 ? 'Less' : 'Add'} {label}</dt><dd className="tabular-nums">{v > 0 ? '-' : '+'} {rupees(Math.abs(v))}</dd></div>
                      ))}
                      <div className="flex justify-between gap-3 bg-muted/40 px-3 py-2 font-semibold"><dt>Net paid</dt><dd className="tabular-nums">{rupees(totals.net)}</dd></div>
                    </dl>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PortalDetailSheet({ txn: t, onClose }: { txn: PortalPayment | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy - select the transaction id and copy it');
    }
  };
  return (
    <Sheet open={t != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        {t && (
          <div className="flex h-full min-h-0 flex-col">
            <SheetHead icon={Globe} tone={TONE.info} title={t.payment_no} pill={<StatusPill tone="info">Paid on portal</StatusPill>}
              sub={`Paid ${longDay(portalDay(t))}${t.recorded_by ? ` · recorded by ${t.recorded_by}` : ''}${t.recorded_at ? ` on ${shortDay(String(t.recorded_at).slice(0, 10))} ${timeOf(t.recorded_at)}` : ''}`} />
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Figure label="Amount paid" value={rupees(t.amount_paid)} />
                <Figure label="Discount" value={<span className={Number(t.discount_amount) > 0 ? 'text-emerald-700 dark:text-emerald-300' : ''}>{Number(t.discount_amount) > 0 ? rupees(t.discount_amount) : '—'}</span>} />
                <Figure label="Net payable" value={<span className="text-base">{rupees(t.net_paid)}</span>}>
                  <p className="mt-1 text-[11px] text-muted-foreground">paid + discount</p>
                </Figure>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border bg-muted/20 p-4">
                <Fact label="Supplier" value={t.vendor_name ?? '—'} sub={t.supp_code ?? undefined} />
                <Fact label="Portal" value={t.portal_name || "Supplier's portal"} />
                <Fact label="Paid by" value={t.txn_mode} sub={`on ${shortDay(portalDay(t))}`} />
                <Fact label="Company" value={t.com_name ?? '—'} />
                <Fact className="col-span-2" label="Transaction id" value={
                  <span className="inline-flex max-w-full items-center gap-2">
                    <span className="truncate font-mono">{t.txn_id}</span>
                    <button type="button" onClick={() => copy(t.txn_id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Copy the transaction id">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </span>
                } />
                {t.remarks && <Fact className="col-span-2" label="Remarks" value={<span className="font-normal">{t.remarks}</span>} />}
              </dl>

              <Callout tone="info" icon={Info}>Paid on the supplier's own portal, so it is not in any bank run and has no bank file or check sheet.</Callout>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RunPaymentCard({ item: it, lines, open, onToggle }: { item: PaymentBatchItem; lines: PaymentBatchDetail['lines']; open: boolean; onToggle: () => void }) {
  const gross = Number(it.gross_amount ?? it.amount) || 0;
  const inFile = inBankFile({ channel: it.channel, mode: it.mode ?? '' });
  const outside = notInFileReason({ channel: it.channel, mode: it.mode ?? '' });
  const invoices = it.supplier_invoice_nos || it.invoice_nos;
  const bank = itemBankState(it);
  const notPaid = isNotPaid(it.bank_status);
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card', notPaid && 'border-red-200 dark:border-red-500/30')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/30">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">{it.line_no}</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{it.vendor_name ?? it.beneficiary_name ?? '—'}</span>
            {it.msme_label && <span className={cn('rounded-md border px-1.5 py-px text-[10px] font-medium', TONE.violet)}>MSME {it.msme_label}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{it.payment_no}{it.supp_code ? ` · ${it.supp_code}` : ''}{invoices ? ` · Invoice ${invoices}` : ''}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('rounded-md border px-1.5 py-px text-[10px] font-medium', inFile ? TONE.success : TONE.neutral)}>{inFile ? `${it.mode} · in bank file` : outside || it.mode || '—'}</span>
            <BankChip meta={bank} />
            {(it.bank_name || it.account_no) && <span className="truncate">{[it.bank_name, mask(it.account_no), it.ifsc].filter(Boolean).join(' · ')}</span>}
          </p>
          {it.bank_status === 'PAID' && (it.utr_no || it.bank_ref_no) && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              UTR <span className="font-mono">{it.utr_no ?? '—'}</span>{it.bank_credit_at ? ` · credited ${bankWhen(it.bank_credit_at)}` : it.bank_debit_date ? ` · ${bankWhen(it.bank_debit_date)}` : ''}
            </p>
          )}
          {notPaid && (
            <p className="text-xs text-red-700 dark:text-red-300">
              Payment was not successful{it.bank_reason_code || it.bank_reason ? `: ${[it.bank_reason_code, it.bank_reason].filter(Boolean).join(' · ')}` : ''}.
              {' '}{it.paid_again_batch_no ? `Paid again in ${it.paid_again_batch_no}.` : it.payment_status === 'Approved' ? 'Back on Make payment.' : ''}
              {it.reversal_journal_no ? ` Journal reversed (${it.reversal_journal_no}).` : ''}
            </p>
          )}
          {it.bank_status === 'PENDING' && it.bank_reason && <p className="text-xs text-amber-700 dark:text-amber-300">{it.bank_reason}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-sm font-bold tabular-nums', notPaid && 'text-red-700 line-through decoration-red-400/70 dark:text-red-300')}>{rupees(it.amount)}</p>
          {gross !== Number(it.amount) && <p className="text-[11px] text-muted-foreground tabular-nums">gross {rupees(gross)}</p>}
        </div>
        {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-md border bg-card px-2 py-0.5">Gross <b className="tabular-nums">{rupees(gross)}</b></span>
            {([['TDS', it.tds_amount], ['Advance', it.advance_amount], ['Notes', it.note_amount]] as const).map(([label, raw]) => [label, Number(raw) || 0] as const).filter(([, v]) => Math.abs(v) > 0.004).map(([label, v]) => (
              <span key={label} className="rounded-md border bg-card px-2 py-0.5">{v > 0 ? '−' : '+'} {label} <b className="tabular-nums">{rupees(Math.abs(v))}</b></span>
            ))}
            <span className={cn('rounded-md border px-2 py-0.5', TONE.success)}>= Net <b className="tabular-nums">{rupees(it.amount)}</b></span>
          </div>
          {lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">{invoices ? `Invoices: ${invoices}. The invoice-wise split was not kept for this run.` : 'No invoice lines for this payment (an advance, or a run made before invoice lines were kept).'}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border bg-card">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-medium">Invoice</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Invoice amt</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Paid earlier</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">This run</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">TDS</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Left</th>
                    <th className="px-2.5 py-1.5 text-left font-medium"><span className="sr-only">Part</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((l) => {
                    const k = lineKind(l);
                    return (
                      <tr key={`${l.batch_item_sno}-${l.invoice_sno}`}>
                        <td className="px-2.5 py-1.5">
                          <span className="font-medium">{l.supplier_invoice_no || l.invoice_no || '—'}</span>
                          <span className="block text-muted-foreground">{[l.supplier_invoice_no ? l.invoice_no : null, l.invoice_date ? shortDay(String(l.invoice_date).slice(0, 10)) : null].filter(Boolean).join(' · ')}</span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{rupees(l.invoice_amount)}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{Number(l.paid_before) > 0 ? rupees(l.paid_before) : '—'}</td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{rupees(l.this_gross)}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{Number(l.tds_amount) > 0 ? rupees(l.tds_amount) : '—'}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(l.balance_after) > 0 ? rupees(l.balance_after) : '—'}</td>
                        <td className="px-2.5 py-1.5">
                          <span className="flex flex-wrap gap-1">
                            <span className={cn('whitespace-nowrap rounded-md border px-1.5 py-px text-[10px] font-medium', TONE[k.tone])}>{k.label}</span>
                            {l.awaiting_2b && <span className={cn('whitespace-nowrap rounded-md border px-1.5 py-px text-[10px] font-medium', TONE.warning)} title="GST of this invoice was held until it shows in GSTR-2B">GST awaiting 2B</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
