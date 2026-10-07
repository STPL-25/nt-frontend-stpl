import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/formatDate';

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

export const TypeBadge: React.FC<{ type: 'RETURN' | 'SERVICE'; mode?: string | null }> = ({ type, mode }) => (
  <Badge variant="secondary" className="whitespace-nowrap">
    {type === 'RETURN' ? 'Return' : `Service${mode ? ` · ${mode === 'OUTPASS' ? 'Outpass' : 'In-store'}` : ''}`}
  </Badge>
);

export const fmtDate = (v?: string | null) => (v ? formatDate(v) ?? '—' : '—');
export const fmtDateTime = (v?: string | null) => (v ? formatDateTime(v) ?? '—' : '—');

export const isPending = (status: string) =>
  status === 'Pending Dept Approval' || status === 'Pending Approval';
