import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

import type { PayableBill, PaymentRecord, PaymentFormState } from './Payment/types';
import {
  MOCK_PAYABLE_BILLS, getPaymentsForBill, generatePaymentNo, requiresReference,
} from './Payment/helpers';

import PayableBillSidebar from './Payment/PayableBillSidebar';
import PaymentForm from './Payment/PaymentForm';
import PaymentHistoryView from './Payment/PaymentHistoryView';

const PaymentPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [bills, setBills] = useState<PayableBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selected, setSelected] = useState<PayableBill | null>(null);

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBills = useCallback(() => {
    setLoadingBills(true);
    setTimeout(() => { setBills(MOCK_PAYABLE_BILLS); setLoadingBills(false); }, 300);
  }, []);

  const fetchPayments = useCallback((bill_sno: number) => {
    setLoadingPayments(true);
    setTimeout(() => { setPayments(getPaymentsForBill(bill_sno)); setLoadingPayments(false); }, 200);
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  useEffect(() => {
    if (selected?.bill_sno) fetchPayments(selected.bill_sno);
    else setPayments([]);
  }, [selected?.bill_sno, fetchPayments]);

  const handleSubmit = (form: PaymentFormState) => {
    if (!selected) return;
    const amount = Number(form.amount) || 0;
    if (amount <= 0) { toast.error('Payment amount must be greater than 0'); return; }
    if (amount > selected.outstanding) { toast.error('Amount exceeds outstanding balance'); return; }
    if (requiresReference(form.mode) && !form.reference_no.trim()) {
      toast.error(`Reference number is required for ${form.mode} payments`); return;
    }

    setSaving(true);
    setTimeout(() => {
      const newPayment: PaymentRecord = {
        payment_sno: Date.now(),
        payment_no: generatePaymentNo(),
        bill_sno: selected.bill_sno,
        bill_no: selected.bill_no,
        supplier_invoice_no: selected.supplier_invoice_no,
        po_no: selected.po_no,
        vendor_sno: selected.vendor_sno,
        vendor_name: selected.vendor_name,
        payment_date: form.payment_date,
        amount,
        mode: form.mode,
        bank_account: form.bank_account,
        reference_no: form.reference_no || undefined,
        status: form.mode === 'Cash' ? 'Cleared' : 'Processed',
        remarks: form.remarks,
        created_by_name: 'Current User',
        created_at: new Date().toISOString(),
      };

      setPayments(prev => [newPayment, ...prev]);

      // update outstanding on the bill locally
      const newPaid = selected.paid_amount + amount;
      const newOutstanding = Math.max(0, selected.net_payable - newPaid);
      const updatedBill: PayableBill = { ...selected, paid_amount: newPaid, outstanding: newOutstanding };
      setBills(prev => prev.map(b => b.bill_sno === selected.bill_sno ? updatedBill : b));
      setSelected(updatedBill);

      toast.success(`Payment ${newPayment.payment_no} recorded${newOutstanding === 0 ? ' — bill fully settled' : ''}`);
      setSaving(false);
    }, 400);
  };

  const canPay = canCreate('PaymentPage');

  return (
    <TwoPaneLayout
      icon={Wallet}
      title="Payments"
      description="Pay approved supplier bills — full, partial or advance payments with clearance tracking"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <PayableBillSidebar
          bills={bills}
          loading={loadingBills}
          selected={selected}
          onSelect={(b) => { setSelected(b); setSidebarOpen(false); }}
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
            onClick={fetchBills} disabled={loadingBills}
          >
            <RefreshCw size={15} className={loadingBills ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      {!selected ? (
        <EmptyState
          icon={Wallet}
          message="Select a Bill to Pay"
          description="Choose an approved bill from the left panel to record a payment and view its payment history"
        />
      ) : (
        <div className="px-4 sm:px-6 py-4 space-y-4">
          {canPay && selected.outstanding > 0 && (
            <PaymentForm bill={selected} onSubmit={handleSubmit} saving={saving} />
          )}
          {selected.outstanding === 0 && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
              This bill is fully settled.
            </div>
          )}
          <PaymentHistoryView payments={payments} loading={loadingPayments} />
        </div>
      )}
    </TwoPaneLayout>
  );
};

export default PaymentPage;
