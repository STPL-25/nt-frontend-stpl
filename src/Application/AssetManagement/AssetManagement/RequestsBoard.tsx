import React, { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AssetRequest } from '@/Services/GrnService/assetApi';
import {
  STAGES, daysLabel, daysLate, daysSince, initials, isPending, isThisMonth, nextStepLabel, stageOf,
  type Stage, type Tone,
} from './helpers';
import { KindTag, Monogram, Pill } from './badges';
import { TONE } from './tones';

interface Props {
  rows: AssetRequest[];
  loading: boolean;
  myEcno: string | null;
  onOpen: (id: number) => void;
}

const ALL = '__all__';
const CLOSED_PREVIEW = 5;

const closedLabel = (r: AssetRequest): { text: string; tone: Tone } => {
  if (r.status === 'Completed') return { text: 'Done · OK', tone: 'green' };
  if (r.status === 'Closed') return { text: r.debit_note_no ? 'Closed · DN' : 'Closed', tone: 'green' };
  if (r.status === 'Rejected') return { text: 'Rejected', tone: 'red' };
  return { text: r.status, tone: 'slate' };
};

const CARD = 'flex w-full snap-start flex-col text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const RequestCard: React.FC<{ r: AssetRequest; mine: boolean; onOpen: () => void }> = ({ r, mine, onOpen }) => {
  const stage = stageOf(r.status);
  const late = daysLate(r);

  if (stage === 'closed') {
    const c = closedLabel(r);
    return (
      <button type="button" onClick={onOpen} className={cn(CARD, 'gap-1.5 rounded-xl bg-card/70 p-2.5 ring-1 ring-border/70 hover:bg-card hover:ring-primary/40')}>
        <span className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">{r.request_no}</span>
          <Pill tone={c.tone} className="h-5 px-2 text-[11px]">{c.text}</Pill>
        </span>
        <span className="text-[13px] font-medium leading-snug">{r.item_name} × {r.qty}</span>
      </button>
    );
  }

  const step = nextStepLabel(r);
  const who = isPending(r.status) ? (mine ? 'You' : r.current_approver_name ?? r.current_approver_ecno) : null;
  const days = daysSince(r.updated_at ?? r.created_at);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        CARD,
        'gap-2.5 rounded-xl bg-card p-3 shadow-sm ring-1 ring-border hover:shadow-md hover:ring-primary/40',
        mine && 'ring-2 ring-primary hover:ring-primary',
        !mine && late > 0 && 'ring-red-300 hover:ring-red-400 dark:ring-red-500/40 dark:hover:ring-red-400/60',
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-xs font-medium text-muted-foreground">{r.request_no}</span>
        <KindTag r={r} className="h-5 px-1.5 text-[11px]" />
      </span>
      <span className="text-sm font-semibold leading-snug">{r.item_name} × {r.qty}</span>
      <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {r.dept_name ?? '—'}
        {r.raised_role === 'STORE' && ' · raised by Store'}
        {r.request_type === 'SERVICE' && r.service_vendor && r.status === 'At Vendor' ? ` · at ${r.service_vendor}` : ''}
        {r.request_type === 'RETURN' && r.supplier_name ? ` · ${r.supplier_name}` : ''}
        {r.reason ? ` · ${r.reason}` : ''}
      </span>
      <span className="flex items-center justify-between gap-2 border-t pt-2.5">
        <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs', mine ? 'font-semibold text-foreground' : 'text-foreground/80')}>
          {who && (
            <Monogram
              text={mine ? 'You' : initials(who)}
              className={cn('h-6 min-w-6 px-1 text-[10px]', mine && 'bg-primary text-primary-foreground')}
            />
          )}
          <span className="truncate">{step}{who && !mine ? ` · ${who}` : ''}</span>
        </span>
        {late > 0
          ? <Pill tone="red" className="h-5 px-2 text-[11px]">{late} day{late > 1 ? 's' : ''} late</Pill>
          : <span className="shrink-0 text-xs text-muted-foreground" title="Days in this stage">{daysLabel(days)}</span>}
      </span>
    </button>
  );
};

