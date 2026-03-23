/**
 * UserRoleApprovalScreen — Permission Manager
 *
 * Real-time flows:
 *  • When a new user registers  → socket "user:new"                → user dropdown auto-refreshes
 *  • When admin saves           → socket "admin:permissions:updated"→ other admins watching same
 *                                                                     user auto-refresh their view
 *  • The saved user             → socket "permissions:updated"      → their sidebar re-renders
 *                                                                     instantly (no page reload)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isEqual } from "lodash";
import { toast } from "sonner";
import {
  Shield,
  Wifi,
  WifiOff,
  UserPlus,
  RefreshCw,
  Save,
  RotateCcw,
  Plus,
  Minus,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn }     from "@/lib/utils";

import useFetch  from "@/hooks/useFetchHook";
import usePost   from "@/hooks/usePostHook";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import PermissionTable      from "@/CustomComponent/InputComponents/PermissionTableProps";
import {
  socket,
  SOCKET_USER_NEW,
  SOCKET_ADMIN_PERMISSIONS_UPDATED,
} from "@/Services/Socket";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  nt_sign_up_sno: string;
  ecno:  string;
  ename: string;
  dept:  string;
}

type Branch   = { brn_sno: string; brn_name: string };
type Division = { div_sno: string; div_name: string; branches: Branch[] };
type Company  = { com_sno: string; com_name: string; divisions: Division[] };

// API shapes ─────────────────────────────────────────────────
interface ScreenGroup {
  group_id:      number;
  group_name:    string;
  screen_id:     number;
  screen_name:   string;
  screen_code:   string;
  display_order: number | null;
}
interface PermissionDetail {
  permission_id:          number;
  permission_name:        string;
  permission_description: string;
}
type Permissions = Record<string, Record<number, boolean>>;
interface ExistingPermData {
  success:      boolean;
  permissions:  Permissions;
  companies?:   string[];
  divisions?:   string[];
  branches?:    string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build empty groups + permissions map from the screen list */
function buildFromScreens(screens: ScreenGroup[] | undefined) {
  const groups:      Record<string, string[]> = {};
  const permissions: Permissions              = {};
  if (!screens) return { groups, permissions };

  for (const s of screens) {
    if (!groups[s.group_name])               groups[s.group_name]      = [];
    if (!groups[s.group_name].includes(s.screen_name))
      groups[s.group_name].push(s.screen_name);
    if (!permissions[s.screen_name])         permissions[s.screen_name] = {};
  }
  return { groups, permissions };
}

/** Count total enabled permission-cells */
function countEnabled(p: Permissions) {
  return Object.values(p).reduce(
    (sum, perms) => sum + Object.values(perms).filter(Boolean).length,
    0
  );
}

