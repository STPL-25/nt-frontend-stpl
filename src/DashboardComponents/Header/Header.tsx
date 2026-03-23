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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  } = useAppState() as any;

  const navigate = useNavigate();

  const [showCugFull, setShowCugFull] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

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
    { label: "Employee Code", value: userInfo.ecno as string, Icon: Hash,      color: "blue"   },
    { label: "Branch",        value: userInfo.branch as string, Icon: Building2, color: "purple" },
    { label: "Department",    value: userInfo.dept as string,   Icon: Briefcase, color: "green"  },
  ];

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl transition-all ${
          isFullscreen ? "shadow-lg" : "shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">

          {/* ── Left: mobile toggle + page title ─────────────────────── */}
          <div className="flex items-center gap-3">
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

            <div className="flex items-center gap-3">
              <div className="hidden h-7 w-1 rounded-full bg-gradient-to-b from-primary/90 to-primary/30 lg:block" />
              <h1 className="text-sm font-semibold tracking-wide bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {(headerComponentRender as string)?.toUpperCase?.() || "DASHBOARD"}
              </h1>
              <div className="hidden h-7 w-1 rounded-full bg-gradient-to-b from-primary/90 to-primary/30 lg:block" />
            </div>
          </div>

          {/* ── Center (reserved for search / breadcrumb) ─────────────── */}
          <div className="hidden flex-1 items-center justify-center md:flex" />

          {/* ── Right: action bar ─────────────────────────────────────── */}
          <div className="flex items-center gap-1">

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreenToggle}
              className="h-9 px-3"
            >
              {isFullscreen
                ? <Minimize2 className="h-4 w-4" />
                : <Maximize2 className="h-4 w-4" />}
              <span className="ml-2 hidden text-xs font-medium xl:inline">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </Button>

            {/* Real-time notification bell */}
            <NotificationBell />

            {/* Appearance settings */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setThemeSettingsOpen(true)}
              title="Appearance settings"
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Profile dropdown */}
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
                  <p className="text-xs text-muted-foreground font-normal">{userInfo.ecno as string}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Profile dialog */}
                <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => e.preventDefault()}
                    >
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
                          <p className="text-xs text-muted-foreground font-normal">
                            Employee Profile
                          </p>
                        </div>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                      {/* Dynamic profile fields */}
                      {profileFields.map(({ label, value, Icon, color }) => (
                        <div
                          key={label}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                        >
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full bg-${color}-500/10`}
                          >
                            <Icon className={`h-4 w-4 text-${color}-600`} />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold">{value || "N/A"}</p>
                          </div>
                        </div>
                      ))}

                      {/* CUG number with reveal toggle */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10">
                          <Phone className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-muted-foreground">CUG Number</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold font-mono">{maskedCug}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setShowCugFull(!showCugFull)}
                            >
                              {showCugFull
                                ? <EyeOff className="h-3.5 w-3.5" />
                                : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Appearance shortcut */}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setThemeSettingsOpen(true)}
                >
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

      {/* Theme settings side-panel */}
      <ThemeSettings open={themeSettingsOpen} onOpenChange={setThemeSettingsOpen} />
    </>
  );
};

export default Header;
