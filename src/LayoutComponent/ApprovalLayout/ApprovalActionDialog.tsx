import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TONE, type Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';

const CONFIRM_CLASS: Partial<Record<Tone, string>> = {
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  info: 'bg-sky-600 text-white hover:bg-sky-700',
};

/**
 * Decision dialog in the KYC approval style (tinted icon header, summary box, comments, tone-coloured
 * confirm button) for screens with more actions than approve / reject — forward, send back, edit …
 */
export default function ApprovalActionDialog({
  open, onOpenChange, wide, tone, icon: Icon, title, description, summary, children,
  commentsLabel = 'Comments', commentsRequired, commentsPlaceholder, comments, setComments,
  blockedReason, loading, disabled, onSubmit, confirmLabel, confirmIcon: ConfirmIcon,
}: {
  open: boolean; onOpenChange: (open: boolean) => void;
  wide?: boolean;
  tone: Tone; icon: LucideIcon; title: string; description: string;
  summary?: { label: string; value: ReactNode }[];
  /** Action-specific controls, shown between the summary and the comments box. */
  children?: ReactNode;
  commentsLabel?: string; commentsRequired?: boolean; commentsPlaceholder?: string;
  comments: string; setComments: (c: string) => void;
  /** Why confirm is disabled right now — shown above the footer. */
  blockedReason?: string | null;
  loading: boolean; disabled?: boolean;
  onSubmit: () => void; confirmLabel: string; confirmIcon: LucideIcon;
}) {
  const destructive = tone === 'danger';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90vh] gap-5 overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border', TONE[tone])}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1 pr-6">
            <DialogTitle className="text-base leading-tight sm:text-lg">{title}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{description}</DialogDescription>
          </div>
        </DialogHeader>

        {summary && summary.length > 0 && (
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            {summary.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="break-words text-right font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}

        <div className="space-y-1.5">
          <Label htmlFor="decision-comments" className="text-xs sm:text-sm">
            {commentsLabel} {commentsRequired && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="decision-comments"
            placeholder={commentsPlaceholder ?? 'Any additional notes…'}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        {blockedReason && <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="submit-blocked-reason">{blockedReason}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="sm:min-w-24">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={loading || disabled}
            variant={destructive ? 'destructive' : 'default'}
            className={cn('sm:min-w-40', CONFIRM_CLASS[tone])}
          >
            {loading ? <><Clock className="h-4 w-4 animate-spin" />Processing…</> : <><ConfirmIcon className="h-4 w-4" />{confirmLabel}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
