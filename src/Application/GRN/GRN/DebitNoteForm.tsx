import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { debitNoteSvcGetDiscrepancyItems } from '@/Services/GrnService/debitNoteApi';
import type { GRNRecord, DebitNoteItemEntry, DebitNoteReasonType } from './types';
import { buildDebitNoteItems, formatINR } from './helpers';

const REASON_OPTIONS: DebitNoteReasonType[] = ['Damage', 'Shortage', 'Return'];

interface DebitNoteFormProps {
  open: boolean;
  grn: GRNRecord | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (grn: GRNRecord, items: DebitNoteItemEntry[], remarks: string) => void;
}

const DebitNoteForm: React.FC<DebitNoteFormProps> = ({ open, grn, submitting, onClose, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DebitNoteItemEntry[]>([]);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open || !grn?.grn_basic_sno) return;
    setLoading(true);
    setRemarks('');
    axios.get(debitNoteSvcGetDiscrepancyItems(grn.grn_basic_sno))
      .then(res => setItems(buildDebitNoteItems(res.data?.data ?? [])))
      .catch((err: any) => {
        toast.error(err?.response?.data?.error ?? 'Failed to load discrepancy items');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [open, grn?.grn_basic_sno]);

  const updateItem = (idx: number, patch: Partial<DebitNoteItemEntry>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const selectedItems = items.filter(it => it.selected);
  const totalAmount = selectedItems.reduce((s, it) => s + it.qty * it.unit_price, 0);

  const handleSubmit = () => {
    if (!grn) return;
    if (selectedItems.length === 0) {
      toast.error('Select at least one item to raise a debit note for');
      return;
    }
    if (selectedItems.some(it => !it.qty || it.qty <= 0)) {
      toast.error('Quantity must be greater than 0 for every selected item');
      return;
    }
    if (selectedItems.some(it => it.qty > it.max_qty)) {
      toast.error('Quantity cannot exceed the remaining discrepancy quantity for an item');
      return;
    }
    onSubmit(grn, selectedItems, remarks);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ReceiptText size={18} className="text-red-600" />
            Raise Debit Note — {grn?.grn_no ?? `GRN #${grn?.grn_basic_sno}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading discrepancy items…</span>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No damaged, rejected or short-received items remain on this GRN to debit.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.grn_item_sno} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={(v) => updateItem(idx, { selected: !!v })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.prod_name}</p>
                      {item.specification && (
                        <p className="text-xs text-muted-foreground">{item.specification}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Max debitable qty: <span className="font-medium">{item.max_qty} {item.unit_name}</span>
                      </p>
                    </div>
                  </div>

                  {item.selected && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">Reason</Label>
                        <Select
                          value={item.reason_type}
                          onValueChange={(v) => updateItem(idx, { reason_type: v as DebitNoteReasonType })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REASON_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={0}
                          max={item.max_qty}
                          step="0.01"
                          className="h-8 text-xs"
                          value={item.qty}
                          onChange={(e) => updateItem(idx, { qty: e.target.value === '' ? 0 : Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8 text-xs"
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, { unit_price: e.target.value === '' ? 0 : Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <p className="h-8 flex items-center text-xs font-medium">{formatINR(item.qty * item.unit_price)}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-4 space-y-1">
                        <Label className="text-xs">Remarks</Label>
                        <Input
                          className="h-8 text-xs"
                          value={item.remarks}
                          onChange={(e) => updateItem(idx, { remarks: e.target.value })}
                          placeholder="Optional note for this line"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Debit Note Remarks</Label>
              <Textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Overall reason / note for this debit note"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">Total Debit Amount</span>
              <span className="text-sm font-semibold">{formatINR(totalAmount)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || loading || items.length === 0}>
            {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Raise Debit Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebitNoteForm;
