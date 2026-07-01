import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileEdit, Send, RotateCcw } from 'lucide-react';
import type { AmendablePO, AmendmentFormState, AmendmentLine } from './types';
import { AMENDMENT_TYPES } from './types';
import { today, formatINR, lineTotal, poTotal, buildAmendmentLines, isLineChanged } from './helpers';

interface AmendmentFormProps {
  po: AmendablePO;
  onSubmit: (form: AmendmentFormState, lines: AmendmentLine[], submit: boolean) => void;
  saving: boolean;
}

const AmendmentForm: React.FC<AmendmentFormProps> = ({ po, onSubmit, saving }) => {
  const [form, setForm] = useState<AmendmentFormState>({
    amend_date: today(),
    amend_type: 'Quantity',
    reason: '',
    new_required_date: po.required_date ?? '',
    new_terms: po.terms_conditions ?? '',
  });
  const [lines, setLines] = useState<AmendmentLine[]>([]);

  useEffect(() => {
    setForm({
      amend_date: today(),
      amend_type: 'Quantity',
      reason: '',
      new_required_date: po.required_date ?? '',
      new_terms: po.terms_conditions ?? '',
    });
    setLines(buildAmendmentLines(po));
  }, [po.po_basic_sno]);

  const setField = (field: keyof AmendmentFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const updateLine = (idx: number, patch: Partial<AmendmentLine>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const oldTotal = poTotal(lines.map(l => ({ new_qty: l.old_qty, new_price: l.old_price })));
  const newTotal = poTotal(lines);
  const diff = newTotal - oldTotal;
  const changedCount = lines.filter(isLineChanged).length;

  // new qty cannot be below already-received qty
  const invalidLine = lines.some(l => Number(l.new_qty) < Number(l.received_qty));

  const canSubmit = !!form.reason.trim() && !invalidLine && !saving;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileEdit size={16} className="text-amber-600" />
          New Amendment — {po.po_no}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Amendment Date *</Label>
            <Input type="date" value={form.amend_date} onChange={e => setField('amend_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={form.amend_type} onValueChange={v => setField('amend_type', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AMENDMENT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Revised Delivery Date</Label>
            <Input type="date" value={form.new_required_date} onChange={e => setField('new_required_date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Revised Terms</Label>
            <Input value={form.new_terms} onChange={e => setField('new_terms', e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Reason for Amendment *</Label>
          <Input
            placeholder="Why is this PO being revised?"
            value={form.reason}
            onChange={e => setField('reason', e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Item revision table */}
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Item</TableHead>
                <TableHead className="text-xs text-center">Received</TableHead>
                <TableHead className="text-xs text-center">Old Qty</TableHead>
                <TableHead className="text-xs text-center w-24">New Qty</TableHead>
                <TableHead className="text-xs text-center">Old Price</TableHead>
                <TableHead className="text-xs text-center w-28">New Price</TableHead>
                <TableHead className="text-xs text-right">New Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => {
                const belowReceived = Number(l.new_qty) < Number(l.received_qty);
                return (
                  <TableRow key={l.po_item_sno ?? idx} className={isLineChanged(l) ? 'bg-amber-50/60' : ''}>
                    <TableCell>
                      <p className="text-sm font-medium">{l.prod_name}</p>
                      <p className="text-xs text-muted-foreground/70">{l.unit_name}</p>
                    </TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground">{l.received_qty}</TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground line-through">{l.old_qty}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={l.received_qty}
                        value={l.new_qty}
                        onChange={e => updateLine(idx, { new_qty: Number(e.target.value) })}
                        className={`h-7 w-20 text-sm text-center mx-auto ${belowReceived ? 'border-red-400 text-red-600' : ''}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground line-through">{formatINR(l.old_price)}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        value={l.new_price}
                        onChange={e => updateLine(idx, { new_price: Number(e.target.value) })}
                        className="h-7 w-24 text-sm text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatINR(lineTotal(l.new_qty, l.new_price))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {invalidLine && (
          <p className="text-xs text-red-600">New quantity cannot be less than the quantity already received via GRN.</p>
        )}

        {/* Summary + actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>{changedCount} of {lines.length} line(s) revised</div>
            <div>
              Old total: <span className="line-through">{formatINR(oldTotal)}</span> →{' '}
              <span className="font-semibold text-foreground">{formatINR(newTotal)}</span>{' '}
              <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-muted-foreground'}>
                ({diff >= 0 ? '+' : ''}{formatINR(diff)})
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setLines(buildAmendmentLines(po))}>
              <RotateCcw size={13} className="mr-1" /> Reset
            </Button>
            <Button variant="outline" size="sm" className="text-xs" disabled={!form.reason.trim() || saving} onClick={() => onSubmit(form, lines, false)}>
              Save Draft
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-xs" disabled={!canSubmit} onClick={() => onSubmit(form, lines, true)}>
              <Send size={13} className="mr-1" />
              {saving ? 'Submitting…' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AmendmentForm;
