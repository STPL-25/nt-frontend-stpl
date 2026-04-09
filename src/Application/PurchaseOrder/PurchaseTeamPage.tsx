import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, RefreshCw, ChevronRight, Send, Loader2,
  FileText, Package, Users, ClipboardCheck, Plus,
  CheckCircle2, Clock, AlertCircle, Eye, Trash2,
  ArrowRight, Award, Upload, Scissors,
} from 'lucide-react';
import {
  purchaseTeamGetApprovedPRs,
  purchaseTeamGetVendors,
  purchaseTeamCreateQuotation,
  purchaseTeamGetQuotations,
  purchaseTeamSelectQuotation,
  purchaseTeamCreatePO,
  purchaseTeamUpdateItemQty,
} from '@/Services/Api';
import { useAppState } from '@/globalState/hooks/useAppState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PRItem {
  pr_item_sno?: number;
  prod_sno?: number;
  prod_name?: string;
  item_name?: string;
  specification?: string;
  qty?: number;
  quantity?: number;
  unit?: number;
  unit_name?: string;
  uom_name?: string;
  uom_code?: string;
  est_cost?: number;
  total_cost?: number;
  estimated_price?: number;
  budget_sno?: number;
  remarks?: string;
}

interface PRRecord {
  pr_basic_sno?: number;
  pr_no?: string;
  pr_id?: string | number;
  com_sno?: number;
  com_name?: string;
  div_sno?: number;
  div_name?: string;
  brn_sno?: number;
  brn_name?: string;
  dept_sno?: number;
  dept_name?: string;
  reg_date?: string;
  request_date?: string;
  req_date?: string;
  required_date?: string;
  req_by_date?: string;
  pr_item_details?: string | PRItem[];
  created_by_name?: string;
  stage_order_json?: string;
  pr_history_data?: string;
  priority_name?: string;
  priority_sno?: number;
  purpose?: string;
  status?: string;
  budget_sno?: number;
  budget_code?: string;
  entered_by?: string;
  created_by?: string;
  items?: PRItem[] | string;
  // flat item columns
  prod_name?: string;
  unit_name?: string;
  quantity?: number;
  est_cost?: number;
}

interface Vendor {
  kyc_basic_info_sno?: number;
  vendor_sno?: number;
  company_name?: string;
  vendor_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  mobile_number?: string;
  address?: string;
  city?: string;
  state?: string;
  gst_no?: string;
  pan_no?: string;
  business_type?: string;
}

interface QuotationItem {
  pr_item_sno?: number;
  prod_sno?: number;
  prod_name: string;
  specification: string;
  qty: number;
  unit: number;
  unit_name: string;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  total_amount: number;
  delivery_days: number;
  remarks: string;
}

interface Quotation {
  sq_basic_sno?: number;
  pr_basic_sno?: number;
  vendor_sno?: number;
  vendor_name?: string;
  company_name?: string;
  quotation_ref_no: string;
  quotation_date: string;
  valid_upto: string;
  currency_code: string;
  payment_terms: string;
  delivery_days: number;
  remarks: string;
  is_selected?: string;
  status?: string;
  items: QuotationItem[];
  sq_quotation_file?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const formatDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

function parseItemDetails(raw: string | PRItem[] | undefined): PRItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(it => ({ ...it, unit_name: it.unit_name ?? it.uom_name }));
  try {
    const parsed: PRItem[] = JSON.parse(raw as string);
    return parsed.map(it => ({ ...it, unit_name: it.unit_name ?? it.uom_name }));
  } catch { return []; }
}

function normalisePRRows(rows: PRRecord[]): PRRecord[] {
  if (!rows || rows.length === 0) return [];

  // API returns pr_item_details as a JSON string
  if (rows[0]?.pr_item_details !== undefined) {
    return rows.map((r) => ({ ...r, items: parseItemDetails(r.pr_item_details) }));
  }

  // API returns items field directly
  if (rows[0]?.items !== undefined) {
    return rows.map((r) => {
      const items = parseItemDetails(r.items as string | PRItem[] | undefined);
      return { ...r, items };
    });
  }

  // Flat/joined rows — group by PR key
  const map = new Map<string, PRRecord>();
  for (const row of rows) {
    const key = String(row.pr_no ?? row.pr_id ?? row.pr_basic_sno ?? '');
    if (!key) continue;
    if (!map.has(key)) {
      const { prod_name, unit_name, quantity, est_cost, ...header } = row;
      map.set(key, { ...header, items: [] });
    }
    const pr = map.get(key)!;
    (pr.items as PRItem[]).push({
      pr_item_sno: (row as any).pr_item_sno,
      prod_sno: (row as any).prod_sno,
      prod_name: row.prod_name,
      specification: (row as any).specification,
      unit_name: row.unit_name ?? (row as any).uom_name,
      unit: (row as any).unit,
      qty: row.quantity,
      est_cost: row.est_cost,
      budget_sno: (row as any).budget_sno,
    });
  }
  return Array.from(map.values());
}

