import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Wallet, Send } from 'lucide-react';
import type { PayableBill, PaymentFormState, PaymentMode } from './types';
import { PAYMENT_MODES, PAYING_ACCOUNTS } from './types';
import { today, formatINR, formatDate, requiresReference } from './helpers';

interface PaymentFormProps {
  bill: PayableBill;
  onSubmit: (form: PaymentFormState) => void;
  saving: boolean;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ bill, onSubmit, saving }) => {
  const [form, setForm] = useState<PaymentFormState>({
    bill_sno: String(bill.bill_sno),
    payment_date: today(),
    amount: String(bill.outstanding),
    mode: 'NEFT',
    bank_account: PAYING_ACCOUNTS[0],
    reference_no: '',
    remarks: '',
  });

  useEffect(() => {
    setForm({
      bill_sno: String(bill.bill_sno),
      payment_date: today(),
      amount: String(bill.outstanding),
      mode: 'NEFT',
      bank_account: PAYING_ACCOUNTS[0],
      reference_no: '',
      remarks: '',
    });
  }, [bill.bill_sno]);

  const setField = (field: keyof PaymentFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const amount = Number(form.amount) || 0;
  const overPaying = amount > bill.outstanding;
  const refMissing = requiresReference(form.mode) && !form.reference_no.trim();
  const cashMode = form.mode === 'Cash';

  const canSubmit = amount > 0 && !overPaying && !refMissing && !saving;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          Make Payment — {bill.bill_no}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Bill snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/30 rounded-md p-3">
          <div><p className="text-muted-foreground/70">Vendor</p><p className="font-medium text-foreground">{bill.vendor_name ?? '—'}</p></div>
          <div><p className="text-muted-foreground/70">Invoice</p><p className="font-medium text-foreground">{bill.supplier_invoice_no ?? '—'}</p></div>
          <div><p className="text-muted-foreground/70">Net Payable</p><p className="font-medium text-foreground">{formatINR(bill.net_payable)}</p></div>
          <div><p className="text-muted-foreground/70">Outstanding</p><p className="font-semibold text-red-600">{formatINR(bill.outstanding)}</p></div>
          <div><p className="text-muted-foreground/70">Already Paid</p><p className="font-medium text-foreground">{formatINR(bill.paid_amount)}</p></div>
          <div><p className="text-muted-foreground/70">Due Date</p><p className="font-medium text-foreground">{formatDate(bill.due_date)}</p></div>
        </div>

        {/* Payment fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Payment Date *</Label>
            <Input type="date" value={form.payment_date} onChange={e => setField('payment_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Amount *</Label>
            <Input
              type="number" min={0} max={bill.outstanding}
              value={form.amount}
              onChange={e => setField('amount', e.target.value)}
              className={`h-8 text-sm ${overPaying ? 'border-red-400 text-red-600' : ''}`}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mode *</Label>
            <Select value={form.mode} onValueChange={v => setField('mode', v as PaymentMode)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Paying Account *</Label>
            <Select value={form.bank_account} onValueChange={v => setField('bank_account', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYING_ACCOUNTS.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">
              {form.mode === 'Cheque' || form.mode === 'DD' ? 'Cheque / DD No' : 'UTR / Transaction Ref'}
              {requiresReference(form.mode) ? ' *' : ''}
            </Label>
            <Input
              value={form.reference_no}
              onChange={e => setField('reference_no', e.target.value)}
              className={`h-8 text-sm ${refMissing ? 'border-red-400' : ''}`}
              placeholder={cashMode ? 'Not required for cash' : 'Reference number'}
              disabled={cashMode}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">Remarks</Label>
            <Input value={form.remarks} onChange={e => setField('remarks', e.target.value)} className="h-8 text-sm" placeholder="Notes..." />
          </div>
        </div>

        {overPaying && (
          <p className="text-xs text-red-600">Amount cannot exceed the outstanding balance of {formatINR(bill.outstanding)}.</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            Balance after this payment:{' '}
            <span className="font-semibold text-foreground">{formatINR(Math.max(0, bill.outstanding - amount))}</span>
          </div>
          <Button size="sm" className="text-xs" disabled={!canSubmit} onClick={() => onSubmit(form)}>
            <Send size={13} className="mr-1" />
            {saving ? 'Processing…' : 'Record Payment'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentForm;
