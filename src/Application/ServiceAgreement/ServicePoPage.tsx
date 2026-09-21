import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText, Repeat, Wallet, Loader2, RefreshCw, ReceiptText, PencilLine, Hourglass, BadgeCheck,
  XCircle, SearchX, ClipboardList, Calculator, Percent, AlertCircle, Landmark, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, PageHeader } from '@/CustomComponent/PageComponents';
import {
  AmountBreakdown, Callout, Panel, SearchInput, StatusPill, SupplierSplitTable, SupplierSummary,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  CYCLE_STATUS, TONE, facilityLabel, formatDate, formatINR, previewSupplierSplit, statusMeta,
  type AgreementType,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import axios from 'axios';
import { getServicePoCycles, submitServicePoEntry } from '@/Services/Api';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import useFetch from '@/hooks/useFetchHook';
import { cn } from '@/lib/utils';

// Every recurring PO cycle (Fixed, Unfixed and Statutory) lands here instead
// of issuing silently — see backend-stpl/sql/83_service_po_screen.sql. Fixed
// rows never show an action (nothing to enter, they go straight to Pending
// Approval); Unfixed and Statutory rows in Pending Entry get an "Enter
// Details" button. All then move to the ServicePoApprovalScreen for approval.
// A cycle on an agreement with several suppliers is split between them
// (sql/88) and raises one PO per supplier when finally approved.

type CycleStatus = 'PENDING_ENTRY' | 'PENDING_APPROVAL' | 'GENERATED' | 'REJECTED';

interface CycleSupplier {
  vendor_sno: number; vendor_name?: string | null; share_pct: number; rate_amount: number; net_cost: number;
  po_basic_sno?: number | null; po_no?: string | null;
}

interface CycleRow {
  cycle_sno: number;
  agreement_sno: number; agreement_no: string;
  service_name: string; service_type_code: AgreementType;
  vendor_name?: string;
  /** The cycle's actual split — present once a rate has been entered (or for Fixed). */
  vendors?: CycleSupplier[];
  /** The agreement's configured suppliers — always present, used to preview a Pending Entry cycle. */
  agreement_vendors?: { vendor_sno: number; vendor_name?: string | null; share_amount: number; share_pct: number }[];
  facility_type?: string; rate_type?: string; interest_rate_pct?: number; sanctioned_amount?: number;
  billing_period_start: string;
  qty?: number; rate_amount?: number; discount_pct?: number; gst_pct?: number; net_cost?: number;
  ceiling_amount?: number;
  status: CycleStatus;
  po_basic_sno?: number; po_no?: string; po_date?: string;
}

type PoTab = 'fixed' | 'variable' | 'statutory';
const TAB_FOR_TYPE: Record<AgreementType, PoTab> = { FIXED_RECURRING: 'fixed', VARIABLE_RECURRING: 'variable', STATUTORY: 'statutory' };

/** Suppliers to show for a cycle: its real split once it exists, else the agreement's configured suppliers. */
const cycleSuppliers = (c: CycleRow) =>
  c.vendors?.length
    ? c.vendors.map((v) => ({ vendor_name: v.vendor_name, share_amount: v.net_cost }))
    : (c.agreement_vendors ?? []).map((v) => ({ vendor_name: v.vendor_name, share_amount: v.share_amount }));

/** PO numbers raised for a cycle — one per supplier when the agreement has several. */
const cyclePoNumbers = (c: CycleRow): string[] => {
  const fromSplit = (c.vendors ?? []).map((v) => v.po_no).filter((n): n is string => !!n);
  return fromSplit.length ? fromSplit : c.po_no ? [c.po_no] : [];
};

const SUMMARY_TILES: { status: CycleStatus; icon: LucideIcon; hint: string }[] = [
  { status: 'PENDING_ENTRY', icon: PencilLine, hint: 'Waiting for rate & GST' },
  { status: 'PENDING_APPROVAL', icon: Hourglass, hint: 'With approvers' },
  { status: 'GENERATED', icon: BadgeCheck, hint: 'PO raised' },
  { status: 'REJECTED', icon: XCircle, hint: 'Sent back' },
];

const EntryDialog: React.FC<{ cycle: CycleRow; onClose: () => void; onSaved: () => void }> = ({ cycle, onClose, onSaved }) => {
  const [rate, setRate] = useState('');
  const [discount, setDiscount] = useState('0');
  const [gst, setGst] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const netCost = useMemo(() => {
    const r = Number(rate) || 0, q = cycle.qty ?? 1, d = Number(discount) || 0, g = Number(gst) || 0;
    return r * q * (1 - d / 100) * (1 + g / 100);
  }, [rate, discount, gst, cycle.qty]);

  const overCeiling = cycle.ceiling_amount != null && netCost > cycle.ceiling_amount;

  // Who gets what for the amount being entered — the same apportioning the backend does.
  const agreementSuppliers = useMemo(() => cycle.agreement_vendors ?? [], [cycle.agreement_vendors]);
  const splitPreview = useMemo(
    () => (agreementSuppliers.length > 1
      ? previewSupplierSplit(agreementSuppliers, { rate: Number(rate) || 0, qty: cycle.qty ?? 1, discountPct: Number(discount) || 0, gstPct: Number(gst) || 0 })
      : []),
    [agreementSuppliers, rate, discount, gst, cycle.qty],
  );

  const handleSubmit = async () => {
    if (!rate || Number(rate) <= 0) { setError('Rate is required'); return; }
    if (overCeiling) { setError(`Net amount exceeds the agreement's ceiling of ₹${Number(cycle.ceiling_amount).toLocaleString('en-IN')}`); return; }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(submitServicePoEntry, {
        cycle_sno: cycle.cycle_sno, rate_amount: Number(rate), discount_pct: Number(discount) || 0,
        gst_pct: Number(gst) || 0, remarks: remarks.trim() || undefined,
      });
      toast.success(`Entry submitted for ${cycle.agreement_no} — sent for approval`);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to submit entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Enter PO details — {cycle.agreement_no}</DialogTitle>
          <DialogDescription>
            {cycle.service_name} · {agreementSuppliers.length > 1 ? `${agreementSuppliers.length} suppliers` : (cycle.vendor_name ?? '—')}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            {cycle.facility_type && (
              <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium', TONE.info)}>
                <Landmark className="h-3 w-3" />{facilityLabel(cycle.facility_type)}{cycle.interest_rate_pct != null && ` · ${cycle.interest_rate_pct}%`}
              </span>
            )}
            <span className={cn('rounded-md border px-2 py-0.5 font-medium', TONE.neutral)}>Qty {cycle.qty ?? 1}</span>
            <span className={cn('rounded-md border px-2 py-0.5 font-medium', TONE.neutral)}>PO on {formatDate(cycle.billing_period_start)}</span>
            {cycle.ceiling_amount != null && (
              <span className={cn('rounded-md border px-2 py-0.5 font-medium', TONE.violet)}>Ceiling {formatINR(cycle.ceiling_amount)}</span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          <Panel icon={Percent} title="Rate & tax">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
              <CustomInputField field="rate_amount" label="Rate" require type="number" value={rate} onChange={setRate} placeholder="0.00" className="h-10" />
              <CustomInputField field="discount_pct" label="Discount %" type="number" value={discount} onChange={setDiscount} className="h-10" />
              <CustomInputField field="gst_pct" label="GST %" type="number" value={gst} onChange={setGst} className="h-10" />
            </div>
          </Panel>

          <Panel icon={Calculator} title="Amount">
            <AmountBreakdown
              rate={Number(rate) || 0}
              qty={cycle.qty ?? 1}
              discountPct={Number(discount) || 0}
              gstPct={Number(gst) || 0}
              net={netCost}
              ceiling={cycle.ceiling_amount}
            />
          </Panel>

          {splitPreview.length > 1 && (
            <Panel icon={Users} title="Supplier split" description="Each supplier gets their own PO for their share once approved">
              <SupplierSplitTable
                amountLabel="Net amount"
                suppliers={splitPreview.map((s) => ({
                  vendor_name: s.vendor_name, amount: s.net, pct: s.share_pct,
                  extra: Number(rate) > 0 ? `Rate ${formatINR(s.unit_rate)} × ${cycle.qty ?? 1}` : undefined,
                }))}
              />
            </Panel>
          )}

          <Panel icon={FileText} title="Remarks" description="Optional">
            <CustomInputField field="remarks" label="" type="textarea" value={remarks} onChange={setRemarks} rows={2} placeholder="Anything the approver should know about this cycle…" className="resize-none" />
          </Panel>

          {error && (
            <Callout tone="danger" icon={AlertCircle}>{error}</Callout>
          )}
        </div>

        <DialogFooter className="border-t bg-card px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || overCeiling}>
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : 'Submit for Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type StatusFilter = 'ALL' | CycleStatus;

const ServicePoPage: React.FC = () => {
  const { canEdit } = usePermissions();
  const canEnter = canEdit('ServicePoPage');

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const [enteringCycle, setEnteringCycle] = useState<CycleRow | null>(null);
  const [activeTab, setActiveTab] = useState<PoTab>('fixed');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data, loading } = useFetch<{ success: boolean; data: CycleRow[] }>(getServicePoCycles, '', null, refreshKey);
  const cycles = useMemo(() => data?.data ?? [], [data]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cycles.forEach((c) => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
    return counts;
  }, [cycles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cycles.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (!q) return true;
      const supplierNames = (c.vendors?.length ? c.vendors : c.agreement_vendors ?? []).map((v) => v.vendor_name);
      return [c.agreement_no, c.service_name, c.vendor_name, ...cyclePoNumbers(c), ...supplierNames].some((v) => v?.toLowerCase().includes(q));
    });
  }, [cycles, statusFilter, search]);
  const rowsByTab = useMemo<Record<PoTab, CycleRow[]>>(() => ({
    fixed: filtered.filter((c) => c.service_type_code === 'FIXED_RECURRING'),
    variable: filtered.filter((c) => c.service_type_code === 'VARIABLE_RECURRING'),
    statutory: filtered.filter((c) => c.service_type_code === 'STATUTORY'),
  }), [filtered]);
  const isFiltering = statusFilter !== 'ALL' || search.trim() !== '';

  // Picking a status jumps to whichever tab actually has matches, so the
  // tile never lands the user on an empty list.
  const pickStatus = (status: StatusFilter) => {
    const next = statusFilter === status ? 'ALL' : status;
    setStatusFilter(next);
    if (next === 'ALL') return;
    const countFor = (tab: PoTab) => cycles.filter((c) => c.status === next && TAB_FOR_TYPE[c.service_type_code] === tab).length;
    if (countFor(activeTab) > 0) return;
    const withMatches = (['fixed', 'variable', 'statutory'] as PoTab[]).find((tab) => countFor(tab) > 0);
    if (withMatches) setActiveTab(withMatches);
  };

  const pendingEntryCount = statusCounts.PENDING_ENTRY ?? 0;

  const renderRows = (rows: CycleRow[], showEntryAction: boolean) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={isFiltering ? SearchX : ClipboardList}
          message={isFiltering ? 'No PO cycles match your filters' : 'No PO cycles yet'}
          description={isFiltering ? 'Try a different status or search term.' : 'Cycles appear here when an approved agreement comes due.'}
          action={isFiltering ? (
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter('ALL'); setSearch(''); }}>Clear filters</Button>
          ) : undefined}
        />
      );
    }

    const entryButton = (c: CycleRow, className?: string) =>
      showEntryAction && canEnter && c.status === 'PENDING_ENTRY' ? (
        <Button size="sm" className={className} onClick={() => setEnteringCycle(c)}>
          <PencilLine size={14} /> Enter details
        </Button>
      ) : null;

    return (
      <>
        {/* Wide screens: table */}
        <div className="hidden overflow-hidden rounded-lg border lg:block">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Agreement</TableHead>
                <TableHead>Service / Supplier</TableHead>
                <TableHead>PO generation</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PO No</TableHead>
                {showEntryAction && <TableHead className="w-36" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const status = statusMeta(CYCLE_STATUS, c.status);
                const awaitingEntry = c.status === 'PENDING_ENTRY';
                return (
                  <TableRow key={c.cycle_sno} className={cn(awaitingEntry && 'bg-amber-50/60 dark:bg-amber-500/5')}>
                    <TableCell className="font-semibold">{c.agreement_no}</TableCell>
                    <TableCell className="max-w-[16rem]">
                      <div className="truncate font-medium">{c.service_name}</div>
                      <SupplierSummary suppliers={cycleSuppliers(c)} fallback={c.vendor_name} className="text-xs text-muted-foreground" />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(c.billing_period_start)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {c.net_cost != null ? formatINR(c.net_cost) : <span className="text-xs font-normal text-muted-foreground">{awaitingEntry ? 'Awaiting entry' : '—'}</span>}
                    </TableCell>
                    <TableCell><StatusPill tone={status.tone}>{status.label}</StatusPill></TableCell>
                    <TableCell className="text-xs">
                      {cyclePoNumbers(c).length === 0 ? '—' : (
                        <span title={cyclePoNumbers(c).join('\n')}>
                          {cyclePoNumbers(c)[0]}
                          {cyclePoNumbers(c).length > 1 && <span className="ml-1 text-muted-foreground">+{cyclePoNumbers(c).length - 1}</span>}
                        </span>
                      )}
                    </TableCell>
                    {showEntryAction && <TableCell className="text-right">{entryButton(c)}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Narrow screens: cards */}
        <ul className="space-y-3 lg:hidden">
          {rows.map((c) => {
            const status = statusMeta(CYCLE_STATUS, c.status);
            const awaitingEntry = c.status === 'PENDING_ENTRY';
            return (
              <li
                key={c.cycle_sno}
                className={cn('rounded-xl border bg-card p-3.5 shadow-xs', awaitingEntry && 'border-amber-300 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.agreement_no}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.service_name}</p>
                    <SupplierSummary suppliers={cycleSuppliers(c)} fallback={c.vendor_name} className="text-xs text-muted-foreground" />
                  </div>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                      {c.net_cost != null ? formatINR(c.net_cost) : <span className="text-xs font-normal text-muted-foreground">{awaitingEntry ? 'Awaiting entry' : '—'}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">PO generation</dt>
                    <dd className="mt-0.5 text-sm font-medium">{formatDate(c.billing_period_start)}</dd>
                  </div>
                  {cyclePoNumbers(c).length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">PO No{cyclePoNumbers(c).length > 1 ? 's' : ''}</dt>
                      <dd className="mt-0.5 font-medium">{cyclePoNumbers(c).join(' · ')}</dd>
                    </div>
                  )}
                </dl>
                {entryButton(c, 'mt-3 w-full')}
              </li>
            );
          })}
        </ul>
      </>
    );
  };

  return (
    <div className="min-h-full bg-muted/30">
      <PageHeader
        icon={ReceiptText}
        title="Service Purchase Orders"
        description="Per-cycle POs raised off approved Service Agreements — Fixed goes straight to approval, Unfixed needs the amount entered first; several suppliers means one PO each. Loans are billed under Loan Payments instead."
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        {/* Status summary — each tile filters the list below */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SUMMARY_TILES.map(({ status, icon: Icon, hint }) => {
            const meta = statusMeta(CYCLE_STATUS, status);
            const active = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => pickStatus(status)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs transition-all sm:p-4',
                  'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  active && 'border-primary ring-2 ring-primary/30',
                )}
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', TONE[meta.tone])}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-bold leading-none tabular-nums">{statusCounts[status] ?? 0}</span>
                  <span className="mt-1 block text-xs font-medium leading-tight">{meta.label}</span>
                  <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {canEnter && pendingEntryCount > 0 && statusFilter !== 'PENDING_ENTRY' && (
          <Callout tone="warning" icon={PencilLine} className="items-center">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span>
                <b>{pendingEntryCount} cycle{pendingEntryCount !== 1 ? 's' : ''}</b> waiting for rate &amp; GST before they can go for approval.
              </span>
              <Button size="sm" variant="outline" className="h-7 bg-card text-xs" onClick={() => pickStatus('PENDING_ENTRY')}>
                Show them
              </Button>
            </div>
          </Callout>
        )}

        <Panel
          icon={FileText}
          title="Service PO cycles"
          action={
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> <span className="hidden sm:inline">Refresh</span>
            </Button>
          }
        >
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PoTab)} className="gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="fixed" className="sm:px-4"><Repeat size={14} /> Fixed ({rowsByTab.fixed.length})</TabsTrigger>
                <TabsTrigger value="variable" className="sm:px-4"><Wallet size={14} /> Unfixed ({rowsByTab.variable.length})</TabsTrigger>
                {/* Loans no longer raise PO cycles (they are billed through Bank Payment Vouchers), so this
                    tab only appears for cycles that were raised before that change. */}
                {cycles.some((c) => c.service_type_code === 'STATUTORY') && (
                  <TabsTrigger value="statutory" className="sm:px-4"><Landmark size={14} /> Statutory ({rowsByTab.statutory.length})</TabsTrigger>
                )}
              </TabsList>
              <div className="flex items-center gap-2">
                {statusFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    aria-label={`Clear ${statusMeta(CYCLE_STATUS, statusFilter).label} filter`}
                  >
                    {statusMeta(CYCLE_STATUS, statusFilter).label} <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search cycles"
                  className="w-full md:w-72"
                />
              </div>
            </div>

            <TabsContent value="fixed">{renderRows(rowsByTab.fixed, false)}</TabsContent>
            <TabsContent value="variable">{renderRows(rowsByTab.variable, true)}</TabsContent>
            <TabsContent value="statutory">{renderRows(rowsByTab.statutory, true)}</TabsContent>
          </Tabs>
        </Panel>
      </div>

      {enteringCycle && (
        <EntryDialog cycle={enteringCycle} onClose={() => setEnteringCycle(null)} onSaved={() => { setEnteringCycle(null); refresh(); }} />
      )}
    </div>
  );
};

export default ServicePoPage;
