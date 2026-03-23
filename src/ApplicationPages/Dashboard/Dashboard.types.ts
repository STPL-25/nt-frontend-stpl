import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

export interface MainContentStyle {
  /** True when viewport width < 1024px */
  isMobile: boolean;
  sidebarWidth: number;
}

/** Return type of getMainContentStyle */
export type MainContentCSSProperties = Pick<
  CSSProperties,
  "marginLeft" | "width" | "transition"
>;
