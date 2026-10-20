import React, { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ClipboardList, FilePlus2, FileCheck, Loader2, Pencil, RefreshCw, RotateCcw, Send, SearchX, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, PageHeader } from '@/CustomComponent/PageComponents';
import {
  FilterChips, Panel, SearchInput, StatusPill, ApprovalActivity,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { DocLink } from '@/CustomComponent/ServiceComponents/ServiceUploads';
import { formatDate, formatINR, statusMeta } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { createSpecialAgreement, updateSpecialAgreement, getSpecialAgreements } from '@/Services/Api';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import useFetch from '@/hooks/useFetchHook';
import { useServiceLive } from '@/hooks/useServiceLive';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { SpecialAgreementForm } from './SpecialAgreementForm';
import {
  SPECIAL_STATUS, SPECIAL_TYPE_LABEL, buildSpecialFormData, emptyFormValues, emptyItemDraft, validateSpecialForm,
  valuesFromRow, type ItemDraft, type SpecialAgreementRow, type SpecialFormValues, type SpecialType,
} from './specialAgreementUtils';

type StatusFilter = 'ALL' | 'P' | 'A' | 'R' | 'X';
type PageView = 'create' | 'list';
type TypeFilter = 'ALL' | SpecialType;

const scrollToFirstError = () =>
  requestAnimationFrame(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));

