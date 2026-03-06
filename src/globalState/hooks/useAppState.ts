
import { useEffect } from "react"
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux"
import type { RootState, AppDispatch } from "../store"
import {socket} from"../../Services/Socket"

// ================= UI =================
import {
  setSidebarOpen,
  setExpandedItems,
  setActiveItem,
  setActiveComponent,
  setSidebarWidth,
  toggleCollapse,
  setHeaderComponentRender,
  setIsFullscreen,
  selectSidebarOpen,
  selectExpandedItems,
  selectActiveItem,
  selectActiveComponent,
  selectSidebarWidth,
  selectIsCollapsed,
  selectHeaderComponentRender,
  selectIsFullscreen,
  selectActiveGroupId,
  setActiveGroupId
} from "../features/uiSlice"

// ================= FORM =================
import {
  setFormData,
  clearFormErrors,
  setFormError,
  resetForm,
  selectFormData,
  selectFormErrors
} from "../features/formSlice"

// ================= MASTER =================
import {
  setSearchTerm,
  setSelectedCategory,
  setViewMode,
  setCurrentScreen,
  setSelectedMaster,
  selectSearchTerm,
  selectCurrentScreen,
  selectSelectedCategory,
  selectViewMode,
  selectSelectedMaster
} from "../features/masterSlice"

// ================= CONFIG =================
import { selectConfig } from "../features/configSlice"

// ================= DECODE =================
import {
  decryptData,
  clearDecryptedData,
  clearError as clearDecodeErrorAction,
  selectDecryptedData,
  selectIsLoading,
  selectError,
  selectUserData,
  setUserData
} from "../features/decodeSlice"

