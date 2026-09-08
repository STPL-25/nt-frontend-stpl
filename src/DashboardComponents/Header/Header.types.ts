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
  // Non-staff (temporary login) session shape — see NonStaffUser.service.js
  login_id?: string;
  full_name?: string;
  designation_name?: string;
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
