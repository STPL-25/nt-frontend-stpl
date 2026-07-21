import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/utils/statusUtils';
import { PageHeader } from '@/CustomComponent/PageComponents';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw, PackageCheck, Clock, CheckCircle2, XCircle, Eye, Loader2, AlertTriangle,
} from 'lucide-react';

import { usePermissions } from '@/globalState/hooks/usePermissions';
import {
  srGetRequests, srGetRequestItems, srIssueRequest, srRejectRequest,
} from '@/Services/GrnService/stockRequestApi';
import {
  socket, SOCKET_JOIN_INVENTORY, SOCKET_LEAVE_INVENTORY, SOCKET_STOCK_REQUEST_UPDATED,
} from '@/Services/Socket';

import type { StockRequest, StockRequestLine } from './types';

const STATUS_FILTERS = ['Pending', 'Partially Issued', 'Issued', 'Rejected', 'Cancelled'] as const;

const StockIssuePage: React.FC = () => {
  const { canEdit } = usePermissions();
  const canIssue = canEdit('StockIssuePage');

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('Pending');

  const [selected, setSelected] = useState<StockRequest | null>(null);
  const [lines, setLines] = useState<StockRequestLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  // sr_item_sno -> quantity to issue now
  const [issueQty, setIssueQty] = useState<Record<number, number>>({});
  const [issuing, setIssuing] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const res = await axios.get(srGetRequests, { params });
      setRequests(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load stock requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const openDetail = useCallback(async (request: StockRequest) => {
    setSelected(request);
    setLoadingLines(true);
    try {
      const res = await axios.get(srGetRequestItems(request.request_sno));
      const fetched: StockRequestLine[] = res.data?.data ?? [];
      setLines(fetched);
      // Default each open line to the max issuable now: min(pending, in stock)
      setIssueQty(Object.fromEntries(
        fetched
          .filter(l => l.pending_qty > 0)
          .map(l => [l.sr_item_sno, Math.min(l.pending_qty, l.current_stock)]),
      ));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load request items');
    } finally {
      setLoadingLines(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Real-time: new / changed requests while this screen is open ──────────
  useEffect(() => {
    if (!socket) return;
    socket.emit(SOCKET_JOIN_INVENTORY);

    const onRequestUpdated = (payload: { request?: StockRequest; action?: string }) => {
      if (payload?.action === 'created') toast.info(`New stock request ${payload.request?.request_no ?? ''}`);
      fetchRequests();
    };

    socket.on(SOCKET_STOCK_REQUEST_UPDATED, onRequestUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_INVENTORY);
      socket.off(SOCKET_STOCK_REQUEST_UPDATED, onRequestUpdated);
    };
  }, [fetchRequests]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    pending: requests.filter(r => r.status === 'Pending').length,
    partial: requests.filter(r => r.status === 'Partially Issued').length,
    issued: requests.filter(r => r.status === 'Issued').length,
    rejected: requests.filter(r => r.status === 'Rejected').length,
  }), [requests]);

  const actionable = selected?.status === 'Pending' || selected?.status === 'Partially Issued';

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleIssue = async () => {
    if (!selected) return;
    const toIssue = lines
      .filter(l => l.pending_qty > 0)
      .map(l => ({ sr_item_sno: l.sr_item_sno, issue_qty: issueQty[l.sr_item_sno] ?? 0 }))
      .filter(l => l.issue_qty > 0);

    if (toIssue.length === 0) { toast.error('Enter at least one issue quantity'); return; }

    for (const entry of toIssue) {
      const line = lines.find(l => l.sr_item_sno === entry.sr_item_sno)!;
      if (entry.issue_qty > line.pending_qty) {
        toast.error(`${line.item_name}: issue quantity exceeds pending ${line.pending_qty}`);
        return;
      }
      if (entry.issue_qty > line.current_stock) {
        toast.error(`${line.item_name}: only ${line.current_stock} ${line.uom} in stock`);
        return;
      }
    }

    setIssuing(true);
    try {
      const res = await axios.post(srIssueRequest, {
        request_sno: selected.request_sno,
        items: toIssue,
      });
      const header: StockRequest | undefined = res.data?.data?.header;
      toast.success(`Stock issued for ${selected.request_no}${header?.status === 'Partially Issued' ? ' (partially)' : ''}`);
      setSelected(null);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to issue stock');
    } finally {
      setIssuing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) { toast.error('A rejection reason is required'); return; }
    setRejecting(true);
    try {
      await axios.put(srRejectRequest(selected.request_sno), { reason: rejectReason.trim() });
      toast.success(`Request ${selected.request_no} rejected`);
      setRejectOpen(false);
      setRejectReason('');
      setSelected(null);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to reject request');
    } finally {
      setRejecting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={PackageCheck}
        title="Stock Issue"
        description="Review stock requests and issue items — issuing reduces inventory"
      >
        <Button
          variant="outline"
          size="sm"
          className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={fetchRequests}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin mr-1' : 'mr-1'} />
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
            { label: 'Rejected', value: stats.rejected, icon: XCircle, cls: 'text-red-600' },
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
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
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
                  <TableHead>Request No</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <Loader2 size={16} className="inline animate-spin mr-2" />Loading requests…
                  </TableCell></TableRow>
                ) : requests.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No {statusFilter === 'all' ? '' : statusFilter.toLowerCase() + ' '}requests
                  </TableCell></TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.request_sno}>
                    <TableCell className="font-medium">{req.request_no}</TableCell>
                    <TableCell className="text-sm">
                      {req.requested_name || req.requested_by}
                      {req.dept_name && <div className="text-xs text-muted-foreground">{req.dept_name}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{req.created_at?.slice(0, 16) ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{req.purpose ?? '—'}</TableCell>
                    <TableCell className="text-right">{req.item_count}</TableCell>
                    <TableCell className="text-right">{req.total_requested_qty}</TableCell>
                    <TableCell className="text-right">{req.total_issued_qty}</TableCell>
                    <TableCell><StatusBadge status={req.status} withDot /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openDetail(req)}>
                        <Eye size={14} className="mr-1" /> Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ── Issue dialog ── */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.request_no}
              {selected && <StatusBadge status={selected.status} withDot />}
            </DialogTitle>
            <DialogDescription>
              {selected?.requested_name || selected?.requested_by} · {selected?.created_at?.slice(0, 16)}
              {selected?.purpose ? ` — ${selected.purpose}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  {actionable && <TableHead className="text-right w-28">Issue Now</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLines ? (
                  <TableRow><TableCell colSpan={actionable ? 5 : 4} className="text-center py-6 text-muted-foreground">
                    <Loader2 size={15} className="inline animate-spin mr-2" />Loading…
                  </TableCell></TableRow>
                ) : lines.map(line => {
                  const maxIssuable = Math.min(line.pending_qty, line.current_stock);
                  const short = line.pending_qty > line.current_stock;
                  return (
                    <TableRow key={line.sr_item_sno}>
                      <TableCell>
                        <div className="font-medium text-sm">{line.item_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {line.item_code}{line.warehouse ? ` · ${line.warehouse}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{line.requested_qty} {line.uom}</TableCell>
                      <TableCell className="text-right text-sm">{line.issued_qty} {line.uom}</TableCell>
                      <TableCell className={`text-right text-sm ${short ? 'text-destructive font-medium' : ''}`}>
                        {line.current_stock} {line.uom}
                        {short && <div className="text-xs">short by {line.pending_qty - line.current_stock}</div>}
                      </TableCell>
                      {actionable && (
                        <TableCell className="text-right">
                          {line.pending_qty > 0 ? (
                            <Input
                              type="number"
                              min={0}
                              max={maxIssuable}
                              className="h-8 w-24 ml-auto text-right"
                              value={issueQty[line.sr_item_sno] ?? 0}
                              onChange={e => setIssueQty(prev => ({
                                ...prev,
                                [line.sr_item_sno]: Number(e.target.value),
                              }))}
                              disabled={!canIssue}
                            />
                          ) : (
                            <StatusBadge status={line.line_status} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {actionable && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                disabled={!canIssue || issuing || selected?.status !== 'Pending'}
                onClick={() => setRejectOpen(true)}
              >
                <XCircle size={15} className="mr-1" /> Reject
              </Button>
              <Button disabled={!canIssue || issuing || loadingLines} onClick={handleIssue}>
                {issuing
                  ? <><Loader2 size={15} className="animate-spin mr-1" /> Issuing…</>
                  : <><PackageCheck size={15} className="mr-1" /> Issue Stock</>}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {selected?.request_no}</DialogTitle>
            <DialogDescription>The requester will see this reason.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Reason for rejection…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>
              Back
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? <Loader2 size={15} className="animate-spin mr-1" /> : <XCircle size={15} className="mr-1" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockIssuePage;
