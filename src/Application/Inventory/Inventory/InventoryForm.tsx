import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Package, Save, RotateCcw, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { formatINR, formatDate, getStockStatus, generateItemCode } from './helpers';
import {
  EMPTY_INVENTORY_FORM, INVENTORY_CATEGORIES, UOM_OPTIONS, WAREHOUSES,
  type InventoryItem, type InventoryFormState,
} from './types';

interface InventoryFormProps {
  selectedItem: InventoryItem | null;
  isAddingNew: boolean;
  onSave: (form: InventoryFormState) => void;
  onDelete: (item: InventoryItem) => void;
  onCancel: () => void;
  saving: boolean;
}

const InventoryForm: React.FC<InventoryFormProps> = ({
  selectedItem, isAddingNew, onSave, onDelete, onCancel, saving,
}) => {
  const [form, setForm] = useState<InventoryFormState>(EMPTY_INVENTORY_FORM);
  const [isEditing, setIsEditing] = useState(false);

  // Populate form when item selected or adding new
  useEffect(() => {
    if (isAddingNew) {
      setForm({ ...EMPTY_INVENTORY_FORM, item_code: generateItemCode() });
      setIsEditing(true);
    } else if (selectedItem) {
      setForm({
        item_code: selectedItem.item_code,
        item_name: selectedItem.item_name,
        category: selectedItem.category,
        sub_category: selectedItem.sub_category ?? '',
        uom: selectedItem.uom,
        current_stock: selectedItem.current_stock,
        min_stock: selectedItem.min_stock,
        max_stock: selectedItem.max_stock,
        reorder_qty: selectedItem.reorder_qty,
        warehouse: selectedItem.warehouse,
        location: selectedItem.location ?? '',
        cost_price: selectedItem.cost_price,
        selling_price: selectedItem.selling_price,
        status: selectedItem.status,
        hsn_code: selectedItem.hsn_code ?? '',
        description: selectedItem.description ?? '',
      });
      setIsEditing(false);
    }
  }, [selectedItem, isAddingNew]);

  const set = (field: keyof InventoryFormState, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = () => onSave(form);

  const canEdit = isEditing || isAddingNew;
  const { label, color } = selectedItem ? getStockStatus(selectedItem) : { label: 'New', color: 'green' as const };

  const statusColors: Record<string, string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red:   'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package size={16} className="text-indigo-600" />
              {isAddingNew ? 'New Inventory Item' : `Item — ${selectedItem?.item_code}`}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isAddingNew && selectedItem && (
                <Badge className={`text-xs ${statusColors[color]}`}>{label}</Badge>
              )}
              {!isAddingNew && selectedItem && !isEditing && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(true)}>
                    <Pencil size={12} className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => onDelete(selectedItem)}
                  >
                    <Trash2 size={12} className="mr-1" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {/* View Mode — Summary */}
        {!canEdit && selectedItem && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Item Name', value: selectedItem.item_name },
                { label: 'Category', value: `${selectedItem.category}${selectedItem.sub_category ? ` / ${selectedItem.sub_category}` : ''}` },
                { label: 'UOM', value: selectedItem.uom },
                { label: 'Current Stock', value: `${selectedItem.current_stock} ${selectedItem.uom}` },
                { label: 'Min / Max Stock', value: `${selectedItem.min_stock} / ${selectedItem.max_stock} ${selectedItem.uom}` },
                { label: 'Reorder Qty', value: `${selectedItem.reorder_qty} ${selectedItem.uom}` },
                { label: 'Warehouse', value: selectedItem.warehouse },
                { label: 'Location', value: selectedItem.location ?? '—' },
                { label: 'HSN Code', value: selectedItem.hsn_code ?? '—' },
                { label: 'Cost Price', value: formatINR(selectedItem.cost_price) },
                { label: 'Selling Price', value: formatINR(selectedItem.selling_price) },
                { label: 'Status', value: selectedItem.status },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 font-medium">{f.label}</p>
                  <p className="text-sm font-medium text-gray-800">{f.value}</p>
                </div>
              ))}
            </div>
            {selectedItem.description && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-400 font-medium">Description</p>
                <p className="text-sm text-gray-700">{selectedItem.description}</p>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-400">Created: {formatDate(selectedItem.created_at)}</div>
          </CardContent>
        )}

        {/* Edit / Add Mode — Form */}
        {canEdit && (
          <CardContent className="space-y-5">
            {/* Row 1: Code / Name / Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Item Code *</Label>
                <Input
                  value={form.item_code}
                  onChange={e => set('item_code', e.target.value)}
                  placeholder="ITM-0001"
                  className="h-8 text-sm font-mono"
                  disabled={!isAddingNew} // code locked on edit
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-gray-600">Item Name *</Label>
                <Input
                  value={form.item_name}
                  onChange={e => set('item_name', e.target.value)}
                  placeholder="Steel Rod 10mm"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Row 2: Category / Sub-Category / UOM / HSN */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Category *</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Sub-Category</Label>
                <Input value={form.sub_category} onChange={e => set('sub_category', e.target.value)} className="h-8 text-sm" placeholder="e.g. Steel" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Unit of Measure *</Label>
                <Select value={form.uom} onValueChange={v => set('uom', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select UOM" /></SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map(u => (
                      <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">HSN Code</Label>
                <Input value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} className="h-8 text-sm" placeholder="7213" />
              </div>
            </div>

            {/* Row 3: Stock Levels */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <ArrowUpDown size={12} /> Stock Levels
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { field: 'current_stock', label: 'Current Stock *' },
                  { field: 'min_stock',     label: 'Min Stock *' },
                  { field: 'max_stock',     label: 'Max Stock *' },
                  { field: 'reorder_qty',   label: 'Reorder Qty *' },
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs text-gray-600">{label}</Label>
                    <Input
                      type="number" min={0}
                      value={(form as any)[field]}
                      onChange={e => set(field as keyof InventoryFormState, Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Row 4: Location */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Warehouse *</Label>
                <Select value={form.warehouse} onValueChange={v => set('warehouse', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                  <SelectContent>
                    {WAREHOUSES.map(w => (
                      <SelectItem key={w} value={w} className="text-sm">{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Location (Bin/Rack)</Label>
                <Input value={form.location} onChange={e => set('location', e.target.value)} className="h-8 text-sm" placeholder="A-01-R1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Active', 'Inactive', 'Discontinued'].map(s => (
                      <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 5: Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Cost Price (₹) *</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.cost_price}
                  onChange={e => set('cost_price', Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Selling Price (₹)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.selling_price}
                  onChange={e => set('selling_price', Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Optional item description..."
                className="text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t">
              <Button variant="outline" size="sm" className="text-xs" onClick={onCancel}>
                <RotateCcw size={13} className="mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-xs"
                disabled={saving || !form.item_code || !form.item_name || !form.category || !form.uom || !form.warehouse}
                onClick={handleSubmit}
              >
                <Save size={13} className="mr-1" />
                {saving ? 'Saving…' : isAddingNew ? 'Create Item' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default InventoryForm;
