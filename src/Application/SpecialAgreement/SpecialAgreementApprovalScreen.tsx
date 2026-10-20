import React, { useEffect, useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '@/CustomComponent/PageComponents';
import SpecialAgreementApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/SpecialAgreementApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getSpecialAgreementsForApproval, approveSpecialAgreement } from '@/Services/Api';
import { ACTION_DONE_LABEL, type ApprovalAction } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { useServiceLive } from '@/hooks/useServiceLive';
import { getErrorMessage } from '@/lib/errors';
import type { SpecialAgreementRow } from './specialAgreementUtils';

const SpecialAgreementApprovalScreen: React.FC = () => {
  const [selected, setSelected] = useState<SpecialAgreementRow | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<ApprovalAction>('approve');
  const [sendBackTarget, setSendBackTarget] = useState('');
  const [comments, setComments] = useState('');
  // actioned rows leave the inbox immediately; the live refetch then confirms it
  const [actioned, setActioned] = useState<number[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { postData, loading } = usePost();
  const { data, loading: fetchLoading, error } = useFetch<{ success: boolean; data: SpecialAgreementRow[] }>(
    getSpecialAgreementsForApproval, '', null, refreshKey,
  );

  const list = useMemo(
    () => (data?.data ?? []).filter((a) => !actioned.includes(a.special_agreement_sno)),
    [data, actioned],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // anyone creating / actioning an agreement refreshes this inbox
  useServiceLive('special', () => { setActioned([]); setRefreshKey((k) => k + 1); });

  const handleAction = (action: string) => {
    setActionType(action as ApprovalAction);
    setSendBackTarget('');
    setComments('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const payload: Record<string, unknown> = {
      special_agreement_sno: selected.special_agreement_sno,
      action: actionType,
      comments: comments.trim(),
    };
    if (actionType === 'send_back') payload.send_back_to = sendBackTarget;
    try {
      await postData(approveSpecialAgreement, payload);
      // forward / send back hand it to someone else; approve moves it on or finishes it; reject ends it
      setActioned((prev) => [...prev, selected.special_agreement_sno]);
      setSelected(null);
      setShowDialog(false);
      setComments('');
      setToast({ message: `Agreement ${ACTION_DONE_LABEL[actionType]} successfully`, type: 'success' });
    } catch (err) {
      setToast({ message: getErrorMessage(err, 'Action failed'), type: 'error' });
    }
  };

  if (error) return <ErrorState fullPage message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;
  if (fetchLoading && list.length === 0) return <LoadingState fullPage message="Loading special agreements…" />;

  return (
    <SpecialAgreementApprovalScreenLayout
      approvalName="Special Agreements"
      agreementList={list}
      selectedAgreement={selected}
      handleAgreementSelect={setSelected}
      handleAction={handleAction}
      showApprovalDialog={showDialog}
      setShowApprovalDialog={setShowDialog}
      comments={comments}
      setComments={setComments}
      handleSubmit={handleSubmit}
      loading={loading}
      actionType={actionType}
      sendBackTarget={sendBackTarget}
      setSendBackTarget={setSendBackTarget}
      toast={toast}
    />
  );
};

export default SpecialAgreementApprovalScreen;
