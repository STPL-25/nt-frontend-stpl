import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/utils/statusUtils';
import { PageHeader } from '@/CustomComponent/PageComponents';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClipboardCheck, PackageCheck, PackageX, Clock, CheckCircle2, Send, Eye, AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';

import useFetch from '@/hooks/useFetchHook';
import { purchaseTeamGetApprovedPRs } from '@/Services/Api';

// ── Data model ───────────────────────────────────────────────────────────────
// PR header + items come from the real approved-PR feed (GET /getApprovedPRs).
// Issuing / forwarding is still simulated client-side only (current_stock is
// mocked, and issue/forward actions never write back to the server) — there's
// no store-inventory or store-issue API yet to persist against.

interface StoreApprovalItem {
  item_sno: number;
  item_code: string;
  item_name: string;
  uom: string;
  requested_qty: number;
  issued_qty: number;
  forwarded_qty: number;
  /** Mock live stock — decremented locally as items are issued. */
  current_stock: number;
}

interface StoreApprovalPR {
  pr_sno: number;
  pr_no: string;
  requested_by: string;
  dept_name: string;
  branch_name: string;
  approved_on: string;
  items: StoreApprovalItem[];
}

interface PurchaseQueueEntry {
  id: string;
  pr_no: string;
  item_name: string;
  item_code: string;
  uom: string;
  qty: number;
  forwarded_on: string;
}

// ── Raw /getApprovedPRs response shape ──────────────────────────────────────
// Loosely typed — this endpoint was built for the Purchase Team screen, so
// field presence varies (joined/flat rows vs. a pr_item_details JSON blob).

interface RawPRItem {
  pr_item_sno?: number;
  prod_sno?: number;
  prod_code?: string;
  prod_name?: string;
  item_name?: string;
  qty?: number;
  quantity?: number;
  unit_name?: string;
  uom_name?: string;
  uom_code?: string;
}

interface RawPR {
  pr_basic_sno?: number;
  pr_no?: string;
  pr_id?: string | number;
  dept_name?: string;
  brn_name?: string;
  div_name?: string;
  com_name?: string;
  created_by_name?: string;
  entered_by?: string;
  created_by?: string;
  approved_date?: string;
  reg_date?: string;
  request_date?: string;
  req_date?: string;
  pr_item_details?: string | RawPRItem[];
  items?: string | RawPRItem[];
}

function parseRawItems(raw?: string | RawPRItem[]): RawPRItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Mock stock only — /getApprovedPRs carries no inventory data. Deterministic
 * per item (not random) so numbers stay stable across re-renders; replace
 * with a real stock lookup once a store-inventory API exists.
 */
function mockStockFor(itemSno: number, requestedQty: number): number {
  const bucket = ((itemSno % 5) + 5) % 5;
  if (bucket === 0) return 0;
  if (bucket === 1) return Math.floor(requestedQty * 0.4);
  return requestedQty + (itemSno % 20);
}

function mapApprovedPR(raw: RawPR, index: number): StoreApprovalPR {
  const rawItems = parseRawItems(raw.pr_item_details ?? raw.items);
  return {
    pr_sno: raw.pr_basic_sno ?? index,
    pr_no: raw.pr_no ?? `PR-${raw.pr_basic_sno ?? raw.pr_id ?? index}`,
    requested_by: raw.created_by_name ?? raw.entered_by ?? raw.created_by ?? '—',
    dept_name: raw.dept_name ?? '—',
    branch_name: raw.brn_name ?? raw.div_name ?? raw.com_name ?? '—',
    approved_on: raw.approved_date ?? raw.reg_date ?? raw.request_date ?? raw.req_date ?? '—',
    items: rawItems.map((it, i) => {
      const itemSno = Number(it.pr_item_sno ?? it.prod_sno ?? i);
      const requestedQty = Number(it.qty ?? it.quantity ?? 0);
      return {
        item_sno: itemSno,
        item_code: it.prod_code ?? '',
        item_name: it.prod_name ?? it.item_name ?? 'Unnamed item',
        uom: it.unit_name ?? it.uom_name ?? it.uom_code ?? '',
        requested_qty: requestedQty,
        issued_qty: 0,
        forwarded_qty: 0,
        current_stock: mockStockFor(itemSno, requestedQty),
      };
    }),
  };
}

const STATUS_FILTERS = ['Pending', 'Partially Issued', 'Issued', 'Forwarded to Purchase'] as const;

// ── Derivation helpers ───────────────────────────────────────────────────────

const pendingQty = (i: StoreApprovalItem) => i.requested_qty - i.issued_qty - i.forwarded_qty;

