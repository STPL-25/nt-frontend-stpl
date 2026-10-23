import React, { useState } from 'react';
import { Check, Clock, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { AssetAction, AssetRequestDetail } from '@/Services/GrnService/assetApi';
import {
  daysLate, fmtDate, fmtDateTime, isClosed, isPending, nextStepLabel, statusTone, upcomingSteps,
} from './helpers';
import { KindTag, Pill, StatusBadge } from './badges';
import { TONE } from './tones';

interface Props {
  detail: AssetRequestDetail | null;
  loading: boolean;
  open: boolean;
  me: { ecno?: string } | null;
  /** operational actions (return order, gate pass, GRN, debit note…) need edit permission */
  canOperate: boolean;
  acting: boolean;
  onClose: () => void;
  onAct: (action: AssetAction, extra?: Record<string, unknown>) => Promise<boolean>;
}

const Fact: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={cn('mt-0.5 truncate text-[13px] font-medium', className)}>{children || '—'}</dd>
  </div>
);

const eventDot = (event: string) => {
  const e = event.toLowerCase();
  if (e.includes('reject') || e.includes('not ok') || e.includes('debit note') || e.includes('cancel')) return TONE.red.dot;
  if (e.includes('approv') || e.includes('quality ok') || e.includes('complete')) return TONE.green.dot;
  if (e.includes('gate pass') || e.includes('vendor') || e.includes('service')) return TONE.violet.dot;
  return TONE.slate.dot;
};

