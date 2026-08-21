import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, FileText, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useAppState } from '@/globalState/hooks/useAppState';
import { getServiceAgreementsForApproval, approveServiceAgreement } from '@/Services/Api';
import {
  socket,
  SOCKET_JOIN_SERVICE_AGREEMENT_APPROVAL,
  SOCKET_LEAVE_SERVICE_AGREEMENT_APPROVAL,
  SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED,
} from '@/Services/Socket';
import { toast } from 'sonner';

function parseJson(raw: any): any[] {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
}

const ServiceAgreementApprovalScreen: React.FC = () => {
  const { userData } = useAppState();
  const currentUser = Array.isArray(userData) ? userData[0] : userData;

  const [agreementList, setAgreementList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading: fetchLoading } = useFetch<{ success: boolean; data: any[] }>(
    getServiceAgreementsForApproval, '', null, refreshKey
  );
  const { postData, loading: submitting } = usePost();

  useEffect(() => {
    if (data) setAgreementList(data.data ?? []);
  }, [data]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_AGREEMENT_APPROVAL);
    const onUpdated = (payload: { agreement_sno: number; approved_by: string }) => {
      if (payload.approved_by === currentUser?.ecno) return;
      setRefreshKey((k) => k + 1);
    };
    socket.on(SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_AGREEMENT_APPROVAL);
      socket.off(SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED, onUpdated);
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
      await postData(approveServiceAgreement, {
        agreement_sno: selected.agreement_sno,
        action: actionType,
        comments: comments.trim(),
        approval_stages: stages,
      });
      setAgreementList((prev) => prev.filter((a) => a.agreement_sno !== selected.agreement_sno));
      setSelected(null);
      setShowDialog(false);
      toast.success(`Service agreement ${actionType === 'approve' ? 'approved' : 'rejected'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Action failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={FileText}
        title="Service Agreement Approvals"
        description="Fixed-recurring service agreements awaiting your approval"
      />

      <div className="container mx-auto py-6 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {fetchLoading && agreementList.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : agreementList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending Service Agreements</p>
          ) : (
            agreementList.map((a) => (
              <Card
                key={a.agreement_sno}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.agreement_sno === a.agreement_sno ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelected(a)}
              >
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-semibold text-sm">{a.agreement_no}</p>
                  <p className="text-xs text-muted-foreground">{a.service_name}</p>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    <Badge variant="outline" className="text-xs">{a.recurrence_cadence}</Badge>
                    <Badge variant="outline" className="text-xs">₹{Number(a.rate_amount).toLocaleString('en-IN')}</Badge>
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
                <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a Service Agreement to review</p>
              </div>
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>{selected.agreement_no}</CardTitle>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{selected.service_name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{selected.vendor_name || '—'}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rate</p>
                    <p className="font-medium">
                      ₹{Number(selected.rate_amount).toLocaleString('en-IN')}
                      {selected.rate_uom_name ? `/${selected.rate_uom_name}` : ''}
                    </p>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Cadence</p><p className="font-medium">{selected.recurrence_cadence}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Period</p>
                    <p className="font-medium">
                      {String(selected.period_start_date).slice(0, 10)} → {String(selected.period_end_date).slice(0, 10)}
                    </p>
                  </div>
                  {selected.remarks && (
                    <div className="sm:col-span-3"><p className="text-xs text-muted-foreground">Remarks</p><p className="font-medium">{selected.remarks}</p></div>
                  )}
                </div>

                {selected.agreement_doc_url && (
                  <a
                    href={selected.agreement_doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" /> View agreement document
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
            <DialogTitle>{actionType === 'approve' ? 'Approve Service Agreement' : 'Reject Service Agreement'}</DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? 'Optionally add a comment.' : 'A reason is required.'}
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

export default ServiceAgreementApprovalScreen;
