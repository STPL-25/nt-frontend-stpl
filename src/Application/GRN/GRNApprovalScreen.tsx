import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, ChevronRight, ClipboardCheck, FileText, History, Loader2, Package, ReceiptText, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  ApprovalActivity, DetailEmptyState, DetailHero, Fact, FactGrid, Panel, SearchInput, SelectableCard, StatusPill,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { grnSvcGetGRNApprovals, grnSvcDecideGRN } from '@/Services/GrnService/grnApi';
import { getAuthFileUrl } from '@/Services/authUrl';
import { downloadGRNPdf } from '@/utils/generateGRNPdf';
import { formatDate, formatINR } from './GRN/helpers';
import type { GRNApprovalRow } from './GRN/GRNApprovalPanel';

const parseItems = (raw: GRNApprovalRow['items']): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  return [];
};

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

/** GRNs waiting on the logged-in approver, sidebar + detail like the other approval screens. */
const GRNApprovalScreen: React.FC = () => {
  const [rows, setRows] = useState<GRNApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(grnSvcGetGRNApprovals({ mine: true }));
      setRows(res.data?.data?.grns ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load GRN approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => rows.find(r => r.grn_basic_sno === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    setComments('');
    setHistory([]);
    if (!selectedId) return;
    axios.get(grnSvcGetGRNApprovals({ grn_basic_sno: selectedId }))
      .then(res => setHistory(res.data?.data?.history ?? []))
      .catch(() => setHistory([]));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => !q || [r.grn_no, r.po_no, r.vendor_name, r.doc_ref_no].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [rows, search]);

  const decide = async (action: 'approve' | 'reject') => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await axios.post(grnSvcDecideGRN, { grn_basic_sno: selected.grn_basic_sno, action, comments });
      const result = res.data?.data?.result;
      toast.success(action === 'reject' ? `${selected.grn_no} rejected`
        : result === 'FINAL' ? `${selected.grn_no} approved - stock posted` : `${selected.grn_no} approved - sent to next approver`);
      setRows(prev => prev.filter(r => r.grn_basic_sno !== selected.grn_basic_sno));
      setSelectedId(null);
      if (action === 'approve' && result === 'FINAL') await downloadGRNPdf(selected.grn_basic_sno, selected.po_basic_sno);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to record the decision');
    } finally {
      setBusy(false);
    }
  };

  const items = selected ? parseItems(selected.items) : [];

  const detailContent = selected ? (
    <div className="space-y-4 px-3 py-4 sm:px-5">
      <DetailHero
        icon={ClipboardCheck}
        eyebrow="GRN approval"
        title={selected.grn_no}
        subtitle={selected.vendor_name}
        badges={<StatusPill tone="warning">Pending your approval</StatusPill>}
        metrics={[
          { label: 'PO', value: selected.po_no ?? '—', valueClassName: 'text-base @md:text-base' },
          { label: 'Received', value: formatDate(selected.received_date), valueClassName: 'text-base @md:text-base' },
          { label: 'Invoice amount', value: selected.invoice_amount != null ? formatINR(selected.invoice_amount) : '—', accent: true },
        ]}
      />

      <Panel icon={FileText} title="Receipt details">
        <FactGrid>
          <Fact label="Gate entry">{selected.gate_entry_no ?? '—'}</Fact>
          <Fact label="Challan no">{selected.challan_no ?? '—'}</Fact>
          <Fact label="Vehicle no">{selected.vehicle_no ?? '—'}</Fact>
          <Fact label="Received by">{selected.created_by ?? '—'}</Fact>
          <Fact label="Items">{selected.item_count ?? items.length}</Fact>
          <Fact label="Total received qty">{selected.total_received_qty ?? 0}</Fact>
          {selected.remarks && <Fact label="Remarks" className="col-span-2 @xl:col-span-3">{selected.remarks}</Fact>}
        </FactGrid>
      </Panel>

      <Panel icon={ReceiptText} title="Supplier invoice">
        <FactGrid>
          <Fact label="Invoice no">{selected.doc_ref_no ?? '—'}</Fact>
          <Fact label="Invoice date">{selected.invoice_date ? formatDate(selected.invoice_date) : '—'}</Fact>
          <Fact label="Invoice amount">{selected.invoice_amount != null ? formatINR(selected.invoice_amount) : '—'}</Fact>
          <Fact label="Document">
            {selected.invoice_doc_url ? (
              <a href={getAuthFileUrl(selected.invoice_doc_url)} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                View uploaded invoice
              </a>
            ) : 'Not uploaded'}
          </Fact>
        </FactGrid>
      </Panel>

      <Panel icon={Package} title={`Items received (${items.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={th}>Item</th><th className={th}>HSN</th><th className={th}>Ordered</th><th className={th}>Invoice qty</th>
                <th className={th}>Received</th><th className={th}>Rejected</th><th className={th}>Short / Excess</th>
                <th className={th}>Condition</th><th className={th}>Location</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={it.grn_item_sno ?? i} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{it.prod_name}{it.specification ? <span className="block text-xs font-normal text-muted-foreground">{it.specification}</span> : null}</td>
                  <td className="px-3 py-2">{it.hsn_code ?? '—'}</td>
                  <td className="px-3 py-2">{it.ordered_qty} {it.unit_name}</td>
                  <td className="px-3 py-2">{it.invoice_qty != null ? `${it.invoice_qty} ${it.invoice_uom ?? ''}` : '—'}</td>
                  <td className="px-3 py-2">{it.received_qty}</td>
                  <td className="px-3 py-2">{it.rejected_qty}</td>
                  <td className="px-3 py-2">{Number(it.shortage_qty) ? `Short ${it.shortage_qty}` : Number(it.excess_qty) ? `Excess ${it.excess_qty}` : '—'}</td>
                  <td className="px-3 py-2">{it.condition}</td>
                  <td className="px-3 py-2">{it.warehouse_location_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {history.length > 0 && (
        <Panel icon={History} title="Approval activity">
          <ApprovalActivity history={history} />
        </Panel>
      )}

      <Panel icon={ClipboardCheck} title="Your decision" description="Stock is posted and the GRN PDF downloads on final approval.">
        <Textarea
          placeholder="Remarks (required to reject)"
          value={comments}
          onChange={e => setComments(e.target.value)}
          className="min-h-[72px] text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => decide('approve')}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Approve
          </Button>
          <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={busy || !comments.trim()} onClick={() => decide('reject')}>
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
        </div>
      </Panel>
    </div>
  ) : null;

  return (
    <SidebarDetailLayout
      sidebarTitle="GRN Approvals"
      sidebarCount={rows.length}
      sidebarCountLabel="GRN"
      sidebarCountLabelPlural="GRNs"
      sidebarCountQualifier="pending"
      listItems={(closeSheet) => (
        <>
          <div className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
            <SearchInput value={search} onChange={setSearch} placeholder="Search GRN, PO, supplier…" className="min-w-0 flex-1" />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={load} disabled={loading} aria-label="Refresh list">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          {loading && rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{search ? 'No matches found' : 'No GRNs awaiting your approval'}</p>
          ) : filtered.map(r => {
            const active = r.grn_basic_sno === selectedId;
            return (
              <SelectableCard key={r.grn_basic_sno} selected={active} onClick={() => { setSelectedId(r.grn_basic_sno); closeSheet(); }}>
                <span className="flex items-start justify-between gap-2">
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.grn_no}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.vendor_name ?? '—'}</span>
                  </span>
                  <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', active ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
                </span>
                <span className="mt-2.5 block"><StatusPill tone="warning">Pending approval</StatusPill></span>
                <span className="mt-3 block space-y-1 text-xs">
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">PO</span><span className="font-medium">{r.po_no ?? '—'}</span></span>
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">Invoice</span><span className="truncate font-medium">{r.doc_ref_no ?? '—'}</span></span>
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">Received</span><span className="font-medium">{formatDate(r.received_date)}</span></span>
                </span>
              </SelectableCard>
            );
          })}
        </>
      )}
      hasSelection={!!selected}
      detailContent={detailContent}
      emptyContent={
        <DetailEmptyState icon={ClipboardCheck} title="Select a GRN" description="Choose a GRN from the list to review its details and invoice, then approve or reject it." />
      }
      mobileListLabel="GRNs"
      mobileSelectionTitle={selected?.grn_no}
    />
  );
};

export default GRNApprovalScreen;
