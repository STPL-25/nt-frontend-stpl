import React, { useState, useEffect, Suspense, type ComponentType } from "react";
import Header from "@/DashboardComponents/Header";
import Sidebar from "@/DashboardComponents/SideBar";
import { sectionComponents } from "@/ComponentsDatas/ComponentDatas";
import { useAppState } from "@/globalState/hooks/useAppState";
import ErrorMessage from "@/CustomComponent/ErrorMessage/ErrorMessage";
import Loading from "@/CustomComponent/LoadingComponents/Loading";
import NonStaffResetPassword from "@/Application/NonStaffPortal/NonStaffResetPassword";
import useFetch from "@/hooks/useFetchHook";
import { nonStaffMe } from "@/Services/NonStaffService";
import type { MainContentCSSProperties } from "./Dashboard.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getMainContentStyle = (
  isMobile: boolean,
  sidebarWidth: number
): MainContentCSSProperties => {
  if (isMobile) {
    return { marginLeft: 0, width: "100%" };
  }
  return {
    marginLeft: `${sidebarWidth}px`,
    transition: "margin-left 300ms ease-in-out",
    width: `calc(100% - ${sidebarWidth}px)`,
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Dashboard: React.FC = () => {
  const { sidebarWidth, isFullscreen, userData } = useAppState() as any;
  const { activeItem } = useAppState();

  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Non-staff sessions (login_id, no ecno) may still owe a forced password
  // reset — re-derived fresh from the DB on every mount (not trusted from
  // the login response) so a stale flag can't let a refresh skip it.
  const firstUser = Array.isArray(userData) ? userData[0] : userData;
  const isNonStaff = !firstUser?.ecno && !!firstUser?.login_id;
  const { data: meData } = useFetch<{ success: boolean; data: { must_reset_password: boolean } }>(
    isNonStaff ? nonStaffMe : null
  );
  const [resetDismissed, setResetDismissed] = useState(false);
  const mustResetPassword = isNonStaff && !resetDismissed && Boolean(meData?.data?.must_reset_password);

  const ActiveComponent: ComponentType | undefined = sectionComponents?.[activeItem];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mustResetPassword && (
        <NonStaffResetPassword
          loginId={firstUser?.login_id}
          onDone={() => setResetDismissed(true)}
        />
      )}

      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Main content area — offset by sidebar width, fixed to viewport height */}
      <div
        className="flex h-screen min-w-0 flex-col overflow-hidden"
        style={getMainContentStyle(isMobile, sidebarWidth)}
      >
        <Header />

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_42%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_42%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] px-1 pb-4 pt-2 sm:px-2 lg:px-3 lg:pb-6 lg:pt-3">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primary/[0.10] blur-3xl" />
            <div className="absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/65 to-background" />
          </div>
          <div className={`relative h-full w-full ${isFullscreen ? "mt-4" : ""}`}>
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] items-center justify-center p-4">
                  <Loading variant="spinner" fullScreen={false} size="lg" />
                </div>
              }
            >
              {ActiveComponent ? (
                <div className="h-full w-full">
                  <ActiveComponent />
                </div>
              ) : (
                <div className="flex min-h-[50vh] items-center justify-center p-4 md:p-8">
                  <div className="w-full max-w-md">
                    <ErrorMessage
                      message="Nothing selected"
                      description="Choose a module from the sidebar to get started."
                    />
                  </div>
                </div>
              )}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
