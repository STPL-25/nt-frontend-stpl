import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, ReceiptText, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

import type { Bill, BillableGRN, BillFormState, BillStatus } from './Bill/types';
import {
  MOCK_BILLS, MOCK_BILLABLE_GRNS, generateBillNo, computeTotals, matchAgainstGRN,
} from './Bill/helpers';

import BillSidebar from './Bill/BillSidebar';
import BillForm from './Bill/BillForm';
import BillDetailView from './Bill/BillDetailView';

const AccountsBillPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [bills, setBills] = useState<Bill[]>([]);
  const [grns, setGRNs] = useState<BillableGRN[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setBills(MOCK_BILLS);
      setGRNs(MOCK_BILLABLE_GRNS);
      setLoading(false);
    }, 300);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSelect = (bill: Bill) => { setSelected(bill); setIsNew(false); };
  const handleNew = () => { setSelected(null); setIsNew(true); };

  const handleSubmit = (form: BillFormState, status: BillStatus) => {
    if (!form.supplier_invoice_no.trim()) { toast.error('Supplier invoice number is required'); return; }
    if (!(Number(form.basic_amount) > 0)) { toast.error('Basic amount must be greater than 0'); return; }

    setSaving(true);
    setTimeout(() => {
      const grn = grns.find(g => String(g.grn_basic_sno) === form.grn_basic_sno) ?? null;
      const t = computeTotals(form);
      const newBill: Bill = {
        bill_sno: Date.now(),
        bill_no: generateBillNo(),
        supplier_invoice_no: form.supplier_invoice_no,
        invoice_date: form.invoice_date,
        grn_basic_sno: grn?.grn_basic_sno,
        grn_no: grn?.grn_no,
        po_basic_sno: grn?.po_basic_sno,
        po_no: grn?.po_no,
        vendor_sno: grn?.vendor_sno,
        vendor_name: grn?.vendor_name,
        basic_amount: Number(form.basic_amount),
        discount: Number(form.discount) || 0,
        taxable_amount: t.taxable,
        cgst: t.cgst,
        sgst: t.sgst,
        igst: t.igst,
        tds: t.tds,
        other_charges: Number(form.other_charges) || 0,
        net_payable: t.netPayable,
        due_date: form.due_date || undefined,
        match_status: matchAgainstGRN(Number(form.basic_amount), grn),
        status,
        paid_amount: 0,
        remarks: form.remarks,
        created_by_name: 'Current User',
        created_at: new Date().toISOString(),
      };
      setBills(prev => [newBill, ...prev]);
      setSelected(newBill);
      setIsNew(false);
      toast.success(`Bill ${newBill.bill_no} ${status === 'Draft' ? 'saved as draft' : 'booked & sent for approval'}`);
      setSaving(false);
    }, 400);
  };

  const handleApprove = (bill: Bill) => {
    setBills(prev => prev.map(b => b.bill_sno === bill.bill_sno ? { ...b, status: 'Approved' } : b));
    setSelected(prev => prev && prev.bill_sno === bill.bill_sno ? { ...prev, status: 'Approved' } : prev);
    toast.success(`Bill ${bill.bill_no} approved — ready for payment`);
  };

  const showForm = isNew;
  const showDetail = !isNew && selected;
  const canApprove = canEdit('AccountsBillPage');

  return (
    <TwoPaneLayout
      icon={ReceiptText}
      title="Accounts — Bill Booking"
      description="Book supplier invoices against GRN with 3-way match, GST/TDS computation and approval"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <BillSidebar
          bills={bills}
          loading={loading}
          selected={selected}
          onSelect={(b) => { handleSelect(b); setSidebarOpen(false); }}
          onNew={canCreate('AccountsBillPage') ? () => { handleNew(); setSidebarOpen(false); } : undefined}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> Bills
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
          <BillForm grns={grns} onSubmit={handleSubmit} saving={saving} />
        ) : showDetail ? (
          <BillDetailView bill={selected!} onApprove={canApprove ? handleApprove : undefined} />
        ) : (
          <EmptyState
            icon={ReceiptText}
            message="Select or Create a Bill"
            description="Choose a bill from the left panel to view details, or click 'New' to book a supplier invoice against a GRN"
          />
        )}
      </div>
    </TwoPaneLayout>
  );
};

export default AccountsBillPage;
