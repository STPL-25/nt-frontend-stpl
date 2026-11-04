import React from "react";
import stplimage from "@/assets/stpllogo.png";
import {
  BarChart3,
  Check,
  LockKeyhole,
  Palette,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  selectThemeColor,
  setThemeColor,
  THEME_COLORS,
  type ThemeColor,
} from "@/globalState/features/themeSlice";
import type { AppDispatch } from "@/globalState/store";

const FEATURES = [
  "Purchase Requisition Management",
  "Purchase Order Processing",
  "Budget Planning & Control",
  "KYC & Vendor Management",
];

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Wider card for multi-column forms (signup). */
  wide?: boolean;
  /** Brand panel copy - the staff console by default; the supplier portal passes its own. */
  brand?: { eyebrow?: string; heading?: React.ReactNode; copy?: string; features?: string[] };
}

const DEFAULT_BRAND = {
  eyebrow: "ERP Console",
  heading: <>Non-Trade<br />Procurement</>,
  copy: "Streamline your procurement workflow with real-time tracking, approvals, and budget control.",
  features: FEATURES,
};

const FEATURE_ICONS = [Workflow, BarChart3, ShieldCheck, Sparkles];
const DARK_INK_THEMES = new Set<ThemeColor>(["amber", "lemon"]);

const ThemeColorPicker: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentColor = useSelector(selectThemeColor);
  const activeTheme = THEME_COLORS.find((theme) => theme.id === currentColor) ?? THEME_COLORS[0];

  const handleColorChange = (color: ThemeColor) => {
    dispatch(setThemeColor(color));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          aria-label={`Change color theme. Current theme: ${activeTheme.label}`}
          className={cn(
            "border-slate-200/80 bg-white/75 shadow-sm backdrop-blur-xl hover:border-primary/30 hover:bg-white dark:border-white/10 dark:bg-slate-900/75 dark:hover:bg-slate-900",
            compact ? "h-9 w-9 rounded-xl" : "h-9 gap-2 rounded-xl px-3"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md shadow-sm",
              DARK_INK_THEMES.has(activeTheme.id) ? "text-slate-900" : "text-white"
            )}
            style={{ backgroundColor: activeTheme.lightPrimary }}
          >
            <Palette className="h-3 w-3" />
          </span>
          {!compact && (
            <>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Theme</span>
              <span className="text-xs font-semibold text-foreground">{activeTheme.label}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[292px] rounded-2xl border-slate-200/80 bg-white/95 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-xs font-semibold text-foreground">Choose a color</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Saved across sign in and your workspace</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">
            {THEME_COLORS.length}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {THEME_COLORS.map((theme) => {
            const isActive = currentColor === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                title={theme.label}
                aria-label={`${theme.label} color theme`}
                aria-pressed={isActive}
                onClick={() => handleColorChange(theme.id)}
                className={cn(
                  "group relative flex aspect-square items-center justify-center rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "border-foreground/60 bg-muted shadow-sm"
                    : "border-transparent bg-muted/40 hover:border-border"
                )}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5"
                  style={{ background: `linear-gradient(145deg, color-mix(in oklab, ${theme.lightPrimary} 28%, white), ${theme.lightPrimary})` }}
                >
                  {isActive && <Check className={cn("h-3.5 w-3.5 drop-shadow", DARK_INK_THEMES.has(theme.id) ? "text-slate-900" : "text-white")} />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 truncate rounded-lg bg-muted/50 px-2.5 py-2 text-center text-[10px] font-medium text-muted-foreground">
          Selected: <span className="font-semibold text-foreground">{activeTheme.label}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
};

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, brand, wide }) => {
  const b = { ...DEFAULT_BRAND, ...brand };

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:w-[46%] lg:flex-col lg:justify-between xl:w-[48%]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-primary/[0.07]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_42%),radial-gradient(circle_at_86%_86%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_50%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in oklab, var(--primary) 22%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--primary) 22%, transparent) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative z-10 flex items-center gap-3 px-10 pt-8 xl:px-14 xl:pt-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200">
            <img src={stplimage} alt="Space Textiles" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
              {b.eyebrow}
            </p>
            <h2 className="mt-0.5 text-base font-semibold leading-tight text-foreground">
              Space Textiles Pvt Ltd
            </h2>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-12 xl:px-14 2xl:px-20">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-card/75 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Unified procurement workspace
          </div>

          <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-foreground xl:text-5xl 2xl:text-6xl">
            {b.heading}
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground xl:text-base xl:leading-7">
            {b.copy}
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-2 gap-3">
            {b.features.map((feature, index) => {
              const FeatureIcon = FEATURE_ICONS[index % FEATURE_ICONS.length];
              return (
                <div
                  key={feature}
                  className="group flex min-h-24 flex-col justify-between rounded-2xl border border-primary/15 bg-card/75 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <FeatureIcon className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-xs font-medium leading-5 text-foreground xl:text-sm">
                    {feature}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-6 border-t border-primary/10 px-10 py-6 text-[11px] text-muted-foreground xl:px-14">
          <p>© {new Date().getFullYear()} Space Textiles Pvt Ltd</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Secure enterprise access
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-1 flex-col overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full bg-primary/[0.08] blur-3xl" />
          <div className="absolute -bottom-44 -left-32 h-96 w-96 rounded-full bg-primary/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.025] dark:opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        <header className="relative z-20 flex items-center justify-between border-b border-primary/10 bg-white/70 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10">
              <img src={stplimage} alt="Space Textiles" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-primary">
                Non-Trade ERP
              </p>
              <p className="text-sm font-semibold leading-tight">Space Textiles</p>
            </div>
          </div>
          <ThemeColorPicker compact />
        </header>

        <div className="absolute right-6 top-6 z-30 hidden lg:block">
          <ThemeColorPicker />
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12 xl:px-16">
          <div className={cn("w-full", wide ? "max-w-[560px]" : "max-w-[480px]")}>
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <LockKeyhole className="h-3.5 w-3.5" />
              </span>
              Secure workspace
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.35)] ring-1 ring-primary/10 backdrop-blur-2xl sm:p-8 dark:border-white/10 dark:bg-slate-900/85">
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
              <div className="mb-7">
                <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl dark:text-white">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
              {children}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-slate-400 dark:text-slate-500">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Protected with secure, encrypted authentication
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthLayout;
