import type React from "react";

// ---------------------------------------------------------------------------
// Generic component utilities
// ---------------------------------------------------------------------------

export type ReactChildren = React.ReactNode;
export type IconComponent = React.ComponentType<{ className?: string }>;

// ---------------------------------------------------------------------------
// View mode
// ---------------------------------------------------------------------------
export type ViewMode = "grid" | "list";

// ---------------------------------------------------------------------------
// Form field base shape (used in FieldDatas)
// ---------------------------------------------------------------------------
export interface FieldType {
  id: string;
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
  disabled?: boolean;
  colSpan?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Table column descriptor (used in DynamicTable)
// ---------------------------------------------------------------------------
export interface TableHeader {
  field: string;
  label: string;
  input?: boolean;
  view?: boolean;
  type?: string;
  require?: boolean;
  options?: { label: string; value: string | number }[];
}

// ---------------------------------------------------------------------------
// Modal / dialog state
// ---------------------------------------------------------------------------
export interface ModalState {
  open: boolean;
  mode: "add" | "edit" | "delete" | "view";
}
