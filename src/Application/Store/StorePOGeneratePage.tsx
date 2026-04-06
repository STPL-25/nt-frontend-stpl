import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
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
import {
  ShoppingCart, FileText, Building2, Package, Calendar,
  Search, RefreshCw, ChevronRight, Save, Send, X, Loader2,
  ClipboardList, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import { getPrRecords, storePOSaveDraft, storePOGetDrafts, storePOSubmitDraft } from '@/Services/Api';
import { useAppState } from '@/globalState/hooks/useAppState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PRItem {
  prod_name?: string;
  item_name?: string;
  prod_sno?: string | number;
  unit_name?: string;
  unit_sno?: string | number;
  quantity?: number;
  qty?: number;
  est_cost?: number;
  estimated_price?: number;
}

interface PRRecord {
  pr_no?: string;
  pr_id?: string | number;
  com_name?: string;
  div_name?: string;
  brn_name?: string;
  dept_name?: string;
  request_date?: string;
  req_date?: string;
  required_date?: string;
  req_by_date?: string;
  priority_name?: string;
  purpose?: string;
  status?: string;
  entered_by?: string;
  created_by?: string;
  items?: PRItem[] | string;
  // flat item columns (when SP returns one row per item)
  prod_name?: string;
  unit_name?: string;
  quantity?: number;
  est_cost?: number;
}

