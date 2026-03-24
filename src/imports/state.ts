// ---------------------------------------------------------------------------
// State barrel — Redux selectors, actions, store types
//
// Usage:
//   import { useSelector, useDispatch, type RootState } from "@/imports/state";
// ---------------------------------------------------------------------------

export { useSelector, useDispatch } from "react-redux";
export type { RootState, AppDispatch } from "@/globalState/store";

// Theme slice
export {
  setThemeColor,
  setThemeMode,
  setThemeRadius,
  selectThemeColor,
  selectThemeMode,
  selectThemeRadius,
  THEME_COLORS,
} from "@/globalState/features/themeSlice";

// UI slice
export {
  setSidebarOpen,
  setActiveItem,
  setActiveComponent,
  setHeaderComponentRender,
  setIsFullscreen,
  toggleCollapse,
  setSidebarWidth,
  setActiveGroupId,
} from "@/globalState/features/uiSlice";

// Decode slice
export {
  initUser,
  clearDecryptedData,
  setUserData,
  selectUserData,
  selectDecryptedData,
  selectIsLoading,
  selectError,
} from "@/globalState/features/decodeSlice";
