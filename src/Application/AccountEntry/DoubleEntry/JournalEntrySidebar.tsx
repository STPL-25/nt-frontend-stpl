import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, BookOpen, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JournalEntry } from './types';
import { formatDate, formatINR } from './helpers';
import { StatusBadge } from '@/utils/statusUtils';

interface JournalEntrySidebarProps {
  entries: JournalEntry[];
  loading: boolean;
  selectedEntry: JournalEntry | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry?: () => void;
}

const voucherColor: Record<string, string> = {
  Journal:  'bg-primary/15 text-primary border-primary/20',
  Payment:  'bg-red-100 text-red-700 border-red-200',
  Receipt:  'bg-green-100 text-green-700 border-green-200',
  Contra:   'bg-purple-100 text-purple-700 border-purple-200',
  Sales:    'bg-amber-100 text-amber-700 border-amber-200',
  Purchase: 'bg-orange-100 text-orange-700 border-orange-200',
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
    <div className="w-full h-full bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Entries ({entries.length})
        </span>
        {onNewEntry && (
          <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90" onClick={onNewEntry}>
            <Plus size={13} className="mr-1" /> New Entry
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b bg-muted/40 flex gap-3 text-xs font-medium">
        {draftCount > 0  && <span className="text-amber-600">{draftCount} draft{draftCount > 1 ? 's' : ''}</span>}
        {postedCount > 0 && <span className="text-green-600">{postedCount} posted</span>}
        {entries.length === 0 && <span className="text-muted-foreground/70">No entries yet</span>}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
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
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Loading entries...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/70">
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
                className={`w-full text-left px-4 py-3 border-b hover:bg-primary/10 transition-colors border-l-4 ${
                  isActive ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-mono font-semibold text-primary">{entry.entry_no}</span>
                  <StatusBadge status={entry.status} className="py-0" />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className={`text-xs py-0 ${voucherColor[entry.voucher_type] ?? 'bg-muted text-muted-foreground'}`}>
                    {entry.voucher_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground/70">{formatDate(entry.entry_date)}</span>
                </div>
                <div className="text-xs text-foreground truncate">{entry.narration}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground/70">{entry.lines.length} lines</span>
                  <span className="text-xs font-semibold text-foreground">
                    {formatINR(entry.total_debit)}
                    <ChevronRight size={11} className="inline ml-0.5 text-muted-foreground/70" />
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
