import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, PackageCheck, FileText, Building2, CalendarDays, Truck, Menu, DoorOpen } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import { StatusBadge } from '@/utils/statusUtils';

import type { PORecord, GRNRecord, GRNFormState, GRNItemEntry } from './GRN/types';
import { getPODisplayNo, formatDate, formatINR, getGRNStatus, normalisePORows, normaliseGRNRows } from './GRN/helpers';
import {
  grnSvcGetPendingGateEntries,
  grnSvcGetGRNsByPO,
  grnSvcCreateGRN,
  grnSvcSaveDraft,
  grnSvcGetDrafts,
  grnSvcUpdateDraft,
  grnSvcDeleteDraft,
  type GRNDraft,
} from '@/Services/GrnService/grnApi';
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
} from '@/Services/Socket';

import POListSidebar from './GRN/POListSidebar';
import GRNEntryForm from './GRN/GRNEntryForm';
import GRNListView from './GRN/GRNListView';
import GRNDraftList from './GRN/GRNDraftList';

// ── PO Summary Card ───────────────────────────────────────────────────────────

const POSummaryCard: React.FC<{ po: PORecord }> = ({ po }) => {
  const { label: grnLabel } = getGRNStatus(po);

  const fields = [
    { icon: DoorOpen,     label: 'Gate Entry',   value: po.gate_entry_no ?? '—' },
    { icon: FileText,     label: 'PO Number',    value: getPODisplayNo(po) },
    { icon: FileText,     label: 'PR Reference', value: po.pr_no ?? '—' },
    { icon: Truck,        label: 'Vendor',        value: po.vendor_name ?? po.company_name ?? '—' },
    { icon: Building2,    label: 'Company',       value: po.com_name ?? '—' },
    { icon: CalendarDays, label: 'Gate Received', value: formatDate(po.gate_received_date) },
  ];

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PackageCheck size={16} className="text-primary" />
            Purchase Order — {getPODisplayNo(po)}
          </CardTitle>
          <StatusBadge status={grnLabel} />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fields.map(f => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground font-medium">{f.label}</p>
              <p className="text-sm font-medium text-foreground">{f.value}</p>
            </div>
          ))}
        </div>
        {po.delivery_address && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground font-medium">Delivery Address</p>
            <p className="text-sm text-foreground">{po.delivery_address}</p>
          </div>
        )}
        {po.total_amount != null && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">PO Value: </span>
            <span className="font-semibold text-foreground">{formatINR(po.total_amount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const GRNPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit } = usePermissions();

  const [poList, setPOList] = useState<PORecord[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PORecord | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [grnList, setGRNList] = useState<GRNRecord[]>([]);
  const [loadingGRNs, setLoadingGRNs] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Draft workflow (private, per-user — mirrors PR's save/resume/delete draft pattern)
  const [drafts, setDrafts] = useState<GRNDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
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

  const fetchGRNs = useCallback(async (po_basic_sno: number) => {
    setLoadingGRNs(true);
    try {
      const res = await axios.get(grnSvcGetGRNsByPO(po_basic_sno));
      setGRNList(normaliseGRNRows(res.data?.data ?? []));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load GRNs for this PO');
    } finally {
      setLoadingGRNs(false);
    }
  }, []);

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

  useEffect(() => { fetchPOs(); fetchDrafts(); }, [fetchPOs, fetchDrafts]);

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
      if (grn?.po_basic_sno && selectedPO?.po_basic_sno === grn.po_basic_sno) {
        fetchGRNs(grn.po_basic_sno);
      }
    };

    socket.on(SOCKET_GRN_CREATED, onGRNCreated);
    socket.on(SOCKET_GATE_ENTRY_CREATED, refreshPending);
    socket.on(SOCKET_GATE_ENTRY_STATUS_UPDATED, refreshPending);
    socket.on(SOCKET_GRN_DRAFT_NEW, fetchDrafts);
    socket.on(SOCKET_GRN_DRAFT_UPDATED, fetchDrafts);
    socket.on(SOCKET_GRN_DRAFT_DELETED, fetchDrafts);
    socket.on(SOCKET_GRN_DRAFT_SUBMITTED, fetchDrafts);

    return () => {
      socket.emit(SOCKET_LEAVE_GRN);
      socket.off(SOCKET_GRN_CREATED, onGRNCreated);
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
        form,
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
    if (items.length === 0) { toast.error('Select at least one item to receive'); return; }
    if (items.some(it => it.received_qty <= 0)) {
      toast.error('Received quantity must be greater than 0 for selected items');
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
        doc_ref_no: form.doc_ref_no,
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
          remarks: it.remarks,
        })),
      };

      const res = await axios.post(grnSvcCreateGRN, payload);
      const created = res.data?.data?.[0];
      toast.success(`GRN ${created?.grn_no ?? ''} submitted successfully — gate entry marked GRN Done`.trim());

      // Clean up the private draft this GRN was raised from, if any
      if (activeDraftId) {
        try { await axios.delete(grnSvcDeleteDraft(activeDraftId)); } catch { /* silent */ }
        fetchDrafts();
      }
      clearDraftState();

      // Refresh: GRN list for this PO + the pending gate-entry list (this one just closed)
      await Promise.all([
        selectedPO.po_basic_sno ? fetchGRNs(selectedPO.po_basic_sno) : Promise.resolve(),
        fetchPOs(),
      ]);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to submit GRN');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <TwoPaneLayout
      icon={PackageCheck}
      title="Goods Receipt Note"
      description="Receive goods against gate entries — GRN can only be raised after a delivery has cleared the gate"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <div className="flex flex-col h-full min-h-0">
          <GRNDraftList
            drafts={drafts}
            loading={loadingDrafts}
            activeDraftId={activeDraftId}
            onResume={(d) => { handleResumeDraft(d); setSidebarOpen(false); }}
            onDelete={handleDeleteDraft}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <POListSidebar
              poList={poList}
              loading={loadingPO}
              selectedPO={selectedPO}
              onSelectPO={(po) => { handleSelectPO(po); setSidebarOpen(false); }}
            />
          </div>
        </div>
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> Gate Entries
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={fetchPOs}
            disabled={loadingPO}
          >
            <RefreshCw size={16} className={loadingPO ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      {!selectedPO ? (
        <EmptyState
          message="Select a Gate Entry"
          description="Choose a gate entry from the left panel to create a Goods Receipt Note against it"
          icon={PackageCheck}
        />
      ) : (
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <POSummaryCard po={selectedPO} />

          {(canCreate("GRNPage") || canEdit("GRNPage")) && (
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
          />
        </div>
      )}
    </TwoPaneLayout>
  );
};

export default GRNPage;
