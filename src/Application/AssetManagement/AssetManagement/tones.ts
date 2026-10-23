import {
  Armchair, Hammer, Laptop, Package, Plug, Printer, Router, Snowflake, Tv, type LucideIcon,
} from 'lucide-react';
import type { Tone } from './helpers';

/**
 * Colour families. Every class is written out in full so Tailwind can see it, and each tone has a dark-mode
 * pair, so a badge never turns into a pastel block on a dark theme.
 */
export const TONE: Record<Tone, { chip: string; dot: string; text: string; tint: string; edge: string }> = {
  amber: {
    chip: 'bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',
    dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', tint: 'bg-amber-500/10 dark:bg-amber-400/10', edge: 'border-t-amber-500',
  },
  sky: {
    chip: 'bg-sky-500/10 text-sky-800 ring-sky-600/25 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25',
    dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', tint: 'bg-sky-500/10 dark:bg-sky-400/10', edge: 'border-t-sky-500',
  },
  violet: {
    chip: 'bg-violet-500/10 text-violet-800 ring-violet-600/25 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25',
    dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', tint: 'bg-violet-500/10 dark:bg-violet-400/10', edge: 'border-t-violet-500',
  },
  teal: {
    chip: 'bg-teal-500/10 text-teal-800 ring-teal-600/25 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25',
    dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', tint: 'bg-teal-500/10 dark:bg-teal-400/10', edge: 'border-t-teal-500',
  },
  green: {
    chip: 'bg-green-500/10 text-green-800 ring-green-600/25 dark:bg-green-400/10 dark:text-green-300 dark:ring-green-400/25',
    dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300', tint: 'bg-green-500/10 dark:bg-green-400/10', edge: 'border-t-green-500',
  },
  red: {
    chip: 'bg-red-500/10 text-red-800 ring-red-600/25 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25',
    dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300', tint: 'bg-red-500/10 dark:bg-red-400/10', edge: 'border-t-red-500',
  },
  slate: {
    chip: 'bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/25',
    dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', tint: 'bg-slate-500/10 dark:bg-slate-400/10', edge: 'border-t-slate-400',
  },
};

/** A picture for the product, picked from its category. Anything unrecognised gets the plain box. */
export const assetIcon = (category?: string | null, sub?: string | null): LucideIcon => {
  const t = `${category ?? ''} ${sub ?? ''}`.toLowerCase();
  if (/laptop|computer|desktop|notebook/.test(t)) return Laptop;
  if (/printer|scanner|copier/.test(t)) return Printer;
  if (/network|router|switch|wifi/.test(t)) return Router;
  if (/furniture|chair|table|desk|cabinet|sofa/.test(t)) return Armchair;
  if (/display|television|\btv\b|monitor|projector/.test(t)) return Tv;
  if (/air cond|\bac\b/.test(t)) return Snowflake;
  if (/tool|drill|machine/.test(t)) return Hammer;
  if (/electric|electronic|appliance/.test(t)) return Plug;
  return Package;
};
