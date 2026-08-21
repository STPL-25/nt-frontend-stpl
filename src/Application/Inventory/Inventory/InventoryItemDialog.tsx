import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import {
  EMPTY_INVENTORY_FORM, INVENTORY_CATEGORIES, UOM_OPTIONS, WAREHOUSES,
  type InventoryItem, type InventoryFormState,
} from './types';
import { generateItemCode } from './helpers';

interface CascadeOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
}

interface InventoryItemDialogProps {
  open: boolean;
  /** null = create mode, otherwise edit mode pre-filled from this item. */
  item: InventoryItem | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: InventoryFormState) => void;
}

const InventoryItemDialog: React.FC<InventoryItemDialogProps> = ({
  open, item, saving, onClose, onSubmit,
}) => {
  const [form, setForm] = useState<InventoryFormState>(EMPTY_INVENTORY_FORM);
  const isEdit = !!item;
console.log('InventoryItemDialog', { open, item, form });
  const { options: masterOptions } = useMasterOptions(['CompanyMaster', 'DivisionMaster', 'BranchMaster', 'DeptMaster']);
  const { CompanyMaster, DivisionMaster, BranchMaster, DeptMaster } = masterOptions || {};

  const divisionOptions = useMemo(() => {
    const list = (DivisionMaster ?? []) as CascadeOption[];
    if (!form.com_sno) return list;
    return list.filter(d => String(d.com_sno) === String(form.com_sno));
  }, [DivisionMaster, form.com_sno]);

  const branchOptions = useMemo(() => {
    const list = (BranchMaster ?? []) as CascadeOption[];
    return list.filter(b => {
      const matchCompany = !form.com_sno || String(b.com_sno) === String(form.com_sno);
      const matchDivision = !form.div_sno || String(b.div_sno) === String(form.div_sno);
      return matchCompany && matchDivision;
    });
  }, [BranchMaster, form.com_sno, form.div_sno]);

  const deptOptions = useMemo(() => {
    const list = (DeptMaster ?? []) as CascadeOption[];
    return list.filter(d => {
      const matchCompany = !form.com_sno || String(d.com_sno) === String(form.com_sno);
      const matchDivision = !form.div_sno || String(d.div_sno) === String(form.div_sno);
      const matchBranch = !form.brn_sno || String(d.brn_sno) === String(form.brn_sno);
      return matchCompany && matchDivision && matchBranch;
    });
  }, [DeptMaster, form.com_sno, form.div_sno, form.brn_sno]);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        item_code: item.item_code,
        item_name: item.item_name,
        category: item.category,
        sub_category: item.sub_category ?? '',
        uom: item.uom,
        current_stock: item.current_stock,
        min_stock: item.min_stock,
        max_stock: item.max_stock,
        reorder_qty: item.reorder_qty,
        warehouse: item.warehouse,
        location: item.location ?? '',
        cost_price: item.cost_price,
        selling_price: item.selling_price,
        status: item.status,
        hsn_code: item.hsn_code ?? '',
        description: item.description ?? '',
        com_sno: item.com_sno ?? '',
        com_name: item.com_name ?? '',
        div_sno: item.div_sno ?? '',
        div_name: item.div_name ?? '',
        brn_sno: item.brn_sno ?? '',
        brn_name: item.brn_name ?? '',
        dept_sno: item.dept_sno ?? '',
        dept_name: item.dept_name ?? '',
      });
    } else {
      setForm({ ...EMPTY_INVENTORY_FORM, item_code: generateItemCode() });
    }
  }, [open, item]);

  const set = (field: keyof InventoryFormState, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const setNum = (field: keyof InventoryFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(field, e.target.value === '' ? 0 : Number(e.target.value));

  const selectCompany = (value: string) => {
    const opt = (CompanyMaster as CascadeOption[] | undefined)?.find(c => String(c.value) === value);
    setForm(prev => ({
      ...prev,
      com_sno: opt ? Number(opt.value) : '',
      com_name: opt?.label ?? '',
      div_sno: '', div_name: '',
      brn_sno: '', brn_name: '',
      dept_sno: '', dept_name: '',
    }));
  };

  const selectDivision = (value: string) => {
    const opt = divisionOptions.find(d => String(d.value) === value);
    setForm(prev => ({
      ...prev,
      div_sno: opt ? Number(opt.value) : '',
      div_name: opt?.label ?? '',
      brn_sno: '', brn_name: '',
      dept_sno: '', dept_name: '',
    }));
  };

  const selectBranch = (value: string) => {
    const opt = branchOptions.find(b => String(b.value) === value);
    setForm(prev => ({
      ...prev,
      brn_sno: opt ? Number(opt.value) : '',
      brn_name: opt?.label ?? '',
      dept_sno: '', dept_name: '',
    }));
  };

  const selectDept = (value: string) => {
    const opt = deptOptions.find(d => String(d.value) === value);
    setForm(prev => ({
      ...prev,
      dept_sno: opt ? Number(opt.value) : '',
      dept_name: opt?.label ?? '',
    }));
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {/* <DialogTitle>{isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle> */}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product Name <span className="text-red-500">*</span></Label>
            <Input value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. Steel Rod 10mm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Item Code <span className="text-red-500">*</span></Label>
              <Input value={form.item_code} onChange={e => set('item_code', e.target.value)} disabled={isEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Category <span className="text-red-500">*</span></Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {INVENTORY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company <span className="text-red-500">*</span></Label>
              <Select value={form.com_sno ? String(form.com_sno) : ''} onValueChange={selectCompany}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {(CompanyMaster ?? []).map((c: CascadeOption) => (
                    <SelectItem key={c.value} value={String(c.value)}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Division <span className="text-red-500">*</span></Label>
              <Select value={form.div_sno ? String(form.div_sno) : ''} onValueChange={selectDivision} disabled={!form.com_sno}>
                <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                <SelectContent>
                  {divisionOptions.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Branch <span className="text-red-500">*</span></Label>
              <Select value={form.brn_sno ? String(form.brn_sno) : ''} onValueChange={selectBranch} disabled={!form.div_sno}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branchOptions.map(b => (
                    <SelectItem key={b.value} value={String(b.value)}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department <span className="text-red-500">*</span></Label>
              <Select value={form.dept_sno ? String(form.dept_sno) : ''} onValueChange={selectDept} disabled={!form.brn_sno}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {deptOptions.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit of Measure <span className="text-red-500">*</span></Label>
              <Select value={form.uom} onValueChange={v => set('uom', v)}>
                <SelectTrigger><SelectValue placeholder="Select UoM" /></SelectTrigger>
                <SelectContent>
                  {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse <span className="text-red-500">*</span></Label>
              <Select value={form.warehouse} onValueChange={v => set('warehouse', v)}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {WAREHOUSES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Location (Bin / Rack)</Label>
              <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. A-01-R1" />
            </div>
            <div className="space-y-1.5">
              <Label>HSN Code</Label>
              <Input value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Opening Stock</Label>
              <Input type="number" min={0} value={form.current_stock} onChange={setNum('current_stock')} disabled={isEdit} />
              {isEdit && <p className="text-[11px] text-muted-foreground">Use Adjust Stock to change</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock</Label>
              <Input type="number" min={0} value={form.min_stock} onChange={setNum('min_stock')} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Stock</Label>
              <Input type="number" min={0} value={form.max_stock} onChange={setNum('max_stock')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Reorder Qty</Label>
              <Input type="number" min={0} value={form.reorder_qty} onChange={setNum('reorder_qty')} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Price (₹)</Label>
              <Input type="number" min={0} step="0.01" value={form.cost_price} onChange={setNum('cost_price')} />
            </div>
            <div className="space-y-1.5">
              <Label>Selling Price (₹)</Label>
              <Input type="number" min={0} step="0.01" value={form.selling_price} onChange={setNum('selling_price')} />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional notes about this item"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          {/* <Button onClick={() => onSubmit(form)} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Item'}
          </Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryItemDialog;
