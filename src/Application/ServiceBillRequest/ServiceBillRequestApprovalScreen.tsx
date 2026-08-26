import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, Receipt, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useAppState } from '@/globalState/hooks/useAppState';
import { getServiceBillRequestsForApproval, approveServiceBillRequest } from '@/Services/Api';
import {
  socket,
  SOCKET_JOIN_SERVICE_BILL_REQUEST_APPROVAL,
  SOCKET_LEAVE_SERVICE_BILL_REQUEST_APPROVAL,
  SOCKET_SERVICE_BILL_REQUEST_APPROVAL_UPDATED,
} from '@/Services/Socket';
import { toast } from 'sonner';

function parseJson(raw: any): any[] {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
}

const ServiceBillRequestApprovalScreen: React.FC = () => {
  const { userData } = useAppState();
  const currentUser = Array.isArray(userData) ? userData[0] : userData;

  const [requestList, setRequestList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading: fetchLoading } = useFetch<{ success: boolean; data: any[] }>(
    getServiceBillRequestsForApproval, '', null, refreshKey
  );
  const { postData, loading: submitting } = usePost();

  useEffect(() => {
    if (data) setRequestList(data.data ?? []);
  }, [data]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_BILL_REQUEST_APPROVAL);
    const onUpdated = (payload: { bill_request_sno: number; approved_by: string }) => {
      if (payload.approved_by === currentUser?.ecno) return;
      setRefreshKey((k) => k + 1);
    };
    socket.on(SOCKET_SERVICE_BILL_REQUEST_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_BILL_REQUEST_APPROVAL);
      socket.off(SOCKET_SERVICE_BILL_REQUEST_APPROVAL_UPDATED, onUpdated);
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
      await postData(approveServiceBillRequest, {
        bill_request_sno: selected.bill_request_sno,
        action: actionType,
        comments: comments.trim(),
        approval_stages: stages,
      });
      setRequestList((prev) => prev.filter((r) => r.bill_request_sno !== selected.bill_request_sno));
      setSelected(null);
      setShowDialog(false);
      toast.success(`Service bill request ${actionType === 'approve' ? 'approved' : 'rejected'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Action failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={Receipt}
        title="Service Bill Request Approvals"
        description="Variable-recurring invoice values awaiting your approval — approving raises the Service PO automatically"
      />

      <div className="container mx-auto py-6 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {fetchLoading && requestList.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : requestList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending Service Bill Requests</p>
          ) : (
            requestList.map((r) => (
              <Card
                key={r.bill_request_sno}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.bill_request_sno === r.bill_request_sno ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelected(r)}
              >
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-semibold text-sm">{r.request_no}</p>
                  <p className="text-xs text-muted-foreground">{r.service_name}</p>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    <Badge variant="outline" className="text-xs">₹{Number(r.invoice_amount).toLocaleString('en-IN')}</Badge>
                    <Badge variant="outline" className="text-xs">ceiling ₹{Number(r.ceiling_amount).toLocaleString('en-IN')}</Badge>
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
                <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a Service Bill Request to review</p>
              </div>
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>{selected.request_no}</CardTitle>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{selected.service_name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{selected.vendor_name || '—'}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice amount</p>
                    <p className="font-medium">₹{Number(selected.invoice_amount).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ceiling agreement</p>
                    <p className="font-medium">
                      {selected.agreement_no} · ₹{Number(selected.ceiling_amount).toLocaleString('en-IN')} (+{selected.variance_tolerance_pct}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Billing period</p>
                    <p className="font-medium">
                      {String(selected.billing_period_start).slice(0, 10)} → {String(selected.billing_period_end).slice(0, 10)}
                    </p>
                  </div>
                  {selected.invoice_no && (
                    <div><p className="text-xs text-muted-foreground">Invoice no.</p><p className="font-medium">{selected.invoice_no}</p></div>
                  )}
                  {selected.invoice_date && (
                    <div><p className="text-xs text-muted-foreground">Invoice date</p><p className="font-medium">{String(selected.invoice_date).slice(0, 10)}</p></div>
                  )}
                  {selected.remarks && (
                    <div className="sm:col-span-3"><p className="text-xs text-muted-foreground">Remarks</p><p className="font-medium">{selected.remarks}</p></div>
                  )}
                </div>

                {selected.invoice_doc_url && (
                  <a
                    href={selected.invoice_doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Receipt className="h-4 w-4" /> View invoice document
                  </a>
                )}

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
            <DialogTitle>{actionType === 'approve' ? 'Approve Service Bill Request' : 'Reject Service Bill Request'}</DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? 'Approving auto-raises the Service PO to match this invoice amount.' : 'A reason is required.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Comments {actionType === 'reject' && <span className="text-red-500">*</span>}</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
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

export default ServiceBillRequestApprovalScreen;
