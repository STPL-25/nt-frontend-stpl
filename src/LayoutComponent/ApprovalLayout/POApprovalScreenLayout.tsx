import { Fragment, useMemo, useState } from 'react';
import {
  ArrowLeftCircle, ArrowRightCircle, Building2, CheckCircle2, ChevronRight, CreditCard, FileText, History,
  Layers, MapPin, Package, ShieldCheck, ShoppingCart, User, XCircle,
} from 'lucide-react';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppState } from '@/imports';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import { calcChargesTotal } from '@/Application/PurchaseOrder/PurchaseTeam/helpers';
import ApprovalActionDialog from '@/LayoutComponent/ApprovalLayout/ApprovalActionDialog';
import {
  ApprovalStepper, Callout, DecisionButtons, DetailEmptyState, DetailHero, Fact, FactGrid, Panel,
  SearchInput, SelectableCard, StatusPill, StickyActionBar,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, TONE, formatDate, formatINR, statusMeta,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

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
  /** Picks the winning quotation; only offered to an approver whose stage has can_select_quotation = 'Y'. */
  onSelectQuotation?: (quotation: any) => void;
  selectingSno?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  // items incl. GST + freight / other charges with their own GST
  return parseQuotationItems(q).reduce((s: number, i: any) => s + itemTotal(i), 0) + calcChargesTotal(q).total;
}

function getSelectedQuotation(pr: any): any | null {
  // Try nested first
  const nested = parseJSON(pr?.quotations, []);
  if (nested.length > 0) return nested.find((q: any) => q.is_selected) ?? null;
  // Flat API: the record itself is the selected quotation
  if (pr?.quotation_ref_no || pr?.sq_basic_sno) return pr;
  return null;
}

function formatAddress(addr: any): string {
  return [addr.door_no, addr.street, addr.area, addr.city, addr.taluk, addr.state, addr.pincode]
    .filter(Boolean)
    .join(', ');
}

const num = (v: any) => (parseFloat(v ?? 0) || 0).toLocaleString('en-IN');
const linkClass = 'text-primary underline-offset-2 hover:underline';

function Tag({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', TONE[tone])}>
      {children}
    </span>
  );
}

const coverName = (c: any) => (c.type === 'Other' ? c.label || 'Other' : c.type);
const coverTone = (c: any): keyof typeof TONE => (c.cost_type === 'Free' ? 'success' : c.cost_type === 'Paid' ? 'warning' : 'info');

/** Cover tags for one product; clicking a tag shows its terms & conditions (if any) right below. */
function CoverChips({ covers }: { covers: any }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!Array.isArray(covers) || covers.length === 0) return null;
  const active = openIdx != null ? covers[openIdx] : null;
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1">
        {covers.map((c: any, ci: number) => (
          <button key={ci} type="button" aria-expanded={openIdx === ci} onClick={() => setOpenIdx(openIdx === ci ? null : ci)}
            className={cn('rounded-md transition-shadow hover:shadow-sm', openIdx === ci && 'ring-1 ring-primary/50')}>
            <Tag tone={coverTone(c)}><ShieldCheck className="h-2.5 w-2.5" />{coverName(c)} {c.years}y · {c.cost_type}</Tag>
          </button>
        ))}
      </div>
      {active && (
        <p className="mt-1.5 whitespace-pre-line rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Terms &amp; conditions: </span>
          {active.terms?.trim() ? active.terms : 'No terms provided.'}
        </p>
      )}
    </div>
  );
}

const th = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

// ─── Sidebar card ─────────────────────────────────────────────────────────────

