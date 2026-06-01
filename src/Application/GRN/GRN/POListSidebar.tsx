import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, ShoppingCart, ChevronRight } from 'lucide-react';
import type { PORecord } from './types';
import { formatDate, getPODisplayNo, getGRNStatus } from './helpers';

interface POListSidebarProps {
  poList: PORecord[];
  loading: boolean;
  selectedPO: PORecord | null;
  onSelectPO: (po: PORecord) => void;
}

const statusBadge: Record<string, string> = {
  green: 'bg-green-100 text-green-700 border-green-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  red:   'bg-red-100   text-red-700   border-red-200',
};

const POListSidebar: React.FC<POListSidebarProps> = ({
  poList, loading, selectedPO, onSelectPO,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return poList.filter(po =>
      !q ||
      (po.po_no ?? '').toLowerCase().includes(q) ||
      (po.vendor_name ?? po.company_name ?? '').toLowerCase().includes(q) ||
      (po.pr_no ?? '').toLowerCase().includes(q) ||
      (po.com_name ?? '').toLowerCase().includes(q)
    );
  }, [poList, search]);

  const pendingCount   = poList.filter(p => !p.grn_status || p.grn_status === 'Pending').length;
  const partialCount   = poList.filter(p => p.grn_status === 'Partial').length;

  return (
    <div className="w-80 flex-shrink-0 bg-card border-r flex flex-col overflow-hidden">
      {/* Stats */}
      <div className="px-4 py-3 border-b bg-muted/40 flex gap-3 text-xs font-medium flex-wrap">
        <span className="text-muted-foreground">{poList.length} POs</span>
        {pendingCount > 0 && <span className="text-red-600">{pendingCount} pending</span>}
        {partialCount > 0 && <span className="text-amber-600">{partialCount} partial</span>}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search PO no, vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* PO List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Loading POs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <ShoppingCart size={24} />
            <span className="text-sm">No POs found</span>
          </div>
        ) : (
          filtered.map((po, idx) => {
            const isActive = selectedPO?.po_basic_sno === po.po_basic_sno;
            const poKey = String(po.po_no ?? po.po_basic_sno ?? idx);
            const { label, color } = getGRNStatus(po);

            return (
              <button
                key={poKey}
                onClick={() => onSelectPO(po)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary truncate">
                    {getPODisplayNo(po)}
                  </span>
                  <Badge className={`text-xs shrink-0 ml-1 ${statusBadge[color]}`}>
                    {label}
                  </Badge>
                </div>
                <div className="text-xs text-foreground font-medium truncate">
                  {po.vendor_name ?? po.company_name ?? '—'}
                </div>
                {po.pr_no && (
                  <div className="text-xs text-muted-foreground/70 truncate">PR: {po.pr_no}</div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground/70">
                    {formatDate(po.po_date ?? po.required_date)}
                  </span>
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

export default POListSidebar;
