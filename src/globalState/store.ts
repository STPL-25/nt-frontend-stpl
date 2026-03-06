import { configureStore } from '@reduxjs/toolkit'

// Reducers
import uiReducer from './features/uiSlice'
import hierarchyReducer from './features/hierarchySlice'
import formReducer from './features/formSlice'
import configReducer from './features/configSlice'
import masterDataReducer from './features/masterSlice'
import decodeReducer from './features/decodeSlice'
import hierarchyCompanyDetailsSlice from './features/hierarchyCompanyDetailsSlice'
import sidebarSlice from './features/fetchSidebarDataSlice'
import themeReducer from './features/themeSlice'

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    hierarchy: hierarchyReducer,
    form: formReducer,
    masterData: masterDataReducer,
    config: configReducer,
    decode: decodeReducer,
    hierarchyCompanyDetails: hierarchyCompanyDetailsSlice,
    sidebar: sidebarSlice,
    theme: themeReducer,
  }
})

/**
 * Types for the entire Redux store
 */
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
