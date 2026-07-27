import React from 'react';
import { Package, ChevronsLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SupplierProfile } from '@/Services/SupplierService';

interface Props {
  supplier: SupplierProfile;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onGoHome: () => void;
  isHome: boolean;
}

const SIDEBAR_WIDTH = 260;

const SupplierSidebar: React.FC<Props> = ({
  supplier,
  isCollapsed,
  toggleCollapse,
  sidebarOpen,
  setSidebarOpen,
  onGoHome,
  isHome,
}) => {
  return (
    <TooltipProvider>
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background/95 backdrop-blur-xl shadow-lg transition-transform duration-300 lg:translate-x-0 print:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: isCollapsed ? '80px' : `${SIDEBAR_WIDTH}px`, maxWidth: '85vw' }}
      >
        {/* Brand / collapse row */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-muted/40 to-transparent">
          <div className="flex items-center gap-3">
            {!isCollapsed && (
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 rounded-lg ring-2 ring-primary/30">
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-extrabold">
                    SP
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground leading-tight">Supplier Portal</span>
                  <span className="text-[10px] text-muted-foreground font-medium leading-tight uppercase tracking-wider">
                    {supplier.supp_code ?? 'Vendor Console'}
                  </span>
                </div>
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCollapse}
                  className="hidden lg:inline-flex h-8 w-8 rounded-lg hover:bg-muted transition-all duration-200"
                >
                  <ChevronsLeft
                    className={`h-5 w-5 transition-transform duration-300 text-muted-foreground ${isCollapsed ? 'rotate-180' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoHome}
                  className={`group flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                    ${isHome ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                      ${isHome ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-border/60 bg-background'}`}
                  >
                    <Package className={`h-4 w-4 ${isHome ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  </div>
                  {!isCollapsed && <span className="ml-3 truncate text-sm font-medium">Purchase Orders</span>}
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Purchase Orders</TooltipContent>}
            </Tooltip>
          </nav>
        </div>

        {!isCollapsed && (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="truncate text-xs font-semibold text-foreground">{supplier.company_name ?? 'Supplier'}</p>
            <p className="truncate text-[10px] text-muted-foreground">{supplier.email}</p>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </TooltipProvider>
  );
};

export default SupplierSidebar;
export { SIDEBAR_WIDTH };
