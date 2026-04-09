import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Users, Send, Loader2 } from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useQuotationHeaderFields, useQuotationItemFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { QuotationItem, QuotationFormState } from './types';
import { formatINR, calcQuotationTotals, recalcItemTotal, today } from './helpers';

interface QuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationItems: QuotationItem[];
  onSubmit: (form: QuotationFormState, items: QuotationItem[]) => Promise<void>;
}

const INITIAL_FORM: QuotationFormState = {
  quotation_ref_no: '',
  quotation_date: today(),
  valid_upto: '',
  currency_code: 'INR',
  payment_terms: 'Net 30',
  delivery_days: 0,
  remarks: '',
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

  // Reset when dialog opens with new items
  React.useEffect(() => {
    if (open) {
      setItems(initialItems);
      setItemSelection(new Set(initialItems.map((_, i) => i)));
      setForm(INITIAL_FORM);
    }
  }, [open, initialItems]);

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

  const totals = useMemo(() => calcQuotationTotals(items.filter((_, i) => itemSelection.has(i))), [items, itemSelection]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const selectedItems = items.filter((_, i) => itemSelection.has(i));
      await onSubmit(form, selectedItems);
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

        {/* Quotation items - dynamic columns */}
        <div className="border rounded overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
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
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="space-y-1 text-sm w-64">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">{formatINR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span className="font-medium text-red-600">-{formatINR(totals.discount)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span className="font-medium">{formatINR(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Grand Total</span>
              <span className="text-indigo-700">{formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
            {submitting ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
            Submit Quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuotationDialog;
