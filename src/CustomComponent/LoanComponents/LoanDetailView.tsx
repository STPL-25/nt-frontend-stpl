import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Calculator, Landmark, Percent, Receipt, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailHero, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  DAY_COUNT_LABEL, facilityLabel, formatDate, formatINR, ordinalDay, statusMeta,
} from '@/CustomComponent/ServiceComponents/serviceUtils';
import { VoucherCalculator } from '@/CustomComponent/LoanComponents/VoucherCalculator';
import { LoanRatesPanel } from '@/CustomComponent/LoanComponents/LoanRatesPanel';
import { LoanPrincipalPanel } from '@/CustomComponent/LoanComponents/LoanPrincipalPanel';
import {
  VOUCHER_STATUS, type LoanAccount, type LoanDetail,
} from '@/CustomComponent/LoanComponents/loanUtils';
import { getLoanDetail } from '@/Services/Api';

interface Props {
  loan: LoanAccount;
  canAct: boolean;
  /** Bumped whenever anything about the loan may have changed (the parent re-reads the account row too). */
  refreshKey: number;
  onBack: () => void;
  onChanged: () => void;
  onOpenVoucher: (voucherSno: number) => void;
}

type DetailTab = 'voucher' | 'rates' | 'principal' | 'vouchers';

export const LoanDetailView: React.FC<Props> = ({ loan, canAct, refreshKey, onBack, onChanged, onOpenVoucher }) => {
  const [tab, setTab] = useState<DetailTab>('voucher');
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get(getLoanDetail, { params: { agreement_sno: loan.agreement_sno } })
      .then((res) => { if (!cancelled) setDetail(res.data?.data ?? null); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.agreement_sno, refreshKey]);

  const floating = loan.rate_type === 'FLOATING';
  const bench = loan.benchmark_name ?? 'Repo';
  const expired = loan.agreement_status !== 'A';
  const vouchers = detail?.vouchers ?? [];

  return (
    <div className="@container space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All loans
      </Button>

      <DetailHero
        icon={Landmark}
        eyebrow={`${facilityLabel(loan.facility_type)}${loan.facility_ref_no ? ` · ${loan.facility_ref_no}` : ''}`}
        title={loan.vendor_name ?? loan.agreement_no}
        subtitle={`${loan.agreement_no} · sanctioned ${formatINR(loan.sanctioned_amount)} · interest from ${formatDate(loan.disbursement_date)}`}
        badges={(
          <>
            <StatusPill tone="info">{floating ? `Floating · ${bench}-linked` : 'Fixed rate'}</StatusPill>
            <StatusPill tone="neutral">{DAY_COUNT_LABEL[String(loan.day_count_basis)]}</StatusPill>
            {expired && <StatusPill tone="warning">Agreement expired</StatusPill>}
            {loan.pending_voucher_no && <StatusPill tone="warning">{loan.pending_voucher_no} awaiting approval</StatusPill>}
            {loan.unpaid_voucher_no && <StatusPill tone="info">{loan.unpaid_voucher_no} to pay</StatusPill>}
          </>
        )}
        metrics={[
          { label: 'Principal outstanding', value: formatINR(loan.principal_outstanding), accent: true, hint: `of ${formatINR(loan.disbursed_amount)} disbursed` },
          { label: 'Current rate', value: `${Number(loan.current_rate_pct)}%`, hint: floating ? `${bench} + ${Number(loan.spread_pct ?? 0)}% spread` : 'fixed' },
          { label: 'Interest accrued', value: formatINR(loan.accrued_interest), hint: `since ${formatDate(loan.billed_through)}` },
          { label: 'Next interest date', value: loan.next_due_date ? formatDate(loan.next_due_date) : '—', hint: `${ordinalDay(loan.interest_payment_day)} of every month` },
        ]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="voucher" className="sm:px-4"><Calculator size={14} /> Interest &amp; voucher</TabsTrigger>
          <TabsTrigger value="rates" className="sm:px-4"><Percent size={14} /> Rates ({detail?.rates.length ?? '…'})</TabsTrigger>
          <TabsTrigger value="principal" className="sm:px-4"><Wallet size={14} /> Principal</TabsTrigger>
          <TabsTrigger value="vouchers" className="sm:px-4"><Receipt size={14} /> Vouchers ({vouchers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="voucher">
          <VoucherCalculator loan={loan} canAct={canAct} refreshKey={refreshKey} onCreated={() => { setTab('vouchers'); onChanged(); }} />
        </TabsContent>

        <TabsContent value="rates">
          {loading && !detail ? <Skeleton className="h-48 w-full rounded-xl" /> : <LoanRatesPanel loan={loan} detail={detail} canAct={canAct} onChanged={onChanged} />}
        </TabsContent>

        <TabsContent value="principal">
          {loading && !detail ? <Skeleton className="h-48 w-full rounded-xl" /> : <LoanPrincipalPanel loan={loan} detail={detail} canAct={canAct} onChanged={onChanged} />}
        </TabsContent>

        <TabsContent value="vouchers">
          <Panel icon={Receipt} title="Bank payment vouchers" description="Newest first — each one covers the interest from where the previous ended">
            {loading && !detail ? <Skeleton className="h-32 w-full rounded-lg" /> : vouchers.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No vouchers raised for this loan yet.</p>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-lg border md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Voucher</th>
                        <th className="px-3 py-2 font-medium">Interest period</th>
                        <th className="px-3 py-2 text-right font-medium">Interest</th>
                        <th className="px-3 py-2 text-right font-medium">Principal</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="w-20" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {vouchers.map((v) => {
                        const st = statusMeta(VOUCHER_STATUS, v.status);
                        return (
                          <tr key={v.voucher_sno}>
                            <td className="px-3 py-2 font-semibold">{v.voucher_no}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(v.period_from)} → {formatDate(v.period_to)} · {v.days}d</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatINR(v.interest_amount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{v.principal_repayment > 0 ? formatINR(v.principal_repayment) : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatINR(v.total_payable)}</td>
                            <td className="px-3 py-2"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                            <td className="px-2 py-1 text-right"><Button size="sm" variant="ghost" onClick={() => onOpenVoucher(v.voucher_sno)}>View</Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-3 md:hidden">
                  {vouchers.map((v) => {
                    const st = statusMeta(VOUCHER_STATUS, v.status);
                    return (
                      <li key={v.voucher_sno} className="rounded-xl border bg-card p-3.5 shadow-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{v.voucher_no}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(v.period_from)} → {formatDate(v.period_to)} · {v.days} days</p>
                          </div>
                          <StatusPill tone={st.tone}>{st.label}</StatusPill>
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                          <div><dt className="text-muted-foreground">Interest</dt><dd className="mt-0.5 font-semibold tabular-nums">{formatINR(v.interest_amount)}</dd></div>
                          <div><dt className="text-muted-foreground">Principal</dt><dd className="mt-0.5 font-semibold tabular-nums">{v.principal_repayment > 0 ? formatINR(v.principal_repayment) : '—'}</dd></div>
                          <div><dt className="text-muted-foreground">Total</dt><dd className="mt-0.5 font-bold tabular-nums">{formatINR(v.total_payable)}</dd></div>
                        </dl>
                        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => onOpenVoucher(v.voucher_sno)}>View voucher</Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
};
