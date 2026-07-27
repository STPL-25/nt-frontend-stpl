import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  supplierAxios,
  supplierCreateDispatch,
  type DeliveryFormValues,
  type DispatchCreateResult,
} from '@/Services/SupplierService';

interface Props {
  po_basic_sno: number;
  onBack: () => void;
  onCreated: (result: DispatchCreateResult) => void;
}

let rowIdSeq = 0;
const nextRowId = () => `row-${++rowIdSeq}`;

const emptyDelivery = (): DeliveryFormValues => ({
  lr_no: '',
  invoice_no: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  qty: undefined,
  pieces: undefined,
  bundles: undefined,
});

const SupplierDispatchForm: React.FC<Props> = ({ po_basic_sno, onBack, onCreated }) => {
  const [transportName, setTransportName] = useState('');
  const [rows, setRows] = useState<Array<{ id: string; values: DeliveryFormValues }>>([
    { id: nextRowId(), values: emptyDelivery() },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const updateRow = <K extends keyof DeliveryFormValues>(id: string, key: K, value: DeliveryFormValues[K]) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r)));

  const addRow = () => setRows((prev) => [...prev, { id: nextRowId(), values: emptyDelivery() }]);

  const removeRow = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deliveries = rows.map((r) => r.values);
    if (deliveries.some((d) => !d.lr_no || !d.invoice_no || !d.invoice_date)) {
      toast.error('Every delivery needs an LR No., Invoice No. and Invoice Date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await supplierAxios.post(supplierCreateDispatch(po_basic_sno), {
        transport_name: transportName || undefined,
        deliveries,
      });
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
              <Label htmlFor="transport-name">Transport</Label>
              <Input id="transport-name" value={transportName} onChange={(e) => setTransportName(e.target.value)} />
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
                      <Label htmlFor={`lr-no-${row.id}`}>LR No.</Label>
                      <Input
                        id={`lr-no-${row.id}`}
                        required
                        value={row.values.lr_no}
                        onChange={(e) => updateRow(row.id, 'lr_no', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`invoice-no-${row.id}`}>Invoice No.</Label>
                      <Input
                        id={`invoice-no-${row.id}`}
                        required
                        value={row.values.invoice_no}
                        onChange={(e) => updateRow(row.id, 'invoice_no', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`invoice-date-${row.id}`}>Invoice Date</Label>
                      <Input
                        id={`invoice-date-${row.id}`}
                        type="date"
                        required
                        value={row.values.invoice_date}
                        onChange={(e) => updateRow(row.id, 'invoice_date', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`qty-${row.id}`}>How Many (Qty)</Label>
                      <Input
                        id={`qty-${row.id}`}
                        type="number"
                        min={0}
                        value={row.values.qty ?? ''}
                        onChange={(e) => updateRow(row.id, 'qty', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`pieces-${row.id}`}>No. of Pieces</Label>
                      <Input
                        id={`pieces-${row.id}`}
                        type="number"
                        min={0}
                        value={row.values.pieces ?? ''}
                        onChange={(e) => updateRow(row.id, 'pieces', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`bundles-${row.id}`}>No. of Bundles</Label>
                      <Input
                        id={`bundles-${row.id}`}
                        type="number"
                        min={0}
                        value={row.values.bundles ?? ''}
                        onChange={(e) => updateRow(row.id, 'bundles', e.target.value ? Number(e.target.value) : undefined)}
                      />
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