function PRListCard({ pr, isSelected, onClick }: { pr: any; isSelected: boolean; onClick: () => void }) {
  const quotations = useMemo(() => parseQuotations(pr), [pr]);
  const prItems = useMemo(() => parsePRItems(pr), [pr]);
  const selectedQ = useMemo(() => quotations.find((q: any) => q.is_selected), [quotations]);
  const total = useMemo(() => (selectedQ ? calcQuotationTotal(selectedQ) : 0), [selectedQ]);
  const status = statusMeta(AGREEMENT_STATUS, selectedQ?.status ?? 'P');

  return (
    <SelectableCard selected={isSelected} onClick={onClick}>
      <span className="flex items-start justify-between gap-2">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold">{pr.pr_no}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{pr.dept_name || selectedQ?.company_name || '—'}</span>
        </span>
        <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', isSelected ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        {pr.group != null && <Tag tone="neutral">Group {pr.group}</Tag>}
        <Tag tone="info"><Package className="h-2.5 w-2.5" />{prItems.length} item{prItems.length !== 1 ? 's' : ''}</Tag>
        <Tag tone="violet"><ShoppingCart className="h-2.5 w-2.5" />{quotations.length} quot.</Tag>
      </span>
      {pr.purpose && <span className="mt-2 line-clamp-1 block text-xs italic text-muted-foreground">“{pr.purpose}”</span>}
      {selectedQ && (
        <span className="mt-3 block space-y-1 border-t pt-2.5 text-xs">
          <span className="flex justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Selected vendor</span>
            <span className="truncate text-right font-medium">{selectedQ.company_name}</span>
          </span>
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">Total</span>
            <span className="text-right font-semibold text-primary">{formatINR(total)}</span>
          </span>
        </span>
      )}
    </SelectableCard>
  );
}

// ─── Detail sections ──────────────────────────────────────────────────────────

