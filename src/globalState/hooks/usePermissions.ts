import { useAppSelector } from "./useAppState";
import { selectSidebarData } from "../features/fetchSidebarDataSlice";
// permissions.types.ts  (or add to your slice types file)

export interface Permission {
  permission_id: number;
}

export interface Screen {
  screen_id:   number;
  screen_name: string;
  screen_comp: string;
  screen_img:  string;
  group_id:    number;
  permissions: Permission[];
}

export interface SidebarData {
  screens: Screen[];
}
/**
 * Permission IDs from the API:
 *  2 = View
 *  3 = Create
 *  4 = Edit
 *  5 = Delete
 */

export const PERM_VIEW   = 2;
export const PERM_CREATE = 3;
export const PERM_EDIT   = 4;
export const PERM_DELETE = 5;

export const usePermissions = () => {
  const sidebarData = useAppSelector(selectSidebarData);
  const screens = sidebarData?.screens ?? [];

  const getPermissionIds = (screenComp: string): number[] => {
    const screen = screens.find(
      (s:Screen) => s.screen_comp?.toLowerCase() === screenComp.toLowerCase()
    );
    return (screen?.permissions ?? []).map((p: any) => p.permission_id as number);
  };

  const hasPermission = (screenComp: string, permId: number): boolean =>
    getPermissionIds(screenComp).includes(permId);

  return {
    canView:   (screenComp: string) => hasPermission(screenComp, PERM_VIEW),
    canCreate: (screenComp: string) => hasPermission(screenComp, PERM_CREATE),
    canEdit:   (screenComp: string) => hasPermission(screenComp, PERM_EDIT),
    canDelete: (screenComp: string) => hasPermission(screenComp, PERM_DELETE),
    getPermissionIds,
  };
};
