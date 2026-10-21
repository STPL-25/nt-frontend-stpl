import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet, Send, RefreshCw, Package, FileText, Plus } from 'lucide-react';
import EnterInvoiceDialog from './EnterInvoiceDialog';
import { FormSection } from '@/CustomComponent/PageComponents';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import { Callout, DetailEmptyState, Panel, SearchInput, SelectableCard, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import axios from 'axios';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { getErrorMessage } from '@/lib/errors';
import {
  payNetBills, payNetGrnPending, payNetAdjustments, payNetPreview, payNetRelease, payNetInvoiceLedger,
  type GrnPendingPayment, type PayableBillNet, type PaymentAdjustments, type NetPreview, type InvoiceLedger, type InvoicePaymentStatus,
} from '@/Services/GrnService/paymentNetApi';

const MODE_OPTIONS = [
  { label: 'NEFT', value: 'NEFT' },
  { label: 'RTGS', value: 'RTGS' },
  { label: 'Cheque', value: 'Cheque' },
  { label: 'Cash', value: 'Cash' },
  { label: 'UPI', value: 'UPI' },
  { label: 'DD', value: 'DD' },
];

const money = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Why a bill cannot be selected yet (empty = payable). */
const blockReason = (b: PayableBillNet): string => {
  if (b.grn_state === 'Pending approval') return 'GRN is awaiting approval';
  if (b.grn_state === 'No GRN') return 'No approved GRN for this PO';
  if (b.on_hold_2b) return 'Not in GSTR-2B yet - Accounts can release the hold on the GSTR-2B screen';
  return '';
};

const grnBadge = (b: PayableBillNet) => {
  if (b.grn_state === 'Done') return <Badge className="bg-green-100 text-green-800 text-[10px]">GRN done</Badge>;
  if (b.grn_state === 'NA') return <Badge variant="secondary" className="text-[10px]">Service</Badge>;
  return <Badge variant="destructive" className="text-[10px]">{b.grn_state}</Badge>;
};

const itcBadge = (b: PayableBillNet) => {
  if (!b.gst_supplier) return <Badge variant="secondary" className="text-[10px]">No GSTIN</Badge>;
  if (b.itc_status === 'Eligible') return <Badge className="bg-green-100 text-green-800 text-[10px]">In 2B</Badge>;
  if (b.itc_status === 'Ineligible') return <Badge className="bg-amber-100 text-amber-800 text-[10px]">In 2B · no ITC</Badge>;
  if (b.payment_hold_override === 'Y') return <Badge className="bg-blue-100 text-blue-800 text-[10px]">Hold released</Badge>;
  return <Badge variant="destructive" className="text-[10px]">Not in 2B</Badge>;
};

const statusBadge = (st: InvoicePaymentStatus) => {
  if (st === 'Paid') return <Badge className="bg-green-100 text-green-800 text-[10px]">Paid</Badge>;
  if (st === 'Part paid') return <Badge className="bg-blue-100 text-blue-800 text-[10px]">Part paid</Badge>;
  if (st === 'Not allocated') return <Badge className="bg-amber-100 text-amber-800 text-[10px]">Not allocated</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Unpaid</Badge>;
};
const dateOnly = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '—');

type PayGroup = {
  key: string; poNo: string | null; vendorName: string | null; vendorSno: number | null;
  bills: PayableBillNet[]; info?: GrnPendingPayment;
};

const PaymentPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'PaymentPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);
  const canEnterInvoice = canCreate('InvoiceAllocationPage') || canSubmit;

  const { options } = useMasterOptions(['VendorMaster']);

  const [vendorSno, setVendorSno] = useState<string>('');
  const [bills, setBills] = useState<PayableBillNet[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [grnPending, setGrnPending] = useState<GrnPendingPayment[]>([]);
  const [ledger, setLedger] = useState<InvoiceLedger>({ invoices: [], grns: [] });
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({ mode: 'NEFT', payment_date: new Date().toISOString().slice(0, 10) });

  // adjustments for the selected supplier
  const [adj, setAdj] = useState<PaymentAdjustments | null>(null);
  const [advAmt, setAdvAmt] = useState<Record<number, string>>({});
  const [dnPick, setDnPick] = useState<Set<number>>(new Set());
  const [cnPick, setCnPick] = useState<Set<number>>(new Set());
  // answer to "redeem the supplier's unredeemed debit / credit notes in this bill?" (null = not asked yet)
  const [redeemChoice, setRedeemChoice] = useState<'yes' | 'no' | null>(null);
  const [applyTds, setApplyTds] = useState(true);
  const [tdsSection, setTdsSection] = useState<Record<number, string>>({});   // invoice_sno -> section ('' = none)
  const [preview, setPreview] = useState<NetPreview | null>(null);
  const [previewError, setPreviewError] = useState('');

  const handleSearch = async () => {
    setSearching(true);
    setSelected(new Set());
    try {
      const params = vendorSno ? { vendor_sno: vendorSno } : {};
      const res = await axios.get(payNetBills, { params });
      const rows: PayableBillNet[] = res?.data?.data ?? [];
      setBills(rows);
      setTdsSection(Object.fromEntries(rows.map((r) => [r.invoice_sno, r.tds_section_code ?? ''])));
      // Per-PO goods / GST / notes / advances / TDS breakup (informational) - a failure here must not hide the invoices.
      try {
        const pend = await axios.get(payNetGrnPending, { params: { ...params, include_billed: 1 } });
        setGrnPending(pend?.data?.data ?? []);
      } catch {
        setGrnPending([]);
      }
      // Invoice-wise ledger (paid + duplicate flags + what each GRN captured) - informational, never blocks the page.
      try {
        const led = await axios.get(payNetInvoiceLedger, { params });
        setLedger({ invoices: led?.data?.data?.invoices ?? [], grns: led?.data?.data?.grns ?? [] });
      } catch {
        setLedger({ invoices: [], grns: [] });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load payments'));
      setBills([]);
      setGrnPending([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => { handleSearch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorSno]);

  // One sidebar entry per PO (a PO can carry many invoices; each invoice no is unique). POs with goods received but
  // no invoice yet are listed too, flagged "invoice awaited". An invoice with no PO stands alone.
  const groups = useMemo<PayGroup[]>(() => {
    const map = new Map<string, PayGroup>();
    const infoByPo = new Map(grnPending.map((g) => [g.po_no, g]));
    for (const b of bills) {
      const key = b.po_no ? `po:${b.po_no}` : `inv:${b.invoice_sno}`;
      const g = map.get(key) ?? { key, poNo: b.po_no, vendorName: b.vendor_name, vendorSno: b.vendor_sno, bills: [], info: b.po_no ? infoByPo.get(b.po_no) : undefined };
      g.bills.push(b);
      map.set(key, g);
    }
    for (const g of grnPending) {
      const key = `po:${g.po_no}`;
      if (!map.has(key)) map.set(key, { key, poNo: g.po_no, vendorName: g.vendor_name, vendorSno: g.vendor_sno, bills: [], info: g });
    }
    return [...map.values()];
  }, [bills, grnPending]);

  const filteredGroups = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      [g.vendorName, g.poNo, ...g.bills.map((b) => `${b.bill_no} ${b.supplier_invoice_no ?? ''}`)].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [groups, listSearch]);

  const activeGroup = groups.find((g) => g.key === selectedKey) ?? null;
  const pickGroup = (g: PayGroup) => { setSelectedKey(g.key); setSelected(new Set()); };

  // TDS sections offered for a bill: service bill -> Service + Both, goods bill -> Product + Both, a mix of the two -> all.
  const tdsOptionGroups = (invoice_sno: number) => {
    const kinds = new Set(bills.filter((b) => b.invoice_sno === invoice_sno).map((b) => (b.bucket_type === 'SERVICE' ? 'Service' : 'Product')));
    const active = (adj?.tdsSections ?? []).filter((t) => t.is_active === 'Y');
    const pick = (a: string) => active.filter((t) => (t.applies_to ?? 'Both') === a);
    const groups = [
      { label: 'Service', items: kinds.has('Service') ? pick('Service') : [] },
      { label: 'Product', items: kinds.has('Product') ? pick('Product') : [] },
      { label: 'Service & Product', items: pick('Both') },
    ];
    return groups.filter((g) => g.items.length > 0);
  };

  const selectedBills = useMemo(() => bills.filter((b) => selected.has(b.bill_sno)), [bills, selected]);
  const selectedVendorSno = selectedBills[0]?.vendor_sno ?? null;
  const selectedTotal = selectedBills.reduce((sum, b) => sum + (Number(b.outstanding) || 0), 0);

  const toggleRow = (bill: PayableBillNet) => {
    if (blockReason(bill)) return;
    if (selectedVendorSno && selectedVendorSno !== bill.vendor_sno && !selected.has(bill.bill_sno)) {
      toast.error('A payment release covers one supplier at a time - clear the current selection first.');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bill.bill_sno)) next.delete(bill.bill_sno); else next.add(bill.bill_sno);
      return next;
    });
  };

  const payable = (activeGroup?.bills ?? []).filter((b) => !blockReason(b));
  const allSelected = payable.length > 0 && selected.size === payable.length;
  const toggleAll = () => {
    if (allSelected) { setSelected(new Set()); return; }
    setSelected(new Set(payable.map((b) => b.bill_sno)));
  };

  // load advances / notes when the supplier of the selection changes
  useEffect(() => {
    setAdvAmt({});
    setDnPick(new Set());
    setCnPick(new Set());
    setRedeemChoice(null);
    setPreview(null);
    if (!selectedVendorSno) { setAdj(null); return; }
    axios.get(payNetAdjustments(selectedVendorSno))
      .then((res) => {
        const data: PaymentAdjustments = res.data?.data;
        setAdj(data);
        // pending notes are NOT applied until the user answers the "redeem in this bill?" prompt
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load advances and notes')));
  }, [selectedVendorSno]);

  const buildBody = () => ({
    vendor_sno: selectedVendorSno,
    payment_date: paymentDetails.payment_date,
    mode: paymentDetails.mode,
    bank_account: paymentDetails.bank_account,
    reference_no: paymentDetails.reference_no,
    remarks: paymentDetails.remarks,
    apply_tds: applyTds,
    allocations: selectedBills.map((b) => ({ invoice_alloc_sno: b.bill_sno, amount: Number(b.outstanding) })),
    advances: Object.entries(advAmt).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ advance_sno: Number(id), amount: Number(v) })),
    notes: [
      ...[...dnPick].map((id) => ({ type: 'DEBIT', note_sno: id })),
      ...[...cnPick].map((id) => ({ type: 'CREDIT', note_sno: id })),
    ],
    tds_overrides: [...new Set(selectedBills.map((b) => b.invoice_sno))].map((id) => ({ invoice_sno: id, section: tdsSection[id] ?? '' })),
  });

  // live preview of the amount to pay
  useEffect(() => {
    if (!selectedVendorSno || selectedBills.length === 0 || !adj) { setPreview(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await axios.post(payNetPreview, buildBody());
        if (cancelled) return;
        setPreview(res.data?.data ?? null);
        setPreviewError('');
      } catch (e) {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(getErrorMessage(e, 'Could not work out the amount'));
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, advAmt, dnPick, cnPick, applyTds, tdsSection, paymentDetails.payment_date, adj]);

  const toggleSet = (set: Set<number>, id: number, setter: (s: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const handleReleasePayment = async () => {
    if (selectedBills.length === 0 || !selectedVendorSno) return;
    setReleasing(true);
    try {
      const res = await axios.post(payNetRelease, buildBody());
      const row = res?.data?.data;
      toast.success(row?.payment_no ? `Payment ${row.payment_no} released - pay ${money(row.net_paid)} to the supplier` : 'Payment released');
      await handleSearch();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to release payment. Try again.'));
    } finally {
      setReleasing(false);
    }
  };

  const sum = preview?.summary;
  const hasPendingNotes = !!adj && (adj.debitNotes.length > 0 || adj.creditNotes.length > 0);
  const answerRedeem = (yes: boolean) => {
    setRedeemChoice(yes ? 'yes' : 'no');
    setDnPick(new Set(yes ? adj?.debitNotes.map((n) => n.note_sno) : []));
    setCnPick(new Set(yes ? adj?.creditNotes.map((n) => n.note_sno) : []));
  };

  const info = activeGroup?.info;
  const poInvoices = ledger.invoices.filter((i) => activeGroup?.poNo && i.po_no === activeGroup.poNo);
  const poGrns = ledger.grns.filter((g) => activeGroup?.poNo && g.po_no === activeGroup.poNo);
  const grnsMissingInvoice = poGrns.filter((g) => !g.has_invoice_data);
  const activePoSno = info?.po_basic_sno ?? poInvoices[0]?.po_basic_sno ?? poGrns[0]?.po_basic_sno ?? null;
  const qv = Number(info?.qty_variance) || 0;
  const gv = Number(info?.gst_variance) || 0;
  const activeOutstanding = (g: PayGroup) => g.bills.reduce((t, b) => t + (Number(b.outstanding) || 0), 0);
  const row = (label: string, value: React.ReactNode, tone = '', strong = false) => (
    <div className={`flex justify-between gap-3 ${tone} ${strong ? 'border-t pt-2 text-base font-semibold' : ''}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>
  );

  const sidebar = (closeSheet: () => void) => (
    <>
      <div className="sticky top-0 z-10 -mx-2 -mt-2 space-y-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
        <CustomInputField
          field="vendor_sno"
          label="Supplier"
          type="search-select"
          options={options?.VendorMaster}
          value={vendorSno}
          onChange={(value) => setVendorSno(String(value))}
          placeholder="All suppliers"
          className="h-9"
        />
        <SearchInput value={listSearch} onChange={setListSearch} placeholder="Search supplier, PO, invoice no…" />
      </div>
      {searching && groups.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : filteredGroups.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{listSearch ? 'No matches found' : 'Nothing pending for payment'}</p>
      ) : (
        filteredGroups.map((g) => {
          const awaited = g.bills.length === 0;
          return (
            <SelectableCard key={g.key} selected={g.key === selectedKey} onClick={() => { pickGroup(g); closeSheet(); }}>
              <span className="block truncate text-sm font-semibold">{g.vendorName ?? '—'}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{g.poNo ?? 'No PO'}{g.info?.grn_nos ? ` · GRN ${g.info.grn_nos}` : ''}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {awaited
                  ? <StatusPill tone="warning">Invoice awaited</StatusPill>
                  : <StatusPill tone="info">{g.bills.length} invoice{g.bills.length !== 1 ? 's' : ''}</StatusPill>}
              </span>
              <span className="mt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">{awaited ? 'Net payable (est.)' : 'Outstanding'}</span>
                <span className="font-semibold text-primary tabular-nums">{money(awaited ? g.info?.net_payable : activeOutstanding(g))}</span>
              </span>
            </SelectableCard>
          );
        })
      )}
    </>
  );

  const detail = activeGroup ? (
    <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
      <Panel
        icon={FileText}
        title={activeGroup.vendorName ?? 'Supplier'}
        description={`${activeGroup.poNo ?? 'No PO'}${info?.grn_nos ? ` · GRN ${info.grn_nos}` : ''}`}
        action={<Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleSearch} disabled={searching}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${searching ? 'animate-spin' : ''}`} />Refresh</Button>}
      >
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invoices</p><p className="font-semibold">{activeGroup.bills.length}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last received</p><p className="font-semibold">{info?.last_received_date ? new Date(info.last_received_date).toLocaleDateString('en-IN', { timeZone: 'UTC' }) : '—'}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Outstanding on invoices</p><p className="font-semibold tabular-nums">{money(activeOutstanding(activeGroup))}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected</p><p className="font-semibold tabular-nums">{selected.size} · {money(selectedTotal)}</p></div>
        </div>
      </Panel>

      {info && (
        <Panel icon={Package} title="Goods received & payment breakup" description="GST is worked on the quantity actually received">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5 text-sm">
              {row('Ordered qty', Number(info.ordered_qty))}
              {row('Received qty', Number(info.received_qty))}
              {qv < 0 && row('Shortage', Math.abs(qv), 'text-amber-700')}
              {qv > 0 && row('Excess', qv, 'text-blue-700')}
              {row('Taxable value (received qty)', money(info.taxable_value))}
              {row('GST on received qty', money(info.gst_value))}
              {gv !== 0 && row(gv < 0 ? 'GST reduced for shortage' : 'GST increased for excess', `${gv < 0 ? '-' : '+'} ${money(Math.abs(gv))}`, gv < 0 ? 'text-amber-700' : 'text-blue-700')}
              {row('Gross (taxable + GST)', money(info.grn_value), '', true)}
            </div>
            <div className="space-y-1.5 text-sm">
              {row('Gross', money(info.grn_value))}
              {row('Less debit notes raised', `- ${money(info.debit_notes)}`, 'text-red-700')}
              {row('Add credit notes', `+ ${money(info.credit_notes)}`, 'text-green-700')}
              {row('Less advances paid', `- ${money(info.advances)}`, 'text-red-700')}
              {row('Less TDS payable (est.)', `- ${money(info.tds_estimate)}`, 'text-red-700')}
              {row('Net payable', money(info.net_payable), '', true)}
              <p className="pt-1 text-xs text-muted-foreground">Shortage debit notes are not deducted again (already out of the received qty). TDS is a goods estimate (194Q); the final section is chosen below at payment.</p>
            </div>
          </div>
        </Panel>
      )}

      <Panel
        icon={FileText}
        title={`Invoice-wise details (${poInvoices.length})`}
        description="Every supplier invoice on this PO - paid, part paid or unpaid - with duplicate checks"
        action={canEnterInvoice && activePoSno && activeGroup.vendorSno ? (
          <Button type="button" size="sm" className="h-8 text-xs" onClick={() => setInvoiceDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Enter invoice
          </Button>
        ) : undefined}
      >
        {poInvoices.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs">Invoice No</TableHead>
                  <TableHead className="text-xs">Supplier Inv No</TableHead>
                  <TableHead className="text-xs">Date / Due</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Payment No</TableHead>
                  <TableHead className="text-xs text-right">Invoice amt</TableHead>
                  <TableHead className="text-xs text-right">Payable</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poInvoices.map((i) => (
                  <TableRow key={i.invoice_sno} className={i.dup_count > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                    <TableCell className="text-xs font-medium">{i.invoice_no}</TableCell>
                    <TableCell className="text-xs">
                      {i.supplier_invoice_no ?? '—'}
                      {i.dup_count > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">Duplicate ×{i.dup_count + 1}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{dateOnly(i.invoice_date)}<p className="text-muted-foreground">{dateOnly(i.due_date)}</p></TableCell>
                    <TableCell>{statusBadge(i.payment_status)}</TableCell>
                    <TableCell className="text-xs">{i.payment_nos ?? '—'}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{money(i.invoice_amount)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{i.payment_status === 'Not allocated' ? '—' : money(i.release_total)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{Number(i.paid_total) > 0 ? money(i.paid_total) : '—'}</TableCell>
                    <TableCell className="text-xs text-right font-medium tabular-nums">{i.payment_status === 'Not allocated' ? '—' : money(i.outstanding)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No supplier invoice has been entered against this PO.</p>
        )}
        {poInvoices.some((i) => i.payment_status === 'Not allocated') && (
          <p className="mt-2 text-xs text-muted-foreground">Not-allocated invoices are entered but not yet matched to PO lines on the Invoice screen, so they cannot be paid.</p>
        )}

        {poGrns.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold">Invoice captured at GRN</p>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs">GRN</TableHead>
                    <TableHead className="text-xs">Received</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Supplier Inv No</TableHead>
                    <TableHead className="text-xs">Inv date</TableHead>
                    <TableHead className="text-xs text-right">Inv amt</TableHead>
                    <TableHead className="text-xs">Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poGrns.map((g) => (
                    <TableRow key={g.grn_basic_sno} className={g.dup_count > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                      <TableCell className="text-xs font-medium">GRN {g.grn_no}</TableCell>
                      <TableCell className="text-xs">{dateOnly(g.received_date)}</TableCell>
                      <TableCell className="text-xs">{g.status}</TableCell>
                      <TableCell className="text-xs">
                        {g.invoice_no ?? <span className="text-muted-foreground">Not captured</span>}
                        {g.dup_count > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">Used {g.dup_count + 1}×</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{dateOnly(g.invoice_date)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{g.invoice_amount != null ? money(g.invoice_amount) : '—'}</TableCell>
                      <TableCell className="text-xs">{g.invoice_doc_url ? <a href={g.invoice_doc_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Panel>

      <Panel icon={Wallet} title={`Invoices against this PO (${activeGroup.bills.length})`} description="Each invoice number is unique - tick the ones to pay together">
        {activeGroup.bills.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-xs">Invoice No</TableHead>
                  <TableHead className="text-xs">Supplier Inv No</TableHead>
                  <TableHead className="text-xs">Date / Due</TableHead>
                  <TableHead className="text-xs">GRN</TableHead>
                  <TableHead className="text-xs">GSTR-2B</TableHead>
                  <TableHead className="text-xs">TDS section</TableHead>
                  <TableHead className="text-xs text-right">Invoice amt</TableHead>
                  <TableHead className="text-xs text-right">Hold</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGroup.bills.map((bill) => {
                  const reason = blockReason(bill);
                  const isSel = selected.has(bill.bill_sno);
                  return (
                    <TableRow key={bill.bill_sno} title={reason} className={`${isSel ? 'bg-blue-50 dark:bg-blue-950/20' : ''} ${reason ? 'opacity-60' : ''}`}>
                      <TableCell><Checkbox checked={isSel} disabled={!!reason} onCheckedChange={() => toggleRow(bill)} /></TableCell>
                      <TableCell className="text-xs font-medium">{bill.bill_no}</TableCell>
                      <TableCell className="text-xs">{bill.supplier_invoice_no ?? '—'}</TableCell>
                      <TableCell className="text-xs">{String(bill.invoice_date).slice(0, 10)}<p className="text-muted-foreground">{bill.due_date ? String(bill.due_date).slice(0, 10) : '—'}</p></TableCell>
                      <TableCell>{grnBadge(bill)}</TableCell>
                      <TableCell>{itcBadge(bill)}</TableCell>
                      <TableCell>
                        <select
                          className="h-7 rounded-md border bg-background px-1 text-xs"
                          value={tdsSection[bill.invoice_sno] ?? ''}
                          disabled={!isSel}
                          onChange={(e) => setTdsSection((p) => ({ ...p, [bill.invoice_sno]: e.target.value }))}
                        >
                          <option value="">No TDS</option>
                          {tdsSection[bill.invoice_sno] && !tdsOptionGroups(bill.invoice_sno).some((g) => g.items.some((t) => t.section_code === tdsSection[bill.invoice_sno])) && (
                            <option value={tdsSection[bill.invoice_sno]}>{tdsSection[bill.invoice_sno]}</option>
                          )}
                          {tdsOptionGroups(bill.invoice_sno).map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.items.map((t) => <option key={t.section_code} value={t.section_code}>{t.section_code}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{money(bill.invoice_amount)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{Number(bill.hold_amount) > 0 ? money(bill.hold_amount) : '—'}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{Number(bill.paid_amount) > 0 ? money(bill.paid_amount) : '—'}</TableCell>
                      <TableCell className="text-xs text-right font-medium tabular-nums">{money(bill.outstanding)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Callout tone="warning" icon={FileText}>
            {poInvoices.length > 0
              ? 'Nothing is payable on this PO right now - every invoice is either settled or not yet allocated (see Invoice-wise details above).'
              : grnsMissingInvoice.length > 0
                ? `No payable invoice yet. ${grnsMissingInvoice.length === poGrns.length ? 'None of the GRNs' : `GRN ${grnsMissingInvoice.map((g) => g.grn_no).join(', ')}`} captured the supplier invoice (these GRNs pre-date the mandatory-invoice rule), so there is nothing to pay against. Enter the supplier invoice on the Invoice screen, allocate and match it to this PO, and it will appear here with a select box, ready to pay.`
                : 'No supplier invoice yet. Enter it on the Invoice screen (allocate and match it) and it will be listed here, ready to pay.'}
          </Callout>
        )}
        {activeGroup.bills.some((b) => blockReason(b)) && (
          <p className="mt-2 text-xs text-muted-foreground">Greyed invoices are not payable yet - hover a row to see why.</p>
        )}
      </Panel>

      {selected.size > 0 && adj && (
        <Panel icon={Wallet} title="Adjustments & payment" description="Advances, debit / credit notes and TDS netted against the selected invoices">
          <div className="space-y-5">
            {hasPendingNotes && (
              <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30">
                <p>
                  This supplier has unredeemed
                  {adj!.debitNotes.length > 0 ? ` ${adj!.debitNotes.length} debit note(s)` : ''}
                  {adj!.debitNotes.length > 0 && adj!.creditNotes.length > 0 ? ' and' : ''}
                  {adj!.creditNotes.length > 0 ? ` ${adj!.creditNotes.length} credit note(s)` : ''}.
                  {' '}Redeem them in this bill?
                  {redeemChoice && <span className="ml-1 font-medium">{redeemChoice === 'yes' ? '(Yes - tick/untick below to fine-tune)' : '(No - left unredeemed)'}</span>}
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={redeemChoice === 'yes' ? 'default' : 'outline'} onClick={() => answerRedeem(true)}>Yes, redeem</Button>
                  <Button type="button" size="sm" variant={redeemChoice === 'no' ? 'default' : 'outline'} onClick={() => answerRedeem(false)}>No</Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold">Advances paid</p>
                {adj.advances.length === 0 && <p className="text-xs text-muted-foreground">None outstanding</p>}
                {adj.advances.map((a) => (
                  <div key={a.advance_sno} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="text-xs">
                      <p className="font-medium">{a.advance_no}</p>
                      <p className="text-muted-foreground">balance {money(a.balance)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-8 w-28 text-right text-xs" inputMode="decimal" placeholder="Adjust"
                        value={advAmt[a.advance_sno] ?? ''}
                        onChange={(e) => setAdvAmt((p) => ({ ...p, [a.advance_sno]: e.target.value.replace(/[^\d.]/g, '') }))}
                      />
                      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAdvAmt((p) => ({ ...p, [a.advance_sno]: String(a.balance) }))}>Max</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold">Debit notes raised (reduce payment)</p>
                {adj.debitNotes.length === 0 && <p className="text-xs text-muted-foreground">None pending</p>}
                {adj.debitNotes.map((n) => (
                  <label key={n.note_sno} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={dnPick.has(n.note_sno)} onCheckedChange={() => toggleSet(dnPick, n.note_sno, setDnPick)} />
                      <span><span className="font-medium">{n.note_no}</span>{n.remarks ? <span className="block text-muted-foreground">{n.remarks}</span> : null}</span>
                    </span>
                    <span>- {money(n.amount)}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold">Credit notes (add to payment)</p>
                {adj.creditNotes.length === 0 && <p className="text-xs text-muted-foreground">None pending</p>}
                {adj.creditNotes.map((n) => (
                  <label key={n.note_sno} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={cnPick.has(n.note_sno)} onCheckedChange={() => toggleSet(cnPick, n.note_sno, setCnPick)} />
                      <span><span className="font-medium">{n.note_no}</span>{n.remarks ? <span className="block text-muted-foreground">{n.remarks}</span> : null}</span>
                    </span>
                    <span>+ {money(n.amount)}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={applyTds} onCheckedChange={(v) => setApplyTds(v === true)} /> Deduct TDS where a section is chosen
            </label>

            <div className="rounded-xl border bg-muted/20 p-4">
              {previewError && <p className="text-sm text-red-600">{previewError}</p>}
              {sum && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Invoices selected</span><span>{money(sum.gross_amount)}</span></div>
                    <div className="flex justify-between text-red-700"><span>Less TDS</span><span>- {money(sum.tds_amount)}</span></div>
                    <div className="flex justify-between text-red-700"><span>Less advance adjusted</span><span>- {money(sum.advance_adjusted)}</span></div>
                    <div className="flex justify-between text-red-700"><span>Less debit notes</span><span>- {money(sum.debit_notes)}</span></div>
                    <div className="flex justify-between text-green-700"><span>Add credit notes</span><span>+ {money(sum.credit_notes)}</span></div>
                    <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Amount to pay supplier</span><span>{money(sum.net_paid)}</span></div>
                  </div>
                  <div className="text-xs">
                    <p className="mb-1 font-semibold">TDS by invoice</p>
                    {(preview?.invoices ?? []).map((l) => (
                      <div key={l.invoice_sno} className="flex justify-between border-b py-1">
                        <span>
                          {l.invoice_no} {l.tds_section ? `· ${l.tds_section} @ ${l.tds_rate_pct ?? 0}%` : '· no TDS'}
                          {l.tds_section && (adj?.tdsSections ?? []).find((t) => t.section_code === l.tds_section)?.description && (
                            <span className="block text-[11px] text-muted-foreground">
                              ({(adj?.tdsSections ?? []).find((t) => t.section_code === l.tds_section)?.description})
                            </span>
                          )}
                        </span>
                        <span>{money(l.tds_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!sum && !previewError && <p className="text-sm text-muted-foreground">Working out the amount…</p>}
            </div>

            <FormSection icon={Wallet} title="Payment Details">
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col">
                  <CustomInputField
                    field="payment_date" label="Payment Date" require type="date"
                    value={paymentDetails.payment_date ?? ''}
                    onChange={(value) => setPaymentDetails((prev) => ({ ...prev, payment_date: value }))}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col">
                  <CustomInputField
                    field="mode" label="Mode" require type="select" options={MODE_OPTIONS}
                    value={paymentDetails.mode ?? 'NEFT'}
                    onChange={(value) => setPaymentDetails((prev) => ({ ...prev, mode: value }))}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col">
                  <CustomInputField
                    field="reference_no" label="Reference No" type="text"
                    value={paymentDetails.reference_no ?? ''}
                    onChange={(value) => setPaymentDetails((prev) => ({ ...prev, reference_no: value }))}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col">
                  <CustomInputField
                    field="bank_account" label="Bank Account" type="text"
                    value={paymentDetails.bank_account ?? ''}
                    onChange={(value) => setPaymentDetails((prev) => ({ ...prev, bank_account: value }))}
                    className="h-10"
                  />
                </div>
              </div>
            </FormSection>

            <div className="flex items-center justify-end border-t pt-4">
              {canSubmit && (
                <Button
                  type="button"
                  onClick={handleReleasePayment}
                  disabled={releasing || !sum || !paymentDetails.mode || !paymentDetails.payment_date || (hasPendingNotes && !redeemChoice)}
                  title={hasPendingNotes && !redeemChoice ? 'Answer the redeem question for pending debit / credit notes first' : undefined}
                  className="h-9 bg-blue-600 hover:bg-blue-700"
                >
                  {releasing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Release Payment ({money(sum?.net_paid ?? 0)})
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  ) : null;

  return (
    <>
    <EnterInvoiceDialog
      open={invoiceDialogOpen}
      poBasicSno={activePoSno}
      poNo={activeGroup?.poNo ?? null}
      vendorSno={activeGroup?.vendorSno ?? null}
      vendorName={activeGroup?.vendorName ?? null}
      suggestedAmount={info?.grn_value ?? null}
      existingInvoices={ledger.invoices}
      existingGrns={ledger.grns}
      onClose={() => setInvoiceDialogOpen(false)}
      onDone={handleSearch}
    />
    <SidebarDetailLayout
      sidebarTitle="Payment"
      sidebarCount={groups.length}
      sidebarCountLabel="PO"
      sidebarCountQualifier="open"
      listItems={sidebar}
      hasSelection={!!activeGroup}
      detailContent={detail}
      emptyContent={
        <DetailEmptyState
          icon={Wallet}
          title={groups.length === 0 ? 'Nothing pending for payment' : 'Pick a PO'}
          description="Choose a PO on the left to see its invoices, GST, debit / credit notes, advances and TDS breakup, and to release payment."
        />
      }
      mobileListLabel="PO list"
      mobileSelectionTitle={activeGroup?.poNo ?? undefined}
    />
    </>
  );
};

export default PaymentPage;
