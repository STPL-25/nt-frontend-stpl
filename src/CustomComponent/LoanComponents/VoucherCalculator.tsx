import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle, Banknote, CalendarCheck2, Calculator, Clock, Loader2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { Callout, Fact, FactGrid, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { dateOnly, formatDate, formatINR } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { NextInterestPanel, SegmentsTable, VoucherFigures } from '@/CustomComponent/LoanComponents/InterestBreakdown';
import { addDaysIso, type LoanAccount, type LoanBeneficiary, type VoucherPreview } from '@/CustomComponent/LoanComponents/loanUtils';
import { createBankPaymentVoucher, previewLoanInterest } from '@/Services/Api';

interface Props {
  loan: LoanAccount;
  canAct: boolean;
  /** Bumped by the parent whenever rates / principal / vouchers change, so the figures re-read. */
  refreshKey: number;
  /** The vendor's KYC bank account this voucher will actually pay into — shown next to where the transaction is raised, not at the top of the screen. */
  beneficiary: LoanBeneficiary | null;
  /** Sum of REPAYMENT movements to date (manual + voucher), for the "Principal paid" stat. */
  principalPaid: number;
  onCreated: () => void;
}

/** One stat in the snapshot row above the calculator — `valueClassName` colors just the figure (red for money owed, green for money already paid). */
function SnapshotStat({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate text-base font-bold tabular-nums ${valueClassName ?? 'text-foreground'}`}>{value}</dd>
    </div>
  );
}

/**
 * Works out what is owed up to a payment date — interest on the outstanding principal, split at every
 * rate change and principal movement — and raises the Bank Payment Voucher for it. The figures come
 * from the server (the same calculation that is frozen into the voucher), so this never disagrees with it.
 */
export const VoucherCalculator: React.FC<Props> = ({ loan, canAct, refreshKey, beneficiary, principalPaid, onCreated }) => {
  const [paymentDate, setPaymentDate] = useState('');
  const [repay, setRepay] = useState('');
  const [remarks, setRemarks] = useState('');
  const [preview, setPreview] = useState<VoucherPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const skipKey = useRef<string | null>(null);

  const key = `${paymentDate}|${repay}|${refreshKey}`;

  useEffect(() => {
    if (skipKey.current === key) { skipKey.current = null; return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(previewLoanInterest, {
          params: {
            agreement_sno: loan.agreement_sno,
            payment_date: paymentDate || undefined,
            principal_repayment: Number(repay) > 0 ? Number(repay) : undefined,
          },
        });
        if (cancelled) return;
        const p: VoucherPreview = res.data?.data;
        setPreview(p);
        setError(null);
        // First load: show the scheduled date in the box (the server picked it), without re-fetching.
        if (!paymentDate && p) {
          const d = dateOnly(p.default_payment_date);
          skipKey.current = `${d}|${repay}|${refreshKey}`;
          setPaymentDate(d);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.error ?? 'Could not calculate the interest');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, paymentDate || repay ? 350 : 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loan.agreement_sno]);

  const from = preview ? dateOnly(preview.period_from) : dateOnly(loan.billed_through);
  const minDate = addDaysIso(from, 1);
  const maxDate = dateOnly(loan.period_end_date);
  const scheduled = preview ? dateOnly(preview.default_payment_date) : '';
  const repayNum = Number(repay) || 0;
  const expired = loan.agreement_status !== 'A';
  const blocked = expired || !!preview?.open_voucher_sno;
  const canCreate = canAct && !blocked && !!preview && !error && !loading && preview.total_payable > 0;

  const create = async () => {
    if (!preview) return;
    setCreating(true);
    try {
      const res = await axios.post(createBankPaymentVoucher, {
        agreement_sno: loan.agreement_sno,
        payment_date: dateOnly(preview.period_to),
        principal_repayment: repayNum > 0 ? repayNum : undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Voucher ${res.data?.data?.[0]?.voucher_no ?? ''} sent for approval`);
      setRepay(''); setRemarks(''); setPaymentDate('');
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Could not raise the voucher');
    } finally {
      setCreating(false);
    }
  };

  const floating = loan.rate_type === 'FLOATING';

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SnapshotStat label="Loan sanctioned" value={formatINR(loan.sanctioned_amount)} />
        <SnapshotStat label="Loan availed" value={formatINR(loan.disbursed_amount)} valueClassName="text-red-600 dark:text-red-400" />
        <SnapshotStat label="Principal paid" value={formatINR(principalPaid)} valueClassName="text-emerald-600 dark:text-emerald-400" />
        <SnapshotStat label="Current outstanding" value={formatINR(loan.principal_outstanding)} />
        <SnapshotStat label="Interest %" value={`${Number(loan.current_rate_pct)}%`} />
        <SnapshotStat label="Interest amount" value={formatINR(loan.accrued_interest)} />
      </dl>

      {expired && (
        <Callout tone="warning" icon={AlertCircle}>
          This loan agreement has expired. Renew it under <b>Service Agreements</b> to raise further interest vouchers.
        </Callout>
      )}
      {preview?.open_voucher_sno && (
        <Callout tone="warning" icon={Clock}>
          Voucher <b>{preview.open_voucher_no}</b> is still awaiting approval. Approve or reject it before raising the next one —
          the next voucher starts where that one ends.
        </Callout>
      )}

      <Panel
        icon={Calculator}
        title="Interest & payment voucher"
        description={preview
          ? `Interest from ${formatDate(preview.period_from)} up to (not including) the payment date`
          : 'Pick the payment date — interest is worked out up to it'}
        bodyClassName="space-y-4"
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          <div className="flex flex-col">
            <CustomInputField
              field="calc_payment_date" label="Payment date" require type="date"
              value={paymentDate} onChange={(v: string) => setPaymentDate(v)}
              min={minDate} max={maxDate} className="h-10"
            />
            {scheduled && paymentDate !== scheduled && (
              <button
                type="button"
                onClick={() => setPaymentDate(scheduled)}
                className="mt-1.5 inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Use the scheduled date ({formatDate(scheduled)})
              </button>
            )}
          </div>
          <CustomInputField
            field="calc_repay" label="Principal repayment (optional)" type="number"
            value={repay} onChange={(v: string) => setRepay(v)} placeholder="0.00" className="h-10"
          />
          <CustomInputField
            field="calc_remarks" label="Narration (optional)" type="text"
            value={remarks} onChange={(v: string) => setRemarks(v)} placeholder="e.g. Feb interest" className="h-10"
          />
        </div>

        {error && <Callout tone="danger" icon={AlertCircle}>{error}</Callout>}

        {!preview && loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</div>
        )}

        {preview && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="min-w-0 space-y-3 lg:col-span-3">
                <SegmentsTable segments={preview.segments} benchmarkName={preview.benchmark_name} basis={preview.day_count_basis} />
                {preview.is_projected === 1 && (
                  <Callout tone="neutral" icon={CalendarCheck2}>
                    {preview.projected_days} of these {preview.days} days are still to come. They are priced at the rate in force from{' '}
                    <b>{formatDate(preview.rate_effective_from)}</b> ({Number(preview.rate_pct)}%). If the {preview.benchmark_name ?? 'repo'} rate changes
                    before the payment date, enter it under <b>Rates</b> — this recalculates.
                  </Callout>
                )}
              </div>
              <div className="min-w-0 rounded-xl border bg-muted/20 p-4 lg:col-span-2">
                <VoucherFigures
                  principalOnPayment={preview.principal_on_payment} interest={preview.interest_amount} days={preview.days}
                  repayment={repayNum} total={preview.total_payable} principalAfter={preview.principal_after}
                />
                <div className="mt-4 rounded-lg border bg-card p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Banknote className="h-3.5 w-3.5" /> Pays into (KYC)
                  </p>
                  {beneficiary ? (
                    <FactGrid className="gap-y-2.5">
                      <Fact label="Account holder">{beneficiary.ac_holder_name ?? '—'}</Fact>
                      <Fact label="Account no.">{beneficiary.ac_number ?? '—'}</Fact>
                      <Fact label="IFSC">{beneficiary.ifsc ?? '—'}</Fact>
                      <Fact label="Bank">{beneficiary.bank_name}{beneficiary.bank_branch_name ? `, ${beneficiary.bank_branch_name}` : ''}</Fact>
                    </FactGrid>
                  ) : (
                    <p className="text-xs text-muted-foreground">No active bank account on file for this vendor's KYC yet — the voucher can still be raised, but add one before paying it.</p>
                  )}
                </div>
                {canAct ? (
                  <Button className="mt-4 h-11 w-full" onClick={create} disabled={!canCreate || creating}>
                    {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Raising…</> : <><Send className="h-4 w-4" /> Raise voucher · {formatINR(preview.total_payable)}</>}
                  </Button>
                ) : (
                  <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">View only — you can't raise vouchers</p>
                )}
                <p className="mt-2 text-center text-[11px] text-muted-foreground">Goes to the approver; the calculation is frozen into the voucher.</p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {preview && (
        <NextInterestPanel
          nextDue={preview.next_due_date} nextDays={preview.next_days} nextInterest={preview.next_est_interest}
          segments={preview.next_segments} benchmarkName={preview.benchmark_name} basis={preview.day_count_basis}
          principalAfter={preview.principal_after} floating={floating}
          finalPayment={dateOnly(preview.period_to) >= dateOnly(loan.period_end_date)}
        />
      )}
    </div>
  );
};
