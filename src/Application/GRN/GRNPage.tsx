import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, PackageCheck, FileText, Building2, CalendarDays, Truck } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';

import type { PORecord, GRNRecord, GRNFormState, GRNItemEntry } from './GRN/types';
import { getPODisplayNo, formatDate, formatINR, getGRNStatus } from './GRN/helpers';
import { TEMP_PO_LIST, getTempGRNsForPO } from './GRN/data';

import POListSidebar from './GRN/POListSidebar';
import GRNEntryForm from './GRN/GRNEntryForm';
import GRNListView from './GRN/GRNListView';

// ── PO Summary Card ───────────────────────────────────────────────────────────

const POSummaryCard: React.FC<{ po: PORecord }> = ({ po }) => {
  const { label, color } = getGRNStatus(po);
  const statusClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red:   'bg-red-100   text-red-700   border-red-200',
  };

  const fields = [
    { icon: FileText,    label: 'PO Number',   value: getPODisplayNo(po) },
    { icon: FileText,    label: 'PR Reference', value: po.pr_no ?? '—' },
    { icon: Truck,       label: 'Vendor',       value: po.vendor_name ?? po.company_name ?? '—' },
    { icon: Building2,   label: 'Company',      value: po.com_name ?? '—' },
    { icon: CalendarDays,label: 'PO Date',      value: formatDate(po.po_date) },
    { icon: CalendarDays,label: 'Required By',  value: formatDate(po.required_date) },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PackageCheck size={16} className="text-indigo-600" />
            Purchase Order — {getPODisplayNo(po)}
          </CardTitle>
          <Badge className={`text-xs ${statusClasses[color]}`}>{label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fields.map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-400 font-medium">{f.label}</p>
              <p className="text-sm font-medium text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>
        {po.delivery_address && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-400 font-medium">Delivery Address</p>
            <p className="text-sm text-gray-700">{po.delivery_address}</p>
          </div>
        )}
        {po.total_amount != null && (
          <div className="mt-2 text-xs">
            <span className="text-gray-400">PO Value: </span>
            <span className="font-semibold text-gray-800">{formatINR(po.total_amount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const GRNPage: React.FC = () => {
  useAppState(); // keep for auth context

  const [poList, setPOList] = useState<PORecord[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PORecord | null>(null);

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

  const handleSubmitGRN = (form: GRNFormState, items: GRNItemEntry[]) => {
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
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <PackageCheck className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Goods Receipt Note</h1>
            <p className="text-sm text-gray-500">Receive goods against purchase orders, record quantities and condition</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPOs}
          disabled={loadingPO}
        >
          <RefreshCw size={16} className={loadingPO ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT: PO List Sidebar */}
        <POListSidebar
          poList={poList}
          loading={loadingPO}
          selectedPO={selectedPO}
          onSelectPO={handleSelectPO}
        />

        {/* RIGHT: Main scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedPO ? (
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-400">
              <div className="bg-gray-100 p-6 rounded-full">
                <PackageCheck size={40} />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Select a Purchase Order</p>
                <p className="text-sm mt-1">Choose a PO from the left panel to create a Goods Receipt Note</p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-4">
              {/* Section 1: PO Summary */}
              <POSummaryCard po={selectedPO} />

              {/* Section 2: New GRN Entry */}
              <GRNEntryForm
                po={selectedPO}
                onSubmit={handleSubmitGRN}
                submitting={submitting}
              />

              {/* Section 3: GRN History */}
              <GRNListView
                grns={grnList}
                loading={loadingGRNs}
                onRefresh={() => {
                  if (selectedPO?.po_basic_sno) fetchGRNs(selectedPO.po_basic_sno);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GRNPage;
