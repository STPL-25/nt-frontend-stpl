import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileClock, Trash2, Loader2 } from 'lucide-react';
import type { GRNDraft } from '@/Services/GrnService/grnApi';
import { formatDate } from './helpers';

interface GRNDraftListProps {
  drafts: GRNDraft[];
  loading: boolean;
  activeDraftId: string | null;
  onResume: (draft: GRNDraft) => void;
  onDelete: (draftId: string) => void;
}

const GRNDraftList: React.FC<GRNDraftListProps> = ({ drafts, loading, activeDraftId, onResume, onDelete }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground/70 border-b">
        <Loader2 size={13} className="animate-spin" /> Loading drafts...
      </div>
    );
  }
  if (drafts.length === 0) return null;

  return (
    <div className="border-b bg-amber-50/60 dark:bg-amber-950/10">
      <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400">
        <FileClock size={13} /> My Drafts
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{drafts.length}</Badge>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {drafts.map((d) => (
          <div
            key={d.draftId}
            className={`flex items-center justify-between gap-2 px-4 py-1.5 text-xs cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/20 ${
              activeDraftId === d.draftId ? 'bg-amber-100 dark:bg-amber-900/30' : ''
            }`}
            onClick={() => onResume(d)}
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">
                {(d as any).po_no ?? (d as any).gate_entry_no ?? 'Draft'}
              </p>
              <p className="text-muted-foreground/70">{formatDate(d.updatedAt)}</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); onDelete(d.draftId); }}
            >
              <Trash2 size={12} className="text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GRNDraftList;
