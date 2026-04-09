import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, FileText, ChevronRight } from 'lucide-react';
import type { PRRecord } from './types';
import { formatDate, getPRDisplayNo, getPRItemCount } from './helpers';

interface PRListSidebarProps {
  prList: PRRecord[];
  loading: boolean;
  selectedPR: PRRecord | null;
  onSelectPR: (pr: PRRecord) => void;
  /** merge mode: allow multi-select with checkboxes */
  mergeMode?: boolean;
  mergeSelected?: Set<number>;
  onToggleMerge?: (prBasicSno: number) => void;
}

const PRListSidebar: React.FC<PRListSidebarProps> = ({
  prList, loading, selectedPR, onSelectPR,
  mergeMode = false, mergeSelected, onToggleMerge,
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
    <div className="w-80 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
      {/* Header stats */}
      <div className="px-4 py-3 border-b bg-gray-50 flex gap-3 text-xs font-medium">
        <span className="text-gray-500">{prList.length} PRs</span>
        <span className="text-green-600">
          {prList.filter(p => (p.status ?? '').toLowerCase().includes('approv')).length} approved
        </span>
        {mergeMode && mergeSelected && (
          <span className="text-indigo-600 ml-auto">{mergeSelected.size} selected</span>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search PR no, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* PR List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Loading PRs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <FileText size={24} />
            <span className="text-sm">No PRs found</span>
          </div>
        ) : (
          filtered.map((pr, idx) => {
            const isActive = selectedPR?.pr_basic_sno === pr.pr_basic_sno && selectedPR?.pr_no === pr.pr_no;
            const prKey = String(pr.pr_no ?? pr.pr_id ?? pr.pr_basic_sno ?? idx);
            const itemCount = getPRItemCount(pr);
            const isMergeChecked = mergeMode && mergeSelected?.has(pr.pr_basic_sno!);

            return (
              <button
                key={prKey}
                onClick={() => {
                  if (mergeMode && onToggleMerge && pr.pr_basic_sno) {
                    onToggleMerge(pr.pr_basic_sno);
                  } else {
                    onSelectPR(pr);
                  }
                }}
                className={`w-full text-left px-4 py-3 border-b hover:bg-indigo-50 transition-colors ${
                  isActive && !mergeMode ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                } ${isMergeChecked ? 'bg-indigo-50/60' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {mergeMode && (
                      <Checkbox
                        checked={isMergeChecked}
                        onCheckedChange={() => onToggleMerge?.(pr.pr_basic_sno!)}
                        className="pointer-events-none"
                      />
                    )}
                    <span className="text-sm font-semibold text-indigo-700 truncate">
                      {getPRDisplayNo(pr)}
                    </span>
                  </div>
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                    Approved
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 truncate">{pr.com_name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {pr.dept_name}
                  {(pr.reg_date || pr.request_date || pr.req_date)
                    ? ` \u2022 ${formatDate(pr.reg_date ?? pr.request_date ?? pr.req_date)}`
                    : ''}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{itemCount} items</span>
                  {!mergeMode && <ChevronRight size={14} className="text-gray-400" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PRListSidebar;
