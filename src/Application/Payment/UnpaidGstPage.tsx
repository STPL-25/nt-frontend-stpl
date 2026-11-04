import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Info, Loader2, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/CustomComponent/PageComponents';
import { Callout, FilterChips, Panel, SearchInput, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getErrorMessage } from '@/lib/errors';
import { payNetUnpaidGst, payNetUnpaidGstCheck, type UnpaidGstCheckResult, type UnpaidGstRow, type UnpaidGstStatus } from '@/Services/GrnService/paymentNetApi';
import { socket, SOCKET_CONNECT, SOCKET_JOIN_PAYMENT, SOCKET_LEAVE_PAYMENT, SOCKET_PAYMENT_UPDATED } from '@/Services/Socket';
import { rupees } from './paymentRunModel';

const SCREEN = 'UnpaidGstPage';
type Filter = UnpaidGstStatus | 'ALL';

const showDate = (d: string | null | undefined) => {
  const s = d ? String(d).slice(0, 10) : '';
  if (!s) return '—';
  const p = new Date(`${s}T00:00:00`);
  return Number.isNaN(p.getTime()) ? s : p.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const th = 'text-xs';
const tone2b = (s: UnpaidGstRow['gstr2b_status']): Tone => (s === 'In GSTR-2B' ? 'success' : s === 'Hold released by Accounts' ? 'info' : 'danger');

/**
 * Invoices that were paid without their GST because GSTR-2B did not have them yet. When a later 2B upload has the invoice, the unpaid
 * GST is moved to Payment Run on its own as an already approved payment (no second approval) - this screen shows what is waiting,
 * what has moved, and can look at 2B again on demand.
 */
const UnpaidGstPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const canCheck = canCreate(SCREEN) || canEdit(SCREEN);

  const [rows, setRows] = useState<UnpaidGstRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('Awaiting 2B');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(payNetUnpaidGst);
      setRows(res?.data?.data ?? []);
    } catch (e) {
      setRows([]);
      setError(getErrorMessage(e, 'Could not load the unpaid GST'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // a GST payment moved to Payment Run (or a payment changed) elsewhere
  const live = useRef(load);
  useEffect(() => { live.current = load; });
  useEffect(() => {
    const join = () => socket.emit(SOCKET_JOIN_PAYMENT);
    join();
    socket.on(SOCKET_CONNECT, join);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdated = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => live.current(), 500); };
    socket.on(SOCKET_PAYMENT_UPDATED, onUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off(SOCKET_CONNECT, join);
      socket.off(SOCKET_PAYMENT_UPDATED, onUpdated);
      socket.emit(SOCKET_LEAVE_PAYMENT);
    };
  }, []);

  const check = async () => {
    setChecking(true);
    try {
      const res = await axios.post(payNetUnpaidGstCheck, {});
      const out: UnpaidGstCheckResult = res?.data?.data ?? { released: [] };
      if (out.released.length === 0) toast.info('Checked GSTR-2B - none of the unpaid GST is in 2B yet.');
      else toast.success(`${out.released.length} payment${out.released.length > 1 ? 's' : ''} of GST (${rupees(out.released.reduce((s, p) => s + Number(p.net_paid), 0))}) moved to Payment Run: ${out.released.map((p) => p.payment_no).join(', ')}`);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not check GSTR-2B'));
    } finally {
      setChecking(false);
    }
  };

  const awaiting = rows.filter((r) => r.status === 'Awaiting 2B');
  const released = rows.filter((r) => r.status === 'Released');
  const awaitingTotal = awaiting.reduce((s, r) => s + Number(r.gst_unpaid), 0);
  const releasedTotal = released.reduce((s, r) => s + Number(r.gst_released), 0);

  const shown = useMemo(() => {
    const base = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter);
    const q = search.trim().toLowerCase();
    return q ? base.filter((r) => [r.vendor_name, r.supplier_invoice_no, r.po_no, r.supplier_gstin, r.released_payment_no].some((v) => String(v ?? '').toLowerCase().includes(q))) : base;
  }, [rows, filter, search]);

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <PageHeader
        icon={Receipt}
        title="Unpaid GST"
        stats={[
          { label: 'Waiting for 2B', value: awaiting.length, icon: Clock },
          { label: 'GST unpaid', value: rupees(awaitingTotal), icon: AlertTriangle },
          { label: 'Moved to run', value: released.length, icon: CheckCircle2 },
          { label: 'GST moved', value: rupees(releasedTotal), icon: Wallet },
        ]}
      >
        <Button
          variant="outline" size="sm"
          className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          onClick={load} disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'mr-1 animate-spin' : 'mr-1'} /> Refresh
        </Button>
        {canCheck && (
          <Button size="sm" variant="secondary" onClick={check} disabled={checking || awaiting.length === 0} title="Look at GSTR-2B again now and move the GST of every invoice it has to Payment Run">
            {checking ? <Loader2 size={15} className="mr-1 animate-spin" /> : <CheckCircle2 size={15} className="mr-1" />} Check GSTR-2B now
          </Button>
        )}
      </PageHeader>

      <div className="container mx-auto space-y-6 px-4 py-6">
       
        {error && <Callout tone="danger" icon={AlertTriangle}>{error}</Callout>}

        <Panel
          icon={Receipt}
          title={`Invoices (${shown.length})`}
          description="Oldest first. GST is the invoice amount less its taxable value"
          bodyClassName="p-0"
          action={<SearchInput value={search} onChange={setSearch} placeholder="Supplier, invoice, PO, GSTIN…" />}
        >
          <div className="border-b p-3">
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'Awaiting 2B', label: 'Waiting for 2B', count: awaiting.length },
                { value: 'Released', label: 'Moved to Payment Run', count: released.length },
                { value: 'ALL', label: 'All', count: rows.length },
              ]}
            />
          </div>
          {loading && rows.length === 0 ? (
            <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
          ) : shown.length === 0 ? (
            <div className="m-4 flex flex-col items-center rounded-2xl border border-dashed border-primary/20 bg-gradient-to-b from-primary/[0.07] to-card px-5 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
                <Receipt className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {filter === 'Awaiting 2B' ? 'Nothing is waiting for GSTR-2B' : filter === 'Released' ? 'No GST moved to Payment Run' : 'No GST records yet'}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {filter === 'Awaiting 2B' ? 'Invoices that need a 2B match will appear here.' : filter === 'Released' ? 'Released unpaid GST entries will appear here.' : 'Unpaid GST activity will appear here when available.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={th}>Supplier</TableHead>
                    <TableHead className={th}>Supplier invoice</TableHead>
                    <TableHead className={`${th} text-right`}>Invoice / taxable</TableHead>
                    <TableHead className={`${th} text-right`}>Paid so far</TableHead>
                    <TableHead className={`${th} text-right`}>GST</TableHead>
                    <TableHead className={th}>GSTR-2B</TableHead>
                    <TableHead className={th}>Where it stands</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => {
                    const isReleased = r.status === 'Released';
                    return (
                      <TableRow key={`${r.invoice_sno}-${r.status}`}>
                        <TableCell className="text-xs font-medium">{r.vendor_name ?? '—'}<span className="block font-normal text-muted-foreground">{r.supplier_gstin ?? ''}</span></TableCell>
                        <TableCell className="text-xs">{r.supplier_invoice_no || <span className="font-normal text-muted-foreground">Not entered</span>}<span className="block text-muted-foreground">{showDate(r.invoice_date)}</span><span className="block text-muted-foreground">{r.po_no ?? 'No PO'}</span></TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{rupees(r.invoice_amount)}<span className="block text-muted-foreground">taxable {rupees(r.taxable_value)}</span></TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{rupees(r.paid_before)}<span className="block text-muted-foreground">{r.earlier_payment_nos ?? ''}</span></TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">{rupees(isReleased ? r.gst_released : r.gst_unpaid)}</TableCell>
                        <TableCell className="text-xs">
                          <StatusPill tone={tone2b(r.gstr2b_status)}>{r.gstr2b_status}</StatusPill>
                          {r.gstr2b_period && <span className="block text-muted-foreground">Period {r.gstr2b_period}</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isReleased
                            ? <><StatusPill tone={r.released_payment_status === 'Processed' ? 'success' : 'info'}>{r.released_payment_status === 'Processed' ? 'Paid' : 'In Payment Run'}</StatusPill>
                                <span className="block text-muted-foreground">{r.released_payment_no} · {showDate(r.released_at)}</span></>
                            : <><StatusPill tone="warning">Waiting for 2B</StatusPill>
                                <span className="block text-muted-foreground">{r.days_waiting} day{r.days_waiting === 1 ? '' : 's'} since {showDate(r.noted_at)}</span></>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default UnpaidGstPage;
