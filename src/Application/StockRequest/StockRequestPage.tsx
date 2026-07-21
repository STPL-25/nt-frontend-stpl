import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/utils/statusUtils';
import { PageHeader } from '@/CustomComponent/PageComponents';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Plus, Trash2, Send, RefreshCw, PackageOpen, ShoppingCart, Eye, XCircle, Loader2,
} from 'lucide-react';

import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import type { InventoryItem } from '@/Application/Inventory/Inventory/types';
import { invSvcGetItems } from '@/Services/GrnService/inventoryApi';
import {
  srGetRequests, srGetRequestItems, srCreateRequest, srCancelRequest,
} from '@/Services/GrnService/stockRequestApi';
import {
  socket, SOCKET_JOIN_INVENTORY, SOCKET_LEAVE_INVENTORY, SOCKET_STOCK_REQUEST_UPDATED,
} from '@/Services/Socket';

import type { StockRequest, StockRequestLine, CartLine } from './types';

const StockRequestPage: React.FC = () => {
  const { userData } = useAppState();
  const { canCreate } = usePermissions();

  const currentUserEcno: string = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u?.ecno ?? '';
  }, [userData]);

  const [activeTab, setActiveTab] = useState('new-request');

  // ── New Request state ────────────────────────────────────────────────────
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── My Requests state ────────────────────────────────────────────────────
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [requestLines, setRequestLines] = useState<StockRequestLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await axios.get(invSvcGetItems, { params: { status: 'Active' } });
      setItems(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load stock items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const fetchMyRequests = useCallback(async () => {
    if (!currentUserEcno) return;
    setLoadingRequests(true);
    try {
      const res = await axios.get(srGetRequests, { params: { requested_by: currentUserEcno } });
      setRequests(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load your requests');
    } finally {
      setLoadingRequests(false);
    }
  }, [currentUserEcno]);

  const openRequestDetail = useCallback(async (request: StockRequest) => {
    setSelectedRequest(request);
    setLoadingLines(true);
    try {
      const res = await axios.get(srGetRequestItems(request.request_sno));
      setRequestLines(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load request items');
    } finally {
      setLoadingLines(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);

  // ── Real-time: status changes on my requests (issued / rejected) ─────────
  useEffect(() => {
    if (!socket) return;
    socket.emit(SOCKET_JOIN_INVENTORY);

    const onRequestUpdated = (payload: { request?: StockRequest; action?: string }) => {
      const req = payload?.request;
      if (!req || req.requested_by !== currentUserEcno) return;
      fetchMyRequests();
      if (payload.action === 'issued') toast.info(`Request ${req.request_no} has been issued`);
      if (payload.action === 'rejected') toast.warning(`Request ${req.request_no} was rejected`);
    };

    socket.on(SOCKET_STOCK_REQUEST_UPDATED, onRequestUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_INVENTORY);
      socket.off(SOCKET_STOCK_REQUEST_UPDATED, onRequestUpdated);
    };
  }, [currentUserEcno, fetchMyRequests]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const categories = useMemo(
    () => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(),
    [items],
  );

  const availableItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter(i =>
      i.current_stock > 0 &&
      (categoryFilter === 'all' || i.category === categoryFilter) &&
      (!term || i.item_name.toLowerCase().includes(term) || i.item_code.toLowerCase().includes(term)),
    );
  }, [items, searchTerm, categoryFilter]);

  // ── Cart handlers ────────────────────────────────────────────────────────

  const addToCart = (item: InventoryItem) => {
    if (!item.item_sno) return;
    if (cart.some(l => l.item_sno === item.item_sno)) {
      toast.info(`${item.item_name} is already in the request`);
      return;
    }
    setCart(prev => [...prev, {
      item_sno: item.item_sno!,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom,
      current_stock: item.current_stock,
      quantity: 1,
      remarks: '',
    }]);
  };

  const updateCartLine = (item_sno: number, patch: Partial<CartLine>) =>
    setCart(prev => prev.map(l => l.item_sno === item_sno ? { ...l, ...patch } : l));

  const removeFromCart = (item_sno: number) =>
    setCart(prev => prev.filter(l => l.item_sno !== item_sno));

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Add at least one item to the request'); return; }
    for (const line of cart) {
      if (!line.quantity || line.quantity <= 0) {
        toast.error(`Enter a quantity for ${line.item_name}`); return;
      }
      if (line.quantity > line.current_stock) {
        toast.error(`${line.item_name}: requested ${line.quantity} exceeds available ${line.current_stock}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await axios.post(srCreateRequest, {
        purpose: purpose.trim() || undefined,
        items: cart.map(l => ({
          item_sno: l.item_sno,
          quantity: l.quantity,
          remarks: l.remarks.trim() || undefined,
        })),
      });
      const created = res.data?.data?.[0];
      toast.success(`Stock request ${created?.request_no ?? ''} submitted`);
      setCart([]);
      setPurpose('');
      fetchMyRequests();
      setActiveTab('my-requests');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to submit stock request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (request: StockRequest) => {
    if (!window.confirm(`Cancel request ${request.request_no}?`)) return;
    setCancelling(true);
    try {
      await axios.put(srCancelRequest(request.request_sno), {});
      toast.success(`Request ${request.request_no} cancelled`);
      setSelectedRequest(null);
      fetchMyRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={PackageOpen}
        title="Stock Request"
        description="Request items from stores — the stock incharge issues them from inventory"
      >
        <Button
          variant="outline"
          size="sm"
          className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={() => { fetchItems(); fetchMyRequests(); }}
          disabled={loadingItems || loadingRequests}
        >
          <RefreshCw size={15} className={loadingItems || loadingRequests ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="new-request">
              New Request
              {cart.length > 0 && <Badge variant="secondary" className="ml-2">{cart.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          </TabsList>

          {/* ── New Request ── */}
          <TabsContent value="new-request" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Available items */}
              <div className="lg:col-span-3 border rounded-lg overflow-hidden">
                <div className="p-3 border-b flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search by item name or code…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="sm:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-[28rem] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingItems ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          <Loader2 size={16} className="inline animate-spin mr-2" />Loading items…
                        </TableCell></TableRow>
                      ) : availableItems.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No in-stock items match
                        </TableCell></TableRow>
                      ) : availableItems.map(item => {
                        const inCart = cart.some(l => l.item_sno === item.item_sno);
                        return (
                          <TableRow key={item.item_sno}>
                            <TableCell>
                              <div className="font-medium">{item.item_name}</div>
                              <div className="text-xs text-muted-foreground">{item.item_code}</div>
                            </TableCell>
                            <TableCell className="text-sm">{item.category}</TableCell>
                            <TableCell className="text-right text-sm">
                              {item.current_stock} {item.uom}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={inCart ? 'secondary' : 'outline'}
                                disabled={inCart || !canCreate('StockRequestPage')}
                                onClick={() => addToCart(item)}
                              >
                                <Plus size={14} className="mr-1" />{inCart ? 'Added' : 'Add'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Cart */}
              <div className="lg:col-span-2 border rounded-lg p-4 space-y-3 h-fit">
                <div className="flex items-center gap-2 font-medium">
                  <ShoppingCart size={16} /> Request Items
                  <Badge variant="secondary">{cart.length}</Badge>
                </div>

                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Add items from the list to build your request
                  </p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {cart.map(line => (
                      <div key={line.item_sno} className="border rounded-md p-2.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{line.item_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {line.item_code} · Available: {line.current_stock} {line.uom}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(line.item_sno)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs shrink-0">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            max={line.current_stock}
                            className="h-8 w-24"
                            value={line.quantity || ''}
                            onChange={e => updateCartLine(line.item_sno, { quantity: Number(e.target.value) })}
                          />
                          <span className="text-xs text-muted-foreground">{line.uom}</span>
                          <Input
                            className="h-8 flex-1"
                            placeholder="Line remarks (optional)"
                            value={line.remarks}
                            onChange={e => updateCartLine(line.item_sno, { remarks: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Purpose / Remarks</Label>
                  <Textarea
                    rows={2}
                    placeholder="Why are these items needed?"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={cart.length === 0 || submitting || !canCreate('StockRequestPage')}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? <><Loader2 size={15} className="animate-spin mr-1" /> Submitting…</>
                    : <><Send size={15} className="mr-1" /> Submit Request</>}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── My Requests ── */}
          <TabsContent value="my-requests" className="mt-4">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRequests ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Loader2 size={16} className="inline animate-spin mr-2" />Loading requests…
                    </TableCell></TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      You have not raised any stock requests yet
                    </TableCell></TableRow>
                  ) : requests.map(req => (
                    <TableRow key={req.request_sno}>
                      <TableCell className="font-medium">{req.request_no}</TableCell>
                      <TableCell className="text-sm">{req.created_at?.slice(0, 16) ?? '—'}</TableCell>
                      <TableCell className="text-right">{req.item_count}</TableCell>
                      <TableCell className="text-right">{req.total_requested_qty}</TableCell>
                      <TableCell className="text-right">{req.total_issued_qty}</TableCell>
                      <TableCell><StatusBadge status={req.status} withDot /></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openRequestDetail(req)}>
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Request detail dialog ── */}
      <Dialog open={!!selectedRequest} onOpenChange={open => { if (!open) setSelectedRequest(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRequest?.request_no}
              {selectedRequest && <StatusBadge status={selectedRequest.status} withDot />}
            </DialogTitle>
            <DialogDescription>
              Raised {selectedRequest?.created_at?.slice(0, 16)}
              {selectedRequest?.purpose ? ` — ${selectedRequest.purpose}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest?.status === 'Rejected' && selectedRequest.reject_reason && (
            <p className="text-sm text-destructive">Rejection reason: {selectedRequest.reject_reason}</p>
          )}

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLines ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    <Loader2 size={15} className="inline animate-spin mr-2" />Loading…
                  </TableCell></TableRow>
                ) : requestLines.map(line => (
                  <TableRow key={line.sr_item_sno}>
                    <TableCell>
                      <div className="font-medium text-sm">{line.item_name}</div>
                      <div className="text-xs text-muted-foreground">{line.item_code}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{line.requested_qty} {line.uom}</TableCell>
                    <TableCell className="text-right text-sm">{line.issued_qty} {line.uom}</TableCell>
                    <TableCell><StatusBadge status={line.line_status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedRequest?.status === 'Pending' && (
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 w-fit"
              disabled={cancelling}
              onClick={() => handleCancel(selectedRequest)}
            >
              {cancelling
                ? <Loader2 size={14} className="animate-spin mr-1" />
                : <XCircle size={14} className="mr-1" />}
              Cancel Request
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockRequestPage;