function extractQuotationItems(pr: PRRecord): QuotationItem[] {
  const raw: PRItem[] = Array.isArray(pr.items) ? pr.items : [];
  return raw.map((it) => ({
    pr_item_sno: it.pr_item_sno,
    prod_sno: it.prod_sno,
    prod_name: it.prod_name ?? it.item_name ?? '',
    specification: it.specification ?? '',
    qty: Number(it.qty ?? it.quantity ?? 1),
    unit: it.unit ?? 0,
    unit_name: it.unit_name ?? 'pcs',
    unit_price: 0,
    discount_pct: 0,
    tax_pct: 0,
    total_amount: 0,
    delivery_days: 0,
    remarks: '',
  }));
}

const PAYMENT_TERMS = ['Net 30', 'Net 45', 'Net 60', 'Advance 100%', 'Advance 50%, Balance on Delivery', 'On Delivery'];

// ── Component ─────────────────────────────────────────────────────────────────

const PurchaseTeamPage: React.FC = () => {
  const { userData } = useAppState();

  // ── State ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('pr-list');

  // PR List
  const [prList, setPrList] = useState<PRRecord[]>([]);
  const [loadingPR, setLoadingPR] = useState(false);
  const [searchPR, setSearchPR] = useState('');
  const [selectedPR, setSelectedPR] = useState<PRRecord | null>(null);

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [searchVendor, setSearchVendor] = useState('');

  // Quotation form
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [quotationForm, setQuotationForm] = useState({
    quotation_ref_no: '',
    quotation_date: today(),
    valid_upto: '',
    currency_code: 'INR',
    payment_terms: 'Net 30',
    delivery_days: 0,
    remarks: '',
  });
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [showQuotationDialog, setShowQuotationDialog] = useState(false);
  const [submittingQuotation, setSubmittingQuotation] = useState(false);

  // Existing quotations for a PR
  const [existingQuotations, setExistingQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  // Qty edit
  const [editingQty, setEditingQty] = useState<{ idx: number; value: number } | null>(null);

  // Compare & PO dialog
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [showPOConfirm, setShowPOConfirm] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [poForm, setPOForm] = useState({
    po_date: today(),
    required_date: '',
    purpose: '',
    terms_conditions: '',
    delivery_address: '',
  });
  const [creatingPO, setCreatingPO] = useState(false);

  // Item selection for quotation dialog (indices of PR items included in this quote)
  const [quotationItemSelection, setQuotationItemSelection] = useState<Set<number>>(new Set());

  // Split PO builder: maps PR item index -> sq_basic_sno of chosen supplier quotation
  const [splitAssignment, setSplitAssignment] = useState<Record<number, number | null>>({});
  const [creatingSplitPO, setCreatingSplitPO] = useState(false);

  const currentUser = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u;
  }, [userData]);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchPRs = useCallback(async () => {
    setLoadingPR(true);
    try {
      const res = await axios.get(purchaseTeamGetApprovedPRs, { withCredentials: true });
      const rows: PRRecord[] = res.data?.decrypted?.data ?? res.data?.data ?? [];
      setPrList(normalisePRRows(rows));
    } catch {
      toast.error('Failed to load purchase requisitions');
    } finally {
      setLoadingPR(false);
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    setLoadingVendors(true);
    try {
      const res = await axios.get(purchaseTeamGetVendors, { withCredentials: true });
      setVendors(res.data?.decrypted?.data ?? res.data?.data ?? []);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const fetchQuotations = useCallback(async (prBasicSno: number) => {
    setLoadingQuotations(true);
    try {
      const res = await axios.get(purchaseTeamGetQuotations(prBasicSno), { withCredentials: true });
      const raw = res.data?.decrypted?.data ?? res.data?.data ?? [];

      const quotations: Quotation[] = raw.map((row: any) => {
        let parsedItems: QuotationItem[] = [];
        if (row.sq_items) {
          try {
            const sqItems: any[] = typeof row.sq_items === 'string' ? JSON.parse(row.sq_items) : row.sq_items;
            parsedItems = sqItems.map((it: any) => ({
              pr_item_sno: it.pr_item_sno,
              prod_sno: it.prod_sno,
              prod_name: it.prod_name ?? '',
              specification: it.specification ?? '',
              qty: Number(it.qty ?? 0),
              unit: it.unit ?? 0,
              unit_name: it.unit_name ?? '',
              unit_price: Number(it.unit_price ?? 0),
              discount_pct: Number(it.discount_pct ?? 0),
              tax_pct: Number(it.tax_pct ?? 0),
              total_amount: Number(it.total_amount ?? 0),
              delivery_days: Number(it.delivery_days ?? 0),
              remarks: it.remarks ?? '',
            }));
          } catch { /* ignore parse errors */ }
        }
        return {
          sq_basic_sno: row.sq_basic_sno,
          pr_basic_sno: row.pr_basic_sno,
          vendor_sno: row.vendor_sno,
          vendor_name: row.vendor_name ?? row.company_name ?? '',
          company_name: row.company_name ?? '',
          quotation_ref_no: row.quotation_ref_no ?? '',
          quotation_date: row.quotation_date ?? '',
          valid_upto: row.valid_upto ?? '',
          currency_code: row.currency_code ?? 'INR',
          payment_terms: row.payment_terms ?? '',
          delivery_days: row.delivery_days ?? 0,
          remarks: row.remarks ?? '',
          is_selected: row.is_selected ?? 'N',
          status: row.status ?? 'P',
          items: parsedItems,
          sq_quotation_file: row.sq_quotation_file,
        } as Quotation;
      });

      setExistingQuotations(quotations);
    } catch {
      toast.error('Failed to load quotations');
    } finally {
      setLoadingQuotations(false);
    }
  }, []);

  useEffect(() => { fetchPRs(); fetchVendors(); }, [fetchPRs, fetchVendors]);

  useEffect(() => {
    if (selectedPR?.pr_basic_sno) fetchQuotations(selectedPR.pr_basic_sno);
    else setExistingQuotations([]);
  }, [selectedPR?.pr_basic_sno, fetchQuotations]);

  // ── Filtered lists ──────────────────────────────────────────────────────────

  const filteredPRs = useMemo(() => {
    const q = searchPR.toLowerCase();
    return prList.filter(pr =>
      !q ||
      (pr.pr_no ?? '').toLowerCase().includes(q) ||
      (pr.com_name ?? '').toLowerCase().includes(q) ||
      (pr.dept_name ?? '').toLowerCase().includes(q) ||
      (pr.purpose ?? '').toLowerCase().includes(q)
    );
  }, [prList, searchPR]);

  const filteredVendors = useMemo(() => {
    const q = searchVendor.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, searchVendor]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelectPR = (pr: PRRecord) => {
    setSelectedPR(pr);
    setActiveTab('pr-details');
  };

  const handleOpenQuotation = (vendor: Vendor) => {
    if (!selectedPR) { toast.error('Select a PR first'); return; }
    setSelectedVendor(vendor);
    const items = extractQuotationItems(selectedPR);
    setQuotationItems(items);
    setQuotationItemSelection(new Set(items.map((_, i) => i)));
    setQuotationForm({
      quotation_ref_no: '',
      quotation_date: today(),
      valid_upto: '',
      currency_code: 'INR',
      payment_terms: 'Net 30',
      delivery_days: 0,
      remarks: '',
    });
    setShowQuotationDialog(true);
  };

  const updateQuotationItem = (idx: number, field: keyof QuotationItem, value: string | number) => {
    setQuotationItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: typeof value === 'string' && ['qty', 'unit_price', 'discount_pct', 'tax_pct', 'delivery_days'].includes(field) ? Number(value) : value };
        const base = updated.qty * updated.unit_price;
        const afterDiscount = base * (1 - updated.discount_pct / 100);
        updated.total_amount = afterDiscount * (1 + updated.tax_pct / 100);
        return updated;
      })
    );
  };

  const handleSubmitQuotation = async () => {
    if (!selectedPR || !selectedVendor) return;
    if (!quotationForm.quotation_ref_no.trim()) { toast.error('Quotation reference number required'); return; }
    if (!quotationForm.valid_upto) { toast.error('Valid upto date required'); return; }
    const selectedItems = quotationItems.filter((_, i) => quotationItemSelection.has(i));
    if (selectedItems.length === 0) { toast.error('Select at least one item for this quotation'); return; }
    if (selectedItems.some(it => it.unit_price <= 0)) { toast.error('Enter unit price for all selected items'); return; }

    setSubmittingQuotation(true);
    try {
      await axios.post(purchaseTeamCreateQuotation, {
        pr_basic_sno: selectedPR.pr_basic_sno,
        vendor_sno: selectedVendor.kyc_basic_info_sno ?? selectedVendor.vendor_sno,
        ...quotationForm,
        items: selectedItems,
      }, { withCredentials: true });

      toast.success('Supplier quotation created');
      setShowQuotationDialog(false);
      if (selectedPR.pr_basic_sno) fetchQuotations(selectedPR.pr_basic_sno);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create quotation';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning('Quotation data recorded. SP may not be deployed yet.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmittingQuotation(false);
    }
  };

  const handleSelectQuotation = async (q: Quotation) => {
    if (!q.sq_basic_sno) return;
    try {
      console.log(q)
      await axios.post(purchaseTeamSelectQuotation(q.sq_basic_sno), {}, { withCredentials: true });
      toast.success('Quotation selected');
      if (selectedPR?.pr_basic_sno) fetchQuotations(selectedPR.pr_basic_sno);
    } catch (err: any) {
      console.log(err)
      toast.error(err?.response?.data?.error ?? 'Failed to select quotation');
    }
  };

  const handleOpenCreatePO = (q: Quotation) => {
    setSelectedQuotation(q);
    setPOForm({
      po_date: today(),
      required_date: selectedPR?.required_date ?? selectedPR?.req_by_date ?? '',
      purpose: selectedPR?.purpose ?? '',
      terms_conditions: q.payment_terms ?? '',
      delivery_address: '',
    });
    setShowPOConfirm(true);
  };

  const handleCreatePO = async () => {
    if (!selectedPR || !selectedQuotation) return;
    if (!poForm.required_date) { toast.error('Required date is needed'); return; }

    setCreatingPO(true);
    try {
      await axios.post(purchaseTeamCreatePO, {
        pr_basic_sno: selectedPR.pr_basic_sno,
        sq_basic_sno: selectedQuotation.sq_basic_sno,
        vendor_sno: selectedQuotation.vendor_sno,
        com_sno: selectedPR.com_sno,
        div_sno: selectedPR.div_sno,
        brn_sno: selectedPR.brn_sno,
        dept_sno: selectedPR.dept_sno,
        budget_sno: selectedPR.budget_sno,
        budget_code: selectedPR.budget_code,
        priority_sno: selectedPR.priority_sno,
        ...poForm,
        items: selectedQuotation.items,
      }, { withCredentials: true });

      toast.success('Purchase Order created successfully!');
      setShowPOConfirm(false);
      setSelectedQuotation(null);
      fetchPRs();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create PO';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning('PO data prepared. SP may not be deployed yet.');
      } else {
        toast.error(msg);
      }
    } finally {
      setCreatingPO(false);
    }
  };

  // Returns quotations that include a given PR item (matched by pr_item_sno or prod_name)
  const getQuotationsForItem = useCallback((prItem: PRItem): Quotation[] => {
    return existingQuotations.filter(q =>
      q.items.some(it =>
        (prItem.pr_item_sno && it.pr_item_sno === prItem.pr_item_sno) ||
        it.prod_name === (prItem.prod_name ?? prItem.item_name)
      )
    );
  }, [existingQuotations]);

  const handleCreateSplitPOs = async () => {
    if (!selectedPR) return;
    const prItems = Array.isArray(selectedPR.items) ? selectedPR.items : [];

    // Group assigned items by supplier quotation
    const groups = new Map<number, { quotation: Quotation; items: QuotationItem[] }>();
    prItems.forEach((prItem, idx) => {
      const sqSno = splitAssignment[idx];
      if (!sqSno) return;
      const q = existingQuotations.find(q => q.sq_basic_sno === sqSno);
      if (!q) return;
      const qItem = q.items.find(it =>
        (prItem.pr_item_sno && it.pr_item_sno === prItem.pr_item_sno) ||
        it.prod_name === (prItem.prod_name ?? prItem.item_name)
      );
      if (!qItem) return;
      if (!groups.has(sqSno)) groups.set(sqSno, { quotation: q, items: [] });
      groups.get(sqSno)!.items.push(qItem);
    });

    if (groups.size === 0) { toast.error('Assign at least one item to a supplier'); return; }

    setCreatingSplitPO(true);
    try {
      for (const [sqSno, { quotation, items }] of groups) {
        await axios.post(purchaseTeamCreatePO, {
          pr_basic_sno: selectedPR.pr_basic_sno,
          sq_basic_sno: sqSno,
          vendor_sno: quotation.vendor_sno,
          com_sno: selectedPR.com_sno,
          div_sno: selectedPR.div_sno,
          brn_sno: selectedPR.brn_sno,
          dept_sno: selectedPR.dept_sno,
          budget_sno: selectedPR.budget_sno,
          budget_code: selectedPR.budget_code,
          priority_sno: selectedPR.priority_sno,
          po_date: today(),
          required_date: selectedPR.required_date ?? selectedPR.req_by_date ?? '',
          purpose: selectedPR.purpose ?? '',
          terms_conditions: quotation.payment_terms ?? '',
          delivery_address: '',
          items,
        }, { withCredentials: true });
      }
      toast.success(`${groups.size} Purchase Order(s) created successfully!`);
      setSplitAssignment({});
      fetchPRs();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to create POs');
    } finally {
      setCreatingSplitPO(false);
    }
  };

  const handleSaveQtyChange = async (item: PRItem, newQty: number) => {
    if (!selectedPR || !item.pr_item_sno) return;
    try {
      await axios.post(purchaseTeamUpdateItemQty, {
        pr_item_sno: item.pr_item_sno,
        qty: newQty,
      }, { withCredentials: true });
      toast.success('Quantity updated');
      setEditingQty(null);
      fetchPRs();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update quantity');
    }
  };

  // ── Quotation totals ───────────────────────────────────────────────────────

  const quotationTotals = useMemo(() => {
    const sub = quotationItems.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const disc = quotationItems.reduce((s, it) => s + it.qty * it.unit_price * (it.discount_pct / 100), 0);
    const tax = quotationItems.reduce((s, it) => {
      const base = it.qty * it.unit_price * (1 - it.discount_pct / 100);
      return s + base * (it.tax_pct / 100);
    }, 0);
    return { subtotal: sub, discount: disc, tax, grandTotal: sub - disc + tax };
  }, [quotationItems]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* ── Page Header ── */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ClipboardCheck className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Team</h1>
            <p className="text-sm text-gray-500">Process PRs, manage supplier quotations, create purchase orders</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchPRs(); fetchVendors(); }} disabled={loadingPR}>
            <RefreshCw size={16} className={loadingPR ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT: PR List ── */}
        <div className="w-80 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex gap-3 text-xs font-medium">
            <span className="text-gray-500">{prList.length} PRs</span>
            <span className="text-green-600">{prList.filter(p => (p.status ?? '').toLowerCase().includes('approv')).length} approved</span>
          </div>

          <div className="px-3 py-2 border-b">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search PR no, company…"
                value={searchPR}
                onChange={(e) => setSearchPR(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingPR ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm">Loading PRs…</span>
              </div>
            ) : filteredPRs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                <FileText size={24} />
                <span className="text-sm">No PRs found</span>
              </div>
            ) : (
              filteredPRs.map((pr, idx) => {
                const isSelected = selectedPR?.pr_basic_sno === pr.pr_basic_sno && selectedPR?.pr_no === pr.pr_no;
                const prKey = String(pr.pr_no ?? pr.pr_id ?? pr.pr_basic_sno ?? idx);
                const itemCount = Array.isArray(pr.items) ? pr.items.length : 0;
                return (
                  <button
                    key={prKey}
                    onClick={() => handleSelectPR(pr)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-indigo-50 transition-colors ${
                      isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-indigo-700 truncate">
                        {pr.pr_no ?? `PR-${pr.pr_id ?? pr.pr_basic_sno}`}
                      </span>
                      <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                        Approved
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600 truncate">{pr.com_name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {pr.dept_name} {(pr.reg_date || pr.request_date || pr.req_date) ? `• ${formatDate(pr.reg_date ?? pr.request_date ?? pr.req_date)}` : ''}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{itemCount} items</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Main Content ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedPR ? (
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-400">
              <div className="bg-gray-100 p-6 rounded-full">
                <ClipboardCheck size={40} />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Select a Purchase Requisition</p>
                <p className="text-sm mt-1">Choose a PR from the left panel to manage quotations and create POs</p>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="bg-white border-b px-6 pt-3">
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                  <TabsTrigger value="pr-details" className="text-xs">
                    <FileText size={14} className="mr-1" /> PR Details
                  </TabsTrigger>
                  <TabsTrigger value="quotations" className="text-xs">
                    <Users size={14} className="mr-1" /> Quotations
                  </TabsTrigger>
                  <TabsTrigger value="create-po" className="text-xs">
                    <Package size={14} className="mr-1" /> Create PO
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── TAB 1: PR Details ── */}
              <TabsContent value="pr-details" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
                {/* PR Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600" />
                      PR Reference — {selectedPR.pr_no ?? `PR-${selectedPR.pr_id ?? selectedPR.pr_basic_sno}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Company</p>
                        <p className="font-medium">{selectedPR.com_name ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Division / Branch</p>
                        <p className="font-medium">{[selectedPR.div_name, selectedPR.brn_name].filter(Boolean).join(' / ') || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Department</p>
                        <p className="font-medium">{selectedPR.dept_name ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Priority</p>
                        <p className="font-medium">{selectedPR.priority_name ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Request Date</p>
                        <p className="font-medium">{formatDate(selectedPR.reg_date ?? selectedPR.request_date ?? selectedPR.req_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Required By</p>
                        <p className="font-medium">{formatDate(selectedPR.required_date ?? selectedPR.req_by_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Requested By</p>
                        <p className="font-medium">{selectedPR.created_by_name ?? selectedPR.entered_by ?? selectedPR.created_by ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Purpose</p>
                        <p className="font-medium">{selectedPR.purpose || '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* PR Items with Qty Edit */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package size={16} className="text-orange-600" />
                      PR Items
                      <span className="text-xs font-normal text-gray-400">(click qty to edit)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Item / Product</TableHead>
                          <TableHead className="text-xs">Specification</TableHead>
                          <TableHead className="text-xs text-center w-28">Qty</TableHead>
                          <TableHead className="text-xs text-center w-24">Unit</TableHead>
                          <TableHead className="text-xs text-right w-32">Est. Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(Array.isArray(selectedPR.items) ? selectedPR.items : []).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                            <TableCell className="text-sm font-medium">{item.prod_name ?? item.item_name ?? '—'}</TableCell>
                            <TableCell className="text-sm text-gray-600">{item.specification ?? '—'}</TableCell>
                            <TableCell className="text-center">
                              {editingQty?.idx === idx ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={editingQty.value}
                                    onChange={(e) => setEditingQty({ idx, value: Number(e.target.value) })}
                                    className="h-7 w-20 text-sm text-center"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveQtyChange(item, editingQty.value);
                                      if (e.key === 'Escape') setEditingQty(null);
                                    }}
                                  />
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveQtyChange(item, editingQty.value)}>
                                    <CheckCircle2 size={14} className="text-green-600" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingQty({ idx, value: Number(item.qty ?? item.quantity ?? 0) })}
                                  className="text-sm font-medium text-indigo-600 hover:underline cursor-pointer"
                                >
                                  {item.qty ?? item.quantity ?? 0}
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-center">{item.unit_name ?? '—'}</TableCell>
                            <TableCell className="text-sm text-right font-medium">
                              {item.est_cost || item.estimated_price ? formatINR(Number(item.est_cost ?? item.estimated_price)) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={() => setActiveTab('quotations')} className="bg-indigo-600 hover:bg-indigo-700">
                    Manage Quotations <ArrowRight size={16} className="ml-1" />
                  </Button>
                </div>
              </TabsContent>

              {/* ── TAB 2: Quotations ── */}
              <TabsContent value="quotations" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
                {/* Vendor selection */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users size={16} className="text-green-600" />
                        Assign Supplier &amp; Add Quotation
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative mb-3">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search vendors by name, GST…"
                        value={searchVendor}
                        onChange={(e) => setSearchVendor(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                    {loadingVendors ? (
                      <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Loading vendors…</span>
                      </div>
                    ) : filteredVendors.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No vendors found</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Vendor Name</TableHead>
                              <TableHead className="text-xs">Contact Person</TableHead>
                              <TableHead className="text-xs">GST No</TableHead>
                              <TableHead className="text-xs">Mobile / Email</TableHead>
                              <TableHead className="text-xs w-24">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredVendors.slice(0, 20).map((v) => (
                              <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno} className="hover:bg-gray-50">
                                <TableCell className="text-sm font-medium">{v.company_name ?? v.vendor_name}</TableCell>
                                <TableCell className="text-xs text-gray-600">{v.contact_person ?? '—'}</TableCell>
                                <TableCell className="text-xs text-gray-600">{v.gst_no ?? '—'}</TableCell>
                                <TableCell className="text-xs text-gray-600">{v.mobile_number ?? v.mobile ?? v.phone ?? v.email ?? '—'}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => handleOpenQuotation(v)}
                                  >
                                    <Plus size={12} className="mr-1" /> Quote
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Existing quotations */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-purple-600" />
                        Quotations for {selectedPR.pr_no ?? `PR-${selectedPR.pr_id ?? selectedPR.pr_basic_sno}`}
                        <Badge variant="outline" className="text-xs ml-1">{existingQuotations.length}</Badge>
                      </CardTitle>
                      <div className="flex gap-2">
                        {existingQuotations.length >= 2 && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowCompareDialog(true)}>
                            <Eye size={14} className="mr-1" /> Compare
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => { if (selectedPR?.pr_basic_sno) fetchQuotations(selectedPR.pr_basic_sno); }}
                          disabled={loadingQuotations}
                        >
                          <RefreshCw size={14} className={loadingQuotations ? 'animate-spin' : ''} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingQuotations ? (
                      <div className="flex items-center gap-2 text-gray-400 py-6 justify-center">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Loading quotations…</span>
                      </div>
                    ) : existingQuotations.length === 0 ? (
                      <div className="flex flex-col items-center py-6 text-gray-400 gap-2">
                        <ClipboardCheck size={28} />
                        <p className="text-sm">No quotations yet. Assign a supplier above to add one.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {existingQuotations.map((q) => {
                          const total = q.items.reduce((s, it) => s + (it.total_amount || it.qty * it.unit_price), 0);
                          const isSelected = q.is_selected === 'Y';
                          return (
                            <Card key={q.sq_basic_sno} className={`border ${isSelected ? 'border-green-400 bg-green-50/30' : ''}`}>
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold">{q.vendor_name || q.company_name}</span>
                                      {isSelected && (
                                        <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                                          <Award size={10} className="mr-1" /> Selected
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                                      <div>
                                        <span className="text-gray-400">Ref: </span>
                                        <span className="font-medium">{q.quotation_ref_no || '—'}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Date: </span>
                                        <span>{formatDate(q.quotation_date)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Valid: </span>
                                        <span>{formatDate(q.valid_upto)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Delivery: </span>
                                        <span>{q.delivery_days} days</span>
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs">
                                      <span className="text-gray-400">Items: {q.items.length} </span>
                                      <span className="font-semibold text-gray-800">Total: {formatINR(total)}</span>
                                    </div>
                                    {q.payment_terms && (
                                      <p className="text-xs text-gray-500 mt-1">Terms: {q.payment_terms}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    {!isSelected && (
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleSelectQuotation(q)}>
                                        <CheckCircle2 size={12} className="mr-1" /> Select
                                      </Button>
                                    )}
                                    {isSelected && (
                                      <Button size="sm" className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleOpenCreatePO(q)}>
                                        <Package size={12} className="mr-1" /> Create PO
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Quotation items table */}
                                {q.items.length > 0 && (
                                  <div className="mt-3 border rounded overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-gray-50/80">
                                          <TableHead className="text-xs">Item</TableHead>
                                          <TableHead className="text-xs text-center">Qty</TableHead>
                                          <TableHead className="text-xs text-right">Unit Price</TableHead>
                                          <TableHead className="text-xs text-right">Disc %</TableHead>
                                          <TableHead className="text-xs text-right">Tax %</TableHead>
                                          <TableHead className="text-xs text-right">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {q.items.map((it, iIdx) => (
                                          <TableRow key={iIdx}>
                                            <TableCell className="text-xs">{it.prod_name}</TableCell>
                                            <TableCell className="text-xs text-center">{it.qty} {it.unit_name}</TableCell>
                                            <TableCell className="text-xs text-right">{formatINR(it.unit_price)}</TableCell>
                                            <TableCell className="text-xs text-right">{it.discount_pct}%</TableCell>
                                            <TableCell className="text-xs text-right">{it.tax_pct}%</TableCell>
                                            <TableCell className="text-xs text-right font-medium">{formatINR(it.total_amount || it.qty * it.unit_price)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── TAB 3: Create PO (summary/shortcut) ── */}
              <TabsContent value="create-po" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package size={16} className="text-indigo-600" />
                      Create Purchase Order
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {existingQuotations.filter(q => q.is_selected === 'Y').length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-gray-400 gap-3">
                        <AlertCircle size={32} />
                        <p className="text-sm text-center">
                          No quotation selected yet. Go to the <strong>Quotations</strong> tab, add supplier quotations, and select the best one.
                        </p>
                        <Button variant="outline" onClick={() => setActiveTab('quotations')}>
                          <ArrowRight size={14} className="mr-1" /> Go to Quotations
                        </Button>
                      </div>
                    ) : (
                      existingQuotations.filter(q => q.is_selected === 'Y').map((q) => {
                        const total = q.items.reduce((s, it) => s + (it.total_amount || it.qty * it.unit_price), 0);
                        return (
                          <div key={q.sq_basic_sno} className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Award size={16} className="text-green-600" />
                                <span className="font-semibold text-green-800">Selected Quotation</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500">Vendor</p>
                                  <p className="font-medium">{q.vendor_name || q.company_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Ref No</p>
                                  <p className="font-medium">{q.quotation_ref_no}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Total</p>
                                  <p className="font-bold text-indigo-700">{formatINR(total)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Delivery</p>
                                  <p className="font-medium">{q.delivery_days} days</p>
                                </div>
                              </div>
                            </div>

                            {/* Items preview */}
                            <div className="border rounded overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50">
                                    <TableHead className="text-xs">#</TableHead>
                                    <TableHead className="text-xs">Item</TableHead>
                                    <TableHead className="text-xs text-center">Qty</TableHead>
                                    <TableHead className="text-xs text-right">Unit Price</TableHead>
                                    <TableHead className="text-xs text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {q.items.map((it, iIdx) => (
                                    <TableRow key={iIdx}>
                                      <TableCell className="text-xs text-gray-400">{iIdx + 1}</TableCell>
                                      <TableCell className="text-xs">{it.prod_name}</TableCell>
                                      <TableCell className="text-xs text-center">{it.qty} {it.unit_name}</TableCell>
                                      <TableCell className="text-xs text-right">{formatINR(it.unit_price)}</TableCell>
                                      <TableCell className="text-xs text-right font-medium">{formatINR(it.total_amount || it.qty * it.unit_price)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            <div className="flex justify-end">
                              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => handleOpenCreatePO(q)}>
                                <Send size={14} className="mr-1" /> Generate Purchase Order
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOGS
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── Add Quotation Dialog ── */}
      <Dialog open={showQuotationDialog} onOpenChange={setShowQuotationDialog}>
        <DialogContent className="overflow-y-auto min-w-5xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} className="text-green-600" />
              Add Supplier Quotation 
            </DialogTitle>
          </DialogHeader>

          {/* Quotation header fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Quotation Ref No <span className="text-red-500">*</span></Label>
              <Input
                value={quotationForm.quotation_ref_no}
                onChange={(e) => setQuotationForm(f => ({ ...f, quotation_ref_no: e.target.value }))}
                placeholder="e.g. SQ-2026-001"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Quotation Date</Label>
              <Input
                type="date"
                value={quotationForm.quotation_date}
                onChange={(e) => setQuotationForm(f => ({ ...f, quotation_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Valid Upto <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={quotationForm.valid_upto}
                onChange={(e) => setQuotationForm(f => ({ ...f, valid_upto: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Payment Terms</Label>
              <Select
                value={quotationForm.payment_terms}
                onValueChange={(val) => setQuotationForm(f => ({ ...f, payment_terms: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Delivery Days</Label>
              <Input
                type="number"
                min={0}
                value={quotationForm.delivery_days || ''}
                onChange={(e) => setQuotationForm(f => ({ ...f, delivery_days: Number(e.target.value) }))}
                placeholder="e.g. 15"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Currency</Label>
              <Input
                value={quotationForm.currency_code}
                onChange={(e) => setQuotationForm(f => ({ ...f, currency_code: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Remarks</Label>
            <Textarea
              value={quotationForm.remarks}
              onChange={(e) => setQuotationForm(f => ({ ...f, remarks: e.target.value }))}
              placeholder="Additional notes…"
              rows={2}
            />
          </div>

          {/* Quotation items */}
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs w-8">
                    <input
                      type="checkbox"
                      checked={quotationItemSelection.size === quotationItems.length}
                      onChange={(e) => setQuotationItemSelection(
                        e.target.checked ? new Set(quotationItems.map((_, i) => i)) : new Set()
                      )}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs text-center w-20">Qty</TableHead>
                  <TableHead className="text-xs text-center w-20">Unit</TableHead>
                  <TableHead className="text-xs text-right w-28">Unit Price <span className="text-red-500">*</span></TableHead>
                  <TableHead className="text-xs text-right w-20">Disc %</TableHead>
                  <TableHead className="text-xs text-right w-20">Tax %</TableHead>
                  <TableHead className="text-xs text-right w-28">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotationItems.map((item, idx) => {
                  const included = quotationItemSelection.has(idx);
                  return (
                  <TableRow key={idx} className={!included ? 'opacity-40' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => setQuotationItemSelection(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(idx); else next.delete(idx);
                          return next;
                        })}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="text-sm">{item.prod_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateQuotationItem(idx, 'qty', e.target.value)}
                        className="h-7 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-center">{item.unit_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.unit_price || ''}
                        onChange={(e) => updateQuotationItem(idx, 'unit_price', e.target.value)}
                        placeholder="0"
                        className={`h-7 text-xs text-right ${item.unit_price <= 0 ? 'border-amber-400 bg-amber-50' : ''}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={item.discount_pct || ''}
                        onChange={(e) => updateQuotationItem(idx, 'discount_pct', e.target.value)}
                        placeholder="0"
                        className="h-7 text-xs text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={item.tax_pct || ''}
                        onChange={(e) => updateQuotationItem(idx, 'tax_pct', e.target.value)}
                        placeholder="0"
                        className="h-7 text-xs text-right"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatINR(item.total_amount)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="space-y-1 text-sm w-64">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatINR(quotationTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span className="font-medium text-red-600">-{formatINR(quotationTotals.discount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span className="font-medium">{formatINR(quotationTotals.tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Grand Total</span>
                <span className="text-indigo-700">{formatINR(quotationTotals.grandTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuotationDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitQuotation} disabled={submittingQuotation} className="bg-indigo-600 hover:bg-indigo-700">
              {submittingQuotation ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
              Submit Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Compare Quotations Dialog ── */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="min-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              Compare Quotations
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold w-40">Parameter</TableHead>
                  {existingQuotations.map(q => (
                    <TableHead key={q.sq_basic_sno} className="text-xs font-semibold text-center">
                      {q.vendor_name || q.company_name}
                      {q.is_selected === 'Y' && (
                        <Badge className="ml-1 text-[10px] bg-green-100 text-green-700">Selected</Badge>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium text-gray-600">Ref No</TableCell>
                  {existingQuotations.map(q => (
                    <TableCell key={q.sq_basic_sno} className="text-xs text-center">{q.quotation_ref_no}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-gray-600">Valid Upto</TableCell>
                  {existingQuotations.map(q => (
                    <TableCell key={q.sq_basic_sno} className="text-xs text-center">{formatDate(q.valid_upto)}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-gray-600">Payment Terms</TableCell>
                  {existingQuotations.map(q => (
                    <TableCell key={q.sq_basic_sno} className="text-xs text-center">{q.payment_terms}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-gray-600">Delivery Days</TableCell>
                  {existingQuotations.map(q => (
                    <TableCell key={q.sq_basic_sno} className="text-xs text-center font-medium">{q.delivery_days}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-gray-600">Total Amount</TableCell>
                  {existingQuotations.map(q => {
                    const total = q.items.reduce((s, it) => s + (it.total_amount || it.qty * it.unit_price), 0);
                    const allTotals = existingQuotations.map(qq => qq.items.reduce((s, it) => s + (it.total_amount || it.qty * it.unit_price), 0));
                    const isLowest = total === Math.min(...allTotals);
                    return (
                      <TableCell key={q.sq_basic_sno} className={`text-xs text-center font-bold ${isLowest ? 'text-green-700 bg-green-50' : ''}`}>
                        {formatINR(total)}
                        {isLowest && <span className="block text-[10px] font-normal text-green-600">Lowest</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {/* Per-item comparison */}
                {(Array.isArray(selectedPR?.items) ? selectedPR.items : []).map((prItem, prIdx) => (
                  <TableRow key={prIdx} className="bg-gray-50/50">
                    <TableCell className="text-xs text-gray-500">
                      {prItem.prod_name ?? prItem.item_name} (Unit Price)
                    </TableCell>
                    {existingQuotations.map(q => {
                      const matchItem = q.items.find(it => it.prod_sno === prItem.prod_sno || it.prod_name === prItem.prod_name);
                      const prices = existingQuotations.map(qq => {
                        const m = qq.items.find(it => it.prod_sno === prItem.prod_sno || it.prod_name === prItem.prod_name);
                        return m?.unit_price ?? Infinity;
                      });
                      const isLowest = matchItem && matchItem.unit_price === Math.min(...prices);
                      return (
                        <TableCell key={q.sq_basic_sno} className={`text-xs text-center ${isLowest ? 'text-green-700 font-semibold' : ''}`}>
                          {matchItem ? formatINR(matchItem.unit_price) : '—'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create PO Confirm Dialog ── */}
      <Dialog open={showPOConfirm} onOpenChange={setShowPOConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package size={18} className="text-indigo-600" />
              Create Purchase Order
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
              <p><span className="font-medium">PR:</span> {selectedPR?.pr_no ?? `PR-${selectedPR?.pr_id}`}</p>
              <p><span className="font-medium">Vendor:</span> {selectedQuotation?.vendor_name ?? selectedQuotation?.company_name}</p>
              <p><span className="font-medium">Quotation:</span> {selectedQuotation?.quotation_ref_no}</p>
              <p><span className="font-medium">Items:</span> {selectedQuotation?.items.length}</p>
              <p><span className="font-medium">Total:</span> {formatINR(selectedQuotation?.items.reduce((s, it) => s + (it.total_amount || it.qty * it.unit_price), 0) ?? 0)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">PO Date</Label>
                <Input
                  type="date"
                  value={poForm.po_date}
                  onChange={(e) => setPOForm(f => ({ ...f, po_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Required Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={poForm.required_date}
                  onChange={(e) => setPOForm(f => ({ ...f, required_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Delivery Address</Label>
              <Textarea
                value={poForm.delivery_address}
                onChange={(e) => setPOForm(f => ({ ...f, delivery_address: e.target.value }))}
                placeholder="Shipping / delivery address"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Terms &amp; Conditions</Label>
              <Textarea
                value={poForm.terms_conditions}
                onChange={(e) => setPOForm(f => ({ ...f, terms_conditions: e.target.value }))}
                placeholder="Payment terms, warranty, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPOConfirm(false)}>Cancel</Button>
            <Button onClick={handleCreatePO} disabled={creatingPO} className="bg-indigo-600 hover:bg-indigo-700">
              {creatingPO ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseTeamPage;
