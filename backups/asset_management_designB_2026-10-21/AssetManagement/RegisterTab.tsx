import React, { useMemo, useState } from 'react';
import { Loader2, Search, RotateCcw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AssetRequest, AssetRow } from '@/Services/GrnService/assetApi';
import { daysLate, fmtDate, initials, isClosed, kindLabel } from './helpers';
import { Tag } from './badges';

interface Summary {
  inUse: number;
  products: number;
  service: number;
  late: number;
  returns: number;
}

interface Props {
  rows: AssetRow[];
  requests: AssetRequest[];
  loading: boolean;
  canRaise: boolean;
  summary: Summary;
  mineCount: number;
  onRaise: (row: AssetRow, type: 'RETURN' | 'SERVICE') => void;
  onOpen: (id: number) => void;
  onShowApprovals: () => void;
}

interface Product {
  item_sno: number;
  item_name: string;
  item_code: string;
  uom: string;
  category: string | null;
  supplier: string | null;
  issued: number;
  inUse: number;
  service: number;
  returned: number;
  lines: AssetRow[];
  depts: Set<string>;
  open: number;
}

const ALL = '__all__';

/** One-line description of an open request on a department line, coloured by what it is. */
const openRequestText = (r: AssetRequest) => {
  const late = daysLate(r);
  if (r.request_type === 'RETURN') {
    const where = r.supplier_name ? ` to ${r.supplier_name}` : '';
    if (r.status === 'Goods Returned') return `${r.qty} returned${where} · debit note pending`;
    return `${r.qty} for return${where} · ${r.status.toLowerCase()}`;
  }
  const where = r.service_vendor ? ` at ${r.service_vendor}` : '';
  if (r.status === 'At Vendor') return `${r.qty}${where}${late ? ` · ${late} day${late > 1 ? 's' : ''} overdue` : ''}`;
  return `${r.qty} for ${kindLabel(r).toLowerCase()} · ${r.status.toLowerCase()}${late ? ` · ${late} days overdue` : ''}`;
};

const Stat: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={cn('min-w-[180px] flex-1 px-4 py-3 sm:px-5', className)}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-0.5 text-[22px] font-bold tabular-nums">{children}</div>
  </div>
);

