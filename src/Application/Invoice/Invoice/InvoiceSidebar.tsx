import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, FileText, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Invoice } from './types';
import { formatDate, formatINR, matchStatusTone } from './helpers';

interface InvoiceSidebarProps {
  invoices: Invoice[];
  loading: boolean;
  selected: Invoice | null;
  onSelect: (invoice: Invoice) => void;
  onNewInvoice: () => void;
  canCreate: boolean;
}

const InvoiceSidebar: React.FC<InvoiceSidebarProps> = ({ invoices, loading, selected, onSelect, onNewInvoice, canCreate }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(i =>
      !q ||
      (i.vendor_name ?? '').toLowerCase().includes(q) ||
      (i.po_no ?? '').toLowerCase().includes(q) ||
      (i.vendor_invoice_no ?? '').toLowerCase().includes(q)
    );
  }, [invoices, search]);

  return (
    <div className="w-80 flex-shrink-0 bg-card border-r flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{invoices.length} invoices</span>
        {canCreate && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onNewInvoice}>
            <Plus size={13} className="mr-1" /> New
          </Button>
        )}
      </div>

      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search invoice, vendor, PO..."
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
            <span className="text-sm">Loading invoices...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="m-3 flex flex-col items-center rounded-2xl border border-dashed border-primary/20 bg-gradient-to-b from-primary/[0.07] to-card px-4 py-8 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
              <FileText size={21} />
            </span>
            <span className="text-sm font-semibold text-foreground">{search ? 'No matching invoices' : 'No invoices yet'}</span>
            <span className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {search ? 'Try another invoice, vendor, or PO.' : 'Captured invoices will appear in this list.'}
            </span>
            {!search && canCreate && <Button size="sm" className="mt-4" onClick={onNewInvoice}><Plus size={14} /> New invoice</Button>}
          </div>
        ) : (
          filtered.map((inv, idx) => {
            const isActive = selected?.invoice_sno === inv.invoice_sno;
            return (
              <button
                key={inv.invoice_sno ?? idx}
                onClick={() => onSelect(inv)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary truncate">{inv.vendor_invoice_no || 'Invoice no. not entered'}</span>
                  <Badge className={`text-xs shrink-0 ml-1 ${matchStatusTone[inv.match_status] ?? ''}`}>{inv.match_status}</Badge>
                </div>
                <div className="text-xs text-foreground font-medium truncate">{inv.vendor_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground/70 truncate">
                  {inv.po_no ? `PO: ${inv.po_no}` : 'Not yet linked to a PO'} · {inv.invoice_type}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-semibold text-foreground">{formatINR(inv.invoice_amount)}</span>
                  <span className="text-xs text-muted-foreground/70">{formatDate(inv.invoice_date)}</span>
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

export default InvoiceSidebar;
