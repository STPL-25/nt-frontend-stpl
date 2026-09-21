import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Send, RefreshCw, Truck, Package, FileSpreadsheet, Upload } from 'lucide-react';
import { FormSection } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useVendorDrivenPRHeaderFields, useVendorDrivenPRItemFields } from '@/FieldDatas/VendorDrivenPRData';
import { downloadExcelTemplate, parseExcelFile } from '@/utils/excelUtils';
import axios from 'axios';
import { createPrRecord } from '@/Services/Api';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';

interface FormErrors {
  [key: string]: string;
}

interface VendorDrivenItem {
  prod_sno: number | string;
  prod_name?: string;
  qty: number | string;
  unit_sno: number | string;
  unit_name?: string;
  rate: number | string;
  discount_pct: number | string;
  gst_pct: number | string;
  remarks?: string;
}

const NAME_FIELD_MAP: Record<string, string> = {
  com_sno: 'com_name', div_sno: 'div_name', brn_sno: 'brn_name', dept_sno: 'dept_name',
  vendor_sno: 'vendor_name', priority_sno: 'priority_name',
  prod_sno: 'prod_name', unit_sno: 'unit_name',
};
function resolveNameField(fieldName: string): string {
  return NAME_FIELD_MAP[fieldName] ?? fieldName;
}

const EMPTY_ITEM: VendorDrivenItem = {
  prod_sno: '', qty: '', unit_sno: '', rate: '', discount_pct: 0, gst_pct: 0, remarks: '',
};

function computeLineAmount(item: VendorDrivenItem) {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  const discountPct = Number(item.discount_pct) || 0;
  const gstPct = Number(item.gst_pct) || 0;
  const gross = qty * rate;
  const taxable = gross * (1 - discountPct / 100);
  const gst = taxable * (gstPct / 100);
  return { taxable, gst, total: taxable + gst };
}

interface Props {
  onSubmitted?: () => void;
}

