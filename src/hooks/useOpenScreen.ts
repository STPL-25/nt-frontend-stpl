import { useCallback } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";

interface SidebarScreen {
  screen_id: number | string;
  screen_name: string;
  screen_comp: string | null;
  group_id?: number | string | null;
}

// useAppState() is loosely typed; only the pieces this hook needs are described.
interface NavState {
  data?: { screens?: SidebarScreen[] } | null;
  setActiveItem?: (item: string) => void;
  setActiveComponent?: (component: number | string) => void;
  setHeaderComponentRender?: (label: string) => void;
  setActiveGroupId?: (groupId: number | string | null | undefined) => void;
}

/**
 * Programmatically "click" a sidebar screen — same four state updates the sidebar's own
 * click handler makes. Returns a function that reports whether the screen exists in the
 * signed-in user's menu, so callers can tell the user they have no access instead of
 * silently doing nothing.
 */
export function useOpenScreen() {
  const {
    data: sidebarData,
    setActiveItem,
    setActiveComponent,
    setHeaderComponentRender,
    setActiveGroupId,
  } = useAppState() as unknown as NavState;

  return useCallback(
    (screenComp: string): boolean => {
      const screen = (sidebarData?.screens ?? []).find(
        (s) => s.screen_comp?.toLowerCase() === screenComp.toLowerCase()
      );
      if (!screen || !screen.screen_comp) return false;

      setActiveItem?.(screen.screen_comp);
      setActiveComponent?.(screen.screen_id);
      setHeaderComponentRender?.(screen.screen_name);
      setActiveGroupId?.(screen.group_id);
      return true;
    },
    [sidebarData, setActiveItem, setActiveComponent, setHeaderComponentRender, setActiveGroupId]
  );
}
