import React, { useState } from 'react';
import { CalendarClock, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { DAY_COUNT_LABEL, formatDate, formatINR } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { addDaysIso, formatRange, rateText, type LoanSegment } from '@/CustomComponent/LoanComponents/loanUtils';

/** Every calendar day in a slice (inclusive) — principal and rate are constant across it, so each day's interest is the same. */
function daysInSlice(from: string, to: string): string[] {
  const out: string[] = [];
  const end = to.slice(0, 10);
  let d = from.slice(0, 10);
  let guard = 0;
  while (d <= end && guard++ < 400) {
    out.push(d);
    d = addDaysIso(d, 1);
  }
  return out;
}

/** The interest calculation: one row per slice of constant principal and rate. */
export const SegmentsTable: React.FC<{
  segments: LoanSegment[]; benchmarkName?: string | null; basis?: number; className?: string; compact?: boolean;
}> = ({ segments, benchmarkName, basis, className, compact }) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (segNo: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(segNo)) next.delete(segNo); else next.add(segNo);
    return next;
  });

  if (!segments || segments.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No interest accrues in this period — nothing is outstanding.</p>;
  }
  const days = segments.reduce((s, r) => s + Number(r.days), 0);
  const total = segments.reduce((s, r) => s + Number(r.interest), 0);
  return (
    <div className={cn('space-y-2', className)}>
      {segments.map((s) => {
        const isOpen = expanded.has(s.seg_no);
        const dailyInterest = (Number(s.principal) * Number(s.rate_pct)) / 100 / (basis || 365);
        return (
        <div key={s.seg_no} className="rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-semibold">{formatRange(s.from_date, s.to_date)}</p>
            <p className="text-xs text-muted-foreground">{s.days} day{s.days === 1 ? '' : 's'}</p>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Principal</dt><dd className="mt-0.5 font-semibold tabular-nums">{formatINR(s.principal)}</dd></div>
            <div>
              <dt className="text-muted-foreground">Rate p.a.</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {Number(s.rate_pct)}%
                {s.benchmark_rate_pct != null && !compact && (
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {benchmarkName ?? 'Repo'} {Number(s.benchmark_rate_pct)}% + {Number(s.spread_pct ?? 0)}%
                  </span>
                )}
              </dd>
            </div>
            <div><dt className="text-muted-foreground">Interest</dt><dd className="mt-0.5 font-bold tabular-nums text-primary">{formatINR(s.interest)}</dd></div>
          </dl>

          {!compact && s.days > 1 && (
            <>
              <button
                type="button"
                onClick={() => toggle(s.seg_no)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
                {isOpen ? 'Hide' : 'View'} daily breakdown
              </button>
              {isOpen && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Principal</th>
                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Rate p.a.</th>
                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Interest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daysInSlice(s.from_date, s.to_date).map((day) => (
                        <tr key={day} className="border-t">
                          <td className="px-2 py-1">{formatDate(day)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatINR(s.principal)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{Number(s.rate_pct)}%</td>
                          <td className="px-2 py-1 text-right tabular-nums font-medium">{formatINR(dailyInterest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        );
      })}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border bg-muted/30 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Total · {days} day{days === 1 ? '' : 's'}{basis ? ` · ${DAY_COUNT_LABEL[String(basis)]}` : ''}</p>
        <p className="text-sm font-bold tabular-nums text-primary">{formatINR(total)}</p>
      </div>
      {segments.length > 0 && !compact && (
        <p className="px-1 text-[11px] text-muted-foreground">
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
