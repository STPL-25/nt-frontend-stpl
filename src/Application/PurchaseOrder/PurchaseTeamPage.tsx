import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, ClipboardCheck, Scissors, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import {
  purchaseTeamGetApprovedPRs,
  purchaseTeamGetVendors,
  purchaseTeamCreateQuotation,
  purchaseTeamGetQuotations,
  purchaseTeamSelectQuotation,
  purchaseTeamCreatePO,
  purchaseTeamSavePOConfirmation,
  purchaseTeamGetPOConfirmation,
} from '@/Services/Api';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';

import type {
  PRRecord, PRItem, Vendor, Quotation, QuotationItem,
  QuotationFormState, POFormState, POGroup, POConfirmationData, POConfirmItem,
} from './PurchaseTeam/types';
import {
  normalisePRRows, extractQuotationItems, getPRDisplayNo,
} from './PurchaseTeam/helpers';

import PRListSidebar from './PurchaseTeam/PRListSidebar';
import POConfirmStep from './PurchaseTeam/POConfirmStep';
import QuotationsTab from './PurchaseTeam/QuotationsTab';
import SplitPRTab from './PurchaseTeam/SplitPRTab';
import QuotationDialog from './PurchaseTeam/QuotationDialog';
import CompareDialog from './PurchaseTeam/CompareDialog';
import CreatePODialog from './PurchaseTeam/CreatePODialog';

// ── Component ────────────────────────────────────────────────────────────────

