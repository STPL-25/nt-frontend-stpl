import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import axios from 'axios';

import type { PayableBill, PaymentRecord, PaymentFormState } from './Payment/types';
import { requiresReference } from './Payment/helpers';
import { getPayableBills, createPayment, getPaymentHistory } from '@/Services/Api';

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

  const fetchBills = useCallback(async (): Promise<PayableBill[]> => {
    setLoadingBills(true);
    try {
      const res = await axios.get(getPayableBills);
      const freshBills: PayableBill[] = res.data?.data ?? [];
      setBills(freshBills);
      return freshBills;
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to load payable bills');
      return [];
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const fetchPayments = useCallback(async (bill_sno: number) => {
    setLoadingPayments(true);
    try {
      const res = await axios.get(getPaymentHistory, { params: { bill_sno } });
      setPayments(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to load payment history');
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  useEffect(() => {
    if (selected?.bill_sno) fetchPayments(selected.bill_sno);
    else setPayments([]);
  }, [selected?.bill_sno, fetchPayments]);

  const handleSubmit = async (form: PaymentFormState) => {
    if (!selected) return;
    const amount = Number(form.amount) || 0;
    if (amount <= 0) { toast.error('Payment amount must be greater than 0'); return; }
    if (amount > selected.outstanding) { toast.error('Amount exceeds outstanding balance'); return; }
    if (requiresReference(form.mode) && !form.reference_no.trim()) {
      toast.error(`Reference number is required for ${form.mode} payments`); return;
    }
    if (!selected.vendor_sno) { toast.error('This bill has no vendor on record'); return; }

    setSaving(true);
    try {
      const res = await axios.post(createPayment, {
        vendor_sno: selected.vendor_sno,
        payment_date: form.payment_date,
        amount,
        mode: form.mode,
        bank_account: form.bank_account,
        reference_no: form.reference_no || undefined,
        remarks: form.remarks,
        allocations: [{ invoice_alloc_sno: selected.bill_sno, amount }],
      });
      const payment = res.data?.data;

      // Re-fetch both — the bucket's outstanding and payment history are
      // server-computed (release_amount minus everything already paid).
      await fetchPayments(selected.bill_sno);
      const freshBills = await fetchBills();
      // A fully-settled bucket drops out of sp_nt_GetPayableBills entirely —
      // if it's gone, treat it as settled rather than leaving `selected`
      // pointing at stale (pre-payment) outstanding/paid_amount values.
      const stillOpen = freshBills.find(b => b.bill_sno === selected.bill_sno);
      setSelected(stillOpen ?? { ...selected, paid_amount: selected.paid_amount + amount, outstanding: 0 });

      toast.success(`Payment ${payment?.payment_no ?? ''} recorded${!stillOpen ? ' — bill fully settled' : ''}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
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
