import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AssetAction, AssetRequest } from '@/Services/GrnService/assetApi';
import { daysLabel, daysSince, fmtDate } from './helpers';
import { KindTag } from './badges';

interface Props {
  rows: AssetRequest[];
  loading: boolean;
  acting: boolean;
  onAct: (id: number, action: AssetAction, extra?: Record<string, unknown>) => Promise<boolean>;
  onOpen: (id: number) => void;
}

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

  return (
    <article className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{r.request_no} · {daysLabel(daysSince(r.updated_at ?? r.created_at))}</span>
        <KindTag r={r} />
      </div>
      <div>
        <h2 className="text-base font-semibold">{r.item_name} × {r.qty}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {r.dept_name ?? '—'} · {r.raised_by_name ?? r.raised_by}{r.raised_role === 'STORE' ? ' (Store)' : ''}
          {r.request_type === 'RETURN' && r.supplier_name ? ` · to ${r.supplier_name}` : ''}
          {r.request_type === 'SERVICE' && r.service_vendor ? ` · to ${r.service_vendor}` : ''}
        </p>
      </div>
      <p className="rounded-lg bg-muted/60 p-2.5 text-[13px] leading-relaxed">{r.reason}</p>
      {r.request_type === 'SERVICE' && (
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-xs text-muted-foreground">Cost</dt><dd className="mt-0.5 text-[13px] font-semibold">{r.payment_applicable === 'Y' ? `₹ ${Number(r.est_amount ?? 0).toLocaleString('en-IN')}` : 'No cost'}</dd></div>
          {r.service_mode === 'OUTPASS' && <div><dt className="text-xs text-muted-foreground">Back by</dt><dd className="mt-0.5 text-[13px] font-semibold">{fmtDate(r.expected_return_date)}</dd></div>}
        </dl>
      )}
      {rejecting && (
        <div className="space-y-1">
          <Textarea rows={2} autoFocus placeholder="Reason for rejecting (required)" value={remarks} onChange={e => setRemarks(e.target.value)} aria-label="Reason for rejecting" />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
      <div className="mt-auto flex gap-2 pt-1">
        <Button
          variant="outline"
          className="h-11 flex-1 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400"
          disabled={acting}
          onClick={reject}
        >
          {rejecting ? 'Confirm reject' : 'Reject'}
        </Button>
        {rejecting
          ? <Button variant="ghost" className="h-11" disabled={acting} onClick={() => { setRejecting(false); setError(''); }}>Back</Button>
          : (
            <Button className="h-11 flex-1" disabled={acting} onClick={() => onAct(r.asset_req_sno, 'APPROVE')}>
              {acting && <Loader2 className="h-4 w-4 animate-spin" />} Approve
            </Button>
          )}
      </div>
      <button type="button" onClick={onOpen} className="self-center px-1 py-1 text-[13px] font-semibold text-primary hover:underline">
        Open details &amp; history
      </button>
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
      <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
        Nothing is waiting for your approval.
      </div>
    );
  }
  // oldest first: whatever has waited longest is on top
  const sorted = [...rows].sort((a, b) => (a.updated_at ?? a.created_at).localeCompare(b.updated_at ?? b.created_at));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map(r => (
        <ApprovalCard key={r.asset_req_sno} r={r} acting={acting} onAct={onAct} onOpen={() => onOpen(r.asset_req_sno)} />
      ))}
    </div>
  );
};

export default ApprovalsTab;
