import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
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

  // ── State ──────────────────────────────────────────────────────────────────

  // PR List
  const [prList, setPrList] = useState<PRRecord[]>([]);
  const [loadingPR, setLoadingPR] = useState(false);
  const [selectedPR, setSelectedPR] = useState<PRRecord | null>(null);

  // Step 1 — PO Confirmation
  const [confirmedData, setConfirmedData] = useState<POConfirmationData | null>(null);
  const [savingConfirm, setSavingConfirm] = useState(false);
  const [editingConfirm, setEditingConfirm] = useState(false); // true = show edit form even if confirmed

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Quotations for selected PR
  const [existingQuotations, setExistingQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

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

  // ── Fetchers ───────────────────────────────────────────────────────────────

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

      setExistingQuotations(quotations);
    } catch {
      toast.error('Failed to load quotations');
    } finally {
      setLoadingQuotations(false);
    }
  }, []);

  /** Fetch existing PO confirmation for a PR (if already saved) */
  // const fetchPOConfirmation = useCallback(async (prBasicSno: number) => {
  //   try {
  //     const res = await axios.get(purchaseTeamGetPOConfirmation(prBasicSno), { withCredentials: true });
  //     const data = res.data?.decrypted?.data ?? res.data?.data ?? null;
  //     if (data && data.pr_basic_sno) {
  //       setConfirmedData(data);
  //       setEditingConfirm(false);
  //     } else {
  //       setConfirmedData(null);
  //     }
  //   } catch {
  //     // Not found = no confirmation yet; that's fine
  //     setConfirmedData(null);
  //   }
  // }, []);

  useEffect(() => { fetchPRs(); fetchVendors(); }, [fetchPRs, fetchVendors]);

  // useEffect(() => {
  //   if (selectedPR?.pr_basic_sno) {
  //     fetchQuotations(selectedPR.pr_basic_sno);
  //     fetchPOConfirmation(selectedPR.pr_basic_sno);
  //   } else {
  //     setExistingQuotations([]);
  //     setConfirmedData(null);
  //   }
  // }, [selectedPR?.pr_basic_sno, fetchQuotations, fetchPOConfirmation]);

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
    setSavingConfirm(true);
    try {
      await axios.post(purchaseTeamSavePOConfirmation, data, { withCredentials: true });
      setConfirmedData(data);
      setEditingConfirm(false);
      toast.success('PO details confirmed. You can now select a supplier and add quotations.');
    } catch (err: any) {
      console.log('Error saving PO confirmation', err);
      const msg = err?.response?.data?.error ?? 'Failed to save PO confirmation';
      if (msg.toLowerCase().includes('database error')) {
        // SP not deployed yet — still let UX advance so team can continue
        toast.warning('Confirmation recorded locally. SP may not be deployed yet.');
        setConfirmedData(data);
        setEditingConfirm(false);
      } else {
        toast.error(msg);
      }
    } finally {
      setSavingConfirm(false);
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
      // Filter items for this specific split group (0 = ungrouped / main PO)
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
    console.log('render', selectedPR);


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
      await axios.post(purchaseTeamCreateQuotation, {
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
      if (prBasicSno) fetchQuotations(prBasicSno);
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
      await axios.post(purchaseTeamSelectQuotation, { selectedQuotation: q }, { withCredentials: true });
      toast.success('Quotation selected');
      if (selectedPR?.pr_basic_sno) fetchQuotations(selectedPR.pr_basic_sno);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to select quotation');
    }
  };

  const handleOpenCreatePO = (q: Quotation) => {
    setSelectedQuotation(q);
    setShowPOConfirm(true);
  };

  const handleCreatePO = async (poForm: POFormState) => {
    if (!selectedQuotation) return;
    if (!poForm.required_date) { toast.error('Required date is needed'); return; }

    const basePR = selectedPR ?? (poGroups.length > 0
      ? prList.find(p => p.pr_basic_sno === poGroups[0].sourcePRs[0])
      : null);
    if (!basePR) { toast.error('No PR context found'); return; }

    // Prefer confirmed billing org over PR org
    const billingComSno = confirmedData?.billing_com_sno ?? basePR.com_sno;
    const billingDivSno = confirmedData?.billing_div_sno ?? basePR.div_sno;
    const billingBrnSno = confirmedData?.billing_brn_sno ?? basePR.brn_sno;

    try {
      if (poGroups.length > 1) {
        let splitIdx = 1;
        for (const group of poGroups) {
          const groupPR = prList.find(p => p.pr_basic_sno === group.sourcePRs[0]) ?? basePR;
          await axios.post(purchaseTeamCreatePO, {
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
        await axios.post(purchaseTeamCreatePO, {
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

      setShowPOConfirm(false);
      setSelectedQuotation(null);
      setPOGroups([]);
      fetchPRs();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create PO';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning('PO data prepared. SP may not be deployed yet.');
      } else {
        toast.error(msg);
      }
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
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ClipboardCheck className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Team</h1>
            <p className="text-sm text-gray-500">Confirm PO details, split PRs, assign suppliers, manage quotations</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchPRs(); fetchVendors(); }} disabled={loadingPR}>
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
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-400">
              <div className="bg-gray-100 p-6 rounded-full">
                <ClipboardCheck size={40} />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Select a Purchase Requisition</p>
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
                    onOpenQuotation={handleOpenQuotation}
                    onSelectQuotation={handleSelectQuotation}
                    onCreatePO={handleOpenCreatePO}
                    onCompare={() => setShowCompareDialog(true)}
                    onRefreshQuotations={() => {
                      const sno = selectedPR?.pr_basic_sno ?? poGroups[0]?.sourcePRs[0];
                      if (sno) fetchQuotations(sno);
                    }}
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
        onOpenChange={setShowPOConfirm}
        selectedPR={selectedPR}
        selectedQuotation={selectedQuotation}
        onCreatePO={handleCreatePO}
      />
    </div>
  );
};

export default PurchaseTeamPage;
