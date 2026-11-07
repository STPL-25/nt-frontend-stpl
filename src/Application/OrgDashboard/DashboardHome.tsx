import { useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Segmented } from "./BusinessParts";
import BusinessOverview from "./BusinessOverview";
import { OrgAccessView } from "./OrgDashboardPage";
import { useAppState } from "@/globalState/hooks/useAppState";

type View = "business" | "access";
const STORAGE_KEY = "dashboard.view";

// A per-viewer convenience only - the page works the same when storage is blocked.
function readView(): View {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "access" ? "access" : "business";
  } catch {
    return "business";
  }
}

/**
 * Dashboard - the first item in the sidebar (screens.comp 'OrgDashboard'). Opens on the Business overview (the numbers most people
 * come for); the second tab is the organisation structure and who has access to it (what administrators use it for).
 */
export default function DashboardHome() {
  const [view, setView] = useState<View>(readView);
  const { userData } = useAppState() as any;

  const firstUser = Array.isArray(userData) ? userData[0] : userData;
  const fullName = String(firstUser?.ename || firstUser?.full_name || "").trim();
  const firstName = fullName.split(/\s+/)[0] || "there";
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const pick = (v: View) => {
    setView(v);
    try { window.localStorage.setItem(STORAGE_KEY, v); } catch { /* storage blocked - the choice just is not remembered */ }
  };

  return (
    <div className="mx-auto w-full max-w-[1920px]">
      <div className="px-2 pt-2 sm:px-3 sm:pt-3 lg:px-5 lg:pt-5">
        <section className="org-rise relative isolate overflow-hidden rounded-[1.5rem] border border-primary/15 bg-card shadow-[0_24px_70px_-45px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
          <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_9%,transparent),transparent_48%)]" />
          <div aria-hidden className="absolute -right-24 -top-32 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div aria-hidden className="absolute -bottom-28 left-1/3 -z-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

       
        </section>
          <div className="w-full shrink-0 lg:w-auto">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground lg:text-right"></p>
              <Segmented<View>
                label="Dashboard view"
                value={view}
                onChange={pick}
                options={[
                  { value: "business", label: "Business overview", icon: BarChart3 },
                  { value: "access", label: "Organisation & access", icon: ShieldCheck },
                ]}
              />
            </div>
      </div>

      {view === "business" ? (
        <div className="px-2 pt-5 sm:px-3 lg:px-5 lg:pt-6"><BusinessOverview /></div>
      ) : (
        <OrgAccessView />
      )}
    </div>
  );
}
