import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PackageCheck, Send, RotateCcw, Info } from 'lucide-react';
import type { PORecord, GRNFormState, GRNItemEntry } from './types';
import { today, formatINR, getPODisplayNo, buildGRNItems } from './helpers';

interface GRNEntryFormProps {
  po: PORecord;
  onSubmit: (form: GRNFormState, items: GRNItemEntry[]) => Promise<void>;
  submitting: boolean;
}

const CONDITIONS = ['Good', 'Damaged', 'Partial'] as const;

const GRNEntryForm: React.FC<GRNEntryFormProps> = ({ po, onSubmit, submitting }) => {
  const [form, setForm] = useState<GRNFormState>({
    received_date: today(),
    doc_ref_no: '',
    vehicle_no: '',
    challan_no: '',
    remarks: '',
  });

  const [items, setItems] = useState<GRNItemEntry[]>([]);

  // Reset form when PO changes
  useEffect(() => {
    setForm({ received_date: today(), doc_ref_no: '', vehicle_no: '', challan_no: '', remarks: '' });
    setItems(buildGRNItems(po));
  }, [po.po_basic_sno]);

  const setFormField = (field: keyof GRNFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const updateItem = (idx: number, patch: Partial<GRNItemEntry>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const toggleAll = (checked: boolean) =>
    setItems(prev => prev.map(it => ({ ...it, selected: it.pending_qty > 0 ? checked : false })));

  const selectedItems = items.filter(it => it.selected);
  const allSelected = items.length > 0 && items.every(it => it.pending_qty === 0 || it.selected);
  const allReceived = items.every(it => it.pending_qty === 0);

  const handleSubmit = () => {
    onSubmit(form, selectedItems);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PackageCheck size={16} className="text-green-600" />
          New GRN — {getPODisplayNo(po)}
          {allReceived && (
            <Badge className="text-xs bg-green-100 text-green-700 border-green-200 ml-1">
              Fully Received
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Received Date *</Label>
            <Input
              type="date"
              value={form.received_date}
              onChange={e => setFormField('received_date', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Doc / Invoice Ref</Label>
            <Input
              placeholder="INV-2024-001"
              value={form.doc_ref_no}
              onChange={e => setFormField('doc_ref_no', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Challan No</Label>
            <Input
              placeholder="DC-001"
              value={form.challan_no}
              onChange={e => setFormField('challan_no', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Vehicle No</Label>
            <Input
              placeholder="TN-01-AB-1234"
              value={form.vehicle_no}
              onChange={e => setFormField('vehicle_no', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Remarks</Label>
          <Input
            placeholder="Any notes about this delivery..."
            value={form.remarks}
            onChange={e => setFormField('remarks', e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Items table */}
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
            <Info size={14} className="shrink-0" />
            No items found for this PO. Items data may not be loaded yet.
          </div>
        ) : (
          <>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </TableHead>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-center">Ordered</TableHead>
                    <TableHead className="text-xs text-center">Pending</TableHead>
                    <TableHead className="text-xs text-center w-24">Received *</TableHead>
                    <TableHead className="text-xs text-center w-24">Rejected</TableHead>
                    <TableHead className="text-xs w-28">Condition</TableHead>
                    <TableHead className="text-xs">Item Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow
                      key={idx}
                      className={!item.selected ? 'opacity-50 bg-gray-50/50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          disabled={item.pending_qty === 0}
                          onCheckedChange={(v) => updateItem(idx, { selected: Boolean(v) })}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.prod_name || '—'}</p>
                          {item.specification && (
                            <p className="text-xs text-gray-400 truncate max-w-[160px]">{item.specification}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center text-gray-600">
                        {item.ordered_qty} <span className="text-gray-400">{item.unit_name}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-medium ${item.pending_qty === 0 ? 'text-green-600' : 'text-indigo-700'}`}>
                          {item.pending_qty === 0 ? '✓ Done' : `${item.pending_qty} ${item.unit_name}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={item.pending_qty}
                          value={item.received_qty}
                          disabled={!item.selected}
                          onChange={e => updateItem(idx, { received_qty: Number(e.target.value) })}
                          className="h-7 w-20 text-sm text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={item.received_qty}
                          value={item.rejected_qty}
                          disabled={!item.selected}
                          onChange={e => updateItem(idx, { rejected_qty: Number(e.target.value) })}
                          className="h-7 w-20 text-sm text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.condition}
                          onValueChange={v => updateItem(idx, { condition: v as GRNItemEntry['condition'] })}
                          disabled={!item.selected}
                        >
                          <SelectTrigger className="h-7 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITIONS.map(c => (
                              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional"
                          value={item.remarks}
                          disabled={!item.selected}
                          onChange={e => updateItem(idx, { remarks: e.target.value })}
                          className="h-7 text-xs w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary + Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-500">
                {selectedItems.length} of {items.length} item(s) selected &nbsp;•&nbsp;
                Total received:{' '}
                <span className="font-semibold text-gray-800">
                  {formatINR(selectedItems.reduce((s, it) => s + it.unit_price * it.received_qty, 0))}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setItems(buildGRNItems(po))}
                >
                  <RotateCcw size={13} className="mr-1" /> Reset
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-xs"
                  disabled={submitting || selectedItems.length === 0 || !form.received_date}
                  onClick={handleSubmit}
                >
                  <Send size={13} className="mr-1" />
                  {submitting ? 'Submitting…' : 'Submit GRN'}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GRNEntryForm;
