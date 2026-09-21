import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface SidebarDetailLayoutProps {
  sidebarTitle: string;
  sidebarCount: number;
  sidebarCountLabel?: string;
  /** Render prop: receives a closeSheet fn so list items can dismiss the mobile drawer on selection */
  listItems: (closeSheet: () => void) => React.ReactNode;
  detailContent: React.ReactNode;
  emptyContent?: React.ReactNode;
  hasSelection: boolean;
  mobileListLabel?: string;
  mobileSelectionTitle?: string;
  /** Optional toast shown above layout */
  toast?: { message: string; type: 'success' | 'error' } | null;
}

export default function SidebarDetailLayout({
  sidebarTitle,
  sidebarCount,
  sidebarCountLabel = 'request',
  listItems,
  detailContent,
  emptyContent,
  hasSelection,
  mobileListLabel = 'List',
  mobileSelectionTitle,
  toast,
}: SidebarDetailLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSheet = () => setMobileOpen(false);

  const sidebarHeader = (
    <div className="flex-shrink-0 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      {/* In the mobile drawer the Sheet supplies its own close button (top-right),
          so the title just leaves room for it. */}
      <div className="pr-8 lg:pr-0">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
          {sidebarTitle}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {sidebarCount} pending {sidebarCountLabel}
          {sidebarCount !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );

  const sidebarBody = (
    <div className="flex flex-col h-full">
      {sidebarHeader}
      <div className="flex-1 overflow-hidden">
        {/* Radix wraps ScrollArea content in a `display: table` div, which lets long
            unbroken text stretch the list wider than the sidebar instead of truncating. */}
        <ScrollArea className="h-full [&>[data-radix-scroll-area-viewport]>div]:block!">
          <div className="p-2 sm:p-3 space-y-2">
            {listItems(closeSheet)}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  return (
    <>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-col h-full">
          {sidebarBody}
        </div>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[85vw] sm:w-96 p-0 flex flex-col">
            {sidebarBody}
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <div className="lg:hidden flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Menu className="h-4 w-4" />
              {mobileListLabel}
            </Button>
            {mobileSelectionTitle && (
              <p className="font-semibold text-sm truncate flex-1">{mobileSelectionTitle}</p>
            )}
            <Badge variant="outline" className="text-xs shrink-0">
              {sidebarCount} pending
            </Badge>
          </div>

          <div className="flex-1 overflow-auto">
            {hasSelection ? detailContent : (emptyContent ?? null)}
          </div>
        </div>
      </div>
    </>
  );
}
