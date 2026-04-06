import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Users,
  Clock,
  FileText,
  Trash2,
  Edit2,
  Send,
  RefreshCw,
  CheckSquare,
  Square,
  AlertCircle,
  Wifi,
  WifiOff,
  Save,
} from 'lucide-react';
import {
  prGetDeptDrafts,
  prDeleteDeptDraft,
  prSubmitDeptDraft,
  prSubmitAllDeptDrafts,
} from '@/Services/Api';
import {
  SOCKET_CONNECT,
  SOCKET_DISCONNECT,
  SOCKET_PR_DRAFT_NEW,
  SOCKET_PR_DRAFT_UPDATED,
  SOCKET_PR_DRAFT_DELETED,
  SOCKET_PR_DRAFT_SUBMITTED,
  SOCKET_PR_DRAFT_ALL_SUBMITTED,
} from '@/Services/Socket';
import type { Socket } from 'socket.io-client';

// ── Types ────────────────────────────────────────────────────────────────────

interface EnteredBy {
  ecno: string;
  name: string;
}

export interface DeptDraft {
  draftId: string;
  scopeKey: string;
  enteredBy: EnteredBy;
  updatedBy: EnteredBy;
  savedAt: string;
  updatedAt: string;
  totalAmount: number;
  basicInfo: {
    com_name?: string;
    div_name?: string;
    brn_name?: string;
    dept_name?: string;
    req_date?: string;
    required_date?: string;
    priority_name?: string;
    purpose?: string;
  };
  items: Array<{
    prod_name?: string;
    qty?: number;
    unit_name?: string;
    est_cost?: number;
    total_cost?: number;
    remarks?: string;
  }>;
}