function lineStatus(i: StoreApprovalItem): string {
  const pending = pendingQty(i);
  if (pending > 0) return 'Pending';
  if (i.forwarded_qty === 0) return 'Issued';
  if (i.issued_qty === 0) return 'Forwarded to Purchase';
  return 'Partial Issue + Forwarded';
}

function prStatus(pr: StoreApprovalPR): string {
  const statuses = pr.items.map(lineStatus);
  if (statuses.every(s => s === 'Pending')) return 'Pending';
  if (statuses.some(s => s === 'Pending')) return 'Partially Issued';
  if (statuses.every(s => s === 'Issued')) return 'Issued';
  return 'Forwarded to Purchase';
}

const totalRequested = (pr: StoreApprovalPR) => pr.items.reduce((s, i) => s + i.requested_qty, 0);
const totalIssued = (pr: StoreApprovalPR) => pr.items.reduce((s, i) => s + i.issued_qty, 0);

const StoreInchargeApprovalPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading: fetchLoading, error } = useFetch(purchaseTeamGetApprovedPRs, '', null, refreshKey);

  const [prs, setPrs] = useState<StoreApprovalPR[]>([]);
  const [purchaseQueue, setPurchaseQueue] = useState<PurchaseQueueEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('Pending');

  const [selectedSno, setSelectedSno] = useState<number | null>(null);
  const [issueQty, setIssueQty] = useState<Record<number, number>>({});

  useEffect(() => {
    const rows: RawPR[] = (data as any)?.decrypted?.data ?? (data as any)?.data ?? [];
    setPrs(rows.map(mapApprovedPR));
  }, [data]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const selected = useMemo(
    () => prs.find(p => p.pr_sno === selectedSno) ?? null,
    [prs, selectedSno],
  );

  const filtered = useMemo(
    () => (statusFilter === 'all' ? prs : prs.filter(p => prStatus(p) === statusFilter)),
    [prs, statusFilter],
  );

  const stats = useMemo(() => ({
    pending: prs.filter(p => prStatus(p) === 'Pending').length,
    partial: prs.filter(p => prStatus(p) === 'Partially Issued').length,
    issued: prs.filter(p => prStatus(p) === 'Issued').length,
    forwarded: prs.filter(p => prStatus(p) === 'Forwarded to Purchase').length,
  }), [prs]);

  const openDetail = (pr: StoreApprovalPR) => {
    setSelectedSno(pr.pr_sno);
    setIssueQty(Object.fromEntries(
      pr.items
        .filter(i => pendingQty(i) > 0)
        .map(i => [i.item_sno, Math.min(pendingQty(i), i.current_stock)]),
    ));
  };

  const closeDetail = () => setSelectedSno(null);

  const actionable = selected ? prStatus(selected) !== 'Issued' && prStatus(selected) !== 'Forwarded to Purchase' : false;

  const handleProcess = () => {
    if (!selected) return;

    let issuedLines = 0;
    let forwardedLines = 0;
    const newQueueEntries: PurchaseQueueEntry[] = [];

    const updatedItems = selected.items.map(item => {
      const pending = pendingQty(item);
      if (pending <= 0) return item;

      const requestedIssue = Math.min(issueQty[item.item_sno] ?? 0, pending, item.current_stock);
      const shortfall = pending - requestedIssue;

      if (requestedIssue > 0) issuedLines += 1;
      if (shortfall > 0) {
        forwardedLines += 1;
        newQueueEntries.push({
          id: `${selected.pr_no}-${item.item_sno}-${Date.now()}`,
          pr_no: selected.pr_no,
          item_name: item.item_name,
          item_code: item.item_code,
          uom: item.uom,
          qty: shortfall,
          forwarded_on: new Date().toISOString().slice(0, 16).replace('T', ' '),
        });
      }

      return {
        ...item,
        issued_qty: item.issued_qty + requestedIssue,
        forwarded_qty: item.forwarded_qty + shortfall,
        current_stock: item.current_stock - requestedIssue,
      };
    });

    if (issuedLines === 0 && forwardedLines === 0) {
      toast.error('Nothing to process — set an issue quantity or check stock');
      return;
    }

    setPrs(prev => prev.map(p => (p.pr_sno === selected.pr_sno ? { ...p, items: updatedItems } : p)));
    if (newQueueEntries.length) setPurchaseQueue(prev => [...newQueueEntries, ...prev]);

    const parts: string[] = [];
    if (issuedLines) parts.push(`${issuedLines} item(s) issued`);
    if (forwardedLines) parts.push(`${forwardedLines} item(s) forwarded to Purchase`);
    toast.success(`${selected.pr_no}: ${parts.join(' · ')}`);

    closeDetail();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={ClipboardCheck}
        title="Store Incharge Approval"
        description="Approved PRs awaiting stock issue — issue available stock, shortages auto-forward to Purchase"
      >
        <Button
          variant="outline"
          size="sm"
          className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={fetchLoading}
        >
          <RefreshCw size={15} className={fetchLoading ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Pending', value: stats.pending, icon: Clock, cls: 'text-amber-600' },
            { label: 'Partially Issued', value: stats.partial, icon: AlertTriangle, cls: 'text-orange-600' },
            { label: 'Issued', value: stats.issued, icon: CheckCircle2, cls: 'text-emerald-600' },
            { label: 'Forwarded to Purchase', value: stats.forwarded, icon: Send, cls: 'text-blue-600' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
                <Icon size={20} className={cls} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter + table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="p-3 border-b flex items-center gap-2">
            <Label className="text-xs shrink-0">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUS_FILTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR No</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Approved On</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fetchLoading && prs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Loader2 size={16} className="inline animate-spin mr-2" />Loading approved PRs…
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No {statusFilter === 'all' ? '' : statusFilter.toLowerCase() + ' '}requisitions
                  </TableCell></TableRow>
                ) : filtered.map(pr => (
                  <TableRow key={pr.pr_sno}>
                    <TableCell className="font-medium">{pr.pr_no}</TableCell>
                    <TableCell className="text-sm">
                      {pr.requested_by}
                      <div className="text-xs text-muted-foreground">{pr.dept_name} · {pr.branch_name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{pr.approved_on}</TableCell>
                    <TableCell className="text-right">{pr.items.length}</TableCell>
                    <TableCell className="text-right">{totalRequested(pr)}</TableCell>
                    <TableCell className="text-right">{totalIssued(pr)}</TableCell>
                    <TableCell><StatusBadge status={prStatus(pr)} withDot /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openDetail(pr)}>
                        <Eye size={14} className="mr-1" /> Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Forwarded-to-purchase log */}
        <div className="border rounded-lg overflow-hidden">
          <div className="p-3 border-b flex items-center gap-2">
            <Send size={15} className="text-blue-600" />
            <span className="text-sm font-medium">Sent to Purchase Dept</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR No</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Shortfall Qty</TableHead>
                  <TableHead>Forwarded On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseQueue.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Nothing forwarded to Purchase yet
                  </TableCell></TableRow>
                ) : purchaseQueue.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.pr_no}</TableCell>
                    <TableCell className="text-sm">
                      {q.item_name}
                      <div className="text-xs text-muted-foreground">{q.item_code}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{q.qty} {q.uom}</TableCell>
                    <TableCell className="text-sm">{q.forwarded_on}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ── Process dialog ── */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) closeDetail(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.pr_no}
              {selected && <StatusBadge status={prStatus(selected)} withDot />}
            </DialogTitle>
            <DialogDescription>
              {selected?.requested_by} · {selected?.dept_name} · approved {selected?.approved_on}
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  {actionable && <TableHead className="text-right w-28">Issue Now</TableHead>}
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected?.items.map(item => {
                  const pending = pendingQty(item);
                  const maxIssuable = Math.min(pending, item.current_stock);
                  const qty = issueQty[item.item_sno] ?? 0;
                  const shortfall = pending - qty;
                  return (
                    <TableRow key={item.item_sno}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.item_name}</div>
                        <div className="text-xs text-muted-foreground">{item.item_code}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.requested_qty} {item.uom}</TableCell>
                      <TableCell className={`text-right text-sm ${item.current_stock < pending ? 'text-destructive font-medium' : ''}`}>
                        {item.current_stock} {item.uom}
                      </TableCell>
                      {actionable && (
                        <TableCell className="text-right">
                          {pending > 0 ? (
                            <Input
                              type="number"
                              min={0}
                              max={maxIssuable}
                              className="h-8 w-24 ml-auto text-right"
                              value={qty}
                              onChange={e => setIssueQty(prev => ({
                                ...prev,
                                [item.item_sno]: Math.max(0, Math.min(maxIssuable, Number(e.target.value))),
                              }))}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {pending === 0 ? (
                          <StatusBadge status={lineStatus(item)} withDot />
                        ) : (
                          <div className="flex flex-col gap-1 text-xs">
                            {qty > 0 && <span className="text-emerald-600 flex items-center gap-1"><PackageCheck size={12} /> issue {qty}</span>}
                            {shortfall > 0 && <span className="text-blue-600 flex items-center gap-1"><Send size={12} /> forward {shortfall}</span>}
                            {qty === 0 && shortfall === 0 && <span className="text-muted-foreground">no action</span>}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {actionable && (
            <DialogFooter>
              <Button variant="outline" onClick={closeDetail}>Cancel</Button>
              <Button onClick={handleProcess}>
                <PackageX size={15} className="mr-1" /> Issue &amp; Forward Shortages
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreInchargeApprovalPage;
