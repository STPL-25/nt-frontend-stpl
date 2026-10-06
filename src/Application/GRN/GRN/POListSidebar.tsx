import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput, SelectableCard, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import type { PORecord } from './types';
import { formatDate, getPODisplayNo, getGRNStatus } from './helpers';

interface POListSidebarProps {
  poList: PORecord[];
  loading: boolean;
  selectedPO: PORecord | null;
  onSelectPO: (po: PORecord) => void;
  onRefresh: () => void;
}

export const GRN_STATUS_TONE: Record<string, Tone> = { green: 'success', amber: 'warning', red: 'danger' };

/** List body for SidebarDetailLayout: pinned search / refresh row, then one card per gate-cleared PO. */
const POListSidebar: React.FC<POListSidebarProps> = ({
  poList, loading, selectedPO, onSelectPO, onRefresh,
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

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
        <SearchInput value={search} onChange={setSearch} placeholder="Search PO no, vendor…" className="min-w-0 flex-1" />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onRefresh} disabled={loading} aria-label="Refresh list">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {loading && poList.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading POs…</span>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{search ? 'No matches found' : 'No POs found'}</p>
      ) : (
        filtered.map((po, idx) => {
          const isActive = selectedPO?.po_basic_sno === po.po_basic_sno;
          const { label, color } = getGRNStatus(po);
          return (
            <SelectableCard key={String(po.po_no ?? po.po_basic_sno ?? idx)} selected={isActive} onClick={() => onSelectPO(po)}>
              <span className="flex items-start justify-between gap-2">
                <span className="block min-w-0">
                  <span className="block truncate text-sm font-semibold">{getPODisplayNo(po)}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{po.vendor_name ?? po.company_name ?? '—'}</span>
                </span>
                <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', isActive ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
              </span>
              <span className="mt-2.5 block">
                <StatusPill tone={GRN_STATUS_TONE[color] ?? 'neutral'}>{label}</StatusPill>
              </span>
              <span className="mt-3 block space-y-1 text-xs">
                {po.gate_entry_no && (
                  <span className="flex justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">Gate entry</span>
                    <span className="truncate text-right font-medium">{po.gate_entry_no}</span>
                  </span>
                )}
                {po.pr_no && (
                  <span className="flex justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">PR</span>
                    <span className="truncate text-right font-medium">{po.pr_no}</span>
                  </span>
                )}
                <span className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-right font-medium">{formatDate(po.gate_received_date ?? po.po_date ?? po.required_date)}</span>
                </span>
              </span>
            </SelectableCard>
          );
        })
      )}
    </>
  );
};

export default POListSidebar;
