import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
import { PackageCheck, Send, RotateCcw, Info, Save } from 'lucide-react';
import type { PORecord, GRNFormState, GRNItemEntry, WarehouseLocationOption } from './types';
import { today, formatINR, getPODisplayNo, buildGRNItems } from './helpers';
import { grnSvcGetWarehouseLocations } from '@/Services/GrnService/grnApi';

interface GRNEntryFormProps {
  po: PORecord;
  onSubmit: (form: GRNFormState, items: GRNItemEntry[]) => Promise<void>;
  submitting: boolean;
  /** Present when resuming a saved draft — seeds the form instead of building fresh from the PO. */
  initialForm?: GRNFormState;
  initialItems?: GRNItemEntry[];
  onSaveDraft?: (form: GRNFormState, items: GRNItemEntry[]) => Promise<void>;
  savingDraft?: boolean;
  isDraft?: boolean;
}

const CONDITIONS = ['Good', 'Damaged', 'Partial'] as const;

const GRNEntryForm: React.FC<GRNEntryFormProps> = ({
  po, onSubmit, submitting, initialForm, initialItems, onSaveDraft, savingDraft, isDraft,
}) => {
  const [form, setForm] = useState<GRNFormState>(
    () => initialForm ?? { received_date: today(), doc_ref_no: '', vehicle_no: '', challan_no: '', remarks: '' }
  );

  const [items, setItems] = useState<GRNItemEntry[]>(() => initialItems ?? buildGRNItems(po));

  const [locations, setLocations] = useState<WarehouseLocationOption[]>([]);

  // Warehouse locations valid for this PO's company/division/branch — the
  // Location dropdown below is scoped to these so the user can only pick
  // somewhere that actually applies to this org unit.
  useEffect(() => {
    let cancelled = false;
    axios.get(grnSvcGetWarehouseLocations(po.com_sno, po.div_sno, po.brn_sno))
      .then(res => { if (!cancelled) setLocations(res.data?.data ?? []); })
      .catch(() => { if (!cancelled) setLocations([]); });
    return () => { cancelled = true; };
  }, [po.com_sno, po.div_sno, po.brn_sno]);

  // Reset form when the PO changes (not when resuming a draft — the parent
  // remounts this component with a `key` covering the draft too, so the
  // useState initializers above already seed the right values on resume).
  useEffect(() => {
    if (initialForm || initialItems) return;
    setForm({ received_date: today(), doc_ref_no: '', vehicle_no: '', challan_no: '', remarks: '' });
    setItems(buildGRNItems(po));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {isDraft && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-300 ml-1">
              Draft
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Received Date *</Label>
            <Input
              type="date"
              value={form.received_date}
              onChange={e => setFormField('received_date', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Doc / Invoice Ref</Label>
            <Input
              placeholder="INV-2024-001"
              value={form.doc_ref_no}
              onChange={e => setFormField('doc_ref_no', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Challan No</Label>
            <Input
              placeholder="DC-001"
              value={form.challan_no}
              onChange={e => setFormField('challan_no', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vehicle No</Label>
            <Input
              placeholder="TN-01-AB-1234"
              value={form.vehicle_no}
              onChange={e => setFormField('vehicle_no', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Remarks</Label>
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
                  <TableRow className="bg-muted/40">
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
                    <TableHead className="text-xs w-32">Location</TableHead>
                    <TableHead className="text-xs w-28">HSN Code</TableHead>
                    <TableHead className="text-xs">Item Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow
                      key={idx}
                      className={!item.selected ? 'opacity-50 bg-muted/40/50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          disabled={item.pending_qty === 0}
                          onCheckedChange={(v) => updateItem(idx, { selected: Boolean(v) })}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground/70">{idx + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.prod_name || '—'}</p>
                          {item.specification && (
                            <p className="text-xs text-muted-foreground/70 truncate max-w-[160px]">{item.specification}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">
                        {item.ordered_qty} <span className="text-muted-foreground/70">{item.unit_name}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-medium ${item.pending_qty === 0 ? 'text-green-600' : 'text-primary'}`}>
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
                        <Select
                          value={item.warehouse_location_sno ? String(item.warehouse_location_sno) : undefined}
                          onValueChange={v => updateItem(idx, { warehouse_location_sno: Number(v) })}
                          disabled={!item.selected || locations.length === 0}
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue placeholder={locations.length === 0 ? 'None set up' : 'Select…'} />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map(loc => (
                              <SelectItem key={loc.location_sno} value={String(loc.location_sno)} className="text-xs">
                                {loc.location_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="From invoice"
                          value={item.hsn_code ?? ''}
                          maxLength={10}
                          disabled={!item.selected}
                          onChange={e => updateItem(idx, { hsn_code: e.target.value.replace(/[^0-9A-Za-z]/g, '') })}
                          className="h-7 text-xs w-24"
                        />
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
              <div className="text-xs text-muted-foreground">
                {selectedItems.length} of {items.length} item(s) selected &nbsp;•&nbsp;
                Total received:{' '}
                <span className="font-semibold text-foreground">
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
                {onSaveDraft && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    disabled={submitting || savingDraft}
                    onClick={() => onSaveDraft(form, items)}
                  >
                    <Save size={13} className="mr-1" />
                    {savingDraft ? 'Saving…' : isDraft ? 'Update Draft' : 'Save Draft'}
                  </Button>
                )}
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