const VendorDrivenPRForm: React.FC<Props> = ({ onSubmitted }) => {
  const { canCreate, canEdit } = usePermissions();
  const canSubmit = canCreate('PurchaseRequisitionPage') || canEdit('PurchaseRequisitionPage');

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const headerFields = useVendorDrivenPRHeaderFields({ selectedCompany, selectedDivision, selectedBranch });
  const itemFields = useVendorDrivenPRItemFields();

  const [header, setHeader] = useState<Record<string, any>>({ payment_cycle_days: 15 });
  const [headerErrors, setHeaderErrors] = useState<FormErrors>({});
  const [currentItem, setCurrentItem] = useState<VendorDrivenItem>(EMPTY_ITEM);
  const [itemError, setItemError] = useState<string | null>(null);
  const [items, setItems] = useState<VendorDrivenItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [customCycle, setCustomCycle] = useState(false);
  const [importingItems, setImportingItems] = useState(false);
  const itemImportRef = useRef<HTMLInputElement>(null);

  const handleHeaderChange = (fieldName: string, value: any) => {
    setHeader((prev) => {
      const updated = { ...prev, [fieldName]: value };
      if (fieldName === 'com_sno') {
        updated.div_sno = ''; updated.div_name = '';
        updated.brn_sno = ''; updated.brn_name = '';
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedCompany(String(value)); setSelectedDivision(''); setSelectedBranch('');
      } else if (fieldName === 'div_sno') {
        updated.brn_sno = ''; updated.brn_name = '';
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedDivision(String(value)); setSelectedBranch('');
      } else if (fieldName === 'brn_sno') {
        updated.dept_sno = ''; updated.dept_name = '';
        setSelectedBranch(String(value));
      }
      if (fieldName === 'payment_cycle_days') {
        setCustomCycle(value === 'CUSTOM');
        if (value === 'CUSTOM') updated.payment_cycle_days = '';
      }
      const field = headerFields.find((f) => f.field === fieldName);
      if (field?.options && Array.isArray(field.options)) {
        const opt = (field.options as any[]).find((o) => String(o.value) === String(value));
        if (opt) updated[resolveNameField(fieldName)] = opt.label;
      }
      return updated;
    });
    if (headerErrors[fieldName]) setHeaderErrors((prev) => { const e = { ...prev }; delete e[fieldName]; return e; });
  };

  const handleItemChange = (fieldName: string, value: any) => {
    setCurrentItem((prev) => {
      const updated: any = { ...prev, [fieldName]: value };
      const field = itemFields.find((f) => f.field === fieldName);
      if (field?.options && Array.isArray(field.options)) {
        const opt = (field.options as any[]).find((o) => String(o.value) === String(value));
        if (opt) updated[resolveNameField(fieldName)] = opt.label;
      }
      return updated;
    });
    if (itemError) setItemError(null);
  };

  const { taxable, gst, total } = useMemo(() => computeLineAmount(currentItem), [currentItem]);

  const handleAddItem = () => {
    if (!currentItem.prod_sno || !currentItem.qty || Number(currentItem.qty) <= 0 || !currentItem.unit_sno || currentItem.rate === '' || Number(currentItem.rate) < 0) {
      setItemError('Product, quantity, unit and rate are required.');
      return;
    }
    setItems((prev) => [...prev, currentItem]);
    setCurrentItem(EMPTY_ITEM);
    setItemError(null);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Bulk item entry via Excel ─────────────────────────────────────────────
  // itemFields already carries ProductMaster/UomMaster options (unlike the
  // regular PR form, which has to fetch them separately) — search-select just
  // maps straight onto excelUtils' generic dropdown-list field shape.
  const excelItemFields = useMemo(
    () =>
      itemFields
        .filter((f) => f.input && f.field !== 'prod_name' && f.field !== 'unit_name')
        .map((f) => ({
          field: f.field,
          label: f.label,
          type: f.type === 'search-select' ? 'select' : f.type,
          require: f.require,
          options: Array.isArray(f.options) ? f.options : [],
        })),
    [itemFields]
  );

  const handleDownloadItemTemplate = async () => {
    try {
      await downloadExcelTemplate(excelItemFields, 'Vendor_Driven_PR_Items');
      toast.success('Item template downloaded — fill it and import back');
    } catch {
      toast.error('Failed to download template. Please try again.');
    }
  };

  const handleImportItems = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportingItems(true);
    try {
      const { rows, errors } = await parseExcelFile(file, excelItemFields);

      if (errors.length > 0) errors.forEach((err) => toast.error(err));

      if (rows.length === 0) {
        toast.error('No valid rows found in the file');
        return;
      }

      const newItems = rows.map((row) => {
        const resolvedNames: Record<string, any> = {};
        excelItemFields.forEach((f) => {
          if (f.options && f.options.length > 0 && row[f.field] !== undefined && row[f.field] !== '') {
            const match = f.options.find((o) => String(o.value) === String(row[f.field]));
            if (match) resolvedNames[resolveNameField(f.field)] = match.label;
          }
        });

        return {
          ...EMPTY_ITEM,
          ...row,
          ...resolvedNames,
          qty: parseFloat(String(row.qty)) || 1,
        } as VendorDrivenItem;
      });

      setItems((prev) => [...prev, ...newItems]);
      toast.success(`${newItems.length} item${newItems.length > 1 ? 's' : ''} imported`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImportingItems(false);
    }
  };

  const itemsTotal = useMemo(
    () => items.reduce((sum, it) => sum + computeLineAmount(it).total, 0),
    [items]
  );

  const validateHeader = (): boolean => {
    const errs: FormErrors = {};
    if (!header.com_sno) errs.com_sno = 'Company is required';
    if (!header.div_sno) errs.div_sno = 'Division is required';
    if (!header.brn_sno) errs.brn_sno = 'Branch is required';
    if (!header.dept_sno) errs.dept_sno = 'Department is required';
    if (!header.vendor_sno) errs.vendor_sno = 'Supplier is required';
    if (!header.req_date) errs.req_date = 'Request date is required';
    if (!header.required_date) errs.required_date = 'Required date is required';
    if (!header.priority_sno) errs.priority_sno = 'Priority is required';
    const cycle = Number(header.payment_cycle_days);
    if (!cycle || cycle < 1 || cycle > 365) errs.payment_cycle_days = 'Payment cycle must be between 1 and 365 days';
    if (!header.attachment) errs.attachment = 'A verification document (bill/receipt) is required';
    setHeaderErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateHeader()) {
      toast.error('Please fill in all required header fields.');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one item before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('basicInfo', JSON.stringify({
        request_mode: 'VENDOR_DRIVEN',
        com_sno: header.com_sno,
        div_sno: header.div_sno,
        brn_sno: header.brn_sno,
        dept_sno: header.dept_sno,
        vendor_sno: header.vendor_sno,
        req_date: header.req_date,
        required_date: header.required_date,
        priority_sno: header.priority_sno,
        payment_cycle_days: header.payment_cycle_days,
        purpose: header.purpose || '',
      }));
      formData.append('items', JSON.stringify(items.map((it) => ({
        prod_sno: it.prod_sno,
        prod_name: it.prod_name,
        qty: it.qty,
        unit_sno: it.unit_sno,
        rate: it.rate,
        discount_pct: it.discount_pct || 0,
        gst_pct: it.gst_pct || 0,
        remarks: it.remarks || '',
      }))));
      if (header.attachment) formData.append('attachment', header.attachment);

      const res = await axios.post(createPrRecord, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const prNo = res?.data?.data?.pr_no || res?.data?.data?.recordset?.[0]?.pr_no;
      toast.success(prNo ? `Vendor-driven requisition ${prNo} submitted for approval` : 'Vendor-driven requisition submitted for approval');
      setHeader({ payment_cycle_days: 15 });
      setItems([]);
      setCurrentItem(EMPTY_ITEM);
      onSubmitted?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const headerGridFields = headerFields.filter((f) => f.input && f.type !== 'textarea');
  const headerTextFields = headerFields.filter((f) => f.input && f.type === 'textarea');
  const itemGridFields = itemFields.filter((f) => f.input);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <Card className="shadow-md">
        <CardContent className="pt-6 space-y-4">
          <FormSection icon={Truck} title="Supplier & Requisition Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
              {headerGridFields.map((field) => (
                <div key={field.field} data-error={!!headerErrors[field.field]} className="flex flex-col">
                  <CustomInputField
                    field={field.field}
                    label={field.label}
                    require={field.require}
                    type={field.type}
                    options={field.field === 'payment_cycle_days' && customCycle ? undefined : field.options}
                    value={
                      field.field === 'payment_cycle_days' && customCycle
                        ? undefined
                        : header[field.field] ?? (field.defaultValue as any) ?? ''
                    }
                    onChange={(value) => handleHeaderChange(field.field, value)}
                    error={headerErrors[field.field]}
                    placeholder={field.type === 'select' || field.type === 'search-select' ? `Select ${field.label.toLowerCase()}` : undefined}
                    className="h-10"
                  />
                  {field.field === 'payment_cycle_days' && customCycle && (
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className="mt-2 h-10 rounded-md border px-3 text-sm"
                      placeholder="Days between payments (1-365)"
                      value={header.payment_cycle_days ?? ''}
                      onChange={(e) => setHeader((prev) => ({ ...prev, payment_cycle_days: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
            {headerTextFields.map((field) => (
              <div key={field.field}>
                <CustomInputField
                  field={field.field}
                  label={field.label}
                  require={field.require}
                  type={field.type}
                  value={header[field.field] ?? ''}
                  onChange={(value) => handleHeaderChange(field.field, value)}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  rows={2}
                  className="resize-none"
                />
              </div>
            ))}
          </FormSection>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent className="pt-6 space-y-4">
          {/* Hidden file input for Excel bulk item import */}
          <input
            ref={itemImportRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportItems}
          />
          <FormSection
            icon={Package}
            title="Add Item"
            action={
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadItemTemplate}
                  className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  title="Download Excel template for bulk item entry"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => itemImportRef.current?.click()}
                  disabled={importingItems}
                  className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                  title="Import multiple items from Excel"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {importingItems ? 'Importing…' : 'Import'}
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
              {itemGridFields.map((field) => (
                <div key={field.field} className="flex flex-col">
                  <CustomInputField
                    field={field.field}
                    label={field.label}
                    require={field.require}
                    type={field.type}
                    options={field.options}
                    value={currentItem[field.field as keyof VendorDrivenItem] ?? (field.defaultValue as any) ?? ''}
                    onChange={(value) => handleItemChange(field.field, value)}
                    placeholder={field.type === 'select' || field.type === 'search-select' ? `Select ${field.label.toLowerCase()}` : undefined}
                    className="h-10"
                  />
                </div>
              ))}
            </div>
            {(Number(currentItem.qty) > 0 && Number(currentItem.rate) >= 0) && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                <span>Taxable: ₹{taxable.toFixed(2)}</span>
                <span>GST: ₹{gst.toFixed(2)}</span>
                <span className="font-semibold text-foreground">Line total: ₹{total.toFixed(2)}</span>
              </div>
            )}
            {itemError && <p className="text-xs text-destructive">{itemError}</p>}
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={handleAddItem} className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </FormSection>

          {items.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Qty</TableHead>
                    <TableHead className="text-xs">Unit</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs">Discount %</TableHead>
                    <TableHead className="text-xs">GST %</TableHead>
                    <TableHead className="text-xs">Total</TableHead>
                    <TableHead className="text-xs w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const line = computeLineAmount(it);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{it.prod_name || it.prod_sno}</TableCell>
                        <TableCell className="text-xs">{it.qty}</TableCell>
                        <TableCell className="text-xs">{it.unit_name || it.unit_sno}</TableCell>
                        <TableCell className="text-xs">{it.rate}</TableCell>
                        <TableCell className="text-xs">{it.discount_pct || 0}</TableCell>
                        <TableCell className="text-xs">{it.gst_pct || 0}</TableCell>
                        <TableCell className="text-xs font-medium">₹{line.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {items.length > 0 && (
                <>
                  <Badge variant="secondary" className="mr-2">{items.length} {items.length === 1 ? 'item' : 'items'}</Badge>
                  Total: <span className="font-semibold text-foreground">₹{itemsTotal.toFixed(2)}</span>
                </>
              )}
            </div>
            {canSubmit && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={items.length === 0 || submitting}
                className="bg-blue-600 hover:bg-blue-700 h-9"
              >
                {submitting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Requisition
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDrivenPRForm;
