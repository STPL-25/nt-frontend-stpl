import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Loader2, RefreshCw, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput, SelectableCard, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { PRRecord } from './types';
import { formatDate, getPRDisplayNo, getPRItemCount } from './helpers';

interface PRListSidebarProps {
  prList: PRRecord[];
  loading: boolean;
  selectedPR: PRRecord | null;
  onSelectPR: (pr: PRRecord) => void;
  onRefresh: () => void;
  /** merge mode: allow multi-select with checkboxes */
  mergeMode?: boolean;
  mergeSelected?: Set<number>;
  onToggleMerge?: (prBasicSno: number) => void;
  /** Live split-group count per PR (pr_basic_sno → number of split POs). */
  splitInfo?: Record<number, number>;
}

/** List body for SidebarDetailLayout: pinned search / refresh row, then one card per approved PR. */
const PRListSidebar: React.FC<PRListSidebarProps> = ({
  prList, loading, selectedPR, onSelectPR, onRefresh,
  mergeMode = false, mergeSelected, onToggleMerge,
  splitInfo,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prList.filter(pr =>
      !q ||
      (pr.pr_no ?? '').toLowerCase().includes(q) ||
      (pr.com_name ?? '').toLowerCase().includes(q) ||
      (pr.dept_name ?? '').toLowerCase().includes(q) ||
      (pr.purpose ?? '').toLowerCase().includes(q)
    );
  }, [prList, search]);

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
        <SearchInput value={search} onChange={setSearch} placeholder="Search PR no, company…" className="min-w-0 flex-1" />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onRefresh} disabled={loading} aria-label="Refresh list">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>
      {mergeMode && mergeSelected && (
        <p className="px-1 text-xs font-medium text-primary">{mergeSelected.size} selected</p>
      )}

      {loading && prList.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading PRs…</span>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{search ? 'No matches found' : 'No PRs found'}</p>
      ) : (
        filtered.map((pr, idx) => {
          const isActive = selectedPR?.pr_basic_sno === pr.pr_basic_sno && selectedPR?.pr_no === pr.pr_no;
          const itemCount = getPRItemCount(pr);
          const isMergeChecked = !!(mergeMode && mergeSelected?.has(pr.pr_basic_sno!));
          const splitCount = pr.pr_basic_sno ? (splitInfo?.[pr.pr_basic_sno] ?? 0) : 0;
          const date = pr.reg_date ?? pr.request_date ?? pr.req_date;

          return (
            <SelectableCard
              key={String(pr.pr_no ?? pr.pr_id ?? pr.pr_basic_sno ?? idx)}
              selected={mergeMode ? isMergeChecked : isActive}
              onClick={() => {
                if (mergeMode && onToggleMerge && pr.pr_basic_sno) onToggleMerge(pr.pr_basic_sno);
                else onSelectPR(pr);
              }}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-2">
                  {mergeMode && <Checkbox checked={isMergeChecked} className="pointer-events-none mt-0.5" />}
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-semibold">{getPRDisplayNo(pr)}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{pr.com_name}</span>
                  </span>
                </span>
                {!mergeMode && (
                  <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', isActive ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
                )}
              </span>
              <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <StatusPill tone="success">Approved</StatusPill>
                {splitCount > 0 && (
                  <StatusPill tone="warning" className="gap-1">
                    <Scissors className="h-3 w-3" />{splitCount} split{splitCount > 1 ? 's' : ''}
                  </StatusPill>
                )}
              </span>
              <span className="mt-3 block space-y-1 text-xs">
                <span className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">Department</span>
                  <span className="truncate text-right font-medium">{pr.dept_name || '—'}</span>
                </span>
                <span className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Items</span>
                  <span className="text-right font-medium">{itemCount}</span>
                </span>
                {date && (
                  <span className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Raised</span>
                    <span className="text-right font-medium">{formatDate(date)}</span>
                  </span>
                )}
              </span>
            </SelectableCard>
          );
        })
      )}
    </>
  );
};

export default PRListSidebar;
