import React, { useState } from 'react';
import { Building2, CalendarClock, CheckCircle2, Hourglass, IndianRupee, Loader2, Truck, UserRound, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AssetAction, AssetRequest } from '@/Services/GrnService/assetApi';
import { daysLabel, daysSince, fmtDate } from './helpers';
import { KindTag, Pill } from './badges';
import { TONE } from './tones';

interface Props {
  rows: AssetRequest[];
  loading: boolean;
  acting: boolean;
  onAct: (id: number, action: AssetAction, extra?: Record<string, unknown>) => Promise<boolean>;
  onOpen: (id: number) => void;
}

const Fact: React.FC<{ icon: LucideIcon; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex min-w-0 items-start gap-2">
    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-px break-words font-medium">{children}</dd>
    </div>
  </div>
);

const ApprovalCard: React.FC<{ r: AssetRequest; acting: boolean; onAct: Props['onAct']; onOpen: () => void }> = ({ r, acting, onAct, onOpen }) => {
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const reject = async () => {
    if (!rejecting) { setRejecting(true); return; }
    if (!remarks.trim()) { setError('Add a reason for rejecting.'); return; }
    setError('');
    await onAct(r.asset_req_sno, 'REJECT', { remarks: remarks.trim() });
  };

  const raisedBy = `${r.raised_by_name ?? r.raised_by}${r.raised_role === 'STORE' ? ' (Store)' : ''}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div aria-hidden="true" className={cn('h-1', TONE.amber.dot)} />
      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <KindTag r={r} />
          <Pill tone="amber" icon={Hourglass}>Waiting {daysLabel(daysSince(r.updated_at ?? r.created_at))}</Pill>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{r.request_no}</p>
          <h2 className="mt-0.5 text-base font-semibold leading-snug">{r.item_name} × {r.qty}</h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
          <Fact icon={Building2} label="Department">{r.dept_name ?? '—'}</Fact>
          <Fact icon={UserRound} label="Raised by">{raisedBy}</Fact>
          {r.request_type === 'RETURN' && r.supplier_name && <Fact icon={Truck} label="Goes back to">{r.supplier_name}</Fact>}
          {r.request_type === 'SERVICE' && r.service_vendor && <Fact icon={Truck} label="Vendor">{r.service_vendor}</Fact>}
          {r.request_type === 'SERVICE' && (
            <Fact icon={IndianRupee} label="Cost">{r.payment_applicable === 'Y' ? `₹ ${Number(r.est_amount ?? 0).toLocaleString('en-IN')}` : 'No cost'}</Fact>
          )}
          {r.request_type === 'SERVICE' && r.service_mode === 'OUTPASS' && <Fact icon={CalendarClock} label="Back by">{fmtDate(r.expected_return_date)}</Fact>}
        </dl>
        <blockquote className="rounded-xl bg-muted/60 p-3 text-[13px] leading-relaxed">{r.reason}</blockquote>
        {rejecting && (
          <div className="space-y-1">
            <Textarea rows={2} autoFocus placeholder="Reason for rejecting (required)" value={remarks} onChange={e => setRemarks(e.target.value)} aria-label="Reason for rejecting" />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <div className="mt-auto flex gap-2 pt-1">
          <Button
            variant="outline"
            className="h-11 flex-1 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
            disabled={acting}
            onClick={reject}
          >
            {rejecting ? 'Confirm reject' : 'Reject'}
          </Button>
          {rejecting
            ? <Button variant="ghost" className="h-11" disabled={acting} onClick={() => { setRejecting(false); setError(''); }}>Back</Button>
            : (
              <Button className="h-11 flex-1 shadow-sm" disabled={acting} onClick={() => onAct(r.asset_req_sno, 'APPROVE')}>
                {acting && <Loader2 className="h-4 w-4 animate-spin" />} Approve
              </Button>
            )}
        </div>
        <button type="button" onClick={onOpen} className="self-center rounded px-1 py-0.5 text-[13px] font-semibold text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Open details &amp; history
        </button>
      </div>
    </article>
  );
};

const ApprovalsTab: React.FC<Props> = ({ rows, loading, acting, onAct, onOpen }) => {
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
        <span aria-hidden="true" className={cn('grid h-14 w-14 place-items-center rounded-full', TONE.green.tint, TONE.green.text)}>
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <div>
          <p className="text-base font-semibold">You&apos;re all caught up</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Nothing is waiting for your approval.</p>
        </div>
      </div>
    );
  }
  // oldest first: whatever has waited longest is on top
  const sorted = [...rows].sort((a, b) => (a.updated_at ?? a.created_at).localeCompare(b.updated_at ?? b.created_at));
  return (
    <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3">
      {sorted.map(r => (
        <ApprovalCard key={r.asset_req_sno} r={r} acting={acting} onAct={onAct} onOpen={() => onOpen(r.asset_req_sno)} />
      ))}
    </div>
  );
};

export default ApprovalsTab;
