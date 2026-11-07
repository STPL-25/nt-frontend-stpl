/**
 * Supplier portal API layer (grn-service /api/supplier, port 8084).
 *
 * Deliberately separate from the internal app's global `axios` instance
 * (frontend/src/main.tsx): the supplier portal authenticates with its own
 * Bearer JWT (stored in localStorage, not the internal session cookie) and
 * is crypto-exempt at the gateway (see gateway/index.js CRYPTO_EXEMPT_PATHS),
 * so it must not go through the internal encrypted-payload interceptors.
 */
import axios from 'axios';

export const SUPPLIER_SERVICE_BASE: string = import.meta.env.VITE_API_URL || '';

export const SUPPLIER_TOKEN_STORAGE_KEY = 'supplier_portal_token';
export const SUPPLIER_PROFILE_STORAGE_KEY = 'supplier_portal_profile';

export const supplierAxios = axios.create({ baseURL: SUPPLIER_SERVICE_BASE });

supplierAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem(SUPPLIER_TOKEN_STORAGE_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Session expiry ──────────────────────────────────────────────────────────────────────────────────────
// Every supplier endpoint except login sits behind the supplier JWT check, so a 401 from one of them means the session has
// expired or is no longer valid. The portal logs the supplier out (back to the login screen) instead of showing an error:
// the 401 is NOT passed on to the screen that made the call, so no "Failed to load ..." toast follows. The login call is
// left alone - there a 401 only means "wrong supplier code or password", which the login screen must still show.
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();
const SUPPLIER_LOGIN_PATH = '/api/supplier/login';

/** Runs `listener` when the server rejects the supplier's session (401). Returns the function that stops listening. */
export function onSupplierSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => { sessionExpiredListeners.delete(listener); };
}

supplierAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? '');
    if (status !== 401 || url.endsWith(SUPPLIER_LOGIN_PATH)) return Promise.reject(error);

    clearSupplierSession();
    // Nobody to take the supplier to the login screen (the portal is not mounted): let the caller see the error as before.
    if (sessionExpiredListeners.size === 0) return Promise.reject(error);
    sessionExpiredListeners.forEach((listener) => listener());
    // Deliberately never settles: the portal is switching to the login screen and the calling screen is being unmounted, so
    // there is nothing for its success or error handler to do - and its error handler would only toast.
    return new Promise(() => {});
  },
);

/** Standard response envelope returned by every grn-service endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface SupplierProfile {
  kyc_basic_info_sno: number;
  supp_code: string | null;
  company_name: string | null;
  email: string;
}

export function saveSupplierSession(token: string, supplier: SupplierProfile): void {
  localStorage.setItem(SUPPLIER_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(SUPPLIER_PROFILE_STORAGE_KEY, JSON.stringify(supplier));
}

export function loadSupplierSession(): { token: string; supplier: SupplierProfile } | null {
  const token = localStorage.getItem(SUPPLIER_TOKEN_STORAGE_KEY);
  const rawProfile = localStorage.getItem(SUPPLIER_PROFILE_STORAGE_KEY);
  if (!token || !rawProfile) return null;
  try {
    return { token, supplier: JSON.parse(rawProfile) as SupplierProfile };
  } catch {
    return null;
  }
}

export function clearSupplierSession(): void {
  localStorage.removeItem(SUPPLIER_TOKEN_STORAGE_KEY);
  localStorage.removeItem(SUPPLIER_PROFILE_STORAGE_KEY);
}