// ================= HIERARCHY COMPANY DETAILS =================
import {
  fetchHierarchy,
  clearHierarchy,
  selectCompanyHierarchy,
  selectCompanyHierarchyLoading,
  selectCompanyHierarchyError
} from "../features/hierarchyCompanyDetailsSlice"
import {fetchSidebarData,clearSidebarData,selectSidebarData,selectSidebarLoading,selectSidebarError} from "../features/fetchSidebarDataSlice"
// ================= TYPED HOOKS =================
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// ================= MAIN HOOK =================
export const useAppState = () => {
  const dispatch = useAppDispatch()

  // ---------- UI ----------
  const ui = {
    sidebarOpen: useAppSelector(selectSidebarOpen),
    expandedItems: useAppSelector(selectExpandedItems),
    activeItem: useAppSelector(selectActiveItem),
    activeComponent: useAppSelector(selectActiveComponent),
    sidebarWidth: useAppSelector(selectSidebarWidth),
    isCollapsed: useAppSelector(selectIsCollapsed),
    headerComponentRender: useAppSelector(selectHeaderComponentRender),
    isFullscreen: useAppSelector(selectIsFullscreen),
    activeGroupId: useAppSelector(selectActiveGroupId)
  }

  // ---------- FORM ----------
  const form = {
    formData: useAppSelector(selectFormData),
    errors: useAppSelector(selectFormErrors)
  }

  // ---------- MASTER ----------
  const master = {
    searchTerm: useAppSelector(selectSearchTerm),
    selectedCategory: useAppSelector(selectSelectedCategory),
    viewMode: useAppSelector(selectViewMode),
    currentScreen: useAppSelector(selectCurrentScreen),
    selectedMaster: useAppSelector(selectSelectedMaster)
  }

  // ---------- CONFIG ----------
  const config = useAppSelector(selectConfig)

  // ---------- DECODE ----------
  const decode = {
    decryptedData: useAppSelector(selectDecryptedData),
    isLoading: useAppSelector(selectIsLoading),
    error: useAppSelector(selectError),
    userData: useAppSelector(selectUserData)
  }

  // ---------- HIERARCHY COMPANY DETAILS ----------
  const hierarchyCompany = {
    data: useAppSelector(selectCompanyHierarchy),
    loading: useAppSelector(selectCompanyHierarchyLoading),
    error: useAppSelector(selectCompanyHierarchyError)
  }
  const sidebarData={
    data:useAppSelector(selectSidebarData),
    loading:useAppSelector(selectSidebarLoading),
    error:useAppSelector(selectSidebarError)
  }

  // ---------- AUTO FETCH (ONCE / CACHE AWARE) ----------
  useEffect(() => {
    if (!hierarchyCompany.data && !hierarchyCompany.loading) {
      dispatch(fetchHierarchy())
    }
  }, [dispatch])

  // ---------- SOCKET: AUTO-CONNECT WITH JWT ----------------------------------------
  // Watch decryptedData — when it contains a JWT token (after login or page reload)
  // connect the socket with that token.  Disconnect when the token is cleared (logout).
  useEffect(() => {
    const jwtToken = decode.decryptedData?.token
    if (jwtToken) {
      if (!socket.connected) {
        socket.auth = { token: jwtToken }
        socket.connect()
      }
    } else {
      if (socket.connected) {
        socket.disconnect()
      }
    }
  }, [decode.decryptedData])

  // ---------- REAL-TIME: PERMISSIONS UPDATED ----------
  // When an admin updates this user's permissions, refresh sidebar data immediately
  useEffect(() => {
    if (!socket) return
    const handlePermissionsUpdated = () => {
      const ecno = Array.isArray(decode.userData) ? decode.userData[0]?.ecno : decode.userData?.ecno
      if (ecno) dispatch(fetchSidebarData(ecno))
    }
    socket.on("permissions:updated", handlePermissionsUpdated)
    return () => {
      socket.off("permissions:updated", handlePermissionsUpdated)
    }
  }, [socket, decode.userData, dispatch])

  return {
    // ===== STATE =====
    ...ui,
    ...form,
    ...master,
    ...decode,
    ...hierarchyCompany,
    ...sidebarData,
    config,
    socket,

    // ===== UI ACTIONS =====
    setSidebarOpen: (value: boolean) => dispatch(setSidebarOpen(value)),
    setExpandedItems: (items: Record<string, boolean>) =>
      dispatch(setExpandedItems(items)),
    setActiveItem: (item: string) => dispatch(setActiveItem(item)),
    setActiveComponent: (component: string) =>
      dispatch(setActiveComponent(component)),
    setSidebarWidth: (width: number) => dispatch(setSidebarWidth(width)),
    toggleCollapse: () => dispatch(toggleCollapse()),
    setHeaderComponentRender: (component: string) =>
      dispatch(setHeaderComponentRender(component)),
    setActiveGroupId: (groupId: string) =>
      dispatch(setActiveGroupId(groupId)),
    setIsFullscreen: (fullscreen: boolean) =>
      dispatch(setIsFullscreen(fullscreen)),

    // ===== FORM ACTIONS =====
    setFormData: (data: any) => dispatch(setFormData(data)),
    clearFormErrors: () => dispatch(clearFormErrors()),
    setFormError: (error: Record<string, string>) =>
      dispatch(setFormError(error)),
    resetForm: () => dispatch(resetForm()),

    // ===== MASTER ACTIONS =====
    setSearchTerm: (term: string) => dispatch(setSearchTerm(term)),
    setSelectedCategory: (category: string) =>
      dispatch(setSelectedCategory(category)),
    setViewMode: (mode: "grid" | "list") =>
      dispatch(setViewMode(mode)),
    setCurrentScreen: (screen: string) =>
      dispatch(setCurrentScreen(screen)),
    setSelectedMaster: (master: any) =>
      dispatch(setSelectedMaster(master)),

    // ===== DECODE ACTIONS =====
    decryptData: (payload: any) => dispatch(decryptData(payload)),
    clearDecryptedData: () => dispatch(clearDecryptedData()),
    clearDecodeError: () => dispatch(clearDecodeErrorAction()),
    setUserData: (data: any) => dispatch(setUserData(data)),

    // ===== HIERARCHY ACTIONS =====
    fetchCompanyHierarchy: () => dispatch(fetchHierarchy()),
    clearCompanyHierarchy: () => dispatch(clearHierarchy()),

    // ===== SIDEBAR ACTIONS =====
    fetchSidebarData: (ecno:string) => dispatch(fetchSidebarData(ecno)),
    clearSidebarData: () => dispatch(clearSidebarData()),
  }
}
