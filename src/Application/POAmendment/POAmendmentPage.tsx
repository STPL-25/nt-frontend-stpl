import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, FileEdit, Menu, Building2, CalendarDays, Truck } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

import type { AmendablePO, AmendmentRecord, AmendmentFormState, AmendmentLine } from './POAmendment/types';
import {
  MOCK_AMENDABLE_POS, getAmendmentsForPO, formatDate, formatINR, generateAmendNo, poTotal,
} from './POAmendment/helpers';

import POListSidebar from './POAmendment/POListSidebar';
import AmendmentForm from './POAmendment/AmendmentForm';
import AmendmentHistoryView from './POAmendment/AmendmentHistoryView';

// ── PO Summary Card ─────────────────────────────────────────────────────────────
const POSummaryCard: React.FC<{ po: AmendablePO }> = ({ po }) => {
  const fields = [
    { icon: Truck,        label: 'Vendor',       value: po.vendor_name ?? '—' },
    { icon: Building2,    label: 'Company',      value: po.com_name ?? '—' },
    { icon: CalendarDays, label: 'PO Date',      value: formatDate(po.po_date) },
    { icon: CalendarDays, label: 'Required By',  value: formatDate(po.required_date) },
  ];
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileEdit size={16} className="text-primary" />
          Purchase Order — {po.po_no}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {fields.map(f => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground font-medium">{f.label}</p>
              <p className="text-sm font-medium text-foreground">{f.value}</p>
            </div>
          ))}
        </div>
        {po.total_amount != null && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">Current PO Value: </span>
            <span className="font-semibold text-foreground">{formatINR(po.total_amount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const POAmendmentPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [poList, setPOList] = useState<AmendablePO[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<AmendablePO | null>(null);

  const [amendments, setAmendments] = useState<AmendmentRecord[]>([]);
  const [loadingAmend, setLoadingAmend] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPOs = useCallback(() => {
    setLoadingPO(true);
    setTimeout(() => { setPOList(MOCK_AMENDABLE_POS); setLoadingPO(false); }, 300);
  }, []);

  const fetchAmendments = useCallback((po_basic_sno: number) => {
    setLoadingAmend(true);
    setTimeout(() => { setAmendments(getAmendmentsForPO(po_basic_sno)); setLoadingAmend(false); }, 200);
  }, []);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  useEffect(() => {
    if (selectedPO?.po_basic_sno) fetchAmendments(selectedPO.po_basic_sno);
    else setAmendments([]);
  }, [selectedPO?.po_basic_sno, fetchAmendments]);

  const handleSubmit = (form: AmendmentFormState, lines: AmendmentLine[], submit: boolean) => {
    if (!selectedPO) return;
    if (!form.reason.trim()) { toast.error('Reason for amendment is required'); return; }
    if (lines.some(l => Number(l.new_qty) < Number(l.received_qty))) {
      toast.error('New quantity cannot be below already-received quantity');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      const revNo = (selectedPO.amendment_count ?? 0) + 1;
      const oldTotal = poTotal(lines.map(l => ({ new_qty: l.old_qty, new_price: l.old_price })));
      const newTotal = poTotal(lines);
      const newAmend: AmendmentRecord = {
        amend_sno: Date.now(),
        amend_no: generateAmendNo(selectedPO.po_no, revNo),
        rev_no: revNo,
        po_basic_sno: selectedPO.po_basic_sno,
        po_no: selectedPO.po_no,
        amend_date: form.amend_date,
        amend_type: form.amend_type,
        reason: form.reason,
        old_required_date: selectedPO.required_date,
        new_required_date: form.new_required_date,
        old_terms: selectedPO.terms_conditions,
        new_terms: form.new_terms,
        old_total: oldTotal,
        new_total: newTotal,
        status: submit ? 'Pending Approval' : 'Draft',
        created_by_name: 'Current User',
        created_at: new Date().toISOString(),
        lines,
      };
      setAmendments(prev => [newAmend, ...prev]);
      toast.success(`Amendment ${newAmend.amend_no} ${submit ? 'submitted for approval' : 'saved as draft'}`);
      setSaving(false);
    }, 400);
  };

  const canAmend = canCreate('POAmendmentPage') || canEdit('POAmendmentPage');

  return (
    <TwoPaneLayout
      icon={FileEdit}
      title="PO Amendment"
      description="Revise purchase orders — change quantity, price, delivery date or terms with full audit trail"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <POListSidebar
          poList={poList}
          loading={loadingPO}
          selectedPO={selectedPO}
          onSelectPO={(po) => { setSelectedPO(po); setSidebarOpen(false); }}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> PO List
          </Button>
          <Button
            variant="outline" size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={fetchPOs} disabled={loadingPO}
          >
            <RefreshCw size={16} className={loadingPO ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      {!selectedPO ? (
        <EmptyState
          icon={FileEdit}
          message="Select a Purchase Order"
          description="Choose a PO from the left panel to create or review amendments"
        />
      ) : (
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <POSummaryCard po={selectedPO} />
          {canAmend && (
            <AmendmentForm po={selectedPO} onSubmit={handleSubmit} saving={saving} />
          )}
          <AmendmentHistoryView amendments={amendments} loading={loadingAmend} />
        </div>
      )}
    </TwoPaneLayout>
  );
};

export default POAmendmentPage;
