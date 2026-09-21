import React, { useState, useEffect } from 'react';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import ServicePoApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ServicePoApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getServicePoCyclesForApproval, approveServicePoCycle } from '@/Services/Api';
import { useAppState } from '@/imports';
import {
  socket, SOCKET_JOIN_SERVICE_PO_APPROVAL, SOCKET_LEAVE_SERVICE_PO_APPROVAL,
  SOCKET_SERVICE_PO_APPROVAL_UPDATED,
} from '@/Services/Socket';

interface APIResponse {
  success: boolean;
  data: any[];
}

const ServicePoApprovalScreen: React.FC = () => {
  const [selectedCycle, setSelectedCycle] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [cycleList, setCycleList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getServicePoCyclesForApproval,
    "",
    null,
    refreshKey
  );

  useEffect(() => {
    if (data && !fetchLoading) setCycleList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_PO_APPROVAL);

    const onApprovalUpdated = (payload: { cycle_sno: number; approved_by?: string }) => {
      if (payload.approved_by === userData[0]?.ecno) return;
      setRefreshKey((k) => k + 1);
      setToast({ message: `A Service PO cycle was actioned — refreshing list…`, type: 'success' });
    };

    socket.on(SOCKET_SERVICE_PO_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_PO_APPROVAL);
      socket.off(SOCKET_SERVICE_PO_APPROVAL_UPDATED, onApprovalUpdated);
    };
  }, [userData]);

  const handleCycleSelect = (cycle: any) => setSelectedCycle(cycle);

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowApprovalDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedCycle) return;

    try {
      await postData(approveServicePoCycle, {
        cycle_sno: selectedCycle.cycle_sno,
        ecno: userData[0]?.ecno,
        action: actionType,
        comments: comments.trim(),
        approval_stages: (() => {
          try {
            const raw = selectedCycle.stage_order_json;
            if (!raw) return [];
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch { return []; }
        })(),
      });

      setCycleList((prev) => prev.filter((c) => c.cycle_sno !== selectedCycle.cycle_sno));
      setSelectedCycle(null);
      setShowApprovalDialog(false);
      setComments('');
      setToast({ message: `Service PO cycle ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return <ErrorState fullPage message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;
  }

  if (fetchLoading && cycleList.length === 0) {
    return <LoadingState fullPage message="Loading Service PO cycles…" />;
  }

  return (
    <ServicePoApprovalScreenLayout
      approvalName="Service PO Cycles"
      cycleList={cycleList}
      selectedCycle={selectedCycle}
      handleCycleSelect={handleCycleSelect}
      handleAction={handleAction}
      showApprovalDialog={showApprovalDialog}
      setShowApprovalDialog={setShowApprovalDialog}
      comments={comments}
      setComments={setComments}
      handleSubmit={handleSubmit}
      loading={loading}
      actionType={actionType}
      toast={toast}
    />
  );
};

export default ServicePoApprovalScreen;
