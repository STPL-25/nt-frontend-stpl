import Dashboard from "./ApplicationPages/Dashboard";
import SignIn from "./ApplicationPages/SignIn";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { useAppState } from "./globalState/hooks/useAppState";
import { useEffect } from "react";
import Signup from "./ApplicationPages/SignupPage";
import { ThemeProvider } from "next-themes";
import { useSelector } from "react-redux";
import {
  selectThemeColor,
  selectThemeMode,
  selectThemeRadius,
  THEME_COLORS,
} from "./globalState/features/themeSlice";

interface UserDataItem {
  ecno?: string;
  ename?: string;
  [key: string]: any;
}

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

function App() {
  const { userData, initUser } = useAppState();
  const mode = useSelector(selectThemeMode);

  // On every page load, ask the server if the session is still valid.
  // If yes, the user data is restored from the session-backed JWT.
  // If no (401), the server returns an error and we stay on the login page.
  useEffect(() => {
    if (!userData || Object.keys(userData).length === 0) {
      initUser();
    }
  }, []);

  const router = createBrowserRouter([
    {
      path: "/",
      element:
        userData && Object.keys(userData).length > 0 ? (
          (userData as UserDataItem[])[0]?.ecno &&
          (userData as UserDataItem[])[0]?.ename ? (
            <Dashboard />
          ) : (
            <SignIn />
          )
        ) : (
          <SignIn />
        ),
    },
    //  {
    //   path: "/",
    //   element:
    //     userData && Object.keys(userData).length > 0 ? (
    //       (userData as UserDataItem[]) 
    //       ? (
    //         <Dashboard />
    //       ) : (
    //         <SignIn />
    //       )
    //     ) : (
    //       <SignIn />
    //     ),
    // },
    {
      path: "/signup",
      element: <Signup />,
    },
  ]);

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
    </ThemeProvider>
  );
}

export default App;
