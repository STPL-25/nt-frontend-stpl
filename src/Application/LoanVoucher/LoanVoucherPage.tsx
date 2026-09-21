import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Banknote, ChevronRight, Clock, HandCoins, Landmark, PiggyBank, Receipt, RefreshCw, SearchX, TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, PageHeader } from '@/CustomComponent/PageComponents';
import { FilterChips, Panel, SearchInput, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  TONE, facilityLabel, formatDate, formatINR, ordinalDay, statusMeta, type Tone,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import { LoanDetailView } from '@/CustomComponent/LoanComponents/LoanDetailView';
import { LoanVoucherDialog } from '@/CustomComponent/LoanComponents/LoanVoucherDialog';
import { VOUCHER_STATUS, type LoanAccount } from '@/CustomComponent/LoanComponents/loanUtils';
import { getBankPaymentVouchers, getLoanAccounts } from '@/Services/Api';
import {
  socket, SOCKET_JOIN_LOAN_VOUCHER_APPROVAL, SOCKET_LEAVE_LOAN_VOUCHER_APPROVAL, SOCKET_LOAN_VOUCHER_APPROVAL_UPDATED,
} from '@/Services/Socket';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import useFetch from '@/hooks/useFetchHook';
import { cn } from '@/lib/utils';

// Loans in process: every approved Statutory (loan / repo / cash-credit) agreement. Open one to enter
// rate changes, record principal movements and raise the Bank Payment Voucher for each interest date.
// Server side: backend-stpl/sql/89_loan_facility_bank_payment_voucher.sql.

interface VoucherRow {
  voucher_sno: number; voucher_no: string; agreement_no: string; vendor_name?: string; facility_type?: string;
  period_from: string; period_to: string; days: number;
  interest_amount: number; principal_repayment: number; total_payable: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED';
  current_approver_id?: string | null; created_by: string; created_at: string; paid_on?: string | null;
}

type PageTab = 'loans' | 'vouchers';
type VoucherFilter = 'ALL' | VoucherRow['status'];

const StatTile: React.FC<{ icon: LucideIcon; tone: Tone; label: string; value: React.ReactNode; hint?: string }> = ({ icon: Icon, tone, label, value, hint }) => (
  <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs sm:p-4">
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', TONE[tone])}><Icon className="h-5 w-5" /></span>
    <span className="min-w-0">
      <span className="block truncate text-lg font-bold leading-none tabular-nums sm:text-xl">{value}</span>
      <span className="mt-1 block text-xs font-medium leading-tight">{label}</span>
      {hint && <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{hint}</span>}
    </span>
  </div>
);

const LoanVoucherPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const canAct = canCreate('LoanVoucherPage') || canEdit('LoanVoucherPage');

  const [tab, setTab] = useState<PageTab>('loans');
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const [selectedSno, setSelectedSno] = useState<number | null>(null);
  const [openVoucher, setOpenVoucher] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [voucherFilter, setVoucherFilter] = useState<VoucherFilter>('ALL');

  // useFetch clears its data while re-fetching; keep the last good lists so an open loan doesn't vanish mid-refresh.
  const { data: loansRes, loading: loadingLoans, error: loansError } = useFetch<{ success: boolean; data: LoanAccount[] }>(getLoanAccounts, '', null, refreshKey);
  const { data: vouchersRes, loading: loadingVouchers } = useFetch<{ success: boolean; data: VoucherRow[] }>(getBankPaymentVouchers, '', null, refreshKey);
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  useEffect(() => { if (loansRes && !loadingLoans) { setLoans(loansRes.data ?? []); setLoadedOnce(true); } }, [loansRes, loadingLoans]);
  useEffect(() => { if (vouchersRes && !loadingVouchers) setVouchers(vouchersRes.data ?? []); }, [vouchersRes, loadingVouchers]);

  // An approver acting elsewhere changes what's pending / to pay here.
  useEffect(() => {
    socket.emit(SOCKET_JOIN_LOAN_VOUCHER_APPROVAL);
    const onUpdated = () => setRefreshKey((k) => k + 1);
    socket.on(SOCKET_LOAN_VOUCHER_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_LOAN_VOUCHER_APPROVAL);
      socket.off(SOCKET_LOAN_VOUCHER_APPROVAL_UPDATED, onUpdated);
    };
  }, []);

  const selected = useMemo(() => loans.find((l) => l.agreement_sno === selectedSno) ?? null, [loans, selectedSno]);

  const totals = useMemo(() => ({
    outstanding: loans.reduce((s, l) => s + Number(l.principal_outstanding || 0), 0),
    accrued: loans.reduce((s, l) => s + Number(l.accrued_interest || 0), 0),
    pending: vouchers.filter((v) => v.status === 'PENDING_APPROVAL').length,
    toPay: vouchers.filter((v) => v.status === 'APPROVED').length,
  }), [loans, vouchers]);

  const q = search.trim().toLowerCase();
  const filteredLoans = useMemo(
    () => loans.filter((l) => !q || [l.agreement_no, l.vendor_name, l.facility_ref_no, l.service_name].some((v) => v?.toLowerCase().includes(q))),
    [loans, q],
  );
  const filteredVouchers = useMemo(
    () => vouchers.filter((v) => (voucherFilter === 'ALL' || v.status === voucherFilter)
      && (!q || [v.voucher_no, v.agreement_no, v.vendor_name].some((x) => x?.toLowerCase().includes(q)))),
    [vouchers, voucherFilter, q],
  );
  const voucherCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: vouchers.length };
    vouchers.forEach((v) => { c[v.status] = (c[v.status] ?? 0) + 1; });
    return c;
  }, [vouchers]);

  const initialLoading = !loadedOnce && loadingLoans;

  const loanRow = (l: LoanAccount) => {
    const floating = l.rate_type === 'FLOATING';
    return (
      <li key={l.agreement_sno}>
        <button
          type="button"
          onClick={() => setSelectedSno(l.agreement_sno)}
          className="group flex w-full flex-col gap-3 rounded-xl border bg-card p-3.5 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-4 lg:flex-row lg:items-center"
        >
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{l.vendor_name ?? l.agreement_no}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {l.agreement_no} · {facilityLabel(l.facility_type)}{l.facility_ref_no ? ` · ${l.facility_ref_no}` : ''}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusPill tone="info">{floating ? `${l.benchmark_name ?? 'Repo'}-linked` : 'Fixed'} {Number(l.current_rate_pct)}%</StatusPill>
                {l.agreement_status === 'X' && <StatusPill tone="warning">Expired</StatusPill>}
                {l.pending_voucher_no && <StatusPill tone="warning">{l.pending_voucher_no} awaiting approval</StatusPill>}
                {l.unpaid_voucher_no && <StatusPill tone="info">{l.unpaid_voucher_no} to pay</StatusPill>}
              </span>
            </span>
          </span>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4 lg:w-[34rem] lg:shrink-0">
            <div>
              <dt className="text-muted-foreground">Principal outstanding</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums">{formatINR(l.principal_outstanding)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Interest accrued</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{formatINR(l.accrued_interest)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Billed up to</dt>
              <dd className="mt-0.5 text-sm font-medium">{formatDate(l.billed_through)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next interest</dt>
              <dd className="mt-0.5 text-sm font-medium">{l.next_due_date ? formatDate(l.next_due_date) : '—'}
                <span className="block text-[11px] font-normal text-muted-foreground">{ordinalDay(l.interest_payment_day)} of the month</span>
              </dd>
            </div>
          </dl>
          <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary lg:block" />
        </button>
      </li>
    );
  };

  const voucherList = (rows: VoucherRow[]) => {
    if (loadingVouchers && vouchers.length === 0) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>;
    if (rows.length === 0) {
      const filtering = voucherFilter !== 'ALL' || q !== '';
      return (
        <EmptyState
          icon={filtering ? SearchX : Receipt}
          message={filtering ? 'No vouchers match your filters' : 'No bank payment vouchers yet'}
          description={filtering ? 'Try a different status or search term.' : 'Open a loan and raise a voucher for its next interest date.'}
        />
      );
    }
    return (
      <ul className="space-y-3">
        {rows.map((v) => {
          const st = statusMeta(VOUCHER_STATUS, v.status);
          return (
            <li key={v.voucher_sno}>
              <button
                type="button"
                onClick={() => setOpenVoucher(v.voucher_sno)}
                className="flex w-full flex-col gap-3 rounded-xl border bg-card p-3.5 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{v.voucher_no}</span>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {v.vendor_name ?? '—'} · {v.agreement_no} · {formatDate(v.period_from)} → {formatDate(v.period_to)} ({v.days} days)
                  </span>
                </span>
                <dl className="grid grid-cols-3 gap-x-6 text-xs sm:w-72 sm:shrink-0">
                  <div><dt className="text-muted-foreground">Interest</dt><dd className="mt-0.5 font-semibold tabular-nums">{formatINR(v.interest_amount)}</dd></div>
                  <div><dt className="text-muted-foreground">Principal</dt><dd className="mt-0.5 font-semibold tabular-nums">{v.principal_repayment > 0 ? formatINR(v.principal_repayment) : '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Total</dt><dd className="mt-0.5 text-sm font-bold tabular-nums">{formatINR(v.total_payable)}</dd></div>
                </dl>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-h-full bg-muted/30">
      <PageHeader
        icon={Landmark}
        title="Loan Payments"
        description="Interest on approved loans, repo and cash-credit facilities — enter rate changes, and raise a Bank Payment Voucher for every interest date"
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        {selected ? (
          <LoanDetailView
            loan={selected}
            canAct={canAct}
            refreshKey={refreshKey}
            onBack={() => setSelectedSno(null)}
            onChanged={refresh}
            onOpenVoucher={setOpenVoucher}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile icon={Landmark} tone="primary" label="Loans in process" value={loans.length} hint="Approved facilities" />
              <StatTile icon={PiggyBank} tone="info" label="Principal outstanding" value={formatINR(totals.outstanding, 0)} hint="Across all loans, today" />
              <StatTile icon={TrendingUp} tone="violet" label="Interest accrued" value={formatINR(totals.accrued, 0)} hint="Not yet billed" />
              <StatTile icon={Clock} tone={totals.pending + totals.toPay > 0 ? 'warning' : 'neutral'} label="Vouchers open" value={totals.pending + totals.toPay} hint={`${totals.pending} to approve · ${totals.toPay} to pay`} />
            </div>

            <Panel
              icon={HandCoins}
              title="Loans & vouchers"
              action={<Button variant="outline" size="sm" onClick={refresh} disabled={loadingLoans}><RefreshCw size={14} className={cn(loadingLoans && 'animate-spin')} /> <span className="hidden sm:inline">Refresh</span></Button>}
            >
              <Tabs value={tab} onValueChange={(v) => setTab(v as PageTab)} className="gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <TabsList className="w-full sm:w-fit">
                    <TabsTrigger value="loans" className="sm:px-4"><Landmark size={14} /> Loans ({loans.length})</TabsTrigger>
                    <TabsTrigger value="vouchers" className="sm:px-4"><Banknote size={14} /> Vouchers ({vouchers.length})</TabsTrigger>
                  </TabsList>
                  <SearchInput value={search} onChange={setSearch} placeholder={tab === 'loans' ? 'Search loans' : 'Search vouchers'} className="w-full md:w-72" />
                </div>

                <TabsContent value="loans">
                  {initialLoading ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
                  ) : loansError && loans.length === 0 ? (
                    <EmptyState icon={SearchX} message="Couldn't load the loans" description={loansError} action={<Button variant="outline" size="sm" onClick={refresh}>Try again</Button>} />
                  ) : filteredLoans.length === 0 ? (
                    <EmptyState
                      icon={q ? SearchX : Landmark}
                      message={q ? 'No loans match your search' : 'No loans in process yet'}
                      description={q ? 'Try a different search term.' : 'Create a Statutory agreement under Service Agreements. Once it is approved, the loan appears here.'}
                    />
                  ) : (
                    <ul className="space-y-3">{filteredLoans.map(loanRow)}</ul>
                  )}
                </TabsContent>

                <TabsContent value="vouchers" className="space-y-4">
                  <FilterChips<VoucherFilter>
                    value={voucherFilter}
                    onChange={setVoucherFilter}
                    options={[
                      { value: 'ALL', label: 'All', count: voucherCounts.ALL },
                      { value: 'PENDING_APPROVAL', label: 'Pending approval', count: voucherCounts.PENDING_APPROVAL ?? 0 },
                      { value: 'APPROVED', label: 'To pay', count: voucherCounts.APPROVED ?? 0 },
                      { value: 'PAID', label: 'Paid', count: voucherCounts.PAID ?? 0 },
                      { value: 'REJECTED', label: 'Rejected', count: voucherCounts.REJECTED ?? 0 },
                    ]}
                  />
                  {voucherList(filteredVouchers)}
                </TabsContent>
              </Tabs>
            </Panel>
          </>
        )}
      </div>

      {openVoucher != null && (
        <LoanVoucherDialog
          voucherSno={openVoucher}
          canRecordPayment={canAct}
          onClose={() => setOpenVoucher(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
};

export default LoanVoucherPage;
