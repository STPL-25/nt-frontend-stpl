import React, { useState } from "react";
import {
  ChevronDown, Menu, X, Minimize2, Maximize2,
  Settings, User, Eye, EyeOff, Building2, Hash, Briefcase, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppState } from "@/globalState/hooks/useAppState";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";
import ThemeSettings from "@/components/ThemeSettings";

const Header: React.FC = () => {
  const {
    sidebarOpen, setSidebarOpen,
    headerComponentRender,
    isFullscreen, setIsFullscreen,
    userData, setUserData,
    setActiveItem, setActiveComponent,
  } = useAppState() as any;

  const navigate = useNavigate();
  const [showCugFull,       setShowCugFull]       = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [settingsOpen,      setSettingsOpen]      = useState(false);

  /* ── Fullscreen ────────────────────────────────────────────────── */
  const handleFullscreenToggle = async () => {
    try {
      const el  = document.documentElement as any;
      const doc = document as any;
      if (!isFullscreen) {
        if (el.requestFullscreen)            await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen)     await el.msRequestFullscreen();
      } else {
        if (doc.exitFullscreen)            await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen)     await doc.msExitFullscreen();
      }
      setIsFullscreen?.(!isFullscreen);
    } catch (err) {
      toast.error("Unable to toggle fullscreen");
    }
  };

  /* ── Sign-out ──────────────────────────────────────────────────── */
  const handleSignOut = async () => {
    try {
      setUserData?.(null);
      setActiveItem?.("");
      setActiveComponent?.(null);
      localStorage.removeItem("userToken");
      navigate("/");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const displayName = (userData?.[0]?.ename as string) ?? "User";
  const avatarLetter = displayName.charAt(0) ?? "U";
  const userInfo    = userData?.[0] ?? {};
  const cugNumber   = userInfo.sign_up_cug ?? "";
  const maskedCug   = showCugFull ? cugNumber : (cugNumber ? `******${cugNumber.slice(-4)}` : "N/A");

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl transition-all ${
          isFullscreen ? "shadow-lg" : "shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">

          {/* ── Left: mobile toggle + page title ─────────────────── */}
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9"
                onClick={() => setSidebarOpen?.(!sidebarOpen)}>
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden h-7 w-1 rounded-full bg-gradient-to-b from-primary/90 to-primary/30 lg:block" />
              <h1 className="text-sm font-semibold tracking-wide bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {(headerComponentRender as string)?.toUpperCase?.() || "DASHBOARD"}
              </h1>
              <div className="hidden h-7 w-1 rounded-full bg-gradient-to-b from-primary/90 to-primary/30 lg:block" />
            </div>
          </div>

          {/* ── Center (reserved) ─────────────────────────────────── */}
          <div className="hidden flex-1 items-center justify-center md:flex" />

          {/* ── Right: actions ────────────────────────────────────── */}
          <div className="flex items-center gap-1">

            {/* Fullscreen */}
            <Button variant="ghost" size="sm" onClick={handleFullscreenToggle} className="h-9 px-3">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="ml-2 hidden text-xs font-medium xl:inline">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </Button>

            {/* Notifications (Socket.IO + Redis) */}
            <NotificationBell />

            {/* Theme Settings */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSettingsOpen(true)}
              title="Appearance settings"
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 ring-2 ring-primary/30">
                      <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/40 text-xs text-primary-foreground">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium lg:inline">{displayName}</span>
                    <ChevronDown className="hidden h-3 w-3 text-muted-foreground lg:inline" />
                  </div>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-md">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground font-normal">{userInfo.ecno}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Profile Dialog */}
                <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 ring-2 ring-primary/30">
                          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/40 text-primary-foreground text-lg">
                            {avatarLetter}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-base font-semibold">{displayName}</p>
                          <p className="text-xs text-muted-foreground font-normal">Employee Profile</p>
                        </div>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                      {[
                        { label: "Employee Code", value: userInfo.ecno,   Icon: Hash,      color: "blue" },
                        { label: "Branch",         value: userInfo.branch, Icon: Building2, color: "purple" },
                        { label: "Department",     value: userInfo.dept,   Icon: Briefcase, color: "green" },
                      ].map(({ label, value, Icon, color }) => (
                        <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-${color}-500/10`}>
                            <Icon className={`h-4 w-4 text-${color}-600`} />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold">{value || "N/A"}</p>
                          </div>
                        </div>
                      ))}

                      {/* CUG with toggle */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10">
                          <Phone className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-muted-foreground">CUG Number</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold font-mono">{maskedCug}</p>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={() => setShowCugFull(!showCugFull)}>
                              {showCugFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Close</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Settings entry */}
                <DropdownMenuItem className="cursor-pointer" onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Appearance</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Theme settings panel (Sheet) */}
      <ThemeSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};

export default Header;
