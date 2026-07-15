import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DoorOpen, Send, RotateCcw, Paperclip, X } from 'lucide-react';
import type { PORecord, TransportOption, GateEntryFormState } from './types';
import { getPODisplayNo } from '@/Application/GRN/GRN/helpers';
import { today } from './helpers';

interface GateEntryFormProps {
  po: PORecord;
  transportList: TransportOption[];
  receiverEcno: string;
  onSubmit: (form: GateEntryFormState) => Promise<void> | void;
  onCancel?: () => void;
  submitting: boolean;
}

const blankForm = (receiverEcno: string): GateEntryFormState => ({
  invoice_no: '',
  invoice_date: today(),
  received_qty: '',
  received_date: today(),
  bundles: '',
  transport_name: '',
  lr_no: '',
  receiver_ecno: receiverEcno,
  photo: null,
});

const GateEntryForm: React.FC<GateEntryFormProps> = ({
  po, transportList, receiverEcno, onSubmit, onCancel, submitting,
}) => {
  const [form, setForm] = useState<GateEntryFormState>(() => blankForm(receiverEcno));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const setField = <K extends keyof GateEntryFormState>(field: K, value: GateEntryFormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handlePhoto = (file: File | null) => {
    setField('photo', file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const canSubmit =
    !!form.invoice_no.trim() &&
    !!form.invoice_date &&
    !!form.received_qty &&
    Number(form.received_qty) > 0 &&
    !!form.received_date &&
    !submitting;

  const handleReset = () => {
    setForm(blankForm(receiverEcno));
    handlePhoto(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DoorOpen size={16} className="text-primary" />
          Gate Entry — {getPODisplayNo(po)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice No *</Label>
            <Input placeholder="INV-2026-001" value={form.invoice_no} onChange={e => setField('invoice_no', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice Date *</Label>
            <Input type="date" value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Received Qty *</Label>
            <Input type="number" min={0} value={form.received_qty} onChange={e => setField('received_qty', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Received Date *</Label>
            <Input type="date" value={form.received_date} onChange={e => setField('received_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bundles</Label>
            <Input type="number" min={0} placeholder="No. of bundles" value={form.bundles} onChange={e => setField('bundles', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Transport</Label>
            <Select value={form.transport_name} onValueChange={v => setField('transport_name', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select transport" /></SelectTrigger>
              <SelectContent>
                {transportList.map(t => (
                  <SelectItem key={t.transport_sno} value={t.transport_name} className="text-xs">
                    {t.transport_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">LR No</Label>
            <Input placeholder="LR-001" value={form.lr_no} onChange={e => setField('lr_no', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Receiver Ecno</Label>
            <Input readOnly value={form.receiver_ecno} className="h-8 text-sm bg-muted/50" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Photo of Product</Label>
          {photoPreview ? (
            <div className="flex items-center gap-3">
              <img src={photoPreview} alt="Product" className="h-16 w-16 object-cover rounded border" />
              <div className="flex-1 text-xs text-foreground truncate">{form.photo?.name}</div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePhoto(null)}>
                <X size={12} className="mr-1" /> Remove
              </Button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-primary">
              <span className="inline-flex items-center gap-1.5 border border-primary/40 rounded px-2.5 py-1.5 bg-card hover:bg-primary/10">
                <Paperclip size={13} /> Choose photo…
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handlePhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {onCancel && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-xs" onClick={handleReset}>
            <RotateCcw size={13} className="mr-1" /> Reset
          </Button>
          <Button size="sm" className="text-xs" disabled={!canSubmit} onClick={() => onSubmit(form)}>
            <Send size={13} className="mr-1" />
            {submitting ? 'Saving…' : 'Save Gate Entry'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GateEntryForm;