const PurchaseTeamPage: React.FC = () => {
  useAppState(); // keep for auth context + hierarchy prefetch
  const { canCreate, canEdit } = usePermissions();

  // ── Refresh keys ──────────────────────────────────────────────────────────
  const [prRefreshKey, setPrRefreshKey] = useState(0);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);
  const [quotationsRefreshKey, setQuotationsRefreshKey] = useState(0);

  // ── State ──────────────────────────────────────────────────────────────────

  const [selectedPR, setSelectedPR] = useState<PRRecord | null>(null);

  // Step 1 — PO Confirmation
  const [confirmedData, setConfirmedData] = useState<POConfirmationData | null>(null);
  const [editingConfirm, setEditingConfirm] = useState(false);

  // Quotation dialog
  const [showQuotationDialog, setShowQuotationDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [quotationSplitGroup, setQuotationSplitGroup] = useState<number | undefined>(undefined);

  // Compare dialog
  const [showCompareDialog, setShowCompareDialog] = useState(false);

  // Create PO dialog
  const [showPOConfirm, setShowPOConfirm] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  // Split section state
  const [splitOpen, setSplitOpen] = useState(false);
  const [poGroups, setPOGroups] = useState<POGroup[]>([]);

  // ── Fetch hooks ────────────────────────────────────────────────────────────

  const { data: prRaw, loading: loadingPR } = useFetch(
    purchaseTeamGetApprovedPRs, '', null, prRefreshKey,
  );

  const { data: vendorsRaw, loading: loadingVendors } = useFetch(
    purchaseTeamGetVendors, '', null, vendorRefreshKey,
  );

  const quotationsUrl = selectedPR?.pr_basic_sno
    ? purchaseTeamGetQuotations(selectedPR.pr_basic_sno)
    : null;
  const { data: quotationsRaw, loading: loadingQuotations } = useFetch(
    quotationsUrl, '', null, quotationsRefreshKey,
  );

  const poConfirmUrl = selectedPR?.pr_basic_sno
    ? purchaseTeamGetPOConfirmation(selectedPR.pr_basic_sno)
    : null;
  const { data: poConfirmRaw } = useFetch(poConfirmUrl);

  // ── Post hooks ────────────────────────────────────────────────────────────

  const { postData: postPOConfirmation, loading: savingConfirm } = usePost();
  const { postData: postQuotation } = usePost();
  const { postData: postSelectQuotation } = usePost();
  const { postData: postCreatePO } = usePost();

  // ── Derived data ───────────────────────────────────────────────────────────

  const prList = useMemo<PRRecord[]>(() => {
    const rows: PRRecord[] = (prRaw as any)?.decrypted?.data ?? (prRaw as any)?.data ?? [];
    return normalisePRRows(rows);
  }, [prRaw]);

  const vendors = useMemo<Vendor[]>(() => {
    return (vendorsRaw as any)?.decrypted?.data ?? (vendorsRaw as any)?.data ?? [];
  }, [vendorsRaw]);

  const existingQuotations = useMemo<Quotation[]>(() => {
    const raw: any[] = (quotationsRaw as any)?.decrypted?.data ?? (quotationsRaw as any)?.data ?? [];
    return raw.map((row: any) => {
      let parsedItems: QuotationItem[] = [];
      if (row.sq_items) {
        try {
          const sqItems: any[] = typeof row.sq_items === 'string' ? JSON.parse(row.sq_items) : row.sq_items;
          parsedItems = sqItems.map((it: any) => ({
            pr_item_sno: it.pr_item_sno,
            prod_sno: it.prod_sno,
            prod_name: it.prod_name ?? it.item_name ?? '',
            specification: it.specification ?? '',
            qty: Number(it.qty ?? it.quantity ?? it.req_qty ?? 0),
            unit: it.unit ?? it.uom_sno ?? it.unit_sno ?? 0,
            unit_name: it.unit_name ?? it.uom_name ?? it.uom_code ?? '',
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
        split_group: row.split_group ?? undefined,
      } as Quotation;
    });
  }, [quotationsRaw]);

  // Sync PO confirmation data from fetch result
  useEffect(() => {
    if (!poConfirmRaw) return;
    const data = (poConfirmRaw as any)?.decrypted?.data ?? (poConfirmRaw as any)?.data ?? null;
    if (data?.pr_basic_sno) {
      setConfirmedData(data);
      setEditingConfirm(false);
    } else {
      setConfirmedData(null);
    }
  }, [poConfirmRaw]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectPR = (pr: PRRecord) => {
    setSelectedPR(pr);
    setPOGroups([]);
    setSplitOpen(false);
    setConfirmedData(null);
    setEditingConfirm(false);
  };

  // ── Step 1: PO Confirmation ────────────────────────────────────────────────

  const handlePOConfirmed = async (data: POConfirmationData) => {
    try {
      await postPOConfirmation(purchaseTeamSavePOConfirmation, data, { withCredentials: true });
      setConfirmedData(data);
      setEditingConfirm(false);
      toast.success('PO details confirmed. You can now select a supplier and add quotations.');
    } catch (err: any) {
      const status = err?.response?.status;
      // 401 = session expired; global interceptor in main.tsx already redirects to login
      if (status === 401) return;
      const msg = err?.response?.data?.error ?? 'Failed to save PO confirmation';
      if (msg.toLowerCase().includes('database error')) {
        // SP not deployed yet — still let UX advance so team can continue
        toast.warning('Confirmation recorded locally. SP may not be deployed yet.');
        setConfirmedData(data);
        setEditingConfirm(false);
      } else {
        toast.error(msg);
      }
    }
  };

  // ── Split ──────────────────────────────────────────────────────────────────

  const handleSplitConfirmed = (groups: POGroup[]) => {
    setPOGroups(groups);
    setSplitOpen(false);
    toast.success(`${groups.length} split group(s) confirmed.`);
  };

  const handleClearSplit = () => {
    setPOGroups([]);
    setSplitOpen(false);
    toast.info('Split cleared');
  };

  // ── Quotation handlers ────────────────────────────────────────────────────

  // splitGroup: undefined = main/all items, 0 = ungrouped items only, N = specific group N
  const handleOpenQuotation = (vendor: Vendor, splitGroup?: number) => {
    if (!selectedPR && poGroups.length === 0) { toast.error('Select a PR first'); return; }
    setSelectedVendor(vendor);
    setQuotationSplitGroup(splitGroup);

    const toQuotItem = (it: POConfirmItem): QuotationItem => ({
      pr_item_sno: it.pr_item_sno,
      prod_sno: it.prod_sno,
      prod_name: it.prod_name,
      specification: it.specification,
      qty: it.qty,
      unit: it.unit,
      unit_name: it.unit_name,
      unit_price: 0, discount_pct: 0, tax_pct: 0,
      total_amount: 0, delivery_days: 0, remarks: '',
    });

    if (splitGroup !== undefined && confirmedData?.items?.length) {
      const groupItems = splitGroup === 0
        ? confirmedData.items.filter(it => !it.split_group)
        : confirmedData.items.filter(it => it.split_group === splitGroup);
      setQuotationItems(groupItems.map(toQuotItem));
    } else if (poGroups.length > 0) {
      const targetGroup = poGroups.find(
        g => g.vendorSno === (vendor.kyc_basic_info_sno ?? vendor.vendor_sno)
      ) ?? poGroups[0];
      setQuotationItems(targetGroup.items.map(it => ({
        pr_item_sno: it.pr_item_sno, prod_sno: it.prod_sno,
        prod_name: it.prod_name, specification: it.specification,
        qty: it.qty, unit: it.unit, unit_name: it.unit_name,
        unit_price: 0, discount_pct: 0, tax_pct: 0,
        total_amount: 0, delivery_days: 0, remarks: '',
      })));
    } else if (selectedPR) {
      if (confirmedData?.items?.length) {
        setQuotationItems(confirmedData.items.map(toQuotItem));
      } else {
        setQuotationItems(extractQuotationItems(selectedPR));
      }
    }

    setShowQuotationDialog(true);
  };

  const handleSubmitQuotation = async (form: QuotationFormState, items: QuotationItem[]) => {
    if (!selectedPR && poGroups.length === 0) return;
    if (!selectedVendor) return;
    if (!form.quotation_ref_no.trim()) { toast.error('Quotation reference number required'); return; }
    if (!form.valid_upto) { toast.error('Valid upto date required'); return; }
    if (items.length === 0) { toast.error('Select at least one item for this quotation'); return; }
    if (items.some(it => it.unit_price <= 0)) { toast.error('Enter unit price for all selected items'); return; }

    const prBasicSno = selectedPR?.pr_basic_sno ?? poGroups[0]?.sourcePRs[0];
    if (!prBasicSno) return;

    try {
      await postQuotation(purchaseTeamCreateQuotation, {
        pr_basic_sno: prBasicSno,
        vendor_sno: selectedVendor.kyc_basic_info_sno ?? selectedVendor.vendor_sno,
        ...form,
        items,
        ...(quotationSplitGroup !== undefined && { split_group: quotationSplitGroup }),
        ...(poGroups.length > 0 && {
          source_pr_basic_snos: poGroups.flatMap(g => g.sourcePRs),
          po_group_id: poGroups[0]?.id,
        }),
      }, { withCredentials: true });

      toast.success('Supplier quotation created');
      setShowQuotationDialog(false);
      setQuotationsRefreshKey(k => k + 1);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create quotation';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning('Quotation data recorded. SP may not be deployed yet.');
      } else {
        toast.error(msg);
      }
    }
  };

  const handleSelectQuotation = async (q: Quotation) => {
    if (!q.sq_basic_sno) return;
    try {
      await postSelectQuotation(purchaseTeamSelectQuotation, { selectedQuotation: q }, { withCredentials: true });
      toast.success('Quotation selected');
      setQuotationsRefreshKey(k => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to select quotation');
    }
  };

  const handleOpenCreatePO = async (q: Quotation) => {
    if (!q.sq_basic_sno) {
      toast.error('Save the quotation before generating a PO');
      return;
    }

    try {
      if (q.is_selected !== 'Y') {
        await postSelectQuotation(purchaseTeamSelectQuotation, { selectedQuotation: q }, { withCredentials: true });
        setQuotationsRefreshKey(k => k + 1);
      }
      setSelectedQuotation({ ...q, is_selected: 'Y' });
      setShowPOConfirm(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to select quotation for PO');
    }
  };

  const handleClosePODialog = (open: boolean) => {
    setShowPOConfirm(open);
    if (!open) {
      setSelectedQuotation(null);
      setPOGroups([]);
    }
  };

  const handleCreatePO = async (poForm: POFormState) => {
    if (!selectedQuotation) throw new Error('No quotation selected');
    if (!poForm.required_date) { toast.error('Required date is needed'); throw new Error('Required date is needed'); }

    const basePR = selectedPR ?? (poGroups.length > 0
      ? prList.find(p => p.pr_basic_sno === poGroups[0].sourcePRs[0])
      : null);
    if (!basePR) { toast.error('No PR context found'); throw new Error('No PR context found'); }

    const billingComSno = confirmedData?.billing_com_sno ?? basePR.com_sno;
    const billingDivSno = confirmedData?.billing_div_sno ?? basePR.div_sno;
    const billingBrnSno = confirmedData?.billing_brn_sno ?? basePR.brn_sno;

    try {
      if (poGroups.length > 1) {
        let splitIdx = 1;
        for (const group of poGroups) {
          const groupPR = prList.find(p => p.pr_basic_sno === group.sourcePRs[0]) ?? basePR;
          await postCreatePO(purchaseTeamCreatePO, {
            pr_basic_sno: groupPR.pr_basic_sno,
            sq_basic_sno: selectedQuotation.sq_basic_sno,
            vendor_sno: group.vendorSno ?? selectedQuotation.vendor_sno,
            com_sno: billingComSno,
            div_sno: billingDivSno,
            brn_sno: billingBrnSno,
            dept_sno: groupPR.dept_sno,
            budget_sno: groupPR.budget_sno,
            budget_code: groupPR.budget_code,
            priority_sno: groupPR.priority_sno,
            ...poForm,
            split_pr_no: `${getPRDisplayNo(groupPR)}/${splitIdx}`,
            items: selectedQuotation.items.filter(qi =>
              group.items.some(gi => gi.pr_item_sno === qi.pr_item_sno || gi.prod_name === qi.prod_name)
            ),
          }, { withCredentials: true });
          splitIdx++;
        }
        toast.success(`${poGroups.length} PO(s) created from split groups!`);
      } else {
        await postCreatePO(purchaseTeamCreatePO, {
          pr_basic_sno: basePR.pr_basic_sno,
          sq_basic_sno: selectedQuotation.sq_basic_sno,
          vendor_sno: selectedQuotation.vendor_sno,
          com_sno: billingComSno,
          div_sno: billingDivSno,
          brn_sno: billingBrnSno,
          dept_sno: basePR.dept_sno,
          budget_sno: basePR.budget_sno,
          budget_code: basePR.budget_code,
          priority_sno: basePR.priority_sno,
          ...poForm,
          items: selectedQuotation.items,
        }, { withCredentials: true });
        toast.success('Purchase Order created successfully!');
      }

      // Keep dialog open so user can download the PDF; refresh PR list in background
      setPrRefreshKey(k => k + 1);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create PO';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning('PO data prepared. SP may not be deployed yet.');
      } else {
        toast.error(msg);
      }
      throw err;
    }
  };

  // ── Confirmed split groups (derived from confirmedData items) ────────────
  const confirmedSplitGroups = useMemo(() => {
    if (!confirmedData?.items?.length) return [];
    const map = new Map<number, POConfirmItem[]>();
    confirmedData.items.forEach(item => {
      if (item.split_group) {
        if (!map.has(item.split_group)) map.set(item.split_group, []);
        map.get(item.split_group)!.push(item);
      }
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([groupNum, items]) => ({ groupNum, items }));
  }, [confirmedData]);

  // ── Whether Step 2 (supplier/quotation) is unlocked ───────────────────────
  const isStep2Unlocked = !!confirmedData && !editingConfirm;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-screen">
      {/* Page Header */}
      <div className="bg-background border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Purchase Team</h1>
            <p className="text-xs text-muted-foreground">Confirm PO details, split PRs, assign suppliers, manage quotations</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setPrRefreshKey(k => k + 1); setVendorRefreshKey(k => k + 1); }}
          disabled={loadingPR}
        >
          <RefreshCw size={16} className={loadingPR ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT: PR List Sidebar */}
        <PRListSidebar
          prList={prList}
          loading={loadingPR}
          selectedPR={selectedPR}
          onSelectPR={handleSelectPR}
        />

        {/* RIGHT: Single scrollable flow */}
        <div className="flex-1 overflow-y-auto">
          {!selectedPR ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 text-muted-foreground">
              <div className="bg-muted rounded-full p-6">
                <ClipboardCheck size={40} className="opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-foreground/60">Select a Purchase Requisition</p>
                <p className="text-sm mt-1">Choose a PR from the left panel to get started</p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-4">

              {/* ── Step indicator ───────────────────────────────────────── */}
              <div className="flex items-center gap-3 text-xs">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium
                  ${isStep2Unlocked
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  }`}>
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold
                    ${isStep2Unlocked ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
                    {isStep2Unlocked ? '✓' : '1'}
                  </span>
                  Confirm PO Details
                </div>
                <div className="h-px w-6 bg-gray-300" />
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium
                  ${isStep2Unlocked
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold
                    ${isStep2Unlocked ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    2
                  </span>
                  Supplier &amp; Quotation
                </div>
              </div>

              {/* ── Section 1: PO Confirmation ───────────────────────────── */}
              <POConfirmStep
                key={selectedPR.pr_basic_sno}
                selectedPR={selectedPR}
                onConfirmed={handlePOConfirmed}
                saving={savingConfirm}
                confirmedData={editingConfirm ? null : confirmedData}
                onEditConfirm={() => setEditingConfirm(true)}
              />

              {/* ── Sections below are locked until Step 1 is saved ──────── */}
              {!isStep2Unlocked && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-400">
                  Complete Step 1 to unlock supplier selection and quotation management.
                </div>
              )}

              {isStep2Unlocked && (
                <>
                  {/* ── Section 2: Split PR (collapsible) ─────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Scissors size={16} className="text-indigo-600" />
                          Split PR
                          <span className="text-xs font-normal text-gray-400">(optional)</span>
                          {poGroups.length > 0 && (
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-200 ml-1">
                              {poGroups.length} groups confirmed
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {poGroups.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-500 h-7 px-2"
                              onClick={handleClearSplit}
                            >
                              <X size={12} className="mr-1" /> Clear
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setSplitOpen(v => !v)}
                          >
                            {splitOpen
                              ? <><ChevronUp size={13} className="mr-1" /> Collapse</>
                              : <><ChevronDown size={13} className="mr-1" />{poGroups.length > 0 ? 'Modify Split' : 'Split this PR'}</>
                            }
                          </Button>
                        </div>
                      </div>

                      {/* Summary when collapsed and split confirmed */}
                      {!splitOpen && poGroups.length > 0 && (
                        <div className="space-y-1.5 mt-3">
                          {poGroups.map((g, idx) => (
                            <div key={g.id} className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 rounded p-2">
                              <Badge className="bg-indigo-600 text-white border-none shrink-0">
                                {getPRDisplayNo(selectedPR)}/{idx + 1}
                              </Badge>
                              <span className="font-medium text-gray-800">
                                {g.vendorName ?? <span className="text-amber-600 italic">No vendor assigned</span>}
                              </span>
                              <span className="text-gray-400 ml-auto">{g.items.length} item(s)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardHeader>

                    {splitOpen && (
                      <CardContent className="pt-0">
                        <SplitPRTab
                          selectedPR={selectedPR}
                          vendors={vendors}
                          loadingVendors={loadingVendors}
                          onSplitConfirmed={handleSplitConfirmed}
                        />
                      </CardContent>
                    )}
                  </Card>

                  {/* ── Section 3: Supplier & Quotation ───────────────────── */}
                  <QuotationsTab
                    selectedPR={selectedPR}
                    vendors={vendors}
                    loadingVendors={loadingVendors}
                    existingQuotations={existingQuotations}
                    loadingQuotations={loadingQuotations}
                    onOpenQuotation={canCreate("PurchaseTeamPage") ? handleOpenQuotation : undefined}
                    onSelectQuotation={handleSelectQuotation}
                    onCreatePO={canCreate("PurchaseTeamPage") || canEdit("PurchaseTeamPage") ? handleOpenCreatePO : undefined}
                    onCompare={() => setShowCompareDialog(true)}
                    onRefreshQuotations={() => setQuotationsRefreshKey(k => k + 1)}
                    poGroups={poGroups}
                    confirmedSplitGroups={confirmedSplitGroups}
                  />
                </>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <QuotationDialog
        open={showQuotationDialog}
        onOpenChange={setShowQuotationDialog}
        quotationItems={quotationItems}
        onSubmit={handleSubmitQuotation}
      />

      <CompareDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        quotations={existingQuotations}
        selectedPR={selectedPR}
      />

      <CreatePODialog
        open={showPOConfirm}
        onOpenChange={handleClosePODialog}
        selectedPR={selectedPR}
        selectedQuotation={selectedQuotation}
        onCreatePO={handleCreatePO}
      />
    </div>
  );
};

export default PurchaseTeamPage;
