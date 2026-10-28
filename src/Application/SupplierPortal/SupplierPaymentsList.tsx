import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Callout, DetailHero, FilterChips, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { cn } from '@/lib/utils';
import {
  supplierAxios,
  supplierGetPayments,
  type SupplierPaymentsData,
  type SupplierPaymentItem,
} from '@/Services/SupplierService';
import { formatDate, formatINR } from './helpers';

type Filter = 'ALL' | 'ADVANCE' | 'BILL';

const th = 'h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const chip = (tone: keyof typeof TONE) => cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium', TONE[tone]);

/** What the supplier has been paid and what is on its way, in the same hero + panel layout as the staff screens. */
const SupplierPaymentsList: React.FC = () => {
  const [data, setData] = useState<SupplierPaymentsData>({ payments: [], advances: [] });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierAxios.get(supplierGetPayments);
      setData({ payments: res.data?.data?.payments ?? [], advances: res.data?.data?.advances ?? [] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => data.payments.filter((p) => filter === 'ALL' || p.payment_type === filter), [data.payments, filter]);
  const paidTotal = data.payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + Number(p.net_paid || 0), 0);
  const scheduledTotal = data.payments.filter((p) => p.status === 'Scheduled').reduce((s, p) => s + Number(p.net_paid || 0), 0);
  const advanceBalance = data.advances.reduce((s, a) => s + Number(a.balance || 0), 0);
  const count = (f: Filter) => data.payments.filter((p) => f === 'ALL' || p.payment_type === f).length;

  return (
    <div className="@container">
      <div className="space-y-4 px-3 py-4 sm:px-5">
        <DetailHero
          icon={Banknote}
          eyebrow="Supplier portal"
          title="Payments"
          subtitle="Advance and bill payments made to you, with what was deducted"
          metrics={[
            { label: 'Paid to you', value: formatINR(paidTotal), valueClassName: 'text-emerald-700 dark:text-emerald-300' },
            { label: 'Scheduled (approved, not yet paid)', value: formatINR(scheduledTotal), valueClassName: 'text-amber-700 dark:text-amber-300' },
            { label: 'Advance balance', value: formatINR(advanceBalance), hint: 'to be set off against your bills' },
          ]}
        />

        <Panel icon={Banknote} title={`Payments (${shown.length})`} bodyClassName="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5">
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All', count: count('ALL') },
                { value: 'ADVANCE', label: 'Advance', count: count('ADVANCE') },
                { value: 'BILL', label: 'Bill payment', count: count('BILL') },
              ]}
            />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={load} disabled={loading} aria-label="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          {loading && data.payments.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No payments yet - advance and bill payments made to you appear here once they are approved.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className={th}>Payment</TableHead>
                    <TableHead className={th}>For</TableHead>
                    <TableHead className={th}>PO</TableHead>
                    <TableHead className={th}>Invoice</TableHead>
                    <TableHead className={th}>Status</TableHead>
                    <TableHead className={th}>Date</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Bill amount</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Deductions</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Net paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p: SupplierPaymentItem) => {
                    const deductions = Number(p.tds_amount || 0) + Number(p.advance_adjusted || 0) + Number(p.note_adjusted || 0);
                    return (
                      <TableRow key={p.payment_sno}>
                        <TableCell className="text-xs font-medium">{p.payment_no}{p.batch_no ? <span className="block font-normal text-muted-foreground">{p.batch_no}</span> : null}</TableCell>
                        <TableCell><span className={chip(p.payment_type === 'ADVANCE' ? 'violet' : 'info')}>{p.payment_type === 'ADVANCE' ? 'Advance' : 'Bill payment'}</span></TableCell>
                        <TableCell className="text-xs">{p.po_nos ?? '—'}</TableCell>
                        <TableCell className="text-xs">{p.supplier_invoice_nos ?? p.invoice_nos ?? '—'}</TableCell>
                        <TableCell><StatusPill tone={p.status === 'Paid' ? 'success' : 'warning'}>{p.status}</StatusPill></TableCell>
                        <TableCell className="text-xs">
                          {p.status === 'Paid' ? formatDate(p.processed_at ?? p.payment_date) : (p.planned_for ? `Due ${formatDate(p.planned_for)}` : '—')}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{formatINR(p.gross_amount)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {deductions !== 0 ? `- ${formatINR(deductions)}` : '—'}
                          {Number(p.advance_adjusted) > 0 && <span className="block text-muted-foreground">advance {formatINR(p.advance_adjusted)}</span>}
                          {Number(p.tds_amount) > 0 && <span className="block text-muted-foreground">TDS {formatINR(p.tds_amount)}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums">{formatINR(p.net_paid)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        {data.advances.length > 0 && (
          <Panel icon={Landmark} title="Advances paid to you" description="How much of each advance has been set off against your bills" bodyClassName="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className={th}>Advance</TableHead>
                    <TableHead className={th}>PO</TableHead>
                    <TableHead className={th}>Paid on</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Amount</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Set off against bills</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.advances.map((a) => (
                    <TableRow key={a.advance_sno}>
                      <TableCell className="text-xs font-medium">{a.advance_no}</TableCell>
                      <TableCell className="text-xs">{a.po_no ?? '—'}</TableCell>
                      <TableCell className="text-xs">{formatDate(a.paid_date)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{formatINR(a.amount)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{formatINR(a.adjusted_amount)}</TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums">{formatINR(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {advanceBalance > 0 && (
              <div className="border-t p-3 sm:px-5">
                <Callout tone="info">An advance is set off against the bills of the PO it was paid for, so it reduces what you are paid on those bills.</Callout>
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
};

export default SupplierPaymentsList;