interface POItem {
  prod_name: string;
  unit_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

interface VendorInfo {
  vendor_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
}

interface PODetails {
  po_date: string;
  delivery_date: string;
  payment_terms: string;
  shipping_address: string;
  notes: string;
}

interface PODraft {
  draftId?: string;
  pr_no: string;
  pr_summary: Omit<PRRecord, 'items'>;
  vendor: VendorInfo;
  po_details: PODetails;
  items: POItem[];
  subtotal: number;
  tax_total: number;
  grand_total: number;
  status?: string;
  savedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const formatDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function prStatus(status?: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('approv')) return { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200' };
  if (s.includes('reject')) return { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' };
  if (s.includes('submit') || s.includes('pending') || s.includes('review') || s.includes('approval'))
    return { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (s.includes('draft'))
    return { label: 'Draft', color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return { label: status || 'Unknown', color: 'bg-blue-100 text-blue-700 border-blue-200' };
}

/** Normalise raw SP rows into a list of grouped PR objects with items array */
function normalisePRRows(rows: PRRecord[]): PRRecord[] {
  if (!rows || rows.length === 0) return [];

  // Case 1: items already on first row (JSON string or array)
  if (rows[0]?.items !== undefined) {
    return rows.map((r) => {
      let items: PRItem[] = [];
      if (typeof r.items === 'string') {
        try { items = JSON.parse(r.items); } catch { items = []; }
      } else if (Array.isArray(r.items)) {
        items = r.items;
      }
      return { ...r, items };
    });
  }

  // Case 2: flat rows, one per item — group by pr_no / pr_id
  const map = new Map<string, PRRecord>();
  for (const row of rows) {
    const key = String(row.pr_no ?? row.pr_id ?? '');
    if (!key) continue;
    if (!map.has(key)) {
      const { prod_name, unit_name, quantity, est_cost, ...header } = row;
      map.set(key, { ...header, items: [] });
    }
    const pr = map.get(key)!;
    (pr.items as PRItem[]).push({
      prod_name: row.prod_name,
      unit_name: row.unit_name,
      quantity: row.quantity,
      est_cost: row.est_cost,
    });
  }
  return Array.from(map.values());
}

function extractItems(pr: PRRecord): POItem[] {
  const raw: PRItem[] = Array.isArray(pr.items) ? pr.items : [];
  return raw.map((it) => ({
    prod_name: it.prod_name ?? it.item_name ?? 'Unknown Item',
    unit_name: it.unit_name ?? 'pcs',
    quantity: Number(it.quantity ?? it.qty ?? 1),
    unit_price: 0,
    tax_rate: 0,
    total: 0,
  }));
}

const PAYMENT_TERMS = ['Net 30', 'Net 45', 'Net 60', 'Advance 100%', 'Advance 50%, Balance on Delivery', 'On Delivery'];

// ── Component ─────────────────────────────────────────────────────────────────

const StorePOGeneratePage: React.FC = () => {
  const { userData } = useAppState();

  // PR list state
  const [prList, setPrList] = useState<PRRecord[]>([]);
  const [loadingPR, setLoadingPR] = useState(false);
  const [searchPR, setSearchPR] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');

  // Selected PR + PO form
  const [selectedPR, setSelectedPR] = useState<PRRecord | null>(null);
  const [vendor, setVendor] = useState<VendorInfo>({ vendor_name: '', contact_person: '', email: '', phone: '', address: '' });
  const [poDetails, setPoDetails] = useState<PODetails>({ po_date: today(), delivery_date: '', payment_terms: 'Net 30', shipping_address: '', notes: '' });
  const [poItems, setPoItems] = useState<POItem[]>([]);

  // Draft list state
  const [drafts, setDrafts] = useState<PODraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentUser = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u;
  }, [userData]);

  // ── Fetch PRs ──────────────────────────────────────────────────────────────

  const fetchPRs = useCallback(async () => {
    setLoadingPR(true);
    try {
      const res = await axios.get(getPrRecords, { withCredentials: true });
      const rows: PRRecord[] = res.data?.data ?? [];
      setPrList(normalisePRRows(rows));
    } catch {
      toast.error('Failed to load purchase requisitions');
    } finally {
      setLoadingPR(false);
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await axios.get(storePOGetDrafts, { withCredentials: true });
      setDrafts(res.data?.data ?? []);
    } catch {
      // silent — drafts are supplementary
    }
  }, []);

  useEffect(() => {
    fetchPRs();
    fetchDrafts();
  }, [fetchPRs, fetchDrafts]);

  // ── Filtered PR list ───────────────────────────────────────────────────────

  const filteredPRs = useMemo(() => {
    return prList.filter((pr) => {
      const q = searchPR.toLowerCase();
      const matchSearch =
        !q ||
        (pr.pr_no ?? '').toLowerCase().includes(q) ||
        (pr.com_name ?? '').toLowerCase().includes(q) ||
        (pr.dept_name ?? '').toLowerCase().includes(q) ||
        (pr.purpose ?? '').toLowerCase().includes(q);

      const s = (pr.status ?? '').toLowerCase();
      const matchFilter =
        filterStatus === 'all' ||
        (filterStatus === 'pending' && (s.includes('submit') || s.includes('pending') || s.includes('review') || s.includes('approval'))) ||
        (filterStatus === 'approved' && s.includes('approv'));

      return matchSearch && matchFilter;
    });
  }, [prList, searchPR, filterStatus]);

  // ── Select a PR → pre-fill PO form ────────────────────────────────────────

  const handleSelectPR = (pr: PRRecord) => {
    setSelectedPR(pr);
    setPoItems(extractItems(pr));
    setVendor({ vendor_name: '', contact_person: '', email: '', phone: '', address: '' });
    setPoDetails({ po_date: today(), delivery_date: '', payment_terms: 'Net 30', shipping_address: '', notes: '' });
  };

  // ── Item edits ─────────────────────────────────────────────────────────────

  const updateItem = (idx: number, field: keyof POItem, value: string) => {
    setPoItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: field === 'prod_name' || field === 'unit_name' ? value : Number(value) };
        updated.total = updated.quantity * updated.unit_price * (1 + updated.tax_rate / 100);
        return updated;
      })
    );
  };

  // ── Totals ─────────────────────────────────────────────────────────────────

  const { subtotal, taxTotal, grandTotal } = useMemo(() => {
    const sub = poItems.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const tax = poItems.reduce((s, it) => s + it.quantity * it.unit_price * (it.tax_rate / 100), 0);
    return { subtotal: sub, taxTotal: tax, grandTotal: sub + tax };
  }, [poItems]);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    if (!selectedPR) { toast.error('No PR selected'); return false; }
    if (!vendor.vendor_name.trim()) { toast.error('Vendor name is required'); return false; }
    if (!poDetails.delivery_date) { toast.error('Delivery date is required'); return false; }
    if (poItems.some((it) => it.unit_price <= 0)) { toast.error('Enter unit price for all items'); return false; }
    return true;
  };

  // ── Build payload ──────────────────────────────────────────────────────────

  const buildPayload = (): Omit<PODraft, 'draftId' | 'status' | 'savedAt'> => {
    const { items: _items, ...prSummary } = selectedPR!;
    return {
      pr_no: String(selectedPR!.pr_no ?? selectedPR!.pr_id ?? ''),
      pr_summary: prSummary,
      vendor,
      po_details: poDetails,
      items: poItems,
      subtotal,
      tax_total: taxTotal,
      grand_total: grandTotal,
    };
  };

  // ── Save draft ─────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!selectedPR) { toast.error('Select a PR first'); return; }
    setSavingDraft(true);
    try {
      await axios.post(storePOSaveDraft, buildPayload(), { withCredentials: true });
      toast.success('PO draft saved');
      fetchDrafts();
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Submit (generate PO) ───────────────────────────────────────────────────

  const handleGeneratePO = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Save draft first, then submit it to DB
      const saveRes = await axios.post(storePOSaveDraft, buildPayload(), { withCredentials: true });
      const draftId: string = saveRes.data?.draftId;
      await axios.post(storePOSubmitDraft(draftId), {}, { withCredentials: true });
      toast.success('Store PO generated successfully!');
      setSelectedPR(null);
      setPoItems([]);
      fetchDrafts();
    } catch (err: any) {
      // SP may not exist yet — still show draft saved confirmation
      const msg: string = err?.response?.data?.error ?? '';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning('PO draft saved. DB submission pending (SP not yet deployed).');
        fetchDrafts();
      } else {
        toast.error('Failed to generate PO');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Load a draft into the form ─────────────────────────────────────────────

  const handleLoadDraft = (draft: PODraft) => {
    const pr: PRRecord = { ...draft.pr_summary, items: draft.items.map((i) => ({
      prod_name: i.prod_name, unit_name: i.unit_name, quantity: i.quantity, est_cost: i.unit_price,
    })) };
    setSelectedPR(pr);
    setVendor(draft.vendor);
    setPoDetails(draft.po_details);
    setPoItems(draft.items);
    setShowDrafts(false);
    toast.info('Draft loaded into form');
  };

  // ── PR status counts ───────────────────────────────────────────────────────

  const pendingCount = prList.filter((p) => {
    const s = (p.status ?? '').toLowerCase();
    return s.includes('submit') || s.includes('pending') || s.includes('review') || s.includes('approval');
  }).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* ── Page Header ── */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <ShoppingCart className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Store PO Generation</h1>
            <p className="text-sm text-gray-500">Generate purchase orders from approved / pending PRs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDrafts(true)}>
            <ClipboardList size={16} className="mr-1" />
            PO Drafts {drafts.length > 0 && <Badge className="ml-1 bg-blue-100 text-blue-700 border-0">{drafts.length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPRs} disabled={loadingPR}>
            <RefreshCw size={16} className={loadingPR ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* ── Body: Split panel ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT: PR List ── */}
        <div className="w-80 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
          {/* Summary strip */}
          <div className="px-4 py-3 border-b bg-gray-50 flex gap-3 text-xs font-medium">
            <span className="text-gray-500">{prList.length} total</span>
            <span className="text-amber-600">{pendingCount} pending</span>
          </div>

          {/* Filters */}
          <div className="px-3 py-2 border-b space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search PR no, company…"
                value={searchPR}
                onChange={(e) => setSearchPR(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'pending', 'approved'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab)}
                  className={`flex-1 text-xs py-1 rounded capitalize font-medium border transition-colors ${
                    filterStatus === tab
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* PR cards */}
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
                const { label, color } = prStatus(pr.status);
                const isSelected = selectedPR?.pr_no === pr.pr_no && selectedPR?.pr_id === pr.pr_id;
                const prKey = String(pr.pr_no ?? pr.pr_id ?? idx);
                return (
                  <button
                    key={prKey}
                    onClick={() => handleSelectPR(pr)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-blue-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-blue-700 truncate">
                        {pr.pr_no ?? `PR-${pr.pr_id}`}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
                        {label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 truncate">{pr.com_name}</div>
                    <div className="text-xs text-gray-500 truncate">{pr.dept_name} • {formatDate(pr.request_date ?? pr.req_date)}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{(pr.items as PRItem[])?.length ?? 0} items</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: PO Form ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!selectedPR ? (
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-400">
              <div className="bg-gray-100 p-6 rounded-full">
                <ShoppingCart size={40} />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Select a Purchase Requisition</p>
                <p className="text-sm mt-1">Click a PR from the left panel to generate a Store PO</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── PR Summary (read-only) ── */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      PR Reference
                    </CardTitle>
                    <Badge className={`text-xs border ${prStatus(selectedPR.status).color}`}>
                      {prStatus(selectedPR.status).label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">PR Number</p>
                      <p className="font-semibold text-blue-700">{selectedPR.pr_no ?? `PR-${selectedPR.pr_id}`}</p>
                    </div>
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
                      <p className="text-xs text-gray-500 font-medium">Request Date</p>
                      <p className="font-medium">{formatDate(selectedPR.request_date ?? selectedPR.req_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Required By</p>
                      <p className="font-medium">{formatDate(selectedPR.required_date ?? selectedPR.req_by_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Priority</p>
                      <p className="font-medium">{selectedPR.priority_name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Purpose</p>
                      <p className="font-medium truncate" title={selectedPR.purpose}>{selectedPR.purpose ?? '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Vendor Details ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 size={16} className="text-green-600" />
                    Vendor / Supplier Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Vendor Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={vendor.vendor_name}
                        onChange={(e) => setVendor((v) => ({ ...v, vendor_name: e.target.value }))}
                        placeholder="e.g. ABC Suppliers Pvt Ltd"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Contact Person</Label>
                      <Input
                        value={vendor.contact_person}
                        onChange={(e) => setVendor((v) => ({ ...v, contact_person: e.target.value }))}
                        placeholder="e.g. Ravi Kumar"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Email</Label>
                      <Input
                        type="email"
                        value={vendor.email}
                        onChange={(e) => setVendor((v) => ({ ...v, email: e.target.value }))}
                        placeholder="vendor@example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Phone</Label>
                      <Input
                        value={vendor.phone}
                        onChange={(e) => setVendor((v) => ({ ...v, phone: e.target.value }))}
                        placeholder="+91-XXXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-medium">Vendor Address</Label>
                      <Textarea
                        value={vendor.address}
                        onChange={(e) => setVendor((v) => ({ ...v, address: e.target.value }))}
                        placeholder="Full vendor address"
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── PO Details ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calendar size={16} className="text-purple-600" />
                    PO Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">PO Date</Label>
                      <Input
                        type="date"
                        value={poDetails.po_date}
                        onChange={(e) => setPoDetails((d) => ({ ...d, po_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Expected Delivery Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={poDetails.delivery_date}
                        onChange={(e) => setPoDetails((d) => ({ ...d, delivery_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Payment Terms</Label>
                      <Select
                        value={poDetails.payment_terms}
                        onValueChange={(val) => setPoDetails((d) => ({ ...d, payment_terms: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Shipping Address</Label>
                      <Input
                        value={poDetails.shipping_address}
                        onChange={(e) => setPoDetails((d) => ({ ...d, shipping_address: e.target.value }))}
                        placeholder="Delivery address"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-medium">Notes / Remarks</Label>
                      <Textarea
                        value={poDetails.notes}
                        onChange={(e) => setPoDetails((d) => ({ ...d, notes: e.target.value }))}
                        placeholder="Special instructions, quality requirements…"
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Items Table ── */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package size={16} className="text-orange-600" />
                      Order Items
                      <span className="text-xs font-normal text-gray-400">(pre-filled from PR — enter unit price &amp; tax)</span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {poItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No items in this PR</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs w-8">#</TableHead>
                            <TableHead className="text-xs">Item / Product</TableHead>
                            <TableHead className="text-xs text-center w-28">Qty</TableHead>
                            <TableHead className="text-xs text-center w-24">Unit</TableHead>
                            <TableHead className="text-xs text-right w-36">Unit Price (₹) <span className="text-red-500">*</span></TableHead>
                            <TableHead className="text-xs text-right w-28">Tax %</TableHead>
                            <TableHead className="text-xs text-right w-36">Total (₹)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {poItems.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-gray-50">
                              <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                              <TableCell>
                                <Input
                                  value={item.prod_name}
                                  onChange={(e) => updateItem(idx, 'prod_name', e.target.value)}
                                  className="h-8 text-sm border-0 bg-transparent hover:bg-white hover:border focus:border p-1"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                  className="h-8 text-sm text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.unit_name}
                                  onChange={(e) => updateItem(idx, 'unit_name', e.target.value)}
                                  className="h-8 text-sm text-center border-0 bg-transparent hover:bg-white hover:border focus:border p-1"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.unit_price || ''}
                                  onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                                  placeholder="0"
                                  className={`h-8 text-sm text-right ${item.unit_price <= 0 ? 'border-amber-400 bg-amber-50' : ''}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={item.tax_rate || ''}
                                  onChange={(e) => updateItem(idx, 'tax_rate', e.target.value)}
                                  placeholder="0"
                                  className="h-8 text-sm text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatINR(item.quantity * item.unit_price * (1 + item.tax_rate / 100))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Totals + Actions ── */}
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {/* Totals */}
                <Card className="flex-1">
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-sm max-w-xs ml-auto">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span className="font-medium">{formatINR(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Total Tax</span>
                        <span className="font-medium">{formatINR(taxTotal)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base font-bold">
                        <span>Grand Total</span>
                        <span className="text-blue-700">{formatINR(grandTotal)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="flex gap-3 md:flex-col">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting}
                    className="flex items-center gap-2"
                  >
                    {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Draft
                  </Button>
                  <Button
                    onClick={handleGeneratePO}
                    disabled={savingDraft || submitting}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Generate PO
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedPR(null)}
                    className="flex items-center gap-2 text-gray-500"
                  >
                    <X size={16} />
                    Clear
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PO Drafts Dialog ── */}
      <Dialog open={showDrafts} onOpenChange={setShowDrafts}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList size={18} />
              Saved PO Drafts
            </DialogTitle>
          </DialogHeader>

          {drafts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
              <ClipboardList size={32} />
              <p className="text-sm">No saved PO drafts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <Card key={draft.draftId} className="border hover:shadow-sm transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-blue-700">{draft.pr_no || 'No PR Ref'}</span>
                          <Badge variant="outline" className="text-xs">{draft.status ?? 'Draft'}</Badge>
                        </div>
                        <p className="text-gray-600">Vendor: <span className="font-medium">{draft.vendor?.vendor_name || '—'}</span></p>
                        <p className="text-gray-500 text-xs">
                          {draft.items?.length ?? 0} items · Grand Total: {formatINR(draft.grand_total ?? 0)}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Saved: {formatDate(draft.savedAt)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleLoadDraft(draft)}>
                        Load
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDrafts(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorePOGeneratePage;
