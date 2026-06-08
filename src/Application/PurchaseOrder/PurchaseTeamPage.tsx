import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, ClipboardCheck, Scissors, Menu,
} from 'lucide-react';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';
import {
  purchaseTeamGetApprovedPRs,
  purchaseTeamGetVendors,
  purchaseTeamCreateQuotation,
  purchaseTeamGetQuotations,
  purchaseTeamSelectQuotation,
  purchaseTeamCreatePO,
  purchaseTeamGetPOConfirmation,
  purchaseTeamSaveSplitGroup,
  purchaseTeamGetSplitGroups,
} from '@/Services/Api';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { encryptFormMeta } from '@/Services/apiCrypto';
import {
  socket,
  SOCKET_JOIN_PURCHASE_TEAM,
  SOCKET_LEAVE_PURCHASE_TEAM,
  SOCKET_PT_SPLIT_UPDATED,
} from '@/Services/Socket';
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
  useAppState(); // auth context + hierarchy prefetch side-effect
  const { canCreate, canEdit } = usePermissions();

  // Live split-group count per PR (pr_basic_sno → number of split POs). Kept in
  // sync by calling the (uncached) getSplitGroups API on every split.
  const [splitInfo, setSplitInfo] = useState<Record<number, number>>({});

  // Pull the authoritative split-group count for a PR from the server. The GET
  // route is intentionally uncached so this always reflects the latest save.
  const refreshSplitInfo = useCallback(async (prSno?: number) => {
    if (!prSno) return;
    try {
      const res = await axios.get(purchaseTeamGetSplitGroups(prSno), { withCredentials: true });
      const rows: any[] = res.data?.decrypted?.data ?? res.data?.data ?? [];
      if (!Array.isArray(rows) || rows.length === 0) return; // keep optimistic value
      const groups = new Set<number>();
      rows.forEach((r) => {
        const g = Number(r.group_no ?? r.split_group ?? r.groupNo ?? 0);
        if (g > 0) groups.add(g);
      });
      setSplitInfo((prev) => ({ ...prev, [prSno]: groups.size }));
    } catch {
      /* network/SP error — leave the optimistic badge in place */
    }
  }, []);

  // ── Refresh keys ──────────────────────────────────────────────────────────
  const [prRefreshKey, setPrRefreshKey] = useState(0);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);
  const [quotationsRefreshKey, setQuotationsRefreshKey] = useState(0);

  // ── State ──────────────────────────────────────────────────────────────────

  const [selectedPR, setSelectedPR] = useState<PRRecord | null>(null);
  const selectedPRRef = useRef<PRRecord | null>(null);
  useEffect(() => { selectedPRRef.current = selectedPR; }, [selectedPR]);

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

  // Split section state — poGroups retained for the legacy multi-PO create path
  const [poGroups, setPOGroups] = useState<POGroup[]>([]);

  // ── Fetch hooks ────────────────────────────────────────────────────────────

  const { data: prRaw, loading: loadingPR } = useFetch(
    purchaseTeamGetApprovedPRs, '', null, prRefreshKey,
  );

  const { data: vendorsRaw, loading: loadingVendors } = useFetch(
    purchaseTeamGetVendors, '', null, vendorRefreshKey,
  );

  console.log('Selected PR for quotations:', selectedPR);
  const quotationsUrl = selectedPR?.pr_basic_sno
    ? purchaseTeamGetQuotations(selectedPR.pr_basic_sno, btoa(selectedPR.pr_no ?? ""))
    : null;
  const { data: quotationsRaw, loading: loadingQuotations } = useFetch(
    quotationsUrl, '', null, quotationsRefreshKey,
  );

  const poConfirmUrl = selectedPR?.pr_basic_sno
    ? purchaseTeamGetPOConfirmation(selectedPR.pr_basic_sno)
    : null;
  const { data: poConfirmRaw } = useFetch(poConfirmUrl);

  // ── Post hooks ────────────────────────────────────────────────────────────

  const { loading: savingConfirm } = usePost();
  const { postData: postSplitGroup } = usePost();
  const { postData: postQuotation } = usePost();
  const { postData: postSelectQuotation } = usePost();
  const { postData: postCreatePO } = usePost();

  // ── Derived data ───────────────────────────────────────────────────────────

  // PR list is held in state (not a plain useMemo) so the real-time
  // `pt:split:updated` socket event can replace it live with the fresh
  // approvedPRs list the backend pushes after a split is saved.
  const [prList, setPrList] = useState<PRRecord[]>([]);

  useEffect(() => {
    const rows: PRRecord[] = (prRaw as any)?.decrypted?.data ?? (prRaw as any)?.data ?? [];
    const normalised = normalisePRRows(rows);
    setPrList(normalised);
    const current = selectedPRRef.current;
    if (current?.pr_basic_sno) {
      const updated = normalised.find(p => p.pr_basic_sno === current.pr_basic_sno);
      setSelectedPR(updated ?? null);
    }
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
            qty: Number(it.qty ?? it.unit ?? it.quantity ?? it.req_qty ?? 0),
            unit: it.uom_sno ?? it.unit_sno ?? 0,
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

  // ── Real-time: PR split updates on the sidebar ─────────────────────────────
  // Join the purchase-team room and update the per-PR split badge live whenever
  // anyone (this user or a teammate) creates a split group.
  useEffect(() => {
    socket.emit(SOCKET_JOIN_PURCHASE_TEAM);

    // The backend pushes the full, freshly-queried approvedPRs list as
    // { data: approvedPRs } whenever any teammate saves a split group. Replace
    // the sidebar list live so every connected client stays in sync without a
    // manual refresh.
    const onSplitUpdated = (payload: { data?: any[] }) => {
      if (!Array.isArray(payload?.data)) return;
      const normalised = normalisePRRows(payload.data);
      setPrList(normalised);
      const current = selectedPRRef.current;
      if (current?.pr_basic_sno) {
        const updated = normalised.find(p => p.pr_basic_sno === current.pr_basic_sno);
        setSelectedPR(updated ?? null);
      }
      toast.info('Purchase requisitions updated');
    };

    socket.on(SOCKET_PT_SPLIT_UPDATED, onSplitUpdated);

    return () => {
      socket.emit(SOCKET_LEAVE_PURCHASE_TEAM);
      socket.off(SOCKET_PT_SPLIT_UPDATED, onSplitUpdated);
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectPR = (pr: PRRecord) => {
    console.log('Selected PR:', pr);
    setSelectedPR(pr);
    setPOGroups([]);
    setConfirmedData(null);
    setEditingConfirm(false);
  };

  // ── Step 1: PO Confirmation ────────────────────────────────────────────────

  const handlePOConfirmed = (data: POConfirmationData) => {
    setConfirmedData(data);
    setEditingConfirm(false);
    toast.success('PO details confirmed. You can now select a supplier and add quotations.');
  };

  // ── Split group created immediately when user clicks "Create Split Group" ──

  const handleSplitGroupCreated = async (groupNo: number, items: POConfirmItem[]) => {
    if (!selectedPR?.pr_basic_sno) return;

    // Optimistic sidebar badge for the user performing the split (the socket
    // echo confirms it; this avoids waiting on the round-trip).
    const prSno = selectedPR.pr_basic_sno;
    setSplitInfo(prev => ({ ...prev, [prSno]: Math.max(prev[prSno] ?? 0, groupNo) }));

    try {
      await postSplitGroup(purchaseTeamSaveSplitGroup, {
        pr_basic_sno: selectedPR.pr_basic_sno,
        com_sno: selectedPR.com_sno,
        div_sno: selectedPR.div_sno,
        brn_sno: selectedPR.brn_sno,
        dept_sno: selectedPR.dept_sno,
        group_no: groupNo,
        items: items.map(i => ({
          pr_item_sno: i.pr_item_sno,
          prod_sno: i.prod_sno,
          prod_name: i.prod_name,
          qty: i.qty,
          unit: i.unit,
          unit_name: i.unit_name,
   
        })),
      }, { withCredentials: true });
      toast.success(`Split Group ${groupNo} saved`);
      // Call the (uncached) API to confirm the split count from the server.
      refreshSplitInfo(prSno);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to save split group';
      if (msg.toLowerCase().includes('database error')) {
        toast.warning(`Group ${groupNo} recorded locally. SP may not be deployed yet.`);
      } else {
        toast.error(msg);
      }
    }
  };

  // ── Split ──────────────────────────────────────────────────────────────────

  // New checkbox-split flow updates confirmedData.items' split_group flags.
  // This drives `confirmedSplitGroups` → per-PO supplier/quotation panels below.
  const handleSplitChange = (updatedItems: POConfirmItem[]) => {
    setConfirmedData(prev => (prev ? { ...prev, items: updatedItems } : prev));
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
      pr_no:it.pr_no,
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

  const handleSubmitQuotation = async (form: QuotationFormState, items: QuotationItem[], file: File | null) => {
    if (!selectedPR && poGroups.length === 0) return;
    if (!selectedVendor) return;
    if (!form.quotation_ref_no.trim()) { toast.error('Quotation reference number required'); return; }
    if (!form.valid_upto) { toast.error('Valid upto date required'); return; }
    if (items.length === 0) { toast.error('Select at least one item for this quotation'); return; }
    if (items.some(it => it.unit_price <= 0)) { toast.error('Enter unit price for all selected items'); return; }

    const prBasicSno = selectedPR?.pr_basic_sno ?? poGroups[0]?.sourcePRs[0];
    if (!prBasicSno) return;

    const payload = {
      pr_basic_sno: prBasicSno,
      pr_no: selectedPR ? getPRDisplayNo(selectedPR) : undefined,
      vendor_sno: selectedVendor.kyc_basic_info_sno ?? selectedVendor.vendor_sno,
      com_sno: selectedPR?.com_sno,
      div_sno: selectedPR?.div_sno,
      brn_sno: selectedPR?.brn_sno,
      dept_sno: selectedPR?.dept_sno,
      ...form,
      items,
      ...(quotationSplitGroup !== undefined && { split_group: quotationSplitGroup }),
      ...(poGroups.length > 0 && {
        source_pr_basic_snos: poGroups.flatMap(g => g.sourcePRs),
        po_group_id: poGroups[0]?.id,
      }),
    };

    try {
      if (file) {
        // Multipart: encrypted metadata in `_ep`, binary file appended raw.
        const fd = new FormData();
        fd.append('_ep', await encryptFormMeta(payload));
        fd.append('quotation_file', file);
        await postQuotation(purchaseTeamCreateQuotation, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        });
      } else {
        await postQuotation(purchaseTeamCreateQuotation, payload, { withCredentials: true });
      }

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
      q.pr_no = selectedPR?.pr_no ?? q.pr_no; // ensure pr_no is sent for legacy quotations created without a PR context

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
        q.pr_no = selectedPR?.pr_no ?? q.pr_no; // ensure pr_no is sent for legacy quotations created without a PR context
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

  // Seed the sidebar split badge for the active PR from its persisted groups so
  // the count survives a reload (the real-time event keeps it fresh after that).
  useEffect(() => {
    if (!selectedPR?.pr_basic_sno || confirmedSplitGroups.length === 0) return;
    const prSno = selectedPR.pr_basic_sno;
    const maxGroup = confirmedSplitGroups[confirmedSplitGroups.length - 1].groupNum;
    setSplitInfo(prev => (
      (prev[prSno] ?? 0) >= maxGroup ? prev : { ...prev, [prSno]: maxGroup }
    ));
  }, [confirmedSplitGroups, selectedPR]);

  // ── Whether Step 2 (supplier/quotation) is unlocked ───────────────────────
  const isStep2Unlocked = !!confirmedData && !editingConfirm;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <>
    <TwoPaneLayout
      icon={ClipboardCheck}
      title="Purchase Team"
      description="Confirm PO details, split PRs, assign suppliers, manage quotations"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <PRListSidebar
          prList={prList}
          loading={loadingPR}
          selectedPR={selectedPR}
          onSelectPR={(pr) => { handleSelectPR(pr); setSidebarOpen(false); }}
          splitInfo={splitInfo}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> PR List
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => { setPrRefreshKey(k => k + 1); setVendorRefreshKey(k => k + 1); }}
            disabled={loadingPR}
          >
            <RefreshCw size={16} className={loadingPR ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      {!selectedPR ? (
        <EmptyState
          message="Select a Purchase Requisition"
          description="Choose a PR from the left panel to get started"
          icon={ClipboardCheck}
        />
      ) : (
            <div className="px-6 py-4 space-y-4">

              {/* ── Step indicator ───────────────────────────────────────── */}
              <div className="flex items-center gap-3 text-xs">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium
                  ${isStep2Unlocked
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-primary/10 border-primary/20 text-primary'
                  }`}>
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold
                    ${isStep2Unlocked ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                    {isStep2Unlocked ? '✓' : '1'}
                  </span>
                  Confirm PO Details
                </div>
                <div className="h-px w-6 bg-border" />
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium
                  ${isStep2Unlocked
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-muted/40 border-border text-muted-foreground/70'
                  }`}>
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold
                    ${isStep2Unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    2
                  </span>
                  Supplier &amp; Quotation
                </div>
              </div>

              {/* ── Section 1: PO Confirmation ───────────────────────────── */}
              <POConfirmStep
                key={`${selectedPR.pr_basic_sno}-${selectedPR.pr_no ?? selectedPR.pr_id ?? ''}`}
                selectedPR={selectedPR}
                onConfirmed={handlePOConfirmed}
                onSplitGroupCreated={handleSplitGroupCreated}
                saving={savingConfirm}
                confirmedData={editingConfirm ? null : confirmedData}
                onEditConfirm={() => setEditingConfirm(true)}
              />

              {/* ── Sections below are locked until Step 1 is saved ──────── */}
              {!isStep2Unlocked && (
                <div className="rounded-lg border border-dashed border-border bg-muted/40/60 p-6 text-center text-sm text-muted-foreground/70">
                  Complete Step 1 to unlock supplier selection and quotation management.
                </div>
              )}

              {isStep2Unlocked && (
                <>
                  {/* ── Section 2: Split PR ───────────────────────────────── */}
                  {/* <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Scissors size={16} className="text-primary" />
                        Split PR into Multiple POs
                        <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                        {confirmedSplitGroups.length > 0 && (
                          <Badge className="text-xs bg-green-100 text-green-700 border-green-200 ml-1">
                            {confirmedSplitGroups.length} split PO(s)
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <SplitPRTab
                        prNo={getPRDisplayNo(selectedPR)}
                        items={confirmedData?.items ?? []}
                        onItemsChange={handleSplitChange}
                        onGroupPersist={handleSplitGroupCreated}
                      />
                    </CardContent>
                  </Card> */}

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
                    mainPOItems={(confirmedData?.items ?? []).filter(i => !i.split_group)}
                  />
                </>
              )}

            </div>
          )}
      </TwoPaneLayout>

      {/* Dialogs rendered outside layout so they aren't clipped */}
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
        onSelectQuotation={handleSelectQuotation}
      />

      <CreatePODialog
        open={showPOConfirm}
        onOpenChange={handleClosePODialog}
        selectedPR={selectedPR}
        selectedQuotation={selectedQuotation}
        onCreatePO={handleCreatePO}
      />
    </>
  );
};

export default PurchaseTeamPage;
