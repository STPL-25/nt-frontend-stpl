import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileText, Send, X } from 'lucide-react';
import type { InvoiceCaptureFormState, InvoiceType, SourceType } from './types';
import { today } from './helpers';

interface Vendor {
  kyc_basic_info_sno: number;
  company_name: string;
}

interface InvoiceCaptureFormProps {
  vendors: Vendor[];
  saving: boolean;
  onSubmit: (form: InvoiceCaptureFormState, file: File | null) => void;
  onCancel: () => void;
}

const INVOICE_TYPES: InvoiceType[] = ['MATERIAL', 'SERVICE', 'COMPOSITE'];

const InvoiceCaptureForm: React.FC<InvoiceCaptureFormProps> = ({ vendors, saving, onSubmit, onCancel }) => {
  const [form, setForm] = useState<InvoiceCaptureFormState>({
    vendor_invoice_no: '',
    vendor_sno: '',
    po_basic_sno: '',
    invoice_date: today(),
    due_date: '',
    invoice_amount: '',
    invoice_type: 'MATERIAL',
    source_type: 'STANDARD',
    remarks: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const setField = (field: keyof InvoiceCaptureFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isRetrospective = form.source_type === 'RETROSPECTIVE';
  const amount = Number(form.invoice_amount) || 0;
  const canSubmit =
    !!form.vendor_sno &&
    amount > 0 &&
    (isRetrospective || !!form.po_basic_sno) &&
    !saving;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          Capture Vendor Invoice
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
          <X size={14} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vendor *</Label>
            <Select value={form.vendor_sno} onValueChange={v => setField('vendor_sno', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select vendor…" /></SelectTrigger>
              <SelectContent>
                {vendors.map(v => (
                  <SelectItem key={v.kyc_basic_info_sno} value={String(v.kyc_basic_info_sno)} className="text-xs">
                    {v.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vendor Invoice No</Label>
            <Input value={form.vendor_invoice_no} onChange={e => setField('vendor_invoice_no', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice Date</Label>
            <Input type="date" value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Due Date</Label>
            <Input type="date" value={form.due_date} onChange={e => setField('due_date', e.target.value)} className="h-8 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice Amount *</Label>
            <Input type="number" min={0} value={form.invoice_amount} onChange={e => setField('invoice_amount', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice Type</Label>
            <Select value={form.invoice_type} onValueChange={v => setField('invoice_type', v as InvoiceType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select value={form.source_type} onValueChange={v => setField('source_type', v as SourceType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD" className="text-xs">Standard (against an existing PO)</SelectItem>
                <SelectItem value="RETROSPECTIVE" className="text-xs">Retrospective (vendor-bill-driven, no PO yet)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              PO Basic No{!isRetrospective ? ' *' : ' (link later once verified)'}
            </Label>
            <Input
              type="number"
              value={form.po_basic_sno}
              onChange={e => setField('po_basic_sno', e.target.value)}
              disabled={isRetrospective}
              className="h-8 text-sm"
              placeholder={isRetrospective ? 'Linked after call-off PO' : 'po_basic_sno'}
            />
          </div>

          <div className="space-y-1 col-span-2 md:col-span-4">
            <Label className="text-xs text-muted-foreground">Remarks</Label>
            <Input value={form.remarks} onChange={e => setField('remarks', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1 col-span-2 md:col-span-4">
            <Label className="text-xs text-muted-foreground">Invoice File</Label>
            <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="h-8 text-sm" />
          </div>
        </div>

        {isRetrospective && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Vendor-bill-driven: verify this bill against the delivery register before creating a
            retrospective requisition and call-off PO.
          </p>
        )}

        <div className="flex justify-end">
          <Button size="sm" className="text-xs" disabled={!canSubmit} onClick={() => onSubmit(form, file)}>
            <Send size={13} className="mr-1" />
            {saving ? 'Saving…' : 'Capture Invoice'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceCaptureForm;