interface PRDraftSidebarProps {
  scopeKey: string | null;
  socket: Socket | null;
  onEditDraft: (draft: DeptDraft) => void;
  currentUserEcno?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatAmount = (amount: number) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Component ─────────────────────────────────────────────────────────────────

const PRDraftSidebar: React.FC<PRDraftSidebarProps> = ({
  scopeKey,
  socket,
  onEditDraft,
  currentUserEcno,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [drafts, setDrafts] = useState<DeptDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const prevScopeKey = useRef<string | null>(null);

  // ── Fetch drafts ──────────────────────────────────────────────────────────

  const fetchDrafts = useCallback(async (key: string) => {
    const [com_sno, div_sno, brn_sno] = key.split(':');
    setLoading(true);
    try {
      const res = await axios.get(
        `${prGetDeptDrafts}?com_sno=${com_sno}&div_sno=${div_sno}&brn_sno=${brn_sno}`
      );
      setDrafts(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load shared drafts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scopeKey) {
      fetchDrafts(scopeKey);
      setSelectedIds(new Set());
    } else {
      setDrafts([]);
    }
  }, [scopeKey, fetchDrafts]);

  // ── Socket.IO: room join/leave + real-time listeners ─────────────────────

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    setIsConnected(socket.connected);
    socket.on(SOCKET_CONNECT, onConnect);
    socket.on(SOCKET_DISCONNECT, onDisconnect);
    return () => {
      socket.off(SOCKET_CONNECT, onConnect);
      socket.off(SOCKET_DISCONNECT, onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    };

    const handleSubmitted = ({ draftId }: { draftId: string }) => {
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    };

    const handleAllSubmitted = () => {
      setDrafts([]);
      setSelectedIds(new Set());
    };

    socket.on(SOCKET_PR_DRAFT_NEW, handleNew);
    socket.on(SOCKET_PR_DRAFT_UPDATED, handleUpdated);
    socket.on(SOCKET_PR_DRAFT_DELETED, handleDeleted);
    socket.on(SOCKET_PR_DRAFT_SUBMITTED, handleSubmitted);
    socket.on(SOCKET_PR_DRAFT_ALL_SUBMITTED, handleAllSubmitted);

    return () => {
      socket.off(SOCKET_PR_DRAFT_NEW, handleNew);
      socket.off(SOCKET_PR_DRAFT_UPDATED, handleUpdated);
      socket.off(SOCKET_PR_DRAFT_DELETED, handleDeleted);
      socket.off(SOCKET_PR_DRAFT_SUBMITTED, handleSubmitted);
      socket.off(SOCKET_PR_DRAFT_ALL_SUBMITTED, handleAllSubmitted);
    };
  }, [socket]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget || !scopeKey) return;
    try {
      await axios.delete(`${prDeleteDeptDraft(deleteTarget)}?scopeKey=${scopeKey}`);
      toast.success('Draft deleted');
      setDrafts((prev) => prev.filter((d) => d.draftId !== deleteTarget));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget);
        return next;
      });
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
      await axios.post(prSubmitDeptDraft(draftId), { scopeKey });
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
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    await Promise.allSettled(
      ids.map(async (draftId) => {
        try {
          await axios.post(prSubmitDeptDraft(draftId), { scopeKey });
          successCount++;
          setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(draftId);
            return next;
          });
        } catch {
          failCount++;
        }
      })
    );

    if (successCount > 0) toast.success(`${successCount} draft(s) submitted`);
    if (failCount > 0) toast.error(`${failCount} draft(s) failed`);
    setSubmittingAll(false);
  };

  const handleSubmitAll = async () => {
    if (!scopeKey) return;
    setSubmittingAll(true);
    try {
      const res = await axios.post(prSubmitAllDeptDrafts, { scopeKey });
      const results = res.data?.data ?? [];
      const succeeded = results.filter((r: any) => r.status === 'fulfilled').length;
      const failed = results.filter((r: any) => r.status === 'rejected').length;
      if (succeeded > 0) toast.success(`${succeeded} draft(s) submitted successfully`);
      if (failed > 0) toast.error(`${failed} draft(s) failed to submit`);
      setDrafts([]);
      setSelectedIds(new Set());
    } catch {
      toast.error('Submit all failed');
    } finally {
      setSubmittingAll(false);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (draftId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(draftId) ? next.delete(draftId) : next.add(draftId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.draftId)));
    }
  };

  const allSelected = drafts.length > 0 && selectedIds.size === drafts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < drafts.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-[360px]'
        }`}
      >
        {/* Toggle tab */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="self-center -translate-x-full bg-primary text-primary-foreground rounded-l-lg px-1.5 py-6 shadow-lg hover:bg-primary/90 transition-colors flex flex-col items-center gap-2"
          aria-label="Toggle draft sidebar"
        >
          {isOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          <span className="text-xs font-semibold [writing-mode:vertical-rl] rotate-180">
            Drafts
          </span>
          {drafts.length > 0 && (
            <Badge className="bg-amber-400 text-amber-900 text-[10px] px-1.5 py-0.5 min-w-0">
              {drafts.length}
            </Badge>
          )}
        </button>

        {/* Panel */}
        <div className="w-[360px] h-full bg-background border-l shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Shared Drafts</span>
                {drafts.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {drafts.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <Wifi className="h-3 w-3" /> Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <WifiOff className="h-3 w-3" /> Offline
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => scopeKey && fetchDrafts(scopeKey)}
                  disabled={loading || !scopeKey}
                  title="Refresh"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {scopeKey ? (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>Scope: {scopeKey.split(':').join(' › ')}</span>
              </div>
            ) : (
              <div className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Select Company, Division &amp; Branch to view shared drafts
              </div>
            )}
          </div>

          {/* Batch actions bar */}
          {drafts.length > 0 && (
            <div className="px-3 py-2 border-b bg-muted/20 flex items-center gap-2 shrink-0">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : someSelected ? (
                  <Square className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>

              <div className="ml-auto flex items-center gap-1.5">
                {selectedIds.size > 0 ? (
                  <Button
                    size="sm"
                    className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700"
                    onClick={handleSubmitSelected}
                    disabled={submittingAll}
                  >
                    {submittingAll ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Submit {selectedIds.size}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={handleSubmitAll}
                    disabled={submittingAll || drafts.length === 0}
                  >
                    {submittingAll ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Submit all ({drafts.length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Draft list */}
          <div className="flex-1 overflow-y-auto">
            {!scopeKey ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 px-6 text-center">
                <FileText className="h-10 w-10 opacity-20" />
                <p className="text-sm">
                  Select Company, Division &amp; Branch in the form to see shared drafts
                </p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading drafts...</span>
              </div>
            ) : drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 px-6 text-center">
                <FileText className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">No shared drafts</p>
                <p className="text-xs">
                  Save a draft — it will appear here for all team members in this scope.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {drafts.map((draft) => {
                  const isExpanded = expandedId === draft.draftId;
                  const isSelected = selectedIds.has(draft.draftId);
                  const isSubmitting = submittingId === draft.draftId;
                  const isOwn = draft.enteredBy?.ecno === currentUserEcno;

                  return (
                    <div
                      key={draft.draftId}
                      className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                    >
                      {/* Draft header row */}
                      <div className="px-3 py-2.5 flex items-start gap-2">
                        <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(draft.draftId)}
                            className="h-3.5 w-3.5"
                          />
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : draft.draftId)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* User + time */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs font-semibold truncate ${
                                isOwn ? 'text-primary' : 'text-foreground'
                              }`}
                            >
                              {draft.enteredBy?.name || draft.enteredBy?.ecno || '—'}
                            </span>
                            {isOwn && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                You
                              </Badge>
                            )}
                            {draft.items?.length > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                {draft.items.length} item{draft.items.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>

                          {/* Scope info */}
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {[
                              draft.basicInfo?.com_name,
                              draft.basicInfo?.div_name,
                              draft.basicInfo?.brn_name,
                            ]
                              .filter(Boolean)
                              .join(' / ')}
                          </p>

                          {/* Time + amount */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDate(draft.updatedAt || draft.savedAt)}
                            </span>
                            {draft.totalAmount > 0 && (
                              <span className="text-[10px] font-medium text-emerald-600">
                                {formatAmount(draft.totalAmount)}
                              </span>
                            )}
                          </div>

                          {/* Updated by (if different from entered by) */}
                          {draft.updatedBy?.ecno !== draft.enteredBy?.ecno && (
                            <p className="text-[10px] text-blue-500 mt-0.5">
                              Updated by {draft.updatedBy?.name || draft.updatedBy?.ecno}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => onEditDraft(draft)}
                            title="Edit draft"
                            className="p-1 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleSubmitOne(draft.draftId)}
                            disabled={isSubmitting || submittingAll}
                            title="Submit draft"
                            className="p-1 rounded hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors disabled:opacity-40"
                          >
                            {isSubmitting ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(draft.draftId)}
                            title="Delete draft"
                            className="p-1 rounded hover:bg-red-50 text-destructive hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded items */}
                      {isExpanded && draft.items?.length > 0 && (
                        <div className="mx-3 mb-3 rounded border bg-muted/20 overflow-hidden">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="bg-muted/40 text-muted-foreground">
                                <th className="text-left px-2 py-1.5">#</th>
                                <th className="text-left px-2 py-1.5">Product</th>
                                <th className="text-right px-2 py-1.5">Qty</th>
                                <th className="text-right px-2 py-1.5">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {draft.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-muted/30">
                                  <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                                  <td className="px-2 py-1.5 font-medium truncate max-w-[100px]">
                                    {item.prod_name || '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    {item.qty ?? '—'} {item.unit_name || ''}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-emerald-600 font-medium">
                                    ₹{(parseFloat(String(item.total_cost)) || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {drafts.length > 0 && (
            <div className="px-4 py-2.5 border-t bg-muted/20 shrink-0">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{drafts.length} draft{drafts.length !== 1 ? 's' : ''} in scope</span>
                <span className="font-medium text-foreground">
                  Total:{' '}
                  {formatAmount(drafts.reduce((s, d) => s + (d.totalAmount || 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Shared Draft?</DialogTitle>
            <DialogDescription>
              This draft will be permanently removed for all team members. This cannot be undone.
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
};

export default PRDraftSidebar;
