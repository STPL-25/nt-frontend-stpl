import React from 'react';
import { Package, ChevronsLeft, X, ReceiptText, Banknote, ClipboardList, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/BrandLogo';
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
  onGoDebitNotes: () => void;
  isDebitNotes: boolean;
  onGoPayments: () => void;
  isPayments: boolean;
  onGoRfqs: () => void;
  isRfqs: boolean;
  onGoKyc: () => void;
  isKyc: boolean;
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
  onGoDebitNotes,
  isDebitNotes,
  onGoPayments,
  isPayments,
  onGoRfqs,
  isRfqs,
  onGoKyc,
  isKyc,
}) => {
  return (
    <TooltipProvider>
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground shadow-[18px_0_55px_-38px_rgba(15,23,42,0.55)] backdrop-blur-2xl transition-[transform,width] duration-300 lg:translate-x-0 print:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: isCollapsed ? '80px' : `${SIDEBAR_WIDTH}px`, maxWidth: '85vw' }}
      >
        {/* Brand / collapse row */}
        <div className={`relative flex min-h-[66px] items-center justify-between border-b border-sidebar-border/70 bg-gradient-to-r from-primary/[0.08] to-transparent py-3 ${isCollapsed ? 'px-2' : 'px-3.5'}`}>
          <div className="flex min-w-0 items-center">
            <div className={isCollapsed ? 'p-1' : 'min-w-0'}>
              <BrandLogo
                compact={isCollapsed}
                className={isCollapsed ? 'h-7' : 'h-7 max-w-[178px] xl:max-w-[194px]'}
                priority
              />
            </div>

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
        <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <nav className="space-y-1">
            {!isCollapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                Supplier Portal
              </p>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoHome}
                  className={`group relative flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                    ${isHome ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                      ${isHome ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-sidebar-border/70 bg-background/70'}`}
                  >
                    <Package className={`h-4 w-4 ${isHome ? 'text-primary-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'}`} />
                  </div>
                  {!isCollapsed && <span className="ml-3 truncate text-sm font-medium">Purchase Orders</span>}
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Purchase Orders</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoRfqs}
                  className={`group relative flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                    ${isRfqs ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                      ${isRfqs ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-sidebar-border/70 bg-background/70'}`}
                  >
                    <ClipboardList className={`h-4 w-4 ${isRfqs ? 'text-primary-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'}`} />
                  </div>
                  {!isCollapsed && <span className="ml-3 truncate text-sm font-medium">Quotation Requests</span>}
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Quotation Requests</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoDebitNotes}
                  className={`group relative flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                    ${isDebitNotes ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                      ${isDebitNotes ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-sidebar-border/70 bg-background/70'}`}
                  >
                    <ReceiptText className={`h-4 w-4 ${isDebitNotes ? 'text-primary-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'}`} />
                  </div>
                  {!isCollapsed && <span className="ml-3 truncate text-sm font-medium">Debit / Credit Notes</span>}
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Debit / Credit Notes</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoPayments}
                  className={`group relative flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                    ${isPayments ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                      ${isPayments ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-sidebar-border/70 bg-background/70'}`}
                  >
                    <Banknote className={`h-4 w-4 ${isPayments ? 'text-primary-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'}`} />
                  </div>
                  {!isCollapsed && <span className="ml-3 truncate text-sm font-medium">Payments</span>}
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Payments</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoKyc}
                  className={`group relative flex w-full items-center rounded-xl px-2 py-2 text-sm transition-all duration-200
                    ${isKyc ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200
                      ${isKyc ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-sidebar-border/70 bg-background/70'}`}
                  >
                    <ShieldCheck className={`h-4 w-4 ${isKyc ? 'text-primary-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground'}`} />
                  </div>
                  {!isCollapsed && <span className="ml-3 truncate text-sm font-medium">My KYC</span>}
                </button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">My KYC</TooltipContent>}
            </Tooltip>
          </nav>
        </div>

        {!isCollapsed && (
          <div className="border-t border-sidebar-border/70 bg-primary/[0.03] px-4 py-3">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{supplier.company_name ?? 'Supplier'}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/55">
              {supplier.supp_code ? `${supplier.supp_code} · ` : ''}{supplier.email}
            </p>
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
