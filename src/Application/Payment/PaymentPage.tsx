import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet, Send, RefreshCw, Package, FileText, Info } from 'lucide-react';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import { Callout, DetailEmptyState, Panel, SearchInput, SelectableCard, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import axios from 'axios';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { getErrorMessage } from '@/lib/errors';
import { getVendorBillConsolidations } from '@/Services/Api';
import {
  payNetBills, payNetGrnPending, payNetAdjustments, payNetPreview, payNetRelease, payNetInvoiceLedger, payNetTdsSections, payNetGroup,
  type TdsSection, type NetSummary, type GrnPendingPayment, type PayableBillNet, type PaymentAdjustments, type PaymentReleasedEvent, type NetPreview, type InvoiceLedger, type InvoicePaymentStatus, type SavedPayment,
} from '@/Services/GrnService/paymentNetApi';
import { socket, SOCKET_CONNECT, SOCKET_JOIN_PAYMENT, SOCKET_LEAVE_PAYMENT, SOCKET_PAYMENT_RELEASED } from '@/Services/Socket';
import { invoiceSnosOf, keepOffered, noteSourceLine, stillPayable, withoutRedeemed } from './paymentNotesModel';
import { amountOf, amountProblem, billKind, clampAdvances, heldBy2b, leftLine, payCap } from './partPaymentModel';

/** Every payment from this screen is a bank transfer; the Payment Run decides the account and writes the file. */
const PAYMENT_MODE = 'NEFT';

const money = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Why a bill cannot be selected yet (empty = payable). */
const blockReason = (b: PayableBillNet): string => {
  if (b.grn_state === 'Pending approval') return 'GRN is awaiting approval';
  if (b.grn_state === 'No GRN') return 'No approved GRN for this PO';
  // 2B is not looked at here (sql/79): the bill is offered in full; Payment Run checks 2B and keeps the GST of an invoice that is missing from it on the Unpaid GST screen
  if (heldBy2b(b)) return 'Not payable yet';
  return '';
};

const grnBadge = (b: PayableBillNet) => {
  if (b.grn_state === 'Done') return <Badge className="bg-green-100 text-green-800 text-[10px]">GRN done</Badge>;
  if (b.grn_state === 'NA') return <Badge variant="secondary" className="text-[10px]">Service</Badge>;
  return <Badge variant="destructive" className="text-[10px]">{b.grn_state}</Badge>;
};

const statusBadge = (st: InvoicePaymentStatus) => {
  if (st === 'Paid') return <Badge className="bg-green-100 text-green-800 text-[10px]">Paid</Badge>;
  if (st === 'In payment') return <Badge className="bg-violet-100 text-violet-800 text-[10px]" title="Saved - waiting for approval or for the payment run">In payment</Badge>;
  if (st === 'Part paid') return <Badge className="bg-blue-100 text-blue-800 text-[10px]">Part paid</Badge>;
  if (st === 'Not allocated') return <Badge className="bg-amber-100 text-amber-800 text-[10px]">Not allocated</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Unpaid</Badge>;
};
const dateOnly = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '—');

/** A vendor-driven consolidated bill (VBC-...): one supplier + period, several delivered POs, paid together. */
type ConsolidatedBill = {
  consolidation_sno: number; consolidation_no: string; vendor_sno: number; vendor_name: string | null;
  period_from: string | null; period_to: string | null; total_amount: number; invoice_count: number;
  invoices: string | null;   // JSON: [{ invoice_sno, invoice_no, invoice_amount, po_no }]
};
type ConsolidationMember = { invoice_sno: number; invoice_no: string; invoice_amount: number; po_no: string | null };
const membersOf = (c: ConsolidatedBill): ConsolidationMember[] => { try { return JSON.parse(c.invoices || '[]'); } catch { return []; } };

type PayGroup = {
  key: string; poNo: string | null; vendorName: string | null; vendorSno: number | null;
  bills: PayableBillNet[]; info?: GrnPendingPayment; consolidation?: ConsolidatedBill;
};

const PaymentPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'PaymentPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);

  const { options } = useMasterOptions(['VendorMaster']);

  const [vendorSno, setVendorSno] = useState<string>('');
  const [bills, setBills] = useState<PayableBillNet[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [grnPending, setGrnPending] = useState<GrnPendingPayment[]>([]);
  const [ledger, setLedger] = useState<InvoiceLedger>({ invoices: [], grns: [] });
  const [consolidations, setConsolidations] = useState<ConsolidatedBill[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [releasing, setReleasing] = useState(false);
  // No payment details are typed here: the payment is dated today, goes out as NEFT, and the bank account / reference are
  // settled in Payment Run (the run's own bank account, the payment file).
  const paymentDate = new Date().toISOString().slice(0, 10);

  // adjustments for the selected supplier
  const [adj, setAdj] = useState<PaymentAdjustments | null>(null);
  // amount to pay NOW on a ticked bill when it is not the whole of what can be paid (a part payment); bill_sno -> typed text
  const [payAmt, setPayAmt] = useState<Record<number, string>>({});
  const [advAmt, setAdvAmt] = useState<Record<number, string>>({});
  const [dnPick, setDnPick] = useState<Set<number>>(new Set());
  const [cnPick, setCnPick] = useState<Set<number>>(new Set());
  // answer to "redeem the supplier's unredeemed debit / credit notes in this bill?" (null = not asked yet)
  const [redeemChoice, setRedeemChoice] = useState<'yes' | 'no' | null>(null);
  const [applyTds, setApplyTds] = useState(true);
  const [tdsSection, setTdsSection] = useState<Record<number, string>>({});   // invoice_sno -> section ('' = none)
  const [tdsRate, setTdsRate] = useState<Record<number, string>>({});         // invoice_sno -> rate % typed over the section's own ('' = the section's rate)
  const [preview, setPreview] = useState<NetPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  // TDS sections for the per-invoice dropdown when several suppliers are ticked (the adjustments, which normally carry them, are single-supplier)
  const [tdsMaster, setTdsMaster] = useState<TdsSection[]>([]);
  useEffect(() => {
    axios.get(payNetTdsSections).then((r) => setTdsMaster(r?.data?.data ?? [])).catch(() => setTdsMaster([]));
  }, []);
  // several suppliers ticked: one preview per supplier (supplier_sno -> figures or why not) and the result of the last save
  const [multiPrev, setMultiPrev] = useState<Record<string, { summary?: NetSummary | null; error?: string }>>({});
  const [multiResult, setMultiResult] = useState<{ ok: string[]; failed: string[] } | null>(null);

  // keep: the bills ticked right now. A live refresh (another user paid something) must not wipe what this user has ticked -
  // it only drops the bills that are no longer payable. Without keep the selection is cleared (Refresh, after a release).
  const handleSearch = async (opts?: { keep?: Set<number> }) => {
    const keep = opts?.keep;
    setSearching(true);
    if (!keep) { setSelected(new Set()); setPayAmt({}); }
    try {
      const params = vendorSno ? { vendor_sno: vendorSno } : {};
      const res = await axios.get(payNetBills, { params });
      const rows: PayableBillNet[] = res?.data?.data ?? [];
      setBills(rows);
      if (keep) {
        const kept = stillPayable(keep, rows);
        if (kept.size < keep.size) toast.info('An invoice you ticked was just paid by someone else - it was taken off your selection.');
        setSelected(kept);
      }
      const fresh = Object.fromEntries(rows.map((r) => [r.invoice_sno, r.tds_section_code ?? '']));
      setTdsSection((prev) => (keep ? Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, prev[Number(k)] ?? v])) : fresh));
      const freshRate = Object.fromEntries(rows.map((r) => [r.invoice_sno, r.tds_rate_override != null ? String(r.tds_rate_override) : '']));
      setTdsRate((prev) => (keep ? Object.fromEntries(Object.entries(freshRate).map(([k, v]) => [k, prev[Number(k)] ?? v])) : freshRate));
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
      // Consolidated vendor-driven bills - they group their member invoices; a failure only means they show per PO again.
      try {
        const con = await axios.get(getVendorBillConsolidations, { params });
        setConsolidations(con?.data?.data ?? []);
      } catch {
        setConsolidations([]);
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
    const conOfInvoice = new Map<number, ConsolidatedBill>();
    const conPoNos = new Set<string>();
    for (const c of consolidations) for (const m of membersOf(c)) { conOfInvoice.set(m.invoice_sno, c); if (m.po_no) conPoNos.add(m.po_no); }
    // an invoice already saved in a payment (or paid) has moved on to approval / Payment Run: it is not offered here again
    const settled = new Set(ledger.invoices.filter((i) => i.payment_status === 'In payment' || i.payment_status === 'Paid').map((i) => i.invoice_sno));
    for (const b of bills.filter((x) => !settled.has(x.invoice_sno))) {
      const con = conOfInvoice.get(b.invoice_sno);
      const key = con ? `con:${con.consolidation_sno}` : b.po_no ? `po:${b.po_no}` : `inv:${b.invoice_sno}`;
      const g = map.get(key) ?? { key, poNo: con ? con.consolidation_no : b.po_no, vendorName: b.vendor_name, vendorSno: b.vendor_sno, bills: [], info: !con && b.po_no ? infoByPo.get(b.po_no) : undefined, consolidation: con };
      g.bills.push(b);
      map.set(key, g);
    }
    for (const g of grnPending) {
      if (conPoNos.has(g.po_no)) continue;   // billed inside a consolidated bill: that bill carries it
      const key = `po:${g.po_no}`;
      if (!map.has(key)) map.set(key, { key, poNo: g.po_no, vendorName: g.vendor_name, vendorSno: g.vendor_sno, bills: [], info: g });
    }
    // A PO whose invoices are all in a payment (waiting for approval or for the run) or already paid has nothing left to do here:
    // it drops off this screen. It stays while a bill is payable, an invoice is awaited, or an invoice is not yet paid / allocated.
    const openStatuses: InvoicePaymentStatus[] = ['Unpaid', 'Part paid', 'Not allocated'];
    return [...map.values()].filter((g) =>
      g.bills.length > 0
      || (!g.consolidation && (!g.info?.has_invoice
      || ledger.invoices.some((i) => i.po_no === g.poNo && openStatuses.includes(i.payment_status)))));
  }, [bills, grnPending, ledger, consolidations]);


  const filteredGroups = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      [g.vendorName, g.poNo, ...g.bills.map((b) => `${b.bill_no} ${b.supplier_invoice_no ?? ''}`)].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [groups, listSearch]);

  const activeGroup = groups.find((g) => g.key === selectedKey) ?? null;
  // the ticks stay when another PO is opened: one save can pay several POs and several suppliers
  const pickGroup = (g: PayGroup) => { setSelectedKey(g.key); };

  // TDS sections offered for a bill: service bill -> Service + Both, goods bill -> Product + Both, a mix of the two -> all.
  const tdsOptionGroups = (invoice_sno: number) => {
    const kinds = new Set(bills.filter((b) => b.invoice_sno === invoice_sno).map((b) => (b.bucket_type === 'SERVICE' ? 'Service' : 'Product')));
    const active = (adj?.tdsSections ?? tdsMaster).filter((t) => t.is_active === 'Y');
    const pick = (a: string) => active.filter((t) => (t.applies_to ?? 'Both') === a);
    const groups = [
      { label: 'Service', items: kinds.has('Service') ? pick('Service') : [] },
      { label: 'Product', items: kinds.has('Product') ? pick('Product') : [] },
      { label: 'Service & Product', items: pick('Both') },
    ];
    return groups.filter((g) => g.items.length > 0);
  };

  const selectedBills = useMemo(() => bills.filter((b) => selected.has(b.bill_sno)), [bills, selected]);
  // A payment has one payee and one company, so the ticked bills are saved as one payment per supplier + company.
  const payKeyOf = (b: PayableBillNet) => `${b.vendor_sno}|${b.com_sno ?? ''}`;
  const selectedGroupKeys = useMemo(() => [...new Set(selectedBills.map(payKeyOf))], [selectedBills]);
  const multiSupplier = selectedGroupKeys.length > 1;
  // the single supplier whose advances / notes are handled on this screen; null while several suppliers are ticked
  const selectedVendorSno = selectedGroupKeys.length === 1 ? (selectedBills[0]?.vendor_sno ?? null) : null;
  // what this payment pays: the whole of what can be paid on each ticked bill, unless a smaller amount was typed (part payment)
  const selectedTotal = selectedBills.reduce((sum, b) => sum + amountOf(b, payAmt), 0);
  const amountProblems = selectedBills.map((b) => amountProblem(b, payAmt)).filter(Boolean);

  const toggleRow = (bill: PayableBillNet) => {
    if (blockReason(bill)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bill.bill_sno)) next.delete(bill.bill_sno); else next.add(bill.bill_sno);
      return next;
    });
  };

  // Tick / untick every payable line of one invoice at once (an invoice can be split into several lines).
  const toggleInvoice = (invoice_sno: number) => {
    const lines = (activeGroup?.bills ?? []).filter((b) => b.invoice_sno === invoice_sno && !blockReason(b));
    if (lines.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const all = lines.every((l) => next.has(l.bill_sno));
      lines.forEach((l) => (all ? next.delete(l.bill_sno) : next.add(l.bill_sno)));
      return next;
    });
  };

  const payable = (activeGroup?.bills ?? []).filter((b) => !blockReason(b));
  const allSelected = payable.length > 0 && payable.every((b) => selected.has(b.bill_sno));
  // ticks / unticks this PO's payable lines and leaves the ticks on other POs alone
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      payable.forEach((b) => (allSelected ? next.delete(b.bill_sno) : next.add(b.bill_sno)));
      return next;
    });
  };

  // Advances and notes for the ticked invoices. Which notes are on offer depends on the invoices being paid (a note raised
  // against a bill that is still open belongs to that bill only; one raised against a paid bill is the supplier's to use on
  // any bill), so ask again whenever the ticked invoices change. Pending notes are NOT applied until the user answers the
  // "redeem in this bill?" prompt.
  const selectedInvoiceSnos = useMemo(() => invoiceSnosOf(selectedBills), [selectedBills]);
  const selectedInvoiceKey = selectedInvoiceSnos.join(',');
  const adjRequest = useRef(0);
  const loadAdjustments = async () => {
    const requestId = ++adjRequest.current;
    if (!selectedVendorSno || selectedInvoiceSnos.length === 0) { setAdj(null); return; }
    try {
      const res = await axios.get(payNetAdjustments(selectedVendorSno, selectedInvoiceSnos));
      if (requestId !== adjRequest.current) return;   // the ticks changed again while this was in flight
      const data: PaymentAdjustments = res.data?.data;
      setAdj(data);
      // An advance paid for this PO is netted off this PO's bills without being asked: fill it in (up to what is being paid),
      // once per advance - clearing the box afterwards means "do not use it". An advance whose own PO is cancelled / settled
      // (scope SUPPLIER) moves to this supplier's other bills and is filled in after the ones that belong here.
      setAdvAmt((prev) => {
        const next = { ...prev };
        let room = selectedTotal - Object.values(prev).reduce((t, v) => t + (Number(v) || 0), 0);
        for (const a of data.advances) {
          const mine = a.scope === 'SUPPLIER' || (a.po_basic_sno != null && activePoSnos.includes(a.po_basic_sno));
          if (next[a.advance_sno] !== undefined || !mine || room <= 0) continue;
          const take = Math.min(Number(a.balance) || 0, room);
          if (take > 0) { next[a.advance_sno] = String(Math.round(take * 100) / 100); room -= take; }
        }
        return next;
      });
      setDnPick((prev) => keepOffered(prev, data.debitNotes));
      setCnPick((prev) => keepOffered(prev, data.creditNotes));
    } catch (e) {
      if (requestId === adjRequest.current) toast.error(getErrorMessage(e, 'Failed to load advances and notes'));
    }
  };

  const adjVendor = useRef<number | null>(null);
  useEffect(() => {
    if (adjVendor.current !== selectedVendorSno) {   // a different supplier: start the adjustments over
      adjVendor.current = selectedVendorSno;
      setAdvAmt({});
      setDnPick(new Set());
      setCnPick(new Set());
      setRedeemChoice(null);
      setPreview(null);
    }
    loadAdjustments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorSno, selectedInvoiceKey]);

  // What the socket handler below needs to see without re-subscribing on every render.
  const live = useRef({ selected, adj, vendorSno, loadAdjustments, handleSearch });
  useEffect(() => { live.current = { selected, adj, vendorSno, loadAdjustments, handleSearch }; });
  const releaseInFlight = useRef(false);
  const lastReleasedNo = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live: a payment released by someone else can redeem a note this screen is still offering (or close a bill, which frees
  // that bill's notes for the supplier's other bills). Take the redeemed notes off the screen at once - otherwise a second
  // person ticks them and their release fails - then reconcile with the server.
  useEffect(() => {
    const join = () => socket.emit(SOCKET_JOIN_PAYMENT);
    join();
    socket.on(SOCKET_CONNECT, join);   // rooms belong to one connection: join again after a reconnect

    const onReleased = (ev: PaymentReleasedEvent) => {
      const cur = live.current;
      if (releaseInFlight.current || ev.payment_no === lastReleasedNo.current) return;   // our own release refreshes everything itself
      if (cur.adj && ev.notes?.length) {
        const { adj: next, dropped } = withoutRedeemed(cur.adj, ev.notes);
        if (dropped.length) {
          setAdj(next);
          setDnPick((prev) => keepOffered(prev, next.debitNotes));
          setCnPick((prev) => keepOffered(prev, next.creditNotes));
          toast.info(`${dropped.map((n) => n.note_no).join(', ')} was just redeemed in ${ev.payment_no} - taken off this payment.`);
        }
      }
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        const latest = live.current;
        if (latest.vendorSno && String(latest.vendorSno) !== String(ev.vendor_sno)) return;
        latest.handleSearch({ keep: latest.selected });
        latest.loadAdjustments();
      }, 300);
    };
    socket.on(SOCKET_PAYMENT_RELEASED, onReleased);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      socket.off(SOCKET_CONNECT, join);
      socket.off(SOCKET_PAYMENT_RELEASED, onReleased);
      socket.emit(SOCKET_LEAVE_PAYMENT);
    };
  }, []);

  const buildBody = () => ({
    vendor_sno: selectedVendorSno,
    payment_date: paymentDate,
    mode: PAYMENT_MODE,
    apply_tds: applyTds,
    allocations: selectedBills.map((b) => ({ invoice_alloc_sno: b.bill_sno, amount: amountOf(b, payAmt) })),
    advances: Object.entries(advAmt).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ advance_sno: Number(id), amount: Number(v) })),
    notes: [
      ...[...dnPick].map((id) => ({ type: 'DEBIT', note_sno: id })),
      ...[...cnPick].map((id) => ({ type: 'CREDIT', note_sno: id })),
    ],
    tds_overrides: [...new Set(selectedBills.map((b) => b.invoice_sno))].map((id) => ({ invoice_sno: id, section: tdsSection[id] ?? '', rate: tdsSection[id] ? (tdsRate[id] ?? '') : '' })),
  });

  // a part payment pays less: an advance must not net off more than is being paid
  useEffect(() => {
    setAdvAmt((prev) => clampAdvances(prev, selectedTotal));
  }, [selectedTotal]);

  // live preview of the amount to pay
  useEffect(() => {
    if (!selectedVendorSno || selectedBills.length === 0 || !adj) { setPreview(null); return; }
    if (amountProblems.length > 0) { setPreview(null); setPreviewError(amountProblems[0]); return; }
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
  }, [selected, payAmt, advAmt, dnPick, cnPick, applyTds, tdsSection, tdsRate, adj]);

  const billsOfGroup = (key: string) => selectedBills.filter((b) => payKeyOf(b) === key);
  const bodyForGroup = (key: string) => ({
    vendor_sno: billsOfGroup(key)[0]?.vendor_sno,
    payment_date: paymentDate,
    mode: PAYMENT_MODE,
    apply_tds: applyTds,
    allocations: billsOfGroup(key).map((b) => ({ invoice_alloc_sno: b.bill_sno, amount: amountOf(b, payAmt) })),
    advances: [],
    notes: [],
    tds_overrides: [...new Set(billsOfGroup(key).map((b) => b.invoice_sno))].map((id) => ({ invoice_sno: id, section: tdsSection[id] ?? '', rate: tdsSection[id] ? (tdsRate[id] ?? '') : '' })),
  });
  const manyCompanies = new Set(selectedBills.map((b) => b.com_sno ?? null)).size > 1;
  const vendorNameOf = (key: string) => {
    const b = billsOfGroup(key)[0];
    return `${b?.vendor_name ?? `Supplier ${key}`}${manyCompanies ? ` (${b?.com_name ?? 'no company'})` : ''}`;
  };

  // several suppliers ticked: work out each supplier's payment on its own
  useEffect(() => {
    if (!multiSupplier) { setMultiPrev({}); return; }
    if (amountProblems.length > 0) { setMultiPrev({}); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const out: Record<string, { summary?: NetSummary | null; error?: string }> = {};
      for (const v of selectedGroupKeys) {
        try {
          const res = await axios.post(payNetPreview, bodyForGroup(v));
          out[v] = { summary: res.data?.data?.summary ?? null };
        } catch (e) {
          out[v] = { error: getErrorMessage(e, 'Could not work out the amount') };
        }
      }
      if (!cancelled) setMultiPrev(out);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, payAmt, applyTds, tdsSection, tdsRate, multiSupplier]);

  // One payment is saved per supplier (a payment has one payee, one approval and one line in the bank file), all in one go.
  // A supplier that fails keeps its ticks so it can be corrected and saved again.
  const handleReleaseAll = async () => {
    if (!multiSupplier) return;
    setReleasing(true);
    releaseInFlight.current = true;
    const ok: string[] = [];
    const failed: string[] = [];
    const failedBills = new Set<number>();
    const saved: { row: SavedPayment; label: string }[] = [];
    try {
      for (const v of selectedGroupKeys) {
        try {
          const res = await axios.post(payNetRelease, bodyForGroup(v));
          const row: SavedPayment | undefined = res?.data?.data;
          if (row?.payment_no) { lastReleasedNo.current = row.payment_no; saved.push({ row, label: vendorNameOf(v) }); }
          ok.push(`${vendorNameOf(v)}: ${row?.payment_no ?? 'saved'}${row ? ` (${money(row.net_paid)}${row.status === 'Pending Approval' ? ', sent for approval' : ', approved'})` : ''}`);
        } catch (e) {
          failed.push(`${vendorNameOf(v)}: ${getErrorMessage(e, 'could not be saved')}`);
          billsOfGroup(v).forEach((b) => failedBills.add(b.bill_sno));
        }
      }
      // Suppliers of one company / division / branch saved together are tied into a payment group: shown, approved and paid as one.
      const byScope = new Map<string, SavedPayment[]>();
      for (const { row } of saved) {
        const key = `${row.com_sno ?? ''}|${row.div_sno ?? ''}|${row.brn_sno ?? ''}`;
        byScope.set(key, [...(byScope.get(key) ?? []), row]);
      }
      for (const rows of byScope.values()) {
        if (rows.length < 2) continue;
        try {
          const res = await axios.post(payNetGroup, { payment_snos: rows.map((r) => r.payment_sno) });
          const g = res.data?.data;
          if (g?.group_no) ok.push(`Group ${g.group_no}: ${rows.map((r) => r.payment_no).join(', ')} (${money(g.total_amount)}) - approved and paid together`);
        } catch (e) {
          failed.push(`Could not group ${rows.map((r) => r.payment_no).join(', ')}: ${getErrorMessage(e, 'grouping failed')} - they are saved and can still be approved one by one`);
        }
      }
      setMultiResult({ ok, failed });
      if (failed.length === 0) toast.success(`${ok.length} payments saved`);
      else toast.error(`${ok.length} saved, ${failed.length} failed - see the list`);
      await handleSearch(failedBills.size > 0 ? { keep: failedBills } : undefined);
    } finally {
      setReleasing(false);
      releaseInFlight.current = false;
    }
  };

  const toggleSet = (set: Set<number>, id: number, setter: (s: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const handleReleasePayment = async () => {
    if (selectedBills.length === 0 || !selectedVendorSno) return;
    setReleasing(true);
    releaseInFlight.current = true;
    try {
      const res = await axios.post(payNetRelease, buildBody());
      const row: SavedPayment | undefined = res?.data?.data;
      lastReleasedNo.current = row?.payment_no ?? null;
      if (!row?.payment_no) toast.success('Payment saved');
      else if (row.status === 'Pending Approval') toast.success(`Payment ${row.payment_no} saved (${money(row.net_paid)}) - sent to ${row.current_approver_id ?? 'the approver'} for approval`);
      else toast.success(`Payment ${row.payment_no} saved (${money(row.net_paid)}) and approved - no approval workflow is set for this department. It is waiting in Payment Run.`);
      await handleSearch();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save the payment. Try again.'));
      loadAdjustments();   // most often a note or bill another payment just used - show what is still on offer
    } finally {
      setReleasing(false);
      releaseInFlight.current = false;
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
  const con = activeGroup?.consolidation;
  const conMembers = con ? membersOf(con) : [];
  const conPoNos = new Set(conMembers.map((m) => m.po_no));
  const openInvoice = (i: { payment_status: InvoicePaymentStatus }) => i.payment_status !== 'In payment' && i.payment_status !== 'Paid';
  const poInvoices = (con
    ? ledger.invoices.filter((i) => conMembers.some((m) => m.invoice_sno === i.invoice_sno))
    : ledger.invoices.filter((i) => activeGroup?.poNo && i.po_no === activeGroup.poNo)).filter(openInvoice);
  const poGrns = con
    ? ledger.grns.filter((g) => conPoNos.has(g.po_no))
    : ledger.grns.filter((g) => activeGroup?.poNo && g.po_no === activeGroup.poNo);
  const grnsMissingInvoice = poGrns.filter((g) => !g.has_invoice_data);
  const activePoSno = con ? null : (info?.po_basic_sno ?? poInvoices[0]?.po_basic_sno ?? poGrns[0]?.po_basic_sno ?? null);
  // a consolidated bill spans several POs: an advance paid for any of them nets off its invoices
  const activePoSnos = con ? poInvoices.map((i) => i.po_basic_sno) : [activePoSno];
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
          // the invoice the GRN captured, even though it is not a payable bill yet
          const grnInvoiceLabel = (poNo: string | null) => {
            const gi = ledger.grns.filter((x) => poNo && x.po_no === poNo && x.has_invoice_data && !x.payable_invoice_sno);
            return gi.length > 0 ? `GRN invoice ${gi.map((x) => x.invoice_no).join(', ')} · not billed yet` : null;
          };
          return (
            <SelectableCard key={g.key} selected={g.key === selectedKey} onClick={() => { pickGroup(g); closeSheet(); }}>
              <span className="block truncate text-sm font-semibold">{g.vendorName ?? '—'}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{g.consolidation ? `${g.consolidation.consolidation_no} · ${g.consolidation.invoice_count} PO${g.consolidation.invoice_count !== 1 ? 's' : ''}${g.consolidation.period_from ? ` · ${g.consolidation.period_from} to ${g.consolidation.period_to ?? '…'}` : ''}` : (g.poNo ?? 'No PO')}{g.info?.grn_nos ? ` · GRN ${g.info.grn_nos}` : ''}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {awaited
                  ? <StatusPill tone="warning">{grnInvoiceLabel(g.poNo) ?? 'Invoice awaited'}</StatusPill>
                  : <StatusPill tone="info">{g.bills.length} invoice{g.bills.length !== 1 ? 's' : ''}</StatusPill>}
                {g.bills.some((x) => selected.has(x.bill_sno)) && <StatusPill tone="success">{g.bills.filter((x) => selected.has(x.bill_sno)).length} ticked</StatusPill>}
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
        description={con
          ? `Consolidated bill ${con.consolidation_no}${con.period_from ? ` · ${con.period_from} to ${con.period_to ?? '…'}` : ''} · ${[...conPoNos].filter(Boolean).join(', ')}`
          : `${activeGroup.poNo ?? 'No PO'}${info?.grn_nos ? ` · GRN ${info.grn_nos}` : ''}`}
        action={<Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSearch()} disabled={searching}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${searching ? 'animate-spin' : ''}`} />Refresh</Button>}
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
        description="Every supplier invoice on this PO - paid, part paid or unpaid - as uploaded at GRN, with its GST and duplicate checks"
      >
        {poInvoices.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs">Supplier Invoice No</TableHead>
                  <TableHead className="text-xs">Date / Due</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Taxable / GST</TableHead>
                  <TableHead className="text-xs">Invoice file</TableHead>
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
                    <TableCell className="text-xs font-medium">
                      {i.supplier_invoice_no || <span className="font-normal text-muted-foreground">Not entered</span>}
                      {i.dup_count > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">Duplicate ×{i.dup_count + 1}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{dateOnly(i.invoice_date)}<p className="text-muted-foreground">{dateOnly(i.due_date)}</p></TableCell>
                    <TableCell>{statusBadge(i.payment_status)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {i.taxable_value != null ? <>{money(i.taxable_value)}<p className="text-muted-foreground">GST {money(Number(i.invoice_amount) - Number(i.taxable_value))}</p></> : <span className="text-muted-foreground" title="No invoice amount to split">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{i.invoice_file_url ? <a href={i.invoice_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline"><FileText className="h-3 w-3" />View</a> : '—'}</TableCell>
                    <TableCell className="text-xs">{i.payment_nos ?? '—'}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{money(i.invoice_amount)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{i.payment_status === 'Not allocated' ? '—' : money(i.release_total)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {Number(i.paid_total) > 0 ? money(i.paid_total) : '—'}
                      {Number(i.reserved_total) > 0 && <p className="text-muted-foreground" title="Held by a saved payment that is waiting for approval or for the payment run">+ {money(i.reserved_total)} in payment</p>}
                    </TableCell>
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
            <p className="mb-0.5 text-xs font-semibold">Invoice uploaded at GRN</p>
            <p className="mb-1.5 text-xs text-muted-foreground">The invoice details and file are uploaded when the goods are received (GRN) - nothing is entered again here. Once the GRN is approved the invoice appears below, ready to pay.</p>
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
                    <TableHead className="text-xs text-right">Taxable</TableHead>
                    <TableHead className="text-xs">Invoice file</TableHead>
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
                      <TableCell className="text-xs text-right tabular-nums">{g.invoice_taxable_value != null ? money(g.invoice_taxable_value) : '—'}</TableCell>
                      <TableCell className="text-xs">{g.invoice_doc_url ? <a href={g.invoice_doc_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline"><FileText className="h-3 w-3" />View</a> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Panel>

      <Panel icon={Wallet} title={`Invoices ${con ? 'in this consolidated bill' : 'against this PO'} (${activeGroup.bills.length})`} description={`Each invoice is shown on its own - tick the ones to pay together${selected.size > 0 ? ` · paying ${new Set(selectedBills.map((b) => b.invoice_sno)).size} of ${new Set(activeGroup.bills.map((b) => b.invoice_sno)).size} invoices` : ''}`}>
        {activeGroup.bills.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Date / Due</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">GRN</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">TDS section</TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-right">Invoice amt</TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-right">Paid</TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-right">Outstanding</TableHead>
                  <TableHead className="sticky right-0 z-[1] min-w-[9.5rem] bg-muted text-xs text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">Pay now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGroup.bills.map((bill, idx, all) => {
                  const firstOfInvoice = idx === 0 || all[idx - 1].invoice_sno !== bill.invoice_sno;
                  const invLines = all.filter((x) => x.invoice_sno === bill.invoice_sno);
                  const invPayable = invLines.filter((x) => !blockReason(x));
                  const invPicked = invLines.filter((x) => selected.has(x.bill_sno));
                  const invPaying = invPicked.reduce((t, x) => t + amountOf(x, payAmt), 0);
                  const invOutstanding = invLines.reduce((t, x) => t + (Number(x.outstanding) || 0), 0);
                  const invInfo = ledger.invoices.find((i) => i.invoice_sno === bill.invoice_sno);
                  const invStatus = invInfo?.payment_status;
                  const reason = blockReason(bill);
                  const isSel = selected.has(bill.bill_sno);
                  const cap = payCap(bill);
                  const problem = isSel ? amountProblem(bill, payAmt) : '';
                  const pay = amountOf(bill, payAmt);
                  const kind = billKind(bill, pay);
                  return (
                    <React.Fragment key={bill.bill_sno}>
                    {firstOfInvoice && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell><Checkbox checked={invPayable.length > 0 && invPicked.length === invPayable.length} disabled={invPayable.length === 0} onCheckedChange={() => toggleInvoice(bill.invoice_sno)} aria-label={`Pay all of ${bill.bill_no}`} /></TableCell>
                        <TableCell colSpan={7}>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            <span className="text-sm font-semibold">{bill.bill_no}</span>
                            <span className="text-muted-foreground">Supplier inv {bill.supplier_invoice_no ?? '—'}</span>
                            {bill.po_no && <span className="text-muted-foreground">{bill.po_no}</span>}
                            <span className="text-muted-foreground">Outstanding <b className="tabular-nums text-foreground">{money(invOutstanding)}</b></span>
                            {invStatus && statusBadge(invStatus)}
                            {invPayable.length === 0
                              ? <Badge variant="secondary" className="text-[10px]">Cannot be paid yet</Badge>
                              : invPicked.length > 0
                                ? <Badge className="bg-blue-600 text-[10px] text-white">Paying now {money(invPaying)}</Badge>
                                : <Badge variant="outline" className="text-[10px]">Not paying in this payment</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow title={reason} className={`${isSel ? 'bg-blue-50 dark:bg-blue-950/20' : ''} ${reason ? 'opacity-60' : ''}`}>
                      <TableCell><Checkbox checked={isSel} disabled={!!reason} onCheckedChange={() => toggleRow(bill)} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{dateOnly(bill.invoice_date ?? invInfo?.invoice_date)}<p className="text-muted-foreground">Due {dateOnly(bill.due_date ?? invInfo?.due_date)}</p>{bill.bucket_type && <p className="text-[11px] text-muted-foreground">{bill.bucket_type === 'SERVICE' ? 'Service' : 'Product'}</p>}</TableCell>
                      <TableCell className="whitespace-nowrap">{grnBadge(bill)}</TableCell>
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
                        {(tdsSection[bill.invoice_sno] ?? '') !== '' && (
                          <div className="mt-1 flex items-center gap-1" title="Change the TDS rate for this invoice, e.g. 2 to 3. Leave blank to use the section's own rate. It is remembered for the invoice's later part payments.">
                            <Input
                              className="h-7 w-16 px-1.5 text-right text-xs tabular-nums"
                              inputMode="decimal"
                              placeholder="rate"
                              aria-label={`TDS rate in percent for ${bill.bill_no}`}
                              disabled={!isSel}
                              value={tdsRate[bill.invoice_sno] ?? ''}
                              onChange={(e) => setTdsRate((p) => ({ ...p, [bill.invoice_sno]: e.target.value.replace(/[^d.]/g, '') }))}
                            />
                            <span className="text-[11px] text-muted-foreground">%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{money(bill.invoice_amount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">
                        {Number(bill.paid_amount) > 0 ? money(bill.paid_amount) : '—'}
                        {Number(bill.reserved_amount) > 0 && <p className="text-muted-foreground" title="Held by a saved payment that is waiting for approval or for the payment run">+ {money(bill.reserved_amount)} in payment</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-right font-medium tabular-nums">
                        {money(bill.outstanding)}
                      </TableCell>
                      <TableCell className={`sticky right-0 z-[1] text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] ${isSel ? 'bg-blue-50 dark:bg-slate-900' : 'bg-background'}`}>
                        {reason ? <span className="text-xs text-muted-foreground">—</span> : (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <Input
                                className={`h-7 w-28 text-right text-xs tabular-nums ${problem ? 'border-red-500' : ''}`}
                                inputMode="decimal"
                                aria-label={`Amount to pay now on ${bill.bill_no}`}
                                disabled={!isSel}
                                value={isSel ? (payAmt[bill.bill_sno] ?? cap.toFixed(2)) : cap.toFixed(2)}
                                onChange={(e) => setPayAmt((p) => ({ ...p, [bill.bill_sno]: e.target.value.replace(/[^\d.]/g, '') }))}
                              />
                              {isSel && payAmt[bill.bill_sno] !== undefined && (
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[11px]"
                                  onClick={() => setPayAmt((p) => { const n = { ...p }; delete n[bill.bill_sno]; return n; })}>Max</Button>
                              )}
                            </div>
                            {isSel && (problem
                              ? <span className="max-w-[12rem] text-[11px] text-red-600">{problem}</span>
                              : kind.part
                                ? (kind.left <= 0.005
                                  ? <span className="text-[11px] text-blue-700 dark:text-blue-400" title="Earlier payments were made on this invoice; this one clears it">Last part · clears the invoice</span>
                                  : <span className="text-[11px] text-blue-700 dark:text-blue-400" title="The rest stays on the invoice and can be paid later">Part payment · {money(kind.left)} left</span>)
                                : <span className="text-[11px] text-muted-foreground">Full</span>)}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Callout tone="warning" icon={FileText}>
            {poInvoices.length > 0
              ? 'Nothing is payable on this PO right now - every invoice is either settled, in a payment, or waiting for its goods to be received (see Invoice-wise details above).'
              : poGrns.some((g) => g.has_invoice_data && !g.payable_invoice_sno)
                ? `No payable bill yet. ${poGrns.filter((g) => g.has_invoice_data && !g.payable_invoice_sno).map((g) => `GRN ${g.grn_no} captured invoice ${g.invoice_no} (${money(g.invoice_amount)}, ${dateOnly(g.invoice_date)})`).join('; ')} - listed above, but not posted as a payable bill yet, so it cannot be ticked for payment.`
              : grnsMissingInvoice.length > 0
                ? `No payable invoice yet. ${grnsMissingInvoice.length === poGrns.length ? 'None of the GRNs' : `GRN ${grnsMissingInvoice.map((g) => g.grn_no).join(', ')}`} captured the supplier invoice (these GRNs pre-date the mandatory-invoice rule), so there is nothing to pay against.`
                : 'No supplier invoice yet. The invoice is uploaded at GRN - once the GRN is approved it is listed here, ready to pay.'}
          </Callout>
        )}
        {activeGroup.bills.some((b) => blockReason(b)) && (
          <p className="mt-2 text-xs text-muted-foreground">Greyed invoices are not payable yet - hover a row to see why.</p>
        )}
      </Panel>

      {multiSupplier && (
        <Panel icon={Wallet} title={`Pay ${selectedGroupKeys.length} payments together`} description="Bills ticked on several suppliers or companies are saved in one go - one payment per supplier and company, each sent for approval">
          <div className="space-y-4">
            <Callout tone="info" icon={Info}>
              Advances and debit / credit notes are not netted in a multi-supplier save. To use them for a supplier, untick the other suppliers and save that
              supplier on its own.
            </Callout>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs">Supplier</TableHead>
                    <TableHead className="text-xs text-right">Invoices</TableHead>
                    <TableHead className="text-xs text-right">Invoice amount</TableHead>
                    <TableHead className="text-xs text-right">TDS</TableHead>
                    <TableHead className="text-xs text-right">To pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedGroupKeys.map((v) => {
                    const mine = billsOfGroup(v);
                    const pv = multiPrev[v];
                    return (
                      <TableRow key={v}>
                        <TableCell className="text-xs font-medium">
                          {vendorNameOf(v)}
                          {pv?.error && <span className="block text-[11px] font-normal text-red-600">{pv.error}</span>}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{new Set(mine.map((b) => b.invoice_sno)).size}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{money(mine.reduce((t, b) => t + amountOf(b, payAmt), 0))}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{pv?.summary ? `- ${money(pv.summary.tds_amount)}` : '—'}</TableCell>
                        <TableCell className="text-xs text-right font-semibold tabular-nums">{pv?.summary ? money(pv.summary.net_paid) : '…'}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell className="text-xs font-semibold" colSpan={4}>Total to pay</TableCell>
                    <TableCell className="text-xs text-right font-semibold tabular-nums">
                      {money(selectedGroupKeys.reduce((t, v) => t + (Number(multiPrev[v]?.summary?.net_paid) || 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={applyTds} onCheckedChange={(v) => setApplyTds(v === true)} /> Deduct TDS where a section is chosen
            </label>
            {multiResult && (multiResult.ok.length > 0 || multiResult.failed.length > 0) && (
              <div className="space-y-1 rounded-md border p-3 text-xs">
                {multiResult.ok.map((t) => <p key={t} className="text-green-700">✓ {t}</p>)}
                {multiResult.failed.map((t) => <p key={t} className="text-red-600">✗ {t}</p>)}
              </div>
            )}
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Callout tone="info" icon={Info} className="sm:max-w-xl">
                Each supplier gets its own payment and goes to approval separately. If one cannot be saved, the others are still saved and that supplier stays ticked.
              </Callout>
              {canSubmit && (
                <Button
                  type="button"
                  onClick={handleReleaseAll}
                  disabled={releasing || amountProblems.length > 0 || selectedGroupKeys.some((v) => !multiPrev[v]?.summary)}
                  title={amountProblems[0]}
                  className="h-9 shrink-0 bg-blue-600 hover:bg-blue-700"
                >
                  {releasing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Save {selectedGroupKeys.length} Payments
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}

      {selected.size > 0 && adj && (
        <Panel icon={Wallet} title="Adjustments & payment" description="Advances, debit / credit notes and TDS netted against the selected invoices">
          <div className="space-y-5">
            {selectedBills.some((b) => amountOf(b, payAmt) < payCap(b) - 0.005) && (
              <Callout tone="info" icon={Info}>
                Part payment: what is not paid now stays on the invoice and can be paid in another payment. The approver can also reduce a payment
                further when approving it.
              </Callout>
            )}
            {(adj.pendingAdvances ?? []).filter((a) => activePoSnos.includes(a.po_basic_sno)).map((a) => (
              <Callout key={a.payment_sno} tone="warning" icon={Info}>
                An advance of <b>{money(a.amount)}</b> ({a.payment_no}) is approved for this PO but not paid yet. Pay it in <b>Payment Run</b> first and it will be
                netted off this bill; saving now pays the bill without it.
              </Callout>
            ))}
            {hasPendingNotes && (
              <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30">
                <p>
                  {adj!.debitNotes.length > 0 ? `${adj!.debitNotes.length} debit note(s)` : ''}
                  {adj!.debitNotes.length > 0 && adj!.creditNotes.length > 0 ? ' and ' : ''}
                  {adj!.creditNotes.length > 0 ? `${adj!.creditNotes.length} credit note(s)` : ''}
                  {' '}can be adjusted in this payment.
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
                {adj.advances.length === 0 && <p className="text-xs text-muted-foreground">None for these invoices</p>}
                {adj.advances.map((a) => (
                  <div key={a.advance_sno} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="text-xs">
                      <p className="font-medium">{a.advance_no}</p>
                      <p className="text-muted-foreground">balance {money(a.balance)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.scope === 'SUPPLIER'
                          ? `PO ${a.po_no ?? ''} is cancelled / settled - moved to this supplier's other invoices`
                          : `Paid for PO ${a.po_no ?? 'of these invoices'}`}
                      </p>
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
                {adj.debitNotes.length === 0 && <p className="text-xs text-muted-foreground">None for these invoices</p>}
                {adj.debitNotes.map((n) => (
                  <label key={n.note_sno} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={dnPick.has(n.note_sno)} onCheckedChange={() => toggleSet(dnPick, n.note_sno, setDnPick)} />
                      <span>
                        <span className="font-medium">{n.note_no}</span>
                        {noteSourceLine(n) ? <span className="block text-[11px] text-muted-foreground">{noteSourceLine(n)}</span> : null}
                        {n.remarks ? <span className="block text-muted-foreground">{n.remarks}</span> : null}
                      </span>
                    </span>
                    <span>- {money(n.amount)}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold">Credit notes (add to payment)</p>
                {adj.creditNotes.length === 0 && <p className="text-xs text-muted-foreground">None for these invoices</p>}
                {adj.creditNotes.map((n) => (
                  <label key={n.note_sno} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={cnPick.has(n.note_sno)} onCheckedChange={() => toggleSet(cnPick, n.note_sno, setCnPick)} />
                      <span>
                        <span className="font-medium">{n.note_no}</span>
                        {noteSourceLine(n) ? <span className="block text-[11px] text-muted-foreground">{noteSourceLine(n)}</span> : null}
                        {n.remarks ? <span className="block text-muted-foreground">{n.remarks}</span> : null}
                      </span>
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
                    <p className="mb-1 font-semibold">By invoice</p>
                    {(preview?.invoices ?? []).map((l) => (
                      <div key={l.invoice_sno} className="flex justify-between border-b py-1">
                        <span>
                          {l.supplier_invoice_no || 'Invoice no. not entered'} {l.tds_section ? `· ${l.tds_section} @ ${l.tds_rate_pct ?? 0}%` : '· no TDS'}
                          {l.balance_after !== undefined && (
                            <span className={`block text-[11px] ${l.is_part ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                              {l.is_part ? `${Number(l.balance_after) <= 0.005 ? 'Last part' : 'Part payment'} of ${money(l.gross)} - ${leftLine(Number(l.balance_after), false, 0)}` : 'Paid in full'}
                            </span>
                          )}
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

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Callout tone="info" icon={Info} className="sm:max-w-xl">
                Saving sends this payment for approval. Once approved it waits in <b>Payment Run</b>, where it is paid against the day's fund
                and goes into the payment file. Until then its invoices, advances and notes are held for it.
              </Callout>
              {canSubmit && (
                <Button
                  type="button"
                  onClick={handleReleasePayment}
                  disabled={releasing || !sum || amountProblems.length > 0 || (hasPendingNotes && !redeemChoice)}
                  title={amountProblems[0] ?? (hasPendingNotes && !redeemChoice ? 'Answer the redeem question for pending debit / credit notes first' : undefined)}
                  className="h-9 shrink-0 bg-blue-600 hover:bg-blue-700"
                >
                  {releasing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Save Payment ({money(sum?.net_paid ?? 0)})
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
