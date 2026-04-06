import React, { useState } from "react";
import {
  ChevronDown,
  Menu,
  X,
  Minimize2,
  Maximize2,
  Settings,
  User,
  Eye,
  EyeOff,
  Building2,
  Hash,
  Briefcase,
  Phone,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/globalState/hooks/useAppState";
import NotificationBell from "@/components/NotificationBell";
import ThemeSettings from "@/components/ThemeSettings";
import type { UserInfo, ProfileField } from "./Header.types";
import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL as string;

const Header: React.FC = () => {
  const {
    sidebarOpen,
    setSidebarOpen,
    headerComponentRender,
    isFullscreen,
    setIsFullscreen,
    userData,
    setUserData,
    setActiveItem,
    setActiveComponent,
    themeSettingsOpen,
    setThemeSettingsOpen,
    clearSidebarData,
    clearCompanyHierarchy,
  } = useAppState() as any;

  const navigate = useNavigate();

  const [showCugFull, setShowCugFull] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const userInfo: UserInfo = (userData?.[0] as UserInfo) ?? {};
  const displayName = (userInfo.ename as string) || "User";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const cugNumber = (userInfo.sign_up_cug as string) ?? "";
  const maskedCug = showCugFull
    ? cugNumber
    : cugNumber
    ? `******${cugNumber.slice(-4)}`
    : "N/A";

  const profileFields: ProfileField[] = [
    { label: "Employee Code", value: userInfo.ecno as string,   Icon: Hash,      color: "blue"   },
    { label: "Branch",        value: userInfo.branch as string, Icon: Building2, color: "purple" },
    { label: "Department",    value: userInfo.dept as string,   Icon: Briefcase, color: "green"  },
  ];

  const handleFullscreenToggle = async () => {
    try {
      const el  = document.documentElement as HTMLElement & Record<string, unknown>;
      const doc = document as Document & Record<string, unknown>;
      if (!isFullscreen) {
        if (typeof el.requestFullscreen === "function")            await el.requestFullscreen();
        else if (typeof el.webkitRequestFullscreen === "function") await (el.webkitRequestFullscreen as () => Promise<void>)();
        else if (typeof el.msRequestFullscreen === "function")     await (el.msRequestFullscreen as () => Promise<void>)();
      } else {
        if (typeof doc.exitFullscreen === "function")            await doc.exitFullscreen();
        else if (typeof doc.webkitExitFullscreen === "function") await (doc.webkitExitFullscreen as () => Promise<void>)();
        else if (typeof doc.msExitFullscreen === "function")     await (doc.msExitFullscreen as () => Promise<void>)();
      }
      setIsFullscreen?.(!isFullscreen);
    } catch {
      toast.error("Unable to toggle fullscreen");
    }
  };

  const handleSignOut = async () => {
    try {
      await axios.post(`${apiUrl}/api/secure/logout`).catch(() => {});
      clearSidebarData?.();
      clearCompanyHierarchy?.();
      setActiveItem?.("");
      setActiveComponent?.(null);
      setUserData?.(null);
      localStorage.removeItem("userToken");
      navigate("/");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <>
      {/* Primary-color accent line at top */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

      <header
        className={`sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl transition-all ${
          isFullscreen ? "shadow-lg" : "shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2 lg:px-6">

          {/* ── Left ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSidebarOpen?.(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>

            {/* Brand mark (desktop) */}
            <div className="hidden items-center gap-2 lg:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
                <span className="text-[10px] font-black text-primary-foreground">NT</span>
              </div>
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Non-Trade
              </span>
            </div>

            <div className="hidden h-5 w-px bg-border lg:block" />

            {/* Page title */}
            <div className="flex items-center gap-2">
              <div className="hidden h-1.5 w-1.5 rounded-full bg-primary lg:block" />
              <span className="text-sm font-semibold tracking-wide text-primary">
                {(headerComponentRender as string)?.toUpperCase?.() || "DASHBOARD"}
              </span>
            </div>
          </div>

          {/* ── Right ────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1">

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreenToggle}
              className="h-8 px-2.5 text-muted-foreground hover:text-primary"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="ml-1.5 hidden text-xs xl:inline">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </Button>

            <NotificationBell />

            {/* Appearance */}
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

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2 rounded-xl hover:bg-primary/10">
                  <div className="relative">
                    <Avatar className="h-7 w-7 ring-2 ring-primary/30">
                      <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online dot */}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  </div>
                  <div className="hidden flex-col items-start lg:flex">
                    <span className="text-xs font-semibold leading-tight">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{userInfo.ecno as string}</span>
                  </div>
                  <ChevronDown className="hidden h-3 w-3 text-muted-foreground lg:inline" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-md">
                {/* User header */}
                <div className="mb-1 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                      {avatarLetter}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{userInfo.ecno as string}</p>
                    <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[9px] bg-primary/10 text-primary border-primary/20">
                      Active
                    </Badge>
                  </div>
                </div>

                <DropdownMenuSeparator />

                {/* Profile */}
                <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem className="cursor-pointer gap-2" onSelect={(e) => e.preventDefault()}>
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>My Profile</span>
                    </DropdownMenuItem>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 ring-2 ring-primary/30">
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                            {avatarLetter}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-base font-semibold">{displayName}</p>
                          <p className="text-xs text-muted-foreground font-normal">Employee Profile</p>
                        </div>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2.5 py-3">
                      {profileFields.map(({ label, value, Icon, color }) => (
                        <div
                          key={label}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                        >
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-${color}-500/10`}>
                            <Icon className={`h-4 w-4 text-${color}-600`} />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold">{value || "N/A"}</p>
                          </div>
                        </div>
                      ))}

                      {/* CUG number */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-muted-foreground">CUG Number</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold font-mono">{maskedCug}</p>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowCugFull(!showCugFull)}>
                              {showCugFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Appearance */}
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setThemeSettingsOpen(true)}>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Appearance</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={handleSignOut}
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

export default Header;
