import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Eye, FileText, Download, X, Loader2, ImageIcon, FileX,
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useQuotationCompareFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Quotation } from './types';
import { formatDate, formatINR, getPRItems, getQuotationTotal } from './helpers';

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
const FileViewerDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  vendorName?: string;
}> = ({ open, onClose, fileUrl, fileName, vendorName }) => {
  const img = isImage(fileUrl);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !fileUrl) return;
    let objectUrl: string;
    setLoading(true);
    setFetchError(false);
    setBlobUrl(null);
    setZoom(1);
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

  // reset on close
  useEffect(() => { if (!open) { setExpanded(false); setZoom(1); } }, [open]);

  // wheel zoom for images
  const handleWheel = (e: React.WheelEvent) => {
    if (!img || !blobUrl) return;
    e.preventDefault();
    setZoom(z => Math.min(5, Math.max(0.25, z - e.deltaY * 0.001)));
  };

  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className={`p-0 overflow-hidden flex flex-col transition-all duration-300 ${
          expanded
            ? 'max-w-[98vw] w-[98vw] h-[97vh]'
            : 'max-w-5xl w-[90vw] h-[88vh]'
        }`}
        style={{ maxHeight: expanded ? '97vh' : '88vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-gradient-to-r from-primary/8 via-background to-background">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 shrink-0">
              {img
                ? <ImageIcon size={16} className="text-primary" />
                : <FileText size={16} className="text-primary" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">{fileName}</p>
              {vendorName && (
                <p className="text-[10px] text-muted-foreground truncate">{vendorName}</p>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] font-mono shrink-0 px-1.5 py-0 border-primary/30 text-primary">
              {ext}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* zoom controls — images only */}
            {img && blobUrl && (
              <div className="flex items-center gap-0.5 mr-1 bg-muted/60 rounded-md px-1 py-0.5">
                <Button
                  size="icon" variant="ghost"
                  className="h-6 w-6 hover:bg-background/80"
                  onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                  title="Zoom out"
                >
                  <ZoomOut size={12} />
                </Button>
                <span className="text-[11px] font-mono w-10 text-center text-muted-foreground select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  size="icon" variant="ghost"
                  className="h-6 w-6 hover:bg-background/80"
                  onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))}
                  title="Zoom in"
                >
                  <ZoomIn size={12} />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  className="h-6 w-6 hover:bg-background/80"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                >
                  <RotateCcw size={11} />
                </Button>
              </div>
            )}

            {/* download */}
            {blobUrl && (
              <a href={blobUrl} download={fileName}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 px-2.5">
                  <Download size={12} /> Download
                </Button>
              </a>
            )}

            {/* expand / collapse */}
            <Button
              size="icon" variant="ghost"
              className="h-7 w-7"
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Collapse' : 'Expand to fullscreen'}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>

            {/* close */}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* ── Content area ── */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-auto relative ${img ? 'bg-[#1a1a2e]' : 'bg-background'}`}
          onWheel={img ? handleWheel : undefined}
        >
          {/* loading */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30 backdrop-blur-sm z-10">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 shadow-lg">
                <Loader2 size={26} className="animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Loading {ext} file</p>
                <p className="text-xs text-muted-foreground mt-0.5">Please wait…</p>
              </div>
            </div>
          )}

          {/* error */}
          {fetchError && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10">
                <AlertCircle size={26} className="text-destructive" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Failed to load file</p>
                <p className="text-xs text-muted-foreground mt-1">Check your connection or permissions.</p>
              </div>
              <Button size="sm" variant="outline" className="text-xs mt-1" onClick={() => {
                setFetchError(false);
                setLoading(true);
                axios.get(fileUrl, { responseType: 'blob', withCredentials: true })
                  .then(res => setBlobUrl(URL.createObjectURL(res.data)))
                  .catch(() => setFetchError(true))
                  .finally(() => setLoading(false));
              }}>
                Try again
              </Button>
            </div>
          )}

          {/* image viewer */}
          {blobUrl && !loading && img && (
            <div
              className="min-h-full min-w-full flex items-center justify-center p-6"
              style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
            >
              <img
                src={blobUrl}
                alt={fileName}
                draggable={false}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease',
                  maxWidth: zoom <= 1 ? '100%' : 'none',
                  maxHeight: zoom <= 1 ? '100%' : 'none',
                  borderRadius: '6px',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                  userSelect: 'none',
                }}
              />
            </div>
          )}

          {/* PDF / other viewer */}
          {blobUrl && !loading && !img && (
            <iframe
              src={blobUrl}
              title={fileName}
              className="w-full h-full border-0"
              style={{ minHeight: '100%' }}
            />
          )}
        </div>

        {/* ── Footer hint for images ── */}
        {img && blobUrl && (
          <div className="shrink-0 px-4 py-1.5 border-t bg-muted/30 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Scroll to zoom · Use buttons for finer control</span>
            <span className="text-[10px] text-muted-foreground font-mono">{Math.round(zoom * 100)}% zoom</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── File card per vendor ──────────────────────────────────────────────────────
const VendorFileCard: React.FC<{ q: Quotation }> = ({ q }) => {
  const [open, setOpen] = useState(false);
  const rawPath = q.sq_quotation_file ?? '';
  const fileUrl = rawPath ? resolveFileUrl(rawPath) : '';
  const fileName = rawPath ? (rawPath.split('/').pop() ?? rawPath) : '';
  const img = fileUrl ? isImage(fileUrl) : false;
  const vendorName = q.vendor_name || q.company_name;

  return (
    <>
      {fileUrl && (
        <FileViewerDialog
          open={open}
          onClose={() => setOpen(false)}
          fileUrl={fileUrl}
          fileName={fileName}
          vendorName={vendorName}
        />
      )}
      <div className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card min-w-0">
        <div
          className={`w-14 h-14 rounded-md flex items-center justify-center ${
            fileUrl ? 'bg-primary/10 border border-primary/20' : 'bg-muted/40 border border-dashed border-muted-foreground/20'
          }`}
        >
          {fileUrl ? (
            img ? <ImageIcon size={24} className="text-primary" /> : <FileText size={24} className="text-primary" />
          ) : (
            <FileX size={22} className="text-muted-foreground/40" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[100px] truncate">
          {fileUrl ? fileName : 'No attachment'}
        </span>
        {fileUrl ? (
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 w-full" onClick={() => setOpen(true)}>
            <Eye size={10} /> {img ? 'View Image' : 'View PDF'}
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 italic">—</span>
        )}
      </div>
    </>
  );
};

// ── Main dialog ───────────────────────────────────────────────────────────────
interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotations: Quotation[];
  selectedPR: PRRecord | null;
  onSelectQuotation?: (q: Quotation) => Promise<void>;
}

const CompareDialog: React.FC<CompareDialogProps> = ({
  open, onOpenChange, quotations, selectedPR, onSelectQuotation,
}) => {
  const compareFields = useQuotationCompareFields();
  const viewFields = compareFields.filter(f => f.view);
  const [selectingId, setSelectingId] = useState<number | null>(null);

  const handleSelect = async (q: Quotation) => {
    if (!onSelectQuotation || !q.sq_basic_sno) return;
    setSelectingId(q.sq_basic_sno);
    try {
      await onSelectQuotation(q);
    } finally {
      setSelectingId(null);
    }
  };

  const getFieldValue = (q: Quotation, field: string) => {
    if (field === 'total_amount') return getQuotationTotal(q.items);
    if (field === 'valid_upto' || field === 'quotation_date') return formatDate((q as any)[field]);
    return (q as any)[field] ?? '—';
  };

  const allTotals = quotations.map(q => getQuotationTotal(q.items));
  const minTotal = Math.min(...allTotals);

  const anyFile = quotations.some(q => !!q.sq_quotation_file);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye size={17} className="text-primary" />
            Compare Quotations
            <Badge variant="secondary" className="text-xs font-medium ml-1">{quotations.length} vendors</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* ── Attached files strip ─────────────────────────────────────── */}
          {anyFile && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <FileText size={13} className="text-primary" />
                Quotation Attachments
              </p>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${quotations.length}, minmax(0, 1fr))` }}
              >
                {quotations.map(q => {
                  const isSel = q.is_selected === 'Y';
                  return (
                    <div
                      key={q.sq_basic_sno}
                      className={`flex flex-col gap-1 rounded-lg p-1 transition-colors ${isSel ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}`}
                    >
                      <p className={`text-[10px] font-semibold text-center truncate px-1 ${isSel ? 'text-emerald-700' : 'text-foreground'}`}>
                        {q.vendor_name || q.company_name}
                      </p>
                      <VendorFileCard q={q} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Comparison table ─────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <Eye size={13} className="text-primary" />
              Price &amp; Terms Comparison
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold w-44 py-3">Parameter</TableHead>
                    {quotations.map(q => {
                      const isSel = q.is_selected === 'Y';
                      return (
                        <TableHead
                          key={q.sq_basic_sno}
                          className={`text-xs font-semibold text-center py-3 border-b-2 transition-colors ${
                            isSel
                              ? 'bg-emerald-50 border-b-emerald-500'
                              : 'border-b-transparent'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            {isSel && (
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm">
                                <CheckCircle2 size={13} />
                              </span>
                            )}
                            <span className={`font-semibold ${isSel ? 'text-emerald-700' : ''}`}>
                              {q.vendor_name || q.company_name}
                            </span>
                            {isSel && (
                              <Badge className="text-[9px] bg-emerald-500 text-white border-none font-medium px-2 py-0 rounded-full">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {/* Dynamic parameter rows */}
                  {viewFields.map((field, fIdx) => (
                    <TableRow key={field.field} className={fIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <TableCell className="text-xs font-medium text-muted-foreground py-2.5">{field.label}</TableCell>
                      {quotations.map((q, qIdx) => {
                        const isSel = q.is_selected === 'Y';
                        const val = getFieldValue(q, field.field);
                        const isTotal = field.field === 'total_amount';
                        const isLowest = isTotal && allTotals[qIdx] === minTotal;
                        return (
                          <TableCell
                            key={q.sq_basic_sno}
                            className={[
                              'text-xs text-center py-2.5 transition-colors',
                              isTotal ? 'font-bold text-sm' : '',
                              isLowest ? 'text-emerald-700 bg-emerald-100/70' : '',
                              !isLowest && isSel ? 'bg-emerald-50/60' : '',
                            ].join(' ')}
                          >
                            {isTotal ? formatINR(val as number) : val}
                            {isLowest && (
                              <span className="block text-[9px] font-semibold text-emerald-600 mt-0.5">Lowest</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}

                  {/* Per-item price rows */}
                  {getPRItems(selectedPR).map((prItem, prIdx) => (
                    <TableRow key={prIdx} className="border-t border-primary/10">
                      <TableCell className="text-xs text-muted-foreground py-2.5 pl-4 bg-primary/5">
                        <span className="text-[9px] text-muted-foreground/60 block mb-0.5">Item Price</span>
                        {prItem.prod_name ?? prItem.item_name}
                      </TableCell>
                      {quotations.map(q => {
                        const isSel = q.is_selected === 'Y';
                        const matchItem = q.items.find(it =>
                          it.prod_sno === prItem.prod_sno || it.prod_name === prItem.prod_name
                        );
                        const prices = quotations.map(qq => {
                          const m = qq.items.find(it => it.prod_sno === prItem.prod_sno || it.prod_name === prItem.prod_name);
                          return m?.unit_price ?? Infinity;
                        });
                        const isLowest = matchItem && matchItem.unit_price === Math.min(...prices);
                        return (
                          <TableCell
                            key={q.sq_basic_sno}
                            className={[
                              'text-xs text-center py-2.5 transition-colors',
                              isLowest ? 'text-emerald-700 font-semibold bg-emerald-100/70' : '',
                              !isLowest && isSel ? 'bg-emerald-50/60' : 'bg-primary/5',
                            ].join(' ')}
                          >
                            {matchItem ? formatINR(matchItem.unit_price) : '—'}
                            {isLowest && (
                              <span className="block text-[9px] font-semibold text-emerald-600 mt-0.5">Lowest</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}

                  {/* Select row */}
                  {onSelectQuotation && (
                    <TableRow className="border-t-2 border-muted">
                      <TableCell className="text-xs font-semibold text-muted-foreground py-3 bg-muted/30">
                        Select Vendor
                      </TableCell>
                      {quotations.map(q => {
                        const isSel = q.is_selected === 'Y';
                        const isSelecting = selectingId === q.sq_basic_sno;
                        return (
                          <TableCell
                            key={q.sq_basic_sno}
                            className={`text-center py-3 transition-colors ${isSel ? 'bg-emerald-50' : 'bg-muted/30'}`}
                          >
                            {isSel ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold shadow-sm">
                                <CheckCircle2 size={13} />
                                Selected
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                                disabled={isSelecting || !!selectingId}
                                onClick={() => handleSelect(q)}
                              >
                                {isSelecting
                                  ? <><Loader2 size={11} className="animate-spin" /> Selecting…</>
                                  : <><CheckCircle2 size={11} /> Select</>}
                              </Button>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/20 sticky bottom-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompareDialog;
