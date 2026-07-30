import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  supplierAxios,
  supplierCreateDispatch,
  supplierGetTransporters,
  type DeliveryFormValues,
  type DispatchCreateResult,
  type DispatchMode,
  type TransporterOption,
} from '@/Services/SupplierService';

interface Props {
  po_basic_sno: number;
  onBack: () => void;
  onCreated: (result: DispatchCreateResult) => void;
}

/** Sentinel value for the "Direct / Self Delivery" option in the transporter select. */
const DIRECT_VALUE = 'direct';

let rowIdSeq = 0;
const nextRowId = () => `row-${++rowIdSeq}`;

const emptyDelivery = (): DeliveryFormValues => ({
  lr_no: '',
  invoice_no: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  qty: undefined,
  pieces: undefined,
  bundles: undefined,
  invoice_file: null,
});

const SupplierDispatchForm: React.FC<Props> = ({ po_basic_sno, onBack, onCreated }) => {
  const [transporters, setTransporters] = useState<TransporterOption[]>([]);
  const [transportChoice, setTransportChoice] = useState<string>('');
  const [rows, setRows] = useState<Array<{ id: string; values: DeliveryFormValues }>>([
    { id: nextRowId(), values: emptyDelivery() },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const isDirect = transportChoice === DIRECT_VALUE;
  const mode: DispatchMode = isDirect ? 'Direct' : 'Transport';

  useEffect(() => {
    (async () => {
      try {
        const res = await supplierAxios.get(supplierGetTransporters);
        setTransporters(res.data?.data ?? []);
      } catch {
        toast.error('Could not load the transporter list');
      }
    })();
  }, []);

  const updateRow = <K extends keyof DeliveryFormValues>(id: string, key: K, value: DeliveryFormValues[K]) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r)));

  const addRow = () => setRows((prev) => [...prev, { id: nextRowId(), values: emptyDelivery() }]);

  const removeRow = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deliveries = rows.map((r) => r.values);

    if (!transportChoice) {
      toast.error('Select a transporter, or choose Direct / Self Delivery.');
      return;
    }
    if (deliveries.some((d) => !d.invoice_no || !d.invoice_date)) {
      toast.error('Every delivery needs an Invoice No. and Invoice Date.');
      return;
    }
    if (!isDirect) {
      if (deliveries.some((d) => !d.lr_no.trim())) {
        toast.error('LR No. is required for every delivery when sending via a transporter.');
        return;
      }
      if (deliveries.some((d) => !d.invoice_file)) {
        toast.error('Upload the invoice copy for every delivery.');
        return;
      }
    } else if (deliveries.some((d) => d.qty == null || d.pieces == null || d.bundles == null)) {
      toast.error('Qty, Pieces and Bundles are required for every delivery on a Direct dispatch.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('dispatch_mode', mode);
      if (!isDirect) fd.append('transport_sno', transportChoice);
      fd.append(
        'deliveries',
        JSON.stringify(
          deliveries.map(({ invoice_file: _file, ...d }) => ({
            ...d,
            lr_no: d.lr_no.trim() || undefined,
          }))
        )
      );
      deliveries.forEach((d, idx) => {
        if (d.invoice_file) fd.append(`invoice_file_${idx}`, d.invoice_file);
      });

      const res = await supplierAxios.post(supplierCreateDispatch(po_basic_sno), fd);
      const result: DispatchCreateResult = res.data?.data;
      toast.success(`Dispatch slip ${result.dispatch_slip_no} created`);
      onCreated(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not create dispatch slip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Dispatch details</CardTitle>
          <CardDescription>
            Enter one row per shipment/LR. A printable slip is generated for each delivery once submitted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label>Transport *</Label>
              <Select value={transportChoice} onValueChange={setTransportChoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transporter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DIRECT_VALUE}>Direct / Self Delivery</SelectItem>
                  {transporters.map((t) => (
                    <SelectItem key={t.transport_sno} value={String(t.transport_sno)}>
                      {t.transport_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isDirect
                  ? 'Direct delivery: LR No. is optional, but Qty, Pieces and Bundles are compulsory.'
                  : 'Via transporter: LR No. and an invoice copy are compulsory for each delivery.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {rows.map((row, idx) => (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Delivery {idx + 1}
                    </span>
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`lr-no-${row.id}`}>LR No.{!isDirect && ' *'}</Label>
                      <Input
                        id={`lr-no-${row.id}`}
                        required={!isDirect}
                        placeholder={isDirect ? 'Optional' : ''}
                        value={row.values.lr_no}
                        onChange={(e) => updateRow(row.id, 'lr_no', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`invoice-no-${row.id}`}>Invoice No. *</Label>
                      <Input
                        id={`invoice-no-${row.id}`}
                        required
                        value={row.values.invoice_no}
                        onChange={(e) => updateRow(row.id, 'invoice_no', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`invoice-date-${row.id}`}>Invoice Date *</Label>
                      <Input
                        id={`invoice-date-${row.id}`}
                        type="date"
                        required
                        value={row.values.invoice_date}
                        onChange={(e) => updateRow(row.id, 'invoice_date', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`qty-${row.id}`}>How Many (Qty){isDirect && ' *'}</Label>
                      <Input
                        id={`qty-${row.id}`}
                        type="number"
                        min={0}
                        required={isDirect}
                        value={row.values.qty ?? ''}
                        onChange={(e) => updateRow(row.id, 'qty', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`pieces-${row.id}`}>No. of Pieces{isDirect && ' *'}</Label>
                      <Input
                        id={`pieces-${row.id}`}
                        type="number"
                        min={0}
                        required={isDirect}
                        value={row.values.pieces ?? ''}
                        onChange={(e) => updateRow(row.id, 'pieces', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`bundles-${row.id}`}>No. of Bundles{isDirect && ' *'}</Label>
                      <Input
                        id={`bundles-${row.id}`}
                        type="number"
                        min={0}
                        required={isDirect}
                        value={row.values.bundles ?? ''}
                        onChange={(e) => updateRow(row.id, 'bundles', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-3">
                      <Label>Invoice Copy{!isDirect && ' *'}</Label>
                      {row.values.invoice_file ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{row.values.invoice_file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => updateRow(row.id, 'invoice_file', null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          className="sm:max-w-xs"
                          onChange={(e) => updateRow(row.id, 'invoice_file', e.target.files?.[0] ?? null)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addRow}>
              <Plus className="h-4 w-4" /> Add another delivery
            </Button>

            <Button type="submit" disabled={submitting} className="mt-2 w-fit">
              {submitting ? 'Creating…' : 'Create dispatch slip'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierDispatchForm;
