import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import ApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getPrRecords, prApproveAction } from '@/Services/Api';
import { useAppState } from '@/imports';
import { usePrApprovalSideCardDatas } from '@/FieldDatas/PrApprovalData';
import { socket, SOCKET_JOIN_PR_APPROVAL, SOCKET_LEAVE_PR_APPROVAL, SOCKET_PR_APPROVAL_UPDATED } from '@/Services/Socket';

interface APIResponse {
  success: boolean;
  data: any[];
}

const PRApprovalScreen: React.FC = () => {
  const [selectedPR, setSelectedPR] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [prList, setPrList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const fieldDatas = usePrApprovalSideCardDatas();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getPrRecords,
    "",
    { ecno: userData[0]?.ecno },
    refreshKey
  );

  useEffect(() => {
    if (data && !fetchLoading) {
      setPrList(data.data ?? []);
    }
  }, [data, fetchLoading]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Socket: join pr:approval room and refresh list when another user approves
  useEffect(() => {
    socket.emit(SOCKET_JOIN_PR_APPROVAL);

    const onApprovalUpdated = (data: { pr_no: string; approved_by: string }) => {
      if (data.approved_by === userData[0]?.ecno) return; // own action — list already updated locally
      setRefreshKey(k => k + 1);
      setToast({ message: `PR ${data.pr_no} was actioned — refreshing list…`, type: 'success' });
    };

    socket.on(SOCKET_PR_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_PR_APPROVAL);
      socket.off(SOCKET_PR_APPROVAL_UPDATED, onApprovalUpdated);
    };
  }, [userData]);

  const handlePRSelect = (pr: any) => {
    setSelectedPR(pr);
  };

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowApprovalDialog(true);
  };
  const handleSubmit = async () => {
    if (!selectedPR) return;

    const rawStages = selectedPR.stage_order_json;
    console.log("handleSubmit called — selectedPR:", selectedPR.pr_no);
    console.log("Raw stages from DB:", rawStages);

    let approval_stages: any[] = [];
    if (rawStages) {
      try {
        approval_stages = typeof rawStages === 'string' ? JSON.parse(rawStages) : rawStages;
      } catch {
        approval_stages = [];
      }
    }

    const payload = {
      pr_no: selectedPR.pr_no,
      ecno: userData[0]?.ecno,
      comments: comments.trim(),
      approval_stages,
    };
    console.log("Posting payload:", payload);

    try {
      const result = await postData(prApproveAction, payload);
      console.log("Submit response:", result);

      setPrList(prev => prev.filter(pr => pr.pr_no !== selectedPR.pr_no));
      setSelectedPR(null);
      setShowApprovalDialog(false);
      setComments('');
      setToast({ message: `PR ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
    } catch (err: any) {
      console.error("Submit error:", err);
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">Error Loading Data</h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (fetchLoading && prList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Clock className="h-16 w-16 text-slate-300 dark:text-slate-700 mx-auto animate-spin" />
          <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">
            Loading Purchase Requisitions...
          </h3>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <ApprovalScreenLayout
        approvalName="Purchase Requisitions"
        prList={prList}
        selectedPR={selectedPR}
        handlePRSelect={handlePRSelect}
        handleAction={handleAction}
        showApprovalDialog={showApprovalDialog}
        setShowApprovalDialog={setShowApprovalDialog}
        action={actionType}
        comments={comments}
        setComments={setComments}
        handleSubmit={handleSubmit}
        loading={loading}
        actionType={actionType}
        fieldDatas={fieldDatas}
      />
    </>
  );
};

export default PRApprovalScreen;
