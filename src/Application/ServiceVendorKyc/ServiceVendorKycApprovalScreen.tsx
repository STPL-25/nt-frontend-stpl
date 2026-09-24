import React, { useState, useEffect } from 'react';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import ServiceVendorKycApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ServiceVendorKycApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getServiceVendorKycsForApproval, approveServiceVendorKyc } from '@/Services/Api';
import { useAppState } from '@/imports';
import {
  socket, SOCKET_JOIN_SERVICE_VENDOR_KYC_APPROVAL, SOCKET_LEAVE_SERVICE_VENDOR_KYC_APPROVAL,
  SOCKET_SERVICE_VENDOR_KYC_APPROVAL_UPDATED,
} from '@/Services/Socket';

interface APIResponse {
  success: boolean;
  data: any[];
}

function parseStages(kyc: any): any[] {
  try {
    const raw = kyc?.stage_order_json;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

const ServiceVendorKycApprovalScreen: React.FC = () => {
  const [selectedKyc, setSelectedKyc] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [kycList, setKycList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getServiceVendorKycsForApproval,
    '',
    null,
    refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setKycList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_VENDOR_KYC_APPROVAL);

    const onApprovalUpdated = (payload: { service_vendor_kyc_sno: number; approved_by?: string }) => {
      if (payload.approved_by === userData[0]?.ecno) return;
      setRefreshKey((k) => k + 1);
      setToast({ message: 'A service vendor KYC was actioned — refreshing list…', type: 'success' });
    };

    socket.on(SOCKET_SERVICE_VENDOR_KYC_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_VENDOR_KYC_APPROVAL);
      socket.off(SOCKET_SERVICE_VENDOR_KYC_APPROVAL_UPDATED, onApprovalUpdated);
    };
  }, [userData]);

  const handleKycSelect = (kyc: any) => setSelectedKyc(kyc);

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowApprovalDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedKyc) return;

    const approval_stages = parseStages(selectedKyc);

    const payload: Record<string, any> = {
      service_vendor_kyc_sno: selectedKyc.service_vendor_kyc_sno,
      action: actionType,
      comments: comments.trim(),
      approval_stages,
    };

    try {
      await postData(approveServiceVendorKyc, payload);

      setKycList((prev) => prev.filter((k) => k.service_vendor_kyc_sno !== selectedKyc.service_vendor_kyc_sno));
      setSelectedKyc(null);
      setShowApprovalDialog(false);
      setComments('');
      setToast({ message: `KYC ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return <ErrorState fullPage message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;
  }

  if (fetchLoading && kycList.length === 0) {
    return <LoadingState fullPage message="Loading service vendor KYCs…" />;
  }

  return (
    <ServiceVendorKycApprovalScreenLayout
      approvalName="Service Vendor KYC"
      kycList={kycList}
      selectedKyc={selectedKyc}
      handleKycSelect={handleKycSelect}
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

export default ServiceVendorKycApprovalScreen;
