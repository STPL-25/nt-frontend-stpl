// ---------------------------------------------------------------------------
// Authenticated user shape (decrypted from JWT / Redux decode slice)
// ---------------------------------------------------------------------------
export interface UserData {
  ecno: string;
  ename: string;
  branch?: string;
  dept?: string;
  sign_up_cug?: string;
  com_sno?: number;
  div_sno?: number;
  brn_sno?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Decrypted token payload stored in Redux
// ---------------------------------------------------------------------------
export interface DecryptedPayload {
  token: string;
  user?: UserData | UserData[];
  iat?: number;
  exp?: number;
}

// ---------------------------------------------------------------------------
// localStorage token shape
// ---------------------------------------------------------------------------
export interface StoredToken {
  token: string;
  iv: string;
}
