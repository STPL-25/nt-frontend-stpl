import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  CreditCard, Plus, Trash2, AlertCircle, CheckCircle2, Info,
} from 'lucide-react';
import { formatINR } from './helpers';
import type { AdvancePaymentData, AdvancePaymentStage } from './types';

interface AdvancePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  /** Default GST % auto-filled from the quotation items' tax rate */
  defaultTaxPct?: number;
  initialData?: AdvancePaymentData;
  onSave: (data: AdvancePaymentData) => void;
}

const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_DATA: AdvancePaymentData = {
  advance_pct: 0,
  gst_applicable: false,
  gst_pct: 0,
  reason: '',
  note: '',
  stages: [],
};

const AdvancePaymentDialog: React.FC<AdvancePaymentDialogProps> = ({
  open,
  onOpenChange,
  totalAmount,
  defaultTaxPct = 0,
  initialData,
  onSave,
}) => {
  const [data, setData] = useState<AdvancePaymentData>(DEFAULT_DATA);
  const [roundOffMode, setRoundOffMode] = useState(false);

  // Local editable string for the advance amount field (drives advance_pct)
  const [advanceAmtStr, setAdvanceAmtStr] = useState('');
  // Track which input last changed to avoid circular updates
  const lastChangedBy = useRef<'pct' | 'amt'>('pct');

  // ── On open: reset all state ───────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const d = initialData ?? DEFAULT_DATA;
      setData(d);
      setRoundOffMode(false);
      lastChangedBy.current = 'pct';
      const base = totalAmount * (d.advance_pct / 100);
      setAdvanceAmtStr(d.advance_pct > 0 ? base.toFixed(0) : '');
    }
  }, [open]); // intentionally omit deps to run only on open toggle

  // ── Computed values ────────────────────────────────────────────────────────
  const advanceBase = useMemo(
    () => totalAmount * (data.advance_pct / 100),
    [totalAmount, data.advance_pct],
  );

  const gstOnAdvance = useMemo(
    () => (data.gst_applicable ? advanceBase * (data.gst_pct / 100) : 0),
    [data.gst_applicable, data.gst_pct, advanceBase],
  );

  const totalAdvance = advanceBase + gstOnAdvance;

  const stagedTotal = useMemo(
    () => data.stages.reduce((s, st) => s + st.amount, 0),
    [data.stages],
  );

  const stageDiff = Math.abs(totalAdvance - stagedTotal);
  const stagesBalanced = data.stages.length === 0 || stageDiff < 1;

  // ── Field updater ──────────────────────────────────────────────────────────
  const updateField = <K extends keyof AdvancePaymentData>(key: K, value: AdvancePaymentData[K]) =>
    setData(d => ({ ...d, [key]: value }));

  // ── Advance % changed → sync amount display ────────────────────────────────
  const handlePctChange = (pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct));
    lastChangedBy.current = 'pct';
    setData(d => ({ ...d, advance_pct: clamped }));
    const computed = totalAmount * (clamped / 100);
    setAdvanceAmtStr(clamped > 0 ? computed.toFixed(0) : '');
  };

  // ── Advance amount changed → recalculate % ────────────────────────────────
  const handleAmountChange = (val: string) => {
    lastChangedBy.current = 'amt';
    setAdvanceAmtStr(val);
    const amt = parseFloat(val) || 0;
    const pct = totalAmount > 0 ? Math.min(100, Math.max(0, (amt / totalAmount) * 100)) : 0;
    setData(d => ({ ...d, advance_pct: parseFloat(pct.toFixed(4)) }));
  };

  // ── GST toggle → auto-fill rate from quotation items ──────────────────────
  const handleGstToggle = (applicable: boolean) => {
    setData(d => ({
      ...d,
      gst_applicable: applicable,
      // Auto-fill from quotation tax rate only when turning ON and no rate set yet
      gst_pct: applicable && d.gst_pct === 0 ? defaultTaxPct : d.gst_pct,
    }));
  };

  // ── Stage helpers ──────────────────────────────────────────────────────────
  const addStage = () => {
    const stageNo = data.stages.length + 1;
    const remaining = Math.max(0, totalAdvance - stagedTotal);
    setData(d => ({
      ...d,
      stages: [
        ...d.stages,
        { id: makeId(), stage_no: stageNo, amount: Math.round(remaining), due_days: 0 },
      ],
    }));
  };

  const updateStage = (id: string, field: keyof AdvancePaymentStage, value: number) => {
    setData(d => ({
      ...d,
      stages: d.stages.map(s =>
        s.id === id ? { ...s, [field]: Math.max(0, value) } : s,
      ),
    }));
  };

  const deleteStage = (id: string) => {
    setData(d => ({
      ...d,
      stages: d.stages
        .filter(s => s.id !== id)
        .map((s, i) => ({ ...s, stage_no: i + 1 })),
    }));
  };

  const nudgeAmount = (id: string, delta: number) => {
    setData(d => ({
      ...d,
      stages: d.stages.map(s =>
        s.id === id ? { ...s, amount: Math.max(0, s.amount + delta) } : s,
      ),
    }));
  };

  const handleSave = () => {
    onSave(data);
    onOpenChange(false);
  };

  const canSave = data.advance_pct > 0 && data.reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-amber-600" />
            Advance Payment Configuration
          </DialogTitle>
        </DialogHeader>

        {/* Order total reference */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
          <Info size={13} className="shrink-0" />
          <span>Order value (net payable): <span className="font-semibold text-foreground">{formatINR(totalAmount)}</span></span>
        </div>

        {/* ── Section 1: Advance % + Amount (bidirectional) ─────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advance Details</p>

          <div className="grid grid-cols-3 gap-4 items-end">
            {/* Advance % */}
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Advance % <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={data.advance_pct || ''}
                  onChange={e => handlePctChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-8 text-sm text-right"
                />
                <span className="text-sm text-muted-foreground shrink-0">%</span>
              </div>
            </div>

            {/* Equals sign */}
            <div className="flex justify-center pb-1">
              <span className="text-lg text-muted-foreground font-light">=</span>
            </div>

            {/* Advance Amount — editable, recalculates % */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Advance Amount (₹)</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground shrink-0">₹</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={advanceAmtStr}
                  onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm text-right"
                />
              </div>
              {data.advance_pct > 0 && lastChangedBy.current === 'amt' && (
                <p className="text-[11px] text-amber-700">
                  = {data.advance_pct.toFixed(2)}% of order
                </p>
              )}
            </div>
          </div>

          {/* GST mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">GST on Advance</label>
            <div className="flex gap-1 w-64">
              <button
                type="button"
                className={`flex-1 h-8 text-xs rounded border font-medium transition-colors ${
                  !data.gst_applicable
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                }`}
                onClick={() => handleGstToggle(false)}
              >
                Without GST
              </button>
              <button
                type="button"
                className={`flex-1 h-8 text-xs rounded border font-medium transition-colors ${
                  data.gst_applicable
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-background text-muted-foreground border-border hover:border-amber-300'
                }`}
                onClick={() => handleGstToggle(true)}
              >
                With GST
              </button>
            </div>
          </div>

          {/* GST % row — only when With GST */}
          {data.gst_applicable && (
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-800">
                  GST % on Advance
                  {defaultTaxPct > 0 && (
                    <span className="ml-1 text-[10px] text-amber-600 font-normal">(from items: {defaultTaxPct}%)</span>
                  )}
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={data.gst_pct || ''}
                    onChange={e => updateField('gst_pct', Math.min(100, Math.max(0, Number(e.target.value))))}
                    placeholder={String(defaultTaxPct || 18)}
                    className="h-7 text-xs text-right"
                  />
                  <span className="text-xs text-amber-700 shrink-0">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-800">GST Amount</label>
                <p className="h-7 flex items-center text-sm font-semibold text-amber-700">
                  {formatINR(gstOnAdvance)}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-800">Total Advance (incl. GST)</label>
                <p className="h-7 flex items-center text-sm font-bold text-amber-800">
                  {formatINR(totalAdvance)}
                </p>
              </div>
            </div>
          )}

          {!data.gst_applicable && data.advance_pct > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Total Advance:</span>
              <span className="font-semibold text-foreground">{formatINR(totalAdvance)}</span>
            </div>
          )}
        </div>

        {/* ── Section 2: Reason ─────────────────────────────────────────────── */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Reason for Advance <span className="text-red-500">*</span>
          </label>
          <Textarea
            placeholder="Why is advance payment required? (e.g., vendor requires upfront material cost, custom manufacturing, import order…)"
            value={data.reason}
            onChange={e => updateField('reason', e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        {/* ── Section 3: Payment Stages ─────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Stages</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoundOffMode(v => !v)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  roundOffMode
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'border-border text-muted-foreground hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {roundOffMode ? 'Round-off ON' : 'Round-off'}
              </button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addStage}>
                <Plus size={12} /> Add Stage
              </Button>
            </div>
          </div>

          {data.stages.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 text-center py-3 border border-dashed rounded">
              No stages added. Click "Add Stage" to split the advance into payment tranches.
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs py-2 w-16">Stage</TableHead>
                    <TableHead className="text-xs py-2 text-right">Amount (₹)</TableHead>
                    {roundOffMode && (
                      <TableHead className="text-xs py-2 text-center w-36">Adjust</TableHead>
                    )}
                    <TableHead className="text-xs py-2 text-right w-20">% of Advance</TableHead>
                    <TableHead className="text-xs py-2 text-right w-24">Due (days)</TableHead>
                    <TableHead className="text-xs py-2 w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stages.map(stage => {
                    const pct = totalAdvance > 0 ? (stage.amount / totalAdvance) * 100 : 0;
                    return (
                      <TableRow key={stage.id}>
                        <TableCell className="text-xs font-medium py-1.5">
                          <Badge variant="outline" className="text-[11px] font-medium">
                            Stage {stage.stage_no}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={stage.amount || ''}
                            onChange={e => updateStage(stage.id, 'amount', Number(e.target.value))}
                            placeholder="0"
                            className="h-7 text-xs text-right w-32 ml-auto"
                          />
                        </TableCell>
                        {roundOffMode && (
                          <TableCell className="py-1.5">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => nudgeAmount(stage.id, -1000)}
                                className="h-6 px-1.5 text-[11px] rounded border border-border hover:bg-red-50 hover:border-red-300 text-muted-foreground hover:text-red-600 transition-colors"
                              >-1K</button>
                              <button
                                type="button"
                                onClick={() => nudgeAmount(stage.id, -100)}
                                className="h-6 px-1.5 text-[11px] rounded border border-border hover:bg-red-50 hover:border-red-300 text-muted-foreground hover:text-red-600 transition-colors"
                              >-100</button>
                              <button
                                type="button"
                                onClick={() => nudgeAmount(stage.id, 100)}
                                className="h-6 px-1.5 text-[11px] rounded border border-border hover:bg-blue-50 hover:border-blue-300 text-muted-foreground hover:text-blue-600 transition-colors"
                              >+100</button>
                              <button
                                type="button"
                                onClick={() => nudgeAmount(stage.id, 1000)}
                                className="h-6 px-1.5 text-[11px] rounded border border-border hover:bg-blue-50 hover:border-blue-300 text-muted-foreground hover:text-blue-600 transition-colors"
                              >+1K</button>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-right py-1.5 tabular-nums">
                          <span className={pct > 100 ? 'text-red-600' : 'text-muted-foreground'}>
                            {pct.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={stage.due_days || ''}
                            onChange={e => updateStage(stage.id, 'due_days', Number(e.target.value))}
                            placeholder="0"
                            className="h-7 text-xs text-right w-20 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <button
                            type="button"
                            onClick={() => deleteStage(stage.id)}
                            className="text-muted-foreground/50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Stages footer */}
              <div className={`flex items-center justify-between px-3 py-2 border-t text-xs ${
                stagesBalanced ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'
              }`}>
                <div className="flex items-center gap-1.5">
                  {stagesBalanced ? (
                    <CheckCircle2 size={13} className="text-green-600" />
                  ) : (
                    <AlertCircle size={13} className="text-amber-600" />
                  )}
                  <span className={stagesBalanced ? 'text-green-700' : 'text-amber-700'}>
                    {stagesBalanced
                      ? 'Stages balanced'
                      : `Difference: ${formatINR(stageDiff)} — adjust stage amounts to match total advance`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-3 font-medium">
                  <span className="text-muted-foreground">Staged total:</span>
                  <span className={!stagesBalanced ? 'text-amber-700' : 'text-foreground'}>
                    {formatINR(stagedTotal)}
                  </span>
                  <span className="text-muted-foreground">of</span>
                  <span className="text-foreground">{formatINR(totalAdvance)}</span>
                </div>
              </div>
            </div>
          )}

          {roundOffMode && (
            <p className="text-[11px] text-blue-600 flex items-center gap-1">
              <Info size={11} />
              Round-off mode: use ±100 / ±1K buttons to adjust stage amounts. The % column updates automatically.
            </p>
          )}
        </div>

        {/* ── Section 4: Note ───────────────────────────────────────────────── */}
        <div className="space-y-1">
          <label className="text-xs font-medium">Note</label>
          <Textarea
            placeholder="Any additional notes or instructions regarding the advance payment…"
            value={data.note}
            onChange={e => updateField('note', e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        {/* ── Summary strip ─────────────────────────────────────────────────── */}
        {data.advance_pct > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-amber-600/80">Advance %</p>
              <p className="text-sm font-bold text-amber-800">{data.advance_pct.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-amber-600/80">Base Advance</p>
              <p className="text-sm font-bold text-amber-800">{formatINR(advanceBase)}</p>
            </div>
            {data.gst_applicable && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-amber-600/80">GST ({data.gst_pct}%)</p>
                <p className="text-sm font-bold text-amber-800">{formatINR(gstOnAdvance)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-amber-600/80">Total Advance</p>
              <p className="text-sm font-bold text-amber-900">{formatINR(totalAdvance)}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <CreditCard size={15} className="mr-1.5" />
            Save Advance Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancePaymentDialog;
