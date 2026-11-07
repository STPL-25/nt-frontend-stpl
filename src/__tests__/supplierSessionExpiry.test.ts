import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import {
  supplierAxios,
  onSupplierSessionExpired,
  saveSupplierSession,
  loadSupplierSession,
  SUPPLIER_TOKEN_STORAGE_KEY,
} from '@/Services/SupplierService/base';

const PROFILE = { kyc_basic_info_sno: 122, supp_code: 'BOTH2601', company_name: 'NEO DIAMONDS', email: 'a@b.c' };

/** An adapter that answers every call with this HTTP status, the way axios reports it (a rejected request with .response). */
const replyWith = (status: number) => async (config: InternalAxiosRequestConfig) => {
  const error = Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config,
    response: { status, data: { success: false, error: 'nope' }, config },
  });
  throw error;
};

/** 'resolved' | 'rejected' | 'pending' (still nothing after a moment). */
const outcomeOf = (p: Promise<unknown>) =>
  Promise.race([
    p.then(() => 'resolved', () => 'rejected'),
    new Promise<string>((r) => setTimeout(() => r('pending'), 40)),
  ]);

describe('supplier portal: 401 means the session is over', () => {
  const originalAdapter = supplierAxios.defaults.adapter;
  let stop: () => void;
  const expired = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    saveSupplierSession('jwt-token', PROFILE);
    expired.mockClear();
    stop = onSupplierSessionExpired(expired);
  });
  afterEach(() => {
    stop();
    supplierAxios.defaults.adapter = originalAdapter;
  });

  it('a 401 on a signed-in call clears the session, tells the portal once, and gives the screen no error to show', async () => {
    supplierAxios.defaults.adapter = replyWith(401);
    const outcome = await outcomeOf(supplierAxios.get('/api/supplier/payments'));
    expect(outcome).toBe('pending'); // neither the screen's success nor its error (toast) handler runs
    expect(expired).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SUPPLIER_TOKEN_STORAGE_KEY)).toBeNull();
    expect(loadSupplierSession()).toBeNull();
  });

  it('also covers the notification bell calls (same axios instance)', async () => {
    supplierAxios.defaults.adapter = replyWith(401);
    expect(await outcomeOf(supplierAxios.get('/api/notifications/supplier'))).toBe('pending');
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('a 401 from the login call is a wrong password: the error still reaches the login screen and nothing is logged out', async () => {
    supplierAxios.defaults.adapter = replyWith(401);
    expect(await outcomeOf(supplierAxios.post('/api/supplier/login', { supp_code: 'X', password: 'bad' }))).toBe('rejected');
    expect(expired).not.toHaveBeenCalled();
    expect(loadSupplierSession()?.token).toBe('jwt-token');
  });

  it.each([400, 403, 404, 500])('a %i is an ordinary error: the screen still gets it and the session is kept', async (status) => {
    supplierAxios.defaults.adapter = replyWith(status);
    expect(await outcomeOf(supplierAxios.get('/api/supplier/pos'))).toBe('rejected');
    expect(expired).not.toHaveBeenCalled();
    expect(loadSupplierSession()?.token).toBe('jwt-token');
  });

  it('with no portal listening, a 401 is still passed to the caller (nothing would otherwise log the supplier out)', async () => {
    stop();
    supplierAxios.defaults.adapter = replyWith(401);
    expect(await outcomeOf(supplierAxios.get('/api/supplier/pos'))).toBe('rejected');
    expect(loadSupplierSession()).toBeNull();
  });

  it('stops notifying a listener once it has unsubscribed', async () => {
    stop();
    const other = vi.fn();
    const stopOther = onSupplierSessionExpired(other);
    supplierAxios.defaults.adapter = replyWith(401);
    await outcomeOf(supplierAxios.get('/api/supplier/pos'));
    expect(other).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    stopOther();
  });
});
