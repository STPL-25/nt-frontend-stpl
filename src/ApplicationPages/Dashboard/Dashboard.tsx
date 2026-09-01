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
        className="flex h-screen flex-col overflow-hidden"
        style={getMainContentStyle(isMobile, sidebarWidth)}
      >
        <Header />

        <main className="flex-1 overflow-y-auto px-2 pb-4 pt-3 lg:px-4 lg:pt-4">
          <div className={`h-full w-full ${isFullscreen ? "mt-4" : ""}`}>
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
