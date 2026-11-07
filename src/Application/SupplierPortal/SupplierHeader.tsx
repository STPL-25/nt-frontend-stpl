import React, { useState } from 'react';
import { Menu, X, Settings, LogOut, ChevronDown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ThemeSettings from '@/components/ThemeSettings';
import type { SupplierProfile } from '@/Services/SupplierService';
import SupplierNotificationBell from './SupplierNotificationBell';
import type { SupplierNotificationTarget } from './supplierNotificationModel';

interface Props {
  supplier: SupplierProfile;
  title: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  /** Take the supplier to the screen a notification is about. */
  onOpenNotification: (target: SupplierNotificationTarget) => void;
}

const SupplierHeader: React.FC<Props> = ({ supplier, title, sidebarOpen, setSidebarOpen, onLogout, onOpenNotification }) => {
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);

  const displayName = supplier.company_name ?? supplier.email;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent print:hidden" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 shadow-sm backdrop-blur-2xl print:hidden">
        <div className="flex min-h-14 items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex min-w-0 items-center">
              <span className="truncate text-sm font-semibold tracking-wide text-primary">{title.toUpperCase()}</span>
            </div>
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-1">
            <SupplierNotificationBell onOpen={onOpenNotification} />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setThemeSettingsOpen(true)}
              title="Appearance settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-xl border border-transparent px-1.5 hover:border-primary/10 hover:bg-primary/10 sm:px-2">
                  <div className="relative">
                    <Avatar className="h-7 w-7 ring-2 ring-primary/30">
                      <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  </div>
                  <div className="hidden flex-col items-start lg:flex">
                    <span className="text-xs font-semibold leading-tight">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{supplier.supp_code}</span>
                  </div>
                  <ChevronDown className="hidden h-3 w-3 text-muted-foreground lg:inline" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-md">
                <div className="mb-1 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                      {avatarLetter}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{supplier.supp_code}</p>
                    <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[9px] bg-primary/10 text-primary border-primary/20">
                      <User className="mr-1 h-2.5 w-2.5" /> Supplier
                    </Badge>
                  </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setThemeSettingsOpen(true)}>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Appearance</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={onLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ThemeSettings open={themeSettingsOpen} onOpenChange={setThemeSettingsOpen} />
    </>
  );
};

export default SupplierHeader;
