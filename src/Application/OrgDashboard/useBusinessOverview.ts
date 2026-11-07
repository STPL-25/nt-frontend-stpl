import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { socket } from "@/Services/Socket";
import { apiBusinessDashboard } from "@/Services/Api";
import { getErrorMessage } from "@/lib/errors";
import { diffKpi, type BusinessOverview } from "./businessModel";
import type { LiveEvent } from "./useOrgDashboard";

// ── Real-time ──────────────────────────────────────────────────────────────────────────────────
// The numbers live in the database; the page only refetches. It does NOT join any socket room of its own (rooms are granted per
// screen permission), so it reacts to whichever of these events already reach this browser, and a 60 s poll covers the rest:
//   payment:updated, grn:created, grn:approval_decided, gate_entry:*, inventory:updated, stockrequest:updated, asset:updated,
//   pr:approval:updated, po:approval:updated, service_po:approval:updated
// Also: refetch when the socket (re)connects and when the tab comes back to the front after being hidden.
const LIVE_EVENTS: Record<string, string> = {
  "payment:updated": "Payment updated",
  "payment:released": "Payment saved",
  "grn:created": "GRN created",
  "grn:approval_decided": "GRN decision",
  "gate_entry:created": "Gate entry created",
  "gate_entry:updated": "Gate entry updated",
  "gate_entry:status_updated": "Gate entry updated",
  "inventory:updated": "Stock changed",
  "stockrequest:updated": "Stock request updated",
  "asset:updated": "Asset request updated",
  "pr:approval:updated": "PR decision",
  "po:approval:updated": "PO decision",
  "service_po:approval:updated": "Service PO decision",
};
const POLL_MS = 60_000;
const DEBOUNCE_MS = 800;   // a bulk action fires many events; fold them into one fetch
const STALE_MS = 15_000;
const FLASH_MS = 2_200;
const NO_CHANGES: ReadonlySet<string> = new Set();

type Reason = "initial" | "live" | "poll" | "manual" | "reconnect" | "focus";

export function useBusinessOverview() {
  const [data, setData] = useState<BusinessOverview | null>(null);
  const [loading, setLoading] = useState(true);          // first load only - later refreshes keep the page on screen
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [changed, setChanged] = useState<ReadonlySet<string>>(NO_CHANGES);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);

  const dataRef = useRef<BusinessOverview | null>(null);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const lastFetchedRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async (reason: Reason) => {
    const seq = ++seqRef.current;                       // a newer request supersedes this one
    if (reason === "initial") setLoading(true); else setRefreshing(true);
    try {
      const res = await axios.get<{ success: boolean; data: BusinessOverview }>(apiBusinessDashboard);
      if (!mountedRef.current || seq !== seqRef.current) return;
      const next = res.data?.data;
      if (!next || !next.kpi || !Array.isArray(next.monthly)) throw new Error("The server sent an unexpected response.");
      const diff = diffKpi(dataRef.current?.kpi, next.kpi);
      dataRef.current = next;
      lastFetchedRef.current = Date.now();
      setData(next);
      setError(null);
      setLastFetchedAt(lastFetchedRef.current);
      if (diff.size) {
        setChanged(diff);
        clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => mountedRef.current && setChanged(NO_CHANGES), FLASH_MS);
      }
    } catch (err) {
      if (!mountedRef.current || seq !== seqRef.current) return;
      setError(getErrorMessage(err, "Could not load the business overview."));
    } finally {
      if (mountedRef.current && seq === seqRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const refreshSoon = useCallback((reason: Reason) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void load(reason); }, DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    // Fetch on mount - state is only set once the request settles (same pattern as useFetchHook).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("initial");

    const handlers = Object.entries(LIVE_EVENTS).map(([event, label]) => {
      const handler = () => { setLastEvent({ label, at: Date.now() }); refreshSoon("live"); };
      socket.on(event, handler);
      return [event, handler] as const;
    });
    const onConnect = () => { setConnected(true); refreshSoon("reconnect"); };
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);

    const poll = setInterval(() => { if (document.visibilityState === "visible") void load("poll"); }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetchedRef.current > STALE_MS) void load("focus");
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      clearTimeout(debounceRef.current);
      clearTimeout(flashRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      for (const [event, handler] of handlers) socket.off(event, handler);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [load, refreshSoon]);

  const refresh = useCallback(() => load("manual"), [load]);

  return { data, loading, refreshing, error, lastFetchedAt, connected, changed, lastEvent, refresh };
}
