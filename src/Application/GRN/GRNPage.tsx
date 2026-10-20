import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { PackageCheck, FileText } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import { DetailEmptyState, DetailHero, Fact, FactGrid, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';

import type { PORecord, GRNRecord, GRNFormState, GRNItemEntry, DebitNoteRecord, DebitNoteItemEntry, ExcessRequest, CreditNoteRecord } from './GRN/types';
import { getPODisplayNo, formatDate, formatINR, getGRNStatus, normalisePORows, normaliseGRNRows, normaliseDebitNoteRows } from './GRN/helpers';
import {
  grnSvcGetPendingGateEntries,
  grnSvcGetGRNsByPO,
  grnSvcCreateGRN,
  grnSvcSaveDraft,
  grnSvcGetDrafts,
  grnSvcUpdateDraft,
  grnSvcDeleteDraft,
  grnSvcGetUnsyncedInventoryItems,
  grnSvcResyncInventoryItem,
  grnSvcGetExcessRequests,
  grnSvcDecideExcess,
  grnSvcGetGRNApprovals,
  grnSvcDecideGRN,
  grnSvcGetCreditNotesByGRN,
  type GRNDraft,
  type UnsyncedInventoryItem,
} from '@/Services/GrnService/grnApi';
import { downloadGRNPdf } from '@/utils/generateGRNPdf';
import { debitNoteSvcGetByGRN, debitNoteSvcCreate } from '@/Services/GrnService/debitNoteApi';
import {
  socket,
  SOCKET_JOIN_GRN,
  SOCKET_LEAVE_GRN,
  SOCKET_GRN_CREATED,
  SOCKET_GATE_ENTRY_CREATED,
  SOCKET_GATE_ENTRY_STATUS_UPDATED,
  SOCKET_GRN_DRAFT_NEW,
  SOCKET_GRN_DRAFT_UPDATED,
  SOCKET_GRN_DRAFT_DELETED,
  SOCKET_GRN_DRAFT_SUBMITTED,
  SOCKET_DEBIT_NOTE_CREATED,
  SOCKET_GRN_EXCESS_DECIDED,
  SOCKET_GRN_APPROVAL_DECIDED,
} from '@/Services/Socket';

import POListSidebar, { GRN_STATUS_TONE } from './GRN/POListSidebar';
import GRNEntryForm from './GRN/GRNEntryForm';
import GRNListView from './GRN/GRNListView';
import GRNDraftList from './GRN/GRNDraftList';
import DebitNoteForm from './GRN/DebitNoteForm';
import InventorySyncIssues from './GRN/InventorySyncIssues';
import ExcessApprovalPanel from './GRN/ExcessApprovalPanel';
import GRNApprovalPanel, { type GRNApprovalRow } from './GRN/GRNApprovalPanel';

// ── PO Summary ────────────────────────────────────────────────────────────────

const POSummary: React.FC<{ po: PORecord }> = ({ po }) => {
  const { label: grnLabel, color } = getGRNStatus(po);
  return (
    <>
      <DetailHero
        icon={PackageCheck}
        eyebrow="Goods receipt"
        title={getPODisplayNo(po)}
        subtitle={po.vendor_name ?? po.company_name}
        badges={<StatusPill tone={GRN_STATUS_TONE[color] ?? 'neutral'}>{grnLabel}</StatusPill>}
        metrics={[
          { label: 'Gate entry', value: po.gate_entry_no ?? '—', valueClassName: 'text-base @md:text-base' },
          { label: 'Gate received', value: formatDate(po.gate_received_date), valueClassName: 'text-base @md:text-base' },
          { label: 'PO value', value: po.total_amount != null ? formatINR(po.total_amount) : '—', accent: true },
        ]}
      />
      <Panel icon={FileText} title="Purchase order details">
        <FactGrid>
          <Fact label="Gate entry">{po.gate_entry_no ?? '—'}</Fact>
          <Fact label="PO number">{getPODisplayNo(po)}</Fact>
          <Fact label="PR reference">{po.pr_no ?? '—'}</Fact>
          <Fact label="Vendor">{po.vendor_name ?? po.company_name ?? '—'}</Fact>
          <Fact label="Company">{po.com_name ?? '—'}</Fact>
          <Fact label="Gate received">{formatDate(po.gate_received_date)}</Fact>
          {po.delivery_address && <Fact label="Delivery address" className="col-span-2 @xl:col-span-3">{po.delivery_address}</Fact>}
        </FactGrid>
      </Panel>
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const GRNPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit } = usePermissions();

  const [poList, setPOList] = useState<PORecord[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PORecord | null>(null);

  const [grnList, setGRNList] = useState<GRNRecord[]>([]);
  const [loadingGRNs, setLoadingGRNs] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Debit notes — raised against a submitted GRN for damage/shortage/return
  const [debitNotesByGrn, setDebitNotesByGrn] = useState<Record<number, DebitNoteRecord[]>>({});
  const [creditNotesByGrn, setCreditNotesByGrn] = useState<Record<number, CreditNoteRecord[]>>({});

  // Qty received above the PO, waiting for THIS user to accept / reject
  const [excessToApprove, setExcessToApprove] = useState<ExcessRequest[]>([]);
  const [excessBusyId, setExcessBusyId] = useState<number | null>(null);
  const [grnsToApprove, setGrnsToApprove] = useState<GRNApprovalRow[]>([]);
  const [grnBusyId, setGrnBusyId] = useState<number | null>(null);
  const [debitNoteTargetGRN, setDebitNoteTargetGRN] = useState<GRNRecord | null>(null);
  const [submittingDebitNote, setSubmittingDebitNote] = useState(false);

  // Draft workflow (private, per-user — mirrors PR's save/resume/delete draft pattern)
  const [drafts, setDrafts] = useState<GRNDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // GRN lines whose automatic inventory posting failed (see
  // grn-service/sql/24_grn_inventory_sync_tracking.sql) — not PO-specific,
  // so this loads independently of the selected PO.
  const [unsyncedItems, setUnsyncedItems] = useState<UnsyncedInventoryItem[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [resumedForm, setResumedForm] = useState<GRNFormState | undefined>(undefined);
  const [resumedItems, setResumedItems] = useState<GRNItemEntry[] | undefined>(undefined);
  const [savingDraft, setSavingDraft] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchPOs = useCallback(async () => {
    setLoadingPO(true);
    try {
      const res = await axios.get(grnSvcGetPendingGateEntries);
      setPOList(normalisePORows(res.data?.data ?? []));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load pending gate entries');
    } finally {
      setLoadingPO(false);
    }
  }, []);

  const fetchDebitNotesForGRNs = useCallback(async (grns: GRNRecord[]) => {
    const entries = await Promise.all(
      grns
        .filter(g => g.grn_basic_sno)
        .map(async g => {
          try {
            const res = await axios.get(debitNoteSvcGetByGRN(g.grn_basic_sno as number));
            return [g.grn_basic_sno as number, normaliseDebitNoteRows(res.data?.data ?? [])] as const;
          } catch {
            return [g.grn_basic_sno as number, []] as const;
          }
        })
    );
    setDebitNotesByGrn(Object.fromEntries(entries));
  }, []);

  const fetchCreditNotesForGRNs = useCallback(async (grns: GRNRecord[]) => {
    const entries = await Promise.all(
      grns
        .filter(g => g.grn_basic_sno)
        .map(async g => {
          try {
            const res = await axios.get(grnSvcGetCreditNotesByGRN(g.grn_basic_sno as number));
            return [g.grn_basic_sno as number, (res.data?.data ?? []) as CreditNoteRecord[]] as const;
          } catch {
            return [g.grn_basic_sno as number, [] as CreditNoteRecord[]] as const;
          }
        })
    );
    setCreditNotesByGrn(Object.fromEntries(entries));
  }, []);

  const fetchGrnsToApprove = useCallback(async () => {
    try {
      const res = await axios.get(grnSvcGetGRNApprovals({ mine: true }));
      setGrnsToApprove(res.data?.data?.grns ?? []);
    } catch {
      // silent - only approvers have anything here
    }
  }, []);

  const fetchExcessToApprove = useCallback(async () => {
    try {
      const res = await axios.get(grnSvcGetExcessRequests({ mine: true, status: 'Pending' }));
      setExcessToApprove(res.data?.data ?? []);
    } catch {
      // silent — only approvers have anything here
    }
  }, []);

  const fetchGRNs = useCallback(async (po_basic_sno: number) => {
    setLoadingGRNs(true);
    try {
      const res = await axios.get(grnSvcGetGRNsByPO(po_basic_sno));
      const grns = normaliseGRNRows(res.data?.data ?? []);
      setGRNList(grns);
      fetchDebitNotesForGRNs(grns);
      fetchCreditNotesForGRNs(grns);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load GRNs for this PO');
    } finally {
      setLoadingGRNs(false);
    }
  }, [fetchDebitNotesForGRNs, fetchCreditNotesForGRNs]);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await axios.get(grnSvcGetDrafts);
      setDrafts(res.data?.data ?? []);
    } catch {
      // silent — drafts are a convenience, not critical path
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  const fetchUnsyncedItems = useCallback(async () => {
    try {
      const res = await axios.get(grnSvcGetUnsyncedInventoryItems);
      setUnsyncedItems(res.data?.data ?? []);
    } catch {
      // silent — this is a supplementary admin view, not the core GRN flow
    }
  }, []);

  useEffect(() => { fetchPOs(); fetchDrafts(); fetchUnsyncedItems(); fetchExcessToApprove(); fetchGrnsToApprove(); }, [fetchPOs, fetchDrafts, fetchUnsyncedItems, fetchExcessToApprove, fetchGrnsToApprove]);

  useEffect(() => {
    if (selectedPO?.po_basic_sno) fetchGRNs(selectedPO.po_basic_sno);
    else setGRNList([]);
  }, [selectedPO?.po_basic_sno, fetchGRNs]);

  // ── Real-time: GRN + Gate Entry live updates ─────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    socket.emit(SOCKET_JOIN_GRN);

    const refreshPending = () => fetchPOs();
    const onGRNCreated = (grn: any) => {
      fetchPOs();
      fetchUnsyncedItems();
      fetchExcessToApprove();
      fetchGrnsToApprove();
      if (grn?.po_basic_sno && selectedPO?.po_basic_sno === grn.po_basic_sno) {
        fetchGRNs(grn.po_basic_sno);
      }
    };
    const onDebitNoteCreated = (dn: any) => {
      if (dn?.grn_basic_sno && grnList.some(g => g.grn_basic_sno === dn.grn_basic_sno)) {
        fetchDebitNotesForGRNs(grnList);
      }
    };

    socket.on(SOCKET_GRN_CREATED, onGRNCreated);
    socket.on(SOCKET_GATE_ENTRY_CREATED, refreshPending);
    socket.on(SOCKET_GATE_ENTRY_STATUS_UPDATED, refreshPending);
    socket.on(SOCKET_GRN_DRAFT_NEW, fetchDrafts);
    socket.on(SOCKET_GRN_DRAFT_UPDATED, fetchDrafts);
    socket.on(SOCKET_GRN_DRAFT_DELETED, fetchDrafts);
    socket.on(SOCKET_GRN_DRAFT_SUBMITTED, fetchDrafts);
    socket.on(SOCKET_DEBIT_NOTE_CREATED, onDebitNoteCreated);
    const onExcessDecided = (r: any) => {
      fetchExcessToApprove();
      if (r?.po_basic_sno && selectedPO?.po_basic_sno === r.po_basic_sno) fetchGRNs(r.po_basic_sno);
    };
    socket.on(SOCKET_GRN_EXCESS_DECIDED, onExcessDecided);
    const onApprovalDecided = (r: any) => {
      fetchGrnsToApprove();
      fetchPOs();
      if (r?.po_basic_sno && selectedPO?.po_basic_sno === r.po_basic_sno) fetchGRNs(r.po_basic_sno);
    };
    socket.on(SOCKET_GRN_APPROVAL_DECIDED, onApprovalDecided);

    return () => {
      socket.emit(SOCKET_LEAVE_GRN);
      socket.off(SOCKET_GRN_CREATED, onGRNCreated);
      socket.off(SOCKET_DEBIT_NOTE_CREATED, onDebitNoteCreated);
      socket.off(SOCKET_GRN_EXCESS_DECIDED, onExcessDecided);
      socket.off(SOCKET_GRN_APPROVAL_DECIDED, onApprovalDecided);
      socket.off(SOCKET_GATE_ENTRY_CREATED, refreshPending);
      socket.off(SOCKET_GATE_ENTRY_STATUS_UPDATED, refreshPending);
      socket.off(SOCKET_GRN_DRAFT_NEW, fetchDrafts);
      socket.off(SOCKET_GRN_DRAFT_UPDATED, fetchDrafts);
      socket.off(SOCKET_GRN_DRAFT_DELETED, fetchDrafts);
      socket.off(SOCKET_GRN_DRAFT_SUBMITTED, fetchDrafts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPOs, fetchDrafts, selectedPO?.po_basic_sno]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const clearDraftState = () => {
    setActiveDraftId(null);
    setResumedForm(undefined);
    setResumedItems(undefined);
  };

  const handleSelectPO = (po: PORecord) => {
    setSelectedPO(po);
    setGRNList([]);
    clearDraftState();
  };

  const handleResumeDraft = (draft: GRNDraft) => {
    const d = draft as any;
    const matchingPO = poList.find(p => p.po_basic_sno === d.po_basic_sno);
    setSelectedPO(matchingPO ?? {
      po_basic_sno: d.po_basic_sno,
      po_no: d.po_no,
      gate_entry_sno: d.gate_entry_sno,
      gate_entry_no: d.gate_entry_no,
      vendor_sno: d.vendor_sno,
      vendor_name: d.vendor_name,
      items: [],
    });
    setResumedForm(d.form);
    setResumedItems(d.items);
    setActiveDraftId(draft.draftId);
    setGRNList([]);
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await axios.delete(grnSvcDeleteDraft(draftId));
      setDrafts(prev => prev.filter(d => d.draftId !== draftId));
      if (activeDraftId === draftId) clearDraftState();
      toast.success('Draft deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete draft');
    }
  };

  const handleSaveDraft = async (form: GRNFormState, items: GRNItemEntry[]) => {
    if (!selectedPO) return;
    setSavingDraft(true);
    try {
      const payload = {
        po_basic_sno: selectedPO.po_basic_sno,
        po_no: selectedPO.po_no,
        gate_entry_sno: selectedPO.gate_entry_sno,
        gate_entry_no: selectedPO.gate_entry_no,
        vendor_sno: selectedPO.vendor_sno,
        vendor_name: selectedPO.vendor_name,
        form: { ...form, invoice_file: undefined },
        items,
      };
      if (activeDraftId) {
        await axios.put(grnSvcUpdateDraft(activeDraftId), payload);
        toast.success('Draft updated');
      } else {
        const res = await axios.post(grnSvcSaveDraft, payload);
        if (res.data?.draftId) setActiveDraftId(res.data.draftId);
        toast.success('Draft saved — resume it anytime from "My Drafts"');
      }
      fetchDrafts();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };
console.log(selectedPO);
  const handleSubmitGRN = async (form: GRNFormState, items: GRNItemEntry[]) => {
    if (!selectedPO) return;
    if (!selectedPO.gate_entry_sno) { toast.error('This PO has no linked Gate Entry'); return; }
    if (!form.received_date) { toast.error('Received date is required'); return; }
    if (!form.doc_ref_no.trim()) { toast.error('Invoice number is required'); return; }
    if (!form.invoice_date) { toast.error('Invoice date is required'); return; }
    if (!(Number(form.invoice_amount) > 0)) { toast.error('Invoice amount is required'); return; }
    if (!form.invoice_file) { toast.error('Upload the supplier invoice document'); return; }
    if (items.length === 0) { toast.error('Select at least one item to receive'); return; }
    if (items.some(it => it.received_qty <= 0)) {
      toast.error('Received quantity must be greater than 0 for selected items');
      return;
    }

    if (items.some(it => it.invoice_qty === '' || Number.isNaN(Number(it.invoice_qty)) || Number(it.invoice_qty) < 0)) {
      toast.error('Enter the supplier invoice quantity for every selected item');
      return;
    }

    setSubmitting(true);
    try {
      // use a loose type here to avoid mismatches between GRNRecord and
      // the payload shape constructed from selectedPO + form
      const payload: any = {
        gate_entry_sno: selectedPO.gate_entry_sno,
        po_basic_sno: selectedPO.po_basic_sno,
        po_no: selectedPO.po_no,
        vendor_sno: selectedPO.vendor_sno,
        vendor_name: selectedPO.vendor_name,
        com_sno: selectedPO.com_sno,
        com_name: selectedPO.com_name,
        div_sno: selectedPO.div_sno,
        div_name: selectedPO.div_name,
        brn_sno: selectedPO.brn_sno,
        brn_name: selectedPO.brn_name,
        dept_sno: selectedPO.dept_sno,
        dept_name: selectedPO.dept_name,
        received_date: form.received_date,
        doc_ref_no: form.doc_ref_no.trim(),
        invoice_date: form.invoice_date,
        invoice_amount: Number(form.invoice_amount),
        vehicle_no: form.vehicle_no,
        challan_no: form.challan_no,
        remarks: form.remarks,
        
        items: items.map(it => ({
          po_item_sno: it.po_item_sno,
          prod_sno: it.prod_sno,
          prod_name: it.prod_name,
          specification: it.specification,
          ordered_qty: it.ordered_qty,
          received_qty: it.received_qty,
          rejected_qty: it.rejected_qty,
          unit_name: it.unit_name,
          condition: it.condition,
          hsn_code: it.hsn_code || undefined,
          remarks: it.remarks,
          warehouse_location_sno: it.warehouse_location_sno || undefined,
          invoice_qty: Number(it.invoice_qty),
          invoice_uom: it.invoice_uom || it.unit_name,
        })),
      };

      // multipart: invoice file + fields; items travel as a JSON string
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (k === 'items') fd.append(k, JSON.stringify(v));
        else if (v !== undefined && v !== null) fd.append(k, String(v));
      });
      fd.append('invoice_document', form.invoice_file);
      const res = await axios.post(grnSvcCreateGRN, fd);
      const created = res.data?.data?.[0];
      toast.success(`GRN ${created?.grn_no ?? ''} submitted successfully — gate entry marked GRN Done`.trim());

      // Clean up the private draft this GRN was raised from, if any
      if (activeDraftId) {
        try { await axios.delete(grnSvcDeleteDraft(activeDraftId)); } catch { /* silent */ }
        fetchDrafts();
      }
      clearDraftState();

      // This gate entry just flipped to 'GRN Done' — it drops off the pending
      // list. Clear the selection so the entry form unmounts instead of
      // staying open (with its Save button re-enabled) and allowing a
      // duplicate submit against the same items.
      setSelectedPO(null);
      setGRNList([]);
      await fetchPOs();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to submit GRN');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecideGRN = async (row: GRNApprovalRow, action: 'approve' | 'reject', comments: string) => {
    setGrnBusyId(row.grn_basic_sno);
    try {
      const res = await axios.post(grnSvcDecideGRN, { grn_basic_sno: row.grn_basic_sno, action, comments });
      const result = res.data?.data?.result;
      toast.success(action === 'reject' ? `${row.grn_no} rejected`
        : result === 'FINAL' ? `${row.grn_no} approved - stock posted` : `${row.grn_no} approved - sent to next approver`);
      setGrnsToApprove(prev => prev.filter(r => r.grn_basic_sno !== row.grn_basic_sno));
      if (action === 'approve' && result === 'FINAL') {
        await downloadGRNPdf(row.grn_basic_sno, row.po_basic_sno);
      }
      fetchPOs();
      if (selectedPO?.po_basic_sno) fetchGRNs(selectedPO.po_basic_sno);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to record the decision');
    } finally {
      setGrnBusyId(null);
    }
  };

  const handleDecideExcess = async (req: ExcessRequest, action: 'ACCEPT' | 'REJECT', remarks: string) => {
    setExcessBusyId(req.excess_sno);
    try {
      await axios.post(grnSvcDecideExcess, { excess_sno: req.excess_sno, action, remarks });
      toast.success(action === 'ACCEPT'
        ? `${req.excess_qty} ${req.unit_name ?? ''} of ${req.prod_name} accepted into stock`
        : `${req.prod_name}: excess rejected — return it to the supplier`);
      setExcessToApprove(prev => prev.filter(r => r.excess_sno !== req.excess_sno));
      if (selectedPO?.po_basic_sno) fetchGRNs(selectedPO.po_basic_sno);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to record the decision');
    } finally {
      setExcessBusyId(null);
    }
  };

  const handleResyncInventoryItem = async (grn_item_sno: number) => {
    const target = unsyncedItems.find(it => it.grn_item_sno === grn_item_sno);
    try {
      await axios.post(grnSvcResyncInventoryItem, { grn_item_sno });
      toast.success(`${target?.grn_no ?? 'Item'} resynced to inventory`);
      setUnsyncedItems(prev => prev.filter(it => it.grn_item_sno !== grn_item_sno));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? `Resync failed for ${target?.grn_no ?? 'item'}`);
    }
  };

  const handleSubmitDebitNote = async (grn: GRNRecord, items: DebitNoteItemEntry[], remarks: string) => {
    if (!grn.grn_basic_sno) return;
    setSubmittingDebitNote(true);
    try {
      const payload = {
        grn_basic_sno: grn.grn_basic_sno,
        remarks,
        items: items.map(it => ({
          grn_item_sno: it.grn_item_sno,
          po_item_sno: it.po_item_sno,
          prod_sno: it.prod_sno,
          prod_name: it.prod_name,
          specification: it.specification,
          unit_name: it.unit_name,
          reason_type: it.reason_type,
          qty: it.qty,
          unit_price: it.unit_price,
          remarks: it.remarks || undefined,
        })),
      };
      const res = await axios.post(debitNoteSvcCreate, payload);
      const created = res.data?.data;
      toast.success(`Debit note ${created?.debit_note_no ?? ''} raised — visible to the supplier`.trim());
      setDebitNoteTargetGRN(null);
      fetchDebitNotesForGRNs(grnList);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to raise debit note');
    } finally {
      setSubmittingDebitNote(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const canAct = canCreate("GRNPage") || canEdit("GRNPage");

  const detailContent = selectedPO ? (
    <div className="@container space-y-4 px-3 py-4 sm:px-5 lg:px-6">
      {unsyncedItems.length > 0 && (
        <InventorySyncIssues items={unsyncedItems} onResync={handleResyncInventoryItem} canResync={canAct} />
      )}

      <GRNApprovalPanel rows={grnsToApprove} busyId={grnBusyId} onDecide={handleDecideGRN} />
      <ExcessApprovalPanel requests={excessToApprove} busyId={excessBusyId} onDecide={handleDecideExcess} />

      <POSummary po={selectedPO} />

      {canAct && (
        <GRNEntryForm
          key={`${selectedPO.po_basic_sno}:${activeDraftId ?? ''}`}
          po={selectedPO}
          onSubmit={handleSubmitGRN}
          submitting={submitting}
          initialForm={resumedForm}
          initialItems={resumedItems}
          onSaveDraft={handleSaveDraft}
          savingDraft={savingDraft}
          isDraft={!!activeDraftId}
        />
      )}

      <GRNListView
        grns={grnList}
        loading={loadingGRNs}
        onRefresh={() => {
          if (selectedPO?.po_basic_sno) fetchGRNs(selectedPO.po_basic_sno);
        }}
        debitNotesByGrn={debitNotesByGrn}
        creditNotesByGrn={creditNotesByGrn}
        canRaiseDebitNote={canAct}
        onRaiseDebitNote={setDebitNoteTargetGRN}
      />
    </div>
  ) : null;

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle="Goods Receipt Note"
        sidebarCount={poList.length}
        sidebarCountLabel="gate entry"
        sidebarCountLabelPlural="gate entries"
        sidebarCountQualifier="pending"
        listItems={(closeSheet) => (
          <>
            <GRNDraftList
              drafts={drafts}
              loading={loadingDrafts}
              activeDraftId={activeDraftId}
              onResume={(d) => { handleResumeDraft(d); closeSheet(); }}
              onDelete={handleDeleteDraft}
            />
            <POListSidebar
              poList={poList}
              loading={loadingPO}
              selectedPO={selectedPO}
              onSelectPO={(po) => { handleSelectPO(po); closeSheet(); }}
              onRefresh={fetchPOs}
            />
          </>
        )}
        hasSelection={!!selectedPO}
        detailContent={detailContent}
        emptyContent={
          <div className="space-y-4 px-3 py-4 sm:px-5">
            <ExcessApprovalPanel requests={excessToApprove} busyId={excessBusyId} onDecide={handleDecideExcess} />
            {unsyncedItems.length > 0 && (
              <InventorySyncIssues items={unsyncedItems} onResync={handleResyncInventoryItem} canResync={canAct} />
            )}
            <DetailEmptyState
              icon={PackageCheck}
              title="Select a gate entry"
              description="Choose a gate entry from the list to create a Goods Receipt Note against it."
            />
          </div>
        }
        mobileListLabel="Gate entries"
        mobileSelectionTitle={selectedPO ? getPODisplayNo(selectedPO) : undefined}
      />

      <DebitNoteForm
        open={!!debitNoteTargetGRN}
        grn={debitNoteTargetGRN}
        submitting={submittingDebitNote}
        onClose={() => setDebitNoteTargetGRN(null)}
        onSubmit={handleSubmitDebitNote}
      />
    </>
  );
};

export default GRNPage;
