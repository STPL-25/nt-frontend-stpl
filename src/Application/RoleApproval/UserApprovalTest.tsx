import React, { use, useEffect, useMemo, useState ,useCallback} from "react";
import { Card, CardContent } from "@/components/ui/card";
import useFetch from "@/hooks/useFetchHook";
import usePost from "@/hooks/usePostHook";
import { isEqual } from "lodash";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import PermissionTable from "@/CustomComponent/InputComponents/PermissionTableProps";

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

type PermissionKeys = "view" | "create" | "edit" | "delete" | "approve";

type Permission = {
  [K in PermissionKeys]: boolean;
} & { more: string[] };

type Permissions = {
  [screen: string]: Permission;
};



export default function PermissionManager() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permissions>({});
  // const [morePermModal, setMorePermModal] = useState<{ open: boolean; screen?: string }>({
  //   open: false,
  //   screen: undefined,
  // });
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [permissionMap, setPermissionMap] = useState<Record<number, string>>({});

  // Fetch users
  const {
    data: userFetchData,
  } = useFetch(`${import.meta.env.VITE_API_URL}/api/secure/get_all_users_sign_up`) as {
    data?: { data?: User[] };
    loading: boolean;
    error: Error | null;
  };

  // Fetch hierarchy
  const {
    data: hierarchyFetchData,
  } = useFetch(`${import.meta.env.VITE_API_URL}/api/user_approval/get_hierachy_com_details`) as {
    data?: HierarchyResponse | null;
    loading: boolean;
    error: Error | null;
  };

  // Fetch screens and groups
  const {
    data: screensData,
  } = useFetch(`${import.meta.env.VITE_API_URL}/api/user_approval/get_screens_with_groups`) as {
    data?: ScreensResponse | null;
    loading: boolean;
    error: Error | null;
  };

  // Fetch permission details
  const { data: permissionDetailsData, } = useFetch(`${import.meta.env.VITE_API_URL}/api/user_approval/get_permission_details`) as {
    data?: { success: boolean; data: { permission_id: number; permission_name: string; permission_description: string }[] };
    loading: boolean;
    error: Error | null;
  };
  console.log("Permission Details Data:", permissionDetailsData);

  // Fetch existing permissions for selected user (null to skip when no user)
  const {
    data: existingPermFetch,
  } = useFetch(
    selectedUser
      ? `${import.meta.env.VITE_API_URL}/api/user_approval/get_user_permissions/${selectedUser}`
      : null
  ) as {
    data?: { success: boolean; permissions: Permissions; companies?: string[]; divisions?: string[]; branches?: string[] };
    loading: boolean;
    error: Error | null;
  };
  const { postData } = usePost();
  // Helper: create initial permission object for a screen
  const createPermissionTemplate = (): Permission => ({
    view: false,
    create: false,
    edit: false,
    delete: false,
    approve: false,
    more: [],
  });

  // Helper: build permissions and groups from screensData
  const buildFromScreens = (screens: ScreenGroup[] | undefined) => {
    const newGroups: Record<string, string[]> = {};
    const newPermissions: Permissions = {};

    if (!screens) return { newGroups, newPermissions };

    screens.forEach((item) => {
      if (!newGroups[item.group_name]) newGroups[item.group_name] = [];
      newGroups[item.group_name].push(item.screen_name);
      newPermissions[item.screen_name] = createPermissionTemplate();
    });

    return { newGroups, newPermissions };
  };

  // Initialize groups and permissions when screensData becomes available
  useEffect(() => {
    const screens = screensData?.data;
    if (!screens) return;
    const { newGroups, newPermissions } = buildFromScreens(screens);

    if (!isEqual(groups, newGroups) || !isEqual(Object.keys(permissions), Object.keys(newPermissions))) {
      setGroups(newGroups);
      setPermissions(newPermissions);
    }
  }, [screensData]);

  // Reset selections + permissions when selected user changes
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
  }, [selectedUser]);

  // Merge saved user permissions when fetched
  useEffect(() => {
    if (!existingPermFetch?.permissions || !screensData?.data) return;

    const { permissions: saved } = existingPermFetch;
    const { newPermissions } = buildFromScreens(screensData.data);
    const merged: Permissions = { ...newPermissions };

    Object.keys(saved).forEach((screen) => {
      if (merged[screen]) {
        merged[screen] = {
          ...merged[screen],
          ...saved[screen],
          more: saved[screen]?.more ?? merged[screen].more,
        };
      }
    });

    setPermissions(merged);

    if (existingPermFetch.companies) setSelectedCompanies(existingPermFetch.companies);
    if (existingPermFetch.divisions) setSelectedDivisions(existingPermFetch.divisions);
    if (existingPermFetch.branches) setSelectedBranches(existingPermFetch.branches);
  }, [existingPermFetch, screensData]);

  // Clean up invalid divisions when companies change
  useEffect(() => {
    if (selectedCompanies.length > 0) {
      const validDivisionIds = getAvailableDivisions().map((d) => d.div_sno);
      setSelectedDivisions((prev) => prev.filter((id) => validDivisionIds.includes(id)));
    } else {
      setSelectedDivisions([]);
    }
  }, [selectedCompanies]);

  // Clean up invalid branches when divisions change
  useEffect(() => {
    if (selectedDivisions.length > 0) {
      const validBranchIds = getAvailableBranches().map((b) => b.brn_sno);
      setSelectedBranches((prev) => prev.filter((id) => validBranchIds.includes(id)));
    } else {
      setSelectedBranches([]);
    }
  }, [selectedDivisions]);

  // Build permission map from API
  useEffect(() => {
    if (permissionDetailsData?.data) {
      const map: Record<number, string> = {};
      permissionDetailsData.data.forEach((perm) => {
        map[perm.permission_id] = perm.permission_description;
      });
      setPermissionMap(map);
    }
  }, [permissionDetailsData]);

  // Safe toggle permission (handles missing screen entries)
  function togglePerm(screen: string, key: PermissionKeys) {
    setPermissions((curr) => {
      const currScreen = curr[screen] ?? createPermissionTemplate();
      const screenPermissions: Permission = { ...currScreen, more: Array.from(currScreen.more ?? []) };

      screenPermissions[key] = !screenPermissions[key];
      const othersTrue = permissionDetailsData?.data.slice(1).every((k) => screenPermissions[k.permission_id]);
      screenPermissions.fullAccess = othersTrue;
      // }

      return { ...curr, [screen]: screenPermissions };
    });
  }

  console.log(permissions)

  // Get available divisions for selected companies
  const getAvailableDivisions = (): Division[] => {
    if (selectedCompanies.length === 0 || !hierarchyFetchData?.data) return [];
    const divisions: Division[] = [];
    selectedCompanies.forEach((companyId) => {
      const company = hierarchyFetchData?.data.companies.find((c: { com_sno: string }) => c.com_sno === companyId);
      if (company) divisions.push(...company.divisions);
    });
    return divisions;
  };

  // Get available branches for selected divisions
  const getAvailableBranches = (): Branch[] => {
    if (selectedDivisions.length === 0) return [];
    const branches: Branch[] = [];
    selectedDivisions.forEach((divisionId) => {
      const allDivisions = getAvailableDivisions();
      const division = allDivisions.find((d) => d.div_sno === divisionId);
      if (division) branches.push(...division.branches);
    });
    return branches;
  };

  // Toggleers
  const toggleCompany = (companyId: string) =>
    setSelectedCompanies((prev) => (prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]));

  const toggleDivision = (divisionId: string) =>
    setSelectedDivisions((prev) => (prev.includes(divisionId) ? prev.filter((id) => id !== divisionId) : [...prev, divisionId]));

  const toggleBranch = (branchId: string) =>
    setSelectedBranches((prev) => (prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]));

  // Display name getters
  const getCompanyNames = () => {
    if (!hierarchyFetchData?.data) return [];
    return selectedCompanies
      .map((id) => hierarchyFetchData?.data?.companies.find((c: { com_sno: string }) => c.com_sno === id)?.com_name)
      .filter(Boolean) as string[];
  };

  const getDivisionNames = () => {
    const allDivisions = getAvailableDivisions();
    return selectedDivisions
      .map((id) => allDivisions.find((d) => d.div_sno === id)?.div_name)
      .filter(Boolean) as string[];
  };

  const getBranchNames = () => {
    const allBranches = getAvailableBranches();
    return selectedBranches
      .map((id) => allBranches.find((b) => b.brn_sno === id)?.brn_name)
      .filter(Boolean) as string[];
  };

  const handleSave = useCallback(async () => {
    if (!selectedUser) {
      alert("Please select a user first.");
      return;
    }


    const payload = {
      user_id: selectedUser,
      companies: selectedCompanies,
      divisions: selectedDivisions,
      branches: selectedBranches,
      permissions,
    };


    try {
      // postData will prepend baseURL if your usePost hook has VITE_API_BASE_URL
      // otherwise pass a full URL. Here we send a relative path which will be
      // prefixed by the hook's baseURL when available.
      const res = await postData(`${import.meta.env.VITE_API_URL}/api/user_approval/save_user_permissions`, payload);


      // If your backend returns { success: true, ... } this checks it
      if (res && (res as any).success) {
        alert("Permissions updated successfully!");
        // onSuccess?.();
      } else {
        console.error("Save failed response:", res);
        alert("Failed to update permissions");
      }
    } catch (err) {
      // usePost re-throws non-cancel errors so we still catch them here
      console.error("Error saving permissions:", err, "hookError:", err);
      alert("Error saving permissions");
    }
  }, [selectedUser, selectedCompanies, selectedDivisions, selectedBranches, permissions, postData]);

  // helper: safe boolean accessor for checkbox checked
  const permChecked = (screen?: string, key?: PermissionKeys) => {
    if (!screen || !key) return false;
    return !!(permissions?.[screen]?.[key]);
  };

  // safe check for "more" options
  // const permHasMore = (screen?: string, option?: string) => {
  //   if (!screen || !option) return false;
  //   return (permissions?.[screen]?.more ?? []).includes(option);
  // };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-full">
        <Card className="border-0 shadow-sm">
          <CardContent className="bg-white p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 md:mb-8">
              <CustomInputField
                field="user"
                label="Select User"
                type="select"
                options={userFetchData?.data?.map((u) => ({
                  label: u.ename + " (" + u.dept + ")",
                  value: u.nt_sign_up_sno,
                }))}
                value={selectedUser}
                onChange={setSelectedUser}
                placeholder="Choose a user..."
                className="w-full md:w-70"
              />
            </div>

            {selectedUser && (
              <>
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 md:mb-8">
                  <CustomInputField
                    field="companies"
                    label="Select Companies"
                    type="multi-select"
                    options={
                      hierarchyFetchData?.data?.companies?.map((c: { com_name: string; com_sno: number }) => ({
                        label: c.com_name,
                        value: c.com_sno,
                      })) ?? []
                    }
                    value={selectedCompanies}
                    onChange={setSelectedCompanies}
                    className="w-full md:w-70"
                  />
                </div>

                {selectedCompanies.length > 0 && (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 md:mb-8">
                      <CustomInputField
                        field="divisions"
                        label="Select Divisions"
                        type="multi-select"
                        options={getAvailableDivisions().map((d) => ({
                          label: d.div_name,
                          value: d.div_sno,
                        }))}
                        value={selectedDivisions}
                        onChange={setSelectedDivisions}
                        className="w-full md:w-70"
                      />
                    </div>
                  </>
                )}

                {selectedDivisions.length > 0 && (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 md:mb-8">
                      <CustomInputField
                        field="branches"
                        label="Select Branches"
                        type="multi-select"
                        options={getAvailableBranches().map((b) => ({
                          label: b.brn_name,
                          value: b.brn_sno,
                        }))}
                        value={selectedBranches}
                        onChange={setSelectedBranches}
                        className="w-full md:w-70"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {selectedUser && selectedCompanies.length > 0 && Object.keys(groups).length > 0 ? (
              <PermissionTable
                groups={groups}
                permissions={permissions}
                permChecked={permChecked}
                togglePerm={togglePerm}
                // setMorePermModal={setMorePermModal}
                handleSave={handleSave}
                permissionMap={permissionMap}
                permissionDetails={permissionDetailsData?.data ?? []}
              />
            ) : (
              <div className="text-center py-16 text-slate-400">
                <svg
                  className="mx-auto h-12 w-12 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <p className="text-sm">
                  {!selectedUser
                    ? "Select a user to manage their permissions"
                    : "Select at least one company to configure permissions"}
                </p>
              </div>
            )}

            {/* <Dialog open={morePermModal.open} onOpenChange={(v) => setMorePermModal({ open: v })}>
              <DialogContent className="max-w-xs sm:max-w-md w-[95vw]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-slate-800">Advanced Permissions</DialogTitle>
                  <p className="text-sm text-slate-500 mt-1">{morePermModal.screen}</p>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <Checkbox
                      checked={permHasMore(morePermModal.screen, "email")}
                      onCheckedChange={() => {
                        const s = morePermModal.screen || "";
                        setPermissions((p) => {
                          const has = (p[s]?.more ?? []).includes("email");
                          const currMore = p[s]?.more ?? [];
                          const nextMore = has ? currMore.filter((x) => x !== "email") : [...currMore, "email"];
                          return {
                            ...p,
                            [s]: {
                              ...(p[s] ?? createPermissionTemplate()),
                              more: nextMore,
                            },
                          };
                        });
                      }}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <div>
                      <div className="font-medium text-slate-700">Email</div>
                      <div className="text-xs text-slate-500">Send email notifications</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <Checkbox
                      checked={permHasMore(morePermModal.screen, "editApproved")}
                      onCheckedChange={() => {
                        const s = morePermModal.screen || "";
                        setPermissions((p) => {
                          const has = (p[s]?.more ?? []).includes("editApproved");
                          const currMore = p[s]?.more ?? [];
                          const nextMore = has ? currMore.filter((x) => x !== "editApproved") : [...currMore, "editApproved"];
                          return {
                            ...p,
                            [s]: {
                              ...(p[s] ?? createPermissionTemplate()),
                              more: nextMore,
                            },
                          };
                        });
                      }}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <div>
                      <div className="font-medium text-slate-700">Edit Approved Items</div>
                      <div className="text-xs text-slate-500">Modify approved {morePermModal.screen}</div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="border-t pt-4">
                  <DialogClose asChild>
                    <Button variant="outline" className="border-slate-200">Close</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