function ItemsTable({ children, head }: { children: React.ReactNode; head: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50"><tr>{head}</tr></thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

function PRItemsPanel({ prItems }: { prItems: any[] }) {
  return (
    <Panel icon={Package} title="Requested items" description={`${prItems.length} item${prItems.length !== 1 ? 's' : ''}`}>
      {prItems.length === 0 ? <p className="text-sm text-muted-foreground">No items found.</p> : (
        <ItemsTable head={<>
          <th className={cn(th, 'text-left')}>#</th>
          <th className={cn(th, 'text-left')}>Item</th>
          <th className={cn(th, 'text-right')}>Qty</th>
          <th className={cn(th, 'text-left')}>UOM</th>
        </>}>
          {prItems.map((item: any, idx: number) => (
            <tr key={item.pr_item_sno ?? idx}>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
              <td className="px-3 py-2.5">
                <p className="font-medium">{item.prod_name}</p>
                {item.prod_code && <p className="text-xs text-muted-foreground">{item.prod_code}</p>}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{num(item.qty)}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{item.uom_name}</td>
            </tr>
          ))}
        </ItemsTable>
      )}
    </Panel>
  );
}

function QuotationPanel({ quotation, index, onSelect, selecting }: {
  quotation: any; index: number; onSelect?: (q: any) => void; selecting?: boolean;
}) {
  const items = useMemo(() => parseQuotationItems(quotation), [quotation]);
  const advanceDetails = quotation.advance_details;
  // Only the primary address is shown (falls back to the first one when none is flagged primary).
  const kycAddresses = useMemo(() => {
    const all: any[] = parseJSON(quotation.kyc_address, []);
    const primary = all.find((a: any) => String(a.address_type).toUpperCase() === 'PRIMARY' || a.is_primary === 'Y');
    const one = primary ?? all.find((a: any) => formatAddress(a));
    return one ? [one] : [];
  }, [quotation.kyc_address]);
  const advStages = useMemo(() => parseAdvStages(advanceDetails), [advanceDetails]);

  const subTotal = items.reduce((s: number, i: any) => s + itemBase(i), 0);
  const discountTotal = items.reduce((s: number, i: any) => s + itemDiscount(i), 0);
  const taxTotal = items.reduce((s: number, i: any) => s + itemTax(i), 0);
  const itemsTotal = items.reduce((s: number, i: any) => s + itemTotal(i), 0);
  const charges = calcChargesTotal(quotation);
  const grandTotal = itemsTotal + charges.total;
  // Advance asked by the supplier: the sum of its payment stages, else the % of the grand total.
  const advPct = Number(advanceDetails?.advance_payment_pct ?? quotation.advance_payment_pct) || 0;
  const advStageSum = advStages.reduce((s: number, st: any) => s + (Number(st.amount) || 0), 0);
  const advanceAmount = advStageSum > 0 ? advStageSum : (grandTotal * advPct) / 100;
  const hasRates = items.some((i: any) => parseFloat(i.unit_price ?? 0) > 0);
  const isSelected = !!quotation.is_selected;

  return (
    <Panel
      icon={Building2}
      title={`${index + 1}. ${quotation.company_name}`}
      description={quotation.quotation_ref_no}
      className={isSelected ? 'border-primary/50 ring-1 ring-primary/20' : undefined}
      action={
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isSelected && <StatusPill tone="success">Selected</StatusPill>}
          <span className="text-sm font-bold tabular-nums text-primary">{formatINR(grandTotal)}</span>
          {onSelect && !isSelected && (
            <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" disabled={selecting} onClick={() => onSelect(quotation)}>
              {selecting ? 'Selecting…' : 'Select quotation'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <FactGrid>
          {quotation.supp_code && <Fact label="Supplier code"><span className="font-mono">{quotation.supp_code}</span></Fact>}
          {quotation.contact_person && <Fact label="Contact person">{quotation.contact_person}</Fact>}
          {quotation.mobile_number && (
            <Fact label="Mobile"><a href={`tel:${quotation.mobile_number}`} className={linkClass}>{quotation.mobile_number}</a></Fact>
          )}
          {quotation.email && (
            <Fact label="Email"><a href={`mailto:${quotation.email}`} className={cn('break-all', linkClass)}>{quotation.email}</a></Fact>
          )}
          {quotation.gst_no && <Fact label="GST no."><span className="font-mono">{quotation.gst_no}</span></Fact>}
          {quotation.pan_no && <Fact label="PAN no."><span className="font-mono">{quotation.pan_no}</span></Fact>}
          <Fact label="Quotation date">{formatDate(quotation.quotation_date)}</Fact>
          <Fact label="Valid until">{formatDate(quotation.valid_upto)}</Fact>
          {quotation.payment_terms && <Fact label="Payment terms">{quotation.payment_terms}</Fact>}
          {quotation.delivery_days != null && <Fact label="Delivery">{quotation.delivery_days} days</Fact>}
          {quotation.currency_code && <Fact label="Currency">{quotation.currency_code}</Fact>}
          {quotation.approver_name && <Fact label="Approver">{quotation.approver_name}</Fact>}
        </FactGrid>

        {kycAddresses.some((a: any) => formatAddress(a)) && (
          <div className="space-y-2">
            {kycAddresses.map((addr: any, i: number) => {
              const line = formatAddress(addr);
              return line ? (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primary address</p>
                    <p className="text-sm font-medium leading-snug">{line}</p>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        )}

        {quotation.advance_payment_required === true && (
          <Callout tone="warning" icon={CreditCard}>
            <p className="font-semibold">
              Advance payment required — {formatINR(advanceAmount)}
              {advPct > 0 && <span className="ml-1 font-normal">({advPct.toFixed(2)}% of {formatINR(grandTotal)})</span>}
            </p>
            {advanceDetails?.reason && <p className="mt-1">Reason: {advanceDetails.reason}</p>}
            {advStages.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-semibold">Payment stages</p>
                {advStages.map((stage: any, i: number) => (
                  <div key={stage.id ?? i} className="flex justify-between gap-3">
                    <span>Stage {stage.stage_no} — due in {stage.due_days} days</span>
                    <span className="font-semibold tabular-nums">{formatINR(stage.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Callout>
        )}

        {items.length > 0 && (
          <ItemsTable head={<>
            <th className={cn(th, 'text-left')}>#</th>
            <th className={cn(th, 'text-left')}>Item</th>
            <th className={cn(th, 'text-right')}>Qty</th>
            {hasRates && <>
              <th className={cn(th, 'text-right')}>Unit price</th>
              <th className={cn(th, 'text-right')}>Disc %</th>
              <th className={cn(th, 'text-right')}>GST %</th>
              <th className={cn(th, 'text-right')}>Amount</th>
            </>}
          </>}>
            {items.map((item: any, idx: number) => (
              <Fragment key={item.sq_item_sno ?? idx}>
              <tr>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{item.prod_name}</p>
                  {item.prod_code && <p className="text-xs text-muted-foreground">{item.prod_code}</p>}
                  <CoverChips covers={item.additional} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <span className="font-medium tabular-nums">{num(item.qty)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{item.uom_name}</span>
                </td>
                {hasRates && <>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatINR(parseFloat(item.unit_price ?? 0))}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{parseFloat(item.discount_pct ?? 0)}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{parseFloat(item.tax_pct ?? 0)}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{formatINR(itemTotal(item))}</td>
                </>}
              </tr>
              </Fragment>
            ))}
          </ItemsTable>
        )}

        {hasRates && (
          <dl className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sub total</dt><dd className="tabular-nums">{formatINR(subTotal)}</dd></div>
            {discountTotal > 0 && (
              <div className="flex justify-between gap-3 text-red-600 dark:text-red-400"><dt>Discount</dt><dd className="tabular-nums">− {formatINR(discountTotal)}</dd></div>
            )}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">GST</dt><dd className="tabular-nums">+ {formatINR(taxTotal)}</dd></div>
            {charges.freight > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Freight{charges.freightGst > 0 && <span className="text-xs"> (+ GST {formatINR(charges.freightGst)})</span>}</dt>
                <dd className="tabular-nums">+ {formatINR(charges.freight + charges.freightGst)}</dd>
              </div>
            )}
            {charges.other > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Other charges{charges.otherGst > 0 && <span className="text-xs"> (+ GST {formatINR(charges.otherGst)})</span>}</dt>
                <dd className="tabular-nums">+ {formatINR(charges.other + charges.otherGst)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t pt-2.5">
              <dt className="font-semibold">Grand total</dt>
              <dd className="text-lg font-bold tabular-nums text-primary">{formatINR(grandTotal)}</dd>
            </div>
          </dl>
        )}
      </div>
    </Panel>
  );
}

function HistoryPanel({ history }: { history: any[] }) {
  const ACTION_LABELS: Record<string, string> = {
    QUOTATION_SELECTION: 'Quotation selected',
    APPROVED: 'Approved', REJECTED: 'Rejected', FORWARD: 'Forwarded', FORWARDED: 'Forwarded', BACKWARD: 'Sent back',
  };
  return (
    <Panel icon={History} title="Approval history" description={`${history.length} action${history.length !== 1 ? 's' : ''}`}>
      <ol className="space-y-4">
        {history.map((entry: any, idx: number) => {
          const rejected = entry.status === 'R';
          return (
            <li key={entry.sq_history_sno ?? idx} className="flex items-start gap-3">
              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', rejected ? TONE.danger : TONE.success)}>
                {rejected ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{entry.status_by_name ?? '—'}</p>
                  {entry.action_type && <Tag tone={rejected ? 'danger' : entry.action_type === 'BACKWARD' ? 'warning' : entry.action_type === 'FORWARD' ? 'info' : 'success'}>{ACTION_LABELS[entry.action_type] ?? entry.action_type}</Tag>}
                </div>
                {entry.status_by && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{entry.status_by}</p>}
                {entry.comment && (
                  <p className={cn('mt-1.5 border-l-2 pl-2 text-xs italic text-muted-foreground', rejected ? 'border-red-300 dark:border-red-700' : 'border-emerald-300 dark:border-emerald-700')}>
                    “{entry.comment}”
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function PRDetailPanel({ pr, handleAction, onSelectQuotation, selectingSno }: {
  pr: any; handleAction: (a: string) => void; onSelectQuotation?: (q: any) => void; selectingSno?: number | null;
}) {
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const quotations = useMemo(() => parseQuotations(pr), [pr]);
  const prItems = useMemo(() => parsePRItems(pr), [pr]);
  const selectedQ = useMemo(() => quotations.find((q: any) => q.is_selected), [quotations]);
  // Before anyone has picked a quotation every quotation of the PR sits in the same workflow, so the
  // first one tells us which stages (and whether this approver may select) apply.
  const stagesSource = selectedQ ?? quotations[0];
  const stages = useMemo(() => (selectedQ ? parseStages(selectedQ) : []), [selectedQ]);
  const canSelectQuotation = useMemo(() => {
    if (!onSelectQuotation || !stagesSource) return false;
    const stage = parseStages(stagesSource).find((s: any) => s.approver_ecno === userEcno);
    return stage?.can_select_quotation === 'Y' && quotations.some((q: any) => q.approver_ecno === userEcno);
  }, [onSelectQuotation, stagesSource, quotations, userEcno]);
  const history = useMemo(() => (selectedQ ? parseHistory(selectedQ) : []), [selectedQ]);
  const total = useMemo(() => (selectedQ ? calcQuotationTotal(selectedQ) : 0), [selectedQ]);
  const currentStage = useMemo(() => stages.find((s: any) => s.approver_ecno === userEcno) ?? null, [stages, userEcno]);

  const canForward = currentStage?.can_forward === 'Y' && !!currentStage?.next_approver_ecno;
  const canBackward = currentStage?.can_backward === 'Y';
  const canAct = !!selectedQ && (selectedQ.approver_ecno === userEcno || currentStage !== null);
  const status = statusMeta(AGREEMENT_STATUS, selectedQ?.status ?? 'P');
  const org = [pr.com_name, pr.div_name, pr.brn_name].filter(Boolean).join(' › ');

  // Forward / Send back sit between Approve and Reject (same order on every approval screen).
  const onForward = canForward ? () => handleAction('forward') : undefined;
  const onSendBack = canBackward ? () => handleAction('backward') : undefined;

  return (
    <div className="@container">
      <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 @4xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-5 @4xl:col-span-2">
            <DetailHero
              icon={FileText}
              eyebrow="Purchase order approval"
              title={pr.pr_no}
              subtitle={org || pr.dept_name}
              badges={
                <>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  {pr.group != null && <Tag tone="neutral">Group {pr.group}</Tag>}
                  {selectedQ?.company_name && <Tag tone="success">{selectedQ.company_name}</Tag>}
                </>
              }
              metrics={[
                { label: 'Quotation total', value: formatINR(total), accent: true },
                { label: 'Items', value: prItems.length },
                { label: 'Quotations', value: quotations.length },
              ]}
            />

            <Panel icon={Layers} title="Requisition details">
              <FactGrid>
                <Fact label="PR no."><span className="font-mono">{pr.pr_no}</span></Fact>
                <Fact label="Created by">{pr.pr_created_by_name || '—'}</Fact>
                <Fact label="Employee no.">{pr.pr_created_by || '—'}</Fact>
                <Fact label="Department">{pr.dept_name || '—'}</Fact>
                <Fact label="Branch">{pr.brn_name || '—'}</Fact>
                <Fact label="Division">{pr.div_name || '—'}</Fact>
                <Fact label="Company">{pr.com_name || '—'}</Fact>
                <Fact label="Registered on">{formatDate(pr.reg_date)}</Fact>
                <Fact label="Required by">{formatDate(pr.required_date)}</Fact>
                {pr.purpose && <Fact label="Purpose" className="col-span-2 @xl:col-span-3">{pr.purpose}</Fact>}
              </FactGrid>
            </Panel>

            <PRItemsPanel prItems={prItems} />

            {quotations.length === 0 ? (
              <Panel icon={ShoppingCart} title="Quotations"><p className="text-sm text-muted-foreground">No quotations found.</p></Panel>
            ) : (
              <>
                {!selectedQ && (
                  <Callout tone="warning" icon={ShoppingCart}>
                    {canSelectQuotation
                      ? 'No quotation has been selected yet. Select the quotation to proceed with, then approve.'
                      : 'No quotation has been selected yet, and your stage cannot select one. Approval can continue once a quotation is selected.'}
                  </Callout>
                )}
                {quotations.map((q: any, idx: number) => (
                  <QuotationPanel
                    key={q.sq_basic_sno ?? idx}
                    quotation={q}
                    index={idx}
                    onSelect={canSelectQuotation ? onSelectQuotation : undefined}
                    selecting={selectingSno === q.sq_basic_sno}
                  />
                ))}
              </>
            )}

            {selectedQ && (
              <>
                <ApprovalStepper stages={stages} currentApproverId={selectedQ.approver_ecno} currentUserEcno={userEcno} />
                {history.length > 0 && <HistoryPanel history={history} />}
              </>
            )}
          </div>

          <div className="hidden @4xl:col-span-1 @4xl:block">
            <Panel title="Approval actions" description="Review and take action on this quotation" className="@4xl:sticky @4xl:top-5">
              <div className="space-y-4">
                {canAct ? (
                  <div className="space-y-2">
                    <DecisionButtons
                      className="flex-col"
                      approveLabel="Approve quotation"
                      rejectLabel="Reject quotation"
                      onApprove={() => handleAction('approve')}
                      onReject={() => handleAction('reject')}
                      onForward={onForward}
                      onSendBack={onSendBack}
                    />
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
                    View only — you are not the current approver
                  </p>
                )}
                <dl className="space-y-2 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd><StatusPill tone={status.tone}>{status.label}</StatusPill></dd>
                  </div>
                  {selectedQ?.quotation_ref_no && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Quotation</dt>
                      <dd className="truncate text-right font-semibold">{selectedQ.quotation_ref_no}</dd>
                    </div>
                  )}
                  {selectedQ?.approver_ecno && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Current approver</dt>
                      <dd className="truncate text-right font-semibold">{selectedQ.approver_name || selectedQ.approver_ecno}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <StickyActionBar>
        {canAct ? (
          <div className="flex flex-wrap gap-2">
            <DecisionButtons
              className="w-full @md:[&>button]:min-w-44"
              approveLabel="Approve"
              rejectLabel="Reject"
              onApprove={() => handleAction('approve')}
              onReject={() => handleAction('reject')}
              onForward={onForward}
              onSendBack={onSendBack}
            />
          </div>
        ) : (
          <p className="py-1 text-center text-xs text-muted-foreground">View only — you are not the current approver</p>
        )}
      </StickyActionBar>
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

const DIALOG_META = {
  approve: { tone: 'success', icon: CheckCircle2, title: 'Approve quotation', description: 'Optionally add a comment before approving.', confirm: 'Confirm approval', confirmIcon: CheckCircle2 },
  reject: { tone: 'danger', icon: XCircle, title: 'Reject quotation', description: 'Please provide a reason for rejection.', confirm: 'Confirm rejection', confirmIcon: XCircle },
  forward: { tone: 'info', icon: ArrowRightCircle, title: 'Forward quotation', description: 'Forward this quotation to the next approver.', confirm: 'Confirm forward', confirmIcon: ArrowRightCircle },
  backward: { tone: 'warning', icon: ArrowLeftCircle, title: 'Send back quotation', description: 'Select an approver to send this quotation back to.', confirm: 'Confirm send back', confirmIcon: ArrowLeftCircle },
} as const;

const PLACEHOLDER: Record<ActionType, string> = {
  approve: 'Any additional notes…', reject: 'Reason for rejection…',
  forward: 'Reason for forwarding…', backward: 'Reason for sending back…',
};

export default function POApprovalScreenLayout({
  approvalName, prList, selectedPR, handlePRSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, toast, backwardTarget, setBackwardTarget,
  onSelectQuotation, selectingSno,
}: POApprovalScreenLayoutProps) {
  const [search, setSearch] = useState('');
  const selectedQ = useMemo(() => (selectedPR ? getSelectedQuotation(selectedPR) : null), [selectedPR]);
  const grandTotal = useMemo(() => (selectedQ ? calcQuotationTotal(selectedQ) : 0), [selectedQ]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prList;
    return prList.filter((pr) =>
      [pr.pr_no, pr.dept_name, pr.purpose, pr.company_name].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [prList, search]);

  const currentDialogStage = useMemo(() => {
    if (!selectedQ) return null;
    return parseStages(selectedQ).find((s: any) => s.approver_ecno === selectedQ.approver_ecno) ?? null;
  }, [selectedQ]);

  const nextDialogStage = useMemo(() => {
    if (!currentDialogStage?.next_approver_ecno || !selectedQ) return null;
    return parseStages(selectedQ).find((s: any) => s.approver_ecno === currentDialogStage.next_approver_ecno) ?? null;
  }, [currentDialogStage, selectedQ]);

  // Send-back targets: approvers of earlier stages in the workflow; if the stage list has none (e.g. the
  // current approver is first), fall back to whoever already acted in the history. Never the caller.
  const { userData } = useAppState();
  const userEcno = userData[0]?.ecno ?? userData[0]?.login_id;
  const backTargets = useMemo(() => {
    if (!selectedQ) return [] as { ecno: string; name: string; note: string }[];
    const stages = parseStages(selectedQ);
    const history = parseHistory(selectedQ);
    const nameOf = (ecno: string) =>
      history.find((h: any) => h.status_by === ecno)?.status_by_name ?? stages.find((s: any) => s.approver_ecno === ecno)?.approver_name ?? ecno;
    const myIdx = stages.findIndex((s: any) => s.approver_ecno === userEcno);
    const seen = new Set<string>();
    const out: { ecno: string; name: string; note: string }[] = [];
    const add = (ecno: any, note: string) => {
      if (!ecno || ecno === userEcno || seen.has(ecno)) return;
      seen.add(ecno);
      out.push({ ecno, name: nameOf(ecno), note });
    };
    (myIdx > 0 ? stages.slice(0, myIdx) : []).forEach((s: any) => add(s.approver_ecno, s.stage || 'Earlier stage'));
    history
      .filter((h: any) => ['APPROVED', 'FORWARD', 'FORWARDED'].includes(h.action_type) || h.status === 'A')
      .forEach((h: any) => add(h.status_by, 'Previously acted'));
    return out;
  }, [selectedQ, userEcno]);
  const meta = DIALOG_META[actionType];

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={prList.length}
        sidebarCountLabel="PO"
        toast={toast}
        listItems={(closeSheet) => (
          <>
            <div className="sticky top-0 z-10 -mx-2 -mt-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
              <SearchInput value={search} onChange={setSearch} placeholder="Search PR, department…" />
            </div>
            {filteredList.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'No matches found' : 'No pending items for approval'}
              </p>
            ) : (
              filteredList.map((pr: any) => (
                <PRListCard
                  key={pr.pr_no}
                  pr={pr}
                  isSelected={selectedPR?.pr_no === pr.pr_no}
                  onClick={() => { handlePRSelect(pr); closeSheet(); }}
                />
              ))
            )}
          </>
        )}
        hasSelection={!!selectedPR}
        detailContent={selectedPR ? <PRDetailPanel pr={selectedPR} handleAction={handleAction} onSelectQuotation={onSelectQuotation} selectingSno={selectingSno} /> : null}
        emptyContent={
          <DetailEmptyState
            branded
            icon={ShoppingCart}
            title={prList.length === 0 ? 'Nothing waiting on you' : 'No PO selected'}
            description={prList.length === 0
              ? 'Selected quotations routed to you for approval will show up here.'
              : 'Pick a requisition from the list to review its quotations and take action.'}
          />
        }
        mobileListLabel="PO list"
        mobileSelectionTitle={selectedPR?.pr_no}
      />

      <ApprovalActionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        tone={meta.tone}
        icon={meta.icon}
        title={meta.title}
        description={meta.description}
        summary={selectedPR && selectedQ ? [
          { label: 'PR no.', value: selectedPR.pr_no },
          { label: 'Quotation no.', value: selectedQ.quotation_ref_no },
          { label: 'Vendor', value: selectedQ.company_name },
          { label: 'Total amount', value: <span className="text-primary">{formatINR(grandTotal)}</span> },
        ] : undefined}
        commentsRequired={actionType === 'reject'}
        commentsPlaceholder={PLACEHOLDER[actionType]}
        comments={comments}
        setComments={setComments}
        loading={loading}
        disabled={(actionType === 'reject' && !comments.trim()) || (actionType === 'backward' && !backwardTarget)}
        onSubmit={handleSubmit}
        confirmLabel={meta.confirm}
        confirmIcon={meta.confirmIcon}
      >
        {actionType === 'approve' && (
          <Callout tone="success" icon={CheckCircle2}>
            This quotation will proceed to the next approval stage; at the final stage the purchase order is issued to the vendor.
          </Callout>
        )}

        {actionType === 'forward' && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', TONE.info)}>
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Forwarding to</p>
              <p className="truncate text-sm font-bold">{currentDialogStage?.next_approver_ecno ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{nextDialogStage?.stage ?? 'Next stage'}</p>
            </div>
          </div>
        )}

        {actionType === 'backward' && (
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Select approver to send back to <span className="text-destructive">*</span></Label>
            {backTargets.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">There is no earlier approver to send this back to.</p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {backTargets.map((t) => (
                  <label
                    key={t.ecno}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors',
                      backwardTarget === t.ecno ? 'border-primary/60 bg-primary/5' : 'hover:border-primary/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="backward-target"
                      value={t.ecno}
                      checked={backwardTarget === t.ecno}
                      onChange={() => setBackwardTarget(t.ecno)}
                      className="shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{t.ecno}</span> · {t.note}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </ApprovalActionDialog>
    </>
  );
}
