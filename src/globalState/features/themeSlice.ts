import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'rose' | 'amber' | 'indigo'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeColorConfig {
  id: ThemeColor
  label: string
  lightPrimary: string
  darkPrimary: string
  previewHex: string
}

export const THEME_COLORS: ThemeColorConfig[] = [
  { id: 'blue',   label: 'Blue',   lightPrimary: 'oklch(0.534 0.178 266.6)', darkPrimary: 'oklch(0.488 0.243 264.376)', previewHex: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', lightPrimary: 'oklch(0.490 0.230 270)',   darkPrimary: 'oklch(0.520 0.250 270)',     previewHex: '#6366f1' },
  { id: 'purple', label: 'Purple', lightPrimary: 'oklch(0.530 0.195 295)',   darkPrimary: 'oklch(0.490 0.240 295)',     previewHex: '#a855f7' },
  { id: 'teal',   label: 'Teal',   lightPrimary: 'oklch(0.510 0.155 190)',   darkPrimary: 'oklch(0.480 0.185 190)',     previewHex: '#14b8a6' },
  { id: 'green',  label: 'Green',  lightPrimary: 'oklch(0.510 0.175 145)',   darkPrimary: 'oklch(0.480 0.200 145)',     previewHex: '#22c55e' },
  { id: 'amber',  label: 'Amber',  lightPrimary: 'oklch(0.720 0.180 83)',    darkPrimary: 'oklch(0.780 0.195 83)',      previewHex: '#f59e0b' },
  { id: 'orange', label: 'Orange', lightPrimary: 'oklch(0.640 0.220 50)',    darkPrimary: 'oklch(0.600 0.230 50)',      previewHex: '#f97316' },
  { id: 'rose',   label: 'Rose',   lightPrimary: 'oklch(0.580 0.220 15)',    darkPrimary: 'oklch(0.620 0.240 15)',      previewHex: '#f43f5e' },
]

interface ThemeState {
  color: ThemeColor
  mode: ThemeMode
  radius: number
}

const loadStored = (): Partial<ThemeState> => {
  try {
    const raw = localStorage.getItem('nt-theme')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const stored = loadStored()

const initialState: ThemeState = {
  color: (stored.color as ThemeColor) ?? 'blue',
  mode: (stored.mode as ThemeMode) ?? 'system',
  radius: stored.radius ?? 0.625,
}

const persist = (state: ThemeState) => {
  try {
    localStorage.setItem('nt-theme', JSON.stringify(state))
  } catch { /* ignore */ }
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemeColor(state, action: PayloadAction<ThemeColor>) {
      state.color = action.payload
      persist({ ...state })
    },
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload
      persist({ ...state })
    },
    setThemeRadius(state, action: PayloadAction<number>) {
      state.radius = action.payload
      persist({ ...state })
    },
  },
})

export const { setThemeColor, setThemeMode, setThemeRadius } = themeSlice.actions

export const selectThemeColor  = (s: RootState) => s.theme.color
export const selectThemeMode   = (s: RootState) => s.theme.mode
export const selectThemeRadius = (s: RootState) => s.theme.radius

export default themeSlice.reducer
