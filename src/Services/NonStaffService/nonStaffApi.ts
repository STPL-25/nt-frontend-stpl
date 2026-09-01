import { NONSTAFF_SERVICE_BASE } from './base';

const userBase = `${NONSTAFF_SERVICE_BASE}/api/nonstaff`;

export const nonStaffLogin = `${userBase}/login`;
export const nonStaffResetPassword = `${userBase}/reset-password`;
export const nonStaffMe = `${userBase}/me`;
