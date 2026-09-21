import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2, XCircle, Clock, Check, Repeat, Wallet, Layers, Search, X, ListChecks, Landmark, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AGREEMENT_TYPE_LABEL, TONE, computeAmount, formatINR,
  type AgreementType, type SupplierShare, type Tone,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

// Shared presentational pieces for the Service Agreement / Service PO screens
// (create pages + their approval screens). Colours come from theme tokens
// (primary/muted/card/border) so the four screens follow the app's colour
// themes and dark mode; only status/type accents use fixed hues, each with a
// dark-mode variant.

export function StatusPill({ tone = 'neutral', children, className }: {
  tone?: Tone; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
      TONE[tone], className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const TYPE_BADGE: Record<AgreementType, { Icon: LucideIcon; tone: Tone }> = {
  FIXED_RECURRING: { Icon: Repeat, tone: 'primary' },
  VARIABLE_RECURRING: { Icon: Wallet, tone: 'violet' },
  STATUTORY: { Icon: Landmark, tone: 'info' },
};

export function TypeBadge({ type, className }: { type?: string; className?: string }) {
  const known = type && type in TYPE_BADGE ? (type as AgreementType) : 'VARIABLE_RECURRING';
  const { Icon, tone } = TYPE_BADGE[known];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
      TONE[tone], className,
    )}>
      <Icon className="h-3 w-3" />
      {AGREEMENT_TYPE_LABEL[known]}
    </span>
  );
}

// ─── Suppliers ─────────────────────────────────────────────────────────────

/** Compact one-line supplier label for lists: the primary supplier, plus "+N more". The full
 *  split is in the tooltip. `fallback` covers rows that predate the split. */
export function SupplierSummary({ suppliers, fallback, className }: {
  suppliers?: Pick<SupplierShare, 'vendor_name' | 'share_amount'>[] | null; fallback?: string | null; className?: string;
}) {
  const list = suppliers ?? [];
  if (list.length === 0) return <span className={className}>{fallback ?? '—'}</span>;
  const [first, ...rest] = list;
  const title = list.map((s) => `${s.vendor_name ?? 'Supplier'} — ${formatINR(s.share_amount)}`).join('\n');
  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5', className)} title={title}>
      <span className="truncate">{first.vendor_name ?? fallback ?? '—'}</span>
      {rest.length > 0 && (
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">
          +{rest.length} more
        </span>
      )}
    </span>
  );
}

