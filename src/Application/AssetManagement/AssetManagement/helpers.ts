import { formatDate, formatDateTime } from '@/lib/formatDate';
import type { AssetRequest } from '@/Services/GrnService/assetApi';

export const kindLabel = (r: Pick<AssetRequest, 'request_type' | 'service_mode'>) =>
  r.request_type === 'RETURN' ? 'Return' : r.service_mode === 'INSTORE' ? 'Repair on site' : 'Repair outside';

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

/** Colour families. One status keeps one colour on the board, in the side panel and on every badge. */
export type Tone = 'amber' | 'sky' | 'violet' | 'teal' | 'green' | 'red' | 'slate';

export const STAGES: { key: Stage; label: string; tone: Tone }[] = [
  { key: 'approval', label: 'Waiting for approval', tone: 'amber' },
  { key: 'act', label: 'Approved · to act', tone: 'sky' },
  { key: 'out', label: 'Out / in progress', tone: 'violet' },
  { key: 'back', label: 'Back · check & close', tone: 'teal' },
  { key: 'closed', label: 'Closed this month', tone: 'green' },
];

export const statusTone = (status: string): Tone => {
  switch (status) {
    case 'Pending Dept Approval':
    case 'Pending Approval': return 'amber';
    case 'Approved':
    case 'Return Order Raised': return 'sky';
    case 'At Vendor':
    case 'In Progress': return 'violet';
    case 'Goods Returned':
    case 'Received': return 'teal';
    case 'QC Failed':
    case 'Debit Note Raised':
    case 'Rejected': return 'red';
    case 'Completed':
    case 'Closed': return 'green';
    default: return 'slate';
  }
};

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
