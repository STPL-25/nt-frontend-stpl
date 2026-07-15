import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, DoorOpen, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import axios from 'axios';
import { gateGetApprovedPOs, gateGetAllEntries, gateCreateEntry } from '@/Services/GrnService/gateEntryApi';
import { normalisePORows } from '@/Application/GRN/GRN/helpers';

import type { PORecord, GateEntryRecord, GateEntryFormState } from './GateEntry/types';
import { MOCK_TRANSPORT_LIST } from './GateEntry/helpers';

import GateEntrySidebar from './GateEntry/GateEntrySidebar';
import GateEntryPOSearch from './GateEntry/GateEntryPOSearch';
import GateEntryForm from './GateEntry/GateEntryForm';
import GateEntryDetailView from './GateEntry/GateEntryDetailView';

const GateEntryPage: React.FC = () => {
  const { userData } = useAppState();
  const { canCreate } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentUserEcno: string = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u?.ecno ?? '';
  }, [userData]);

  const [poList, setPOList] = useState<PORecord[]>([]);
  const [entries, setEntries] = useState<GateEntryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GateEntryRecord | null>(null);
  const [activePO, setActivePO] = useState<PORecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes] = await Promise.all([
        axios.get(gateGetApprovedPOs),
        // axios.get(gateGetAllEntries),
      ]);
      setPOList(normalisePORows(posRes.data?.data ?? []));
      // setEntries(entriesRes.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load gate entry data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelect = (entry: GateEntryRecord) => {
    setSelected(entry);
    setIsNew(false);
    setActivePO(null);
  };

  const handleNew = () => {
    setSelected(null);
    setActivePO(null);
    setIsNew(true);
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
      setSelected(newEntry);
      setActivePO(null);
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
  const showDetail = !isNew && selected;

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
              po={activePO}
              transportList={MOCK_TRANSPORT_LIST}
              receiverEcno={currentUserEcno}
              onSubmit={handleSubmit}
              onCancel={() => setActivePO(null)}
              submitting={submitting}
            />
          ) : (
            <GateEntryPOSearch poList={poList} onStartGateEntry={setActivePO} />
          )
        ) : showDetail ? (
          <GateEntryDetailView entry={selected!} />
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
