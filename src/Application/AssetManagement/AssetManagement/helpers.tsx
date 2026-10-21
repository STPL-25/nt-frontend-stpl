import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import type { AssetRequest } from '@/Services/GrnService/assetApi';

const STATUS_STYLE: Record<string, string> = {
  'Pending Dept Approval': 'bg-amber-100 text-amber-800 border-amber-300',
  'Pending Approval': 'bg-amber-100 text-amber-800 border-amber-300',
  Approved: 'bg-blue-100 text-blue-800 border-blue-300',
  'Return Order Raised': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Goods Returned': 'bg-purple-100 text-purple-800 border-purple-300',
  'At Vendor': 'bg-orange-100 text-orange-800 border-orange-300',
  Received: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'In Progress': 'bg-orange-100 text-orange-800 border-orange-300',
  'QC Failed': 'bg-red-100 text-red-800 border-red-300',
  'Debit Note Raised': 'bg-red-100 text-red-800 border-red-300',
  Completed: 'bg-green-100 text-green-800 border-green-300',
  Closed: 'bg-green-100 text-green-800 border-green-300',
  Rejected: 'bg-red-100 text-red-800 border-red-300',
  Cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <Badge variant="outline" className={`whitespace-nowrap ${STATUS_STYLE[status] ?? ''}`}>{status}</Badge>
);

/** Small square-cornered tag used on cards and the side panel ("Return", "Repair outside", "6 days late"). */
export const Tag: React.FC<{ tone: 'return' | 'outside' | 'onsite' | 'late' | 'done' | 'muted' | 'pending'; children: React.ReactNode; className?: string }> = ({ tone, children, className }) => {
  const tones = {
    return: 'bg-purple-100 text-purple-800',
    outside: 'bg-orange-100 text-orange-800',
    onsite: 'bg-green-100 text-green-800',
    late: 'bg-red-100 text-red-700',
    done: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    muted: 'bg-muted text-muted-foreground',
  } as const;
  return (
    <span className={cn('inline-flex h-5 items-center whitespace-nowrap rounded-[5px] px-1.5 text-[11px] font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
};

export const kindLabel = (r: Pick<AssetRequest, 'request_type' | 'service_mode'>) =>
  r.request_type === 'RETURN' ? 'Return' : r.service_mode === 'INSTORE' ? 'Repair on site' : 'Repair outside';

export const KindTag: React.FC<{ r: Pick<AssetRequest, 'request_type' | 'service_mode'> }> = ({ r }) => (
  <Tag tone={r.request_type === 'RETURN' ? 'return' : r.service_mode === 'INSTORE' ? 'onsite' : 'outside'}>{kindLabel(r)}</Tag>
);

export const fmtDate = (v?: string | null) => (v ? formatDate(v) ?? '—' : '—');
export const fmtDateTime = (v?: string | null) => (v ? formatDateTime(v) ?? '—' : '—');

export const isPending = (status: string) =>
  status === 'Pending Dept Approval' || status === 'Pending Approval';

export const CLOSED_STATUSES = ['Completed', 'Closed', 'Rejected', 'Cancelled'];
export const isClosed = (status: string) => CLOSED_STATUSES.includes(status);

// ── Dates ────────────────────────────────────────────────────────────────
// The asset view sends dates as plain "yyyy-mm-dd hh:mm:ss" clock times (no zone), so we compare
// calendar days directly instead of going through Date's UTC handling.
const dayNumber = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
};
const todayNumber = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
};

/** Whole days since a date ("0" = today). null when the date is missing. */
export const daysSince = (v?: string | null) => {
  if (!v) return null;
  const n = dayNumber(v);
  return n === null ? null : Math.max(0, todayNumber() - n);
};

export const daysLabel = (n: number | null) => (n === null ? '' : n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`);

/** Days a service item is past its expected return date (0 when not late or not applicable). */
export const daysLate = (r: AssetRequest) => {
  if (r.request_type !== 'SERVICE' || !r.expected_return_date || isClosed(r.status)) return 0;
  if (isPending(r.status)) return 0;
  const due = dayNumber(r.expected_return_date);
  if (due === null) return 0;
  return Math.max(0, todayNumber() - due);
};

export const isThisMonth = (v?: string | null) => {
  if (!v) return false;
  const now = new Date();
  return v.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
};

// ── Board stages ─────────────────────────────────────────────────────────
export type Stage = 'approval' | 'act' | 'out' | 'back' | 'closed';

export const stageOf = (status: string): Stage => {
  if (isPending(status)) return 'approval';
  if (status === 'Approved' || status === 'Return Order Raised') return 'act';
  if (status === 'At Vendor' || status === 'In Progress') return 'out';
  if (isClosed(status)) return 'closed';
  return 'back'; // Goods Returned, Received, QC Failed, Debit Note Raised
};

export const STAGES: { key: Stage; label: string; dot: string }[] = [
  { key: 'approval', label: 'Waiting for approval', dot: 'bg-amber-500' },
  { key: 'act', label: 'Approved · to act', dot: 'bg-blue-600' },
  { key: 'out', label: 'Out / in progress', dot: 'bg-orange-600' },
  { key: 'back', label: 'Back · check & close', dot: 'bg-purple-600' },
  { key: 'closed', label: 'Closed this month', dot: 'bg-green-600' },
];

/** What has to happen next, in a few words (null once the request is finished). */
export const nextStepLabel = (r: AssetRequest): string | null => {
  if (isPending(r.status)) return 'Approve';
  if (r.request_type === 'RETURN') {
    if (r.status === 'Approved') return 'Raise Return Order';
    if (r.status === 'Return Order Raised') return 'Gate pass OUT';
    if (r.status === 'Goods Returned') return 'Raise Debit Note';
    return null;
  }
  if (r.service_mode === 'INSTORE') {
    if (r.status === 'Approved') return 'Start service';
    if (r.status === 'In Progress') return 'Mark OK / not OK';
    return null;
  }
  if (r.status === 'Approved') return 'Gate pass OUT';
  if (r.status === 'At Vendor') return 'Gate pass IN';
  if (r.status === 'Received') return 'Quality check';
  if (r.status === 'QC Failed') return 'Raise Debit Note';
  if (r.status === 'Debit Note Raised') return 'Send for re-service';
  return null;
};

/** The steps still ahead of the request, after the one it is on now (used greyed-out in the timeline). */
export const upcomingSteps = (r: AssetRequest): string[] => {
  if (isClosed(r.status)) return [];
  if (r.request_type === 'RETURN') {
    const flow = ['Return Order', 'Gate pass OUT · goods sent back', 'Debit Note', 'Closed'];
    const at: Record<string, number> = { Approved: 0, 'Return Order Raised': 1, 'Goods Returned': 2 };
    const i = isPending(r.status) ? -1 : at[r.status] ?? 3;
    return flow.slice(i + 1);
  }
  if (r.service_mode === 'INSTORE') {
    const flow = ['Service starts on site', 'Service OK — back in use'];
    const i = isPending(r.status) ? -1 : r.status === 'Approved' ? 0 : 1;
    return flow.slice(i + 1);
  }
  const flow = ['Gate pass OUT · sent to vendor', 'Gate pass IN · item back', 'GRN · quality check', 'Back in use'];
  const at: Record<string, number> = { Approved: 0, 'At Vendor': 1, Received: 2, 'QC Failed': 2, 'Debit Note Raised': 2 };
  const i = isPending(r.status) ? -1 : at[r.status] ?? 3;
  return flow.slice(i + 1);
};

/** Two-letter initials for a department or person. */
export const initials = (s?: string | null) => {
  const words = (s ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};
