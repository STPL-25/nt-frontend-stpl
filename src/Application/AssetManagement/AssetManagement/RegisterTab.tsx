import React, { useMemo, useState } from 'react';
import { Boxes, ChevronRight, Loader2, PackageSearch, RotateCcw, Search, Truck, Undo2, Wrench, BellRing, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AssetRequest, AssetRow } from '@/Services/GrnService/assetApi';
import { daysLate, fmtDate, initials, isClosed, kindLabel, statusTone } from './helpers';
import { IconTile, Meter, Monogram, Pill } from './badges';
import { TONE, assetIcon } from './tones';

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
  sub_category: string | null;
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

/** One-line description of an open request on a department line. */
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

const Kpi: React.FC<{
  icon: LucideIcon;
  iconClass: string;
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ icon: Icon, iconClass, label, onClick, children }) => {
  const body = (
    <>
      <span aria-hidden="true" className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl @xl:h-11 @xl:w-11', iconClass)}>
        <Icon className="h-[18px] w-[18px] @xl:h-5 @xl:w-5" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">{children}</span>
      </span>
    </>
  );
  // two across on a phone (icon above the text), icon beside the text from tablet width up
  const base = 'relative flex flex-col items-start gap-2.5 rounded-2xl border bg-card p-3.5 shadow-sm @xl:flex-row @xl:items-center @xl:gap-3.5 @xl:p-4';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, 'group w-full transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
    >
      {body}
      <ChevronRight className="absolute right-3 top-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 @xl:static" aria-hidden="true" />
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
};

const KpiValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-2xl font-semibold leading-none tabular-nums">{children}</span>
);

