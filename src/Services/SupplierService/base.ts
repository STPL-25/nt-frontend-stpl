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
