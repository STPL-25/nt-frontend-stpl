import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileUp, FlaskConical, Info, Landmark, Loader2, RotateCcw, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Callout, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE, type Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { downloadTextFile } from '@/utils/downloadTextFile';
import {
  RETRY_MODES, payNetRunChangeMode, payNetRunReverseApply, payNetRunReversePreview,
  type BankFailure, type BankLineStatus, type PaymentBatch, type PaymentBatchItem, type PaymentEntry, type ReverseApplyResult, type ReverseFileRecord,
  type ReversePreview, type RetryMode,
} from '@/Services/GrnService/paymentNetApi';
import {
  RESULT_META, RETRY_MODE_LABEL, REVERSE_ACTION_META, REVERSE_FILE_ACCEPT, bankFailureText, bankWhen, reverseFileProblem, retryModeProblem, runBankState,
} from './bankReplyModel';
import { rupees } from './paymentRunModel';

// The bank's reverse file for a payment run (grn-service sql/83): upload it on the run, see what each line will do, apply it.
// Paid transfers keep their UTR; rejected / returned ones go back to Make payment, where BankFailureBox shows why and lets the
// mode be changed before they are paid again.

const Chip = ({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) => (
  <span title={title} className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-px text-[10px] font-medium', TONE[tone])}>{children}</span>
);
export const BankChip = ({ meta, title }: { meta: { label: string; tone: Tone } | null; title?: string }) => (meta ? <Chip tone={meta.tone} title={title}>{meta.label}</Chip> : null);

/** id: a new one per chosen file, so the upload dialog starts fresh for each (it is its key) */
interface PickedFile { id: number; name: string; content: string }

// ─── the run side panel's "Bank reply" section ─────────────────────────────

export function RunBankReply({ run, reverseFiles, items, canUpload, onApplied }: {
  run: PaymentBatch; reverseFiles: ReverseFileRecord[]; items: PaymentBatchItem[]; canUpload: boolean; onApplied: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const state = runBankState(run);
  if (!state) return null;
  const lines = Number(run.bank_lines) || 0;

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';                               // choosing the same file again must fire again
    if (!f) return;
    const problem = reverseFileProblem(f);
    if (problem) { toast.error(problem); return; }
    try {
      setPicked({ id: Date.now(), name: f.name, content: await f.text() });
    } catch {
      toast.error('Could not read that file');
    }
  };

  const figures: [string, number, Tone][] = [
    ['Paid', Number(run.bank_paid) || 0, 'success'],
    ['Pending', Number(run.bank_pending) || 0, 'warning'],
    ['Not paid', Number(run.bank_failed) || 0, 'danger'],
    ['No reply yet', Number(run.bank_unconfirmed) || 0, 'neutral'],
  ];
  return (
    <section className="space-y-3 rounded-xl border p-3" aria-label="Bank reply">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Landmark className="h-4 w-4 text-muted-foreground" />Bank reply <StatusPill tone={state.tone}>{state.label}</StatusPill>
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload the bank's reverse file for {run.file_name ?? 'this run'}: paid transfers get their UTR; rejected or returned ones go back to Make payment.
          </p>
        </div>
        {canUpload && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {import.meta.env.DEV && (
              <Button type="button" variant="ghost" size="sm" className="text-xs text-violet-700 dark:text-violet-300" onClick={() => setTestOpen(true)} title="Development only - not in the live app">
                <FlaskConical className="mr-1.5 h-4 w-4" />Test reverse file
              </Button>
            )}
            <input ref={input} type="file" accept={REVERSE_FILE_ACCEPT} className="hidden" onChange={choose} aria-label="Reverse file" />
            <Button type="button" size="sm" onClick={() => input.current?.click()}><Upload className="mr-1.5 h-4 w-4" />Upload reverse file</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {figures.map(([label, n, tone]) => (
          <div key={label} className={cn('rounded-lg border px-2.5 py-1.5', n > 0 ? TONE[tone] : 'text-muted-foreground')}>
            <p className="text-[10px] font-medium uppercase tracking-wide">{label}</p>
            <p className="text-base font-bold tabular-nums">{n}<span className="text-xs font-normal"> / {lines}</span></p>
          </div>
        ))}
      </div>
      {Number(run.bank_failed) > 0 && (
        <Callout tone="danger" icon={AlertTriangle}>
          {rupees(run.bank_failed_amount)} was not paid by the bank. Those payments are back on Make payment with the bank's reason - fix the supplier's bank details
          (KYC) or change the mode there, then pay them again.
        </Callout>
      )}

      {reverseFiles.length > 0 && (
        <ul className="divide-y rounded-lg border text-xs">
          {reverseFiles.map((f) => (
            <li key={f.reverse_file_sno} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium"><FileUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{f.file_name}</span></span>
                <span className="text-muted-foreground">{bankWhen(f.uploaded_at)} · by {f.uploaded_by}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {f.paid_count > 0 && <Chip tone="success">{f.paid_count} paid</Chip>}
                {f.pending_count > 0 && <Chip tone="warning">{f.pending_count} pending</Chip>}
                {f.failed_count > 0 && <Chip tone="danger">{f.failed_count} not paid</Chip>}
                {f.unchanged_count > 0 && <Chip tone="neutral">{f.unchanged_count} no change</Chip>}
                {f.unmatched_count > 0 && <Chip tone="warning">{f.unmatched_count} not matched</Chip>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ReverseUploadDialog key={picked?.id ?? 0} run={run} file={picked} onClose={() => setPicked(null)} onApplied={onApplied} />
      {import.meta.env.DEV && testOpen && (
        <DevTestReverseDialog run={run} items={items} onClose={() => setTestOpen(false)} onUse={(f) => { setTestOpen(false); setPicked({ id: Date.now(), ...f }); }} />
      )}
    </section>
  );
}

// ─── upload: preview, then apply ───────────────────────────────────────────

function ReverseUploadDialog({ run, file, onClose, onApplied }: { run: PaymentBatch; file: PickedFile | null; onClose: () => void; onApplied: () => void }) {
  const [preview, setPreview] = useState<ReversePreview | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ReverseApplyResult | null>(null);

  useEffect(() => {
    if (!file) return;
    let live = true;   // a new file remounts this dialog (key), so its state starts empty
    axios.post(payNetRunReversePreview(run.batch_sno), { file_name: file.name, content: file.content })
      .then((res) => { if (live) setPreview(res.data?.data ?? null); })
      .catch((err) => { if (live) setError(getErrorMessage(err, 'Could not read the reverse file')); });
    return () => { live = false; };
  }, [file, run.batch_sno]);

  const apply = async () => {
    if (!file) return;
    setApplying(true);
    try {
      const res = await axios.post(payNetRunReverseApply(run.batch_sno), { file_name: file.name, content: file.content });
      const r: ReverseApplyResult = res.data?.data;
      setResult(r);
      const failed = r.results.filter((x) => x.result === 'FAILED').length;
      const paid = r.results.filter((x) => x.result === 'PAID' || x.result === 'UPDATED').length;
      toast.success(`Reverse file applied: ${paid} paid${failed ? `, ${failed} back to Make payment` : ''}`);
      onApplied();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not apply the reverse file'));
    } finally {
      setApplying(false);
    }
  };

  const s = preview?.summary;
  const usable = s ? s.matched : 0;
  const busy = !!file && !preview && !error;
  return (
    <Dialog open={file != null} onOpenChange={(o) => { if (!o && !applying) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-4 sm:w-full sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{result ? 'Reverse file applied' : 'Bank reverse file'}</DialogTitle>
          <DialogDescription className="break-all">{file?.name} · for {run.batch_no}{run.file_name ? ` (${run.file_name})` : ''}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading the file and matching it to the run…</p>}
          {error && <Callout tone="danger" icon={XCircle}>{error}</Callout>}

          {result ? <ApplyResult result={result} /> : preview && s && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="neutral">{s.lines} line{s.lines === 1 ? '' : 's'} in the file</Chip>
                {s.paid > 0 && <Chip tone="success">{s.paid} paid</Chip>}
                {s.pending > 0 && <Chip tone="warning">{s.pending} pending</Chip>}
                {s.failed > 0 && <Chip tone="danger">{s.failed} not paid</Chip>}
                {s.no_change > 0 && <Chip tone="neutral">{s.no_change} no change</Chip>}
                {s.problems > 0 && <Chip tone="warning">{s.problems} cannot be used</Chip>}
              </div>
              {s.failed > 0 && (
                <Callout tone="danger" icon={RotateCcw}>
                  {s.failed} payment{s.failed === 1 ? ' was' : 's were'} not paid. Applying reverses {s.failed === 1 ? 'its journal' : 'their journals'} and puts {s.failed === 1 ? 'it' : 'them'} back on Make payment to be paid again.
                </Callout>
              )}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium" title="Row in the file, as Excel numbers it (row 1 is the header)">Row</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Payment</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Amount</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Bank says</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">What happens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.lines.map((l) => {
                      const meta = l.action ? REVERSE_ACTION_META[l.action] : null;
                      return (
                        <tr key={l.row_no} className={cn(l.problem && 'bg-amber-50/60 dark:bg-amber-950/20')}>
                          <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">{l.row_no}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="font-medium">{l.vendor_name ?? l.reference}</span>
                            <span className="block text-muted-foreground">{l.payment_no ?? 'not in this run'}{l.payment_no ? ` · ${l.reference}` : ''}</span>
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{l.amount != null ? rupees(l.amount) : l.run_amount != null ? rupees(l.run_amount) : '—'}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="font-medium">{l.status ?? (l.status_text || '—')}</span>
                            {l.utr_no && <span className="block font-mono text-[11px] text-muted-foreground">UTR {l.utr_no}</span>}
                            {(l.reason_code || l.reason) && l.status !== 'PAID' && <span className="block text-muted-foreground">{[l.reason_code, l.reason].filter(Boolean).join(' · ')}</span>}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {l.problem
                              ? <span className="flex items-start gap-1 text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />{l.problem}</span>
                              : meta && <><Chip tone={meta.tone}>{meta.label}</Chip>{l.action_text && <span className="mt-0.5 block text-muted-foreground">{l.action_text}</span>}</>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {preview.missing.length > 0 && (
                <Callout tone="info" icon={Info}>
                  The file says nothing about {preview.missing.length} transfer{preview.missing.length === 1 ? '' : 's'} of this run ({preview.missing.map((m) => `${m.vendor_name ?? m.payment_no} ${rupees(m.amount)}`).join(', ')}).
                  {' '}They keep their current state until a later reverse file answers them.
                </Callout>
              )}
              {s.problems > 0 && usable > 0 && <p className="text-xs text-muted-foreground">Lines that cannot be used are left out; the rest are applied.</p>}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {result ? (
            <Button type="button" onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={applying} onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={applying || !preview || usable === 0} onClick={apply}>
                {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {usable > 0 ? `Apply ${usable} line${usable === 1 ? '' : 's'}` : 'Nothing to apply'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyResult({ result }: { result: ReverseApplyResult }) {
  const failed = result.results.filter((r) => r.result === 'FAILED');
  return (
    <div className="space-y-3">
      {failed.length > 0 && (
        <Callout tone="danger" icon={AlertTriangle}>
          <b>Payment not successful</b> for {failed.map((r) => `${r.vendor_name ?? r.payment_no} (${rupees(r.amount)})`).join(', ')}.
          {' '}{failed.length === 1 ? 'It is' : 'They are'} back on Make payment with the bank's reason; {failed.length === 1 ? 'its journal was' : 'their journals were'} reversed
          {failed.some((r) => r.reversal_journal_no) ? ` (${failed.map((r) => r.reversal_journal_no).filter(Boolean).join(', ')})` : ''}.
        </Callout>
      )}
      <ul className="divide-y rounded-lg border text-xs">
        {result.results.map((r) => {
          const meta = RESULT_META[r.result];
          return (
            <li key={r.batch_item_sno} className="flex flex-wrap items-start justify-between gap-2 px-2.5 py-2">
              <span className="min-w-0">
                <span className="font-medium">{r.vendor_name ?? r.payment_no}</span> <span className="text-muted-foreground">· {r.payment_no} · {rupees(r.amount)}</span>
                {r.message && <span className="block text-muted-foreground">{r.message}</span>}
              </span>
              <Chip tone={meta.tone}>{meta.label}</Chip>
            </li>
          );
        })}
      </ul>
      {result.problems.length > 0 && (
        <Callout tone="warning" icon={Info}>{result.problems.length} line{result.problems.length === 1 ? ' was' : 's were'} left out: {result.problems.map((p) => `line ${p.row_no} (${p.problem})`).join('; ')}.</Callout>
      )}
    </div>
  );
}

// ─── DEVELOPMENT ONLY: make a pretend reverse file for a run ───────────────

function DevTestReverseDialog({ run, items, onClose, onUse }: {
  run: PaymentBatch; items: PaymentBatchItem[]; onClose: () => void; onUse: (f: Omit<PickedFile, 'id'>) => void;
}) {
  type Gen = typeof import('./testReverseFile');
  const [gen, setGen] = useState<Gen | null>(null);
  const [statuses, setStatuses] = useState<Record<number, BankLineStatus | ''>>({});
  useEffect(() => {
    // dynamic import behind import.meta.env.DEV (false in a production build): the build drops it, so the test file maker never ships
    if (!import.meta.env.DEV) return undefined;
    let live = true;
    import('./testReverseFile').then((m) => {
      if (!live) return;
      setGen(m);
      setStatuses(m.defaultTestStatuses(m.testableLines(items)));
    });
    return () => { live = false; };
  }, [items]);
  const lines = gen ? gen.testableLines(items) : [];
  const make = () => gen!.buildTestReverseFile(run, items, statuses);
  const any = Object.values(statuses).some(Boolean);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] gap-4 overflow-y-auto sm:w-full sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-violet-600" />Test reverse file</DialogTitle>
          <DialogDescription>Development only - pretend the bank answered {run.file_name}. Choose an answer for each transfer, then use the file or download it.</DialogDescription>
        </DialogHeader>
        {!gen ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
          : lines.length === 0 ? <Callout tone="neutral" icon={Info}>This run has no NEFT / RTGS transfer with a reference.</Callout>
          : (
            <ul className="divide-y rounded-lg border text-sm">
              {lines.map((it) => {
                const key = it.batch_item_sno ?? it.line_no;
                return (
                  <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it.vendor_name ?? it.payment_no}</span>
                      <span className="block truncate text-xs text-muted-foreground">{it.payment_no} · {rupees(it.amount)} · {it.mode}{it.bank_status ? ` · now ${it.bank_status}` : ''}</span>
                    </span>
                    <Select value={statuses[key] || 'NONE'} onValueChange={(v) => setStatuses((p) => ({ ...p, [key]: v === 'NONE' ? '' : (v as BankLineStatus) }))}>
                      <SelectTrigger className="h-8 w-36 shrink-0 text-xs" aria-label={`Bank answer for ${it.payment_no}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['PAID', 'PENDING', 'REJECTED', 'RETURNED'] as BankLineStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="NONE">(leave out)</SelectItem>
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
          )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={!gen || !any} onClick={() => { const f = make(); downloadTextFile(f.file_name, f.content, 'text/csv;charset=utf-8'); }}>Download</Button>
          <Button type="button" disabled={!gen || !any} onClick={() => { const f = make(); onUse({ name: f.file_name, content: f.content }); }}><Upload className="mr-1.5 h-4 w-4" />Upload it now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Make payment: a payment the bank did not pay ──────────────────────────

/** Why the bank did not pay it, and - for whoever may run payments - a change of how it is paid next time. */
export function BankFailureBox({ entry: e, canChange, onChanged }: { entry: PaymentEntry; canChange: boolean; onChanged: () => void }) {
  const f = e.bank_failure as BankFailure;
  const current = String(e.mode ?? '').toUpperCase();
  const [mode, setMode] = useState<RetryMode | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const target = mode || (RETRY_MODES as readonly string[]).find((m) => m === current) || '';
  const problem = mode ? retryModeProblem(mode, e.net_paid) : '';
  const save = async () => {
    if (!mode || mode === current) return;
    setSaving(true);
    try {
      await axios.post(payNetRunChangeMode, { payment_sno: e.payment_sno, mode, reason: reason.trim() || undefined });
      toast.success(`${e.payment_no} will be paid by ${RETRY_MODE_LABEL[mode]}`);
      setMode(''); setReason('');
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change how it is paid'));
    } finally {
      setSaving(false);
    }
  };
  return (
    // it sits in the detail row of a table that scrolls sideways on small screens: kept to the visible width so its button is reachable
    <div className="sticky left-0 max-w-[min(48rem,calc(100cqw-3rem))] space-y-3 whitespace-normal rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs dark:border-red-500/30 dark:bg-red-950/20">
      <div className="flex items-start gap-2 text-red-800 dark:text-red-300">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold">Payment was not successful</p>
          <p>{bankFailureText(f)}{f.failed_at ? ` · ${bankWhen(f.failed_at)}` : ''}{f.attempts > 1 ? ` · ${f.attempts} attempts` : ''}</p>
          <p className="text-red-700/80 dark:text-red-300/80">
            Sent by {f.mode ?? '—'} to {f.bank_name ?? 'account'} ••••{f.account_last4 ?? '????'}{f.ifsc ? ` (${f.ifsc})` : ''}{f.utr_no ? ` · UTR ${f.utr_no}` : ''}. Its journal was reversed.
          </p>
        </div>
      </div>
      <Callout tone={f.kyc_bank_changed ? 'success' : 'warning'} icon={f.kyc_bank_changed ? CheckCircle2 : Info}>
        {f.kyc_bank_changed
          ? `The supplier's KYC bank account has changed since (now ${e.bank_name ?? 'bank'} ••••${String(e.ac_number ?? '').slice(-4)}) - the next run pays the new account.`
          : "The supplier's KYC still has the same bank account. If the account was the problem, update the supplier KYC first - the next run takes the account from it."}
      </Callout>
      {canChange && (
        <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-[11px]">Pay next time by</Label>
            <Select value={target} onValueChange={(v) => setMode(v as RetryMode)}>
              <SelectTrigger className="h-8 bg-card text-xs" aria-label={`How to pay ${e.payment_no} next time`}><SelectValue placeholder={current || 'Choose'} /></SelectTrigger>
              <SelectContent>{RETRY_MODES.map((m) => <SelectItem key={m} value={m}>{RETRY_MODE_LABEL[m]}{m === current ? ' · now' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Note (optional)</Label>
            <Textarea rows={1} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="e.g. account closed - paying by cheque" className="min-h-8 resize-none bg-card py-1.5 text-xs" />
          </div>
          <Button type="button" size="sm" className="h-8" disabled={saving || !mode || mode === current || !!problem} onClick={save}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Change mode
          </Button>
          {problem && <p className="text-red-700 sm:col-span-3 dark:text-red-300">{problem}</p>}
        </div>
      )}
    </div>
  );
}
