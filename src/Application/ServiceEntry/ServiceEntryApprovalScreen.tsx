import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { PageHeader } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useAppState } from '@/globalState/hooks/useAppState';
import { getAllServiceEntries, serviceEntryApproveAction } from '@/Services/Api';
import {
  socket, SOCKET_JOIN_SERVICE_ENTRY, SOCKET_LEAVE_SERVICE_ENTRY, SOCKET_SERVICE_ENTRY_APPROVAL_UPDATED,
} from '@/Services/Socket';
import { toast } from 'sonner';

function parseJson(raw: any): any[] {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
}

const ServiceEntryApprovalScreen: React.FC = () => {
  const { userData } = useAppState();
  const currentUser = Array.isArray(userData) ? userData[0] : userData;

  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading: fetchLoading } = useFetch<{ success: boolean; data: any[] }>(
    getAllServiceEntries, '', { status: 'Pending', mine: 'true' }, refreshKey
  );
  const { postData, loading: submitting } = usePost();

  useEffect(() => { if (data) setList(data.data ?? []); }, [data]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_ENTRY);
    const onUpdated = (payload: { service_entry_sno: number; approved_by: string }) => {
      if (payload.approved_by === currentUser?.ecno) return;
      setRefreshKey(k => k + 1);
    };
    socket.on(SOCKET_SERVICE_ENTRY_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_ENTRY);
      socket.off(SOCKET_SERVICE_ENTRY_APPROVAL_UPDATED, onUpdated);
    };
  }, [currentUser]);

  const handleAction = (action: 'approve' | 'reject') => {
    setActionType(action);
    setComments('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    try {
      await postData(serviceEntryApproveAction, {
        service_entry_sno: selected.service_entry_sno,
        action: actionType,
        comments: comments.trim(),
      });
      setList(prev => prev.filter(e => e.service_entry_sno !== selected.service_entry_sno));
      setSelected(null);
      setShowDialog(false);
      toast.success(`Service Entry ${actionType === 'approve' ? 'approved' : 'rejected'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Action failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader icon={AlertTriangle} title="Service Entry Variance Approvals" description="Usage confirmations that exceeded their PO's variance tolerance" />

      <div className="container mx-auto py-6 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {fetchLoading && list.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending variance approvals</p>
          ) : (
            list.map(se => (
              <Card
                key={se.service_entry_sno}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.service_entry_sno === se.service_entry_sno ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelected(se)}
              >
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-semibold text-sm">#{se.service_entry_no} · {se.po_no}</p>
                  <p className="text-xs text-muted-foreground">{se.vendor_name}</p>
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-800 bg-amber-50">
                    {Number(se.variance_pct ?? 0).toFixed(1)}% variance
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-center">
              <div>
                <AlertTriangle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select an entry to review</p>
              </div>
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Service Entry #{selected.service_entry_no}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">PO</p><p className="font-medium">{selected.po_no}</p></div>
                  <div><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{selected.vendor_name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Period</p><p className="font-medium">{selected.period_from} → {selected.period_to}</p></div>
                  <div><p className="text-xs text-muted-foreground">Confirmed Amount</p><p className="font-medium">₹{Number(selected.confirmed_amount).toLocaleString('en-IN')}</p></div>
                  <div><p className="text-xs text-muted-foreground">Variance</p><p className="font-medium text-amber-700">{Number(selected.variance_pct ?? 0).toFixed(2)}%</p></div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">Lines</p>
                  <div className="space-y-2">
                    {parseJson(selected.items).map((item: any, idx: number) => (
                      <div key={item.service_entry_item_sno ?? idx} className="flex justify-between items-center text-sm rounded-lg border p-2.5">
                        <p className="font-medium">{item.service_name}</p>
                        <div className="text-right">
                          <p>Budgeted ₹{Number(item.po_amount).toLocaleString('en-IN')} → Confirmed ₹{Number(item.confirmed_amount).toLocaleString('en-IN')}</p>
                          <p className="text-xs text-muted-foreground">Diff ₹{Number(item.diff_amount).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => handleAction('approve')} className="flex-1 bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4 mr-2" />Approve
                  </Button>
                  <Button onClick={() => handleAction('reject')} variant="destructive" className="flex-1">
                    <XCircle className="h-4 w-4 mr-2" />Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? 'Approve Variance' : 'Reject Service Entry'}</DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? 'Confirm the amount despite exceeding tolerance.' : 'A reason is required.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Comments {actionType === 'reject' && <span className="text-red-500">*</span>}</Label>
            <Textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || (actionType === 'reject' && !comments.trim())}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {submitting ? 'Processing…' : actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceEntryApprovalScreen;