/** Compare two snapshots → { added, removed } cell counts */
function diffPermissions(original: Permissions, current: Permissions) {
  let added = 0, removed = 0;
  const allScreens = new Set([...Object.keys(original), ...Object.keys(current)]);
  for (const screen of allScreens) {
    const origPerms    = original[screen] ?? {};
    const currentPerms = current[screen]  ?? {};
    const allPerms     = new Set([
      ...Object.keys(origPerms).map(Number),
      ...Object.keys(currentPerms).map(Number),
    ]);
    for (const id of allPerms) {
      const was = !!origPerms[id];
      const is  = !!currentPerms[id];
      if (!was && is)  added++;
      if (was  && !is) removed++;
    }
  }
  return { added, removed };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
      connected
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "border-muted text-muted-foreground bg-muted/40"
    )}>
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Wifi className="h-3 w-3" />
          Live
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: "default" | "add" | "remove";
}) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
      variant === "add"    && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      variant === "remove" && "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      variant === "default" && "border-border bg-muted/40 text-muted-foreground",
    )}>
      {icon}
      <span>{value} {label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PermissionManager() {
  const API = import.meta.env.VITE_API_URL as string;

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedUser,      setSelectedUser]      = useState("");
  const [selectedUserEcno,  setSelectedUserEcno]  = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedBranches,  setSelectedBranches]  = useState<string[]>([]);

  // ── Permission state ───────────────────────────────────────────────────────
  const [permissions,         setPermissions]         = useState<Permissions>({});
  const [originalPermissions, setOriginalPermissions] = useState<Permissions>({});
  const [groups,              setGroups]              = useState<Record<string, string[]>>({});
  const [permissionMap,       setPermissionMap]       = useState<Record<number, string>>({});

  // ── Real-time / UI state ───────────────────────────────────────────────────
  const [userListRefreshKey, setUserListRefreshKey] = useState(0);
  const [permRefreshKey,     setPermRefreshKey]     = useState(0);
  const [isLive,             setIsLive]             = useState(socket.connected);
  const [saving,             setSaving]             = useState(false);
  const [flashUserEcno,      setFlashUserEcno]      = useState<string | null>(null);

  // Ref so socket listeners always see the latest selectedUser w/o re-registering
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  // ── Fetches ────────────────────────────────────────────────────────────────

  // API: { success, data: User[] }
  const { data: usersRes, loading: usersLoading } = useFetch<{ data?: User[] }>(
    `${API}/api/secure/get_all_users_sign_up`,
    "", null, userListRefreshKey
  );

  // API: { success, data: { companies: [...] } }
  const { data: hierarchyRes } = useFetch<{ data?: { companies: Company[] } }>(
    `${API}/api/user_approval/get_hierachy_com_details`
  );

  // API: { success, data: ScreenGroup[] }
  const { data: screensRes } = useFetch<{ data?: ScreenGroup[] }>(
    `${API}/api/user_approval/get_screens_with_groups`
  );

  // API: { success, data: PermissionDetail[] }
  const { data: permDetailsRes } = useFetch<{ data?: PermissionDetail[] }>(
    `${API}/api/user_approval/get_permission_details`
  );

  // API: { success, permissions, companies, divisions, branches }
  // Null URL → skipped until a user is selected
  const {
    data:    existingPermRes,
    loading: existingLoading,
  } = useFetch<ExistingPermData>(
    selectedUser
      ? `${API}/api/user_approval/get_user_permissions/${selectedUser}`
      : null,
    "", null, permRefreshKey
  );

  const { postData } = usePost();

  // ── Convenient accessors ───────────────────────────────────────────────────
  const allUsers       = usersRes?.data              ?? [];
  const allCompanies   = hierarchyRes?.data?.companies ?? [];
  const allScreens     = screensRes?.data            ?? [];
  const permDetails    = permDetailsRes?.data        ?? [];

  // ── Socket: real-time listeners ────────────────────────────────────────────
  useEffect(() => {
    setIsLive(socket.connected);
    const onConnect    = () => setIsLive(true);
    const onDisconnect = () => setIsLive(false);

    // New user registered → refresh dropdown
    const onUserNew = (data: { ename?: string; ecno?: string }) => {
      setUserListRefreshKey((k) => k + 1);
      toast.info(`New user registered: ${data.ename ?? data.ecno ?? "unknown"}`, {
        icon: <UserPlus className="h-4 w-4" />,
      });
    };

    // Another admin saved permissions → refresh if viewing the same user
    const onAdminPermsUpdated = (data: { user_id?: string; user_ecno?: string }) => {
      if (data.user_id && data.user_id === selectedUserRef.current) {
        setPermRefreshKey((k) => k + 1);
        toast.warning("Permissions updated by another admin — refreshing…", {
          icon: <RefreshCw className="h-4 w-4" />,
        });
      }
      if (data.user_ecno) {
        setFlashUserEcno(data.user_ecno);
        setTimeout(() => setFlashUserEcno(null), 4000);
      }
    };

    socket.on("connect",                        onConnect);
    socket.on("disconnect",                     onDisconnect);
    socket.on(SOCKET_USER_NEW,                  onUserNew);
    socket.on(SOCKET_ADMIN_PERMISSIONS_UPDATED, onAdminPermsUpdated);
    return () => {
      socket.off("connect",                        onConnect);
      socket.off("disconnect",                     onDisconnect);
      socket.off(SOCKET_USER_NEW,                  onUserNew);
      socket.off(SOCKET_ADMIN_PERMISSIONS_UPDATED, onAdminPermsUpdated);
    };
  }, []); // stable — refs handle stale-closure for selectedUser

  // ── Build groups/base-permissions when screen list loads ───────────────────
  useEffect(() => {
    if (!allScreens.length) return;
    const { groups: g, permissions: p } = buildFromScreens(allScreens);
    if (!isEqual(groups, g)) setGroups(g);
    if (Object.keys(permissions).length === 0) {
      setPermissions(p);
      setOriginalPermissions(p);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allScreens]);

  // ── Reset when selected user changes ──────────────────────────────────────
  useEffect(() => {
    setSelectedCompanies([]);
    setSelectedDivisions([]);
    setSelectedBranches([]);
    const base = buildFromScreens(allScreens).permissions;
    setPermissions(base);
    setOriginalPermissions(base);
    const user = allUsers.find((u) => u.nt_sign_up_sno === selectedUser);
    setSelectedUserEcno(user?.ecno ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // ── Merge saved permissions when they arrive ───────────────────────────────
  useEffect(() => {
    if (!allScreens.length) return;

    const base = buildFromScreens(allScreens).permissions;

    if (!existingPermRes?.permissions || Object.keys(existingPermRes.permissions).length === 0) {
      // No existing permissions found → blank slate
      setPermissions(base);
      setOriginalPermissions(base);
      return;
    }

    // Merge saved permissions ON TOP of the blank base
    const merged: Permissions = { ...base };
    for (const [screen, perms] of Object.entries(existingPermRes.permissions)) {
      merged[screen] = { ...(merged[screen] ?? {}), ...perms };
    }

    setPermissions(merged);
    setOriginalPermissions(JSON.parse(JSON.stringify(merged))); // deep-clone as baseline

    if (existingPermRes.companies) setSelectedCompanies(existingPermRes.companies);
    if (existingPermRes.divisions) setSelectedDivisions(existingPermRes.divisions);
    if (existingPermRes.branches)  setSelectedBranches(existingPermRes.branches);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPermRes]);

  // ── Cascade: prune stale divisions / branches when parents deselected ──────
  useEffect(() => {
    if (!selectedCompanies.length) return;
    const valid = new Set(availableDivisions().map((d) => d.div_sno));
    setSelectedDivisions((p) => p.filter((id) => valid.has(id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanies]);

  useEffect(() => {
    if (!selectedDivisions.length) return;
    const valid = new Set(availableBranches().map((b) => b.brn_sno));
    setSelectedBranches((p) => p.filter((id) => valid.has(id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDivisions]);

  // ── Permission description map ─────────────────────────────────────────────
  useEffect(() => {
    if (!permDetails.length) return;
    const m: Record<number, string> = {};
    permDetails.forEach((p) => { m[p.permission_id] = p.permission_description; });
    setPermissionMap(m);
  }, [permDetails]);

  // ── Hierarchy helpers ──────────────────────────────────────────────────────
  const availableDivisions = (): Division[] => {
    const coms = selectedCompanies.length ? selectedCompanies : existingPermRes?.companies ?? [];
    return coms.flatMap(
      (id) => allCompanies.find((c) => c.com_sno === id)?.divisions ?? []
    );
  };

  const availableBranches = (): Branch[] => {
    const divs = selectedDivisions.length ? selectedDivisions : existingPermRes?.divisions ?? [];
    const allDivs = allCompanies.flatMap((c) => c.divisions);
    return divs.flatMap(
      (id) => allDivs.find((d) => d.div_sno === id)?.branches ?? []
    );
  };

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const togglePerm = useCallback((screen: string, permissionId: number) =>
    setPermissions((curr) => ({
      ...curr,
      [screen]: { ...(curr[screen] ?? {}), [permissionId]: !curr[screen]?.[permissionId] },
    })), []);

  const permChecked = useCallback(
    (screen: string, permissionId: number) => !!permissions?.[screen]?.[permissionId],
    [permissions]
  );

  // ── Payload builders ───────────────────────────────────────────────────────
  const buildHierarchyPayload = useCallback(() => {
    const coms = selectedCompanies.length ? selectedCompanies : existingPermRes?.companies ?? [];
    const divs = selectedDivisions.length ? selectedDivisions : existingPermRes?.divisions ?? [];
    const brs  = selectedBranches.length  ? selectedBranches  : existingPermRes?.branches  ?? [];
    const allDivs = allCompanies.flatMap((c) => c.divisions);
    const allBrs  = allDivs.flatMap((d) => d.branches);

    return {
      hierarchy: [
        ...coms.map((id) => ({ com_sno: id, div_sno: null, brn_sno: null })),
        ...divs.map((id) => {
          const com = allCompanies.find((c) => c.divisions.some((d) => d.div_sno === id));
          return { com_sno: com?.com_sno ?? null, div_sno: id, brn_sno: null };
        }),
        ...brs.map((id) => {
          const div = allDivs.find((d) => d.branches.some((b) => b.brn_sno === id));
          const com = allCompanies.find((c) => c.divisions.some((d) => d.branches.some((b) => b.brn_sno === id)));
          return { com_sno: com?.com_sno ?? null, div_sno: div?.div_sno ?? null, brn_sno: id };
        }),
      ],
    };
  }, [allCompanies, selectedCompanies, selectedDivisions, selectedBranches, existingPermRes]);

  const buildPermissionsPayload = useCallback(() => {
    const nameToId = new Map<string, number>(allScreens.map((s) => [s.screen_name, s.screen_id]));
    return Object.entries(permissions)
      .map(([name, perms]) => {
        const id = nameToId.get(name);
        if (!id) return null;
        const enabled = Object.entries(perms).filter(([, v]) => v).map(([k]) => Number(k));
        return enabled.length ? { screen_id: id, permissions: enabled } : null;
      })
      .filter(Boolean) as { screen_id: number; permissions: number[] }[];
  }, [allScreens, permissions]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSelectedUser("");
    setSelectedUserEcno("");
    setSelectedCompanies([]);
    setSelectedDivisions([]);
    setSelectedBranches([]);
    const base = buildFromScreens(allScreens).permissions;
    setPermissions(base);
    setOriginalPermissions(base);
  }, [allScreens]);

  const handleDiscardChanges = useCallback(() => {
    setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
  }, [originalPermissions]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedUser) { toast.error("Select a user first."); return; }
    setSaving(true);
    try {
      const res: any = await postData(
        `${API}/api/user_approval/save_user_permissions`,
        {
          user_id:   selectedUser,
          user_ecno: selectedUserEcno,
          ...buildHierarchyPayload(),
          screens: buildPermissionsPayload(),
        }
      );
      if (res?.success) {
        // Update baseline so diff resets to 0 after save
        setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
        toast.success("Saved — permissions pushed to user instantly via WebSocket.");
      } else {
        toast.error("Failed to save permissions.");
      }
    } catch {
      toast.error("Error saving permissions.");
    } finally {
      setSaving(false);
    }
  }, [
    selectedUser, selectedUserEcno,
    buildHierarchyPayload, buildPermissionsPayload,
    postData, permissions, API,
  ]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const { added, removed } = useMemo(
    () => diffPermissions(originalPermissions, permissions),
    [originalPermissions, permissions]
  );
  const hasChanges = added > 0 || removed > 0;

  const enabledCount = useMemo(() => countEnabled(permissions), [permissions]);

  const companyNames = useMemo(() => {
    const ids = selectedCompanies.length ? selectedCompanies : existingPermRes?.companies ?? [];
    return ids.map((id) => allCompanies.find((c) => c.com_sno === id)?.com_name).filter(Boolean) as string[];
  }, [selectedCompanies, existingPermRes, allCompanies]);

  const userOptions = useMemo(
    () => allUsers.map((u) => ({
      label: flashUserEcno === u.ecno
        ? `${u.ename} (${u.dept}) ✦`
        : `${u.ename} (${u.dept})`,
      value: u.nt_sign_up_sno,
    })),
    [allUsers, flashUserEcno]
  );

  const selectedUserName = useMemo(
    () => allUsers.find((u) => u.nt_sign_up_sno === selectedUser)?.ename ?? "",
    [allUsers, selectedUser]
  );

  const showPermissions = !!selectedUser && Object.keys(groups).length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Role & Permissions
              </h1>
              <p className="text-xs text-muted-foreground">
                Changes reflect on the user's screen instantly
              </p>
            </div>
          </div>
          <LiveBadge connected={isLive} />
        </div>

        {/* ── User selector ─────────────────────────────────────────────────── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border px-6 pb-4 pt-5">
            <CardTitle className="text-sm font-semibold text-foreground">
              Select User
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <CustomInputField
                  field="user"
                  label="User"
                  type="select"
                  options={userOptions}
                  value={selectedUser}
                  onChange={setSelectedUser}
                  placeholder={usersLoading ? "Loading users…" : "Choose a user…"}
                />
              </div>

              {/* Existing permission summary chip */}
              {selectedUser && !existingLoading && (
                <div className="flex items-end gap-2">
                  <Badge
                    variant={enabledCount > 0 ? "default" : "secondary"}
                    className="h-9 gap-1.5 px-3 text-sm font-normal"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {enabledCount} permission{enabledCount !== 1 ? "s" : ""} enabled
                  </Badge>
                </div>
              )}
              {selectedUser && existingLoading && (
                <div className="flex items-end">
                  <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading existing permissions…
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Organisation scope ───────────────────────────────────────────── */}
        {selectedUser && (
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border px-6 pb-4 pt-5">
              <CardTitle className="text-sm font-semibold text-foreground">
                Organisation Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <CustomInputField
                  field="companies"
                  label="Companies"
                  type="multi-select"
                  options={allCompanies.map((c) => ({ label: c.com_name, value: c.com_sno }))}
                  value={selectedCompanies.length ? selectedCompanies : existingPermRes?.companies ?? []}
                  onChange={setSelectedCompanies}
                />
                <CustomInputField
                  field="divisions"
                  label="Divisions"
                  type="multi-select"
                  options={availableDivisions().map((d) => ({ label: d.div_name, value: d.div_sno }))}
                  value={selectedDivisions.length ? selectedDivisions : existingPermRes?.divisions ?? []}
                  onChange={setSelectedDivisions}
                />
                <CustomInputField
                  field="branches"
                  label="Branches"
                  type="multi-select"
                  options={availableBranches().map((b) => ({ label: b.brn_name, value: b.brn_sno }))}
                  value={selectedBranches.length ? selectedBranches : existingPermRes?.branches ?? []}
                  onChange={setSelectedBranches}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Permission matrix ─────────────────────────────────────────────── */}
        {selectedUser && (
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border px-6 pb-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Screen Permissions
                    {selectedUserName && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        — {selectedUserName}
                      </span>
                    )}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Existing permissions are pre-checked. Uncheck to revoke.
                  </p>
                </div>
                {/* Live change diff */}
                {hasChanges && (
                  <div className="flex items-center gap-2">
                    {added   > 0 && <StatChip icon={<Plus  className="h-3 w-3" />} label="added"   value={added}   variant="add"    />}
                    {removed > 0 && <StatChip icon={<Minus className="h-3 w-3" />} label="removed" value={removed} variant="remove" />}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                      onClick={handleDiscardChanges}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Discard
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {existingLoading ? (
                // Loading skeleton
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Loading existing permissions…</p>
                </div>
              ) : showPermissions ? (
                <PermissionTable
                  groups={groups}
                  permissions={permissions}
                  permChecked={permChecked}
                  togglePerm={togglePerm}
                  permissionMap={permissionMap}
                  permissionDetails={permDetails}
                  handleSave={handleSave}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Shield className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No screens found or still loading…</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Sticky action bar ─────────────────────────────────────────────── */}
        {selectedUser && (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-6 py-4 shadow-lg backdrop-blur">
            {/* Left: scope summary */}
            <div className="hidden flex-col md:flex">
              <span className="text-xs text-muted-foreground">
                {companyNames.length
                  ? <>Scope: <span className="font-medium text-foreground">{companyNames.join(", ")}</span></>
                  : <span className="italic">No company scope selected</span>}
              </span>
              {hasChanges && (
                <span className="mt-0.5 text-xs text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400">{added > 0 ? `+${added}` : ""}</span>
                  {added > 0 && removed > 0 && " "}
                  <span className="text-rose-600 dark:text-rose-400">{removed > 0 ? `-${removed}` : ""}</span>
                  {" "}unsaved change{added + removed !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex gap-2">
              {hasChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardChanges}
                  disabled={saving}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Discard
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="gap-2 px-6"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving…" : hasChanges ? `Save ${added + removed} Change${added + removed !== 1 ? "s" : ""}` : "No Changes"}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
