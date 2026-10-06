import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { purchaseTeamGetQuotationSupplyInfo } from '@/Services/Api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, Send, Loader2, CreditCard, RefreshCcw, Paperclip,
  ChevronRight, CheckCircle2, Lock, Info,
  Download, Upload, AlertCircle,
} from 'lucide-react';
import { downloadQuotationItemsExcel, parseQuotationItemsExcel } from '@/utils/excelUtils';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { useQuotationHeaderFields, useQuotationItemFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { QuotationItem, QuotationFormState, AdvancePaymentData, Vendor } from './types';
import { formatINR, calcQuotationTotals, recalcItemTotal, today } from './helpers';
import AdvancePaymentDialog from './AdvancePaymentDialog';

interface QuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationItems: QuotationItem[];
  defaultQuotationRefNo?: string;
  /** Selected supplier — its KYC MSME flag/type pre-fills the quotation's MSME fields. */
  vendor?: Vendor | null;
  /** Billing company — its GSTIN state prefix is compared with the supplier's to decide intrastate vs interstate. */
  comSno?: number | string | null;
  onSubmit: (form: QuotationFormState, items: QuotationItem[], file: File | null) => Promise<void>;
}

const MAX_FILE_MB = 10;

const INITIAL_FORM: QuotationFormState = {
  quotation_ref_no: '',
  quotation_date: today(),
  valid_upto: '',
  currency_code: 'INR',
  payment_terms: '',
  delivery_days: 0,
  remarks: '',
  buyback_available: false,
  buyback_value: 0,
  advance_payment_required: false,
  advance_payment_pct: 0,
  freight_charges: 0,
  other_charges: 0,
};

interface SupplyInfo {
  is_msme: string | null;
  msme_type: string | null;
  vendor_gst: string | null;
  company_gst: string | null;
  is_intrastate: boolean | null;
}

