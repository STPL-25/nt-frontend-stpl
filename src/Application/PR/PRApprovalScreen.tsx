import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import ApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { getPrRecords, getPrApprovalContext, prApproveAction, purchaseTeamSendPOEmail } from '@/Services/Api';
import { useAppState } from '@/imports';
import { usePrApprovalSideCardDatas } from '@/FieldDatas/PrApprovalData';
import { socket, SOCKET_JOIN_PR_APPROVAL, SOCKET_LEAVE_PR_APPROVAL, SOCKET_PR_APPROVAL_UPDATED } from '@/Services/Socket';
import { generatePOPdf } from '@/utils/generatePOPdf';
import { buildVendorDrivenPOPdfBlob } from '@/Application/PurchaseOrder/PurchaseTeam/generateVendorDrivenPOPdfBlob';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { getErrorMessage } from '@/lib/errors';
import {
  buildEditPayload, initEditDraft, successMessage, validateEditDraft,
  type ApprovalContext, type EditDraft, type PrAction,
} from '@/Application/PR/prApprovalContext';

interface APIResponse {
  success: boolean;
  data: any[];
}

// Priority names are always needed (the edit form); the rest depend on which fields this PR's workflow type
// offers for its conditions (categories, suppliers, ...) — see approvalContext.fields.
const ALWAYS_MASTERS = ['PriorityMaster'];

const parseItems = (pr: any): any[] => {
  try {
    const raw = pr?.pr_item_details ?? pr?.items;
    if (typeof raw === 'string') return JSON.parse(raw);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const PRApprovalScreen: React.FC = () => {
  const [selectedPR, setSelectedPR] = useState<any | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [actionType, setActionType] = useState<PrAction>('approve');
  const [comments, setComments] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [prList, setPrList] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextKey, setContextKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { userData } = useAppState();
  const fieldDatas = usePrApprovalSideCardDatas();
  const { postData, loading } = usePost();
  const { postData: postSendPOEmail } = usePost();

  const { data, loading: fetchLoading, error } = useFetch<APIResponse>(
    getPrRecords,
    "",
    { ecno: userData[0]?.ecno },
    refreshKey
  );

  // What the engine says about the selected PR: its path, what this user may do, targets, log.
  const { data: contextResponse, loading: contextLoading } = useFetch<{ success: boolean; data: ApprovalContext }>(
    selectedPR ? getPrApprovalContext : null,
    "",
    selectedPR ? { pr_no: selectedPR.pr_no } : null,
    contextKey
  );
  const approvalContext = contextResponse?.data ?? null;

  // Names for the rule text on the approval path: one master per list field the workflow type offers.
  const masterSources = useMemo(
    () => [...new Set([...ALWAYS_MASTERS, ...(approvalContext?.fields ?? []).map(f => f.option_source).filter((s): s is string => !!s)])],
    [approvalContext]
  );
  const { options: masters } = useMasterOptions(masterSources);
  const conditionLookups = masters ?? {};

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
      setContextKey(k => k + 1);
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
    const next = action as PrAction;
    setActionType(next);
    setComments('');
    // A lone target is pre-chosen; with several the approver must pick — a wrong click here moves a PR to the wrong person.
    const forward = approvalContext?.forwardTargets ?? [];
    const back = approvalContext?.sendBackTargets ?? [];
    if (next === 'forward') setTargetValue(forward.length === 1 ? String(forward[0].seq) : '');
    else if (next === 'send_back') setTargetValue(back.length === 1 ? (back[0].target_type === 'REQUESTER' ? 'REQUESTER' : String(back[0].seq)) : '');
    else setTargetValue('');
    setEditDraft(next === 'edit' && selectedPR ? initEditDraft(selectedPR, parseItems(selectedPR)) : null);
    setShowApprovalDialog(true);
  };

  // Why the dialog's confirm button is disabled right now.
  const submitBlockedReason = useMemo((): string | null => {
    if (!showApprovalDialog) return null;
    const c = comments.trim();
    if (actionType === 'reject' && !c) return 'A reason is required to reject.';
    if (actionType === 'forward' && !targetValue) return 'Choose who to forward it to.';
    if (actionType === 'send_back') {
      if (!targetValue) return 'Choose who to send it back to.';
      if (!c) return 'Say what needs to be fixed or checked.';
    }
    if (actionType === 'edit') {
      if (!editDraft) return 'Nothing to edit.';
      const problem = validateEditDraft(editDraft);
      if (problem) return problem;
      if (!buildEditPayload(editDraft).changed) return 'Change at least one value to continue.';
      if (!c) return 'Give a reason for the change.';
    }
    return null;
  }, [showApprovalDialog, comments, actionType, targetValue, editDraft]);

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
        terms_conditions: autoPo.terms_conditions,
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
    if (!selectedPR || submitBlockedReason) return;

    // The server reads the stage chain itself and takes the approver from the session —
    // only the intent and its details are sent.
    const payload: Record<string, unknown> = {
      pr_no: selectedPR.pr_no,
      action: actionType,
      comments: comments.trim(),
    };
    let targetName: string | null = null;
    if (actionType === 'forward') {
      payload.target_seq = Number(targetValue);
      targetName = approvalContext?.forwardTargets.find(t => String(t.seq) === targetValue)?.approver_name ?? null;
    }
    if (actionType === 'send_back') {
      if (targetValue === 'REQUESTER') payload.target = 'REQUESTER';
      else payload.target_seq = Number(targetValue);
      targetName = approvalContext?.sendBackTargets.find(
        t => (t.target_type === 'REQUESTER' ? 'REQUESTER' : String(t.seq)) === targetValue
      )?.approver_name ?? null;
    }
    if (actionType === 'edit' && editDraft) payload.edits = buildEditPayload(editDraft).edits;

    try {
      const result = await postData(prApproveAction, payload);

      const approvalData = result?.decrypted?.data?.[0];
      const autoPo = result?.decrypted?.auto_po;
      if (actionType === 'approve' && approvalData?.next_approver === 'FINAL_STAGE') {
        if (approvalData?.request_mode === 'VENDOR_DRIVEN' && autoPo?.result === 'SUCCESS') {
          await sendVendorDrivenPOToVendor(autoPo);
        } else {
          generatePOPdf(selectedPR, approvalData);
        }
      }

      // Every action moves the PR to someone else — or, after an edit, back to the first stage,
      // which may be this same person — so reload the queue rather than only dropping the row.
      setPrList(prev => prev.filter(pr => pr.pr_no !== selectedPR.pr_no));
      setSelectedPR(null);
      setShowApprovalDialog(false);
      setComments('');
      setEditDraft(null);
      setRefreshKey(k => k + 1);
      setToast({ message: successMessage(actionType, targetName), type: 'success' });
    } catch (err: unknown) {
      setToast({ message: getErrorMessage(err, 'Action failed'), type: 'error' });
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
      approvalContext={approvalContext}
      contextLoading={contextLoading}
      conditionLookups={conditionLookups}
      priorityOptions={masters?.PriorityMaster}
      targetValue={targetValue}
      setTargetValue={setTargetValue}
      editDraft={editDraft}
      setEditDraft={setEditDraft}
      submitBlockedReason={submitBlockedReason}
    />
  );
};

export default PRApprovalScreen;
