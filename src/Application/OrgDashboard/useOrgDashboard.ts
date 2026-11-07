import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { socket } from "@/Services/Socket";
import { apiOrgDashboard } from "@/Services/Api";
import { getErrorMessage } from "@/lib/errors";
import { diffOverview, type OrgOverview } from "./orgDashboardModel";

// ── Real-time ──────────────────────────────────────────────────────────────────────────────────
// The backend already broadcasts these to every connected client, so the dashboard needs no room of its own and the backend
// stays the single source of truth - on any of them the page just fetches the (cheap) overview again:
//   admin:permissions:updated  someone's access was saved / edited / revoked on Role Approval  { user_ecno | login_id | user_id }
//   permissions:updated        the signed-in user's own access changed
//   master:updated             a master row was created / edited / deleted                     { masterField, action }
// Safety nets for a missed event: a 60 s poll while the tab is visible, a refetch when the socket (re)connects and when the tab
// comes back to the front after being hidden.
const ACCESS_EVENTS = ["admin:permissions:updated", "permissions:updated"] as const;
const MASTER_EVENT = "master:updated";
const ORG_MASTERS: Record<string, string> = {
  CompanyMaster: "Company", DivisionMaster: "Division", BranchMaster: "Branch", DeptMaster: "Department",
};
const POLL_MS = 60_000;
const DEBOUNCE_MS = 500;   // a bulk save fires many events; fold them into one fetch
const STALE_MS = 15_000;
const FLASH_MS = 2_200;
const NO_CHANGES: ReadonlySet<string> = new Set();

export interface LiveEvent { label: string; at: number }
type Reason = "initial" | "live" | "poll" | "manual" | "reconnect" | "focus";

export function useOrgDashboard() {
  const [data, setData] = useState<OrgOverview | null>(null);
  const [loading, setLoading] = useState(true);          // first load only - later refreshes keep the page on screen
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [changed, setChanged] = useState<ReadonlySet<string>>(NO_CHANGES);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);

  const dataRef = useRef<OrgOverview | null>(null);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const lastFetchedRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async (reason: Reason) => {
    const seq = ++seqRef.current;                       // a newer request supersedes this one
    if (reason === "initial") setLoading(true); else setRefreshing(true);
    try {
      const res = await axios.get<{ success: boolean; data: OrgOverview }>(apiOrgDashboard);
      if (!mountedRef.current || seq !== seqRef.current) return;
      const next = res.data?.data;
      if (!next || !Array.isArray(next.nodes)) throw new Error("The server sent an unexpected response.");
      const diff = diffOverview(dataRef.current, next);
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
      setError(getErrorMessage(err, "Could not load the dashboard."));
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

    const onAccess = (payload?: { user_ecno?: string | null; login_id?: string | null; user_id?: string | number | null; message?: string }) => {
      const who = payload?.user_ecno || payload?.login_id;
      setLastEvent({ label: who ? `Access changed for ${who}` : "Access changed", at: Date.now() });
      refreshSoon("live");
    };
    const onMaster = (payload?: { masterField?: string; action?: string }) => {
      const kind = payload?.masterField ? ORG_MASTERS[payload.masterField] : undefined;
      if (!kind) return;                                 // some other master (UOM, category ...) - nothing on this page changes
      setLastEvent({ label: `${kind} ${payload?.action ?? "updated"}`, at: Date.now() });
      refreshSoon("live");
    };
    const onConnect = () => { setConnected(true); refreshSoon("reconnect"); };
    const onDisconnect = () => setConnected(false);

    for (const ev of ACCESS_EVENTS) socket.on(ev, onAccess);
    socket.on(MASTER_EVENT, onMaster);
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
      for (const ev of ACCESS_EVENTS) socket.off(ev, onAccess);
      socket.off(MASTER_EVENT, onMaster);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [load, refreshSoon]);

  const refresh = useCallback(() => load("manual"), [load]);

  return { data, loading, refreshing, error, lastFetchedAt, connected, changed, lastEvent, refresh };
}
