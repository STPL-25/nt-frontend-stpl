import Dashboard from "./ApplicationPages/Dashboard";
import SignIn from "./ApplicationPages/SignIn";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { useAppState } from "./globalState/hooks/useAppState";
import { useEffect } from "react";
import Signup from "./ApplicationPages/SignupPage";
import axios from "axios";
import { ThemeProvider } from "next-themes";
import { useSelector } from "react-redux";
import {
  selectThemeColor,
  selectThemeMode,
  selectThemeRadius,
  THEME_COLORS,
} from "./globalState/features/themeSlice";

// Define types (adjust as needed)
interface UserDataItem {
  ecno?: string;
  ename?: string;
  [key: string]: any;
}

interface StoredUserToken {
  encrypted?: string;
  [key: string]: any;
}

// Apply color + radius to <html> on mount and whenever they change
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
  const { userData, decryptData } = useAppState();
  const mode = useSelector(selectThemeMode);

  const cryptoSecret = import.meta.env.VITE_CRYPTO_SECRET as string;

  useEffect(() => {
    const stored = localStorage.getItem("userToken");

    if (stored) {
      let storedUserToken: StoredUserToken | null = null;

      try {
        storedUserToken = JSON.parse(stored);
      } catch (error) {
        console.error("Invalid JSON from localStorage userToken");
      }

      if (
        storedUserToken &&
        (!userData || Object.keys(userData).length === 0)
      ) {
        decryptData({
          encryptedData: storedUserToken,
          secretKey: cryptoSecret,
        });
      }
    }
  }, [cryptoSecret, decryptData, userData]);

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
    {
      path: "/signup",
      element: <Signup />,
    },
  ]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={mode}
      enableSystem
      disableTransitionOnChange={false}
    >
      <ThemeApplier />
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
