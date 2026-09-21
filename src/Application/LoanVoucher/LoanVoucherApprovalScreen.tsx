import React, { useState, useEffect } from 'react';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import LoanVoucherApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/LoanVoucherApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getBankPaymentVouchersForApproval, approveBankPaymentVoucher } from '@/Services/Api';
import { useAppState } from '@/imports';
import {
  socket, SOCKET_JOIN_LOAN_VOUCHER_APPROVAL, SOCKET_LEAVE_LOAN_VOUCHER_APPROVAL,
  SOCKET_LOAN_VOUCHER_APPROVAL_UPDATED,
} from '@/Services/Socket';

interface APIResponse {
  success: boolean;
  data: any[];
}

const LoanVoucherApprovalScreen: React.FC = () => {
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [voucherList, setVoucherList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getBankPaymentVouchersForApproval,
    '',
    null,
    refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setVoucherList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_LOAN_VOUCHER_APPROVAL);

    const onApprovalUpdated = (payload: { voucher_sno: number; approved_by?: string }) => {
      if (payload.approved_by === userData[0]?.ecno) return;
      setRefreshKey((k) => k + 1);
      setToast({ message: 'A bank payment voucher was actioned — refreshing list…', type: 'success' });
    };

    socket.on(SOCKET_LOAN_VOUCHER_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_LOAN_VOUCHER_APPROVAL);
      socket.off(SOCKET_LOAN_VOUCHER_APPROVAL_UPDATED, onApprovalUpdated);
    };
  }, [userData]);

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setComments('');
    setShowApprovalDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedVoucher) return;

    try {
      // The server reads the workflow stages itself and only lets the voucher's current
      // approver act — nothing here (not even the approver's ecno) is trusted.
      await postData(approveBankPaymentVoucher, {
        voucher_sno: selectedVoucher.voucher_sno,
        action: actionType,
        comments: comments.trim(),
      });

      setVoucherList((prev) => prev.filter((v) => v.voucher_sno !== selectedVoucher.voucher_sno));
      setSelectedVoucher(null);
      setShowApprovalDialog(false);
      setComments('');
      setToast({ message: `Bank payment voucher ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
      // A multi-stage workflow hands it to the next approver — re-read so the list is truthful.
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return <ErrorState fullPage message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;
  }

  if (fetchLoading && voucherList.length === 0) {
    return <LoadingState fullPage message="Loading bank payment vouchers…" />;
  }

  return (
    <LoanVoucherApprovalScreenLayout
      approvalName="Bank Payment Vouchers"
      voucherList={voucherList}
      selectedVoucher={selectedVoucher}
      handleVoucherSelect={setSelectedVoucher}
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

export default LoanVoucherApprovalScreen;
