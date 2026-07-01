import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReceiptText, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { BillableGRN, BillFormState, BillStatus } from './types';
import { today, formatINR, computeTotals, matchAgainstGRN } from './helpers';

interface BillFormProps {
  grns: BillableGRN[];
  onSubmit: (form: BillFormState, status: BillStatus) => void;
  saving: boolean;
}

const blankForm = (): BillFormState => ({
  grn_basic_sno: '',
  supplier_invoice_no: '',
  invoice_date: today(),
  basic_amount: '',
  discount: '0',
  gst_rate: '18',
  gst_type: 'intra',
  tds_rate: '0',
  other_charges: '0',
  due_date: '',
  remarks: '',
});

const BillForm: React.FC<BillFormProps> = ({ grns, onSubmit, saving }) => {
  const [form, setForm] = useState<BillFormState>(blankForm);

  useEffect(() => { setForm(blankForm()); }, []);

  const setField = (field: keyof BillFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const selectedGRN = useMemo(
    () => grns.find(g => String(g.grn_basic_sno) === form.grn_basic_sno) ?? null,
    [grns, form.grn_basic_sno],
  );

  // Prefill basic amount + invoice no when a GRN is chosen and fields are empty
  const handleGRNChange = (v: string) => {
    const grn = grns.find(g => String(g.grn_basic_sno) === v) ?? null;
    setForm(prev => ({
      ...prev,
      grn_basic_sno: v,
      basic_amount: prev.basic_amount || (grn ? String(grn.grn_value) : ''),
      supplier_invoice_no: prev.supplier_invoice_no || (grn?.invoice_no ?? ''),
    }));
  };

  const totals = computeTotals(form);
  const match = matchAgainstGRN(Number(form.basic_amount) || 0, selectedGRN);

  const canSubmit =
    !!form.supplier_invoice_no.trim() && Number(form.basic_amount) > 0 && !saving;

  const summaryRow = (label: string, value: number, strong = false) => (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold text-foreground text-sm' : 'text-foreground'}>{formatINR(value)}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ReceiptText size={16} className="text-primary" />
          New Bill / Invoice Booking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* References */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">Against GRN</Label>
            <Select value={form.grn_basic_sno} onValueChange={handleGRNChange}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select GRN (optional)" /></SelectTrigger>
              <SelectContent>
                {grns.map(g => (
                  <SelectItem key={g.grn_basic_sno} value={String(g.grn_basic_sno)} className="text-xs">
                    {g.grn_no} — {g.vendor_name} ({formatINR(g.grn_value)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Supplier Invoice No *</Label>
            <Input value={form.supplier_invoice_no} onChange={e => setField('supplier_invoice_no', e.target.value)} className="h-8 text-sm" placeholder="INV-2026-001" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice Date</Label>
            <Input type="date" value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        {/* 3-way match banner */}
        {selectedGRN && (
          <div className={`flex items-center gap-2 text-xs rounded p-2.5 border ${
            match === 'Matched'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {match === 'Matched' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>
              3-way match: PO {formatINR(selectedGRN.po_value)} • GRN {formatINR(selectedGRN.grn_value)} • Invoice {formatINR(Number(form.basic_amount) || 0)}
              {' — '}
              <span className="font-semibold">{match}</span>
            </span>
          </div>
        )}

        {/* Amounts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Basic Amount *</Label>
            <Input type="number" min={0} value={form.basic_amount} onChange={e => setField('basic_amount', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Discount</Label>
            <Input type="number" min={0} value={form.discount} onChange={e => setField('discount', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">GST Rate (%)</Label>
            <Input type="number" min={0} value={form.gst_rate} onChange={e => setField('gst_rate', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">GST Type</Label>
            <Select value={form.gst_type} onValueChange={v => setField('gst_type', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intra" className="text-xs">Intra-state (CGST + SGST)</SelectItem>
                <SelectItem value="inter" className="text-xs">Inter-state (IGST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">TDS Rate (%)</Label>
            <Input type="number" min={0} value={form.tds_rate} onChange={e => setField('tds_rate', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Other Charges</Label>
            <Input type="number" min={0} value={form.other_charges} onChange={e => setField('other_charges', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Payment Due Date</Label>
            <Input type="date" value={form.due_date} onChange={e => setField('due_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Remarks</Label>
            <Input value={form.remarks} onChange={e => setField('remarks', e.target.value)} className="h-8 text-sm" placeholder="Notes..." />
          </div>
        </div>

        {/* Computed totals */}
        <div className="border rounded-md p-3 bg-muted/30 space-y-1.5 max-w-sm ml-auto">
          {summaryRow('Taxable Amount', totals.taxable)}
          {form.gst_type === 'intra' ? (
            <>
              {summaryRow('CGST', totals.cgst)}
              {summaryRow('SGST', totals.sgst)}
            </>
          ) : (
            summaryRow('IGST', totals.igst)
          )}
          {summaryRow('(-) TDS', -totals.tds)}
          {Number(form.other_charges) > 0 && summaryRow('Other Charges', Number(form.other_charges))}
          <div className="border-t pt-1.5">
            {summaryRow('Net Payable', totals.netPayable, true)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {match === 'Mismatch' && (
            <Badge className="text-xs bg-red-100 text-red-700 border-red-200 mr-auto">
              Amount mismatch with GRN
            </Badge>
          )}
          <Button variant="outline" size="sm" className="text-xs" disabled={!canSubmit} onClick={() => onSubmit(form, 'Draft')}>
            Save Draft
          </Button>
          <Button size="sm" className="text-xs" disabled={!canSubmit} onClick={() => onSubmit(form, 'Pending Approval')}>
            <Send size={13} className="mr-1" />
            {saving ? 'Booking…' : 'Book & Send for Approval'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BillForm;
