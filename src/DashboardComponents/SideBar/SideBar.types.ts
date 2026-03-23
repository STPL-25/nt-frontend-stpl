import type React from "react";

// ---------------------------------------------------------------------------
// Primitive / icon types
// ---------------------------------------------------------------------------

export type IconComponent = React.ComponentType<{ className?: string }>;

// ---------------------------------------------------------------------------
// API / data shapes (as returned by the sidebar endpoint)
// ---------------------------------------------------------------------------

export interface Screen {
  screen_id: number;
  screen_name: string;
  screen_comp: string | null;
  screen_img: string | null;
  group_id?: number;
  permissions?: unknown[];
}

export interface PermissionData {
  screens: Screen[];
}

// ---------------------------------------------------------------------------
// Derived / UI-only types
// ---------------------------------------------------------------------------

export interface MenuItem {
  id: string | null;
  key: string;
  label: string;
  icon: IconComponent;
  screenId: number;
  groupId?: string | number;
}

export interface HandleClickParams {
  key: string;
  label: string;
  screenId: number;
  groupId: string;
}
