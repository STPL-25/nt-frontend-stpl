import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import ApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getPrRecords, prApproveAction, purchaseTeamSendPOEmail } from '@/Services/Api';
import { useAppState } from '@/imports';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { usePrApprovalSideCardDatas } from '@/FieldDatas/PrApprovalData';
import { socket, SOCKET_JOIN_PR_APPROVAL, SOCKET_LEAVE_PR_APPROVAL, SOCKET_PR_APPROVAL_UPDATED } from '@/Services/Socket';
import { generatePOPdf } from '@/utils/generatePOPdf';
import { buildVendorDrivenPOPdfBlob } from '@/Application/PurchaseOrder/PurchaseTeam/generateVendorDrivenPOPdfBlob';

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
  const { canEdit } = usePermissions();
  const fieldDatas = usePrApprovalSideCardDatas();
  const { postData, loading } = usePost();
  const { postData: postSendPOEmail } = usePost();

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

  // Vendor-driven PRs have no quotation step and no manual "Send to
  // Supplier" button — sp_nt_CreateVendorDrivenPOFromPR already auto-issued
  // the child PO the moment final approval landed (PR.controller.js#approvePr),
  // so the PO just needs to be emailed to the vendor right away. Mirrors
  // POApprovalScreen.tsx's sendFinalPOToSupplier for the normal flow: build
  // the PDF client-side, upload it to the same /sendPOEmail endpoint. Errors
  // are caught here and never thrown — the approval itself already
  // succeeded and must not be affected by an email failure.
  const sendVendorDrivenPOToVendor = async (autoPo: any) => {
    try {
      if (!autoPo?.po_basic_sno || !autoPo?.po_no || !autoPo?.vendor_sno) return;

      let items: any[] = [];
      try {
        items = typeof autoPo.items === 'string' ? JSON.parse(autoPo.items) : (autoPo.items ?? []);
      } catch {
        items = [];
      }

      const pdfBlob = buildVendorDrivenPOPdfBlob({
        po_no: autoPo.po_no,
        po_date: autoPo.po_date,
        required_date: autoPo.required_date,
        purpose: autoPo.purpose,
        company_name: autoPo.company_name,
        pr_no: selectedPR?.pr_no,
        items,
      });

      const fd = new FormData();
      fd.append('vendor_sno', String(autoPo.vendor_sno));
      fd.append('po_no', String(autoPo.po_no));
      fd.append('po_date', autoPo.po_date ?? '');
      fd.append('required_date', autoPo.required_date ?? '');
      fd.append('items', JSON.stringify(items));
      fd.append('po_basic_sno', String(autoPo.po_basic_sno));
      fd.append('po_pdf', pdfBlob, `${autoPo.po_no}.pdf`);

      await postSendPOEmail(purchaseTeamSendPOEmail, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
    } catch (error) {
      console.error('Unable to auto-send the vendor-driven PO to the vendor:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPR) return;
    
    const rawStages = selectedPR.stage_order_json;



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
      action: actionType,
      comments: comments.trim(),
      approval_stages,
    };

    try {
      const result = await postData(prApproveAction, payload);

      const approvalData = result?.decrypted?.data?.[0];
      const autoPo = result?.decrypted?.auto_po;
      if (approvalData?.next_approver === 'FINAL_STAGE') {
        if (approvalData?.request_mode === 'VENDOR_DRIVEN' && autoPo?.result === 'SUCCESS') {
          await sendVendorDrivenPOToVendor(autoPo);
        } else {
          generatePOPdf(selectedPR, approvalData);
        }
      }

      setPrList(prev => prev.filter(pr => pr.pr_no !== selectedPR.pr_no));
      setSelectedPR(null);
      setShowApprovalDialog(false);
      setComments('');
      setToast({ message: `PR ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`, type: 'success' });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Action failed';
      setToast({ message, type: 'error' });
    }
  };

  if (error) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h3 className="text-xl font-semibold text-muted-foreground dark:text-muted-foreground/70">Error Loading Data</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (fetchLoading && prList.length === 0) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Clock className="h-16 w-16 text-slate-300 dark:text-foreground mx-auto animate-spin" />
          <h3 className="text-xl font-semibold text-muted-foreground dark:text-muted-foreground/70">
            Loading Purchase Requisitions...
          </h3>
        </div>
      </div>
    );
  }

  return (
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
      toast={toast}
    />
  );
};

export default PRApprovalScreen;
