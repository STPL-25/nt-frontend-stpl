import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet, Search, Send, RefreshCw, Package } from 'lucide-react';
import { FormSection, PageHeader } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import axios from 'axios';
import { getPayableBills, createPayment } from '@/Services/Api';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';

interface PayableBill {
  bill_sno: number;
  bill_no: string;
  supplier_invoice_no: string | null;
  po_no: string | null;
  vendor_sno: number;
  vendor_name: string;
  invoice_date: string;
  due_date: string | null;
  request_mode: string | null;
  payment_cycle_days: number | null;
  received_date: string | null;
  net_payable: number;
  paid_amount: number;
  outstanding: number;
  requested_qty: number | null;
  received_qty: number | null;
}

const MODE_OPTIONS = [
  { label: 'NEFT', value: 'NEFT' },
  { label: 'RTGS', value: 'RTGS' },
  { label: 'Cheque', value: 'Cheque' },
  { label: 'Cash', value: 'Cash' },
  { label: 'UPI', value: 'UPI' },
  { label: 'DD', value: 'DD' },
];

const PaymentPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'PaymentPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);

  const { options } = useMasterOptions(['VendorMaster']);

  const [vendorSno, setVendorSno] = useState<string>('');
  const [bills, setBills] = useState<PayableBill[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({ mode: 'NEFT', payment_date: new Date().toISOString().slice(0, 10) });

  const handleSearch = async () => {
    setSearching(true);
    setSearched(true);
    setSelected(new Set());
    try {
      const res = await axios.get(getPayableBills, { params: vendorSno ? { vendor_sno: vendorSno } : {} });
      setBills(res?.data?.data ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load payable bills');
      setBills([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleRow = (bill_sno: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bill_sno)) next.delete(bill_sno); else next.add(bill_sno);
      return next;
    });
  };

  // Payments must stay single-vendor per release (sp_nt_ReleasePayment takes
  // one vendor_sno) — selecting a bill from a different vendor than the
  // current selection clears the prior selection first.
  const selectedVendorSno = useMemo(() => {
    const first = bills.find((b) => selected.has(b.bill_sno));
    return first?.vendor_sno ?? null;
  }, [bills, selected]);

  const handleToggleWithVendorGuard = (bill: PayableBill) => {
    if (selectedVendorSno && selectedVendorSno !== bill.vendor_sno && !selected.has(bill.bill_sno)) {
      toast.error('A payment release covers one supplier at a time — clear the current selection first.');
      return;
    }
    toggleRow(bill.bill_sno);
  };

  const allSelected = bills.length > 0 && selected.size === bills.length;
  const toggleAll = () => {
    if (allSelected) { setSelected(new Set()); return; }
    const vendorToUse = bills[0]?.vendor_sno;
    setSelected(new Set(bills.filter((b) => b.vendor_sno === vendorToUse).map((b) => b.bill_sno)));
  };

  const selectedTotal = useMemo(
    () => bills.filter((b) => selected.has(b.bill_sno)).reduce((sum, b) => sum + (Number(b.outstanding) || 0), 0),
    [bills, selected]
  );

  const handleReleasePayment = async () => {
    if (selected.size === 0 || !selectedVendorSno) return;
    setReleasing(true);
    try {
      const allocations = bills
        .filter((b) => selected.has(b.bill_sno))
        .map((b) => ({ invoice_alloc_sno: b.bill_sno, amount: Number(b.outstanding) }));
      const res = await axios.post(createPayment, {
        vendor_sno: selectedVendorSno,
        payment_date: paymentDetails.payment_date,
        amount: selectedTotal,
        mode: paymentDetails.mode,
        bank_account: paymentDetails.bank_account,
        reference_no: paymentDetails.reference_no,
        remarks: paymentDetails.remarks,
        allocations,
      });
      const paymentNo = res?.data?.data?.[0]?.payment_no;
      toast.success(paymentNo ? `Payment ${paymentNo} released` : 'Payment released');
      setBills((prev) => prev.filter((b) => !selected.has(b.bill_sno)));
      setSelected(new Set());
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to release payment. Try again.');
    } finally {
      setReleasing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={Wallet}
        title="Payment"
        description="Select payable bills and release payment — spans any invoice source, not only Vendor-Driven"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-4">
            <FormSection icon={Search} title="Find Payable Bills">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                <div className="flex flex-col">
                  <CustomInputField
                    field="vendor_sno"
                    label="Supplier (optional)"
                    type="search-select"
                    options={options?.VendorMaster}
                    value={vendorSno}
                    onChange={(value) => setVendorSno(String(value))}
                    placeholder="All suppliers"
                    className="h-10"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button type="button" onClick={handleSearch} disabled={searching} className="h-9">
                  {searching ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Search
                </Button>
              </div>
            </FormSection>
          </CardContent>
        </Card>

        {searched && (
          <Card className="shadow-md">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Payable Bills<Badge variant="secondary">{bills.length}</Badge>
                </h3>
                {selected.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selected.size} selected — total ₹{selectedTotal.toFixed(2)}
                  </span>
                )}
              </div>

              {bills.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-10">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                        </TableHead>
                        <TableHead className="text-xs">Bill No</TableHead>
                        <TableHead className="text-xs">Supplier</TableHead>
                        <TableHead className="text-xs">PO No</TableHead>
                        <TableHead className="text-xs">Invoice Date</TableHead>
                        <TableHead className="text-xs">Due Date</TableHead>
                        <TableHead className="text-xs text-right">Requested / GRN Qty</TableHead>
                        <TableHead className="text-xs text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.map((bill) => (
                        <TableRow key={bill.bill_sno} className={selected.has(bill.bill_sno) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                          <TableCell>
                            <Checkbox checked={selected.has(bill.bill_sno)} onCheckedChange={() => handleToggleWithVendorGuard(bill)} />
                          </TableCell>
                          <TableCell className="text-xs font-medium">{bill.bill_no}</TableCell>
                          <TableCell className="text-xs">{bill.vendor_name}</TableCell>
                          <TableCell className="text-xs">{bill.po_no ?? '—'}</TableCell>
                          <TableCell className="text-xs">{String(bill.invoice_date).slice(0, 10)}</TableCell>
                          <TableCell className="text-xs">{bill.due_date ? String(bill.due_date).slice(0, 10) : '—'}</TableCell>
                          <TableCell className="text-xs text-right">
                            {bill.requested_qty != null ? `${bill.requested_qty} / ${bill.received_qty}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">₹{Number(bill.outstanding).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground border rounded-xl bg-muted/10">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No payable bills found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {searched && selected.size > 0 && (
          <Card className="shadow-md">
            <CardContent className="pt-6 space-y-4">
              <FormSection icon={Wallet} title="Payment Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                  <div className="flex flex-col">
                    <CustomInputField
                      field="payment_date"
                      label="Payment Date"
                      require
                      type="date"
                      value={paymentDetails.payment_date ?? ''}
                      onChange={(value) => setPaymentDetails((prev) => ({ ...prev, payment_date: value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col">
                    <CustomInputField
                      field="mode"
                      label="Mode"
                      require
                      type="select"
                      options={MODE_OPTIONS}
                      value={paymentDetails.mode ?? 'NEFT'}
                      onChange={(value) => setPaymentDetails((prev) => ({ ...prev, mode: value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col">
                    <CustomInputField
                      field="reference_no"
                      label="Reference No"
                      type="text"
                      value={paymentDetails.reference_no ?? ''}
                      onChange={(value) => setPaymentDetails((prev) => ({ ...prev, reference_no: value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col">
                    <CustomInputField
                      field="bank_account"
                      label="Bank Account"
                      type="text"
                      value={paymentDetails.bank_account ?? ''}
                      onChange={(value) => setPaymentDetails((prev) => ({ ...prev, bank_account: value }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </FormSection>

              <div className="flex items-center justify-end pt-4 border-t">
                {canSubmit && (
                  <Button
                    type="button"
                    onClick={handleReleasePayment}
                    disabled={releasing || !paymentDetails.mode || !paymentDetails.payment_date}
                    className="bg-blue-600 hover:bg-blue-700 h-9"
                  >
                    {releasing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Release Payment (₹{selectedTotal.toFixed(2)})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
