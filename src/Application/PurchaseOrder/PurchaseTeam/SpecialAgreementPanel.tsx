import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileCheck, Loader2, Scissors, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { getSpecialAgreementOptionsForPR, applySpecialAgreementToPR } from '@/Services/Api';
import { getErrorMessage } from '@/lib/errors';
import { formatINR } from './helpers';
import type { PRRecord } from './types';

// Purchase page: PR lines whose product is on a live Special Agreement. Purchase either gives the whole
// line to one agreement supplier or splits the qty between several (1000 = 700 + 300). Each supplier
// becomes its own PR/<n> entry with a quotation raised from the agreement (agreement document attached)
// that then goes through normal PO approval.

interface AgreementOption {
  special_agreement_sno: number;
  agreement_no: string;
  agreement_type: 'FIXED' | 'UNFIXED';
  vendor_sno: number;
  vendor_name: string;
  rate_amount: number | null;
  max_qty: number | null;
  period_end_date: string;
}
interface LineOption {
  pr_item_sno: number;
  prod_name: string;
  prod_code?: string;
  qty: number;
  uom_name?: string;
  agreements: AgreementOption[];
}
interface Cell { qty: string; rate: string; gst: string }
type Alloc = Record<number, Record<number, Cell>>;

const emptyCell = (): Cell => ({ qty: '', rate: '', gst: '' });
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

interface Props {
  selectedPR: PRRecord;
  /** Called after the PR has been regrouped so the page reloads its list. */
  onApplied: () => void;
}

