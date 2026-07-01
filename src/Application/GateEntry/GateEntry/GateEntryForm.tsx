import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DoorOpen, Send, RotateCcw, Truck, FileText, Scale } from 'lucide-react';
import type { GatePORef, GateEntryFormState } from './types';
import { today, nowTime, netWeight } from './helpers';

interface GateEntryFormProps {
  poList: GatePORef[];
  onSubmit: (form: GateEntryFormState) => Promise<void> | void;
  onReset?: () => void;
  submitting: boolean;
}

const blankForm = (): GateEntryFormState => ({
  entry_date: today(),
  entry_time: nowTime(),
  po_basic_sno: '',
  invoice_no: '',
  invoice_date: today(),
  challan_no: '',
  lr_no: '',
  vehicle_no: '',
  driver_name: '',
  driver_mobile: '',
  transporter_name: '',
  gross_weight: '',
  tare_weight: '',
  no_of_packages: '',
  material_desc: '',
  remarks: '',
});

const GateEntryForm: React.FC<GateEntryFormProps> = ({ poList, onSubmit, onReset, submitting }) => {
  const [form, setForm] = useState<GateEntryFormState>(blankForm);

  useEffect(() => { setForm(blankForm()); }, []);

  const setField = (field: keyof GateEntryFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const net = netWeight(form.gross_weight, form.tare_weight);

  const canSubmit =
    !!form.entry_date && !!form.vehicle_no.trim() && !submitting;

  const handleReset = () => {
    setForm(blankForm());
    onReset?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DoorOpen size={16} className="text-primary" />
          New Gate Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Document / PO basics */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileText size={13} /> Document Details
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date *</Label>
              <Input type="date" value={form.entry_date} onChange={e => setField('entry_date', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input type="time" value={form.entry_time} onChange={e => setField('entry_time', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">Purchase Order</Label>
              <Select value={form.po_basic_sno} onValueChange={v => setField('po_basic_sno', v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select PO (optional)" /></SelectTrigger>
                <SelectContent>
                  {poList.map(po => (
                    <SelectItem key={po.po_basic_sno} value={String(po.po_basic_sno)} className="text-xs">
                      {po.po_no} — {po.vendor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Invoice No</Label>
              <Input placeholder="INV-2026-001" value={form.invoice_no} onChange={e => setField('invoice_no', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Invoice Date</Label>
              <Input type="date" value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Challan / DC No</Label>
              <Input placeholder="DC-001" value={form.challan_no} onChange={e => setField('challan_no', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">LR / Consignment No</Label>
              <Input placeholder="LR-001" value={form.lr_no} onChange={e => setField('lr_no', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>

        {/* Vehicle / transport */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Truck size={13} /> Vehicle &amp; Transport
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vehicle No *</Label>
              <Input placeholder="TN-01-AB-1234" value={form.vehicle_no} onChange={e => setField('vehicle_no', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver Name</Label>
              <Input placeholder="Driver name" value={form.driver_name} onChange={e => setField('driver_name', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver Mobile</Label>
              <Input placeholder="9876543210" value={form.driver_mobile} onChange={e => setField('driver_mobile', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transporter</Label>
              <Input placeholder="Transporter name" value={form.transporter_name} onChange={e => setField('transporter_name', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>

        {/* Weighment */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Scale size={13} /> Weighment
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gross Wt (kg)</Label>
              <Input type="number" min={0} value={form.gross_weight} onChange={e => setField('gross_weight', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tare Wt (kg)</Label>
              <Input type="number" min={0} value={form.tare_weight} onChange={e => setField('tare_weight', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Net Wt (kg)</Label>
              <Input readOnly value={net || ''} className="h-8 text-sm bg-muted/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">No. of Packages</Label>
              <Input type="number" min={0} value={form.no_of_packages} onChange={e => setField('no_of_packages', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>

        {/* Material / remarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Material Description</Label>
            <Input placeholder="Brief description of goods" value={form.material_desc} onChange={e => setField('material_desc', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Security Remarks</Label>
            <Input placeholder="Seal condition, observations..." value={form.remarks} onChange={e => setField('remarks', e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
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