const Count: React.FC<{ dot: string; label: string; value: number }> = ({ dot, label, value }) => (
  <div className="flex items-center gap-2.5">
    <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} />
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold leading-tight tabular-nums">{value}</dd>
    </div>
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
          sub_category: r.sub_category, supplier: r.default_supplier_name, issued: 0, inUse: 0, service: 0, returned: 0,
          lines: [], depts: new Set(), open: 0,
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
  const share = (n: number, total: number) => `${total > 0 ? (n / total) * 100 : 0}%`;

  return (
    <div className="space-y-4">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
        <Kpi icon={Boxes} iconClass={cn(TONE.green.tint, TONE.green.text)} label="In use">
          <KpiValue>{summary.inUse}</KpiValue>
          <span className="text-xs text-muted-foreground">units · {summary.products} product{summary.products !== 1 ? 's' : ''}</span>
        </Kpi>
        <Kpi icon={Wrench} iconClass={cn(TONE.violet.tint, TONE.violet.text)} label="Out for service">
          <KpiValue>{summary.service}</KpiValue>
          {summary.late > 0 && <Pill tone="red">{summary.late} overdue</Pill>}
        </Kpi>
        <Kpi icon={Undo2} iconClass={cn(TONE.teal.tint, TONE.teal.text)} label="Returning to supplier">
          <KpiValue>{summary.returns}</KpiValue>
        </Kpi>
        <Kpi
          icon={BellRing}
          iconClass={cn(TONE.amber.tint, TONE.amber.text)}
          label="Needs my action"
          onClick={mineCount > 0 ? onShowApprovals : undefined}
        >
          <KpiValue>{mineCount}</KpiValue>
          {mineCount > 0 && <span className="text-xs font-semibold text-foreground/80 underline underline-offset-2">Review now</span>}
        </Kpi>
      </section>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
          <section aria-label="Products" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="h-10 bg-background pl-9" placeholder="Search product, code or issue no" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search products" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={dept} onValueChange={setDept}>
                  <SelectTrigger className="w-full bg-background" aria-label="Department"><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All departments</SelectItem>
                    {deptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full bg-background" aria-label="Category"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {products.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <IconTile icon={PackageSearch} className="h-12 w-12 rounded-full" iconClassName="h-5 w-5" />
                <p className="max-w-[240px] text-sm text-muted-foreground">
                  {rows.every(r => r.in_use_qty <= 0 && r.service_qty <= 0) ? 'No assets in use. Non-Regular items appear here once they are issued to a department.' : 'Nothing matches these filters.'}
                </p>
              </div>
            ) : (
              <ul className="max-h-[640px] space-y-1 overflow-y-auto p-2">
                {products.map(p => {
                  const active = p.item_sno === current?.item_sno;
                  return (
                    <li key={p.item_sno}>
                      <button
                        type="button"
                        aria-current={active || undefined}
                        onClick={() => setSelected(p.item_sno)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active && 'bg-primary/10 ring-1 ring-primary/30 hover:bg-primary/10',
                        )}
                      >
                        <IconTile icon={assetIcon(p.category, p.sub_category)} className={cn('h-10 w-10', active && 'bg-primary text-primary-foreground')} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.item_name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="truncate">{p.item_code} · {p.depts.size} department{p.depts.size !== 1 ? 's' : ''}</span>
                            {p.open > 0 && <Pill tone="amber" className="h-5 px-2 text-[11px]">{p.open} open</Pill>}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-lg font-semibold leading-none tabular-nums">{p.inUse}</span>
                          <span className="text-[11px] text-muted-foreground">in use</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {current && (
            <section aria-labelledby="asset-selected" className="min-w-0 space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <IconTile icon={assetIcon(current.category, current.sub_category)} className="h-12 w-12" iconClassName="h-6 w-6" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 id="asset-selected" className="text-xl font-semibold leading-snug tracking-tight">{current.item_name}</h2>
                      <Pill tone="slate">Non-Regular</Pill>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {current.item_code}{current.category ? ` · ${current.category}` : ''}
                      {current.supplier ? ` · usual supplier ${current.supplier}` : ''}
                    </p>
                  </div>
                </div>

                <div
                  role="img"
                  aria-label={`${current.inUse} in use, ${current.service} in service, ${current.returned} returned, of ${current.issued} issued`}
                  className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted"
                >
                  <span className={cn('h-full', TONE.green.dot)} style={{ width: share(current.inUse, current.issued) }} />
                  <span className={cn('h-full', TONE.violet.dot)} style={{ width: share(current.service, current.issued) }} />
                  <span className={cn('h-full', TONE.slate.dot)} style={{ width: share(current.returned, current.issued) }} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 @2xl:grid-cols-4">
                  <Count dot="bg-foreground/25" label="Issued" value={current.issued} />
                  <Count dot={TONE.green.dot} label="In use" value={current.inUse} />
                  <Count dot={TONE.violet.dot} label="In service" value={current.service} />
                  <Count dot={TONE.slate.dot} label="Returned" value={current.returned} />
                </dl>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
                  <h3 className="text-sm font-semibold">Where it is</h3>
                  <span className="text-xs text-muted-foreground">{current.lines.length} issue{current.lines.length !== 1 ? 's' : ''}</span>
                </div>
                <ul className="divide-y">
                  {current.lines.map(l => {
                    const open = openByLine.get(l.sr_item_sno) ?? [];
                    return (
                      <li key={l.sr_item_sno} className="space-y-3 px-5 py-4">
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                          <Monogram text={initials(l.dept_name)} className="h-10 w-10 rounded-xl text-xs" />
                          <div className="min-w-0 flex-[1_1_200px] space-y-1.5">
                            <div>
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="text-sm font-semibold">{l.dept_name ?? 'Unassigned'}</span>
                                <span className="text-[13px] text-muted-foreground">
                                  <span className="font-semibold text-foreground">{l.in_use_qty}</span> of {l.issued_qty} in use
                                </span>
                              </div>
                              <Meter value={l.in_use_qty} total={l.issued_qty} className="mt-1.5 max-w-[240px]" />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {l.issue_ref} · issued {fmtDate(l.issue_date)}
                              {(l.received_by_name || l.received_by_ecno) && ` · received by ${l.received_by_name ?? l.received_by_ecno}`}
                            </div>
                          </div>
                          {canRaise && l.in_use_qty > 0 && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => onRaise(l, 'RETURN')}><RotateCcw className="h-3.5 w-3.5" /> Return</Button>
                              <Button size="sm" variant="outline" onClick={() => onRaise(l, 'SERVICE')}><Wrench className="h-3.5 w-3.5" /> Service</Button>
                            </div>
                          )}
                        </div>
                        {open.length > 0 && (
                          <div className="space-y-1.5 @xl:pl-14">
                            {open.map(r => {
                              const KindIcon = r.request_type === 'RETURN' ? RotateCcw : r.service_mode === 'INSTORE' ? Wrench : Truck;
                              return (
                                <button
                                  key={r.asset_req_sno}
                                  type="button"
                                  onClick={() => onOpen(r.asset_req_sno)}
                                  className={cn(
                                    'flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ring-1 ring-inset transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 dark:hover:brightness-110',
                                    TONE[daysLate(r) > 0 ? 'red' : statusTone(r.status)].chip,
                                  )}
                                >
                                  <KindIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span className="min-w-0 flex-1">{r.request_no} · {openRequestText(r)}</span>
                                  <ChevronRight className="mt-px h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <h3 className="border-b px-5 py-3.5 text-sm font-semibold">Past requests for this item</h3>
                {past.length === 0 ? (
                  <p className="px-5 py-5 text-sm text-muted-foreground">No finished requests yet.</p>
                ) : (
                  <ul className="divide-y">
                    {past.map(r => (
                      <li key={r.asset_req_sno}>
                        <button
                          type="button"
                          className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 py-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          onClick={() => onOpen(r.asset_req_sno)}
                        >
                          <span className="min-w-0">
                            <span className="font-semibold">{r.request_no}</span>
                            <span className="text-muted-foreground"> · {kindLabel(r)} · {r.dept_name ?? '—'} · {r.qty} {r.uom ?? ''}</span>
                          </span>
                          <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                            <Pill tone={statusTone(r.status)} dot>{r.status === 'Completed' ? 'Completed OK' : r.status}</Pill>
                            {fmtDate(r.completed_at ?? r.updated_at ?? r.created_at)}
                          </span>
                        </button>
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
