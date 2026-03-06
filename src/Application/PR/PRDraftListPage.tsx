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
  Pencil,
  Trash2,
  Send,
  RefreshCw,
  FileText,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { prGetDrafts, prDeleteDraft, prSubmitDraft } from '@/Services/Api';
import PurchaseRequisitionPage from './PurchaseRequisitionPage';

interface DraftBasicInfo {
  com_name?: string;
  div_name?: string;
  brn_name?: string;
  dept_name?: string;
  req_date?: string;
  required_date?: string;
  priority_name?: string;
  purpose?: string;
}

interface DraftItem {
  prod_name?: string;
  qty?: number;
  unit_name?: string;
  est_cost?: number;
  total_cost?: number;
  remarks?: string;
}

interface Draft {
  draftId: string;
  ecno: string;
  savedAt: string;
  updatedAt: string;
  totalAmount: number;
  basicInfo: DraftBasicInfo;
  items: DraftItem[];
}

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

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const PRDraftListPage: React.FC = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(prGetDrafts, { headers: getAuthHeaders() });
      setDrafts(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load drafts');
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

  const handleSubmitDraft = async (draftId: string) => {
    setSubmittingId(draftId);
    try {
      const res = await axios.post(prSubmitDraft(draftId), {}, { headers: getAuthHeaders() });
      const msg = res.data?.data?.[0]?.Message || 'Requisition submitted successfully!';
      toast.success(msg);
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Submission failed');
    } finally {
      setSubmittingId(null);
    }
  };

  // If editing a draft, show the PR form
  if (editingDraft) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 pt-4">
          <Button variant="outline" size="sm" onClick={() => setEditingDraft(null)}>
            ← Back to Drafts
          </Button>
          <Badge variant="secondary">Editing Draft</Badge>
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
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Saved Drafts</CardTitle>
              <CardDescription>
                Purchase requisitions saved as drafts — edit, submit, or delete them here.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDrafts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-3" />
              Loading drafts...
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No saved drafts</p>
              <p className="text-sm mt-1">
                Save a purchase requisition as draft to continue editing later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <Card
                  key={draft.draftId}
                  className="border shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    {/* Draft Header Row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() =>
                            setExpandedDraftId(
                              expandedDraftId === draft.draftId ? null : draft.draftId
                            )
                          }
                        >
                          {expandedDraftId === draft.draftId ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {draft.basicInfo?.com_name || '—'} /{' '}
                              {draft.basicInfo?.brn_name || '—'} /{' '}
                              {draft.basicInfo?.dept_name || '—'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {draft.items?.length ?? 0} item{draft.items?.length !== 1 ? 's' : ''}
                            </Badge>
                            {draft.totalAmount > 0 && (
                              <Badge variant="secondary" className="text-xs text-green-700">
                                ₹{Number(draft.totalAmount).toFixed(2)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Saved: {formatDate(draft.savedAt)}</span>
                            {draft.updatedAt !== draft.savedAt && (
                              <span>· Updated: {formatDate(draft.updatedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingDraft(draft)}
                          title="Edit draft"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>

                        <Button
                          variant="default"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleSubmitDraft(draft.draftId)}
                          disabled={submittingId === draft.draftId}
                          title="Submit this draft"
                        >
                          {submittingId === draft.draftId ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
                          Submit
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(draft.draftId)}
                          title="Delete draft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Items Table */}
                    {expandedDraftId === draft.draftId && draft.items?.length > 0 && (
                      <div className="mt-4 border rounded-lg overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="w-[50px] text-center">#</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Est. Cost</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.items.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-center text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {item.prod_name || '—'}
                                </TableCell>
                                <TableCell>{item.qty ?? '—'}</TableCell>
                                <TableCell>{item.unit_name || '—'}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  ₹{(parseFloat(String(item.est_cost)) || 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="font-medium text-green-600">
                                  ₹{(parseFloat(String(item.total_cost)) || 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">
                                  {item.remarks || '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
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
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PRDraftListPage;
