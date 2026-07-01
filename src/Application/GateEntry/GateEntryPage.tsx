import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, DoorOpen, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

import type { GatePORef, GateEntryRecord, GateEntryFormState } from './GateEntry/types';
import { MOCK_GATE_PO_LIST, MOCK_GATE_ENTRIES, generateGateNo, netWeight } from './GateEntry/helpers';

import GateEntrySidebar from './GateEntry/GateEntrySidebar';
import GateEntryForm from './GateEntry/GateEntryForm';
import GateEntryDetailView from './GateEntry/GateEntryDetailView';

const GateEntryPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [poList, setPOList] = useState<GatePORef[]>([]);
  const [entries, setEntries] = useState<GateEntryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GateEntryRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetchers (temporary – using local mock data) ────────────────────────────
  const fetchAll = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setPOList(MOCK_GATE_PO_LIST);
      setEntries(MOCK_GATE_ENTRIES);
      setLoading(false);
    }, 300);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelect = (entry: GateEntryRecord) => { setSelected(entry); setIsNew(false); };
  const handleNew = () => { setSelected(null); setIsNew(true); };

  const handleSubmit = (form: GateEntryFormState) => {
    if (!form.vehicle_no.trim()) { toast.error('Vehicle number is required'); return; }
    if (!form.entry_date) { toast.error('Entry date is required'); return; }

    setSubmitting(true);
    setTimeout(() => {
      const po = poList.find(p => String(p.po_basic_sno) === form.po_basic_sno);
      const newEntry: GateEntryRecord = {
        gate_entry_sno: Date.now(),
        gate_entry_no: generateGateNo(),
        entry_date: form.entry_date,
        entry_time: form.entry_time,
        po_basic_sno: po?.po_basic_sno,
        po_no: po?.po_no,
        vendor_name: po?.vendor_name,
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date,
        challan_no: form.challan_no,
        lr_no: form.lr_no,
        vehicle_no: form.vehicle_no,
        driver_name: form.driver_name,
        driver_mobile: form.driver_mobile,
        transporter_name: form.transporter_name,
        gross_weight: Number(form.gross_weight) || undefined,
        tare_weight: Number(form.tare_weight) || undefined,
        net_weight: netWeight(form.gross_weight, form.tare_weight) || undefined,
        no_of_packages: Number(form.no_of_packages) || undefined,
        material_desc: form.material_desc,
        remarks: form.remarks,
        status: 'In',
        created_by_name: 'Current User',
        created_at: new Date().toISOString(),
      };
      setEntries(prev => [newEntry, ...prev]);
      setSelected(newEntry);
      setIsNew(false);
      toast.success(`Gate entry ${newEntry.gate_entry_no} recorded`);
      setSubmitting(false);
    }, 400);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const showForm = isNew;
  const showDetail = !isNew && selected;

  return (
    <TwoPaneLayout
      icon={DoorOpen}
      title="Gate Entry"
      description="Security inward register — record PO, invoice, vehicle and weighment when goods arrive at the gate"
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
        {showForm ? (
          <GateEntryForm
            poList={poList}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        ) : showDetail ? (
          <GateEntryDetailView entry={selected!} />
        ) : (
          <EmptyState
            icon={DoorOpen}
            message="Select or Create a Gate Entry"
            description="Choose a gate entry from the left panel to view details, or click 'New' to record an incoming vehicle"
          />
        )}
      </div>
    </TwoPaneLayout>
  );
};

export default GateEntryPage;
