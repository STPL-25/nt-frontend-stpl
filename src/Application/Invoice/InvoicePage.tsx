import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, FileText, Menu } from 'lucide-react';
import axios from 'axios';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import {
  getAllInvoices,
  createInvoice,
  linkInvoiceToPO,
  verifyInvoiceDelivery,
  allocateInvoice,
  matchInvoice,
  getPoItemsForAllocation,
  apiGetAllKycDatas,
} from '@/Services/Api';

import type { Invoice, InvoiceCaptureFormState, PoItemForAllocation } from './Invoice/types';
import InvoiceSidebar from './Invoice/InvoiceSidebar';
import InvoiceCaptureForm from './Invoice/InvoiceCaptureForm';
import InvoiceLinkPOForm from './Invoice/InvoiceLinkPOForm';
import InvoiceAllocationForm from './Invoice/InvoiceAllocationForm';
import InvoiceMatchView from './Invoice/InvoiceMatchView';

interface Vendor {
  kyc_basic_info_sno: number;
  company_name: string;
}

const InvoicePage: React.FC = () => {
  useAppState();
  const { canCreate } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [poItems, setPoItems] = useState<PoItemForAllocation[]>([]);
  const [loadingPoItems, setLoadingPoItems] = useState(false);

  const canManage = canCreate('InvoiceAllocationPage');

  const fetchInvoices = useCallback(async (): Promise<Invoice[]> => {
    setLoadingInvoices(true);
    try {
      const res = await axios.get(getAllInvoices);
      const fresh: Invoice[] = res.data?.data ?? [];
      setInvoices(fresh);
      return fresh;
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to load invoices');
      return [];
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    axios.get(apiGetAllKycDatas)
      .then(res => setVendors(Array.isArray(res.data) ? res.data : res.data?.data ?? []))
      .catch(() => setVendors([]));
  }, []);

  const fetchPoItems = useCallback(async (po_basic_sno: number) => {
    setLoadingPoItems(true);
    try {
      const res = await axios.get(getPoItemsForAllocation(po_basic_sno));
      setPoItems(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to load PO lines');
      setPoItems([]);
    } finally {
      setLoadingPoItems(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.po_basic_sno) fetchPoItems(selected.po_basic_sno);
    else setPoItems([]);
  }, [selected?.po_basic_sno, fetchPoItems]);

  const handleSelect = (invoice: Invoice) => {
    setSelected(invoice);
    setShowCaptureForm(false);
    setSidebarOpen(false);
  };

  const handleCapture = async (form: InvoiceCaptureFormState, file: File | null) => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('vendor_invoice_no', form.vendor_invoice_no);
      fd.append('vendor_sno', form.vendor_sno);
      if (form.po_basic_sno) fd.append('po_basic_sno', form.po_basic_sno);
      fd.append('invoice_date', form.invoice_date);
      if (form.due_date) fd.append('due_date', form.due_date);
      fd.append('invoice_amount', form.invoice_amount);
      fd.append('invoice_type', form.invoice_type);
      fd.append('source_type', form.source_type);
      if (form.remarks) fd.append('remarks', form.remarks);
      if (file) fd.append('invoice_file', file);

      const res = await axios.post(createInvoice, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Invoice ${res.data?.data?.[0]?.invoice_no ?? ''} captured`);
      setShowCaptureForm(false);
      const fresh = await fetchInvoices();
      const created = fresh.find(i => i.invoice_sno === res.data?.data?.[0]?.invoice_sno);
      if (created) setSelected(created);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to capture invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkPO = async (po_basic_sno: number) => {
    if (!selected) return;
    setSaving(true);
    try {
      await axios.post(linkInvoiceToPO, { invoice_sno: selected.invoice_sno, po_basic_sno });
      toast.success('Invoice linked to PO');
      const fresh = await fetchInvoices();
      const updated = fresh.find(i => i.invoice_sno === selected.invoice_sno);
      if (updated) setSelected(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to link PO');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (remarks: string) => {
    if (!selected) return;
    setVerifying(true);
    try {
      await axios.post(verifyInvoiceDelivery, { invoice_sno: selected.invoice_sno, remarks });
      toast.success('Delivery verified');
      const fresh = await fetchInvoices();
      const updated = fresh.find(i => i.invoice_sno === selected.invoice_sno);
      if (updated) setSelected(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to verify delivery');
    } finally {
      setVerifying(false);
    }
  };

  const handleAllocate = async (allocations: { po_item_sno: number; allocated_amount: number }[]) => {
    if (!selected) return;
    setSaving(true);
    try {
      await axios.post(allocateInvoice, { invoice_sno: selected.invoice_sno, allocations });
      toast.success('Invoice allocated across buckets');
      const fresh = await fetchInvoices();
      const updated = fresh.find(i => i.invoice_sno === selected.invoice_sno);
      if (updated) setSelected(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to allocate invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleMatch = async () => {
    if (!selected) return;
    setMatching(true);
    try {
      await axios.post(matchInvoice, { invoice_sno: selected.invoice_sno });
      toast.success('Match run — buckets updated');
      const fresh = await fetchInvoices();
      const updated = fresh.find(i => i.invoice_sno === selected.invoice_sno);
      if (updated) setSelected(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to match invoice');
    } finally {
      setMatching(false);
    }
  };

  return (
    <TwoPaneLayout
      icon={FileText}
      title="Invoice Allocation"
      description="Capture composite vendor invoices, split across Material and Service buckets, and match each independently"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <InvoiceSidebar
          invoices={invoices}
          loading={loadingInvoices}
          selected={selected}
          onSelect={handleSelect}
          onNewInvoice={() => { setSelected(null); setShowCaptureForm(true); setSidebarOpen(false); }}
          canCreate={canManage}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> Invoices
          </Button>
          <Button
            variant="outline" size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={fetchInvoices} disabled={loadingInvoices}
          >
            <RefreshCw size={15} className={loadingInvoices ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      {showCaptureForm ? (
        <div className="px-4 sm:px-6 py-4">
          <InvoiceCaptureForm
            vendors={vendors}
            saving={saving}
            onSubmit={handleCapture}
            onCancel={() => setShowCaptureForm(false)}
          />
        </div>
      ) : !selected ? (
        <EmptyState
          icon={FileText}
          message="Select an Invoice"
          description="Choose an invoice from the left panel, or capture a new one, to allocate and match it"
        />
      ) : (
        <div className="px-4 sm:px-6 py-4 space-y-4">
          {!selected.po_basic_sno && (
            <InvoiceLinkPOForm invoice={selected} saving={saving} verifying={verifying} onSubmit={handleLinkPO} onVerify={handleVerify} />
          )}
          {selected.po_basic_sno && (
            <>
              <InvoiceAllocationForm
                invoice={selected}
                poItems={poItems}
                loadingItems={loadingPoItems}
                saving={saving}
                onSubmit={handleAllocate}
              />
              <InvoiceMatchView invoice={selected} matching={matching} onMatch={handleMatch} />
            </>
          )}
        </div>
      )}
    </TwoPaneLayout>
  );
};

export default InvoicePage;