const QuotationDialog: React.FC<QuotationDialogProps> = ({
  open, onOpenChange, quotationItems: initialItems, defaultQuotationRefNo, vendor, comSno, onSubmit,
}) => {
  const headerFields = useQuotationHeaderFields();
  const itemFields = useQuotationItemFields();

  const inputHeaderFields = headerFields.filter(f => f.input);
  const gridHeaderFields = inputHeaderFields.filter(f => f.type !== 'textarea');
  const textareaHeaderFields = inputHeaderFields.filter(f => f.type === 'textarea');
  const viewItemFields = itemFields.filter(f => f.view);
  // Editable value fields shown in the mobile card layout (qty, unit price, disc, tax)
  const inputItemFields = viewItemFields.filter(f => f.input);
  // Per-column widths so numeric fields (esp. Qty) stay clearly visible on desktop
  const colWidth: Record<string, string> = {
    prod_name: 'min-w-[180px]',
    qty: 'w-28',
    unit_name: 'w-20',
    unit_price: 'w-36',
    discount_pct: 'w-24',
    tax_pct: 'w-24',
    total_amount: 'w-32',
  };
  // Hide native number spinner arrows so values aren't clipped in narrow columns
  const noSpin =
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  const [form, setForm] = useState<QuotationFormState>(INITIAL_FORM);
  const [items, setItems] = useState<QuotationItem[]>(initialItems);
  const [itemSelection, setItemSelection] = useState<Set<number>>(new Set(initialItems.map((_, i) => i)));
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [excelErrors, setExcelErrors] = useState<string[]>([]);
  const [excelUploading, setExcelUploading] = useState(false);
  // MSME + intrastate/interstate are never entered: fetched from the supplier KYC and GST state prefixes.
  const [supply, setSupply] = useState<SupplyInfo | null>(null);
  const [supplyLoading, setSupplyLoading] = useState(false);

  React.useEffect(() => {
    if (open) {
      setItems(initialItems);
      setItemSelection(new Set(initialItems.map((_, i) => i)));
      setForm({ ...INITIAL_FORM, quotation_ref_no: defaultQuotationRefNo ?? '' });
      setFile(null);
      setFileError('');
      setShowAdvanceDialog(false);
    }
  }, [open, initialItems, defaultQuotationRefNo]);

  React.useEffect(() => {
    const vendorSno = vendor?.kyc_basic_info_sno ?? vendor?.vendor_sno;
    if (!open || !vendorSno) { setSupply(null); return; }
    let cancelled = false;
    setSupplyLoading(true);
    axios
      .get(purchaseTeamGetQuotationSupplyInfo, { params: { vendor_sno: vendorSno, com_sno: comSno ?? undefined }, withCredentials: true })
      .then(res => { if (!cancelled) setSupply(res.data?.data ?? null); })
      .catch(() => { if (!cancelled) setSupply(null); })
      .finally(() => { if (!cancelled) setSupplyLoading(false); });
    return () => { cancelled = true; };
  }, [open, vendor, comSno]);

  const handleDownloadExcel = () => {
    downloadQuotationItemsExcel(
      items.map(it => ({
        prod_name:     it.prod_name,
        specification: it.specification,
        qty:           it.qty,
        unit_name:     it.unit_name,
        unit_price:    it.unit_price,
        discount_pct:  it.discount_pct,
        tax_pct:       it.tax_pct,
        delivery_days: it.delivery_days,
        remarks:       it.remarks,
      })),
      'quotation_items'
    );
  };

  const handleExcelUpload = async (f: File | null) => {
    if (!f) return;
    setExcelErrors([]);
    setExcelUploading(true);
    try {
      const { items: parsed, errors } = await parseQuotationItemsExcel(f);
      if (errors.length > 0) {
        setExcelErrors(errors);
        return;
      }
      if (parsed.length !== items.length) {
        setExcelErrors([`Row count mismatch: uploaded file has ${parsed.length} rows but ${items.length} items expected.`]);
        return;
      }
      setItems(prev =>
        prev.map((item, i) => {
          const p = parsed[i];
          const updated = { ...item, ...p };
          return recalcItemTotal(updated);
        })
      );
    } finally {
      setExcelUploading(false);
    }
  };

  // Delete (null) and Re-upload (a new File) both come through here; the file only reaches the server on submit.
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

  const selectedItems = useMemo(
    () => items.filter((_, i) => itemSelection.has(i)),
    [items, itemSelection],
  );
  const totals = useMemo(() => calcQuotationTotals(selectedItems), [selectedItems]);

  // Quotation-level extras (not per item)
  const freight = Math.max(0, Number(form.freight_charges) || 0);
  const otherCharges = Math.max(0, Number(form.other_charges) || 0);
  const grandWithCharges = totals.grandTotal + freight + otherCharges;
  const intrastate = supply?.is_intrastate === true;

  // Global buyback from form state
  const totalBuyback = form.buyback_available ? (form.buyback_value || 0) : 0;
  const netAfterBuyback = grandWithCharges - totalBuyback;

  // Advance payment is only enabled when every selected item has a unit price AND tax entered
  const canEnableAdvance = selectedItems.length > 0
    && selectedItems.every(it => it.unit_price > 0 && it.tax_pct > 0);

  // Most common tax rate across selected items — pre-fills GST % in advance dialog
  const defaultTaxPct = useMemo(() => {
    const rates = selectedItems.map(it => it.tax_pct).filter(t => t > 0);
    if (rates.length === 0) return 0;
    const freq = new Map<number, number>();
    rates.forEach(r => freq.set(r, (freq.get(r) ?? 0) + 1));
    let maxCount = 0, modal = rates[0];
    freq.forEach((count, rate) => { if (count > maxCount) { maxCount = count; modal = rate; } });
    return modal;
  }, [selectedItems]);

  // Advance amount derived from configured data or simple percentage
  const advanceAmount = useMemo(() => {
    if (!form.advance_payment_required) return 0;
    const d = form.advance_payment_data;
    if (d) {
      const base = netAfterBuyback * (d.advance_pct / 100);
      return base + (d.gst_applicable ? base * (d.gst_pct / 100) : 0);
    }
    return netAfterBuyback * (form.advance_payment_pct / 100);
  }, [form.advance_payment_required, form.advance_payment_data, form.advance_payment_pct, netAfterBuyback]);

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
      <DialogContent className="w-[95vw] md:w-[90vw] lg:w-[85vw] xl:w-[80vw] !max-w-[1600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} className="text-green-600" />
            Add Supplier Quotation
          </DialogTitle>
        </DialogHeader>

        {/* ── Header fields ─────────────────────────────────────────────────── */}
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

        {/* ── Supplier tax profile (read-only, from KYC + GST) ─────────────── */}
        <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Supplier MSME (from KYC)</div>
            <div className="font-medium">
              {supplyLoading ? 'Loading…' : supply?.is_msme === 'Y' ? `Yes${supply.msme_type ? ` — ${supply.msme_type}` : ''}` : supply?.is_msme === 'N' ? 'No' : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Supply Type</div>
            <div className="font-medium">
              {supplyLoading ? 'Loading…' : supply?.is_intrastate === true ? 'Intrastate (CGST + SGST)' : supply?.is_intrastate === false ? 'Interstate (IGST)' : 'Not determined (IGST shown)'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">GSTIN — ours / supplier</div>
            <div className="font-medium break-all">{supply?.company_gst ?? '—'} / {supply?.vendor_gst ?? '—'}</div>
          </div>
        </div>

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

        {/* ── Advance Payment ───────────────────────────────────────────────── */}
        <div className={`rounded-lg border p-3 ${canEnableAdvance ? 'bg-amber-50 border-amber-200' : 'bg-muted/30 border-border'}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className={canEnableAdvance ? 'text-amber-600' : 'text-muted-foreground'} />
              <span className={`text-xs font-semibold ${canEnableAdvance ? 'text-amber-700' : 'text-muted-foreground'}`}>
                Advance Payment
              </span>
              {!canEnableAdvance && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <Lock size={11} />
                  Enter unit price &amp; GST for all items to enable
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.advance_payment_required}
                disabled={!canEnableAdvance}
                onCheckedChange={v => {
                  setForm(f => ({
                    ...f,
                    advance_payment_required: v,
                    advance_payment_pct: v ? f.advance_payment_pct : 0,
                    advance_payment_data: v ? f.advance_payment_data : undefined,
                  }));
                  if (v) setShowAdvanceDialog(true);
                }}
              />
              <span className="text-xs text-muted-foreground">
                {form.advance_payment_required ? 'Required' : 'Not Required'}
              </span>
            </div>
          </div>

          {form.advance_payment_required && (
            <div className="mt-2">
              {form.advance_payment_data ? (
                <div className="rounded border border-amber-300 bg-amber-100/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
                      <CheckCircle2 size={13} className="text-amber-600" />
                      Advance configured: {form.advance_payment_data.advance_pct}%
                      {form.advance_payment_data.gst_applicable && (
                        <span className="font-normal text-amber-700">
                          {' '}+ GST {form.advance_payment_data.gst_pct}%
                        </span>
                      )}
                      <span className="font-normal">= {formatINR(advanceAmount)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-200 gap-1"
                      onClick={() => setShowAdvanceDialog(true)}
                    >
                      Edit <ChevronRight size={11} />
                    </Button>
                  </div>
                  {form.advance_payment_data.stages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.advance_payment_data.stages.map(s => (
                        <span key={s.id} className="text-[11px] bg-amber-200 text-amber-800 rounded px-1.5 py-0.5 font-medium">
                          Stage {s.stage_no}: {formatINR(s.amount)}
                          {s.due_days > 0 && ` (${s.due_days}d)`}
                        </span>
                      ))}
                    </div>
                  )}
                  {form.advance_payment_data.reason && (
                    <p className="text-[11px] text-amber-700 italic">"{form.advance_payment_data.reason}"</p>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 gap-1"
                  onClick={() => setShowAdvanceDialog(true)}
                >
                  <CreditCard size={12} /> Configure Advance Payment
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Buyback (above items table) ───────────────────────────────────── */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <RefreshCcw size={14} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Buyback / Trade-in</span>
              <span className="text-[11px] text-muted-foreground/70">
                — trade-in credit from supplier for existing asset
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Yes / No button group */}
              <button
                type="button"
                className={`h-7 px-3 text-xs rounded-l border font-medium transition-colors ${
                  !form.buyback_available
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-background text-muted-foreground border-border hover:border-emerald-300'
                }`}
                onClick={() => setForm(f => ({ ...f, buyback_available: false, buyback_value: 0 }))}
              >
                Not Available
              </button>
              <button
                type="button"
                className={`h-7 px-3 text-xs rounded-r border-t border-r border-b font-medium transition-colors ${
                  form.buyback_available
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-background text-muted-foreground border-border hover:border-emerald-300'
                }`}
                onClick={() => setForm(f => ({ ...f, buyback_available: true }))}
              >
                Available
              </button>
            </div>
          </div>

          {form.buyback_available && (
            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
              <label className="text-xs font-medium text-emerald-800">Buyback Amount (₹)</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-emerald-700 font-medium">₹</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.buyback_value || ''}
                  onChange={e => setForm(f => ({ ...f, buyback_value: Math.max(0, Number(e.target.value)) }))}
                  placeholder="0"
                  className="h-7 text-xs text-right w-36 border-emerald-300 focus:border-emerald-500"
                />
              </div>
              {form.buyback_value > 0 && (
                <span className="text-xs text-emerald-700 font-medium">
                  Net payable: {formatINR(netAfterBuyback)}
                  <span className="text-emerald-500 ml-1">(deducted from Grand Total)</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Excel import/export toolbar ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''} — fill unit price, discount &amp; GST below
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleDownloadExcel}
            >
              <Download size={13} />
              Download Excel
            </Button>
            <label className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded border font-medium cursor-pointer transition-colors
              ${excelUploading
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}`}
            >
              {excelUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Upload Filled Excel
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={e => { handleExcelUpload(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
            </label>
          </div>
        </div>
        {excelErrors.length > 0 && (
          <div className="rounded border border-red-200 bg-red-50 p-2.5 space-y-1">
            {excelErrors.map((err, i) => (
              <p key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                {err}
              </p>
            ))}
          </div>
        )}

        {/* ── Quotation items — desktop table ───────────────────────────────── */}
        <div className="hidden md:block border rounded overflow-x-auto">
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
                  <TableHead
                    key={f.field}
                    className={`text-xs ${colWidth[f.field] ?? ''} ${
                      f.field === 'qty' ? 'text-center'
                      : f.type === 'number' ? 'text-right'
                      : ''
                    }`}
                  >
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
                    <TableCell className="text-xs text-muted-foreground/70">{idx + 1}</TableCell>
                    {viewItemFields.map(f => {
                      const val = (item as any)[f.field];

                      if (!f.input) {
                        if (f.field === 'total_amount') {
                          return (
                            <TableCell key={f.field} className="text-xs text-right font-medium">
                              {formatINR(item.total_amount)}
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={f.field} className={`text-xs ${f.field === 'qty' ? 'text-center' : ''}`}>
                            {val ?? '—'}
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={f.field}>
                          <Input
                            type="number"
                            min={0}
                            step={f.field === 'discount_pct' || f.field === 'tax_pct' ? 0.5 : 1}
                            value={val || ''}
                            onChange={(e) => updateItem(idx, f.field as keyof QuotationItem, e.target.value)}
                            placeholder="0"
                            className={`h-8 text-sm ${noSpin} ${f.field === 'qty' ? 'text-center font-semibold' : 'text-right'} ${
                              f.field === 'unit_price' && item.unit_price <= 0 ? 'border-amber-400 bg-amber-50' : ''
                            } ${
                              f.field === 'tax_pct' && item.tax_pct <= 0 ? 'border-amber-400 bg-amber-50' : ''
                            }`}
                          />
                          {f.field === 'discount_pct' && item.discount_pct > 0 && item.unit_price > 0 && (
                            <p className="text-[10px] text-right text-red-500 mt-0.5 leading-none">
                              -{formatINR(item.qty * item.unit_price * (item.discount_pct / 100))}
                            </p>
                          )}
                          {f.field === 'tax_pct' && item.tax_pct > 0 && item.unit_price > 0 && (
                            <p className="text-[10px] text-right text-blue-500 mt-0.5 leading-none">
                              +{formatINR(item.qty * item.unit_price * (1 - item.discount_pct / 100) * (item.tax_pct / 100))}
                            </p>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* ── Quotation items — mobile cards ────────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {items.map((item, idx) => {
            const included = itemSelection.has(idx);
            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 ${included ? 'bg-card' : 'bg-muted/30 opacity-60'}`}
              >
                {/* Card header: select + name + total */}
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => setItemSelection(prev => {
                      const next = new Set(prev);
                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                      return next;
                    })}
                    className="mt-0.5 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground break-words leading-tight">
                      {item.prod_name ?? '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      #{idx + 1}{item.unit_name ? ` · ${item.unit_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold text-primary">{formatINR(item.total_amount)}</p>
                  </div>
                </div>

                {/* Editable values: qty, unit price, disc, tax */}
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {inputItemFields.map(f => {
                    const val = (item as any)[f.field];
                    const amber =
                      (f.field === 'unit_price' && item.unit_price <= 0) ||
                      (f.field === 'tax_pct' && item.tax_pct <= 0);
                    return (
                      <div key={f.field} className="space-y-1">
                        <label className="block text-[11px] font-medium text-muted-foreground">
                          {f.label} {f.require && <span className="text-red-500">*</span>}
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={f.field === 'discount_pct' || f.field === 'tax_pct' ? 0.5 : 1}
                          value={val || ''}
                          onChange={(e) => updateItem(idx, f.field as keyof QuotationItem, e.target.value)}
                          placeholder="0"
                          className={`h-9 text-sm text-right ${noSpin} ${amber ? 'border-amber-400 bg-amber-50' : ''}`}
                        />
                        {f.field === 'discount_pct' && item.discount_pct > 0 && item.unit_price > 0 && (
                          <p className="text-[10px] text-right text-red-500 leading-none">
                            -{formatINR(item.qty * item.unit_price * (item.discount_pct / 100))}
                          </p>
                        )}
                        {f.field === 'tax_pct' && item.tax_pct > 0 && item.unit_price > 0 && (
                          <p className="text-[10px] text-right text-blue-500 leading-none">
                            +{formatINR(item.qty * item.unit_price * (1 - item.discount_pct / 100) * (item.tax_pct / 100))}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hint when advance is locked */}
        {!canEnableAdvance && selectedItems.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
            <Info size={11} />
            Fields highlighted in amber need unit price &amp; GST to unlock Advance Payment.
          </p>
        )}

        {/* ── Totals ────────────────────────────────────────────────────────── */}
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
            {intrastate ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST</span>
                  <span className="font-medium">{formatINR(totals.tax / 2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST</span>
                  <span className="font-medium">{formatINR(totals.tax / 2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-muted-foreground">
                <span>IGST</span>
                <span className="font-medium">{formatINR(totals.tax)}</span>
              </div>
            )}
            {freight > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Freight Charges</span>
                <span className="font-medium">{formatINR(freight)}</span>
              </div>
            )}
            {otherCharges > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Other Charges</span>
                <span className="font-medium">{formatINR(otherCharges)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Grand Total</span>
              <span className="text-primary">{formatINR(grandWithCharges)}</span>
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
            {form.advance_payment_required && advanceAmount > 0 && (
              <div className="flex justify-between text-amber-700 border-t pt-1">
                <span>
                  Advance ({form.advance_payment_data?.advance_pct ?? form.advance_payment_pct}%
                  {form.advance_payment_data?.gst_applicable
                    ? ` + GST ${form.advance_payment_data.gst_pct}%`
                    : ''})
                </span>
                <span className="font-medium">{formatINR(advanceAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── File upload (same view / re-upload / delete control as the KYC entry screen) ── */}
        <div className="rounded-lg border border-dashed border-primary/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Paperclip size={14} />
            Quotation Document
            <span className="text-[10px] font-normal text-muted-foreground/70">
              (image or PDF, optional, max {MAX_FILE_MB}MB)
            </span>
          </div>
          <CustomInputField
            field="quotation_file"
            label="Quotation Document"
            type="file"
            value={file}
            onChange={(f: File | null) => handlePickFile(f)}
          />
          {fileError && <p className="text-[11px] text-red-500">{fileError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-primary hover:bg-primary/90">
            {submitting ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
            Submit Quotation
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Advance payment sub-dialog */}
      <AdvancePaymentDialog
        open={showAdvanceDialog}
        onOpenChange={setShowAdvanceDialog}
        totalAmount={netAfterBuyback}
        defaultTaxPct={defaultTaxPct}
        initialData={form.advance_payment_data}
        onSave={(advData: AdvancePaymentData) => {
          setForm(f => ({
            ...f,
            advance_payment_pct: advData.advance_pct,
            advance_payment_data: advData,
          }));
        }}
      />
    </Dialog>
  );
};

export default QuotationDialog;
