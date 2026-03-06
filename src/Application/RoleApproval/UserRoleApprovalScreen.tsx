
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import useFetch from "@/hooks/useFetchHook";
import usePost from "@/hooks/usePostHook";
import { isEqual } from "lodash";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import PermissionTable from "@/CustomComponent/InputComponents/PermissionTableProps";
import { toast } from "sonner";

interface User {
  nt_sign_up_sno: string;
  ecno: string;
  ename: string;
  dept: string;
}

type Branch = { brn_sno: string; brn_name: string };
type Division = { div_sno: string; div_name: string; branches: Branch[] };
type Company = { com_sno: string; com_name: string; divisions: Division[] };
interface HierarchyResponse {
  companies: Company[];
}

interface ScreenGroup {
  group_id: number;
  group_name: string;
  screen_id: number;
  screen_name: string;
  screen_code: string;
  display_order: number | null;
}

interface ScreensResponse {
  success: boolean;
  data: ScreenGroup[];
}

interface PermissionDetail {
  permission_id: number;
  permission_name: string;
  permission_description: string;
}

type Permissions = Record<string, Record<number, boolean>>;

export default function PermissionManager() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedUserEcno, setSelectedUserEcno] = useState<string>("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [permissionMap, setPermissionMap] = useState<Record<number, string>>({});

  const { data: userFetchData } = useFetch(
    `${import.meta.env.VITE_API_URL}/api/secure/get_all_users_sign_up`
  ) as { data?: { data?: User[] }; loading: boolean; error: Error | null };

  const { data: hierarchyFetchData } = useFetch(
    `${import.meta.env.VITE_API_URL}/api/user_approval/get_hierachy_com_details`
  ) as { data?: HierarchyResponse | null; loading: boolean; error: Error | null };

  const { data: screensData } = useFetch(
    `${import.meta.env.VITE_API_URL}/api/user_approval/get_screens_with_groups`
  ) as { data?: ScreensResponse | null; loading: boolean; error: Error | null };

  const { data: permissionDetailsData } = useFetch(
    `${import.meta.env.VITE_API_URL}/api/user_approval/get_permission_details`
  ) as { data?: { success: boolean; data: PermissionDetail[] }; loading: boolean; error: Error | null };

  const { data: existingPermFetch } = useFetch(
    selectedUser
      ? `${import.meta.env.VITE_API_URL}/api/user_approval/get_user_permissions/${selectedUser}`
      : null
  ) as {
    data?: { success: boolean; permissions: Permissions; companies?: string[]; divisions?: string[]; branches?: string[] };
    loading: boolean;
    error: Error | null;
  };

  const { postData } = usePost();

  const buildFromScreens = (screens: ScreenGroup[] | undefined) => {
    const newGroups: Record<string, string[]> = {};
    const newPermissions: Permissions = {};
    if (!screens) return { newGroups, newPermissions };
    screens.forEach((item) => {
      if (!newGroups[item.group_name]) newGroups[item.group_name] = [];
      if (!newGroups[item.group_name].includes(item.screen_name)) {
        newGroups[item.group_name].push(item.screen_name);
      }
      if (!newPermissions[item.screen_name]) newPermissions[item.screen_name] = {};
    });
    return { newGroups, newPermissions };
  };

  useEffect(() => {
    const screens = screensData?.data;
    if (!screens) return;
    const { newGroups, newPermissions } = buildFromScreens(screens);
    if (!isEqual(groups, newGroups) || !isEqual(Object.keys(permissions), Object.keys(newPermissions))) {
      setGroups(newGroups);
      setPermissions(newPermissions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screensData]);

  useEffect(() => {
    setSelectedCompanies([]);
    setSelectedDivisions([]);
    setSelectedBranches([]);
    if (screensData?.data) {
      const { newPermissions } = buildFromScreens(screensData.data);
      setPermissions(newPermissions);
    } else {
      setPermissions({});
    }
    // Track ecno for real-time socket notification
    const user = userFetchData?.data?.find((u) => u.nt_sign_up_sno === selectedUser);
    setSelectedUserEcno(user?.ecno ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  useEffect(() => {
    if (!existingPermFetch?.permissions || !screensData?.data) {
      if (existingPermFetch && screensData?.data) {
        const { newPermissions } = buildFromScreens(screensData.data);
        setPermissions(newPermissions);
      }
      return;
    }
    const { permissions: saved } = existingPermFetch;
    const { newPermissions } = buildFromScreens(screensData.data);
    const merged: Permissions = { ...newPermissions };
    Object.keys(saved).forEach((screen) => {
      if (merged[screen]) {
        merged[screen] = { ...merged[screen], ...saved[screen] };
      } else {
        merged[screen] = { ...saved[screen] };
      }
    });
    setPermissions(merged);
    if (existingPermFetch.companies) setSelectedCompanies(existingPermFetch.companies);
    if (existingPermFetch.divisions) setSelectedDivisions(existingPermFetch.divisions);
    if (existingPermFetch.branches) setSelectedBranches(existingPermFetch.branches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPermFetch, screensData]);

  useEffect(() => {
    if (selectedCompanies.length > 0) {
      const validDivisionIds = getAvailableDivisions().map((d) => d.div_sno);
      setSelectedDivisions((prev) => prev.filter((id) => validDivisionIds.includes(id)));
    } else {
      if (!existingPermFetch?.divisions) setSelectedDivisions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanies]);

  useEffect(() => {
    if (selectedDivisions.length > 0) {
      const validBranchIds = getAvailableBranches().map((b) => b.brn_sno);
      setSelectedBranches((prev) => prev.filter((id) => validBranchIds.includes(id)));
    } else {
      if (!existingPermFetch?.branches) setSelectedBranches([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDivisions]);

  useEffect(() => {
    if (permissionDetailsData?.data) {
      const map: Record<number, string> = {};
      permissionDetailsData.data.forEach((perm) => {
        map[perm.permission_id] = perm.permission_description;
      });
      setPermissionMap(map);
    }
  }, [permissionDetailsData]);

  function togglePerm(screen: string, permissionId: number) {
    setPermissions((curr) => {
      const currScreen = curr[screen] ?? {};
      return { ...curr, [screen]: { ...currScreen, [permissionId]: !currScreen[permissionId] } };
    });
  }

  const getAvailableDivisions = (): Division[] => {
    const companiesToUse = selectedCompanies.length > 0 ? selectedCompanies : existingPermFetch?.companies ?? [];
    if (companiesToUse.length === 0 || !hierarchyFetchData?.data) return [];
    const divisions: Division[] = [];
    companiesToUse.forEach((companyId) => {
      const company = hierarchyFetchData?.data?.companies.find((c) => c.com_sno === companyId);
      if (company) divisions.push(...company.divisions);
    });
    return divisions;
  };

  const getAvailableBranches = (): Branch[] => {
    const divisionsToUse = selectedDivisions.length > 0 ? selectedDivisions : existingPermFetch?.divisions ?? [];
    if (divisionsToUse.length === 0 || !hierarchyFetchData?.data) return [];
    const branches: Branch[] = [];
    divisionsToUse.forEach((divisionId) => {
      const division = hierarchyFetchData?.data?.companies
        .flatMap((c) => c.divisions)
        .find((d) => d.div_sno === divisionId);
      if (division) branches.push(...division.branches);
    });
    return branches;
  };

  const toggleCompany = (id: string) =>
    setSelectedCompanies((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleDivision = (id: string) =>
    setSelectedDivisions((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleBranch = (id: string) =>
    setSelectedBranches((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const getCompanyNames = () => {
    const ids = selectedCompanies.length > 0 ? selectedCompanies : existingPermFetch?.companies ?? [];
    if (!hierarchyFetchData?.data) return [];
    return ids.map((id) => hierarchyFetchData?.data?.companies.find((c) => c.com_sno === id)?.com_name).filter(Boolean) as string[];
  };

  const buildHierarchyPayload = () => {
    if (!hierarchyFetchData?.data) return { hierarchy: [] };
    const hierarchy: Array<{ com_sno: string | null; div_sno: string | null; brn_sno: string | null }> = [];
    const coms = selectedCompanies.length > 0 ? selectedCompanies : existingPermFetch?.companies ?? [];
    const divs = selectedDivisions.length > 0 ? selectedDivisions : existingPermFetch?.divisions ?? [];
    const brs = selectedBranches.length > 0 ? selectedBranches : existingPermFetch?.branches ?? [];

    coms.forEach((comId) => hierarchy.push({ com_sno: comId, div_sno: null, brn_sno: null }));

    divs.forEach((divId) => {
      const div = hierarchyFetchData.data?.companies.flatMap((c) => c.divisions).find((d) => d.div_sno === divId);
      const company = hierarchyFetchData.data?.companies.find((c) => c.divisions.some((d) => d.div_sno === divId));
      hierarchy.push({ com_sno: company?.com_sno || null, div_sno: div?.div_sno || null, brn_sno: null });
    });

    brs.forEach((brId) => {
      const div = hierarchyFetchData.data?.companies.flatMap((c) => c.divisions).find((d) => d.branches.some((b) => b.brn_sno === brId));
      const company = hierarchyFetchData.data?.companies.find((c) => c.divisions.some((d) => d.branches.some((b) => b.brn_sno === brId)));
      const br = hierarchyFetchData.data?.companies.flatMap((c) => c.divisions.flatMap((d) => d.branches)).find((b) => b.brn_sno === brId);
      hierarchy.push({ com_sno: company?.com_sno || null, div_sno: div?.div_sno || null, brn_sno: br?.brn_sno || null });
    });

    return { hierarchy };
  };

  const buildPermissionsPayload = () => {
    if (!screensData?.data) return [];
    const screenNameToId = new Map<string, number>();
    screensData.data.forEach((s) => screenNameToId.set(s.screen_name, s.screen_id));
    return Object.entries(permissions)
      .map(([screenName, screenPerms]) => {
        const screenId = screenNameToId.get(screenName);
        if (!screenId) return null;
        const selectedPermIds = Object.entries(screenPerms).filter(([_, v]) => v === true).map(([id]) => Number(id));
        return selectedPermIds.length > 0 ? { screen_id: screenId, permissions: selectedPermIds } : null;
      })
      .filter(Boolean) as { screen_id: number; permissions: number[] }[];
  };

  const handleReset = () => {
    setSelectedUser("");
    setSelectedUserEcno("");
    setSelectedCompanies([]);
    setSelectedDivisions([]);
    setSelectedBranches([]);
    const { newPermissions } = buildFromScreens(screensData?.data);
    setPermissions(newPermissions);
  };

  const handleSave = useCallback(async () => {
    if (!selectedUser) {
      toast.error("Please select a user first.");
      return;
    }
    const payload = {
      user_id: selectedUser,
      user_ecno: selectedUserEcno,  // backend uses this for real-time Socket.IO notification
      ...buildHierarchyPayload(),
      screens: buildPermissionsPayload(),
    };

    try {
      const res = await postData(`${import.meta.env.VITE_API_URL}/api/user_approval/save_user_permissions`, payload);
      if (res && (res as any).success) {
        handleReset();
        toast.success("Permissions updated. The user will see changes immediately.");
      } else {
        toast.error("Failed to update permissions");
      }
    } catch {
      toast.error("Error saving permissions");
    }
  }, [selectedUser, selectedUserEcno, selectedCompanies, selectedDivisions, selectedBranches, permissions, postData, hierarchyFetchData, screensData]);

  const permChecked = (screen: string, permissionId: number) => !!permissions?.[screen]?.[permissionId];
  const shouldShowPermissions = !!selectedUser && Object.keys(groups).length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="mx-auto space-y-8">
        {/* USER SELECT */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <CustomInputField
                  field="user"
                  label="Select User"
                  type="select"
                  className="w-100"
                  options={userFetchData?.data?.map((u) => ({ label: `${u.ename} (${u.dept})`, value: u.nt_sign_up_sno })) ?? []}
                  value={selectedUser}
                  onChange={setSelectedUser}
                  placeholder="Choose a user..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HIERARCHY */}
        {selectedUser && (
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <CustomInputField
                    field="companies"
                    label="Companies"
                    type="multi-select"
                    options={hierarchyFetchData?.data?.companies?.map((c) => ({ label: c.com_name, value: c.com_sno })) ?? []}
                    value={selectedCompanies.length > 0 ? selectedCompanies : existingPermFetch?.companies ?? []}
                    onChange={setSelectedCompanies}
                  />
                </div>
                <div>
                  <CustomInputField
                    field="divisions"
                    label="Divisions"
                    type="multi-select"
                    options={getAvailableDivisions().map((d) => ({ label: d.div_name, value: d.div_sno }))}
                    value={selectedDivisions.length > 0 ? selectedDivisions : existingPermFetch?.divisions ?? []}
                    onChange={setSelectedDivisions}
                  />
                </div>
                <div>
                  <CustomInputField
                    field="branches"
                    label="Branches"
                    type="multi-select"
                    options={getAvailableBranches().map((b) => ({ label: b.brn_name, value: b.brn_sno }))}
                    value={selectedBranches.length > 0 ? selectedBranches : existingPermFetch?.branches ?? []}
                    onChange={setSelectedBranches}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PERMISSIONS */}
        {shouldShowPermissions ? (
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-0">
              <div className="border-b px-6 py-4">
                <h2 className="text-lg font-medium text-slate-700">Screen Permissions</h2>
                <p className="text-sm text-slate-500">
                  Changes reflect instantly for the user after save.
                </p>
              </div>
              <div className="p-4 md:p-6">
                <PermissionTable
                  groups={groups}
                  permissions={permissions}
                  permChecked={permChecked}
                  togglePerm={togglePerm}
                  permissionMap={permissionMap}
                  permissionDetails={permissionDetailsData?.data ?? []}
                  handleSave={handleSave}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          selectedUser && (
            <div className="text-center py-16 text-slate-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm">No screens/groups available or still loading.</p>
            </div>
          )
        )}

        {/* Sticky Save Bar */}
        {selectedUser && (
          <div className="sticky bottom-0 bg-white shadow-lg border-t p-4 flex justify-between items-center md:justify-end gap-4">
            <div className="hidden md:block text-sm text-slate-600">
              <span className="mr-2">Selected:</span>
              <span className="font-medium">{getCompanyNames().join(", ") || "No company selected"}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset} className="px-4 py-2 border rounded-md text-sm text-slate-600 hover:bg-slate-50">
                Reset
              </button>
              <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
