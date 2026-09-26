// Lets any screen (the notification drawer today) ask PR Tracking to open a specific PR.
//
// The app has no router for its inner screens — a screen is "opened" by setting the active
// sidebar item — so the target PR travels out-of-band: it is parked in sessionStorage (read
// once when PRTrackingPage mounts, i.e. the screen was not open yet) AND announced on window
// (picked up when PRTrackingPage is already mounted). Either path consumes the value.

const STORAGE_KEY = "pr_track:open";
export const PR_TRACK_OPEN_EVENT = "pr-track:open";

export function requestPrTracking(prNo: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, prNo);
  } catch {
    /* storage can be blocked — the event below still covers an already-open screen */
  }
  window.dispatchEvent(new CustomEvent(PR_TRACK_OPEN_EVENT, { detail: prNo }));
}

/** Returns the parked PR number (once) and clears it. */
export function consumePendingPrTracking(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) sessionStorage.removeItem(STORAGE_KEY);
    return value || null;
  } catch {
    return null;
  }
}

/** Subscribe to "open this PR" requests while PR Tracking is mounted. Returns an unsubscribe. */
export function onPrTrackingRequested(handler: (prNo: string) => void): () => void {
  const listener = () => {
    const prNo = consumePendingPrTracking();
    if (prNo) handler(prNo);
  };
  window.addEventListener(PR_TRACK_OPEN_EVENT, listener);
  return () => window.removeEventListener(PR_TRACK_OPEN_EVENT, listener);
}
