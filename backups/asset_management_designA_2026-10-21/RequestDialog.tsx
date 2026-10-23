import React, { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { AssetRow, AssetSupplier, CreateAssetRequestPayload } from '@/Services/GrnService/assetApi';

interface Props {
  open: boolean;
  type: 'RETURN' | 'SERVICE';
  row: AssetRow | null;
  suppliers: AssetSupplier[];
  isStoreIncharge: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAssetRequestPayload) => void;
}

const RequestDialog: React.FC<Props> = ({ open, type, row, suppliers, isStoreIncharge, saving, onClose, onSubmit }) => {
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [supplier, setSupplier] = useState('');
  const [mode, setMode] = useState<'OUTPASS' | 'INSTORE'>('OUTPASS');
  const [pay, setPay] = useState<'Y' | 'N'>('N');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [expected, setExpected] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    setQty('1'); setReason(''); setMode('OUTPASS'); setPay('N'); setAmount(''); setVendor(''); setExpected(''); setError('');
    setSupplier(row.default_supplier_sno ? String(row.default_supplier_sno) : '');
  }, [open, row]);

  if (!row) return null;
  const isReturn = type === 'RETURN';

  const submit = () => {
    const q = Number(qty);
    if (!q || q <= 0) return setError('Enter a quantity greater than 0.');
    if (q > row.in_use_qty) return setError(`Only ${row.in_use_qty} ${row.uom} in use.`);
    if (!reason.trim()) return setError('Enter a reason.');
    if (isReturn && !supplier) return setError('Choose the supplier the item is returned to.');
    if (!isReturn) {
      if (pay === 'Y' && !(Number(amount) > 0)) return setError('Enter the estimated amount.');
      if (mode === 'OUTPASS' && !vendor.trim()) return setError('Enter the repair vendor the item is going to.');
    }
    setError('');
    onSubmit({
      request_type: type,
      sr_item_sno: row.sr_item_sno,
      qty: q,
      reason: reason.trim(),
      supplier_sno: supplier ? Number(supplier) : null,
      ...(isReturn ? {} : {
        service_mode: mode,
        payment_applicable: pay,
        est_amount: pay === 'Y' ? Number(amount) : null,
        service_vendor: vendor.trim() || undefined,
        expected_return_date: expected || undefined,
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>{isReturn ? 'Return request' : 'Service / Job order request'}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {row.item_name} · {row.dept_name ?? 'Unassigned'} · issued {row.issue_ref} · {row.in_use_qty} {row.uom} in use
          </p>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isStoreIncharge
                ? 'Raised as Store In-charge — it goes to Department approval first, then '
                : 'It goes straight to '}
              {isReturn ? 'the Purchase Department approval flow.' : 'the service approval.'}
              {' '}This quantity leaves the Assets list as soon as it is raised.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantity ({row.uom})</Label>
              <Input type="number" min={0} max={row.in_use_qty} value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            {isReturn && (
              <div className="space-y-1.5">
                <Label>Return to supplier</Label>
                <Select value={supplier} onValueChange={setSupplier}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.supplier_sno} value={String(s.supplier_sno)}>{s.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{isReturn ? 'Reason for return' : 'Problem / job to be done'}</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {!isReturn && (
            <>
              <div className="space-y-1.5">
                <Label>Where will the service happen?</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ['OUTPASS', 'Outpass — outside the premises', 'A Delivery Challan is created'],
                    ['INSTORE', 'In-store — inside our campus', 'No gate pass needed'],
                  ] as const).map(([v, t, d]) => (
                    <button
                      key={v} type="button" onClick={() => setMode(v)}
                      className={`rounded-md border p-3 text-left text-sm ${mode === v ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/40'}`}
                    >
                      <div className="font-medium">{t}</div>
                      <div className="text-xs text-muted-foreground">{d}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Payment applicable?</Label>
                  <Select value={pay} onValueChange={v => setPay(v as 'Y' | 'N')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Y">Yes — payment + repair approval</SelectItem>
                      <SelectItem value="N">No — service / repair approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {pay === 'Y' && (
                  <div className="space-y-1.5">
                    <Label>Estimated amount (₹)</Label>
                    <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{mode === 'OUTPASS' ? 'Repair vendor' : 'Technician / vendor on site (optional)'}</Label>
                  <Input value={vendor} onChange={e => setVendor(e.target.value)} />
                </div>
                {mode === 'OUTPASS' && (
                  <div className="space-y-1.5">
                    <Label>Expected return date</Label>
                    <Input type="date" value={expected} onChange={e => setExpected(e.target.value)} />
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestDialog;
