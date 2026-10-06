import React from 'react';
import { Button } from '@/components/ui/button';
import { FileClock, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Panel, SelectableCard } from '@/CustomComponent/ServiceComponents/ServiceParts';
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
      <div className="flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading drafts…
      </div>
    );
  }
  if (drafts.length === 0) return null;

  return (
    <Panel icon={FileClock} title="My drafts" description={`${drafts.length} saved — resume anytime`} bodyClassName="space-y-2 p-3 sm:p-3">
      {drafts.map((d) => (
        <div key={d.draftId} className="relative">
          <SelectableCard selected={activeDraftId === d.draftId} onClick={() => onResume(d)}>
            <span className="block min-w-0 pr-8">
              <span className="block truncate text-sm font-semibold">{(d as any).po_no ?? (d as any).gate_entry_no ?? 'Draft'}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(d.updatedAt)}</span>
            </span>
          </SelectableCard>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Delete draft"
            className={cn('absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2')}
            onClick={() => onDelete(d.draftId)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
    </Panel>
  );
};

export default GRNDraftList;