const RequestsBoard: React.FC<Props> = ({ rows, loading, myEcno, onOpen }) => {
  const [type, setType] = useState<'ALL' | 'RETURN' | 'SERVICE'>('ALL');
  const [dept, setDept] = useState(ALL);
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState('');
  const [showAllClosed, setShowAllClosed] = useState(false);

  const deptOptions = useMemo(() => Array.from(new Set(rows.map(r => r.dept_name).filter(Boolean) as string[])).sort(), [rows]);

  const isMine = (r: AssetRequest) => !!myEcno && isPending(r.status) && r.current_approver_ecno === myEcno;

  const columns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Record<Stage, AssetRequest[]> = { approval: [], act: [], out: [], back: [], closed: [] };
    for (const r of rows) {
      if (type !== 'ALL' && r.request_type !== type) continue;
      if (dept !== ALL && r.dept_name !== dept) continue;
      if (onlyMine && !isMine(r)) continue;
      if (q && !`${r.request_no} ${r.item_name} ${r.item_code ?? ''}`.toLowerCase().includes(q)) continue;
      const s = stageOf(r.status);
      if (s === 'closed' && !showAllClosed && !isThisMonth(r.completed_at ?? r.updated_at ?? r.created_at)) continue;
      out[s].push(r);
    }
    // oldest first in the working columns, so whatever has waited longest is on top
    for (const s of ['approval', 'act', 'out', 'back'] as Stage[]) {
      out[s].sort((a, b) => (a.updated_at ?? a.created_at).localeCompare(b.updated_at ?? b.created_at));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, type, dept, onlyMine, search, showAllClosed, myEcno]);

  const segments: { key: typeof type; label: string }[] = [
    { key: 'ALL', label: 'All' }, { key: 'RETURN', label: 'Returns' }, { key: 'SERVICE', label: 'Service' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="radiogroup" aria-label="Request type" className="order-1 inline-flex gap-0.5 rounded-xl bg-muted p-1">
          {segments.map(s => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={type === s.key}
              onClick={() => setType(s.key)}
              className={cn(
                'h-8 rounded-lg px-3.5 text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                type === s.key ? 'bg-card font-semibold text-foreground shadow-sm ring-1 ring-border' : 'font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="order-3 w-full bg-card @xl:w-52 @4xl:order-2" aria-label="Department"><SelectValue placeholder="All departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {deptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className={cn(
          'order-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors @4xl:order-3',
          onlyMine && 'border-primary/50 bg-primary/5',
        )}>
          <Checkbox checked={onlyMine} onCheckedChange={v => setOnlyMine(v === true)} />
          Waiting on me
        </label>
        <div className="relative order-4 w-full @xl:ml-auto @xl:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Request no or item" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search requests" />
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid snap-x snap-mandatory auto-cols-[84%] grid-flow-col items-start gap-3 overflow-x-auto pb-2 @2xl:auto-cols-[minmax(216px,1fr)] @min-[1048px]:auto-cols-[minmax(0,1fr)]">
          {STAGES.map(s => {
            const list = columns[s.key];
            const shown = s.key === 'closed' && !showAllClosed ? list.slice(0, CLOSED_PREVIEW) : list;
            return (
              <section
                key={s.key}
                aria-label={s.label}
                className={cn('flex snap-start flex-col gap-2.5 rounded-2xl border-t-[3px] p-2.5', TONE[s.tone].edge, s.key === 'closed' ? 'bg-muted/35' : 'bg-muted/60')}
              >
                <h2 className="flex items-center gap-2 px-1 pt-1 text-[13px] font-semibold">
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', TONE[s.tone].dot)} />
                  {s.key === 'closed' && showAllClosed ? 'Closed' : s.label}
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">{list.length}</span>
                </h2>
                {shown.length === 0 && (
                  <p className="rounded-xl border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</p>
                )}
                {shown.map(r => (
                  <RequestCard key={r.asset_req_sno} r={r} mine={isMine(r)} onOpen={() => onOpen(r.asset_req_sno)} />
                ))}
                {s.key === 'closed' && (
                  <button type="button" onClick={() => setShowAllClosed(v => !v)} className="self-start rounded px-1 text-xs font-semibold text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {showAllClosed ? 'Only this month' : 'View all closed →'}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-[18px] items-center rounded-full bg-primary px-1.5 text-[9px] font-bold text-primary-foreground">You</span> waiting on you</span>
        <span>Day count = days in the current stage</span>
        <span>Oldest first in each column</span>
      </p>
    </div>
  );
};

export default RequestsBoard;
