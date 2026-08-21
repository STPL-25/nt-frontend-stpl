import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, Wrench, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useAppState } from '@/globalState/hooks/useAppState';
import { getServicePORecords, servicePoApproveAction } from '@/Services/Api';
import {
  socket, SOCKET_JOIN_SERVICE_PO_APPROVAL, SOCKET_LEAVE_SERVICE_PO_APPROVAL, SOCKET_SERVICE_PO_APPROVAL_UPDATED,
} from '@/Services/Socket';
import { toast } from 'sonner';

function parseJson(raw: any): any[] {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
}

const ServicePOApprovalScreen: React.FC = () => {
  const { userData } = useAppState();
  const currentUser = Array.isArray(userData) ? userData[0] : userData;

  const [poList, setPoList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading: fetchLoading } = useFetch<{ success: boolean; data: any[] }>(
    getServicePORecords, '', null, refreshKey
  );
  const { postData, loading: submitting } = usePost();

  useEffect(() => {
    if (data) setPoList(data.data ?? []);
  }, [data]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_PO_APPROVAL);
    const onUpdated = (payload: { po_basic_sno: number; approved_by: string }) => {
      if (payload.approved_by === currentUser?.ecno) return;
      setRefreshKey(k => k + 1);
    };
    socket.on(SOCKET_SERVICE_PO_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_PO_APPROVAL);
      socket.off(SOCKET_SERVICE_PO_APPROVAL_UPDATED, onUpdated);
    };
  }, [currentUser]);

  const handleAction = (action: 'approve' | 'reject') => {
    setActionType(action);
    setComments('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const stages = parseJson(selected.stage_order_json);

    try {
      await postData(servicePoApproveAction, {
        po_basic_sno: selected.po_basic_sno,
        action: actionType,
        comments: comments.trim(),
        approval_stages: stages,
      });
      setPoList(prev => prev.filter(p => p.po_basic_sno !== selected.po_basic_sno));
      setSelected(null);
      setShowDialog(false);
      toast.success(`Service PO ${actionType === 'approve' ? 'approved' : 'rejected'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Action failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader icon={Wrench} title="Service PO Approvals" description="Standing / one-time service purchase orders awaiting your approval" />

      <div className="container mx-auto py-6 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {fetchLoading && poList.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : poList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending Service POs</p>
          ) : (
            poList.map(po => (
              <Card
                key={po.po_basic_sno}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.po_basic_sno === po.po_basic_sno ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelected(po)}
              >
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-semibold text-sm">{po.po_no}</p>
                  <p className="text-xs text-muted-foreground">{po.vendor_name}</p>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    <Badge variant="outline" className="text-xs">{po.service_type_name}</Badge>
                    <Badge variant="outline" className="text-xs">{po.po_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-center">
              <div>
                <Wrench className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a Service PO to review</p>
              </div>
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>{selected.po_no}</CardTitle>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{selected.service_type_name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{selected.vendor_name}</p></div>
                  <div><p className="text-xs text-muted-foreground">PO Type</p><p className="font-medium">{selected.po_type}</p></div>
                  <div><p className="text-xs text-muted-foreground">Source PR</p><p className="font-medium">{selected.pr_no || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Validity</p><p className="font-medium">{selected.validity_from} → {selected.validity_to}</p></div>
                  {selected.ceiling_amount != null && (
                    <div><p className="text-xs text-muted-foreground">Ceiling</p><p className="font-medium">₹{Number(selected.ceiling_amount).toLocaleString('en-IN')}</p></div>
                  )}
                  {selected.variance_tolerance_pct != null && (
                    <div><p className="text-xs text-muted-foreground">Variance Tolerance</p><p className="font-medium">{selected.variance_tolerance_pct}%</p></div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">Items</p>
                  <div className="space-y-2">
                    {parseJson(selected.items).map((item: any, idx: number) => (
                      <div key={item.po_item_sno ?? idx} className="flex justify-between items-center text-sm rounded-lg border p-2.5">
                        <div>
                          <p className="font-medium">{item.service_name}</p>
                          <p className="text-xs text-muted-foreground">{item.po_section} · qty {item.qty}</p>
                        </div>
                        <p className="font-semibold">₹{Number(item.net_cost || 0).toLocaleString('en-IN')}</p>
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
            <DialogTitle>{actionType === 'approve' ? 'Approve Service PO' : 'Reject Service PO'}</DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? 'Optionally add a comment.' : 'A reason is required.'}
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

export default ServicePOApprovalScreen;
