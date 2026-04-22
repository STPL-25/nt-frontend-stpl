import Dashboard from "./ApplicationPages/Dashboard";
import SignIn from "./ApplicationPages/SignIn";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { useAppState } from "./globalState/hooks/useAppState";
import { useEffect } from "react";
import Signup from "./ApplicationPages/SignupPage";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import SessionTimeoutModal from "./LayoutComponent/SessionTimeoutModal";
import SessionExpiredModal from "./LayoutComponent/SessionExpiredModal";
import { ThemeProvider } from "next-themes";
import { useSelector, useDispatch } from "react-redux";
import {
  selectThemeColor,
  selectThemeMode,
  selectThemeRadius,
  THEME_COLORS,
} from "./globalState/features/themeSlice";
import { selectSessionExpired, setSessionExpired, clearUserData } from "./globalState/features/decodeSlice";
import { clearSidebarData } from "./globalState/features/fetchSidebarDataSlice";

function ThemeApplier() {
  const color  = useSelector(selectThemeColor);
  const radius = useSelector(selectThemeRadius);

  useEffect(() => {
    const root = document.documentElement;
    THEME_COLORS.forEach(({ id }) => root.classList.remove(`theme-${id}`));
    if (color !== "blue") root.classList.add(`theme-${color}`);
  }, [color]);

  useEffect(() => {
    const root = document.documentElement;
    const RADIUS_CLASSES = ["radius-none", "radius-sm", "radius-md", "radius-lg", "radius-full"];
    RADIUS_CLASSES.forEach((c) => root.classList.remove(c));
    const map: Record<number, string> = {
      0: "radius-none",
      0.25: "radius-sm",
      0.5: "radius-md",
      0.75: "radius-lg",
      1.5: "radius-full",
    };
    if (map[radius]) root.classList.add(map[radius]);
  }, [radius]);

  return null;
}

// Reads userData from Redux and renders the correct page.
// Kept separate so the router instance (below) stays stable.
function RootRoute() {
  const { userData, isLoading, initUser } = useAppState();

  useEffect(() => {
    initUser();
  }, []);

  // Show a neutral loading screen while session is being restored —
  // prevents the login page flashing on every page refresh.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Restoring session…</p>
        </div>
      </div>
    );
  }

  const firstUser = Array.isArray(userData) ? userData[0] : userData;
  if (userData && Object.keys(userData).length > 0 && firstUser?.ecno && firstUser?.ename) {
    return <Dashboard />;
  }
  return <SignIn />;
}

// Created once outside the component so the router instance never changes.
const router = createBrowserRouter([
  { path: "/", element: <RootRoute /> },
  { path: "/signup", element: <Signup /> },
]);

function App() {
  const { userData } = useAppState();
  const mode = useSelector(selectThemeMode);
  const sessionExpired = useSelector(selectSessionExpired);
  const dispatch = useDispatch();

  const firstUser = Array.isArray(userData) ? userData[0] : userData;
  const isLoggedIn = !!userData && Object.keys(userData).length > 0 && !!firstUser?.ecno;

  // Auto-logout after 2 hrs of inactivity; shows warning popup before
  const { showWarning, countdown, stayLoggedIn, logoutNow } = useInactivityLogout(isLoggedIn);

  const handleSessionExpiredLogin = () => {
    dispatch(clearSidebarData());
    dispatch(clearUserData());
    dispatch(setSessionExpired(false));
  };

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={mode}
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <ThemeApplier />
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
      <SessionTimeoutModal
        isOpen={showWarning}
        countdown={countdown}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={logoutNow}
      />
      <SessionExpiredModal
        isOpen={sessionExpired}
        onLoginAgain={handleSessionExpiredLogin}
      />
    </ThemeProvider>
  );
}

export default App;
