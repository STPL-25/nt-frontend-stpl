import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import POApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/POApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getPoRecords, poApproveAction, purchaseTeamSendPOEmail } from '@/Services/Api';
import { useAppState } from '@/imports';
import { buildPOApprovalPdf } from '@/utils/generatePOApprovalPdf';
import { usePoApprovalSideCardDatas } from '@/FieldDatas/PoApprovalData';
import { socket, SOCKET_JOIN_PO_APPROVAL, SOCKET_LEAVE_PO_APPROVAL, SOCKET_PO_APPROVAL_UPDATED } from '@/Services/Socket';

interface APIResponse {
  success: boolean;
  data: any[];
}

function parseJSON(raw: any, fallback: any = []): any {
  if (!raw) return fallback;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

const POApprovalScreen: React.FC = () => {
  const [selectedPR, setSelectedPR] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'forward' | 'backward'>('approve');
  const [comments, setComments] = useState('');
  const [backwardTarget, setBackwardTarget] = useState('');
  const [prList, setPrList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const fieldDatas = usePoApprovalSideCardDatas();
  const { postData, loading } = usePost();
  const { postData: postSendPOEmail } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getPoRecords,
    '',
    { ecno: userData[0]?.ecno },
    refreshKey
  );

  useEffect(() => {
    if (data && !fetchLoading) {
      setPrList(data.data ?? []);
    }
  }, [data, fetchLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    socket.emit(SOCKET_JOIN_PO_APPROVAL);

    const onApprovalUpdated = (data: { sq_no?: string; po_no?: string; approved_by: string }) => {
      if (data.approved_by === userData[0]?.ecno) return;
      setRefreshKey(k => k + 1);
      const ref = data.sq_no ?? data.po_no ?? '';
      setToast({ message: `Quotation ${ref} was actioned — refreshing list…`, type: 'success' });
    };

    socket.on(SOCKET_PO_APPROVAL_UPDATED, onApprovalUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_PO_APPROVAL);
      socket.off(SOCKET_PO_APPROVAL_UPDATED, onApprovalUpdated);
    };
  }, [userData]);

  const handlePRSelect = (pr: any) => {
    setSelectedPR(pr);
  };

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject' | 'forward' | 'backward');
    setComments('');
    setBackwardTarget('');
    setShowApprovalDialog(true);
  };

  // On final-stage approval, sp_nt_ApproveSupplierQuotation has already created
  // the real po_request_info row (po_header.po_basic_sno / po_df_no) and
  // returned the vendor's email. Save a local copy for the approver, then
  // upload the same PDF so the backend can email the supplier, store it on
  // FTP, and make it available for download in the supplier portal.
  const sendFinalPOToSupplier = async (approvalData: any, selectedQuotation: any) => {
    try {
      const poHeader = parseJSON(approvalData?.po_header, {});
      const vendor = parseJSON(approvalData?.vendor, {});
      const poItems = parseJSON(approvalData?.po_items, []);

      const { doc, fileName } = await buildPOApprovalPdf(selectedPR, selectedQuotation, approvalData);
      doc.save(fileName);

      if (!poHeader.po_no && !poHeader.po_df_no) return;
      if (!vendor.vendor_sno) return;

      const emailItems = (Array.isArray(poItems) ? poItems : []).map((item: any) => ({
        prod_name: item.prod_name,
        qty: item.qty,
        unit_name: item.uom_name,
        unit_price: item.agreed_unit_price,
        total_amount: item.net_cost,
      }));

      const fd = new FormData();
      fd.append('vendor_sno', String(vendor.vendor_sno));
      fd.append('po_no', String(poHeader.po_df_no ?? poHeader.po_no));
      fd.append('po_date', poHeader.po_date ?? '');
      fd.append('required_date', poHeader.pr_required_date ?? '');
      fd.append('terms_conditions', poHeader.terms_conditions ?? '');
      fd.append('delivery_address', poHeader.branch_address ?? '');
      fd.append('items', JSON.stringify(emailItems));
      if (poHeader.po_basic_sno) fd.append('po_basic_sno', String(poHeader.po_basic_sno));
      fd.append('po_pdf', doc.output('blob'), fileName);

      await postSendPOEmail(purchaseTeamSendPOEmail, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
    } catch (error) {
      console.error('Unable to send the final PO to the supplier:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPR) return;

    const quotations: any[] = parseJSON(selectedPR.quotations, []);
    let selectedQuotation = quotations.find((q: any) => q.is_selected);
    // Flat API: each record is already the selected quotation
    if (!selectedQuotation && (selectedPR.quotation_ref_no || selectedPR.sq_basic_sno)) {
      selectedQuotation = selectedPR;
    }
    if (!selectedQuotation) return;

    const approval_stages: any[] = parseJSON(selectedQuotation.stage_order_json, []);
    const currentStage = approval_stages.find(s => s.approver_ecno === userData[0]?.ecno);

    const payload: any = {
      sq_basic_sno: selectedQuotation.sq_basic_sno,
      quotation_ref_no: selectedQuotation.quotation_ref_no,
      ecno: userData[0]?.ecno,
      action: actionType,
      comments: comments.trim(),
      approval_stages,
      vendor_details: {
        vendor_sno: selectedQuotation.vendor_sno,
        company_name: selectedQuotation.company_name,
        supp_code: selectedQuotation.supp_code,
        contact_person: selectedQuotation.contact_person,
        email: selectedQuotation.email,
        mobile_number: selectedQuotation.mobile_number,
        gst_no: selectedQuotation.gst_no,
        pan_no: selectedQuotation.pan_no,
        business_type: selectedQuotation.business_type,
        kyc_address: parseJSON(selectedQuotation.kyc_address, []),
      },
    };

    if (actionType === 'forward') payload.forward_to = currentStage?.next_approver_ecno;
    if (actionType === 'backward') payload.backward_to = backwardTarget;

    try {
      const result = await postData(poApproveAction, payload);

      if (actionType === 'approve') {
        const approvalData = result?.decrypted?.data?.[0] ?? result?.data?.[0];
        const isFinalStage =
          approvalData?.is_final === 'Y' ||
          approvalData?.result === 'FINAL_APPROVED' ||
          approvalData?.next_approver === 'FINAL_STAGE' ||
          (approval_stages.length > 0 &&
            approval_stages[approval_stages.length - 1]?.approver_ecno === userData[0]?.ecno);
        if (isFinalStage) {
          sendFinalPOToSupplier(approvalData, selectedQuotation);
        }
      }

      const actionLabel =
        actionType === 'approve' ? 'approved'
        : actionType === 'reject' ? 'rejected'
        : actionType === 'forward' ? 'forwarded'
        : 'sent back';

      setPrList(prev => prev.filter(pr => pr.pr_no !== selectedPR.pr_no));
      setSelectedPR(null);
      setShowApprovalDialog(false);
      setComments('');
      setBackwardTarget('');
      setToast({ message: `Quotation ${actionLabel} successfully`, type: 'success' });
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
            Loading…
          </h3>
        </div>
      </div>
    );
  }

  return (
    <POApprovalScreenLayout
      approvalName="PO Approvals"
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
      backwardTarget={backwardTarget}
      setBackwardTarget={setBackwardTarget}
    />
  );
};

export default POApprovalScreen;
