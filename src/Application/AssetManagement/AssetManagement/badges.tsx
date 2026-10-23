import React from 'react';
import { RotateCcw, Truck, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetRequest } from '@/Services/GrnService/assetApi';
import { kindLabel, statusTone, type Tone } from './helpers';
import { TONE } from './tones';

/** Rounded status pill: "At Vendor", "6 days late", "3 open". */
export const Pill: React.FC<{
  tone: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}> = ({ tone, dot, icon: Icon, children, className }) => (
  <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset', TONE[tone].chip, className)}>
    {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', TONE[tone].dot)} />}
    {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
    {children}
  </span>
);

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className }) => (
  <Pill tone={statusTone(status)} dot className={className}>{status}</Pill>
);

/** What kind of request it is. Shape says the kind (icon + word); colour is kept for status. */
export const KindTag: React.FC<{ r: Pick<AssetRequest, 'request_type' | 'service_mode'>; className?: string }> = ({ r, className }) => {
  const Icon = r.request_type === 'RETURN' ? RotateCcw : r.service_mode === 'INSTORE' ? Wrench : Truck;
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-muted px-2 text-xs font-medium text-foreground/80', className)}>
      <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      {kindLabel(r)}
    </span>
  );
};

/**
 * Soft square tile that holds an icon. Neutral by default: the theme colour is kept for fills that carry their own
 * contrasting text (selected rows, buttons), because on a pale theme colour it would vanish as text or an icon.
 */
export const IconTile: React.FC<{ icon: LucideIcon; className?: string; iconClassName?: string }> = ({ icon: Icon, className, iconClassName }) => (
  <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-xl bg-muted text-foreground/70', className ?? 'h-10 w-10')}>
    <Icon className={cn('h-[18px] w-[18px]', iconClassName)} />
  </span>
);

/** Two-letter badge for a department or a person. */
export const Monogram: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground/70', className ?? 'h-9 w-9')}>
    {text}
  </span>
);

/** Thin bar showing how much of a total is in use. */
export const Meter: React.FC<{ value: number; total: number; className?: string }> = ({ value, total, className }) => {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <span aria-hidden="true" className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <span className={cn('block h-full rounded-full', TONE.green.dot)} style={{ width: `${pct}%` }} />
    </span>
  );
};
