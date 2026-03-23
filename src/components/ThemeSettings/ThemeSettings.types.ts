import type React from "react";
import type { ThemeMode } from "@/globalState/features/themeSlice";

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface ThemeSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Option descriptors
// ---------------------------------------------------------------------------

export interface RadiusOption {
  label: string;
  value: number;
  /** CSS class applied to <html> for this radius */
  cls: string;
}

export interface ModeOption {
  id: ThemeMode;
  label: string;
  icon: React.ReactNode;
}
