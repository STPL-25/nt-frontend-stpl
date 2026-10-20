import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'rose' | 'amber' | 'indigo' | 'sky' | 'cyan' | 'emerald' | 'lime' | 'pink' | 'fuchsia' | 'red' | 'slate' | 'mint' | 'peach' | 'lavender' | 'babyblue' | 'blush' | 'lemon' | 'sage' | 'aqua'
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

export interface ThemeFontConfig {
  id: string
  label: string
  /** Google Fonts family query value (null = system default stack) */
  google: string | null
  stack: string
}

const SANS_FALLBACK = "ui-sans-serif, system-ui, sans-serif"

export const THEME_FONTS: ThemeFontConfig[] = [
  { id: 'default',    label: 'System Default', google: null,                         stack: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'" },
  { id: 'inter',      label: 'Inter',          google: 'Inter:wght@400;500;600;700',  stack: `'Inter', ${SANS_FALLBACK}` },
  { id: 'roboto',     label: 'Roboto',         google: 'Roboto:wght@400;500;700',     stack: `'Roboto', ${SANS_FALLBACK}` },
  { id: 'poppins',    label: 'Poppins',        google: 'Poppins:wght@400;500;600;700', stack: `'Poppins', ${SANS_FALLBACK}` },
  { id: 'open-sans',  label: 'Open Sans',      google: 'Open+Sans:wght@400;500;600;700', stack: `'Open Sans', ${SANS_FALLBACK}` },
  { id: 'lato',       label: 'Lato',           google: 'Lato:wght@400;700',           stack: `'Lato', ${SANS_FALLBACK}` },
  { id: 'montserrat', label: 'Montserrat',     google: 'Montserrat:wght@400;500;600;700', stack: `'Montserrat', ${SANS_FALLBACK}` },
  { id: 'nunito',     label: 'Nunito',         google: 'Nunito:wght@400;500;600;700', stack: `'Nunito', ${SANS_FALLBACK}` },
  { id: 'dm-sans',    label: 'DM Sans',        google: 'DM+Sans:wght@400;500;600;700', stack: `'DM Sans', ${SANS_FALLBACK}` },
  { id: 'source-sans', label: 'Source Sans 3', google: 'Source+Sans+3:wght@400;500;600;700', stack: `'Source Sans 3', ${SANS_FALLBACK}` },
  { id: 'work-sans',  label: 'Work Sans',      google: 'Work+Sans:wght@400;500;600;700', stack: `'Work Sans', ${SANS_FALLBACK}` },
  { id: 'merriweather', label: 'Merriweather (Serif)', google: 'Merriweather:wght@400;700', stack: "'Merriweather', Georgia, serif" },
]

export const THEME_FONT_SIZES = [
  { id: 'sm',      label: 'Small',   percent: 87.5 },
  { id: 'default', label: 'Default', percent: 100 },
  { id: 'lg',      label: 'Large',   percent: 112.5 },
  { id: 'xl',      label: 'X-Large', percent: 125 },
]

interface ThemeState {
  color: ThemeColor
  mode: ThemeMode
  radius: number
  font: string
  fontSize: string
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
  mode: (stored.mode as ThemeMode) ?? 'light',
  radius: stored.radius ?? 0.625,
  font: THEME_FONTS.some((f) => f.id === stored.font) ? (stored.font as string) : 'default',
  fontSize: THEME_FONT_SIZES.some((f) => f.id === stored.fontSize) ? (stored.fontSize as string) : 'default',
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
    setThemeFont(state, action: PayloadAction<string>) {
      state.font = action.payload
      persist({ ...state })
    },
    setThemeFontSize(state, action: PayloadAction<string>) {
      state.fontSize = action.payload
      persist({ ...state })
    },
  },
})

export const { setThemeColor, setThemeMode, setThemeRadius, setThemeFont, setThemeFontSize } = themeSlice.actions

export const selectThemeColor  = (s: RootState) => s.theme.color
export const selectThemeMode   = (s: RootState) => s.theme.mode
export const selectThemeRadius = (s: RootState) => s.theme.radius
export const selectThemeFontSize = (s: RootState) => s.theme.fontSize
export const selectThemeFont   = (s: RootState) => s.theme.font

export default themeSlice.reducer
