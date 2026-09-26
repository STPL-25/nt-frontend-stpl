import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import KYCApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/KYCApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { apiGetKycPendingApprovals, apiKycApproveAction } from '@/Services/Api';
import { useAppState } from '@/imports';
import { getErrorMessage } from '@/lib/errors';
import { parseStages } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { socket, SOCKET_JOIN_KYC_APPROVAL, SOCKET_LEAVE_KYC_APPROVAL, SOCKET_KYC_APPROVAL_UPDATED } from '@/Services/Socket';
import type { KYCApprovalRecord } from './types/KYCApprovalType';

interface APIResponse {
  success: boolean;
  data: KYCApprovalRecord[];
}

const KYCApprovalScreen: React.FC = () => {
  const [selectedKYC, setSelectedKYC] = useState<KYCApprovalRecord | null>(null);
  const [kycList, setKycList]         = useState<KYCApprovalRecord[]>([]);
  const [search, setSearch]           = useState('');
  const [showDialog, setShowDialog]   = useState(false);
  const [actionType, setActionType]   = useState<'approve' | 'reject'>('approve');
  const [comments, setComments]       = useState('');
  const [refreshKey, setRefreshKey]   = useState(0);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    apiGetKycPendingApprovals, '', null, refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setKycList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_KYC_APPROVAL);
    const onUpdated = (d: { kyc_basic_info_sno: number; action: string; approved_by: string }) => {
      if (d.approved_by === userData[0]?.ecno) return;
      setRefreshKey(k => k + 1);
      toast.info(`KYC ${d.action === 'approve' ? 'approved' : 'rejected'} — refreshing…`);
    };
    socket.on(SOCKET_KYC_APPROVAL_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_KYC_APPROVAL);
      socket.off(SOCKET_KYC_APPROVAL_UPDATED, onUpdated);
    };
  }, [userData]);

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedKYC) return;
    const payload = {
      kyc_basic_info_sno: selectedKYC.kyc_basic_info_sno,
      ecno: userData[0]?.ecno,
      action: actionType,
      comments: comments.trim(),
      approval_stages: parseStages(selectedKYC),
    };
    try {
      await postData(apiKycApproveAction, payload);
      setKycList(prev => prev.filter(k => k.kyc_basic_info_sno !== selectedKYC.kyc_basic_info_sno));
      setSelectedKYC(null);
      setShowDialog(false);
      setComments('');
      toast.success(`KYC ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Action failed'));
    }
  };

  const filteredList = useMemo(
    () => kycList.filter(k => !search || k.company_name.toLowerCase().includes(search.toLowerCase())),
    [kycList, search],
  );

  if (error) {
    return <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} fullPage />;
  }

  if (fetchLoading && kycList.length === 0) {
    return <LoadingState message="Loading KYC Approvals…" fullPage />;
  }

  return (
    <KYCApprovalScreenLayout
      approvalName="KYC Approvals"
      totalCount={kycList.length}
      kycList={filteredList}
      search={search}
      setSearch={setSearch}
      onRefresh={() => setRefreshKey(k => k + 1)}
      refreshing={fetchLoading}
      selectedKyc={selectedKYC}
      handleKycSelect={setSelectedKYC}
      handleAction={handleAction}
      showApprovalDialog={showDialog}
      setShowApprovalDialog={setShowDialog}
      comments={comments}
      setComments={setComments}
      handleSubmit={handleSubmit}
      loading={loading}
      actionType={actionType}
    />
  );
};

export default KYCApprovalScreen;
