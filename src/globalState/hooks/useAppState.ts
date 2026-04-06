
import { useEffect, useMemo } from "react"
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux"
import type { RootState, AppDispatch } from "../store"
import { socket, SOCKET_PERMISSIONS_UPDATED } from "../../Services/Socket"

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
  setActiveGroupId,
  setThemeSettingsOpen,
  selectThemeSettingsOpen,
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
  initUser,
  clearDecryptedData,
  clearError as clearDecodeErrorAction,
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
import { selectDeptDetails } from "../features/hierarchySlice"
import type { HierarchyResponse } from "../features/hierarchyCompanyDetailsSlice"
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
    activeGroupId: useAppSelector(selectActiveGroupId),
    themeSettingsOpen: useAppSelector(selectThemeSettingsOpen),
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
    isLoading: useAppSelector(selectIsLoading),
    error: useAppSelector(selectError),
    userData: useAppSelector(selectUserData)
  }

  // ---------- HIERARCHY COMPANY DETAILS ----------
  const hierarchyCompanyData = useAppSelector(selectCompanyHierarchy) as HierarchyResponse | null
  const deptDetails = useAppSelector(selectDeptDetails)
  const hierarchyCompany = {
    data: hierarchyCompanyData,
    loading: useAppSelector(selectCompanyHierarchyLoading),
    error: useAppSelector(selectCompanyHierarchyError)
  }

  // Flat option lists derived from the nested hierarchy for use in select fields
  const companyDetails = useMemo(
    () => (hierarchyCompanyData?.companies ?? []).map((c) => ({ value: c.com_sno, label: c.com_name })),
    [hierarchyCompanyData]
  )
  const divDetails = useMemo(
    () => (hierarchyCompanyData?.companies ?? []).flatMap((c) =>
      (c.divisions ?? []).map((d) => ({ value: d.div_sno, label: d.div_name }))
    ),
    [hierarchyCompanyData]
  )
  const branchDetails = useMemo(
    () => (hierarchyCompanyData?.companies ?? []).flatMap((c) =>
      (c.divisions ?? []).flatMap((d) =>
        (d.branches ?? []).map((b) => ({ value: b.brn_sno, label: b.brn_name }))
      )
    ),
    [hierarchyCompanyData]
  )

  // Filtered options based on current form selections (cascading dropdowns)
  const selectedComSno = form.formData?.com_sno
  const selectedDivSno = form.formData?.div_sno

  const filteredDivDetails = useMemo(() => {
    if (!selectedComSno) return divDetails
    const company = (hierarchyCompanyData?.companies ?? []).find(
      (c) => String(c.com_sno) === String(selectedComSno)
    )
    return (company?.divisions ?? []).map((d) => ({ value: d.div_sno, label: d.div_name }))
  }, [hierarchyCompanyData, selectedComSno, divDetails])

  const filteredBranchDetails = useMemo(() => {
    if (!selectedDivSno) return branchDetails
    const allDivisions = (hierarchyCompanyData?.companies ?? []).flatMap((c) => c.divisions ?? [])
    const division = allDivisions.find((d) => String(d.div_sno) === String(selectedDivSno))
    return (division?.branches ?? []).map((b) => ({ value: b.brn_sno, label: b.brn_name }))
  }, [hierarchyCompanyData, selectedDivSno, branchDetails])
  const sidebarData={
    data:useAppSelector(selectSidebarData),
    loading:useAppSelector(selectSidebarLoading),
    error:useAppSelector(selectSidebarError)
  }

  // ---------- AUTO FETCH (ONCE / CACHE AWARE) ----------
  // Only fetch hierarchy when the user is logged in — this is a protected
  // route and must NOT be called before authentication or it triggers a 401
  // which fires the session-expired modal incorrectly.
  const isLoggedIn = decode.userData && Object.keys(decode.userData).length > 0
  useEffect(() => {
    if (isLoggedIn) {
      dispatch(fetchHierarchy())
    }
  }, [isLoggedIn, dispatch])

  // ---------- SOCKET: AUTO-CONNECT AFTER LOGIN ----------------------------------------
  // Connect once the user data is populated (after login or session restore).
  // The session cookie is sent automatically with the WebSocket handshake — no
  // explicit token needed in socket.auth.
  useEffect(() => {
    const isLoggedIn = decode.userData && Object.keys(decode.userData).length > 0
    if (isLoggedIn) {
      if (!socket.connected) {
        socket.connect()
      }
    } else {
      if (socket.connected) {
        socket.disconnect()
      }
    }
  }, [decode.userData])

  // ---------- REAL-TIME: PERMISSIONS UPDATED ----------
  // When an admin updates this user's permissions, refresh sidebar data immediately
  useEffect(() => {
    if (!socket) return
    const handlePermissionsUpdated = () => {
      const ecno = Array.isArray(decode.userData) ? decode.userData[0]?.ecno : decode.userData?.ecno
      if (ecno) dispatch(fetchSidebarData(ecno))
    }
    socket.on(SOCKET_PERMISSIONS_UPDATED, handlePermissionsUpdated)
    return () => {
      socket.off(SOCKET_PERMISSIONS_UPDATED, handlePermissionsUpdated)
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
    companyDetails,
    divDetails,
    branchDetails,
    deptDetails,
    filteredDivDetails,
    filteredBranchDetails,
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
    setThemeSettingsOpen: (open: boolean) =>
      dispatch(setThemeSettingsOpen(open)),

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
    initUser: () => dispatch(initUser()),
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
