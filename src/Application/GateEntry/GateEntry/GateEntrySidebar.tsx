import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Loader2, DoorOpen, ChevronRight, Plus } from 'lucide-react';
import type { GateEntryRecord } from './types';
import { formatDate } from './helpers';

interface GateEntrySidebarProps {
  entries: GateEntryRecord[];
  loading: boolean;
  selected: GateEntryRecord | null;
  onSelect: (entry: GateEntryRecord) => void;
  onNew?: () => void;
}

const statusBadge: Record<string, string> = {
  'In':       'bg-blue-100   text-blue-700   border-blue-200',
  'Verified': 'bg-amber-100  text-amber-700  border-amber-200',
  'GRN Done': 'bg-green-100  text-green-700  border-green-200',
  'Out':      'bg-muted      text-muted-foreground border-border',
};

const GateEntrySidebar: React.FC<GateEntrySidebarProps> = ({
  entries, loading, selected, onSelect, onNew,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e =>
      !q ||
      (e.gate_entry_no ?? '').toLowerCase().includes(q) ||
      (e.po_no ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q) ||
      (e.vehicle_no ?? '').toLowerCase().includes(q) ||
      (e.invoice_no ?? '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <div className="w-80 flex-shrink-0 bg-card border-r flex flex-col overflow-hidden h-full">
      {/* Header / New */}
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1">{entries.length} gate entries</span>
        {onNew && (
          <Button size="sm" className="h-7 text-xs" onClick={onNew}>
            <Plus size={13} className="mr-1" /> New
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search gate no, PO, vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Loading gate entries...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <DoorOpen size={24} />
            <span className="text-sm">No gate entries found</span>
          </div>
        ) : (
          filtered.map((e, idx) => {
            const isActive = selected?.gate_entry_sno === e.gate_entry_sno;
            return (
              <button
                key={e.gate_entry_sno ?? idx}
                onClick={() => onSelect(e)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-primary truncate">
                    {e.gate_entry_no ?? `GE #${e.gate_entry_sno}`}
                  </span>
                  <Badge className={`text-xs shrink-0 ml-1 ${statusBadge[e.status ?? 'In']}`}>
                    {e.status ?? 'In'}
                  </Badge>
                </div>
                <div className="text-xs text-foreground font-medium truncate">
                  {e.vendor_name ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground/70 truncate">
                  {e.po_no ? `PO: ${e.po_no}` : 'No PO'} • {e.vehicle_no ?? '—'}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground/70">
                    {formatDate(e.entry_date)} {e.entry_time}
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

export default GateEntrySidebar;