// ─── Product lines of one agreement ───────────────────────────────────────
const ItemsTable: React.FC<{ row: SpecialAgreementRow }> = ({ row }) => (
  <div className="overflow-x-auto rounded-lg border bg-card">
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">{row.agreement_type === 'FIXED' ? 'Fixed rate' : 'Rate'}</TableHead>
          <TableHead className="text-right">Max qty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {row.items.map((it) => (
          <TableRow key={it.item_sno ?? it.prod_sno}>
            <TableCell>
              <span className="font-medium">{it.prod_name}</span>
              {it.prod_code && <span className="ml-2 text-xs text-muted-foreground">{it.prod_code}</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.agreement_type === 'FIXED'
                ? <>{formatINR(it.rate_amount)}{it.uom_name && <span className="text-xs text-muted-foreground"> / {it.uom_name}</span>}</>
                : <span className="text-muted-foreground">Varies</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {it.max_qty != null ? <>{it.max_qty}{it.uom_name && <span className="text-xs text-muted-foreground"> {it.uom_name}</span>}</> : <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

// ─── Edit / resubmit dialog ───────────────────────────────────────────────
const EditDialog: React.FC<{ row: SpecialAgreementRow; onClose: () => void; onSaved: () => void }> = ({ row, onClose, onSaved }) => {
  const initial = useMemo(() => valuesFromRow(row), [row]);
  const [values, setValues] = useState<SpecialFormValues>(initial.values);
  const [items, setItems] = useState<ItemDraft[]>(initial.items);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const renewing = row.status === 'X';

  const submit = async () => {
    const errs = validateSpecialForm(values, items);
    setErrors(errs);
    if (Object.keys(errs).length) { scrollToFirstError(); return; }
    setSaving(true);
    try {
      await axios.post(updateSpecialAgreement,
        buildSpecialFormData(values, items, { special_agreement_sno: String(row.special_agreement_sno) }),
        { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${row.agreement_no} resubmitted for approval`);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the agreement'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-4xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>{renewing ? 'Renew' : 'Edit'} {row.agreement_no}</DialogTitle>
          <DialogDescription>
            Saving sends this agreement through approval again as version {row.version_no + 1}. Earlier versions stay in its history.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          <SpecialAgreementForm
            editing values={values} items={items} errors={errors}
            onChange={(p) => setValues((v) => ({ ...v, ...p }))} onItemsChange={setItems}
          />
        </div>
        <DialogFooter className="border-t bg-card px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : renewing ? <><RotateCcw size={15} /> Renew & Submit</> : <><Send size={15} /> Save & Resubmit</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────
const SpecialAgreementPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'SpecialAgreementPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);
  const canEditRows = canEdit(permissionComponent);

  const [requestedView, setView] = useState<PageView>('create');
  const view: PageView = canSubmit ? requestedView : 'list';

  const [values, setValues] = useState<SpecialFormValues>(emptyFormValues);
  const [items, setItems] = useState<ItemDraft[]>([emptyItemDraft()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<SpecialAgreementRow | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  useServiceLive('special', refresh);

  const { data: res, loading } = useFetch<{ success: boolean; data: SpecialAgreementRow[] }>(getSpecialAgreements, '', null, refreshKey);
  const rows = useMemo(() => res?.data ?? [], [res]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && r.agreement_type !== typeFilter) return false;
      if (!q) return true;
      return [r.agreement_no, r.vendor_name, ...r.items.map((i) => i.prod_name)].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, statusFilter, typeFilter, search]);
  const isFiltering = statusFilter !== 'ALL' || typeFilter !== 'ALL' || search.trim() !== '';

  const reset = () => { setValues(emptyFormValues()); setItems([emptyItemDraft()]); setErrors({}); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateSpecialForm(values, items);
    setErrors(errs);
    if (Object.keys(errs).length) { scrollToFirstError(); return; }
    setSubmitting(true);
    try {
      const r = await axios.post(createSpecialAgreement, buildSpecialFormData(values, items), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Special Agreement ${r?.data?.data?.[0]?.agreement_no ?? ''} submitted for approval`);
      reset();
      refresh();
      setStatusFilter('ALL'); setTypeFilter('ALL'); setSearch('');
      setView('list');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Submission failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusChips = [
    { value: 'ALL' as const, label: 'All', count: counts.ALL },
    { value: 'P' as const, label: 'Pending', count: counts.P ?? 0 },
    { value: 'A' as const, label: 'Approved', count: counts.A ?? 0 },
    { value: 'R' as const, label: 'Rejected', count: counts.R ?? 0 },
    { value: 'X' as const, label: 'Expired', count: counts.X ?? 0 },
  ];
  const typeChips = [
    { value: 'ALL' as const, label: 'All types' },
    { value: 'FIXED' as const, label: 'Fixed rate' },
    { value: 'UNFIXED' as const, label: 'Unfixed rate' },
  ];

  const renderList = () => {
    if (loading && rows.length === 0) {
      return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>;
    }
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={isFiltering ? SearchX : ClipboardList}
          message={isFiltering ? 'No agreements match your filters' : 'No special agreements yet'}
          description={isFiltering ? 'Try a different status or search term.' : 'Agreements you submit will be listed here.'}
          action={isFiltering ? <Button variant="outline" size="sm" onClick={() => { setStatusFilter('ALL'); setTypeFilter('ALL'); setSearch(''); }}>Clear filters</Button> : undefined}
        />
      );
    }
    return (
      <div className="space-y-3">
        {filtered.map((r) => {
          const st = statusMeta(SPECIAL_STATUS, r.status);
          const open = expanded === r.special_agreement_sno;
          return (
            <div key={r.special_agreement_sno} className={cn('rounded-xl border bg-card p-4 shadow-sm', r.status === 'X' && 'bg-muted/30')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.agreement_no}</span>
                    <StatusPill tone={r.agreement_type === 'FIXED' ? 'primary' : 'violet'}>{SPECIAL_TYPE_LABEL[r.agreement_type]}</StatusPill>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    {r.version_no > 1 && <span className="text-xs text-muted-foreground">v{r.version_no}</span>}
                  </div>
                  <p className="mt-1 text-sm font-medium">{r.vendor_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.period_start_date)} – {formatDate(r.period_end_date)} · {r.items.length} product{r.items.length === 1 ? '' : 's'}
                    {r.dept_name ? ` · ${[r.com_name, r.dept_name].filter(Boolean).join(' / ')}` : ''}
                  </p>
                  {r.status === 'P' && r.current_approver_id && (
                    <p className="mt-1 text-xs text-muted-foreground">With <b>{r.current_approver_id}</b> for approval</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DocLink url={r.agreement_doc_url} label="Document" />
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : r.special_agreement_sno)}>
                    <History size={14} /> {open ? 'Hide details' : 'Details'}
                  </Button>
                  {canEditRows && r.status === 'X' && (
                    <Button size="sm" onClick={() => setEditing(r)}><RotateCcw size={14} /> Renew</Button>
                  )}
                  {canEditRows && (r.status === 'A' || r.status === 'R') && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil size={14} /> Edit</Button>
                  )}
                </div>
              </div>
              {open && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <ItemsTable row={r} />
                  {(r.remarks || r.terms_conditions) && (
                    <div className="space-y-2 text-sm">
                      {r.remarks && <p><span className="font-medium">Remarks: </span><span className="whitespace-pre-wrap break-words">{r.remarks}</span></p>}
                      {r.terms_conditions && <p><span className="font-medium">Terms: </span><span className="whitespace-pre-wrap break-words">{r.terms_conditions}</span></p>}
                    </div>
                  )}
                  <ApprovalActivity history={r.history} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-muted/30">
      <PageHeader
        icon={FileCheck}
        title="Special Agreements"
        description="Product rate agreements with a fixed supplier — Fixed (rate fixed) or Unfixed (rate can change)"
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={view} onValueChange={(v) => setView(v as PageView)}>
          <TabsList className="h-10 w-full sm:w-fit">
            {canSubmit && <TabsTrigger value="create" className="px-4"><FilePlus2 size={15} /> New agreement</TabsTrigger>}
            <TabsTrigger value="list" className="px-4">
              <ClipboardList size={15} /> All agreements
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{counts.ALL}</span>
            </TabsTrigger>
          </TabsList>

          {canSubmit && (
            <TabsContent value="create" className="mt-5">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <SpecialAgreementForm
                  values={values} items={items} errors={errors}
                  onChange={(p) => setValues((v) => ({ ...v, ...p }))} onItemsChange={setItems}
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={reset} disabled={submitting}>Reset</Button>
                  <Button type="submit" disabled={submitting} className="sm:min-w-48">
                    {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : <><Send size={15} /> Submit for approval</>}
                  </Button>
                </div>
              </form>
            </TabsContent>
          )}

          <TabsContent value="list" className="mt-5">
            <Panel
              icon={ClipboardList} title="Existing agreements" bodyClassName="space-y-4"
              action={<Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> <span className="hidden sm:inline">Refresh</span>
              </Button>}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterChips options={statusChips} value={statusFilter} onChange={setStatusFilter} />
                <SearchInput value={search} onChange={setSearch} placeholder="Search by number, supplier or product" className="w-full md:w-80" />
              </div>
              <FilterChips options={typeChips} value={typeFilter} onChange={setTypeFilter} />
              {renderList()}
            </Panel>
          </TabsContent>
        </Tabs>
      </div>

      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
};

export default SpecialAgreementPage;
