import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AssetRequest } from '@/Services/GrnService/assetApi';
import { kindLabel } from './helpers';

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

export const KindTag: React.FC<{ r: Pick<AssetRequest, 'request_type' | 'service_mode'> }> = ({ r }) => (
  <Tag tone={r.request_type === 'RETURN' ? 'return' : r.service_mode === 'INSTORE' ? 'onsite' : 'outside'}>{kindLabel(r)}</Tag>
);
