import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Search, Users, Plus, Loader2, ClipboardCheck, RefreshCw,
  Eye, CheckCircle2, Package, ChevronDown, ChevronUp,
  FileText, Download, X,
  ShoppingCart,
} from 'lucide-react';
import { useVendorFields, useQuotationItemFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Vendor, Quotation, POGroup, POConfirmItem } from './types';
import { formatDate, formatINR, getPRDisplayNo, getQuotationTotal } from './helpers';

const API_BASE = import.meta.env.VITE_API_URL || '';

function resolveFileUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}/${path.replace(/^\//, '')}`;
}

function isImage(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path);
}

// ── File viewer dialog ────────────────────────────────────────────────────────
// Fetches the file as a blob (with auth cookies) so X-Frame-Options and
// cross-origin restrictions don't block display.
const FileViewerDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}> = ({ open, onClose, fileUrl, fileName }) => {
  const img = isImage(fileUrl);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!open || !fileUrl) return;
    let objectUrl: string;
    setLoading(true);
    setFetchError(false);
    setBlobUrl(null);
    axios
      .get(fileUrl, { responseType: 'blob', withCredentials: true })
      .then(res => {
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, fileUrl]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-muted/40">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 truncate">
            <FileText size={15} className="shrink-0 text-primary" />
            <span className="truncate">{fileName}</span>
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {blobUrl && (
              <a href={blobUrl} download={fileName}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Download size={13} /> Download
                </Button>
              </a>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
        </DialogHeader>

        <div className="w-full flex items-center justify-center" style={{ height: '75vh' }}>
          {loading && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Loading file…</span>
            </div>
          )}
          {fetchError && (
            <p className="text-sm text-destructive">Failed to load file. Check your connection or permissions.</p>
          )}
          {blobUrl && !loading && (
            img ? (
              <div className="flex items-center justify-center h-full w-full bg-muted/20 p-4">
                <img
                  src={blobUrl}
                  alt={fileName}
                  className="max-h-full max-w-full object-contain rounded shadow"
                />
              </div>
            ) : (
              <iframe
                src={blobUrl}
                title={fileName}
                className="w-full h-full border-0"
              />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Colour palette (mirrors POConfirmStep) ───────────────────────────────────
const GROUP_COLORS = [
  { bg: 'bg-primary/10',  text: 'text-primary',  border: 'border-primary/20',  badge: 'bg-primary'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-500'  },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  badge: 'bg-purple-600'  },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    badge: 'bg-pink-500'    },
];
const gc = (g: number) => GROUP_COLORS[(g - 1) % GROUP_COLORS.length];

interface QuotationsTabProps {
  selectedPR: PRRecord | null;
  vendors: Vendor[];
  loadingVendors: boolean;
  existingQuotations: Quotation[];
  loadingQuotations: boolean;
  onOpenQuotation?: (vendor: Vendor, splitGroup?: number) => void;
  onSelectQuotation?: (q: Quotation) => void;
  onCreatePO?: (q: Quotation) => void;
  onCompare: () => void;
  onRefreshQuotations: () => void;
  poGroups?: POGroup[];
  /** Groups derived from POConfirmStep split selections */
  confirmedSplitGroups?: Array<{ groupNum: number; items: POConfirmItem[] }>;
  /** Unsplit remainder — items that stay on the main PO */
  mainPOItems?: POConfirmItem[];
}

// ── Quotation card (shared) ───────────────────────────────────────────────────
const QuotationCard: React.FC<{
  q: Quotation;
  viewQuotItemFields: any[];
  onSelect?: (q: Quotation) => void;
  onCreatePO?: (q: Quotation) => void;
}> = ({ q, viewQuotItemFields, onSelect, onCreatePO }) => {
  const total = getQuotationTotal(q.items);
  const isSelected = q.is_selected === 'Y';
  const [fileOpen, setFileOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(true);

  const tableFields = viewQuotItemFields.filter((f: any) => f.field !== 'unit_name');

  const fileUrl = q.sq_quotation_file ? resolveFileUrl(q.sq_quotation_file) : '';
  const fileName = q.sq_quotation_file
    ? q.sq_quotation_file.split('/').pop() ?? q.sq_quotation_file
    : '';

  return (
    <>
      {fileUrl && (
        <FileViewerDialog
          open={fileOpen}
          onClose={() => setFileOpen(false)}
          fileUrl={fileUrl}
          fileName={fileName}
        />
      )}
      <Card className={`overflow-hidden border transition-colors ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
          : 'border-border bg-card hover:border-muted-foreground/30'
      }`}>
        {/* Header */}
        <div className={`px-4 py-3 flex flex-col gap-3 border-b sm:flex-row sm:items-start sm:justify-between ${
          isSelected ? 'bg-emerald-100/60 dark:bg-emerald-900/20' : 'bg-muted/20'
        }`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">
                {q.vendor_name || q.company_name}
              </span>
              {isSelected && (
                <Badge variant="outline" className="text-[11px] font-medium text-emerald-700 border-emerald-300 bg-emerald-50 gap-1">
                  <CheckCircle2 size={10} /> Selected
                </Badge>
              )}
            </div>

            {/* Meta info — label / value rows */}
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {q.quotation_ref_no && (
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Reference</dt>
                  <dd className="text-xs font-medium text-foreground truncate">{q.quotation_ref_no}</dd>
                </div>
              )}
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Quote Date</dt>
                <dd className="text-xs font-medium text-foreground truncate">{formatDate(q.quotation_date) || '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Valid Until</dt>
                <dd className="text-xs font-medium text-foreground truncate">{formatDate(q.valid_upto) || '—'}</dd>
              </div>
              {q.delivery_days && (
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Delivery</dt>
                  <dd className="text-xs font-medium text-foreground truncate">
                    {q.delivery_days} day{Number(q.delivery_days) !== 1 ? 's' : ''}
                  </dd>
                </div>
              )}
              {q.payment_terms && (
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Payment Terms</dt>
                  <dd className="text-xs font-medium text-foreground truncate">{q.payment_terms}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Total + actions */}
          <div className="flex flex-col gap-2 sm:items-end sm:shrink-0 sm:text-right">
            <div className="sm:border-l sm:pl-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Total Amount</div>
              <div className="text-lg font-semibold tabular-nums text-foreground leading-tight">{formatINR(total)}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              {fileUrl && (
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1 flex-1 sm:flex-none" onClick={() => setFileOpen(true)}>
                  <FileText size={11} />
                  {isImage(fileUrl) ? 'Image' : 'PDF'}
                </Button>
              )}
              {!isSelected && onSelect && (
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1 sm:flex-none" onClick={() => onSelect(q)}>
                  <CheckCircle2 size={11} className="mr-1" /> Select
                </Button>
              )}
              {/* {onCreatePO && (
                <Button size="sm" className="text-xs h-7 flex-1 sm:flex-none" onClick={() => onCreatePO(q)}>
                  <Package size={11} className="mr-1" /> Generate PO
                </Button>
              )} */}
            </div>
          </div>
        </div>

        {/* Items section */}
        {q.items.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2 bg-background">
              <button
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => setItemsOpen(v => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <ShoppingCart size={12} />
                  Items
                  <Badge variant="secondary" className="text-xs h-4 px-1.5 font-medium">{q.items.length}</Badge>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  {itemsOpen ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Show</>}
                </span>
              </button>

              {itemsOpen && (
                <div className="mt-2 rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs py-2 w-6 text-center">#</TableHead>
                        {tableFields.map((f: any) => (
                          <TableHead
                            key={f.field}
                            className={`text-xs py-2 whitespace-nowrap ${
                              f.field === 'qty' ? 'text-center' : f.type === 'number' ? 'text-right' : ''
                            }`}
                          >
                            {f.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {q.items.map((it, iIdx) => {
                        const rowTotal = it.total_amount || it.qty * it.unit_price;
                        return (
                          <TableRow key={iIdx} className={iIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <TableCell className="text-xs text-center text-muted-foreground py-2 font-medium">{iIdx + 1}</TableCell>
                            {tableFields.map((f: any) => {
                              const val = (it as any)[f.field];
                              if (f.field === 'qty') {
                                return (
                                  <TableCell key={f.field} className="text-xs text-center whitespace-nowrap py-2 font-medium">
                                    {it.qty}{it.unit_name ? ` ${it.unit_name}` : ''}
                                  </TableCell>
                                );
                              }
                              if (f.field === 'unit_price') {
                                return <TableCell key={f.field} className="text-xs text-right font-medium whitespace-nowrap py-2">{formatINR(val)}</TableCell>;
                              }
                              if (f.field === 'total_amount') {
                                return (
                                  <TableCell key={f.field} className="text-xs text-right font-semibold whitespace-nowrap py-2 text-foreground">
                                    {formatINR(rowTotal)}
                                  </TableCell>
                                );
                              }
                              if (f.field === 'discount_pct' || f.field === 'tax_pct') {
                                return <TableCell key={f.field} className="text-xs text-right py-2">{val ?? 0}%</TableCell>;
                              }
                              return <TableCell key={f.field} className="text-xs py-2">{val ?? '—'}</TableCell>;
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>

                  {/* Items footer total */}
                  <div className="flex items-center justify-end gap-2 px-3 py-2 bg-muted/30 border-t">
                    <span className="text-xs text-muted-foreground">Grand Total</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{formatINR(total)}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
};

// ── Per-group panel (manages its own vendor search) ───────────────────────────
const GroupPanel: React.FC<{
  label: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  items: POConfirmItem[];
  vendors: Vendor[];
  loadingVendors: boolean;
  quotations: Quotation[];
  loadingQuotations: boolean;
  splitGroup: number;         // 0 = main PO (ungrouped)
  viewVendorFields: any[];
  viewQuotItemFields: any[];
  onAddQuotation?: (vendor: Vendor, splitGroup: number) => void;
  onSelectQuotation?: (q: Quotation) => void;
  onCreatePO?: (q: Quotation) => void;
}> = ({
  label, badgeClass, borderClass, bgClass, textClass,
  items, vendors, loadingVendors, quotations, loadingQuotations, splitGroup,
  viewVendorFields, viewQuotItemFields,
  onAddQuotation, onSelectQuotation, onCreatePO,
}) => {
  const [search, setSearch] = useState('');
  const [itemsOpen, setItemsOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, search]);

  const getVendorFieldValue = (vendor: Vendor, field: string): string => {
    if (field === 'company_name') return vendor.company_name ?? vendor.vendor_name ?? '—';
    if (field === 'mobile_number') return vendor.mobile_number ?? vendor.mobile ?? vendor.phone ?? vendor.email ?? '—';
    return (vendor as any)[field] ?? '—';
  };

  return (
    <Card className={`border ${borderClass}`}>
      <CardHeader className={`pb-3 ${bgClass} rounded-t-lg`}>
        <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${textClass}`}>
          <Badge className={`${badgeClass} text-white border-none text-xs`}>{label}</Badge>
          <span className="text-foreground font-medium">{items.length} item(s) → separate PO</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 ml-auto text-xs text-muted-foreground"
            onClick={() => setItemsOpen(v => !v)}
          >
            {itemsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {itemsOpen ? 'Hide' : 'Show'} items
          </Button>
        </CardTitle>

        {/* Items list (collapsible) */}
        {itemsOpen && (
          <div className="mt-2 space-y-1">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-card/60 rounded px-2 py-1 border border-white">
                <span className="text-muted-foreground/70 w-4 shrink-0">{i + 1}.</span>
                <span className="font-medium text-foreground">{it.prod_name}</span>
                <span className="text-muted-foreground ml-auto shrink-0">{it.qty} {it.unit_name}</span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        {/* Vendor search + table */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Users size={12} /> Select Supplier &amp; Add Quotation
          </p>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
          {loadingVendors ? (
            <div className="flex items-center gap-2 text-muted-foreground/70 py-3 justify-center">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs">Loading vendors…</span>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {viewVendorFields.map((f: any) => (
                      <TableHead key={f.field} className="text-xs py-1.5">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs w-24 py-1.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 15).map(v => (
                    <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno} className="hover:bg-primary/10/50">
                      {viewVendorFields.map((f: any) => (
                        <TableCell key={f.field} className={`text-xs py-1.5 ${f.field === 'company_name' ? 'font-medium' : 'text-muted-foreground'}`}>
                          {getVendorFieldValue(v, f.field)}
                        </TableCell>
                      ))}
                      <TableCell className="py-1.5">
                        {onAddQuotation && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => onAddQuotation(v, splitGroup)}
                          >
                            <Plus size={11} className="mr-1" /> Quote
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Quotations for this group */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <ClipboardCheck size={12} /> Quotations
            <Badge variant="outline" className="text-xs ml-1">{quotations.length}</Badge>
          </p>
          {loadingQuotations ? (
            <div className="flex items-center gap-2 text-muted-foreground/70 py-3 justify-center">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : quotations.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 text-center py-3">
              No quotations yet for this group. Add one using a supplier above.
            </p>
          ) : (
            <div className="space-y-2">
              {quotations.map(q => (
                <QuotationCard
                  key={q.sq_basic_sno}
                  q={q}
                  viewQuotItemFields={viewQuotItemFields}
                  onSelect={onSelectQuotation}
                  onCreatePO={onCreatePO}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const QuotationsTab: React.FC<QuotationsTabProps> = ({
  selectedPR, vendors, loadingVendors,
  existingQuotations, loadingQuotations,
  onOpenQuotation, onSelectQuotation, onCreatePO,
  onCompare, onRefreshQuotations,
  poGroups = [],
  confirmedSplitGroups = [],
  mainPOItems = [],
}) => {
  const vendorFields = useVendorFields();
  const quotationItemFields = useQuotationItemFields();
  const [searchVendor, setSearchVendor] = useState('');

  const viewVendorFields = vendorFields.filter((f: any) => f.view);
  const viewQuotItemFields = quotationItemFields.filter((f: any) => f.view);

  const filteredVendors = useMemo(() => {
    const q = searchVendor.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, searchVendor]);

  const getVendorFieldValue = (vendor: Vendor, field: string): string => {
    if (field === 'company_name') return vendor.company_name ?? vendor.vendor_name ?? '—';
    if (field === 'mobile_number') return vendor.mobile_number ?? vendor.mobile ?? vendor.phone ?? vendor.email ?? '—';
    return (vendor as any)[field] ?? '—';
  };

  const displayLabel = selectedPR ? getPRDisplayNo(selectedPR) : 'Selected';
  const prNo = selectedPR ? getPRDisplayNo(selectedPR) : '';

  // ── Quotations filtered per confirmed split group ─────────────────────────
  const quotationsForGroup = (groupNum: number) =>
    existingQuotations.filter(q =>
      q.split_group !== undefined
        ? q.split_group === groupNum
        : groupNum === 0   // fallback: ungrouped quotations appear in "Main PO"
    );

  const ungroupedQuotations = existingQuotations.filter(q => !q.split_group);

  // Main PO items (items with no split_group)
  const hasConfirmedGroups = confirmedSplitGroups.length > 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE A — confirmed split groups from POConfirmStep
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasConfirmedGroups) {
    // "Main PO" quotations = quotations with no split_group set.

    return (
      <div className="space-y-4">
        {/* Per-group panels */}
        {confirmedSplitGroups.map(({ groupNum, items }) => {
          const col = gc(groupNum);
          return (
            <GroupPanel
              key={groupNum}
              label={`${prNo} / Group ${groupNum}`}
              badgeClass={col.badge}
              borderClass={col.border}
              bgClass={col.bg}
              textClass={col.text}
              items={items}
              vendors={vendors}
              loadingVendors={loadingVendors}
              quotations={quotationsForGroup(groupNum)}
              loadingQuotations={loadingQuotations}
              splitGroup={groupNum}
              viewVendorFields={viewVendorFields}
              viewQuotItemFields={viewQuotItemFields}
              onAddQuotation={onOpenQuotation ? (vendor, sg) => onOpenQuotation(vendor, sg) : undefined}
              onSelectQuotation={onSelectQuotation}
              onCreatePO={onCreatePO}
            />
          );
        })}

        {/* Main PO panel — unsplit remainder + any ungrouped quotations */}
        {(mainPOItems.length > 0 || ungroupedQuotations.length > 0) && (
          <GroupPanel
            label="Main PO"
            badgeClass="bg-muted/400"
            borderClass="border-border"
            bgClass="bg-muted/40"
            textClass="text-foreground"
            items={mainPOItems}
            vendors={vendors}
            loadingVendors={loadingVendors}
            quotations={ungroupedQuotations}
            loadingQuotations={loadingQuotations}
            splitGroup={0}
            viewVendorFields={viewVendorFields}
            viewQuotItemFields={viewQuotItemFields}
            onAddQuotation={onOpenQuotation ? (vendor, sg) => onOpenQuotation(vendor, sg) : undefined}
            onSelectQuotation={onSelectQuotation}
            onCreatePO={onCreatePO}
          />
        )}

        {/* Refresh + Compare */}
        <div className="flex justify-end gap-2">
          {existingQuotations.length >= 2 && (
            <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
              <Eye size={14} className="mr-1" /> Compare All
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={onRefreshQuotations} disabled={loadingQuotations}>
            <RefreshCw size={14} className={loadingQuotations ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE B — poGroups from SplitPRTab (legacy split flow)
  // ═══════════════════════════════════════════════════════════════════════════
  if (poGroups.length > 0) {
    return (
      <div className="space-y-4">
        {poGroups.map((group, gIdx) => {
          const groupVendor = vendors.find(v =>
            (v.kyc_basic_info_sno ?? v.vendor_sno) === group.vendorSno
          );
          const groupQuotations = existingQuotations.filter(q => q.vendor_sno === group.vendorSno);

          return (
            <Card key={group.id} className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground border-none">{prNo}/{gIdx + 1}</Badge>
                    <span className="text-foreground">
                      {group.vendorName ?? <span className="text-amber-600 italic font-normal">No vendor assigned</span>}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground/70">• {group.items.length} item(s)</span>
                  </CardTitle>
                  {groupVendor && onOpenQuotation && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onOpenQuotation(groupVendor)}>
                      <Plus size={12} className="mr-1" /> Add Quotation
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingQuotations ? (
                  <div className="flex items-center gap-2 text-muted-foreground/70 py-4 justify-center">
                    <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading...</span>
                  </div>
                ) : groupQuotations.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70 text-center py-3">
                    No quotations yet.{!groupVendor && ' Assign a vendor via Split to add quotations.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {groupQuotations.map(q => (
                      <QuotationCard key={q.sq_basic_sno} q={q} viewQuotItemFields={viewQuotItemFields} onSelect={onSelectQuotation} onCreatePO={onCreatePO} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        <div className="flex justify-end gap-2">
          {existingQuotations.length >= 2 && (
            <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
              <Eye size={14} className="mr-1" /> Compare All
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={onRefreshQuotations} disabled={loadingQuotations}>
            <RefreshCw size={14} className={loadingQuotations ? 'animate-spin mr-1' : 'mr-1'} /> Refresh
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE C — standard (no split groups)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users size={16} className="text-green-600" />
            Assign Supplier &amp; Add Quotation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Search vendors by name, GST..."
              value={searchVendor}
              onChange={e => setSearchVendor(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {loadingVendors ? (
            <div className="flex items-center gap-2 text-muted-foreground/70 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading vendors...</span>
            </div>
          ) : filteredVendors.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 text-center py-4">No vendors found</p>
          ) : (
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {viewVendorFields.map((f: any) => (
                      <TableHead key={f.field} className="text-xs">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.slice(0, 20).map(v => (
                    <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno} className="hover:bg-muted/40">
                      {viewVendorFields.map((f: any) => (
                        <TableCell key={f.field} className={`text-${f.field === 'company_name' ? 'sm font-medium' : 'xs text-muted-foreground'}`}>
                          {getVendorFieldValue(v, f.field)}
                        </TableCell>
                      ))}
                      <TableCell>
                        {onOpenQuotation && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenQuotation(v)}>
                            <Plus size={12} className="mr-1" /> Quote
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck size={16} className="text-purple-600" />
              Quotations for {displayLabel}
              <Badge variant="outline" className="text-xs ml-1">{existingQuotations.length}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              {existingQuotations.length >= 2 && (
                <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
                  <Eye size={14} className="mr-1" /> Compare
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs" onClick={onRefreshQuotations} disabled={loadingQuotations}>
                <RefreshCw size={14} className={loadingQuotations ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingQuotations ? (
            <div className="flex items-center gap-2 text-muted-foreground/70 py-6 justify-center">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading quotations...</span>
            </div>
          ) : existingQuotations.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-muted-foreground/70 gap-2">
              <ClipboardCheck size={28} />
              <p className="text-sm">No quotations yet. Assign a supplier above to add one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {existingQuotations.map(q => (
                <QuotationCard key={q.sq_basic_sno} q={q} viewQuotItemFields={viewQuotItemFields} onSelect={onSelectQuotation} onCreatePO={onCreatePO} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotationsTab;
