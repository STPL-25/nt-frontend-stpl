import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Loader2, ReceiptText, ChevronRight, Plus } from 'lucide-react';
import type { Bill } from './types';
import { formatDate, formatINR } from './helpers';

interface BillSidebarProps {
  bills: Bill[];
  loading: boolean;
  selected: Bill | null;
  onSelect: (bill: Bill) => void;
  onNew?: () => void;
}

const statusBadge: Record<string, string> = {
  'Draft':            'bg-muted text-muted-foreground border-border',
  'Pending Approval': 'bg-amber-100 text-amber-700 border-amber-200',
  'Approved':         'bg-blue-100  text-blue-700  border-blue-200',
  'Partially Paid':   'bg-amber-100 text-amber-700 border-amber-200',
  'Paid':             'bg-green-100 text-green-700 border-green-200',
  'Rejected':         'bg-red-100   text-red-700   border-red-200',
};

const BillSidebar: React.FC<BillSidebarProps> = ({ bills, loading, selected, onSelect, onNew }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bills.filter(b =>
      !q ||
      (b.bill_no ?? '').toLowerCase().includes(q) ||
      (b.supplier_invoice_no ?? '').toLowerCase().includes(q) ||
      (b.vendor_name ?? '').toLowerCase().includes(q) ||
      (b.po_no ?? '').toLowerCase().includes(q)
    );
  }, [bills, search]);

  return (
    <div className="w-80 flex-shrink-0 bg-card border-r flex flex-col overflow-hidden h-full">
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1">{bills.length} bills</span>
        {onNew && (
          <Button size="sm" className="h-7 text-xs" onClick={onNew}>
            <Plus size={13} className="mr-1" /> New
          </Button>
        )}
      </div>

      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search bill, invoice, vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Loading bills...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <ReceiptText size={24} />
            <span className="text-sm">No bills found</span>
          </div>
        ) : (
          filtered.map((b, idx) => {
            const isActive = selected?.bill_sno === b.bill_sno;
            return (
              <button
                key={b.bill_sno ?? idx}
                onClick={() => onSelect(b)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary truncate">
                    {b.bill_no ?? `Bill #${b.bill_sno}`}
                  </span>
                  <Badge className={`text-xs shrink-0 ml-1 ${statusBadge[b.status]}`}>{b.status}</Badge>
                </div>
                <div className="text-xs text-foreground font-medium truncate">{b.vendor_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground/70 truncate">Inv: {b.supplier_invoice_no}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-medium text-foreground">{formatINR(b.net_payable)}</span>
                  <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                    {formatDate(b.invoice_date)} <ChevronRight size={14} />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BillSidebar;
