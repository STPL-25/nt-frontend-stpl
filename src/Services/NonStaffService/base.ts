/**
 * Non-staff endpoint layer (backend-stpl /api/nonstaff).
 *
 * Non-staff sessions authenticate through the same session cookie as staff
 * (see ApplicationPages/SignIn.tsx + backend NonStaffUser.controller.js
 * login) and call these endpoints through the same global axios instance/
 * usePost/useFetch hooks employee pages already use — /api/nonstaff is
 * crypto-exempt at the gateway (gateway/index.js CRYPTO_EXEMPT_PATHS) so
 * those calls go through unencrypted, same as /api/secure.
 */
export const NONSTAFF_SERVICE_BASE: string = import.meta.env.VITE_API_URL || '';

export interface NonStaffProfile {
  login_id: string;
  full_name: string;
  email: string;
  designation_sno: number;
  designation_name: string;
  must_reset_password?: boolean;
}
