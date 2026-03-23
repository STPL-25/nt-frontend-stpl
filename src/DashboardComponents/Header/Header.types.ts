import type React from "react";

// ---------------------------------------------------------------------------
// User data shapes (from Redux decode slice)
// ---------------------------------------------------------------------------

export interface UserInfo {
  ecno?: string;
  ename?: string;
  branch?: string;
  dept?: string;
  sign_up_cug?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Profile dialog field descriptor
// ---------------------------------------------------------------------------

export interface ProfileField {
  label: string;
  value: string | undefined;
  Icon: React.ComponentType<{ className?: string }>;
  /** Tailwind color token, e.g. "blue", "purple", "green" */
  color: string;
}