const SpecialAgreementPanel: React.FC<Props> = ({ selectedPR, onApplied }) => {
  const [lines, setLines] = useState<LineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [alloc, setAlloc] = useState<Alloc>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const prSno = selectedPR.pr_basic_sno;
  const group = selectedPR.group ?? null;

  // The page remounts this panel per PR entry (see `key`), so it starts in the loading state.
  useEffect(() => {
    if (!prSno) return;
    let cancelled = false;
    axios.get(getSpecialAgreementOptionsForPR, {
      params: { pr_basic_sno: prSno, group: group ?? '' }, withCredentials: true,
    }).then((res) => {
      if (cancelled) return;
      const rows: LineOption[] = res.data?.decrypted?.data ?? res.data?.data ?? [];
      setLines(rows);
      // a single agreement supplier: pre-fill the full qty, the user only confirms rate/GST
      const init: Alloc = {};
      rows.forEach((l) => {
        init[l.pr_item_sno] = {};
        l.agreements.forEach((a) => {
          init[l.pr_item_sno][a.special_agreement_sno] = {
            ...emptyCell(),
            qty: l.agreements.length === 1 ? String(l.qty) : '',
          };
        });
      });
      setAlloc(init);
    }).catch(() => {
      if (!cancelled) setLines([]); // the panel is optional: no agreement info simply hides it
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [prSno, group]);

  const setCell = (item: number, sa: number, patch: Partial<Cell>) =>
    setAlloc((prev) => ({ ...prev, [item]: { ...prev[item], [sa]: { ...(prev[item]?.[sa] ?? emptyCell()), ...patch } } }));

  // Per line: how much is allocated, and whether it is complete / partial / untouched
  const status = useMemo(() => {
    const out: Record<number, { sum: number; state: 'none' | 'full' | 'partial' | 'over' }> = {};
    lines.forEach((l) => {
      const sum = round4(l.agreements.reduce((s, a) => s + num(alloc[l.pr_item_sno]?.[a.special_agreement_sno]?.qty ?? ''), 0));
      out[l.pr_item_sno] = {
        sum,
        state: sum === 0 ? 'none' : sum === round4(l.qty) ? 'full' : sum > l.qty ? 'over' : 'partial',
      };
    });
    return out;
  }, [lines, alloc]);

  // rows that will be sent, plus the first problem found
  const plan = useMemo(() => {
    const rows: { pr_item_sno: number; special_agreement_sno: number; qty: number; tax_pct: number; unit_price?: number }[] = [];
    let problem: string | null = null;
    for (const l of lines) {
      const st = status[l.pr_item_sno];
      if (st.state === 'none') continue;
      if (st.state !== 'full') { problem = `${l.prod_name}: allocated ${st.sum} of ${l.qty}`; break; }
      for (const a of l.agreements) {
        const c = alloc[l.pr_item_sno]?.[a.special_agreement_sno] ?? emptyCell();
        const qty = num(c.qty);
        if (qty <= 0) continue;
        if (a.max_qty != null && qty > a.max_qty) { problem = `${l.prod_name}: ${a.vendor_name} is limited to ${a.max_qty}`; break; }
        if (c.gst.trim() === '' || num(c.gst) < 0 || num(c.gst) > 100) { problem = `${l.prod_name}: enter GST % for ${a.vendor_name}`; break; }
        if (a.agreement_type === 'UNFIXED' && !(num(c.rate) > 0)) { problem = `${l.prod_name}: enter the rate for ${a.vendor_name}`; break; }
        rows.push({
          pr_item_sno: l.pr_item_sno, special_agreement_sno: a.special_agreement_sno, qty, tax_pct: num(c.gst),
          ...(a.agreement_type === 'UNFIXED' ? { unit_price: num(c.rate) } : {}),
        });
      }
      if (problem) break;
    }
    return { rows, problem };
  }, [lines, status, alloc]);

  // what the user is about to create: one entry per supplier
  const preview = useMemo(() => {
    const m = new Map<number, { vendor: string; parts: string[] }>();
    lines.forEach((l) => l.agreements.forEach((a) => {
      const c = alloc[l.pr_item_sno]?.[a.special_agreement_sno];
      const qty = c ? num(c.qty) : 0;
      if (qty > 0 && status[l.pr_item_sno]?.state === 'full') {
        if (!m.has(a.vendor_sno)) m.set(a.vendor_sno, { vendor: a.vendor_name, parts: [] });
        m.get(a.vendor_sno)!.parts.push(`${l.prod_name} × ${qty}${l.uom_name ? ` ${l.uom_name}` : ''}`);
      }
    }));
    return [...m.values()];
  }, [lines, alloc, status]);

  const apply = async () => {
    if (!prSno || plan.rows.length === 0 || plan.problem) return;
    setSaving(true);
    try {
      const res = await axios.post(applySpecialAgreementToPR, {
        pr_basic_sno: prSno, group, allocations: plan.rows,
      }, { withCredentials: true });
      const results: { pr_no: string; ok: boolean; error?: string }[] = res.data?.decrypted?.data ?? res.data?.data ?? [];
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        toast.warning(`Split done, but a quotation failed for ${failed.map((f) => f.pr_no).join(', ')}: ${failed[0].error ?? 'unknown error'}. Add it from that entry.`);
      } else {
        toast.success(`Created ${results.length} quotation${results.length === 1 ? '' : 's'} from the agreement${results.length === 1 ? '' : 's'}. Review them in PO Approvals.`);
      }
      setConfirming(false);
      onApplied();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not apply the agreement'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || lines.length === 0) return null;

  return (
    <>
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <FileCheck size={16} className="text-primary" />
            Special Agreement suppliers
            <Badge variant="secondary" className="text-xs">{lines.length} line{lines.length === 1 ? '' : 's'} covered</Badge>
          </CardTitle>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info size={13} className="mt-0.5 shrink-0" />
            These products have an approved agreement. Give each line to one supplier, or split the quantity between suppliers.
            Each supplier gets its own PR entry and a quotation with the agreement attached; it then goes for normal PO approval.
            Lines you leave empty continue in the normal flow.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {lines.map((l) => {
            const st = status[l.pr_item_sno];
            return (
              <div key={l.pr_item_sno} className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{l.prod_name}{l.prod_code && <span className="ml-2 text-xs font-normal text-muted-foreground">{l.prod_code}</span>}</p>
                    <p className="text-xs text-muted-foreground">PR quantity: <b>{l.qty}</b> {l.uom_name}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={st.state === 'full' ? 'border-emerald-300 text-emerald-700' : st.state === 'none' ? '' : 'border-amber-300 text-amber-700'}
                  >
                    {st.state === 'none' ? 'Not allocated' : st.state === 'full' ? 'Fully allocated' : `Allocated ${st.sum} of ${l.qty}`}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {l.agreements.map((a) => {
                    const c = alloc[l.pr_item_sno]?.[a.special_agreement_sno] ?? emptyCell();
                    const used = num(c.qty) > 0;
                    return (
                      <div key={a.special_agreement_sno} className={`grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-12 sm:items-end ${used ? 'border-primary/40 bg-primary/5' : ''}`}>
                        <div className="col-span-2 sm:col-span-4">
                          <p className="truncate text-sm font-medium">{a.vendor_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.agreement_no} · {a.agreement_type === 'FIXED' ? `Fixed ${formatINR(a.rate_amount ?? 0)}` : 'Rate varies'}
                            {a.max_qty != null && ` · max ${a.max_qty}`}
                          </p>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[11px] text-muted-foreground">Quantity</label>
                          <div className="flex gap-1">
                            <Input type="number" min="0" step="any" className="h-9" value={c.qty}
                              onChange={(e) => setCell(l.pr_item_sno, a.special_agreement_sno, { qty: e.target.value })} />
                            <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-xs" title="Give the full quantity to this supplier"
                              onClick={() => {
                                // full qty here, everything else on the line cleared
                                setAlloc((prev) => ({
                                  ...prev,
                                  [l.pr_item_sno]: Object.fromEntries(l.agreements.map((x) => [
                                    x.special_agreement_sno,
                                    { ...(prev[l.pr_item_sno]?.[x.special_agreement_sno] ?? emptyCell()), qty: x.special_agreement_sno === a.special_agreement_sno ? String(l.qty) : '' },
                                  ])),
                                }));
                              }}>All</Button>
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[11px] text-muted-foreground">{a.agreement_type === 'FIXED' ? 'Rate (fixed)' : 'Rate *'}</label>
                          <Input type="number" min="0" step="0.01" className="h-9" disabled={a.agreement_type === 'FIXED'}
                            value={a.agreement_type === 'FIXED' ? String(a.rate_amount ?? '') : c.rate}
                            onChange={(e) => setCell(l.pr_item_sno, a.special_agreement_sno, { rate: e.target.value })} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-muted-foreground">GST % *</label>
                          <Input type="number" min="0" max="100" step="any" className="h-9" value={c.gst}
                            onChange={(e) => setCell(l.pr_item_sno, a.special_agreement_sno, { gst: e.target.value })} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${plan.problem ? 'text-destructive' : 'text-muted-foreground'}`}>
              {plan.problem ?? (plan.rows.length ? `${preview.length} supplier entr${preview.length === 1 ? 'y' : 'ies'} will be created` : 'Allocate at least one line to continue')}
            </p>
            <Button disabled={!!plan.problem || plan.rows.length === 0} onClick={() => setConfirming(true)}>
              <Scissors size={14} className="mr-1.5" /> Allocate &amp; raise quotations
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirming} onOpenChange={(o) => { if (!saving) setConfirming(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate to agreement suppliers?</DialogTitle>
            <DialogDescription>
              The PR lines are cut by supplier (the original quantity is kept on record) and one quotation per supplier is raised for PO approval. This cannot be undone from here.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {preview.map((p) => (
              <li key={p.vendor} className="rounded-md border p-2">
                <p className="font-semibold">{p.vendor}</p>
                <p className="text-xs text-muted-foreground">{p.parts.join(' · ')}</p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
            <Button onClick={apply} disabled={saving}>
              {saving ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Working…</> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SpecialAgreementPanel;
