import React from 'react';
import { CalendarClock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { DAY_COUNT_LABEL, formatDate, formatINR } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { formatRange, rateText, type LoanSegment } from '@/CustomComponent/LoanComponents/loanUtils';

/** The interest calculation: one row per slice of constant principal and rate. */
export const SegmentsTable: React.FC<{
  segments: LoanSegment[]; benchmarkName?: string | null; basis?: number; className?: string; compact?: boolean;
}> = ({ segments, benchmarkName, basis, className, compact }) => {
  if (!segments || segments.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No interest accrues in this period — nothing is outstanding.</p>;
  }
  const days = segments.reduce((s, r) => s + Number(r.days), 0);
  const total = segments.reduce((s, r) => s + Number(r.interest), 0);
  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Days</th>
              <th className="px-3 py-2 text-right font-medium">Principal</th>
              <th className="px-3 py-2 text-right font-medium">Rate p.a.</th>
              <th className="px-3 py-2 text-right font-medium">Interest</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {segments.map((s) => (
              <tr key={s.seg_no}>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{formatRange(s.from_date, s.to_date)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.days}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(s.principal)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="font-semibold">{Number(s.rate_pct)}%</span>
                  {s.benchmark_rate_pct != null && !compact && (
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {benchmarkName ?? 'Repo'} {Number(s.benchmark_rate_pct)}% + {Number(s.spread_pct ?? 0)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatINR(s.interest)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-3 py-2 text-xs font-medium text-muted-foreground">Total</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{days}</td>
              <td />
              <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">{basis ? DAY_COUNT_LABEL[String(basis)] : ''}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">{formatINR(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {segments.length > 0 && !compact && (
        <p className="border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          Interest = principal × rate ÷ {basis ?? 365} × days, for each slice; a slice ends where the rate or the principal changes.
        </p>
      )}
    </div>
  );
};

/** The money side of a voucher: outstanding, interest, repayment, total, and what is left. */
export const VoucherFigures: React.FC<{
  principalOnPayment: number; interest: number; days: number; repayment: number; total: number; principalAfter: number;
}> = ({ principalOnPayment, interest, days, repayment, total, principalAfter }) => (
  <dl className="space-y-2.5 text-sm">
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">Principal outstanding on payment date</dt>
      <dd className="font-medium tabular-nums">{formatINR(principalOnPayment)}</dd>
    </div>
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">Interest for {days} day{days === 1 ? '' : 's'}</dt>
      <dd className="font-medium tabular-nums">{formatINR(interest)}</dd>
    </div>
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">Principal repayment</dt>
      <dd className="font-medium tabular-nums">{repayment > 0 ? `+ ${formatINR(repayment)}` : '—'}</dd>
    </div>
    <div className="flex items-baseline justify-between gap-3 border-t pt-3">
      <dt className="text-sm font-semibold">Total payable</dt>
      <dd className="text-xl font-bold tabular-nums text-primary">{formatINR(total)}</dd>
    </div>
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="text-muted-foreground">Principal outstanding after this payment</dt>
      <dd className="font-semibold tabular-nums">{formatINR(principalAfter)}</dd>
    </div>
  </dl>
);

/** What the following interest date will cost, at the rates known so far. */
export const NextInterestPanel: React.FC<{
  nextDue?: string | null; nextDays?: number | null; nextInterest?: number | null;
  segments?: LoanSegment[]; benchmarkName?: string | null; basis?: number; principalAfter: number;
  floating?: boolean; finalPayment?: boolean;
}> = ({ nextDue, nextDays, nextInterest, segments, benchmarkName, basis, principalAfter, floating, finalPayment }) => {
  if (!nextDue) {
    return (
      <Panel icon={CalendarClock} title="Next interest">
        <p className="text-sm text-muted-foreground">
          {finalPayment ? 'This payment reaches the end of the loan term — there is no further interest to bill.' : 'No further interest date falls within the loan term.'}
        </p>
      </Panel>
    );
  }
  const last = segments && segments.length ? segments[segments.length - 1] : null;
  return (
    <Panel icon={CalendarClock} title="Next interest" description={`Due ${formatDate(nextDue)} · ${nextDays ?? '—'} days`}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estimated interest</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{formatINR(nextInterest)}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            on <b className="text-foreground">{formatINR(principalAfter)}</b> principal
            {last && <> at <b className="text-foreground">{rateText(last, benchmarkName)}</b></>}
          </div>
        </div>
        {segments && segments.length > 1 && <SegmentsTable segments={segments} benchmarkName={benchmarkName} basis={basis} compact />}
        {floating && (
          <Callout tone="neutral" icon={Info}>
            An estimate — it uses the rate entered so far and assumes no further principal movement. If the {benchmarkName ?? 'repo'} rate changes before
            {' '}{formatDate(nextDue)}, enter it under <b>Rates</b> and the exact figure is recalculated when that voucher is raised.
          </Callout>
        )}
      </div>
    </Panel>
  );
};
