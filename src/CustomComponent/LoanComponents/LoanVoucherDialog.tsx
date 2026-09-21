import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Banknote, Loader2, Printer, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { Callout, Fact, FactGrid, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { DAY_COUNT_LABEL, facilityLabel, formatDate, formatINR, ordinalDay, statusMeta } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { NextInterestPanel, SegmentsTable, VoucherFigures } from '@/CustomComponent/LoanComponents/InterestBreakdown';
import {
  PAYMENT_MODES, VOUCHER_EVENT, VOUCHER_STATUS, addDaysIso, printVoucher, todayIso, type BankPaymentVoucher,
} from '@/CustomComponent/LoanComponents/loanUtils';
import { getBankPaymentVoucher, markBankPaymentVoucherPaid } from '@/Services/Api';

const dateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

interface Props {
  voucherSno: number;
  /** May the user record the bank payment (edit rights on the Loan Payments screen). */
  canRecordPayment: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export const LoanVoucherDialog: React.FC<Props> = ({ voucherSno, canRecordPayment, onClose, onChanged }) => {
  const [voucher, setVoucher] = useState<BankPaymentVoucher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pay, setPay] = useState({ mode: 'NEFT', paid_on: todayIso(), ref: '', bank: '', remarks: '' });
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(getBankPaymentVoucher, { params: { voucher_sno: voucherSno } });
      setVoucher(res.data?.data ?? null);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not load the voucher');
    }
  }, [voucherSno]);

  useEffect(() => { load(); }, [load]);

  const recordPayment = async () => {
    if (!pay.paid_on) { setPayError('Enter the payment date'); return; }
    if (pay.mode !== 'Cash' && !pay.ref.trim()) { setPayError('Enter the bank reference / UTR / cheque number'); return; }
    setSaving(true); setPayError(null);
    try {
      await axios.post(markBankPaymentVoucherPaid, {
        voucher_sno: voucherSno, paid_on: pay.paid_on, payment_mode: pay.mode,
        payment_ref_no: pay.ref.trim() || undefined, paid_from_bank: pay.bank.trim() || undefined, remarks: pay.remarks.trim() || undefined,
      });
      toast.success('Payment recorded');
      setPaying(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      setPayError(e?.response?.data?.error ?? 'Failed to record the payment');
    } finally {
      setSaving(false);
    }
  };

  const status = voucher ? statusMeta(VOUCHER_STATUS, voucher.status) : null;
  const bene = voucher?.beneficiary;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {voucher?.voucher_no ?? 'Bank payment voucher'}
            {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
          </DialogTitle>
          <DialogDescription>
            {voucher ? `${voucher.agreement_no} · ${voucher.vendor_name ?? 'Lender'} · ${facilityLabel(voucher.facility_type)}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          {error && <Callout tone="danger">{error}</Callout>}
          {!voucher && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>}

          {voucher && (
            <>
              <Panel title="Payment" icon={Banknote}>
                <FactGrid>
                  <Fact label="Pay to">{voucher.vendor_name ?? '—'}</Fact>
                  <Fact label="Payment date">{formatDate(voucher.period_to)}</Fact>
                  <Fact label="Total payable"><span className="text-primary">{formatINR(voucher.total_payable)}</span></Fact>
                  {bene && <Fact label="Beneficiary a/c">{bene.ac_holder_name} · {bene.ac_number}</Fact>}
                  {bene && <Fact label="Bank / IFSC">{[bene.bank_name, bene.bank_branch_name].filter(Boolean).join(', ')} · {bene.ifsc}</Fact>}
                  {!bene && <Fact label="Beneficiary a/c"><span className="font-normal text-muted-foreground">No bank account on the lender's KYC</span></Fact>}
                  <Fact label="Loan">{voucher.facility_ref_no ? `${voucher.facility_ref_no} · ` : ''}{voucher.agreement_no}</Fact>
                  <Fact label="Interest period">{formatDate(voucher.period_from)} – {formatDate(addDaysIso(voucher.period_to, -1))}</Fact>
                  <Fact label="Raised by">{voucher.created_by} · {dateTime(voucher.created_at)}</Fact>
                </FactGrid>
              </Panel>

              <Panel title="Interest calculation" description={`${voucher.days} days · ${DAY_COUNT_LABEL[String(voucher.day_count_basis)] ?? ''} · ${voucher.interest_payment_day ? `paid on the ${ordinalDay(voucher.interest_payment_day)}` : ''}`} bodyClassName="space-y-4">
                <SegmentsTable segments={voucher.segments} benchmarkName={voucher.benchmark_name} basis={voucher.day_count_basis} />
                <VoucherFigures
                  principalOnPayment={voucher.principal_on_payment} interest={voucher.interest_amount} days={voucher.days}
                  repayment={voucher.principal_repayment} total={voucher.total_payable} principalAfter={voucher.principal_after}
                />
              </Panel>

              <NextInterestPanel
                nextDue={voucher.next_due_date} nextDays={voucher.next_days} nextInterest={voucher.next_est_interest}
                segments={voucher.next_segments} benchmarkName={voucher.benchmark_name} basis={voucher.day_count_basis}
                principalAfter={voucher.principal_after} floating={voucher.rate_type === 'FLOATING'}
                finalPayment={!voucher.next_due_date}
              />

              {voucher.remarks && <Callout tone="neutral"><b>Narration:</b> {voucher.remarks}</Callout>}

              {voucher.status === 'PAID' && (
                <Panel title="Bank payment" icon={Banknote}>
                  <FactGrid>
                    <Fact label="Paid on">{formatDate(voucher.paid_on)}</Fact>
                    <Fact label="Mode">{voucher.payment_mode ?? '—'}</Fact>
                    <Fact label="Reference / UTR">{voucher.payment_ref_no ?? '—'}</Fact>
                    {voucher.paid_from_bank && <Fact label="Paid from">{voucher.paid_from_bank}</Fact>}
                    <Fact label="Recorded by">{voucher.paid_by ?? '—'}</Fact>
                  </FactGrid>
                </Panel>
              )}

              {paying && (
                <Panel title="Record the bank payment" icon={Banknote} bodyClassName="space-y-4">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <CustomInputField
                      field="pay_mode" label="Mode" require type="select"
                      options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))}
                      value={pay.mode} onChange={(v: string) => setPay((p) => ({ ...p, mode: v }))} className="h-10"
                    />
                    <CustomInputField
                      field="pay_date" label="Paid on" require type="date"
                      value={pay.paid_on} onChange={(v: string) => setPay((p) => ({ ...p, paid_on: v }))} className="h-10"
                    />
                    <CustomInputField
                      field="pay_ref" label="Bank reference / UTR / cheque no." require={pay.mode !== 'Cash'} type="text"
                      value={pay.ref} onChange={(v: string) => setPay((p) => ({ ...p, ref: v }))} className="h-10"
                    />
                    <CustomInputField
                      field="pay_bank" label="Paid from (our bank a/c)" type="text" placeholder="e.g. HDFC current a/c 0012"
                      value={pay.bank} onChange={(v: string) => setPay((p) => ({ ...p, bank: v }))} className="h-10"
                    />
                    <div className="sm:col-span-2">
                      <CustomInputField
                        field="pay_remarks" label="Remarks" type="text"
                        value={pay.remarks} onChange={(v: string) => setPay((p) => ({ ...p, remarks: v }))} className="h-10"
                      />
                    </div>
                  </div>
                  {payError && <p className="text-xs font-medium text-destructive">{payError}</p>}
                </Panel>
              )}

              {voucher.history && voucher.history.length > 0 && (
                <Panel title="History">
                  <ol className="space-y-2 text-sm">
                    {voucher.history.map((h, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{VOUCHER_EVENT[h.action_type] ?? h.action_type}</span>
                        <span className="text-muted-foreground">by {h.status_by} · {dateTime(h.created_at)}</span>
                        {h.comment && <span className="w-full text-xs text-muted-foreground">“{h.comment}”</span>}
                      </li>
                    ))}
                  </ol>
                </Panel>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t bg-card px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {voucher && (
            <Button variant="outline" onClick={() => printVoucher(voucher)}><Printer size={15} /> Print voucher</Button>
          )}
          {voucher?.status === 'APPROVED' && canRecordPayment && !paying && (
            <Button onClick={() => setPaying(true)}><Banknote size={15} /> Record payment</Button>
          )}
          {paying && (
            <>
              <Button variant="ghost" onClick={() => { setPaying(false); setPayError(null); }} disabled={saving}>Cancel</Button>
              <Button onClick={recordPayment} disabled={saving}>
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Banknote size={15} /> Mark as paid</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
