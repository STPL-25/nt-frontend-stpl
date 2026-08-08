import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, DoorOpen, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import axios from 'axios';
import {
  gateGetApprovedPOs, gateGetAllEntries, gateCreateEntry, gateUpdateEntry, gateGetDispatchByLr,
  type DispatchDeliveryLookup,
} from '@/Services/GrnService/gateEntryApi';
import { apiFetchCommonMaster } from '@/Services/Api';
import { normalisePORows } from '@/Application/GRN/GRN/helpers';
import {
  socket, SOCKET_JOIN_GRN, SOCKET_LEAVE_GRN,
  SOCKET_GATE_ENTRY_CREATED, SOCKET_GATE_ENTRY_UPDATED, SOCKET_GATE_ENTRY_STATUS_UPDATED,
} from '@/Services/Socket';

import type { PORecord, GateEntryRecord, GateEntryFormState, TransportOption } from './GateEntry/types';

import GateEntrySidebar from './GateEntry/GateEntrySidebar';
import GateEntryPOSearch from './GateEntry/GateEntryPOSearch';
import GateEntryForm from './GateEntry/GateEntryForm';
import GateEntryQRScan from './GateEntry/GateEntryQRScan';
import GateEntryDetailView from './GateEntry/GateEntryDetailView';

const GateEntryPage: React.FC = () => {
  const { userData } = useAppState();
  const { canCreate, canEdit } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentUserEcno: string = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u?.ecno ?? '';
  }, [userData]);

  // poList is already scoped to POs with no gate entry yet (sp_nt_GetPOsPendingGateEntry —
  // a PO only ever gets one gate entry), and entries is already scoped to
  // pending ones (sp_nt_GetAllGateEntries with pending_only=1 — nothing left
  // to verify/edit once an entry reaches GRN Done). Both filters live in the
  // stored procedures, not here.
  const [poList, setPOList] = useState<PORecord[]>([]);
  const [entries, setEntries] = useState<GateEntryRecord[]>([]);
  const [transportList, setTransportList] = useState<TransportOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Selection is tracked by sno and re-derived from `entries` on every
  // change, so the open detail/edit view always reflects the latest fetched/
  // updated record without a sync effect — and auto-clears if the entry
  // flips to GRN Done and drops out of the fetched (pending-only) list.
  const [selectedSno, setSelectedSno] = useState<number | null>(null);
  const selected = useMemo<GateEntryRecord | null>(
    () => (selectedSno == null ? null : entries.find(e => e.gate_entry_sno === selectedSno) ?? null),
    [entries, selectedSno]
  );
  const [activePO, setActivePO] = useState<PORecord | null>(null);
  const [prefill, setPrefill] = useState<Partial<GateEntryFormState> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, entriesRes] = await Promise.all([
        axios.get(gateGetApprovedPOs),
        axios.get(gateGetAllEntries, { params: { pending_only: true } }),
      ]);
      setPOList(normalisePORows(posRes.data?.data ?? []));
      setEntries(entriesRes.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load gate entry data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Transporter master (replaces the old hardcoded mock list)
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${apiFetchCommonMaster}TransportMaster`);
        setTransportList(res.data?.data ?? []);
      } catch {
        toast.error('Failed to load transporter master');
      }
    })();
  }, []);

  // Real-time: join the shared GRN/Gate Entry room so entries created by
  // other users (or other tabs) are reflected without a manual refresh.
  useEffect(() => {
    if (!socket) return;
    socket.emit(SOCKET_JOIN_GRN);
    socket.on(SOCKET_GATE_ENTRY_CREATED, fetchAll);
    socket.on(SOCKET_GATE_ENTRY_UPDATED, fetchAll);
    socket.on(SOCKET_GATE_ENTRY_STATUS_UPDATED, fetchAll);
    return () => {
      socket.emit(SOCKET_LEAVE_GRN);
      socket.off(SOCKET_GATE_ENTRY_CREATED, fetchAll);
      socket.off(SOCKET_GATE_ENTRY_UPDATED, fetchAll);
      socket.off(SOCKET_GATE_ENTRY_STATUS_UPDATED, fetchAll);
    };
  }, [fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelect = (entry: GateEntryRecord) => {
    setSelectedSno(entry.gate_entry_sno ?? null);
    setIsNew(false);
    setIsEditing(false);
    setActivePO(null);
    setPrefill(null);
    setScanning(false);
  };

  const handleNew = () => {
    setSelectedSno(null);
    setActivePO(null);
    setPrefill(null);
    setScanning(false);
    setIsNew(true);
    setIsEditing(false);
  };

  const handleEditStart = () => {
    if (!selected) return;
    setIsEditing(true);
  };

  const handleUpdate = async (form: GateEntryFormState) => {
    if (!selected?.gate_entry_sno) return;
    if (!form.invoice_no.trim()) { toast.error('Invoice number is required'); return; }
    if (!form.received_qty || Number(form.received_qty) <= 0) { toast.error('Received quantity is required'); return; }
    if (!form.received_date) { toast.error('Received date is required'); return; }

    setSubmitting(true);
    try {
      const entry: Partial<GateEntryRecord> = {
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        received_qty: Number(form.received_qty),
        received_date: form.received_date,
        bundles: form.bundles ? Number(form.bundles) : undefined,
        transport_name: form.transport_name || undefined,
        lr_no: form.lr_no || undefined,
        receiver_ecno: form.receiver_ecno || undefined,
      };

      let body: Partial<GateEntryRecord> | FormData = entry;
      if (form.photo) {
        const fd = new FormData();
        Object.entries(entry).forEach(([key, value]) => {
          if (value !== undefined && value !== null) fd.append(key, String(value));
        });
        fd.append('photo', form.photo);
        body = fd;
      }

      const res = await axios.put(gateUpdateEntry(selected.gate_entry_sno), body);
      const updated = res.data?.data?.[0];

      const updatedEntry: GateEntryRecord = { ...selected, ...entry, photo_url: updated?.photo_url ?? selected.photo_url };
      setEntries(prev => prev.map(e => e.gate_entry_sno === selected.gate_entry_sno ? updatedEntry : e));
      setIsEditing(false);
      toast.success(`Gate entry ${selected.gate_entry_no} updated`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update gate entry');
    } finally {
      setSubmitting(false);
    }
  };

  // QR scan-to-fill: resolve the scanned code (LR no / DSD-<sno>) to its
  // dispatch delivery, locate the PO, and prefill the gate entry form.
  const handleScanned = async (code: string) => {
    setScanning(false);
    try {
      const res = await axios.get(gateGetDispatchByLr(code));
      const d: DispatchDeliveryLookup = res.data?.data;
      const po = poList.find(p => p.po_basic_sno === d.po_basic_sno);
      if (!po) {
        toast.error(`Dispatch found for PO ${d.po_no}, but that PO is not pending gate entry.`);
        return;
      }
      setPrefill({
        lr_no: d.lr_no ?? '',
        transport_name: d.transport_name ?? '',
        invoice_no: d.invoice_no ?? '',
        invoice_date: d.invoice_date ?? '',
        received_qty: d.qty != null ? String(d.qty) : '',
        bundles: d.bundles != null ? String(d.bundles) : '',
      });
      setActivePO(po);
      toast.success(`Dispatch ${d.dispatch_slip_no} loaded — verify and save the gate entry`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? `No dispatch found for "${code}"`);
    }
  };

  const handleSubmit = async (form: GateEntryFormState) => {
    if (!activePO) return;
    if (!form.invoice_no.trim()) { toast.error('Invoice number is required'); return; }
    if (!form.received_qty || Number(form.received_qty) <= 0) { toast.error('Received quantity is required'); return; }
    if (!form.received_date) { toast.error('Received date is required'); return; }

    setSubmitting(true);
    try {
      const entry: Partial<GateEntryRecord> = {
        po_basic_sno: activePO.po_basic_sno,
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        received_qty: Number(form.received_qty),
        received_date: form.received_date,
        bundles: form.bundles ? Number(form.bundles) : undefined,
        transport_name: form.transport_name || undefined,
        lr_no: form.lr_no || undefined,
        receiver_ecno: form.receiver_ecno || undefined,
      };

      let body: Partial<GateEntryRecord> | FormData = entry;
      if (form.photo) {
        const fd = new FormData();
        Object.entries(entry).forEach(([key, value]) => {
          if (value !== undefined && value !== null) fd.append(key, String(value));
        });
        fd.append('photo', form.photo);
        body = fd;
      }

      const res = await axios.post(gateCreateEntry, body);
      const created = res.data?.data?.[0];

      const newEntry: GateEntryRecord = {
        gate_entry_sno: created.gate_entry_sno,
        gate_entry_no: created.gate_entry_no,
        po_basic_sno: activePO.po_basic_sno,
        po_no: activePO.po_no,
        vendor_name: activePO.vendor_name,
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        received_qty: Number(form.received_qty),
        received_date: form.received_date,
        bundles: form.bundles ? Number(form.bundles) : undefined,
        transport_name: form.transport_name || undefined,
        lr_no: form.lr_no || undefined,
        receiver_ecno: form.receiver_ecno || undefined,
        status: created.status ?? 'In',
        created_by_name: currentUserEcno,
        created_at: new Date().toISOString(),
      };
      setEntries(prev => [newEntry, ...prev]);
      setSelectedSno(newEntry.gate_entry_sno ?? null);
      setActivePO(null);
      setPrefill(null);
      setIsNew(false);
      toast.success(`Gate entry ${newEntry.gate_entry_no} recorded`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to save gate entry');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const showSearch = isNew;
  const showEdit = !isNew && isEditing && selected;
  const showDetail = !isNew && !isEditing && selected;

  return (
    <TwoPaneLayout
      icon={DoorOpen}
      title="Gate Entry"
      description="Security inward register — search a PO, review its summary, then record what arrived at the gate"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <GateEntrySidebar
          entries={entries}
          loading={loading}
          selected={selected}
          onSelect={(e) => { handleSelect(e); setSidebarOpen(false); }}
          onNew={canCreate('GateEntryPage') ? () => { handleNew(); setSidebarOpen(false); } : undefined}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> Entries
          </Button>
          <Button
            variant="outline" size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={fetchAll} disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="px-4 sm:px-6 py-4 space-y-4">
        {showSearch ? (
          activePO ? (
            <GateEntryForm
              key={`${activePO.po_basic_sno}-${prefill?.lr_no ?? ''}`}
              po={activePO}
              transportList={transportList}
              receiverEcno={currentUserEcno}
              onSubmit={handleSubmit}
              onCancel={() => { setActivePO(null); setPrefill(null); }}
              submitting={submitting}
              initial={prefill ?? undefined}
            />
          ) : scanning ? (
            <GateEntryQRScan onScan={handleScanned} onClose={() => setScanning(false)} />
          ) : (
            <GateEntryPOSearch
              poList={poList}
              onStartGateEntry={(po) => { setPrefill(null); setActivePO(po); }}
              onScanQR={() => setScanning(true)}
              onLookupLr={handleScanned}
            />
          )
        ) : showEdit ? (
          <GateEntryForm
            key={`edit-${selected!.gate_entry_sno}`}
            mode="edit"
            gateEntryNo={selected!.gate_entry_no}
            po={{ po_basic_sno: selected!.po_basic_sno, po_no: selected!.po_no, vendor_name: selected!.vendor_name }}
            transportList={transportList}
            receiverEcno={currentUserEcno}
            existingPhotoUrl={selected!.photo_url}
            initial={{
              invoice_no: selected!.invoice_no ?? '',
              invoice_date: selected!.invoice_date ?? '',
              received_qty: selected!.received_qty != null ? String(selected!.received_qty) : '',
              received_date: selected!.received_date ?? '',
              bundles: selected!.bundles != null ? String(selected!.bundles) : '',
              transport_name: selected!.transport_name ?? '',
              lr_no: selected!.lr_no ?? '',
              receiver_ecno: selected!.receiver_ecno ?? currentUserEcno,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            submitting={submitting}
          />
        ) : showDetail ? (
          <GateEntryDetailView
            entry={selected!}
            canEdit={canEdit('GateEntryPage')}
            onEdit={handleEditStart}
          />
        ) : (
          <EmptyState
            icon={DoorOpen}
            message="Select or Create a Gate Entry"
            description="Choose a gate entry from the left panel to view details, or click 'New' to search a PO and record an incoming delivery"
          />
        )}
      </div>
    </TwoPaneLayout>
  );
};

export default GateEntryPage;