const RequestDrawer: React.FC<Props> = ({ detail, loading, open, me, canOperate, acting, onClose, onAct }) => {
  const [remarks, setRemarks] = useState('');
  const [dcIn, setDcIn] = useState('');
  const [tech, setTech] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  // Clear the inputs whenever a different request, or a new stage of the same one, is shown.
  const resetKey = `${detail?.request.asset_req_sno ?? ''}:${detail?.request.status ?? ''}`;
  const [shownKey, setShownKey] = useState(resetKey);
  if (shownKey !== resetKey) {
    setShownKey(resetKey);
    setRemarks(''); setDcIn(''); setTech(''); setPrice(''); setError('');
  }

  const r = detail?.request;
  const isApprover = !!r && !!me?.ecno && r.current_approver_ecno === me.ecno && isPending(r.status);
  const isRaiser = !!r && !!me?.ecno && r.raised_by === me.ecno;
  const late = r ? daysLate(r) : 0;

  const run = (action: AssetAction, extra: Record<string, unknown> = {}, needsRemarks = false) => {
    if (needsRemarks && !remarks.trim()) { setError('Please add a remark first.'); return; }
    setError('');
    onAct(action, { remarks: remarks.trim() || undefined, ...extra });
  };

  const btn = (label: string, action: AssetAction, extra?: Record<string, unknown>, opts: { variant?: 'default' | 'outline' | 'destructive'; needsRemarks?: boolean } = {}) => (
    <Button
      size="sm"
      className="h-10 flex-[1_1_auto] shadow-sm sm:flex-none"
      variant={opts.variant ?? 'default'}
      disabled={acting}
      onClick={() => run(action, extra, opts.needsRemarks)}
    >
      {acting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{label}
    </Button>
  );

  const priceField = (
    <div className="space-y-1.5">
      <Label className="text-xs">Unit price (blank = item cost)</Label>
      <Input className="h-10 bg-card" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} />
    </div>
  );

  // The operational step for the current status: [hint, inputs + buttons, needs a remarks box]
  const operational = (): { hint: string; body: React.ReactNode; remarksBox?: boolean } | null => {
    if (!r || !canOperate) return null;
    const unitPrice = { unit_price: price ? Number(price) : undefined };
    if (r.request_type === 'RETURN') {
      if (r.status === 'Approved') return { hint: 'Create the Return Order for the supplier.', body: btn('Raise Return Order', 'RAISE_RETURN_ORDER') };
      if (r.status === 'Return Order Raised') return { hint: 'Send the goods back. A Delivery Challan and gate pass are created.', body: btn('Gate pass OUT (create DC)', 'GATE_OUT') };
      if (r.status === 'Goods Returned') return { hint: 'Raise the debit note against the supplier to close this return.', body: <>{priceField}{btn('Raise Debit Note', 'RAISE_DEBIT_NOTE', unitPrice)}</> };
      return null;
    }
    if (r.service_mode === 'OUTPASS') {
      if (r.status === 'Approved') return { hint: 'Send the item to the vendor. A Delivery Challan and gate pass are created.', body: btn('Gate pass OUT (with DC)', 'GATE_OUT') };
      if (r.status === 'At Vendor') {
        return {
          hint: 'When the item comes back, check the DC number on it and record the gate pass.',
          body: (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dc-in">DC number on the returning item</Label>
                <Input id="dc-in" className="h-10 bg-card" value={dcIn} placeholder={r.dc_no ?? ''} onChange={e => setDcIn(e.target.value)} />
              </div>
              {btn('Record gate pass IN', 'GATE_IN', { dc_no: dcIn.trim() })}
            </>
          ),
        };
      }
      if (r.status === 'Received') {
        return {
          hint: 'Check the item and record the GRN against the DC.',
          remarksBox: true,
          body: (
            <div className="flex flex-wrap gap-2">
              {btn('Quality OK — back in use', 'COMPLETE_SERVICE', { result: 'OK' })}
              {btn('Quality NOT OK', 'COMPLETE_SERVICE', { result: 'NOT_OK' }, { variant: 'destructive', needsRemarks: true })}
            </div>
          ),
        };
      }
      if (r.status === 'QC Failed') return { hint: 'The repair failed the quality check. Raise a debit note on the vendor.', remarksBox: true, body: <>{priceField}{btn('Raise Debit Note', 'RAISE_DEBIT_NOTE', unitPrice)}</> };
      if (r.status === 'Debit Note Raised') return { hint: 'Send the item back for another service cycle.', body: btn('Send for re-service', 'RESERVICE') };
      return null;
    }
    if (r.status === 'Approved') {
      return {
        hint: 'Record who is doing the work on site and start the service.',
        body: (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="tech">Technician / vendor on site</Label>
              <Input id="tech" className="h-10 bg-card" value={tech} onChange={e => setTech(e.target.value)} />
            </div>
            {btn('Start service', 'START_SERVICE', { technician: tech.trim() || undefined })}
          </>
        ),
      };
    }
    if (r.status === 'In Progress') {
      return {
        hint: 'Is the item working again?',
        remarksBox: true,
        body: (
          <div className="flex flex-wrap gap-2">
            {btn('Service OK — back in use', 'COMPLETE_SERVICE', { result: 'OK' })}
            {btn('Not OK — re-service', 'COMPLETE_SERVICE', { result: 'NOT_OK' }, { variant: 'destructive', needsRemarks: true })}
          </div>
        ),
      };
    }
    return null;
  };

  const op = operational();
  const waitingStages = detail?.approvals.filter(a => a.status === 'Waiting') ?? [];
  const pendingStage = detail?.approvals.find(a => a.status === 'Pending');
  const history = detail ? [...detail.history].sort((a, b) => a.at.localeCompare(b.at)) : [];
  const upcoming = r ? upcomingSteps(r) : [];
  const docs = r ? [
    r.return_order_no && { label: 'Return Order', no: r.return_order_no },
    r.dc_no && { label: 'DC', no: r.dc_no },
    r.gate_out_no && { label: 'Gate out', no: r.gate_out_no },
    r.gate_in_no && { label: 'Gate in', no: r.gate_in_no },
    r.service_receipt_no && { label: 'GRN', no: r.service_receipt_no },
    r.debit_note_no && { label: 'Debit Note', no: r.debit_note_no },
  ].filter(Boolean) as { label: string; no: string }[] : [];

  // The box on the current step
  const currentCard = (): React.ReactNode => {
    if (!r) return null;
    if (isClosed(r.status)) {
      return (
        <div className="flex flex-col items-start gap-1 pt-0.5">
          <span className={cn('text-sm font-semibold', TONE[statusTone(r.status)].text)}>{r.status === 'Completed' ? 'Back in use' : r.status}</span>
          <span className="text-xs text-muted-foreground">{fmtDateTime(r.completed_at ?? r.updated_at)}</span>
          {r.reject_reason && <span className="mt-1 rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed">“{r.reject_reason}”</span>}
        </div>
      );
    }
    if (isApprover) {
      return (
        <ActionBox title={pendingStage?.stage_name ?? 'Approval'} who="Your decision" hint="Approve to move it on, or reject with a reason.">
          <Textarea rows={2} className="bg-card" placeholder="Remarks (required to reject)" value={remarks} onChange={e => setRemarks(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {btn('Approve', 'APPROVE')}
            {btn('Reject', 'REJECT', undefined, { variant: 'destructive', needsRemarks: true })}
          </div>
        </ActionBox>
      );
    }
    if (op) {
      return (
        <ActionBox title={nextStepLabel(r) ?? 'Next step'} who="Your turn" hint={op.hint}>
          {op.remarksBox && (
            <Textarea rows={2} className="bg-card" placeholder="Remarks (required when not OK)" value={remarks} onChange={e => setRemarks(e.target.value)} />
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">{op.body}</div>
        </ActionBox>
      );
    }
    return (
      <div className="flex-1 rounded-2xl border border-dashed bg-muted/40 p-4">
        <div className="text-sm font-semibold">{isPending(r.status) ? pendingStage?.stage_name ?? 'Approval' : nextStepLabel(r) ?? r.status}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {isPending(r.status)
            ? `Waiting for ${r.current_approver_name ?? r.current_approver_ecno ?? 'the approver'}`
            : 'Waiting for the team that handles this step'}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        {loading || !detail || !r ? (
          <>
            <SheetTitle className="sr-only">Request</SheetTitle>
            <SheetDescription className="sr-only">Loading request</SheetDescription>
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          </>
        ) : (
          <>
            {/* one scrolling column: the slim title bar stays put, everything else (details, then timeline) scrolls */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b bg-background/95 px-5 py-3 pr-12 backdrop-blur">
                <SheetTitle className="text-base font-semibold tracking-tight">{r.request_no}</SheetTitle>
                <StatusBadge status={r.status} />
                {late > 0 && <Pill tone="red" icon={Clock}>{late} day{late > 1 ? 's' : ''} late</Pill>}
              </div>

              <div className="space-y-4 border-b bg-muted/30 px-5 py-5">
                <div className="space-y-2">
                  <KindTag r={r} />
                  <SheetDescription className="text-lg font-semibold leading-snug tracking-tight text-foreground">
                    {r.item_name} × {r.qty} {r.uom ?? ''}
                    <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{r.dept_name ?? '—'}</span>
                  </SheetDescription>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-3.5 shadow-xs sm:grid-cols-3">
                  {r.request_type === 'RETURN' ? (
                    <>
                      <Fact label="Supplier">{r.supplier_name}</Fact>
                      <Fact label="Raised by">{(r.raised_by_name ?? r.raised_by) + (r.raised_role === 'STORE' ? ' (Store)' : '')}</Fact>
                      <Fact label="Issue ref">{r.issue_ref}</Fact>
                    </>
                  ) : (
                    <>
                      <Fact label={r.service_mode === 'OUTPASS' ? 'Vendor' : 'Technician'}>{r.service_vendor}</Fact>
                      {r.service_mode === 'OUTPASS'
                        ? <Fact label="Due back" className={late > 0 ? 'text-red-700 dark:text-red-400' : undefined}>{fmtDate(r.expected_return_date)}</Fact>
                        : <Fact label="Raised on">{fmtDate(r.created_at)}</Fact>}
                      <Fact label="Est. cost">{r.payment_applicable === 'Y' ? `₹ ${Number(r.est_amount ?? 0).toLocaleString('en-IN')}` : 'No cost'}</Fact>
                      <Fact label="Raised by">{(r.raised_by_name ?? r.raised_by) + (r.raised_role === 'STORE' ? ' (Store)' : '')}</Fact>
                      <Fact label="Issue ref">{r.issue_ref}</Fact>
                      <Fact label="Cycle">{r.cycle_no > 1 ? `${r.cycle_no} (re-service ${r.rework_count})` : '1st service'}</Fact>
                    </>
                  )}
                </dl>
                <blockquote className="border-l-2 border-primary/40 pl-3 text-[13px] leading-relaxed">
                  <span className="block text-xs font-medium text-muted-foreground">{r.request_type === 'RETURN' ? 'Reason' : 'Problem'}</span>
                  {r.reason}
                </blockquote>
                {docs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {docs.map(d => (
                      <span key={d.label} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-card px-2 text-xs font-medium ring-1 ring-border">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="text-muted-foreground">{d.label}</span> {d.no}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
                <ol>
                  {history.map(h => (
                    <Step key={h.hist_sno} state="done" railDone>
                      <div className="pt-0.5">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', eventDot(h.event))} />{h.event}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(h.at)} · {h.by_name ?? h.by_ecno ?? '—'}</div>
                        {h.remarks && <div className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed">“{h.remarks}”</div>}
                      </div>
                    </Step>
                  ))}

                  <Step state={isClosed(r.status) ? 'done' : 'current'} last={waitingStages.length === 0 && upcoming.length === 0}>
                    {currentCard()}
                  </Step>

                  {waitingStages.map((a, i) => (
                    <Step key={a.approval_sno} state="todo" n={history.length + i + 2} last={i === waitingStages.length - 1 && upcoming.length === 0}>
                      <div className="pt-0.5">
                        <div className="text-sm font-medium text-foreground/80">{a.stage_name ?? 'Approval'}</div>
                        <div className="text-xs text-muted-foreground">{a.approver_name ?? a.approver_ecno}</div>
                      </div>
                    </Step>
                  ))}
                  {upcoming.map((label, i) => (
                    <Step key={label} state="todo" n={history.length + waitingStages.length + i + 2} last={i === upcoming.length - 1}>
                      <div className="pt-1 text-sm font-medium text-foreground/80">{label}</div>
                    </Step>
                  ))}
                </ol>
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              </div>
            </div>

            {isRaiser && isPending(r.status) && (
              <div className="flex justify-end border-t bg-muted/30 px-5 py-3">
                <Button variant="outline" size="sm" disabled={acting} onClick={() => run('CANCEL')}>Cancel request</Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

/** One row of the timeline: a node on the rail plus its content. */
const Step: React.FC<{
  state: 'done' | 'current' | 'todo';
  n?: number;
  last?: boolean;
  railDone?: boolean;
  children: React.ReactNode;
}> = ({ state, n, last, railDone, children }) => (
  <li className={cn('relative flex gap-3.5', !last && 'pb-5')} aria-current={state === 'current' ? 'step' : undefined}>
    {!last && <span aria-hidden="true" className={cn('absolute bottom-0 left-[13px] top-7 w-0.5 rounded-full', railDone ? 'bg-primary/40' : 'bg-border')} />}
    {state === 'done' ? (
      <span aria-hidden="true" className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
    ) : state === 'current' ? (
      <span aria-hidden="true" className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-primary bg-card ring-4 ring-primary/15"><span className="h-2.5 w-2.5 rounded-full bg-primary" /></span>
    ) : (
      <span aria-hidden="true" className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-card text-xs font-semibold text-muted-foreground">{n}</span>
    )}
    <div className="min-w-0 flex-1">{children}</div>
  </li>
);

/** The highlighted box on the current step, where the user acts. */
const ActionBox: React.FC<{ title: string; who: string; hint: string; children: React.ReactNode }> = ({ title, who, hint, children }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-1.5">
      <span className="text-sm font-semibold">{title}</span>
      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{who}</span>
    </div>
    <p className="text-[13px] leading-relaxed text-foreground/80">{hint}</p>
    {children}
  </div>
);

export default RequestDrawer;
