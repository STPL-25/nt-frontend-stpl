import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Info, Loader2, Percent, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { Callout, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { dateOnly, formatDate } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { addDaysIso, type LoanAccount, type LoanDetail } from '@/CustomComponent/LoanComponents/loanUtils';
import { addLoanRatePeriod, deleteLoanRatePeriod } from '@/Services/Api';

interface Props {
  loan: LoanAccount;
  detail: LoanDetail | null;
  canAct: boolean;
  onChanged: () => void;
}

/**
 * The dated rate history. A rate applies from its date until the next one is entered — e.g. repo 15%
 * from 1 Jan and 14% from 16 Jan prices 1–15 Jan at 15% and everything from 16 Jan at 14%. A floating loan
 * takes the benchmark (repo) rate and adds the agreed spread; a fixed loan takes the new rate directly.
 */
export const LoanRatesPanel: React.FC<Props> = ({ loan, detail, canAct, onChanged }) => {
  const floating = loan.rate_type === 'FLOATING';
  const bench = loan.benchmark_name ?? 'Repo';
  const rates = detail?.rates ?? [];
  const spread = Number(loan.spread_pct ?? 0);

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [rate, setRate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const earliest = detail
    ? [addDaysIso(dateOnly(loan.disbursement_date), 1), dateOnly(detail.locked_through)].sort().pop() as string
    : undefined;
  const entered = Number(rate);
  const effective = rate === '' ? null : Math.round((floating ? entered + spread : entered) * 1000) / 1000;
  const canAdd = canAct && loan.agreement_status === 'A';

  const add = async () => {
    if (!effectiveFrom) { setError('Enter the date the rate takes effect'); return; }
    if (rate === '' || !(entered >= 0)) { setError(floating ? `Enter the ${bench} rate` : 'Enter the new interest rate'); return; }
    setSaving(true); setError(null);
    try {
      await axios.post(addLoanRatePeriod, {
        agreement_sno: loan.agreement_sno, effective_from: effectiveFrom,
        ...(floating ? { benchmark_rate_pct: entered } : { interest_rate_pct: entered }),
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Rate of ${effective}% effective ${formatDate(effectiveFrom)} added`);
      setEffectiveFrom(''); setRate(''); setRemarks('');
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to add the rate');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setRemoving(true);
    try {
      await axios.post(deleteLoanRatePeriod, { rate_period_sno: id });
      toast.success('Rate removed');
      setConfirmId(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to remove the rate');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel icon={Percent} title="Rate history" description={floating ? `${bench} rate + ${spread}% spread` : 'Fixed rate — add a row only if the rate is reset'}>
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">To</th>
                  {floating && <th className="px-3 py-2 text-right font-medium">{bench}</th>}
                  {floating && <th className="px-3 py-2 text-right font-medium">Spread</th>}
                  <th className="px-3 py-2 text-right font-medium">Rate p.a.</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rates.map((r, i) => {
                  const current = !r.effective_to;
                  return (
                    <tr key={r.rate_period_sno ?? `s${i}`} className={current ? 'bg-primary/5' : undefined}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{formatDate(r.effective_from)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {r.effective_to ? formatDate(r.effective_to) : <StatusPill tone="success">Current</StatusPill>}
                      </td>
                      {floating && <td className="px-3 py-2 text-right tabular-nums">{r.benchmark_rate_pct != null ? `${Number(r.benchmark_rate_pct)}%` : '—'}</td>}
                      {floating && <td className="px-3 py-2 text-right tabular-nums">{r.spread_pct != null ? `${Number(r.spread_pct)}%` : '—'}</td>}
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{Number(r.interest_rate_pct)}%</td>
                      <td className="max-w-[14rem] truncate px-3 py-2 text-xs text-muted-foreground" title={r.remarks ?? ''}>
                        {r.remarks ?? '—'}{r.created_by ? ` · ${r.created_by}` : ''}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {canAdd && r.can_delete === 1 && r.rate_period_sno != null && (
                          confirmId === r.rate_period_sno ? (
                            <span className="inline-flex items-center gap-1">
                              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={removing} onClick={() => remove(r.rate_period_sno as number)}>
                                {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmId(null)}>No</Button>
                            </span>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remove this rate" onClick={() => setConfirmId(r.rate_period_sno as number)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {detail && detail.locked_through && (
          <p className="mt-2 text-xs text-muted-foreground">
            Interest is billed (or awaiting approval) up to <b className="text-foreground">{formatDate(detail.locked_through)}</b> — rates before that date are locked.
          </p>
        )}
      </Panel>

      {canAdd && (
        <Panel icon={Plus} title={floating ? `Enter a ${bench} rate change` : 'Enter a rate reset'} bodyClassName="space-y-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
            <CustomInputField
              field="rate_effective_from" label="Effective from" require type="date"
              value={effectiveFrom} onChange={(v: string) => setEffectiveFrom(v)} min={earliest} max={dateOnly(loan.period_end_date)} className="h-10"
            />
            <CustomInputField
              field="rate_value" label={floating ? `${bench} rate (%)` : 'New interest rate (% p.a.)'} require type="number"
              value={rate} onChange={(v: string) => setRate(v)} placeholder="e.g. 14" step="0.001" className="h-10"
            />
            <div className="flex flex-col justify-end">
              <div className="flex h-10 items-center justify-between rounded-md border bg-muted/30 px-3 text-sm">
                <span className="text-muted-foreground">{floating ? `${bench} + ${spread}% =` : 'Rate'}</span>
                <span className="font-bold tabular-nums text-primary">{effective !== null ? `${effective}%` : '—'}</span>
              </div>
            </div>
            <div className="sm:col-span-3">
              <CustomInputField
                field="rate_remarks" label="Note (optional)" type="text"
                value={remarks} onChange={(v: string) => setRemarks(v)} placeholder="e.g. RBI policy announcement 6 Feb" className="h-10"
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <Callout tone="info" icon={Info}>
            Enter the date the bank applies the new rate — <b>the day before it, the old rate is still used</b>. For example, {bench} 15% from 1 Jan and 14% from
            16 Jan prices 1–15 Jan at 15% and 16 Jan onward at 14%. The interest for any period that spans the change is split automatically.
          </Callout>
          <div className="flex justify-end">
            <Button onClick={add} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Plus className="h-4 w-4" /> Add rate</>}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
};
