import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowUpFromLine, Info, Landmark, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { dateOnly, formatDate, formatINR } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { type LoanAccount, type LoanDetail } from '@/CustomComponent/LoanComponents/loanUtils';
import { addLoanPrincipalTxn, deleteLoanPrincipalTxn } from '@/Services/Api';

interface Props {
  loan: LoanAccount;
  detail: LoanDetail | null;
  canAct: boolean;
  onChanged: () => void;
}

const TYPES = [
  { value: 'REPAYMENT', label: 'Repayment (principal paid)' },
  { value: 'DRAWDOWN', label: 'Drawdown (more drawn)' },
];

/**
 * The principal ledger: the opening disbursement and every movement after it, with the balance
 * interest is charged on. A movement takes effect from its date. Principal repaid through an approved
 * voucher lands here on its own; use this form for drawdowns / part-drawings (cash credit, staged
 * disbursements) and for prepayments made outside a voucher.
 */
export const LoanPrincipalPanel: React.FC<Props> = ({ loan, detail, canAct, onChanged }) => {
  const txns = detail?.txns ?? [];
  const isCC = loan.facility_type === 'CASH_CREDIT';
  const limit = isCC ? (loan.drawing_power ?? loan.sanctioned_amount) : loan.sanctioned_amount;

  const [type, setType] = useState(isCC ? 'DRAWDOWN' : 'REPAYMENT');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const canAdd = canAct && loan.agreement_status === 'A';

  const add = async () => {
    if (!date) { setError('Enter the date it takes effect'); return; }
    if (!(Number(amount) > 0)) { setError('Enter an amount greater than zero'); return; }
    setSaving(true); setError(null);
    try {
      await axios.post(addLoanPrincipalTxn, {
        agreement_sno: loan.agreement_sno, txn_type: type, txn_date: date, amount: Number(amount), remarks: remarks.trim() || undefined,
      });
      toast.success(`${type === 'DRAWDOWN' ? 'Drawdown' : 'Repayment'} of ${formatINR(Number(amount))} added`);
      setDate(''); setAmount(''); setRemarks('');
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to add the movement');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setRemoving(true);
    try {
      await axios.post(deleteLoanPrincipalTxn, { txn_sno: id });
      toast.success('Movement removed');
      setConfirmId(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to remove the movement');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel icon={Landmark} title="Principal ledger" description={`Outstanding today ${formatINR(loan.principal_outstanding)} · ${isCC ? 'limit' : 'sanctioned'} ${formatINR(limit)}`}>
        {txns.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing has been drawn on this facility yet.</p>
        ) : (
          <div className="space-y-2.5">
            {txns.map((t, i) => {
              const isDrawdown = t.txn_type === 'DRAWDOWN';
              return (
                <div key={t.txn_sno ?? `o${i}`} className="rounded-xl border bg-card p-3.5 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{formatDate(t.txn_date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.source === 'OPENING' ? 'Disbursed' : t.source === 'VOUCHER' ? 'Voucher repayment' : isDrawdown ? 'Drawdown' : 'Repayment'}
                        {t.remarks ? ` — ${t.remarks}` : ''}{t.created_by ? ` · ${t.created_by}` : ''}
                      </p>
                    </div>
                    {canAdd && t.can_delete === 1 && t.txn_sno != null && (
                      confirmId === t.txn_sno ? (
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={removing} onClick={() => remove(t.txn_sno as number)}>
                            {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmId(null)}>No</Button>
                        </span>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove this movement" onClick={() => setConfirmId(t.txn_sno as number)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>
                  {/* Every statement always carries this same context, so nobody has to scroll back to the header to make sense of a row. */}
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs sm:grid-cols-4">
                    <div><dt className="text-muted-foreground">Loan sanctioned</dt><dd className="mt-0.5 font-semibold tabular-nums">{formatINR(limit)}</dd></div>
                    <div><dt className="text-muted-foreground">Loan availed</dt><dd className="mt-0.5 font-semibold tabular-nums text-red-600 dark:text-red-400">{isDrawdown ? formatINR(t.amount) : '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Principal paid</dt><dd className="mt-0.5 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{!isDrawdown ? formatINR(t.amount) : '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Interest</dt><dd className="mt-0.5 font-semibold tabular-nums">{Number(loan.current_rate_pct)}%</dd></div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {canAdd && (
        <Panel icon={type === 'DRAWDOWN' ? ArrowDownToLine : ArrowUpFromLine} title="Add a principal movement" bodyClassName="space-y-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
            <CustomInputField
              field="txn_type" label="Type" require type="select" options={TYPES}
              value={type} onChange={(v: string) => setType(v)} className="h-10"
            />
            <CustomInputField
              field="txn_date" label="Effective from" require type="date"
              value={date} onChange={(v: string) => setDate(v)} max={dateOnly(loan.period_end_date)} className="h-10"
            />
            <CustomInputField
              field="txn_amount" label="Amount" require type="number"
              value={amount} onChange={(v: string) => setAmount(v)} placeholder="0.00" className="h-10"
            />
            <div className="sm:col-span-3">
              <CustomInputField
                field="txn_remarks" label="Note (optional)" type="text"
                value={remarks} onChange={(v: string) => setRemarks(v)} placeholder="e.g. Prepayment from sale proceeds" className="h-10"
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <Callout tone="info" icon={Info}>
            The movement counts from its date — interest for that day is already on the new balance. The outstanding principal must stay between zero and the {isCC ? 'drawing limit' : 'sanctioned amount'}.
            Interest already billed can't be changed, so a date before {detail ? formatDate(detail.locked_through) : 'the last voucher'} is refused.
          </Callout>
          <div className="flex justify-end">
            <Button onClick={add} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Plus className="h-4 w-4" /> Add movement</>}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
};
