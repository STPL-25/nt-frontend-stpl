import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Users, Send, Loader2, CreditCard, RefreshCcw, Paperclip, FileText, X } from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useQuotationHeaderFields, useQuotationItemFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { QuotationItem, QuotationFormState } from './types';
import { formatINR, calcQuotationTotals, recalcItemTotal, today } from './helpers';

interface QuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationItems: QuotationItem[];
  onSubmit: (form: QuotationFormState, items: QuotationItem[], file: File | null) => Promise<void>;
}

const MAX_FILE_MB = 10;
const ACCEPTED_FILE = 'image/png,image/jpeg,image/jpg,image/webp,application/pdf';

const INITIAL_FORM: QuotationFormState = {
  quotation_ref_no: '',
  quotation_date: today(),
  valid_upto: '',
  currency_code: 'INR',
  payment_terms: 'Net 30',
  delivery_days: 0,
  remarks: '',
  advance_payment_required: false,
  advance_payment_pct: 0,
};

const QuotationDialog: React.FC<QuotationDialogProps> = ({
  open, onOpenChange, quotationItems: initialItems, onSubmit,
}) => {
  const headerFields = useQuotationHeaderFields();
  const itemFields = useQuotationItemFields();

  const inputHeaderFields = headerFields.filter(f => f.input);
  const gridHeaderFields = inputHeaderFields.filter(f => f.type !== 'textarea');
  const textareaHeaderFields = inputHeaderFields.filter(f => f.type === 'textarea');
  const viewItemFields = itemFields.filter(f => f.view);

  const [form, setForm] = useState<QuotationFormState>(INITIAL_FORM);
  const [items, setItems] = useState<QuotationItem[]>(initialItems);
  const [itemSelection, setItemSelection] = useState<Set<number>>(new Set(initialItems.map((_, i) => i)));
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');

  // Reset when dialog opens with new items
  React.useEffect(() => {
    if (open) {
      setItems(initialItems);
      setItemSelection(new Set(initialItems.map((_, i) => i)));
      setForm(INITIAL_FORM);
      setFile(null);
      setFileError('');
    }
  }, [open, initialItems]);

  const handlePickFile = (f: File | null) => {
    setFileError('');
    if (!f) { setFile(null); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be under ${MAX_FILE_MB} MB`);
      return;
    }
    setFile(f);
  };

  const updateItem = (idx: number, field: keyof QuotationItem, value: string | number) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const numFields = ['qty', 'unit_price', 'discount_pct', 'tax_pct', 'delivery_days'];
        const updated = { ...item, [field]: numFields.includes(field) ? Number(value) : value };
        return recalcItemTotal(updated);
      })
    );
  };

  const updateBuyback = (idx: number, value: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, buyback_value: Math.max(0, value) } : item));
  };

  const selectedItems = useMemo(() => items.filter((_, i) => itemSelection.has(i)), [items, itemSelection]);
  const totals = useMemo(() => calcQuotationTotals(selectedItems), [selectedItems]);
  const totalBuyback = useMemo(() => selectedItems.reduce((s, it) => s + (it.buyback_value ?? 0), 0), [selectedItems]);
  const netAfterBuyback = totals.grandTotal - totalBuyback;
  const advanceAmount = form.advance_payment_required
    ? (netAfterBuyback * (form.advance_payment_pct / 100))
    : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form, selectedItems, file);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto min-w-5xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} className="text-green-600" />
            Add Supplier Quotation
          </DialogTitle>
        </DialogHeader>

        {/* Header fields - dynamically rendered */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {gridHeaderFields.map(field => (
            <CustomInputField
              key={field.field}
              field={field.field}
              label={field.label}
              type={field.type}
              require={field.require}
              placeholder={field.placeholder}
              options={field.options || []}
              value={(form as any)[field.field] ?? ''}
              onChange={(value) => setForm(f => ({ ...f, [field.field]: field.type === 'number' ? Number(value) : value }))}
            />
          ))}
        </div>

        {/* Textarea fields */}
        {textareaHeaderFields.map(field => (
          <CustomInputField
            key={field.field}
            field={field.field}
            label={field.label}
            type={field.type}
            placeholder={field.placeholder}
            value={(form as any)[field.field] ?? ''}
            onChange={(value) => setForm(f => ({ ...f, [field.field]: value }))}
          />
        ))}

        {/* Advance Payment */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Advance Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.advance_payment_required}
                onCheckedChange={v => setForm(f => ({
                  ...f,
                  advance_payment_required: v,
                  advance_payment_pct: v ? f.advance_payment_pct : 0,
                }))}
              />
              <span className="text-xs text-muted-foreground">
                {form.advance_payment_required ? 'Required' : 'Not Required'}
              </span>
            </div>
          </div>
          {form.advance_payment_required && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <label className="text-xs text-muted-foreground">Advance %</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.advance_payment_pct || ''}
                onChange={e => setForm(f => ({ ...f, advance_payment_pct: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                placeholder="0"
                className="h-7 w-20 text-xs text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
              <span className="text-xs font-medium text-amber-700 ml-1">
                = {formatINR(advanceAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Quotation items - dynamic columns */}
        <div className="border rounded overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs w-8">
                  <input
                    type="checkbox"
                    checked={itemSelection.size === items.length}
                    onChange={(e) => setItemSelection(e.target.checked ? new Set(items.map((_, i) => i)) : new Set())}
                    className="cursor-pointer"
                  />
                </TableHead>
                <TableHead className="text-xs w-8">#</TableHead>
                {viewItemFields.map(f => (
                  <TableHead key={f.field} className={`text-xs ${f.type === 'number' && !f.input ? 'text-right' : f.field === 'qty' ? 'text-center' : f.input && f.type === 'number' ? 'text-right' : ''} ${f.require ? '' : ''}`}>
                    {f.label} {f.require && <span className="text-red-500">*</span>}
                  </TableHead>
                ))}
                <TableHead className="text-xs text-right text-emerald-700 whitespace-nowrap">
                  <RefreshCcw size={11} className="inline mr-1" />
                  Buyback
                </TableHead>
                <TableHead className="text-xs text-right">Net Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const included = itemSelection.has(idx);
                return (
                  <TableRow key={idx} className={!included ? 'opacity-40' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => setItemSelection(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx); else next.add(idx);
                          return next;
                        })}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground/70">{idx + 1}</TableCell>
                    {viewItemFields.map(f => {
                      const val = (item as any)[f.field];

                      // Read-only text
                      if (!f.input) {
                        if (f.field === 'total_amount') {
                          return <TableCell key={f.field} className="text-xs text-right font-medium">{formatINR(item.total_amount)}</TableCell>;
                        }
                        return <TableCell key={f.field} className={`text-xs ${f.field === 'qty' ? 'text-center' : ''}`}>{val ?? '—'}</TableCell>;
                      }

                      // Editable number input
                      return (
                        <TableCell key={f.field}>
                          <Input
                            type="number"
                            min={0}
                            step={f.field === 'discount_pct' || f.field === 'tax_pct' ? 0.5 : 1}
                            value={val || ''}
                            onChange={(e) => updateItem(idx, f.field as keyof QuotationItem, e.target.value)}
                            placeholder="0"
                            className={`h-7 text-xs ${f.field === 'qty' ? 'text-center' : 'text-right'} ${f.field === 'unit_price' && item.unit_price <= 0 ? 'border-amber-400 bg-amber-50' : ''}`}
                          />
                        </TableCell>
                      );
                    })}
                    {/* Buyback value */}
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.buyback_value || ''}
                        onChange={e => updateBuyback(idx, Number(e.target.value))}
                        placeholder="0"
                        className="h-7 text-xs text-right w-24 border-emerald-300 focus:border-emerald-500"
                      />
                    </TableCell>
                    {/* Net amount after buyback */}
                    <TableCell className="text-xs text-right font-medium">
                      {(() => {
                        const net = item.total_amount - (item.buyback_value ?? 0);
                        return (
                          <span className={net < item.total_amount ? 'text-emerald-700' : ''}>
                            {formatINR(net)}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="space-y-1 text-sm w-72">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium">{formatINR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="font-medium text-red-600">-{formatINR(totals.discount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="font-medium">{formatINR(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Grand Total</span>
              <span className="text-primary">{formatINR(totals.grandTotal)}</span>
            </div>
            {totalBuyback > 0 && (
              <>
                <div className="flex justify-between text-emerald-700">
                  <span className="flex items-center gap-1">
                    <RefreshCcw size={11} /> Buyback Credit
                  </span>
                  <span className="font-medium">-{formatINR(totalBuyback)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-emerald-800">
                  <span>Net Payable</span>
                  <span>{formatINR(netAfterBuyback)}</span>
                </div>
              </>
            )}
            {form.advance_payment_required && form.advance_payment_pct > 0 && (
              <div className="flex justify-between text-amber-700 border-t pt-1">
                <span>Advance ({form.advance_payment_pct}%)</span>
                <span className="font-medium">{formatINR(advanceAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quotation document upload (image / PDF) */}
        <div className="rounded-lg border border-dashed border-primary/20 bg-primary/10/40 p-3">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-primary">
            <Paperclip size={14} />
            Quotation Document
            <span className="text-[10px] font-normal text-muted-foreground/70">(image or PDF, optional, max {MAX_FILE_MB}MB)</span>
          </div>
          {file ? (
            <div className="flex items-center gap-2 bg-card border rounded px-2.5 py-1.5">
              <FileText size={16} className="text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground truncate flex-1">{file.name}</span>
              <span className="text-[10px] text-muted-foreground/70 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                className="text-muted-foreground/50 hover:text-red-500"
                onClick={() => handlePickFile(null)}
                title="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:text-primary">
              <span className="inline-flex items-center gap-1.5 border border-primary/40 rounded px-2.5 py-1.5 bg-card hover:bg-primary/10">
                <Paperclip size={13} /> Choose file…
              </span>
              <input
                type="file"
                accept={ACCEPTED_FILE}
                className="hidden"
                onChange={e => handlePickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {fileError && <p className="text-[11px] text-red-500 mt-1">{fileError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-primary hover:bg-primary/90">
            {submitting ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
            Submit Quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuotationDialog;
