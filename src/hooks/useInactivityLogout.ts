import { useEffect, useRef, useCallback, useState } from "react";
import axios from "axios";
import { store } from "../globalState/store";
import { clearUserData } from "../globalState/features/decodeSlice";
import { clearSidebarData } from "../globalState/features/fetchSidebarDataSlice";

const apiUrl = import.meta.env.VITE_API_URL as string;

// Show warning after 2 hours of inactivity
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;

// Show warning popup 2 minutes before auto-logout
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const WARNING_COUNTDOWN_SECS = WARNING_BEFORE_MS / 1000; // 120 seconds

// User activity events to monitor
const ACTIVITY_EVENTS: string[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "wheel",
];

export interface InactivityState {
  showWarning: boolean;
  countdown: number;       // seconds remaining before auto-logout
  stayLoggedIn: () => void;
  logoutNow: () => void;
}

/**
 * Tracks user activity and:
 *  1. Shows a warning popup 2 min before auto-logout.
 *  2. Automatically logs out after INACTIVITY_TIMEOUT_MS of no interaction.
 *
 * Returns { showWarning, countdown, stayLoggedIn, logoutNow } for the UI.
 * Only active when isLoggedIn is true.
 */
export function useInactivityLogout(isLoggedIn: boolean): InactivityState {
  const [showWarning, setShowWarning]   = useState(false);
  const [countdown, setCountdown]       = useState(WARNING_COUNTDOWN_SECS);

  const warningTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const logoutTimerRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Perform actual logout ──────────────────────────────────────────────────
  const performLogout = useCallback(async () => {
    setShowWarning(false);
    try {
      await axios.post(`${apiUrl}/api/secure/logout`);
    } catch {
      // session may already be gone — ignore
    }
    store.dispatch(clearSidebarData());
    store.dispatch(clearUserData());
  }, []);

  // ── Clear all running timers ───────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current)      clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current)       clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    warningTimerRef.current      = null;
    logoutTimerRef.current       = null;
    countdownIntervalRef.current = null;
  }, []);

  // ── Start the visible 120-second countdown ────────────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(WARNING_COUNTDOWN_SECS);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── (Re)start the full inactivity pipeline ────────────────────────────────
  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    // After (INACTIVITY_TIMEOUT - WARNING) of silence → show the warning modal
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();

      // After the warning period itself → perform logout
      logoutTimerRef.current = setTimeout(() => {
        performLogout();
      }, WARNING_BEFORE_MS);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
  }, [clearAllTimers, startCountdown, performLogout]);

  // ── User clicked "Stay Logged In" ─────────────────────────────────────────
  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  // ── User clicked "Logout Now" ─────────────────────────────────────────────
  const logoutNow = useCallback(() => {
    clearAllTimers();
    performLogout();
  }, [clearAllTimers, performLogout]);

  // ── Attach / detach event listeners ───────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimers, { passive: true })
    );
    resetTimers(); // start the pipeline immediately on login

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetTimers)
      );
      clearAllTimers();
    };
  }, [isLoggedIn, resetTimers, clearAllTimers]);

  return { showWarning, countdown, stayLoggedIn, logoutNow };
}
