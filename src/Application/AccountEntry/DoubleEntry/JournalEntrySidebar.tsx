import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, BookOpen, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JournalEntry } from './types';
import { formatDate, formatINR } from './helpers';

interface JournalEntrySidebarProps {
  entries: JournalEntry[];
  loading: boolean;
  selectedEntry: JournalEntry | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

const voucherColor: Record<string, string> = {
  Journal:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  Payment:  'bg-red-100 text-red-700 border-red-200',
  Receipt:  'bg-green-100 text-green-700 border-green-200',
  Contra:   'bg-purple-100 text-purple-700 border-purple-200',
  Sales:    'bg-amber-100 text-amber-700 border-amber-200',
  Purchase: 'bg-orange-100 text-orange-700 border-orange-200',
};

const statusBadge: Record<string, string> = {
  Draft:    'bg-gray-100 text-gray-600 border-gray-200',
  Posted:   'bg-green-100 text-green-700 border-green-200',
  Reversed: 'bg-red-100 text-red-600 border-red-200',
};

const JournalEntrySidebar: React.FC<JournalEntrySidebarProps> = ({
  entries, loading, selectedEntry, onSelectEntry, onNewEntry,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  const voucherTypes = useMemo(() => {
    const types = Array.from(new Set(entries.map(e => e.voucher_type)));
    return ['All', ...types];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      const matchSearch = !q ||
        e.entry_no.toLowerCase().includes(q) ||
        (e.reference_no ?? '').toLowerCase().includes(q) ||
        e.narration.toLowerCase().includes(q);
      const matchType = filterType === 'All' || e.voucher_type === filterType;
      return matchSearch && matchType;
    });
  }, [entries, search, filterType]);

  const draftCount  = entries.filter(e => e.status === 'Draft').length;
  const postedCount = entries.filter(e => e.status === 'Posted').length;

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Entries ({entries.length})
        </span>
        <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={onNewEntry}>
          <Plus size={13} className="mr-1" /> New Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b bg-gray-50 flex gap-3 text-xs font-medium">
        {draftCount > 0  && <span className="text-amber-600">{draftCount} draft{draftCount > 1 ? 's' : ''}</span>}
        {postedCount > 0 && <span className="text-green-600">{postedCount} posted</span>}
        {entries.length === 0 && <span className="text-gray-400">No entries yet</span>}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search entry no, narration..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Type Filter */}
      <div className="px-3 py-2 border-b flex gap-1.5 flex-wrap">
        {voucherTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              filterType === type
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Loading entries...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <BookOpen size={22} />
            <span className="text-sm">No entries found</span>
          </div>
        ) : (
          filtered.map(entry => {
            const isActive = selectedEntry?.entry_sno === entry.entry_sno;
            return (
              <button
                key={entry.entry_sno ?? entry.entry_no}
                onClick={() => onSelectEntry(entry)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-indigo-50 transition-colors border-l-4 ${
                  isActive ? 'bg-indigo-50 border-l-indigo-600' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-mono font-semibold text-indigo-700">{entry.entry_no}</span>
                  <Badge className={`text-xs py-0 ${statusBadge[entry.status]}`}>{entry.status}</Badge>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className={`text-xs py-0 ${voucherColor[entry.voucher_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {entry.voucher_type}
                  </Badge>
                  <span className="text-xs text-gray-400">{formatDate(entry.entry_date)}</span>
                </div>
                <div className="text-xs text-gray-700 truncate">{entry.narration}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{entry.lines.length} lines</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {formatINR(entry.total_debit)}
                    <ChevronRight size={11} className="inline ml-0.5 text-gray-400" />
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

export default JournalEntrySidebar;
