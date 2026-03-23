import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check, Palette, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  { label: "None",  value: 0,     cls: "radius-none" },
  { label: "S",     value: 0.25,  cls: "radius-sm"   },
  { label: "M",     value: 0.5,   cls: "radius-md"   },
  { label: "L",     value: 0.75,  cls: "radius-lg"   },
  { label: "Full",  value: 1.5,   cls: "radius-full" },
];

const MODE_OPTIONS: ModeOption[] = [
  { id: "light",  label: "Light",  icon: <Sun className="h-3.5 w-3.5" />     },
  { id: "dark",   label: "Dark",   icon: <Moon className="h-3.5 w-3.5" />    },
  { id: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
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
// Small reusable label
// ---------------------------------------------------------------------------

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
    {children}
  </p>
);

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
    handleModeChange("light");
    handleRadiusChange(0.625);
  };

  const activeHex = THEME_COLORS.find((t) => t.id === currentColor)?.previewHex ?? "#3b82f6";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[320px] flex-col overflow-y-auto p-0 sm:w-[360px]"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <SheetHeader className="border-b px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm transition-colors duration-300"
              style={{ backgroundColor: activeHex + "22", color: activeHex }}
            >
              <Palette className="h-4 w-4" />
            </span>
            <div>
              <SheetTitle className="text-sm font-semibold tracking-tight">
                Appearance
              </SheetTitle>
              <SheetDescription className="text-[11px]">
                Personalize your workspace
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-6 px-6 py-5">

          {/* ── Color theme ───────────────────────────────────────────── */}
          <section>
            <SectionLabel>Color</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {THEME_COLORS.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleColorChange(theme.id)}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    currentColor === theme.id
                      ? "border-foreground/70 shadow-md"
                      : "border-border/40 hover:border-border hover:shadow-sm"
                  )}
                  title={theme.label}
                >
                  {/* Color band */}
                  <span
                    className="flex h-12 w-full items-center justify-center"
                    style={{
                      background: `linear-gradient(145deg, ${theme.previewHex}bb 0%, ${theme.previewHex} 60%, ${theme.previewHex}dd 100%)`,
                    }}
                  >
                    {currentColor === theme.id && (
                      <Check className="h-[15px] w-[15px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" />
                    )}
                  </span>
                  {/* Label */}
                  <span
                    className={cn(
                      "py-1.5 text-center text-[10px] font-medium leading-none transition-colors duration-150",
                      currentColor === theme.id
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground/80"
                    )}
                  >
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Preview card ──────────────────────────────────────────── */}
          <section>
            <SectionLabel>Preview</SectionLabel>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              {/* Accent bar */}
              <div
                className="h-[3px] w-full transition-colors duration-300"
                style={{
                  background: `linear-gradient(90deg, ${activeHex}, ${activeHex}55)`,
                }}
              />
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm transition-colors duration-300"
                    style={{ backgroundColor: activeHex }}
                  >
                    NT
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight text-card-foreground">
                      Non-Trade ERP
                    </p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Procurement System
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 flex-1 text-[11px]">Primary</Button>
                  <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]">Outline</Button>
                  <Button size="sm" variant="ghost" className="h-7 flex-1 text-[11px]">Ghost</Button>
                </div>
                <div className="flex gap-1.5">
                  {["bg-primary", "bg-secondary", "bg-muted", "bg-accent"].map((cls) => (
                    <span key={cls} className={cn("h-2.5 flex-1 rounded-full", cls)} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Appearance mode ───────────────────────────────────────── */}
          <section>
            <SectionLabel>Mode</SectionLabel>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {MODE_OPTIONS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => handleModeChange(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all duration-150 focus-visible:outline-none",
                    currentMode === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground/80"
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Border radius ─────────────────────────────────────────── */}
          <section>
            <SectionLabel>Radius</SectionLabel>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {RADIUS_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleRadiusChange(value)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 transition-all duration-150 focus-visible:outline-none",
                    currentRadius === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground/80"
                  )}
                  title={label}
                >
                  <span
                    className="h-4 w-4 border-2 border-current"
                    style={{
                      borderRadius: value === 1.5 ? "9999px" : `${value * 10}px`,
                    }}
                  />
                  <span className="text-[9px] font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="border-t px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  );
};

export default ThemeSettings;
