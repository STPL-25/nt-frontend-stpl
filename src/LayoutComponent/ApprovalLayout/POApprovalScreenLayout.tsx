import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2, XCircle, Clock, FileText, ChevronRight,
  Package, GitBranch, History, ShoppingCart,
  CreditCard, Layers, Building2, Phone, Mail, Hash, MapPin,
  ArrowRightCircle, ArrowLeftCircle, User,
} from 'lucide-react';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';

type ActionType = 'approve' | 'reject' | 'forward' | 'backward';

interface POApprovalScreenLayoutProps {
  approvalName: string;
  prList: any[];
  selectedPR: any;
  handlePRSelect: (pr: any) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  action: string;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: ActionType;
  fieldDatas: FieldType[];
  toast?: { message: string; type: 'success' | 'error' } | null;
  backwardTarget: string;
  setBackwardTarget: (ecno: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  P: 'Pending', A: 'Approved', R: 'Rejected', D: 'Draft',
};

function getStatusLabel(s: any): string {
  return STATUS_MAP[String(s ?? '').toUpperCase()] ?? String(s ?? 'Pending');
}

function formatDate(d: string) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function formatINR(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function itemBase(item: any): number {
  return (parseFloat(item.qty ?? 0) || 0) * (parseFloat(item.unit_price ?? 0) || 0);
}
function itemDiscount(item: any): number {
  return itemBase(item) * ((parseFloat(item.discount_pct ?? 0) || 0) / 100);
}
function itemTaxable(item: any): number { return itemBase(item) - itemDiscount(item); }
function itemTax(item: any): number {
  return itemTaxable(item) * ((parseFloat(item.tax_pct ?? 0) || 0) / 100);
}
function itemTotal(item: any): number {
  const explicit = parseFloat(item.total_amount ?? 0) || 0;
  return explicit > 0 ? explicit : itemTaxable(item) + itemTax(item);
}

function parseJSON(raw: any, fallback: any = []): any {
  if (!raw) return fallback;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function parseQuotations(pr: any): any[] {
  // Try nested quotations array (future-proof)
  const nested = parseJSON(pr?.quotations, []);
  if (nested.length > 0) return nested;
  // Flat API: each record IS the selected quotation
  if (pr?.quotation_ref_no || pr?.sq_basic_sno) return [{ ...pr, is_selected: true }];
  return [];
}
function parsePRItems(pr: any): any[] { return parseJSON(pr?.original_pr_item_details ?? pr?.pr_item_details, []); }
function parseQuotationItems(q: any): any[] { return parseJSON(q?.quotation_item_details, []); }
function parseStages(q: any): any[] { return parseJSON(q?.stage_order_json, []); }
function parseHistory(q: any): any[] { return parseJSON(q?.quotation_history ?? q?.pr_history_data, []); }
function parseAdvStages(ad: any): any[] { return parseJSON(ad?.adv_issue_stages, []); }

function calcQuotationTotal(q: any): number {
  return parseQuotationItems(q).reduce((s: number, i: any) => s + itemTotal(i), 0);
}

function getSelectedQuotation(pr: any): any | null {
  // Try nested first
  const nested = parseJSON(pr?.quotations, []);
  if (nested.length > 0) return nested.find((q: any) => q.is_selected) ?? null;
  // Flat API: the record itself is the selected quotation
  if (pr?.quotation_ref_no || pr?.sq_basic_sno) return pr;
  return null;
}

// ─── PR List Card ─────────────────────────────────────────────────────────────

function PRListCard({ pr, isSelected, onClick }: {
  pr: any; isSelected: boolean; onClick: () => void;
}) {
  const quotations = useMemo(() => parseQuotations(pr), [pr]);
  const prItems = useMemo(() => parsePRItems(pr), [pr]);
  const selectedQ = useMemo(() => quotations.find((q: any) => q.is_selected), [quotations]);
  const total = useMemo(() => selectedQ ? calcQuotationTotal(selectedQ) : 0, [selectedQ]);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-50">{pr.pr_no}</p>
              {pr.group != null && (
                <Badge variant="secondary" className="text-xs">Group {pr.group}</Badge>
              )}
            </div>
            {pr.dept_name && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{pr.dept_name}</p>
            )}
          </div>
          <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>

        {(pr.brn_name || pr.div_name) && (
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Layers className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{[pr.div_name, pr.brn_name].filter(Boolean).join(' · ')}</span>
          </div>
        )}

        {pr.purpose && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic">"{pr.purpose}"</p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Package className="h-3 w-3 mr-1" />{prItems.length} item{prItems.length !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <ShoppingCart className="h-3 w-3 mr-1" />{quotations.length} quot.
          </Badge>
        </div>

        {selectedQ && (
          <>
            <Separator />
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />Selected
                </span>
                <span className="font-medium truncate text-right max-w-[120px]">{selectedQ.company_name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-green-600 dark:text-green-400">{formatINR(total)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PR Items Table ───────────────────────────────────────────────────────────

function PRItemsTable({ prItems }: { prItems: any[] }) {
  if (!prItems.length) return <p className="text-sm text-slate-500 text-center py-4">No items found</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-400">
          <tr>
            <th className="text-left p-2 sm:p-3">#</th>
            <th className="text-left p-2 sm:p-3">Item</th>
            <th className="text-right p-2 sm:p-3">Qty</th>
            <th className="text-left p-2 sm:p-3">UOM</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {prItems.map((item: any, idx: number) => (
            <tr key={item.pr_item_sno ?? idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <td className="p-2 sm:p-3 text-slate-400">{idx + 1}</td>
              <td className="p-2 sm:p-3">
                <p className="font-medium">{item.prod_name}</p>
                {item.prod_code && <p className="text-slate-500">{item.prod_code}</p>}
              </td>
              <td className="p-2 sm:p-3 text-right font-medium">
                {parseFloat(item.qty ?? 0).toLocaleString('en-IN')}
              </td>
              <td className="p-2 sm:p-3 text-slate-500">{item.uom_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Quotation Card ───────────────────────────────────────────────────────────

function formatAddress(addr: any): string {
  return [addr.door_no, addr.street, addr.area, addr.city, addr.taluk, addr.state, addr.pincode]
    .filter(Boolean)
    .join(', ');
}

function QuotationCard({ quotation, index }: { quotation: any; index: number }) {
  const items = useMemo(() => parseQuotationItems(quotation), [quotation]);
  const advanceDetails = quotation.advance_details;
  const kycAddresses = useMemo(() => parseJSON(quotation.kyc_address, []), [quotation.kyc_address]);
  const advStages = useMemo(() => parseAdvStages(advanceDetails), [advanceDetails]);

  const subTotal = items.reduce((s: number, i: any) => s + itemBase(i), 0);
  const discountTotal = items.reduce((s: number, i: any) => s + itemDiscount(i), 0);
  const taxTotal = items.reduce((s: number, i: any) => s + itemTax(i), 0);
  const grandTotal = items.reduce((s: number, i: any) => s + itemTotal(i), 0);
  const hasRates = items.some((i: any) => parseFloat(i.unit_price ?? 0) > 0);
  const isSelected = !!quotation.is_selected;

  const metaRows = [
    { label: 'Quotation Date', value: formatDate(quotation.quotation_date) },
    { label: 'Valid Until', value: formatDate(quotation.valid_upto) },
    { label: 'Payment Terms', value: quotation.payment_terms },
    { label: 'Delivery Days', value: quotation.delivery_days != null ? `${quotation.delivery_days} days` : null },
    { label: 'Currency', value: quotation.currency_code },
    { label: 'Approver', value: quotation.approver_name },
  ].filter(r => r.value && r.value !== '—');

  return (
    <Card className={`shadow-sm ${
      isSelected
        ? 'border-2 border-green-400 dark:border-green-600'
        : 'border-slate-200 dark:border-slate-800'
    }`}>
      <CardHeader className={`p-4 pb-3 ${isSelected ? 'bg-green-50 dark:bg-green-950/20' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-bold">
                {index + 1}. {quotation.quotation_ref_no}
              </CardTitle>
              {isSelected && (
                <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />Selected
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
              {quotation.company_name}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">Grand Total</p>
            <p className={`text-base font-bold ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {formatINR(grandTotal)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Vendor details */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800">
            <Building2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vendor Details</p>
            {quotation.supp_code && (
              <span className="ml-auto text-xs font-mono text-slate-400">{quotation.supp_code}</span>
            )}
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {quotation.contact_person && (
              <div className="flex items-start gap-1.5">
                <Hash className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-slate-400">Contact Person</p>
                  <p className="font-semibold">{quotation.contact_person}</p>
                </div>
              </div>
            )}
            {quotation.mobile_number && (
              <div className="flex items-start gap-1.5">
                <Phone className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-slate-400">Mobile</p>
                  <p className="font-semibold">{quotation.mobile_number}</p>
                </div>
              </div>
            )}
            {quotation.email && (
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <Mail className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-slate-400">Email</p>
                  <p className="font-semibold break-all">{quotation.email}</p>
                </div>
              </div>
            )}
            {quotation.gst_no && (
              <div className="flex items-start gap-1.5">
                <Hash className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-slate-400">GST No</p>
                  <p className="font-semibold font-mono">{quotation.gst_no}</p>
                </div>
              </div>
            )}
            {quotation.pan_no && (
              <div className="flex items-start gap-1.5">
                <Hash className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-slate-400">PAN No</p>
                  <p className="font-semibold font-mono">{quotation.pan_no}</p>
                </div>
              </div>
            )}
            {kycAddresses.length > 0 && (
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <MapPin className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 w-full">
                  <p className="text-slate-400">Address{kycAddresses.length > 1 ? 'es' : ''}</p>
                  {kycAddresses.map((addr: any, i: number) => {
                    const line = formatAddress(addr);
                    return line ? (
                      <div key={i}>
                        {addr.address_type && (
                          <span className="inline-block text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded mb-0.5">
                            {addr.address_type}
                          </span>
                        )}
                        <p className="font-semibold leading-snug">{line}</p>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Meta grid */}
        {metaRows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {metaRows.map(r => (
              <div key={r.label} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <p className="text-xs text-slate-500">{r.label}</p>
                <p className="text-xs font-semibold mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Advance payment */}
        {quotation.advance_payment_required === true && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Advance Payment Required — {(advanceDetails?.advance_payment_pct ?? quotation.advance_payment_pct)?.toFixed?.(2) ?? quotation.advance_payment_pct}%
              </p>
            </div>
            {advanceDetails && (
              <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1 pl-6">
                {advanceDetails.reason && <p>Reason: {advanceDetails.reason}</p>}
                {advStages.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="font-semibold">Payment Stages:</p>
                    {advStages.map((stage: any, i: number) => (
                      <div key={stage.id ?? i} className="flex justify-between">
                        <span>Stage {stage.stage_no} — due in {stage.due_days} days</span>
                        <span className="font-semibold">{formatINR(stage.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Items table */}
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Item</th>
                  <th className="text-right p-2">Qty</th>
                  {hasRates && <>
                    <th className="text-right p-2">Unit Price</th>
                    <th className="text-right p-2">Disc%</th>
                    <th className="text-right p-2">Tax%</th>
                    <th className="text-right p-2">Amount</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item: any, idx: number) => (
                  <tr key={item.sq_item_sno ?? idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="p-2 text-slate-400">{idx + 1}</td>
                    <td className="p-2">
                      <p className="font-medium">{item.prod_name}</p>
                      {item.prod_code && <p className="text-slate-500">{item.prod_code}</p>}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <span className="font-medium">{parseFloat(item.qty ?? 0).toLocaleString('en-IN')}</span>
                      <span className="text-slate-500 ml-1">{item.uom_name}</span>
                    </td>
                    {hasRates && <>
                      <td className="p-2 text-right whitespace-nowrap">{formatINR(parseFloat(item.unit_price ?? 0))}</td>
                      <td className="p-2 text-right whitespace-nowrap text-orange-600 dark:text-orange-400">{parseFloat(item.discount_pct ?? 0)}%</td>
                      <td className="p-2 text-right whitespace-nowrap text-blue-600 dark:text-blue-400">{parseFloat(item.tax_pct ?? 0)}%</td>
                      <td className="p-2 text-right font-semibold whitespace-nowrap">{formatINR(itemTotal(item))}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        {hasRates && (
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Sub Total</span><span>{formatINR(subTotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-orange-600 dark:text-orange-400">
                  <span>Discount</span><span>- {formatINR(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>Tax</span><span>{formatINR(taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-green-600 dark:text-green-400 text-sm">
                <span>Grand Total</span><span>{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Approval Stages (horizontal stepper) ─────────────────────────────────────

function ApprovalStages({ stages, currentApproverEcno }: { stages: any[]; currentApproverEcno?: string }) {
  if (!stages.length) return null;
  const currentIdx = stages.findIndex((s: any) => s.approver_ecno === currentApproverEcno);
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />Approval Workflow
          <Badge variant="secondary" className="text-xs">{stages.length} stage{stages.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 pb-6">
        <div className="relative flex items-start">
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />
          {stages.map((stage: any, idx: number) => {
            const isCurrent = stage.approver_ecno === currentApproverEcno;
            const isPast = currentIdx >= 0 && idx < currentIdx;
            return (
              <div key={idx} className="relative flex flex-col items-center flex-1 z-10 gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm ${
                  isPast
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400'
                }`}>
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="text-center px-1">
                  <p className={`text-xs font-semibold leading-tight ${
                    isCurrent ? 'text-blue-700 dark:text-blue-400'
                    : isPast ? 'text-green-700 dark:text-green-400'
                    : 'text-slate-500'
                  }`}>{stage.stage ?? `Stage ${idx + 1}`}</p>
                  {isCurrent && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                      Current
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── History Timeline ─────────────────────────────────────────────────────────

function HistoryTimeline({ history }: { history: any[] }) {
  if (!history.length) return null;
  const ACTION_LABELS: Record<string, string> = {
    QUOTATION_SELECTION: 'Quotation Selected',
    APPROVED: 'Approved', REJECTED: 'Rejected', FORWARDED: 'Forwarded',
  };
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />Approval History
          <Badge variant="secondary" className="text-xs">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="relative ml-1">
          {history.length > 1 && (
            <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700" />
          )}
          <div className="space-y-3">
            {history.map((entry: any, idx: number) => {
              const isRejected = entry.status === 'R';
              return (
                <div key={entry.sq_history_sno ?? idx} className="relative flex gap-3">
                  <div className={`relative z-10 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${
                    isRejected
                      ? 'bg-red-100 dark:bg-red-900/40 border-2 border-red-300 dark:border-red-600'
                      : 'bg-green-100 dark:bg-green-900/40 border-2 border-green-300 dark:border-green-600'
                  }`}>
                    {isRejected
                      ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                      : <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {entry.status_by_name ?? '—'}
                      </p>
                      <span className="text-xs text-slate-400 font-mono">{entry.status_by}</span>
                    </div>
                    {entry.action_type && (
                      <p className={`text-xs font-medium mt-0.5 ${
                        isRejected ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {ACTION_LABELS[entry.action_type] ?? entry.action_type}
                      </p>
                    )}
                    {entry.comment && (
                      <p className="text-xs text-slate-500 mt-1 italic border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                        {entry.comment}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PR Detail Panel ──────────────────────────────────────────────────────────

function PRDetailPanel({ pr, handleAction }: {
  pr: any; handleAction: (a: string) => void;
}) {
  const { userData } = useAppState();
  const quotations = useMemo(() => parseQuotations(pr), [pr]);
  const prItems = useMemo(() => parsePRItems(pr), [pr]);
  const selectedQ = useMemo(() => quotations.find((q: any) => q.is_selected), [quotations]);
  const stages = useMemo(() => selectedQ ? parseStages(selectedQ) : [], [selectedQ]);
  const history = useMemo(() => selectedQ ? parseHistory(selectedQ) : [], [selectedQ]);
  const currentStage = useMemo(
    () => stages.find((s: any) => s.approver_ecno === userData[0]?.ecno) ?? null,
    [stages, userData]
  );
  const canForward = currentStage?.can_forward === 'Y' && !!currentStage?.next_approver_ecno;
  const canBackward = currentStage?.can_backward === 'Y';

  const prInfoRows = [
    { label: 'PR No', value: pr.pr_no },
    { label: 'Created By', value: pr.pr_created_by_name },
    { label: 'Employee No', value: pr.pr_created_by },
    { label: 'Department', value: pr.dept_name },
    { label: 'Branch', value: pr.brn_name },
    { label: 'Division', value: pr.div_name },
    { label: 'Company', value: pr.com_name },
    { label: 'Purpose', value: pr.purpose },
    { label: 'Reg. Date', value: formatDate(pr.reg_date) },
    { label: 'Required Date', value: formatDate(pr.required_date) },
  ].filter(r => r.value && r.value !== '—');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-4 sm:px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50">{pr.pr_no}</h1>
              {pr.group != null && <Badge variant="secondary" className="text-xs">Group {pr.group}</Badge>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs text-slate-500">
              {pr.dept_name && <span>{pr.dept_name}</span>}
              {pr.brn_name && <><span>·</span><span>{pr.brn_name}</span></>}
              {selectedQ && (
                <><span>·</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{selectedQ.company_name}</span></>
              )}
            </div>
          </div>
          {selectedQ && (
            <Badge variant="outline" className="text-xs shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />{getStatusLabel(selectedQ.status)}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Tabs defaultValue="overview">
          <TabsList className="w-full mb-5">
            <TabsTrigger value="overview" className="flex-1 text-xs sm:text-sm">PR Info</TabsTrigger>
            <TabsTrigger value="quotations" className="flex-1 text-xs sm:text-sm">
              Quotations ({quotations.length})
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex-1 text-xs sm:text-sm">
              Workflow
            </TabsTrigger>
          </TabsList>

          {/* PR Info tab */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            <Card className="shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 pb-3">
                {(pr.com_name || pr.div_name || pr.brn_name) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                    {[pr.com_name, pr.div_name, pr.brn_name].filter(Boolean).join(' › ')}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {prInfoRows.map(r => (
                    <div key={r.label} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{r.label}</p>
                      <p className="text-sm font-semibold mt-0.5">{r.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />Requested Items
                  <Badge variant="secondary" className="text-xs">{prItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <PRItemsTable prItems={prItems} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quotations tab */}
          <TabsContent value="quotations" className="mt-0 space-y-4">
            {quotations.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No quotations found</p>
            ) : (
              quotations.map((q: any, idx: number) => (
                <QuotationCard key={q.sq_basic_sno ?? idx} quotation={q} index={idx} />
              ))
            )}
          </TabsContent>

          {/* Workflow tab */}
          <TabsContent value="workflow" className="mt-0 space-y-4">
            {selectedQ ? (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                  Workflow for selected quotation:
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedQ.quotation_ref_no}
                  </span>
                  <span>({selectedQ.company_name})</span>
                </div>
                <ApprovalStages stages={stages} currentApproverEcno={selectedQ.approver_ecno} />
                <HistoryTimeline history={history} />
              </>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No selected quotation</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Action footer */}
      {selectedQ && (selectedQ.approver_ecno === userData[0]?.ecno || currentStage !== null) ? (
        <div className="flex-shrink-0 border-t bg-background px-4 sm:px-6 py-3 shadow-[0_-1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_-1px_4px_rgba(0,0,0,0.3)]">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleAction('approve')}
              className="flex-1 h-10 text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />Approve
            </Button>
            <Button onClick={() => handleAction('reject')} variant="destructive" className="flex-1 h-10 text-sm">
              <XCircle className="mr-1.5 h-4 w-4" />Reject
            </Button>
            {canForward && (
              <Button
                onClick={() => handleAction('forward')}
                variant="outline"
                className="flex-1 h-10 text-sm border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
              >
                <ArrowRightCircle className="mr-1.5 h-4 w-4" />Forward
              </Button>
            )}
            {canBackward && (
              <Button
                onClick={() => handleAction('backward')}
                variant="outline"
                className="flex-1 h-10 text-sm border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
              >
                <ArrowLeftCircle className="mr-1.5 h-4 w-4" />Send Back
              </Button>
            )}
          </div>
        </div>
      ) : selectedQ ? (
        <div className="flex-shrink-0 border-t bg-background px-4 sm:px-6 py-3">
          <p className="text-xs text-muted-foreground text-center">View only — you are not the current approver</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function PREmptyState() {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-3">
        <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 dark:text-slate-700 mx-auto" />
        <h3 className="text-lg sm:text-xl font-semibold text-slate-600 dark:text-slate-400">No PR Selected</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
          Select a purchase requisition from the list to view its quotations and take action
        </p>
      </div>
    </div>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function POApprovalScreenLayout({
  approvalName, prList, selectedPR, handlePRSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, toast, backwardTarget, setBackwardTarget,
}: POApprovalScreenLayoutProps) {
  const selectedQ = useMemo(() => selectedPR ? getSelectedQuotation(selectedPR) : null, [selectedPR]);
  const grandTotal = useMemo(() => selectedQ ? calcQuotationTotal(selectedQ) : 0, [selectedQ]);

  const currentDialogStage = useMemo(() => {
    if (!selectedQ) return null;
    const stages = parseStages(selectedQ);
    return stages.find((s: any) => s.approver_ecno === selectedQ.approver_ecno) ?? null;
  }, [selectedQ]);

  const nextDialogStage = useMemo(() => {
    if (!currentDialogStage?.next_approver_ecno || !selectedQ) return null;
    const stages = parseStages(selectedQ);
    return stages.find((s: any) => s.approver_ecno === currentDialogStage.next_approver_ecno) ?? null;
  }, [currentDialogStage, selectedQ]);

  const dialogHistory = useMemo(() => selectedQ ? parseHistory(selectedQ) : [], [selectedQ]);

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={prList.length}
        sidebarCountLabel="PR"
        toast={toast}
        listItems={(closeSheet) =>
          prList.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No pending items for approval</p>
          ) : (
            prList.map((pr: any) => (
              <PRListCard
                key={pr.pr_no}
                pr={pr}
                isSelected={selectedPR?.pr_no === pr.pr_no}
                onClick={() => { handlePRSelect(pr); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!selectedPR}
        detailContent={selectedPR ? <PRDetailPanel pr={selectedPR} handleAction={handleAction} /> : null}
        emptyContent={<PREmptyState />}
        mobileListLabel="PR List"
        mobileSelectionTitle={selectedPR?.pr_no}
      />

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {actionType === 'approve' && <><CheckCircle2 className="h-5 w-5 text-green-600" />Approve Quotation</>}
              {actionType === 'reject'  && <><XCircle className="h-5 w-5 text-red-600" />Reject Quotation</>}
              {actionType === 'forward' && <><ArrowRightCircle className="h-5 w-5 text-blue-600" />Forward Quotation</>}
              {actionType === 'backward' && <><ArrowLeftCircle className="h-5 w-5 text-amber-600" />Send Back Quotation</>}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {actionType === 'approve'  && 'Optionally add a comment before approving.'}
              {actionType === 'reject'   && 'Please provide a reason for rejection.'}
              {actionType === 'forward'  && 'Forward this quotation to the next approver.'}
              {actionType === 'backward' && 'Select an approver to send this quotation back to.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {actionType === 'approve' && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-100">Confirming Approval</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  This quotation will proceed to the next approval stage.
                </p>
              </div>
            )}

            {actionType === 'forward' && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Forwarding to</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                      {currentDialogStage?.next_approver_ecno ?? '—'}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {nextDialogStage?.stage ?? 'Next Stage'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {actionType === 'backward' && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Select approver to send back to <span className="text-red-500">*</span></Label>
                {dialogHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No previous approvers found in history.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {dialogHistory.map((entry: any, idx: number) => (
                      <label
                        key={entry.status_by ?? idx}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          backwardTarget === entry.status_by
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="backward-target"
                          value={entry.status_by}
                          checked={backwardTarget === entry.status_by}
                          onChange={() => setBackwardTarget(entry.status_by)}
                          className="accent-amber-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{entry.status_by_name ?? entry.status_by}</p>
                          <p className="text-xs text-slate-500 font-mono">{entry.status_by}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sq-comments" className="text-xs sm:text-sm">
                Comments {actionType === 'reject' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="sq-comments"
                placeholder={
                  actionType === 'approve'  ? 'Any additional notes…'
                  : actionType === 'forward'  ? 'Reason for forwarding…'
                  : actionType === 'backward' ? 'Reason for sending back…'
                  : 'Reason for rejection…'
                }
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            {selectedPR && selectedQ && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">PR No</span>
                  <span className="font-semibold">{selectedPR.pr_no}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Quotation No</span>
                  <span className="font-semibold">{selectedQ.quotation_ref_no}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Vendor</span>
                  <span className="font-semibold truncate ml-4">{selectedQ.company_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Total Amount</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatINR(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={loading}
              className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                loading
                || (actionType === 'reject' && !comments.trim())
                || (actionType === 'backward' && !backwardTarget)
              }
              className={`w-full sm:w-auto text-sm ${
                actionType === 'approve'  ? 'bg-green-600 hover:bg-green-700'
                : actionType === 'reject'   ? 'bg-red-600 hover:bg-red-700'
                : actionType === 'forward'  ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {loading ? (
                <><Clock className="mr-2 h-4 w-4 animate-spin" />Processing…</>
              ) : actionType === 'approve' ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm Approval</>
              ) : actionType === 'reject' ? (
                <><XCircle className="mr-2 h-4 w-4" />Confirm Rejection</>
              ) : actionType === 'forward' ? (
                <><ArrowRightCircle className="mr-2 h-4 w-4" />Confirm Forward</>
              ) : (
                <><ArrowLeftCircle className="mr-2 h-4 w-4" />Confirm Send Back</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
