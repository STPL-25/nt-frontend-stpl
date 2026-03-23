import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  setThemeColor,
  setThemeMode,
  setThemeRadius,
  selectThemeColor,
  selectThemeMode,
  selectThemeRadius,
  THEME_COLORS,
  type ThemeColor,
} from "@/globalState/features/themeSlice";
import type { AppDispatch } from "@/globalState/store";
import type { ThemeSettingsProps, RadiusOption, ModeOption } from "./ThemeSettings.types";

// ---------------------------------------------------------------------------
// Static option tables
// ---------------------------------------------------------------------------

const RADIUS_OPTIONS: RadiusOption[] = [
  { label: "None",   value: 0,     cls: "radius-none" },
  { label: "Small",  value: 0.25,  cls: "radius-sm"   },
  { label: "Medium", value: 0.5,   cls: "radius-md"   },
  { label: "Large",  value: 0.75,  cls: "radius-lg"   },
  { label: "Full",   value: 1.5,   cls: "radius-full" },
];

const MODE_OPTIONS: ModeOption[] = [
  { id: "light",  label: "Light",  icon: <Sun className="h-4 w-4" />     },
  { id: "dark",   label: "Dark",   icon: <Moon className="h-4 w-4" />    },
  { id: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers — apply classes to <html>
// ---------------------------------------------------------------------------

const applyColorClass = (color: ThemeColor) => {
  const root = document.documentElement;
  THEME_COLORS.forEach(({ id }) => root.classList.remove(`theme-${id}`));
  if (color !== "blue") root.classList.add(`theme-${color}`);
};

const applyRadiusClass = (radius: number) => {
  const root = document.documentElement;
  RADIUS_OPTIONS.forEach(({ cls }) => root.classList.remove(cls));
  const option = RADIUS_OPTIONS.find((r) => r.value === radius);
  if (option && option.cls !== "radius-md") root.classList.add(option.cls);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ open, onOpenChange }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { setTheme } = useTheme();

  const currentColor  = useSelector(selectThemeColor);
  const currentMode   = useSelector(selectThemeMode);
  const currentRadius = useSelector(selectThemeRadius);

  const handleColorChange = (color: ThemeColor) => {
    dispatch(setThemeColor(color));
    applyColorClass(color);
  };

  const handleModeChange = (mode: ModeOption["id"]) => {
    dispatch(setThemeMode(mode));
    setTheme(mode);
  };

  const handleRadiusChange = (radius: number) => {
    dispatch(setThemeRadius(radius));
    applyRadiusClass(radius);
  };

  const handleReset = () => {
    handleColorChange("blue");
    handleModeChange("system");
    handleRadiusChange(0.625);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] overflow-y-auto">

        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">Appearance Settings</SheetTitle>
          <SheetDescription>
            Customize the look and feel of your workspace.
          </SheetDescription>
        </SheetHeader>

        {/* ── Color theme ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Color Theme</h3>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {currentColor}
            </Badge>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {THEME_COLORS.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleColorChange(theme.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all duration-150 hover:scale-105 hover:shadow-md",
                  currentColor === theme.id
                    ? "border-foreground shadow-sm"
                    : "border-transparent hover:border-border"
                )}
                title={theme.label}
              >
                <span
                  className="h-8 w-8 rounded-lg shadow-inner flex items-center justify-center"
                  style={{ backgroundColor: theme.previewHex }}
                >
                  {currentColor === theme.id && (
                    <Check className="h-4 w-4 text-white drop-shadow" />
                  )}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground leading-none">
                  {theme.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <Separator className="my-5" />

        {/* ── Live preview card ────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Preview</h3>
          <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                style={{
                  backgroundColor: THEME_COLORS.find((t) => t.id === currentColor)?.previewHex,
                }}
              >
                NT
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">Non-Trade ERP</p>
                <p className="text-xs text-muted-foreground">Procurement System</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs h-7 px-3">Primary</Button>
              <Button size="sm" variant="outline" className="text-xs h-7 px-3">Secondary</Button>
              <Button size="sm" variant="ghost" className="text-xs h-7 px-3">Ghost</Button>
            </div>
            <div className="flex gap-1.5">
              {["bg-primary", "bg-secondary", "bg-muted", "bg-accent"].map((cls) => (
                <span key={cls} className={cn("h-4 flex-1 rounded-md", cls)} />
              ))}
            </div>
          </div>
        </section>

        <Separator className="my-5" />

        {/* ── Appearance mode ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Appearance Mode</h3>
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => handleModeChange(id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-150 hover:scale-105",
                  currentMode === id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent hover:border-border text-muted-foreground"
                )}
              >
                {icon}
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <Separator className="my-5" />

        {/* ── Border radius ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Border Radius</h3>
          <div className="grid grid-cols-5 gap-1.5">
            {RADIUS_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleRadiusChange(value)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-[10px] font-medium",
                  currentRadius === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent hover:border-border text-muted-foreground"
                )}
              >
                <span
                  className="h-5 w-5 border-2 border-current bg-muted/50"
                  style={{ borderRadius: value === 1.5 ? "9999px" : `${value * 8}px` }}
                />
                {label}
              </button>
            ))}
          </div>
        </section>

        <Separator className="my-5" />

        {/* ── Reset ─────────────────────────────────────────────────────── */}
        <Button variant="outline" className="w-full" onClick={handleReset}>
          Reset to Defaults
        </Button>

      </SheetContent>
    </Sheet>
  );
};

export default ThemeSettings;
