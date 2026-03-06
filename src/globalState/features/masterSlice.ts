import { createSlice, PayloadAction } from '@reduxjs/toolkit'

/**
 * Types
 */
export type ViewMode = 'grid' | 'list'
export type Category = string | 'all'

export interface MasterDataState {
  searchTerm: string
  selectedCategory: Category
  viewMode: ViewMode
  currentScreen: string
  selectedMaster: any | null // replace with correct type if needed
}

export interface RootState {
  masterData: MasterDataState
}

/**
 * Initial State
 */
const initialState: MasterDataState = {
  searchTerm: '',
  selectedCategory: 'all',
  viewMode: 'grid',
  currentScreen: 'main',
  selectedMaster: null
}

/**
 * Slice
 */
const masterDataSlice = createSlice({
  name: 'masterData',
  initialState,
  reducers: {
    setSearchTerm(state, action: PayloadAction<string>) {
      state.searchTerm = action.payload
    },
    setSelectedCategory(state, action: PayloadAction<Category>) {
      state.selectedCategory = action.payload
    },
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload
    },
    setCurrentScreen(state, action: PayloadAction<string>) {
      state.currentScreen = action.payload
    },
    setSelectedMaster(state, action: PayloadAction<any>) {
      state.selectedMaster = action.payload
    }
  }
})

export const {
  setSearchTerm,
  setSelectedCategory,
  setViewMode,
  setCurrentScreen,
  setSelectedMaster
} = masterDataSlice.actions

/**
 * Selectors
 */
export const selectMasterData = (state: RootState) => state.masterData
export const selectSearchTerm = (state: RootState) => state.masterData.searchTerm
export const selectSelectedCategory = (state: RootState) => state.masterData.selectedCategory
export const selectViewMode = (state: RootState) => state.masterData.viewMode
export const selectCurrentScreen = (state: RootState) => state.masterData.currentScreen
export const selectSelectedMaster = (state: RootState) => state.masterData.selectedMaster

export default masterDataSlice.reducer
