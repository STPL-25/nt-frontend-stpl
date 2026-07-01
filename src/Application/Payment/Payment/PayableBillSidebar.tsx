import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Wallet, ChevronRight } from 'lucide-react';
import type { PayableBill } from './types';
import { formatDate, formatINR, isOverdue } from './helpers';

interface PayableBillSidebarProps {
  bills: PayableBill[];
  loading: boolean;
  selected: PayableBill | null;
  onSelect: (bill: PayableBill) => void;
}

const PayableBillSidebar: React.FC<PayableBillSidebarProps> = ({ bills, loading, selected, onSelect }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bills.filter(b =>
      !q ||
      b.bill_no.toLowerCase().includes(q) ||
      (b.vendor_name ?? '').toLowerCase().includes(q) ||
      (b.po_no ?? '').toLowerCase().includes(q) ||
      (b.supplier_invoice_no ?? '').toLowerCase().includes(q)
    );
  }, [bills, search]);

  const totalDue = bills.reduce((s, b) => s + b.outstanding, 0);

  return (
    <div className="w-80 flex-shrink-0 bg-card border-r flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b bg-muted/40 flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{bills.length} payable bills</span>
        <span className="text-xs font-semibold text-red-600">Outstanding: {formatINR(totalDue)}</span>
      </div>

      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search bill, vendor, PO..."
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
            <Wallet size={24} />
            <span className="text-sm">No payable bills</span>
          </div>
        ) : (
          filtered.map((b, idx) => {
            const isActive = selected?.bill_sno === b.bill_sno;
            const overdue = isOverdue(b.due_date) && b.outstanding > 0;
            return (
              <button
                key={b.bill_sno ?? idx}
                onClick={() => onSelect(b)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary truncate">{b.bill_no}</span>
                  {overdue && (
                    <Badge className="text-xs shrink-0 ml-1 bg-red-100 text-red-700 border-red-200">Overdue</Badge>
                  )}
                  {!overdue && b.paid_amount > 0 && (
                    <Badge className="text-xs shrink-0 ml-1 bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>
                  )}
                </div>
                <div className="text-xs text-foreground font-medium truncate">{b.vendor_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground/70 truncate">Due: {formatDate(b.due_date)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-semibold text-red-600">{formatINR(b.outstanding)}</span>
                  <ChevronRight size={14} className="text-muted-foreground/70" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PayableBillSidebar;
