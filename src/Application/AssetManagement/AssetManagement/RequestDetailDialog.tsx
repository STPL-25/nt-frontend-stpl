import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type {
  AssetAction, AssetApproval, AssetRequestDetail,
} from '@/Services/GrnService/assetApi';
import { StatusBadge, TypeBadge, fmtDate, fmtDateTime, isPending } from './helpers';

interface Props {
  detail: AssetRequestDetail | null;
  loading: boolean;
  open: boolean;
  me: { ecno?: string } | null;
  /** operational actions (return order, gate pass, GRN, debit note…) need edit permission */
  canOperate: boolean;
  acting: boolean;
  onClose: () => void;
  onAct: (action: AssetAction, extra?: Record<string, unknown>) => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm font-medium">{children || '—'}</div>
  </div>
);

const stageIcon = (s: AssetApproval['status']) =>
  s === 'Approved' ? <CheckCircle2 className="h-4 w-4 text-green-600" />
    : s === 'Rejected' ? <XCircle className="h-4 w-4 text-red-600" />
      : s === 'Pending' ? <Clock className="h-4 w-4 text-amber-600" />
        : <Circle className="h-4 w-4 text-muted-foreground" />;

const RequestDetailDialog: React.FC<Props> = ({ detail, loading, open, me, canOperate, acting, onClose, onAct }) => {
  const [remarks, setRemarks] = useState('');
  const [dcIn, setDcIn] = useState('');
  const [tech, setTech] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => { setRemarks(''); setDcIn(''); setTech(''); setPrice(''); }, [detail?.request.asset_req_sno, detail?.request.status]);

  const r = detail?.request;
  const isApprover = !!r && !!me?.ecno && r.current_approver_ecno === me.ecno && isPending(r.status);
  const isRaiser = !!r && !!me?.ecno && r.raised_by === me.ecno;

  const btn = (label: string, action: AssetAction, extra?: Record<string, unknown>, variant: 'default' | 'outline' | 'destructive' = 'default') => (
    <Button size="sm" variant={variant} disabled={acting} onClick={() => onAct(action, { remarks: remarks.trim() || undefined, ...extra })}>
      {acting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}{label}
    </Button>
  );

  // Operational next step for the current status (null when nothing is waiting on a user)
  const nextStep = (): React.ReactNode => {
    if (!r || !canOperate) return null;
    if (r.request_type === 'RETURN') {
      if (r.status === 'Approved') return <>{btn('Raise Return Order', 'RAISE_RETURN_ORDER')}</>;
      if (r.status === 'Return Order Raised') return <>{btn('Gate pass OUT (create DC)', 'GATE_OUT')}</>;
      if (r.status === 'Goods Returned') {
        return (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Unit price (blank = item cost)</Label>
              <Input className="h-8 w-40" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            {btn('Raise Debit Note', 'RAISE_DEBIT_NOTE', { unit_price: price ? Number(price) : undefined })}
          </div>
        );
      }
      return null;
    }
    if (r.service_mode === 'OUTPASS') {
      if (r.status === 'Approved') return <>{btn('Gate pass OUT (with DC)', 'GATE_OUT')}</>;
      if (r.status === 'At Vendor') {
        return (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">DC number on the returning item</Label>
              <Input className="h-8 w-48" value={dcIn} placeholder={r.dc_no ?? ''} onChange={e => setDcIn(e.target.value)} />
            </div>
            {btn('Gate pass IN', 'GATE_IN', { dc_no: dcIn.trim() })}
          </div>
        );
      }
      if (r.status === 'Received') {
        return (
          <div className="flex flex-wrap gap-2">
            {btn('GRN — quality OK', 'COMPLETE_SERVICE', { result: 'OK' })}
            {btn('GRN — quality NOT OK', 'COMPLETE_SERVICE', { result: 'NOT_OK' }, 'destructive')}
          </div>
        );
      }
      if (r.status === 'QC Failed') {
        return (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Unit price (blank = item cost)</Label>
              <Input className="h-8 w-40" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            {btn('Raise Debit Note', 'RAISE_DEBIT_NOTE', { unit_price: price ? Number(price) : undefined })}
          </div>
        );
      }
      if (r.status === 'Debit Note Raised') return <>{btn('Send for re-service', 'RESERVICE')}</>;
      return null;
    }
    // In-store
    if (r.status === 'Approved') {
      return (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Technician / vendor on site</Label>
            <Input className="h-8 w-52" value={tech} onChange={e => setTech(e.target.value)} />
          </div>
          {btn('Start service', 'START_SERVICE', { technician: tech.trim() || undefined })}
        </div>
      );
    }
    if (r.status === 'In Progress') {
      return (
        <div className="flex flex-wrap gap-2">
          {btn('Service OK — back to Assets', 'COMPLETE_SERVICE', { result: 'OK' })}
          {btn('Not OK — re-service', 'COMPLETE_SERVICE', { result: 'NOT_OK' }, 'destructive')}
        </div>
      );
    }
    return null;
  };

  const step = nextStep();

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {r?.request_no ?? 'Request'}
            {r && <TypeBadge type={r.request_type} mode={r.service_mode} />}
            {r && <StatusBadge status={r.status} />}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          {loading || !detail || !r ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Item">{r.item_name} × {r.qty} {r.uom}</Field>
                <Field label="Department">{r.dept_name}</Field>
                <Field label="Issue ref">{r.issue_ref}</Field>
                <Field label="Raised by">{(r.raised_by_name ?? r.raised_by) + (r.raised_role === 'STORE' ? ' (Store In-charge)' : ' (Department)')}</Field>
                <Field label="Raised on">{fmtDateTime(r.created_at)}</Field>
                <Field label="Supplier">{r.supplier_name}</Field>
                <div className="col-span-2 sm:col-span-3"><Field label="Reason">{r.reason}</Field></div>
                {r.request_type === 'SERVICE' && (
                  <>
                    <Field label="Payment applicable">{r.payment_applicable === 'Y' ? `Yes — ₹${r.est_amount ?? 0}` : 'No'}</Field>
                    <Field label={r.service_mode === 'OUTPASS' ? 'Repair vendor' : 'Technician'}>{r.service_vendor}</Field>
                    <Field label="Expected return">{fmtDate(r.expected_return_date)}</Field>
                    {r.cycle_no > 1 && <Field label="Service cycle">{r.cycle_no}</Field>}
                    {r.rework_count > 0 && <Field label="Re-service loops">{r.rework_count}</Field>}
                  </>
                )}
                {r.return_order_no && <Field label="Return Order">{r.return_order_no} · {fmtDate(r.return_order_date)}</Field>}
                {r.dc_no && <Field label="Delivery Challan">{r.dc_no}</Field>}
                {r.gate_out_no && <Field label="Gate pass OUT">{r.gate_out_no} · {fmtDateTime(r.gate_out_at)}</Field>}
                {r.gate_in_no && <Field label="Gate pass IN">{r.gate_in_no} · {fmtDateTime(r.gate_in_at)}</Field>}
                {r.service_receipt_no && <Field label="GRN against DC">{r.service_receipt_no} ({r.qc_result === 'OK' ? 'OK' : 'Not OK'})</Field>}
                {r.debit_note_no && <Field label="Debit Note">{r.debit_note_no}</Field>}
                {r.reject_reason && <div className="col-span-2 sm:col-span-3"><Field label="Rejected because">{r.reject_reason}</Field></div>}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Approval chain</h4>
                <ol className="space-y-1.5">
                  {detail.approvals.map(a => (
                    <li key={a.approval_sno} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5">{stageIcon(a.status)}</span>
                      <span>
                        <span className="font-medium">{a.stage_name}</span>
                        {' · '}{a.approver_name ?? a.approver_ecno}
                        {a.phase === 'DEPT' && <span className="ml-1 text-xs text-muted-foreground">(department)</span>}
                        {a.acted_at && <span className="text-muted-foreground"> · {a.status} {fmtDateTime(a.acted_at)}</span>}
                        {a.remarks && <span className="block text-xs text-muted-foreground">“{a.remarks}”</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {(isApprover || isRaiser && isPending(r.status) || step) && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                  <h4 className="text-sm font-semibold">
                    {isApprover ? 'Your decision' : 'Next step'}
                  </h4>
                  {(isApprover || (step && (r.status === 'Received' || r.status === 'In Progress' || r.status === 'QC Failed'))) && (
                    <Textarea
                      rows={2}
                      placeholder={isApprover ? 'Remarks (required to reject)' : 'Remarks (required when not OK)'}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {isApprover && (
                      <>
                        {btn('Approve', 'APPROVE')}
                        {btn('Reject', 'REJECT', undefined, 'destructive')}
                      </>
                    )}
                    {isRaiser && isPending(r.status) && btn('Cancel request', 'CANCEL', undefined, 'outline')}
                  </div>
                  {step}
                </div>
              )}

              <div>
                <h4 className="mb-2 text-sm font-semibold">History</h4>
                <ul className="space-y-1 text-sm">
                  {detail.history.map(h => (
                    <li key={h.hist_sno} className="flex flex-wrap gap-x-2">
                      <span className="whitespace-nowrap text-muted-foreground">{fmtDateTime(h.at)}</span>
                      <span className="font-medium">{h.event}</span>
                      <span className="text-muted-foreground">— {h.by_name ?? h.by_ecno}</span>
                      {h.remarks && <span className="text-muted-foreground">“{h.remarks}”</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestDetailDialog;
