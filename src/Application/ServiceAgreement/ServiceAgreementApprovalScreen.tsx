import React, { useState, useEffect } from 'react';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import ServiceAgreementApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ServiceAgreementApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getServiceAgreementsForApproval, approveServiceAgreement } from '@/Services/Api';
import { useAppState } from '@/imports';
import {
  socket, SOCKET_JOIN_SERVICE_AGREEMENT_APPROVAL, SOCKET_LEAVE_SERVICE_AGREEMENT_APPROVAL,
  SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED,
} from '@/Services/Socket';

interface APIResponse {
  success: boolean;
  data: any[];
}

function parseStages(agreement: any): any[] {
  try {
    const raw = agreement?.stage_order_json;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

const ServiceAgreementApprovalScreen: React.FC = () => {
  const [selectedAgreement, setSelectedAgreement] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [agreementList, setAgreementList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getServiceAgreementsForApproval,
    "",
    null,
    refreshKey
  );

  useEffect(() => {
    if (data && !fetchLoading) setAgreementList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_AGREEMENT_APPROVAL);

    const onApprovalUpdated = (payload: { agreement_sno: number; approved_by: string }) => {
      if (payload.approved_by === userData[0]?.ecno) return;
      setRefreshKey((k) => k + 1);
      setToast({ message: `Agreement was actioned — refreshing list…`, type: 'success' });
    };

    socket.on(SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_AGREEMENT_APPROVAL);
      socket.off(SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED, onApprovalUpdated);
    };
  }, [userData]);

  const handleAgreementSelect = (agreement: any) => setSelectedAgreement(agreement);

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowApprovalDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedAgreement) return;

    const approval_stages = parseStages(selectedAgreement);

    const payload: Record<string, any> = {
      agreement_sno: selectedAgreement.agreement_sno,
      ecno: userData[0]?.ecno,
      action: actionType,
      comments: comments.trim(),
      approval_stages,
    };

    try {
      await postData(approveServiceAgreement, payload);

      setAgreementList((prev) => prev.filter((a) => a.agreement_sno !== selectedAgreement.agreement_sno));
      setSelectedAgreement(null);
      setShowApprovalDialog(false);
      setComments('');
      setToast({ message: `Agreement ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return <ErrorState fullPage message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;
  }

  if (fetchLoading && agreementList.length === 0) {
    return <LoadingState fullPage message="Loading service agreements…" />;
  }

  return (
    <ServiceAgreementApprovalScreenLayout
      approvalName="Service Agreements"
      agreementList={agreementList}
      selectedAgreement={selectedAgreement}
      handleAgreementSelect={handleAgreementSelect}
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

export default ServiceAgreementApprovalScreen;
