import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput, SelectableCard, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import type { GateEntryRecord } from './types';
import { formatDate } from './helpers';

interface GateEntrySidebarProps {
  entries: GateEntryRecord[];
  loading: boolean;
  selected: GateEntryRecord | null;
  onSelect: (entry: GateEntryRecord) => void;
  onNew?: () => void;
  onRefresh: () => void;
}

export const GATE_STATUS_TONE: Record<string, Tone> = {
  'In': 'info',
  'Verified': 'warning',
  'GRN Done': 'success',
  'Out': 'neutral',
};

/** List body for SidebarDetailLayout: pinned search / refresh / New row, then one card per gate entry. */
const GateEntrySidebar: React.FC<GateEntrySidebarProps> = ({
  entries, loading, selected, onSelect, onNew, onRefresh,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e =>
      !q ||
      (e.gate_entry_no ?? '').toLowerCase().includes(q) ||
      (e.po_no ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q) ||
      (e.transport_name ?? '').toLowerCase().includes(q) ||
      (e.invoice_no ?? '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
        <SearchInput value={search} onChange={setSearch} placeholder="Search gate no, PO, transport…" className="min-w-0 flex-1" />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onRefresh} disabled={loading} aria-label="Refresh list">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
        {onNew && (
          <Button type="button" size="sm" className="h-9 shrink-0 gap-1" onClick={onNew}>
            <Plus className="h-4 w-4" />New
          </Button>
        )}
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading gate entries…</span>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{search ? 'No matches found' : 'No gate entries found'}</p>
      ) : (
        filtered.map((e, idx) => {
          const isActive = selected?.gate_entry_sno === e.gate_entry_sno;
          const status = e.status ?? 'In';
          return (
            <SelectableCard key={e.gate_entry_sno ?? idx} selected={isActive} onClick={() => onSelect(e)}>
              <span className="flex items-start justify-between gap-2">
                <span className="block min-w-0">
                  <span className="block truncate text-sm font-semibold">{e.gate_entry_no ?? `GE #${e.gate_entry_sno}`}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{e.vendor_name ?? '—'}</span>
                </span>
                <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', isActive ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
              </span>
              <span className="mt-2.5 block">
                <StatusPill tone={GATE_STATUS_TONE[status] ?? 'neutral'}>{status}</StatusPill>
              </span>
              <span className="mt-3 block space-y-1 text-xs">
                <span className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">PO</span>
                  <span className="truncate text-right font-medium">{e.po_no ?? '—'}</span>
                </span>
                <span className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">Transport</span>
                  <span className="truncate text-right font-medium">{e.transport_name ?? '—'}</span>
                </span>
                <span className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Received</span>
                  <span className="text-right font-medium">{formatDate(e.received_date)}{e.invoice_no ? ` · ${e.invoice_no}` : ''}</span>
                </span>
              </span>
            </SelectableCard>
          );
        })
      )}
    </>
  );
};

export default GateEntrySidebar;
