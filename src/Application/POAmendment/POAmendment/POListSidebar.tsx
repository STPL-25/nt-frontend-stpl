import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, FileEdit, ChevronRight } from 'lucide-react';
import type { AmendablePO } from './types';
import { formatDate } from './helpers';

interface POListSidebarProps {
  poList: AmendablePO[];
  loading: boolean;
  selectedPO: AmendablePO | null;
  onSelectPO: (po: AmendablePO) => void;
}

const POListSidebar: React.FC<POListSidebarProps> = ({ poList, loading, selectedPO, onSelectPO }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return poList.filter(po =>
      !q ||
      po.po_no.toLowerCase().includes(q) ||
      (po.vendor_name ?? '').toLowerCase().includes(q)
    );
  }, [poList, search]);

  return (
    <div className="w-80 flex-shrink-0 bg-card border-r flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {poList.length} amendable POs
      </div>

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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Loading POs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <FileEdit size={24} />
            <span className="text-sm">No POs found</span>
          </div>
        ) : (
          filtered.map((po, idx) => {
            const isActive = selectedPO?.po_basic_sno === po.po_basic_sno;
            return (
              <button
                key={po.po_basic_sno ?? idx}
                onClick={() => onSelectPO(po)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary truncate">{po.po_no}</span>
                  {(po.amendment_count ?? 0) > 0 && (
                    <Badge className="text-xs shrink-0 ml-1 bg-amber-100 text-amber-700 border-amber-200">
                      R{po.amendment_count}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-foreground font-medium truncate">{po.vendor_name ?? '—'}</div>
                {po.status && <div className="text-xs text-muted-foreground/70 truncate">{po.status}</div>}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground/70">{formatDate(po.po_date)}</span>
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