const RegisterTab: React.FC<Props> = ({
  rows, requests, loading, canRaise, summary, mineCount, onRaise, onOpen, onShowApprovals,
}) => {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [selected, setSelected] = useState<number | null>(null);

  const openByLine = useMemo(() => {
    const m = new Map<number, AssetRequest[]>();
    for (const r of requests) {
      if (isClosed(r.status)) continue;
      const list = m.get(r.sr_item_sno) ?? [];
      list.push(r);
      m.set(r.sr_item_sno, list);
    }
    return m;
  }, [requests]);

  const deptOptions = useMemo(() => Array.from(new Set(rows.map(r => r.dept_name ?? 'Unassigned'))).sort(), [rows]);
  const categoryOptions = useMemo(() => Array.from(new Set(rows.map(r => r.category).filter(Boolean) as string[])).sort(), [rows]);

  const products = useMemo<Product[]>(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<number, Product>();
    for (const r of rows) {
      // lines that are fully returned and have nothing open are history, not assets
      if (r.in_use_qty <= 0 && r.service_qty <= 0 && !openByLine.has(r.sr_item_sno)) continue;
      const d = r.dept_name ?? 'Unassigned';
      if (dept !== ALL && d !== dept) continue;
      if (category !== ALL && r.category !== category) continue;
      if (q && !`${r.item_name} ${r.item_code} ${r.issue_ref} ${d}`.toLowerCase().includes(q)) continue;
      let p = map.get(r.item_sno);
      if (!p) {
        p = {
          item_sno: r.item_sno, item_name: r.item_name, item_code: r.item_code, uom: r.uom, category: r.category,
          supplier: r.default_supplier_name, issued: 0, inUse: 0, service: 0, returned: 0, lines: [], depts: new Set(), open: 0,
        };
        map.set(r.item_sno, p);
      }
      p.issued += r.issued_qty;
      p.inUse += r.in_use_qty;
      p.service += r.service_qty;
      p.returned += r.returned_qty;
      p.lines.push(r);
      p.depts.add(d);
      p.open += openByLine.get(r.sr_item_sno)?.length ?? 0;
    }
    return Array.from(map.values()).sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [rows, search, dept, category, openByLine]);

  // Always show a product: the one clicked, or the first still visible after filtering.
  const current = products.find(p => p.item_sno === selected) ?? products[0] ?? null;
  const past = useMemo(
    () => (current ? requests.filter(r => r.item_sno === current.item_sno && isClosed(r.status)).slice(0, 5) : []),
    [requests, current],
  );

  return (
    <div className="space-y-4">
      <section aria-label="Summary" className="flex flex-wrap divide-x rounded-xl border bg-card">
        <Stat label="In use">{summary.inUse} <span className="text-sm font-medium text-muted-foreground">units · {summary.products} products</span></Stat>
        <Stat label="Out for service">
          {summary.service}
          {summary.late > 0 && <span className="text-sm font-semibold text-red-700"> · {summary.late} overdue</span>}
        </Stat>
        <Stat label="Returning to supplier">{summary.returns}</Stat>
        <Stat label="Needs my action">
          {mineCount > 0
            ? <button type="button" onClick={onShowApprovals} className="text-primary hover:underline">{mineCount}</button>
            : 0}
        </Stat>
      </section>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <section aria-label="Products" className="w-full overflow-hidden rounded-xl border bg-card lg:w-[400px] lg:shrink-0">
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search product, code or issue no" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search products" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={dept} onValueChange={setDept}>
                  <SelectTrigger className="w-full" aria-label="Department"><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All departments</SelectItem>
                    {deptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full" aria-label="Category"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {products.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                {rows.every(r => r.in_use_qty <= 0 && r.service_qty <= 0) ? 'No assets in use. Non-Regular items appear here once they are issued to a department.' : 'Nothing matches these filters.'}
              </p>
            ) : (
              <ul className="max-h-[640px] overflow-y-auto">
                {products.map(p => {
                  const active = p.item_sno === current?.item_sno;
                  return (
                    <li key={p.item_sno}>
                      <button
                        type="button"
                        aria-current={active || undefined}
                        onClick={() => setSelected(p.item_sno)}
                        className={cn(
                          'flex w-full items-center gap-3 border-b px-3.5 py-3 text-left last:border-b-0 hover:bg-muted/50',
                          active && 'bg-primary/5 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/5',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.item_name}</span>
                          <span className="text-xs text-muted-foreground">{p.item_code} · {p.depts.size} department{p.depts.size !== 1 ? 's' : ''}</span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="text-base font-bold tabular-nums">{p.inUse}</span>
                          {p.open > 0 && <Tag tone="outside" className="h-[18px]">{p.open} open</Tag>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {current && (
            <section aria-labelledby="asset-selected" className="min-w-0 flex-[999_1_560px] space-y-4">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="asset-selected" className="text-xl font-bold">{current.item_name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {current.item_code}{current.category ? ` · ${current.category}` : ''}
                      {current.supplier ? ` · usual supplier ${current.supplier}` : ''}
                    </p>
                  </div>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Non-Regular</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Issued</dt><dd className="mt-0.5 text-xl font-bold tabular-nums">{current.issued}</dd></div>
                  <div className="rounded-lg bg-primary/10 p-3"><dt className="text-xs text-muted-foreground">In use</dt><dd className="mt-0.5 text-xl font-bold tabular-nums text-primary">{current.inUse}</dd></div>
                  <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/30"><dt className="text-xs text-muted-foreground">In service</dt><dd className="mt-0.5 text-xl font-bold tabular-nums text-orange-800 dark:text-orange-300">{current.service}</dd></div>
                  <div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Returned</dt><dd className="mt-0.5 text-xl font-bold tabular-nums">{current.returned}</dd></div>
                </dl>
              </div>

              <div className="overflow-hidden rounded-xl border bg-card">
                <h3 className="border-b px-5 py-3.5 text-sm font-semibold">Where it is</h3>
                <ul>
                  {current.lines.map(l => {
                    const open = openByLine.get(l.sr_item_sno) ?? [];
                    return (
                      <li key={l.sr_item_sno} className="flex flex-wrap items-center gap-3.5 border-b px-5 py-3.5 last:border-b-0">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-bold text-primary">
                          {initials(l.dept_name)}
                        </span>
                        <div className="min-w-0 flex-[1_1_240px]">
                          <div className="text-sm font-semibold">
                            {l.dept_name ?? 'Unassigned'}{' '}
                            <span className="font-normal text-muted-foreground">· {l.in_use_qty} of {l.issued_qty} in use</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {l.issue_ref} · issued {fmtDate(l.issue_date)}
                            {(l.received_by_name || l.received_by_ecno) && ` · received by ${l.received_by_name ?? l.received_by_ecno}`}
                          </div>
                          {open.map(r => (
                            <button
                              key={r.asset_req_sno}
                              type="button"
                              onClick={() => onOpen(r.asset_req_sno)}
                              className={cn(
                                'mt-1.5 flex items-center gap-1.5 text-left text-xs font-medium hover:underline',
                                r.request_type === 'RETURN' ? 'text-purple-700 dark:text-purple-300' : daysLate(r) > 0 ? 'text-red-700 dark:text-red-400' : 'text-orange-800 dark:text-orange-300',
                              )}
                            >
                              <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', r.request_type === 'RETURN' ? 'bg-purple-600' : 'bg-orange-600')} />
                              {r.request_no} · {openRequestText(r)}
                            </button>
                          ))}
                        </div>
                        {canRaise && l.in_use_qty > 0 && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => onRaise(l, 'RETURN')}><RotateCcw className="h-3.5 w-3.5" /> Return</Button>
                            <Button size="sm" variant="outline" onClick={() => onRaise(l, 'SERVICE')}><Wrench className="h-3.5 w-3.5" /> Service</Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="overflow-hidden rounded-xl border bg-card">
                <h3 className="border-b px-5 py-3.5 text-sm font-semibold">Past requests for this item</h3>
                {past.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">No finished requests yet.</p>
                ) : (
                  <ul className="px-5 py-1.5 text-sm">
                    {past.map(r => (
                      <li key={r.asset_req_sno} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0">
                        <button type="button" className="text-left hover:underline" onClick={() => onOpen(r.asset_req_sno)}>
                          <span className="font-semibold">{r.request_no}</span> · {kindLabel(r)} · {r.dept_name ?? '—'} · {r.qty} {r.uom ?? ''}
                        </button>
                        <span className={cn('font-medium', r.status === 'Rejected' || r.status === 'Cancelled' ? 'text-muted-foreground' : 'text-green-700 dark:text-green-400')}>
                          {r.status === 'Completed' ? 'Completed OK' : r.status} · {fmtDate(r.completed_at ?? r.updated_at ?? r.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default RegisterTab;
