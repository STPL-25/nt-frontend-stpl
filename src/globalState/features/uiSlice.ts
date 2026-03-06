import { createSlice, PayloadAction } from '@reduxjs/toolkit'

/**
 * Types
 */
export interface UIState {
  sidebarOpen: boolean
  expandedItems: Record<string, boolean>
  activeItem: string
  activeComponent: string
  activeGroupId: string
  sidebarWidth: number
  isCollapsed: boolean
  headerComponentRender: string
  isFullscreen: boolean
}

export interface RootState {
  ui: UIState
}

/**
 * Initial state
 */
const initialState: UIState = {
  sidebarOpen: true,
  expandedItems: {},
  activeItem: 'masters',
  activeComponent: '',
  sidebarWidth: 280,
  isCollapsed: false,
  headerComponentRender: '',
  isFullscreen: false,
  activeGroupId: ''
}

/**
 * Slice
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    setExpandedItems: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.expandedItems = action.payload
    },
    setActiveItem: (state, action: PayloadAction<string>) => {
      state.activeItem = action.payload
    },
    setActiveComponent: (state, action: PayloadAction<string>) => {
      state.activeComponent = action.payload
    },
    setActiveGroupId: (state, action: PayloadAction<string>) => {
      state.activeGroupId = action.payload
    },
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = action.payload
    },
    toggleCollapse: (state) => {
      state.isCollapsed = !state.isCollapsed
      state.sidebarWidth = state.isCollapsed ? 80 : 280
    },
    setHeaderComponentRender: (state, action: PayloadAction<string>) => {
      state.headerComponentRender = action.payload
    },
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload
    }
  }
})

/**
 * Actions
 */
export const {
  setSidebarOpen,
  setExpandedItems,
  setActiveItem,
  setActiveComponent,
  setSidebarWidth,
  toggleCollapse,
  setHeaderComponentRender,
  setIsFullscreen,
  setActiveGroupId
} = uiSlice.actions

/**
 * Selectors
 */
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen
export const selectExpandedItems = (state: RootState) => state.ui.expandedItems
export const selectActiveItem = (state: RootState) => state.ui.activeItem
export const selectActiveComponent = (state: RootState) => state.ui.activeComponent
export const selectSidebarWidth = (state: RootState) => state.ui.sidebarWidth
export const selectIsCollapsed = (state: RootState) => state.ui.isCollapsed
export const selectHeaderComponentRender = (state: RootState) =>
  state.ui.headerComponentRender
export const selectIsFullscreen = (state: RootState) => state.ui.isFullscreen
export const selectActiveGroupId = (state: RootState) => state.ui.activeGroupId

export default uiSlice.reducer
