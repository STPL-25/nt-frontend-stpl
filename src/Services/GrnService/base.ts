/**
 * Shared config for the grn-service API modules.
 *
 * Kept separate from index.ts so gateEntryApi/grnApi/inventoryApi can import
 * it without a circular dependency (index.ts re-exports those modules).
 *
 * Routing: by default all calls go to VITE_API_URL (the monolith / API
 * gateway), which bridges the session cookie to the microservice's
 * stateless `Authorization: Bearer <jwt>` auth and decrypts the { d, iv }
 * payload envelope. Set VITE_GRN_SERVICE_URL only when a gateway in front
 * of grn-service performs that bridging — the microservice itself expects
 * plain JSON + a bare JWT, which the browser does not hold.
 */

export const GRN_SERVICE_BASE: string =
  import.meta.env.VITE_API_URL || '';

/** Standard response envelope returned by every grn-service endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  count?: number;
}
