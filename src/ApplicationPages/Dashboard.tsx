



import { useState, useEffect, Suspense, ComponentType, CSSProperties } from "react";
import Header from "@/DashboardComponents/Header";
import Sidebar from "@/DashboardComponents/SideBar";
import { sectionComponents } from "@/ComponentsDatas/ComponentDatas";
import { useAppState } from "@/globalState/hooks/useAppState";
import ErrorMessage from "@/CustomComponent/ErrorMessage/ErrorMessage";
import Loading from "@/CustomComponent/LoadingComponents/Loading";

const Dashboard: React.FC = () => {
  const { sidebarOpen, sidebarWidth, isFullscreen,socket } = useAppState() as any;
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const ActiveComponent: ComponentType | undefined = sectionComponents?.[
    useAppState().activeItem
  ];

  const getMainContentStyle = (): CSSProperties => {
    if (isMobile) {
      return {
        marginLeft: 0,
        width: "100%",
      };
    }
    return {
      marginLeft: `${sidebarWidth}px`,
      transition: "margin-left 300ms ease-in-out",
      width: `calc(100% - ${sidebarWidth}px)`,
    };
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className="flex min-h-screen flex-col"
        style={getMainContentStyle()}
      >
        <Header />

        <main className="flex-1 px-2 pb-4 pt-3 lg:px-4 lg:pt-4">
          <div className={`h-full w-full ${isFullscreen ? "mt-4" : ""}`}>
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] items-center justify-center p-4">
                  <Loading variant="spinner" fullScreen={false} size="lg" />
                </div>
              }
            >
              {ActiveComponent ? (
                <div className="w-full">
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
