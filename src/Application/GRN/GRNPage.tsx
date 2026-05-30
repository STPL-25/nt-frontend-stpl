import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, PackageCheck, FileText, Building2, CalendarDays, Truck, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import { StatusBadge } from '@/utils/statusUtils';

import type { PORecord, GRNRecord, GRNFormState, GRNItemEntry } from './GRN/types';
import { getPODisplayNo, formatDate, formatINR, getGRNStatus } from './GRN/helpers';
import { TEMP_PO_LIST, getTempGRNsForPO } from './GRN/data';

import POListSidebar from './GRN/POListSidebar';
import GRNEntryForm from './GRN/GRNEntryForm';
import GRNListView from './GRN/GRNListView';

// ── PO Summary Card ───────────────────────────────────────────────────────────

const POSummaryCard: React.FC<{ po: PORecord }> = ({ po }) => {
  const { label: grnLabel } = getGRNStatus(po);

  const fields = [
    { icon: FileText,     label: 'PO Number',    value: getPODisplayNo(po) },
    { icon: FileText,     label: 'PR Reference', value: po.pr_no ?? '—' },
    { icon: Truck,        label: 'Vendor',        value: po.vendor_name ?? po.company_name ?? '—' },
    { icon: Building2,    label: 'Company',       value: po.com_name ?? '—' },
    { icon: CalendarDays, label: 'PO Date',       value: formatDate(po.po_date) },
    { icon: CalendarDays, label: 'Required By',   value: formatDate(po.required_date) },
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

  // ── Fetchers (temporary – using local mock data) ────────────────────────────

  const fetchPOs = useCallback(() => {
    setLoadingPO(true);
    setTimeout(() => {
      setPOList(TEMP_PO_LIST);
      setLoadingPO(false);
    }, 300);
  }, []);

  const fetchGRNs = useCallback((po_basic_sno: number) => {
    setLoadingGRNs(true);
    setTimeout(() => {
      setGRNList(getTempGRNsForPO(po_basic_sno));
      setLoadingGRNs(false);
    }, 200);
  }, []);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  useEffect(() => {
    if (selectedPO?.po_basic_sno) fetchGRNs(selectedPO.po_basic_sno);
    else setGRNList([]);
  }, [selectedPO?.po_basic_sno, fetchGRNs]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelectPO = (po: PORecord) => {
    setSelectedPO(po);
    setGRNList([]);
  };

  const handleSubmitGRN = async (form: GRNFormState, items: GRNItemEntry[]) => {
    if (!selectedPO) return;
    if (!form.received_date) { toast.error('Received date is required'); return; }
    if (items.length === 0) { toast.error('Select at least one item to receive'); return; }
    if (items.some(it => it.received_qty <= 0)) {
      toast.error('Received quantity must be greater than 0 for selected items');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      // Build a mock GRN and append it locally
      const newGRN: GRNRecord = {
        grn_basic_sno: Date.now(),
        grn_no: `GRN-TEMP-${Date.now()}`,
        po_basic_sno: selectedPO.po_basic_sno,
        po_no: selectedPO.po_no,
        vendor_sno: selectedPO.vendor_sno,
        vendor_name: selectedPO.vendor_name,
        received_date: form.received_date,
        received_by: 'USR-01',
        received_by_name: 'Current User',
        doc_ref_no: form.doc_ref_no,
        vehicle_no: form.vehicle_no,
        challan_no: form.challan_no,
        remarks: form.remarks,
        status: 'Pending',
        created_at: new Date().toISOString(),
        items: items.map((it, idx) => ({
          grn_item_sno: Date.now() + idx,
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

      setGRNList(prev => [newGRN, ...prev]);
      toast.success('GRN submitted successfully (temporary data)');
      setSubmitting(false);
    }, 400);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <TwoPaneLayout
      icon={PackageCheck}
      title="Goods Receipt Note"
      description="Receive goods against purchase orders, record quantities and condition"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <POListSidebar
          poList={poList}
          loading={loadingPO}
          selectedPO={selectedPO}
          onSelectPO={(po) => { handleSelectPO(po); setSidebarOpen(false); }}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> PO List
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
          message="Select a Purchase Order"
          description="Choose a PO from the left panel to create a Goods Receipt Note"
          icon={PackageCheck}
        />
      ) : (
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <POSummaryCard po={selectedPO} />

          {(canCreate("GRNPage") || canEdit("GRNPage")) && (
            <GRNEntryForm
              po={selectedPO}
              onSubmit={handleSubmitGRN}
              submitting={submitting}
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
