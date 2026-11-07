import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetailHero, FilterChips, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { cn } from '@/lib/utils';
import {
  supplierAxios,
  supplierGetRfqs,
  type SupplierRfqListItem,
  type SupplierRfqStatus,
} from '@/Services/SupplierService';
import { formatDate, formatINR } from './helpers';

type Filter = 'ALL' | 'TO_QUOTE' | 'SUBMITTED' | 'CLOSED';

const th = 'h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const dateTime = (v?: string | null) => (v ? `${formatDate(v.slice(0, 10))}, ${v.slice(11, 16)}` : '—');

/** What the supplier should do next, from the row's status + whether it can still respond. */
export function rfqBadge(r: Pick<SupplierRfqListItem, 'status' | 'can_respond' | 'current_version'>): { label: string; tone: Tone } {
  const s: SupplierRfqStatus = r.status;
  if (s === 'TAKEN') return { label: 'Accepted', tone: 'primary' };
  if (s === 'CLOSED') return { label: 'Closed', tone: 'neutral' };
  if (s === 'DECLINED') return { label: 'Declined', tone: 'danger' };
  if (!r.can_respond) return { label: s === 'SUBMITTED' ? `Submitted${r.current_version ? ` · v${r.current_version}` : ''}` : 'Closed for responses', tone: s === 'SUBMITTED' ? 'success' : 'neutral' };
  if (s === 'REVISION_REQUESTED') return { label: 'Revision requested', tone: 'warning' };
  if (s === 'SUBMITTED') return { label: `Submitted${r.current_version ? ` · v${r.current_version}` : ''}`, tone: 'success' };
  return { label: 'Quotation needed', tone: 'warning' };
}

const needsQuote = (r: SupplierRfqListItem) => r.can_respond && ['PENDING', 'VIEWED', 'REVISION_REQUESTED'].includes(r.status);

interface Props {
  onOpen: (rfq_supplier_sno: number) => void;
}

/** The requests for quotation the purchase team has sent to this supplier. */
const SupplierRfqList: React.FC<Props> = ({ onOpen }) => {
  const [rows, setRows] = useState<SupplierRfqListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierAxios.get(supplierGetRfqs);
      setRows(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load quotation requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inFilter = (r: SupplierRfqListItem, f: Filter) =>
    f === 'ALL' ? true
      : f === 'TO_QUOTE' ? needsQuote(r)
        : f === 'SUBMITTED' ? r.status === 'SUBMITTED' && r.can_respond
          : !r.can_respond || ['TAKEN', 'CLOSED', 'DECLINED'].includes(r.status);

  const shown = useMemo(() => rows.filter((r) => inFilter(r, filter)), [rows, filter]);
  const count = (f: Filter) => rows.filter((r) => inFilter(r, f)).length;

  return (
    <div className="@container">
      <div className="space-y-4 px-3 py-4 sm:px-5">
        <DetailHero
          icon={ClipboardList}
          eyebrow="Supplier portal"
          title="Quotation Requests"
          subtitle="Requests for quotation sent to you by the purchase team - give your rates here, and submit again if they change."
          metrics={[
            { label: 'Waiting for your quotation', value: count('TO_QUOTE'), valueClassName: count('TO_QUOTE') > 0 ? 'text-amber-700 dark:text-amber-300' : undefined },
            { label: 'Submitted', value: rows.filter((r) => r.response_count > 0).length },
            { label: 'Accepted', value: rows.filter((r) => r.status === 'TAKEN').length, valueClassName: 'text-emerald-700 dark:text-emerald-300' },
          ]}
        />

        <Panel icon={ClipboardList} title={`Requests (${shown.length})`} bodyClassName="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5">
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All', count: count('ALL') },
                { value: 'TO_QUOTE', label: 'To quote', count: count('TO_QUOTE') },
                { value: 'SUBMITTED', label: 'Submitted', count: count('SUBMITTED') },
                { value: 'CLOSED', label: 'Closed', count: count('CLOSED') },
              ]}
            />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={load} disabled={loading} aria-label="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? 'No quotation requests yet - when the purchase team asks you for a quotation it appears here (and in your e-mail).' : 'Nothing in this view.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className={th}>Request</TableHead>
                    <TableHead className={th}>From</TableHead>
                    <TableHead className={cn(th, 'text-right')}>Items</TableHead>
                    <TableHead className={th}>Respond by</TableHead>
                    <TableHead className={th}>Status</TableHead>
                    <TableHead className={th}>Your quotation</TableHead>
                    <TableHead className={cn(th, 'text-right')} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => {
                    const badge = rfqBadge(r);
                    const quoted = r.response_count > 0;
                    return (
                      <TableRow key={r.rfq_supplier_sno} className="cursor-pointer" onClick={() => onOpen(r.rfq_supplier_sno)}>
                        <TableCell className="text-xs font-semibold">
                          {r.rfq_no}
                          <span className="block font-normal text-muted-foreground">sent {formatDate(r.requested_at.slice(0, 10))}</span>
                        </TableCell>
                        <TableCell className="text-xs">{r.com_name ?? '—'}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{r.item_count}</TableCell>
                        <TableCell className="text-xs">{formatDate(r.due_date)}</TableCell>
                        <TableCell>
                          <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
                          {r.status === 'REVISION_REQUESTED' && r.revision_note && (
                            <span className="mt-0.5 block max-w-[16rem] truncate text-[11px] text-muted-foreground" title={r.revision_note}>{r.revision_note}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {quoted ? (
                            <>
                              <span className="block text-sm font-semibold tabular-nums">{formatINR(r.grand_total)}</span>
                              <span className="text-muted-foreground">v{r.current_version} · {dateTime(r.last_submitted_at)}</span>
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={needsQuote(r) ? 'default' : 'outline'}
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); onOpen(r.rfq_supplier_sno); }}
                          >
                            {r.status === 'REVISION_REQUESTED' && r.can_respond ? 'Revise quotation' : needsQuote(r) ? 'Give quotation' : r.can_respond && quoted ? 'View / revise' : 'View'}
                          </Button>
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

export default SupplierRfqList;
