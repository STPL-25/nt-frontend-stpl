// ---------------------------------------------------------------------------
// Theme types — mirrors themeSlice definitions
// ---------------------------------------------------------------------------

export type ThemeColor =
  | "blue"
  | "indigo"
  | "purple"
  | "teal"
  | "green"
  | "amber"
  | "orange"
  | "rose"
  | "sky"
  | "cyan"
  | "emerald"
  | "lime"
  | "pink"
  | "fuchsia"
  | "red"
  | "slate"
  | "mint"
  | "peach"
  | "lavender"
  | "babyblue"
  | "blush"
  | "lemon"
  | "sage"
  | "aqua";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeState {
  color: ThemeColor;
  mode: ThemeMode;
  radius: number;
}

export interface ThemeColorConfig {
  id: ThemeColor;
  label: string;
  previewHex: string;
  lightPrimary: string;
  darkPrimary: string;
}
