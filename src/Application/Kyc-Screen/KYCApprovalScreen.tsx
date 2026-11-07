import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import KYCApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/KYCApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { apiActKycChangeRequest, apiGetKycChangeRequests, apiGetKycPendingApprovals, apiKycApproveAction } from '@/Services/Api';
import type { KycChangeRequest } from '@/Application/SupplierStatus/kycModifications';
import { changeRequestToRecord } from './kycChangeRequestRecord';
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
  // Suppliers' requests to change their own KYC that are waiting for this approver (grn sql/93): same list, same approval flow.
  const [changeRequests, setChangeRequests] = useState<KycChangeRequest[]>([]);

  const { userData } = useAppState();
  const { postData, loading } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    apiGetKycPendingApprovals, '', null, refreshKey,
  );

  useEffect(() => {
    if (data && !fetchLoading) setKycList(data.data ?? []);
  }, [data, fetchLoading]);

  useEffect(() => {
    let cancelled = false;
    axios.get<{ success: boolean; data: { waiting: KycChangeRequest[] } }>(apiGetKycChangeRequests)
      .then((res) => { if (!cancelled) setChangeRequests(res.data?.data?.waiting ?? []); })
      .catch((err) => {
        if (cancelled) return;
        setChangeRequests([]);
        // the new submissions above still work; say so rather than silently hiding the suppliers' change requests
        toast.error(getErrorMessage(err, 'Could not load the suppliers’ change requests'));
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

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

    // A supplier's change request: the same approve / reject, sent to the change-request endpoint (the approver is the session's).
    if (selectedKYC.change_request) {
      const request = selectedKYC.change_request;
      if (actionType === 'reject' && !comments.trim()) { toast.error('Tell the supplier why the change is rejected.'); return; }
      try {
        const res = (await postData(apiActKycChangeRequest, {
          kyc_modified_sno: request.kyc_modified_sno, action: actionType, note: comments.trim() || undefined,
        })) as { message?: string } | null;
        setChangeRequests(prev => prev.filter(r => r.kyc_modified_sno !== request.kyc_modified_sno));
        setSelectedKYC(null);
        setShowDialog(false);
        setComments('');
        toast.success(res?.message ?? `Change request ${actionType === 'approve' ? 'approved' : 'rejected'}`);
      } catch (err: any) {
        toast.error(getErrorMessage(err, 'Action failed'));
      }
      return;
    }

    const payload = {
      kyc_basic_info_sno: selectedKYC.kyc_basic_info_sno,
      ecno: userData[0]?.ecno,
      action: actionType,
      comments: comments.trim(),
      approval_stages: parseStages(selectedKYC),
    };
    try {
      const res = (await postData(apiKycApproveAction, payload)) as {
        data?: { supplier_invite?: { loginCreated?: boolean; emailSent?: boolean; reason?: string };
                 resubmit_link?: { issued?: boolean; emailSent?: boolean; sent_to?: string; reason?: string } }[];
      } | null;
      setKycList(prev => prev.filter(k => k.kyc_basic_info_sno !== selectedKYC.kyc_basic_info_sno));
      setSelectedKYC(null);
      setShowDialog(false);
      setComments('');
      toast.success(`KYC ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      // The final approval also creates the supplier's portal login and e-mails the temporary password. That step cannot undo the
      // approval, so when it fails the supplier has a code but cannot sign in - say so instead of leaving it silent.
      const invite = res?.data?.find((r) => r?.supplier_invite)?.supplier_invite;
      if (actionType === 'approve' && invite && (!invite.loginCreated || !invite.emailSent)) {
        toast.warning(invite.reason ?? 'The supplier portal login or its invite e-mail could not be completed.', { duration: 15000 });
      }
      // A rejection also e-mails the supplier a private link to correct the KYC (sql/155). Say whether that worked - the supplier
      // otherwise has no way to know, and a rejected KYC with no link is a dead end.
      const link = res?.data?.find((r) => r?.resubmit_link)?.resubmit_link;
      if (actionType === 'reject' && link) {
        if (link.issued && link.emailSent) toast.info(`A private link to correct the KYC was e-mailed to ${link.sent_to}.`, { duration: 8000 });
        else toast.warning(`${link.reason ?? 'The correction link could not be sent.'} Open Supplier Status to send it again.`, { duration: 15000 });
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Action failed'));
    }
  };

  // New submissions first, then the suppliers' change requests - one list, one approval flow
  const allRecords = useMemo(
    () => [...kycList, ...changeRequests.map(changeRequestToRecord)],
    [kycList, changeRequests],
  );

  const filteredList = useMemo(
    () => allRecords.filter(k => !search || k.company_name.toLowerCase().includes(search.toLowerCase())
      || (k.supp_code ?? '').toLowerCase().includes(search.toLowerCase())),
    [allRecords, search],
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
      totalCount={allRecords.length}
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
