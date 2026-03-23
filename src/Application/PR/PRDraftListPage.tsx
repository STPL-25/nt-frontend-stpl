import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Pencil,
  Trash2,
  Send,
  RefreshCw,
  FileText,
  Clock,
  ChevronDown,
  ChevronRight,
  Users,
  User,
  CheckSquare,
  Square,
  Wifi,
  WifiOff,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  prGetDrafts,
  prDeleteDraft,
  prSubmitDraft,
  prGetDeptDrafts,
  prDeleteDeptDraft,
  prSubmitDeptDraft,
  prSubmitAllDeptDrafts,
} from '@/Services/Api';
import PurchaseRequisitionPage from './PurchaseRequisitionPage';
import { useAppState } from '@/globalState/hooks/useAppState';
import type { DeptDraft } from './PRDraftSidebar';

// ── Types ────────────────────────────────────────────────────────────────────

interface DraftBasicInfo {
  com_name?: string;
  div_name?: string;
  brn_name?: string;
  dept_name?: string;
  req_date?: string;
  required_date?: string;
  priority_name?: string;
  purpose?: string;
  com_sno?: string | number;
  div_sno?: string | number;
  brn_sno?: string | number;
}

interface PrivateDraft {
  draftId: string;
  ecno: string;
  savedAt: string;
  updatedAt: string;
  totalAmount: number;
  basicInfo: DraftBasicInfo;
  items: Array<{
    prod_name?: string;
    qty?: number;
    unit_name?: string;
    est_cost?: number;
    total_cost?: number;
    remarks?: string;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatAmount = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Item detail table used by both draft types ────────────────────────────────

function DraftItemsTable({ items }: { items: PrivateDraft['items'] }) {
  return (
    <div className="mt-3 border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10 text-center text-xs">#</TableHead>
            <TableHead className="text-xs">Product</TableHead>
            <TableHead className="text-xs">Qty</TableHead>
            <TableHead className="text-xs">Unit</TableHead>
            <TableHead className="text-xs">Est. Cost</TableHead>
            <TableHead className="text-xs">Total</TableHead>
            <TableHead className="text-xs">Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
              <TableCell className="text-xs font-medium">{item.prod_name || '—'}</TableCell>
              <TableCell className="text-xs">{item.qty ?? '—'}</TableCell>
              <TableCell className="text-xs">{item.unit_name || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                ₹{(parseFloat(String(item.est_cost)) || 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-xs font-medium text-emerald-600">
                ₹{(parseFloat(String(item.total_cost)) || 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                {item.remarks || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Private Drafts Tab ────────────────────────────────────────────────────────

function PrivateDraftsTab() {
  const [drafts, setDrafts] = useState<PrivateDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<PrivateDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(prGetDrafts, { headers: getAuthHeaders() });
      setDrafts(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load private drafts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(prDeleteDraft(deleteTarget), { headers: getAuthHeaders() });
      toast.success('Draft deleted');
      setDrafts((prev) => prev.filter((d) => d.draftId !== deleteTarget));
    } catch {
      toast.error('Failed to delete draft');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSubmit = async (draftId: string) => {
    setSubmittingId(draftId);
    try {
      const res = await axios.post(prSubmitDraft(draftId), {}, { headers: getAuthHeaders() });
      const msg = res.data?.data?.[0]?.Message || 'Requisition submitted!';
      toast.success(msg);
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Submission failed');
    } finally {
      setSubmittingId(null);
    }
  };

  if (editingDraft) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => setEditingDraft(null)}>
            ← Back to Drafts
          </Button>
          <Badge variant="secondary">
            <User className="h-3 w-3 mr-1" />
            Editing Private Draft
          </Badge>
        </div>
        <PurchaseRequisitionPage
          editDraftId={editingDraft.draftId}
          editDraftData={editingDraft}
          onDraftSubmitted={() => {
            setEditingDraft(null);
            fetchDrafts();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={fetchDrafts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading...
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">No private drafts</p>
          <p className="text-xs mt-1">Save a requisition as draft to continue editing later.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <Card key={draft.draftId} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === draft.draftId ? null : draft.draftId)
                      }
                      className="text-muted-foreground shrink-0"
                    >
                      {expandedId === draft.draftId ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {draft.basicInfo?.com_name || '—'} / {draft.basicInfo?.brn_name || '—'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {draft.items?.length ?? 0} item{draft.items?.length !== 1 ? 's' : ''}
                        </Badge>
                        {draft.totalAmount > 0 && (
                          <Badge variant="secondary" className="text-xs text-emerald-700">
                            {formatAmount(draft.totalAmount)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(draft.updatedAt || draft.savedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setEditingDraft(draft)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleSubmit(draft.draftId)}
                      disabled={submittingId === draft.draftId}
                    >
                      {submittingId === draft.draftId ? (
                        <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1" />
                      )}
                      Submit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteTarget(draft.draftId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {expandedId === draft.draftId && draft.items?.length > 0 && (
                  <DraftItemsTable items={draft.items} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Draft?</DialogTitle>
            <DialogDescription>
              This draft will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Shared Drafts Tab ─────────────────────────────────────────────────────────

function SharedDraftsTab() {
  const { userData, socket } = useAppState();
  const [drafts, setDrafts] = useState<DeptDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<DeptDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  // Scope selection state
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [com_sno, setCom] = useState('');
  const [div_sno, setDiv] = useState('');
  const [brn_sno, setBrn] = useState('');

  const currentUserEcno: string = (() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u?.ecno ?? '';
  })();

  // Socket connection status
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    setIsConnected((socket as any).connected);
    (socket as any).on('connect', onConnect);
    (socket as any).on('disconnect', onDisconnect);
    return () => {
      (socket as any).off('connect', onConnect);
      (socket as any).off('disconnect', onDisconnect);
    };
  }, [socket]);

  // Socket real-time updates
  useEffect(() => {
    if (!socket || !scopeKey) return;

    const handleNew = (draft: DeptDraft) => {
      setDrafts((prev) => {
        if (prev.some((d) => d.draftId === draft.draftId)) return prev;
        return [draft, ...prev];
      });
    };
    const handleUpdated = (draft: DeptDraft) => {
      setDrafts((prev) => prev.map((d) => (d.draftId === draft.draftId ? draft : d)));
    };
    const handleDeleted = ({ draftId }: { draftId: string }) => {
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    };
    const handleSubmitted = ({ draftId }: { draftId: string }) => {
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    };
    const handleAllSubmitted = () => {
      setDrafts([]);
      setSelectedIds(new Set());
    };

    (socket as any).on('pr:draft:new', handleNew);
    (socket as any).on('pr:draft:updated', handleUpdated);
    (socket as any).on('pr:draft:deleted', handleDeleted);
    (socket as any).on('pr:draft:submitted', handleSubmitted);
    (socket as any).on('pr:draft:all_submitted', handleAllSubmitted);

    return () => {
      (socket as any).off('pr:draft:new', handleNew);
      (socket as any).off('pr:draft:updated', handleUpdated);
      (socket as any).off('pr:draft:deleted', handleDeleted);
      (socket as any).off('pr:draft:submitted', handleSubmitted);
      (socket as any).off('pr:draft:all_submitted', handleAllSubmitted);
    };
  }, [socket, scopeKey]);

  // Fetch drafts for scope
  const fetchDrafts = useCallback(async (key: string) => {
    const [c, d, b] = key.split(':');
    setLoading(true);
    try {
      const res = await axios.get(
        `${prGetDeptDrafts}?com_sno=${c}&div_sno=${d}&brn_sno=${b}`,
        { headers: getAuthHeaders() }
      );
      setDrafts(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load shared drafts');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadScope = () => {
    if (!com_sno || !div_sno || !brn_sno) {
      toast.error('Enter Company, Division and Branch SNO to load shared drafts');
      return;
    }
    const key = `${com_sno}:${div_sno}:${brn_sno}`;
    setScopeKey(key);
    fetchDrafts(key);
    if (socket) (socket as any).emit('join-pr-scope', key);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !scopeKey) return;
    try {
      await axios.delete(`${prDeleteDeptDraft(deleteTarget)}?scopeKey=${scopeKey}`, {
        headers: getAuthHeaders(),
      });
      toast.success('Draft deleted');
      setDrafts((prev) => prev.filter((d) => d.draftId !== deleteTarget));
    } catch {
      toast.error('Failed to delete draft');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSubmitOne = async (draftId: string) => {
    if (!scopeKey) return;
    setSubmittingId(draftId);
    try {
      await axios.post(prSubmitDeptDraft(draftId), { scopeKey }, { headers: getAuthHeaders() });
      toast.success('Draft submitted!');
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Submit failed');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSubmitSelected = async () => {
    if (!scopeKey || selectedIds.size === 0) return;
    setSubmittingAll(true);
    let ok = 0;
    let fail = 0;
    await Promise.allSettled(
      Array.from(selectedIds).map(async (id) => {
        try {
          await axios.post(prSubmitDeptDraft(id), { scopeKey }, { headers: getAuthHeaders() });
          ok++;
          setDrafts((prev) => prev.filter((d) => d.draftId !== id));
          setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
        } catch { fail++; }
      })
    );
    if (ok > 0) toast.success(`${ok} draft(s) submitted`);
    if (fail > 0) toast.error(`${fail} draft(s) failed`);
    setSubmittingAll(false);
  };

  const handleSubmitAll = async () => {
    if (!scopeKey) return;
    setSubmittingAll(true);
    try {
      const res = await axios.post(prSubmitAllDeptDrafts, { scopeKey }, { headers: getAuthHeaders() });
      const results = res.data?.data ?? [];
      const succeeded = results.filter((r: any) => r.status === 'fulfilled').length;
      const failed = results.filter((r: any) => r.status === 'rejected').length;
      if (succeeded > 0) toast.success(`${succeeded} draft(s) submitted`);
      if (failed > 0) toast.error(`${failed} failed`);
      setDrafts([]);
      setSelectedIds(new Set());
    } catch {
      toast.error('Submit all failed');
    } finally {
      setSubmittingAll(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === drafts.length ? new Set() : new Set(drafts.map((d) => d.draftId))
    );
  };

  if (editingDraft) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => setEditingDraft(null)}>
            ← Back to Shared Drafts
          </Button>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            <Users className="h-3 w-3 mr-1" />
            Editing Shared Draft
          </Badge>
        </div>
        <PurchaseRequisitionPage
          editDraftData={editingDraft as any}
          onDraftSubmitted={() => {
            setEditingDraft(null);
            if (scopeKey) fetchDrafts(scopeKey);
          }}
        />
      </div>
    );
  }

  return (
    <>
      {/* Scope selector */}
      <div className="mb-4 p-4 rounded-xl border bg-muted/20 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Load Shared Drafts by Scope</span>
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 ml-auto">
              <Wifi className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Company SNO</label>
            <input
              value={com_sno}
              onChange={(e) => setCom(e.target.value)}
              placeholder="e.g. 1"
              className="h-8 w-24 rounded border px-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Division SNO</label>
            <input
              value={div_sno}
              onChange={(e) => setDiv(e.target.value)}
              placeholder="e.g. 2"
              className="h-8 w-24 rounded border px-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Branch SNO</label>
            <input
              value={brn_sno}
              onChange={(e) => setBrn(e.target.value)}
              placeholder="e.g. 3"
              className="h-8 w-24 rounded border px-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button onClick={handleLoadScope} size="sm" className="h-8" disabled={loading}>
            {loading ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            Load Drafts
          </Button>
          {scopeKey && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => scopeKey && fetchDrafts(scopeKey)}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
        {scopeKey && (
          <p className="text-xs text-muted-foreground">
            Showing shared drafts for scope: <strong>{scopeKey.split(':').join(' › ')}</strong>
          </p>
        )}
      </div>

      {/* Batch action bar */}
      {drafts.length > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-muted/20 border">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {selectedIds.size === drafts.length ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {selectedIds.size === drafts.length ? 'Deselect all' : 'Select all'}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''} ·{' '}
              Total:{' '}
              {formatAmount(drafts.reduce((s, d) => s + (d.totalAmount || 0), 0))}
            </span>
            {selectedIds.size > 0 ? (
              <Button
                size="sm"
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={handleSubmitSelected}
                disabled={submittingAll}
              >
                {submittingAll && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                <Send className="h-3 w-3 mr-1" />
                Submit selected ({selectedIds.size})
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleSubmitAll}
                disabled={submittingAll || drafts.length === 0}
              >
                {submittingAll && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                <Send className="h-3 w-3 mr-1" />
                Submit all ({drafts.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Draft list */}
      {!scopeKey ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">Select a scope above</p>
          <p className="text-xs mt-1">Enter Company, Division and Branch SNO to view shared drafts.</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading...
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">No shared drafts in this scope</p>
          <p className="text-xs mt-1">Save a draft as "Shared" from the PR form to see it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const isOwn = draft.enteredBy?.ecno === currentUserEcno;
            const isSelected = selectedIds.has(draft.draftId);

            return (
              <Card
                key={draft.draftId}
                className={`border shadow-sm transition-all ${isSelected ? 'ring-1 ring-primary bg-primary/5' : 'hover:shadow-md'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="mt-0.5 shrink-0 flex flex-col items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(draft.draftId)}
                        className="h-4 w-4"
                      />
                      <button
                        onClick={() => setExpandedId(expandedId === draft.draftId ? null : draft.draftId)}
                        className="text-muted-foreground"
                      >
                        {expandedId === draft.draftId ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {draft.basicInfo?.com_name || '—'} / {draft.basicInfo?.brn_name || '—'}
                        </span>
                        {isOwn && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {draft.items?.length ?? 0} item{draft.items?.length !== 1 ? 's' : ''}
                        </Badge>
                        {draft.totalAmount > 0 && (
                          <Badge variant="secondary" className="text-xs text-emerald-700">
                            {formatAmount(draft.totalAmount)}
                          </Badge>
                        )}
                      </div>

                      {/* Entered by */}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Entered by: <strong className="text-foreground ml-0.5">{draft.enteredBy?.name || draft.enteredBy?.ecno}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(draft.savedAt)}
                        </span>
                      </div>

                      {/* Updated by (if different) */}
                      {draft.updatedBy?.ecno !== draft.enteredBy?.ecno && (
                        <p className="text-xs text-blue-500 mt-0.5">
                          Last updated by: {draft.updatedBy?.name || draft.updatedBy?.ecno}{' '}
                          · {formatDate(draft.updatedAt)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditingDraft(draft)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleSubmitOne(draft.draftId)}
                        disabled={submittingId === draft.draftId || submittingAll}
                      >
                        {submittingId === draft.draftId ? (
                          <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5 mr-1" />
                        )}
                        Submit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTarget(draft.draftId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {expandedId === draft.draftId && draft.items?.length > 0 && (
                    <DraftItemsTable items={draft.items} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Shared Draft?</DialogTitle>
            <DialogDescription>
              This draft will be permanently removed for all team members. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PRDraftListPage: React.FC = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <Card className="shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Draft Requisitions</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Manage your private drafts or view team shared drafts with real-time updates
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="private">
            <TabsList className="mb-4">
              <TabsTrigger value="private" className="gap-2 text-xs">
                <User className="h-3.5 w-3.5" />
                Private Drafts
              </TabsTrigger>
              <TabsTrigger value="shared" className="gap-2 text-xs">
                <Users className="h-3.5 w-3.5" />
                Shared Drafts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="private">
              <PrivateDraftsTab />
            </TabsContent>

            <TabsContent value="shared">
              <SharedDraftsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PRDraftListPage;