/** Supplier split as a small table: who, how much, and what share of the whole. */
export function SupplierSplitTable({ suppliers, amountLabel = 'Share' }: {
  suppliers: { vendor_name?: string | null; amount: number; pct?: number | null; extra?: React.ReactNode }[];
  amountLabel?: string;
}) {
  if (suppliers.length === 0) return <p className="text-sm text-muted-foreground">No suppliers recorded.</p>;
  const total = suppliers.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Supplier</th>
            <th className="px-3 py-2 text-right font-medium">{amountLabel}</th>
            <th className="w-16 px-3 py-2 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {suppliers.map((s, i) => {
            const pct = s.pct ?? (total > 0 ? (Number(s.amount) / total) * 100 : 0);
            return (
              <tr key={`${s.vendor_name}-${i}`}>
                <td className="px-3 py-2">
                  <span className="font-medium">{s.vendor_name ?? '—'}</span>
                  {i === 0 && suppliers.length > 1 && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">primary</span>}
                  {s.extra && <div className="mt-0.5 text-xs text-muted-foreground">{s.extra}</div>}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatINR(s.amount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Number(pct).toFixed(pct % 1 === 0 ? 0 : 1)}%</td>
              </tr>
            );
          })}
        </tbody>
        {suppliers.length > 1 && (
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-3 py-2 text-xs font-medium text-muted-foreground">Total</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{formatINR(total)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Small "N suppliers" marker used next to totals. */
export function SupplierCountPill({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      <Users className="h-3 w-3" />{count} suppliers
    </span>
  );
}

// ─── Layout building blocks ────────────────────────────────────────────────

export function Panel({ icon: Icon, title, description, action, children, className, bodyClassName }: {
  icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function FactGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 @xl:grid-cols-3', className)}>{children}</dl>;
}

export function Fact({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

export interface HeroMetric { label: string; value: React.ReactNode; hint?: string; accent?: boolean }

const HERO_COLS: Record<number, string> = { 1: '@md:grid-cols-1', 2: '@md:grid-cols-2', 3: '@md:grid-cols-3', 4: '@md:grid-cols-4' };

export function DetailHero({ icon: Icon, eyebrow, title, subtitle, badges, metrics }: {
  icon: LucideIcon; eyebrow?: string; title: string; subtitle?: React.ReactNode;
  badges?: React.ReactNode; metrics?: HeroMetric[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-4 @md:px-6 @md:py-5">
        <div className="flex items-start gap-3.5">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm @md:flex">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
            <h2 className="break-words text-lg font-bold leading-tight @md:text-xl">{title}</h2>
            {subtitle && <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>}
            {badges && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
          </div>
        </div>
      </div>

      {metrics && metrics.length > 0 && (
        <dl className={cn('grid grid-cols-2 gap-px border-t bg-border', HERO_COLS[Math.min(metrics.length, 4)])}>
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={cn(
                'min-w-0 bg-card px-4 py-3 @md:px-5',
                i === metrics.length - 1 && metrics.length % 2 === 1 && 'col-span-2 @md:col-span-1',
              )}
            >
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</dt>
              <dd className={cn('mt-0.5 break-words text-lg font-bold tabular-nums @md:text-xl', m.accent && 'text-primary')}>
                {m.value}
              </dd>
              {m.hint && <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>}
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function Callout({ tone = 'primary', icon: Icon, children, className }: {
  tone?: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed', TONE[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─── Amount breakdown ──────────────────────────────────────────────────────

function BreakdownRow({ label, value, negative }: { label: React.ReactNode; value: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium tabular-nums', negative && 'text-red-600 dark:text-red-400')}>{value}</dd>
    </div>
  );
}

/** Rate → discount → GST → net, plus a meter against the agreement ceiling
 *  when one applies. `net` overrides the computed total (e.g. the stored value). */
export function AmountBreakdown({ rate, qty, discountPct, gstPct, net, ceiling }: {
  rate: number; qty: number; discountPct: number; gstPct: number; net?: number; ceiling?: number | null;
}) {
  const c = computeAmount({ rate, qty, discountPct, gstPct });
  const total = net ?? c.net;
  const hasCeiling = ceiling != null && Number(ceiling) > 0;
  const usedPct = hasCeiling ? (total / Number(ceiling)) * 100 : 0;
  const over = hasCeiling && total > Number(ceiling);
  const near = hasCeiling && !over && usedPct >= 80;
  const meterTone = over ? 'red' : near ? 'amber' : 'emerald';

  return (
    <div>
      <dl className="space-y-2.5">
        <BreakdownRow
          label={<>Rate × Qty <span className="text-xs">({formatINR(rate)} × {qty})</span></>}
          value={formatINR(c.subtotal)}
        />
        {discountPct > 0 && <BreakdownRow label={`Discount (${discountPct}%)`} value={`− ${formatINR(c.discountAmt)}`} negative />}
        {gstPct > 0 && <BreakdownRow label={`GST (${gstPct}%)`} value={`+ ${formatINR(c.gstAmt)}`} />}
        <div className="flex items-baseline justify-between gap-3 border-t pt-3">
          <dt className="text-sm font-semibold">Net amount</dt>
          <dd className={cn('text-xl font-bold tabular-nums', over ? 'text-red-600 dark:text-red-400' : 'text-primary')}>{formatINR(total)}</dd>
        </div>
      </dl>

      {hasCeiling && (
        <div className="mt-4 space-y-1.5 border-t pt-4">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Agreement ceiling · {formatINR(Number(ceiling))}</span>
            <span className={cn(
              'font-semibold tabular-nums',
              meterTone === 'red' && 'text-red-600 dark:text-red-400',
              meterTone === 'amber' && 'text-amber-600 dark:text-amber-400',
              meterTone === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
            )}>
              {usedPct.toFixed(0)}% used
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(usedPct))}
            aria-label="Share of agreement ceiling used"
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                meterTone === 'red' && 'bg-red-500',
                meterTone === 'amber' && 'bg-amber-500',
                meterTone === 'emerald' && 'bg-emerald-500',
              )}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
          {over && <p className="text-xs text-red-600 dark:text-red-400">Exceeds the ceiling by {formatINR(total - Number(ceiling))}.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Filters ───────────────────────────────────────────────────────────────

export interface ChipOption<T extends string> { value: T; label: string; count?: number }

export function FilterChips<T extends string>({ options, value, onChange, className }: {
  options: ChipOption<T>[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn(
                'rounded-full px-1.5 text-[11px] tabular-nums',
                active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground',
              )}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pl-9 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── Approval screens ──────────────────────────────────────────────────────

/** Sidebar list entry — a real button so it is keyboard reachable. */
export function SelectableCard({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl border p-3.5 pl-4 text-left shadow-xs transition-all',
        'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1 transition-colors', selected ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/30')}
      />
      {children}
    </button>
  );
}

export function ApprovalStepper({ stages, currentApproverId, currentUserEcno }: {
  stages: any[]; currentApproverId?: string; currentUserEcno?: string;
}) {
  if (!stages.length) return null;
  // The backend advances by matching the approver's ecno to a stage, so the
  // first match is the stage awaiting a decision; earlier ones are complete.
  const currentIdx = stages.findIndex((s) => s.approver_ecno === currentApproverId);

  return (
    <Panel icon={ListChecks} title="Approval workflow" description={`${stages.length} stage${stages.length !== 1 ? 's' : ''}`}>
      <ol>
        {stages.map((stage, idx) => {
          const state = currentIdx === -1 ? 'upcoming' : idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming';
          const isLast = idx === stages.length - 1;
          const isYou = currentUserEcno && String(stage.approver_ecno).trim() === String(currentUserEcno).trim();
          return (
            <li key={idx} className={cn('relative pl-11', !isLast && 'pb-5')}>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn('absolute left-[15px] top-8 bottom-0 w-px', state === 'done' ? 'bg-emerald-400/70' : 'bg-border')}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                  state === 'done' && 'border-emerald-500 bg-emerald-500 text-white',
                  state === 'current' && 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15',
                  state === 'upcoming' && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {state === 'done' ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
                <p className={cn('text-sm font-semibold', state === 'upcoming' && 'text-muted-foreground')}>
                  {stage.stage ?? `Stage ${idx + 1}`}
                </p>
                {state === 'current' && <StatusPill tone="warning">Awaiting decision</StatusPill>}
                {state === 'done' && <StatusPill tone="success">Cleared</StatusPill>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Approver · <span className="font-medium text-foreground/80">{stage.approver_ecno}</span>
                {isYou && <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">You</span>}
              </p>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

export function DecisionButtons({ onApprove, onReject, approveLabel, rejectLabel, className }: {
  onApprove: () => void; onReject: () => void; approveLabel: string; rejectLabel: string; className?: string;
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Button
        onClick={onApprove}
        className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40"
      >
        <CheckCircle2 className="h-4 w-4" />{approveLabel}
      </Button>
      <Button onClick={onReject} variant="destructive" className="h-11 flex-1">
        <XCircle className="h-4 w-4" />{rejectLabel}
      </Button>
    </div>
  );
}

/** Pins the Approve/Reject buttons to the bottom of the scroll area below `xl`,
 *  where the actions card has dropped under the content. */
export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 border-t bg-card/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.15)] backdrop-blur supports-[backdrop-filter]:bg-card/85 @4xl:hidden">
      {children}
    </div>
  );
}

export function DetailEmptyState({ icon: Icon = Layers, title, description }: {
  icon?: LucideIcon; title: string; description: string;
}) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-xs space-y-3 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
          <Icon className="h-8 w-8" />
        </span>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ApprovalDecisionDialog({
  open, onOpenChange, actionType, comments, setComments, onSubmit, loading,
  entityName, approveNote, summary,
}: {
  open: boolean; onOpenChange: (open: boolean) => void;
  actionType: 'approve' | 'reject';
  comments: string; setComments: (c: string) => void;
  onSubmit: () => void; loading: boolean;
  entityName: string; approveNote: string;
  summary?: { label: string; value: React.ReactNode }[];
}) {
  const approving = actionType === 'approve';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            approving ? TONE.success : TONE.danger, 'border',
          )}>
            {approving ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 space-y-1 pr-6">
            <DialogTitle className="text-base leading-tight sm:text-lg">
              {approving ? `Approve ${entityName}` : `Reject ${entityName}`}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {approving ? 'Optionally add a comment before approving.' : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </div>
        </DialogHeader>

        {summary && summary.length > 0 && (
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            {summary.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="break-words text-right font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {approving && <Callout tone="success" icon={CheckCircle2}>{approveNote}</Callout>}

        <div className="space-y-1.5">
          <Label htmlFor="decision-comments" className="text-xs sm:text-sm">
            Comments {!approving && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="decision-comments"
            autoFocus={!approving}
            placeholder={approving ? 'Any additional notes…' : 'Reason for rejection…'}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="sm:min-w-24">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={loading || (!approving && !comments.trim())}
            variant={approving ? 'default' : 'destructive'}
            className={cn('sm:min-w-40', approving && 'bg-emerald-600 text-white hover:bg-emerald-700')}
          >
            {loading ? (
              <><Clock className="h-4 w-4 animate-spin" />Processing…</>
            ) : approving ? (
              <><CheckCircle2 className="h-4 w-4" />Confirm approval</>
            ) : (
              <><XCircle className="h-4 w-4" />Confirm rejection</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
