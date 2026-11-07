import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KYC } from './supplierKycFixture';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/Services/SupplierService', async () => {
  const actual = await vi.importActual<any>('@/Services/SupplierService/supplierApi');
  return {
    ...actual,
    SUPPLIER_SERVICE_BASE: '',
    supplierAxios: { get: h.get, post: h.post },
    supplierKyc: '/api/supplier/kyc',
    supplierKycModify: '/api/supplier/kyc/modify',
    supplierKycWithdraw: '/api/supplier/kyc/withdraw',
  };
});

import SupplierMyKyc from '@/Application/SupplierPortal/SupplierMyKyc';

const choices = {
  business_types: [{ value: '1', label: 'Sole Proprietorship' }, { value: '2', label: 'Partnership' }],
  account_types: [{ value: '1', label: 'Savings' }, { value: '2', label: 'Current' }],
};
const change = {
  kyc_modified_sno: 1, version_no: 1, reason: 'Moved our office', changed_sections: 'ADDRESS,BANK', source: 'SUPPLIER_PORTAL',
  modified_by: 'r@acme.com', modified_date: '2026-10-20T09:30:00.000Z',
  old_data: { basic: { ...KYC.basic, company_name: 'ACME OLD' }, payment: KYC.payment, addresses: KYC.addresses, banks: KYC.banks, contacts: KYC.contacts, documents: [] },
  new_data: { basic: KYC.basic, payment: KYC.payment, addresses: KYC.addresses, banks: KYC.banks, contacts: KYC.contacts, documents: [] },
  files: [{ file_kind: 'AUTHORIZATION', file_name: 'letter.pdf', file_path: 'http://localhost:8001/dwl/NON_TRADE_DATAS/KYC_MODIFICATIONS/letter.pdf', file_size: 10, uploaded_date: '2026-10-20T09:30:00.000Z' }],
};

const load = (history: unknown[] = [], kyc: unknown = KYC) => h.get.mockResolvedValue({ data: { data: { kyc, history, ...choices } } });

// A request waiting at stage 1 of 2 (sql/93): the KYC shows the OLD values; the request carries what was asked for.
const pendingKyc = { ...KYC, pending_sno: 5, pending_version: 2, pending_stage_no: 1, pending_stage_total: 2, pending_stage_name: 'Store Incharge', pending_since: '2026-11-07T04:00:00.000Z' };
const waiting = {
  ...change, kyc_modified_sno: 5, version_no: 2, reason: 'New contact person', changed_sections: 'BASIC', status: 'P', stage_no: 1, stage_total: 2, stage_name: 'Store Incharge',
  decided_date: null, decision_note: null, approvals: [], new_data: { ...change.new_data, basic: { ...KYC.basic, company_name: 'ACME ASKED FOR' } },
};
const open = async () => {
  const user = userEvent.setup();
  render(<SupplierMyKyc />);
  await screen.findByRole('button', { name: /Edit details/ });
  return user;
};
const edit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Edit details/ }));
  await screen.findByText(/Authorization$/);
};

beforeEach(() => {
  vi.restoreAllMocks(); // drops the window.confirm spies of the previous test
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo; // jsdom does not implement it
  h.get.mockReset();
  h.post.mockReset();
});

describe('SupplierMyKyc - viewing', () => {
  it('shows only what is on file for the logged-in supplier, with the master names', async () => {
    load();
    await open();
    expect(h.get).toHaveBeenCalledWith('/api/supplier/kyc');
    expect(screen.getByText('Supplier code SUP55 · Packaging')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Partnership')).toBeInTheDocument(); // business type id 2 shown by name
    expect(screen.getByText('33ABCDE1234F1Z5')).toBeInTheDocument();
    expect(screen.getByText('123456789012')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText(/1, Mill Rd, RS Puram, Coimbatore, Tamil Nadu, 641001/)).toBeInTheDocument();
    expect(screen.getByText('You have not asked to change your KYC yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('kyc-pending-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit details/ })).toBeEnabled();
  });

  it('points a document link at this app’s API origin', async () => {
    load();
    await open();
    expect(screen.getByRole('link', { name: /pan\.pdf/ })).toHaveAttribute('href', '/dwl/NON_TRADE_DATAS/KYC_DATAS/pan.pdf');
  });

  it('lists the changes made, with the authorization letter and the details as they were', async () => {
    load([change]);
    const user = await open();
    const card = screen.getByTestId('kyc-change');
    expect(within(card).getByText('Request 1')).toBeInTheDocument();
    expect(within(card).getByText('Approved')).toBeInTheDocument(); // a change from before approval stages existed counts as applied
    expect(within(card).getByText('Addresses')).toBeInTheDocument();
    expect(within(card).getByText('Bank accounts')).toBeInTheDocument();
    expect(within(card).getByText('Moved our office')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'letter.pdf' })).toHaveAttribute('href', '/dwl/NON_TRADE_DATAS/KYC_MODIFICATIONS/letter.pdf');
    await user.click(within(card).getByText('Show your details before this change'));
    expect(within(card).getByText('ACME OLD')).toBeInTheDocument();
  });

  it('a request waiting for approval: banner with the stage, Edit is disabled, the request shows what was asked for', async () => {
    load([waiting], pendingKyc);
    const user = await open();
    const banner = screen.getByTestId('kyc-pending-banner');
    expect(within(banner).getByText('Your change request 2 is waiting for approval')).toBeInTheDocument();
    expect(within(banner).getByText(/Stage 1 of 2 \(Store Incharge\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit details/ })).toBeDisabled();
    // the KYC itself still shows the OLD (live) values
    expect(screen.getAllByText('ACME').length).toBeGreaterThan(0);

    const card = screen.getByTestId('kyc-change');
    expect(within(card).getByText('Waiting for approval')).toBeInTheDocument();
    await user.click(within(card).getByText('Show the details you asked for'));
    expect(within(card).getByText('ACME ASKED FOR')).toBeInTheDocument();
  });

  it('withdraws the waiting request after a confirmation, then reloads', async () => {
    load([waiting], pendingKyc);
    h.post.mockResolvedValue({ data: { message: 'Your request has been withdrawn', data: { status: 'C' } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await open();
    await user.click(screen.getByRole('button', { name: /Withdraw request/ }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith('/api/supplier/kyc/withdraw', { kyc_modified_sno: 5 }));
    await waitFor(() => expect(h.get).toHaveBeenCalledTimes(2));
  });

  it('does not withdraw when the supplier says no', async () => {
    load([waiting], pendingKyc);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await open();
    await user.click(screen.getByRole('button', { name: /Withdraw request/ }));
    expect(h.post).not.toHaveBeenCalled();
  });

  it('a rejected request shows the reason and that the KYC was not changed; the supplier can ask again', async () => {
    const rejected = { ...waiting, status: 'R', decided_date: '2026-11-08T05:00:00.000Z', decision_note: 'Letter is not signed', approvals: [{ seq_no: 1, stage_name: 'Store Incharge', action: 'R', note: 'Letter is not signed', acted_date: '2026-11-08T05:00:00.000Z' }] };
    load([rejected]);
    await open();
    const card = screen.getByTestId('kyc-change');
    expect(within(card).getAllByText('Rejected').length).toBeGreaterThanOrEqual(2); // the status, the callout (and the stage in the trail)
    expect(card).toHaveTextContent('Letter is not signed');
    expect(card).toHaveTextContent('Your KYC was not changed - you can make the change again');
    expect(screen.getByRole('button', { name: /Edit details/ })).toBeEnabled();
  });

  it('an approved request lists who approved it at each stage', async () => {
    const approved = { ...change, status: 'A', stage_no: 2, stage_total: 2, decided_date: '2026-10-21T09:00:00.000Z',
      approvals: [{ seq_no: 1, stage_name: 'Store Incharge', action: 'A', note: 'ok', acted_date: '2026-10-21T08:00:00.000Z' }, { seq_no: 2, stage_name: 'GM', action: 'A', note: null, acted_date: '2026-10-21T09:00:00.000Z' }] };
    load([approved]);
    await open();
    const card = screen.getByTestId('kyc-change');
    expect(within(card).getByText('Store Incharge')).toBeInTheDocument();
    expect(within(card).getByText('GM')).toBeInTheDocument();
    expect(within(card).getAllByText('Approved').length).toBeGreaterThanOrEqual(3); // the status + the two stages
  });

  it('a withdrawn request is listed as withdrawn', async () => {
    load([{ ...waiting, status: 'C', decided_date: '2026-11-08T05:00:00.000Z', decision_note: 'Withdrawn by the supplier' }]);
    await open();
    expect(screen.getByTestId('kyc-change')).toHaveTextContent('You withdrew this request');
    expect(within(screen.getByTestId('kyc-change')).getByText('Withdrawn')).toBeInTheDocument();
  });

  it('shows the server’s message and a retry when the KYC cannot be loaded', async () => {
    h.get.mockRejectedValue({ response: { data: { error: 'Your KYC record was not found. Please contact the purchase team.' } } });
    render(<SupplierMyKyc />);
    expect(await screen.findByText('Your KYC record was not found. Please contact the purchase team.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('SupplierMyKyc - changing', () => {
  const letter = () => new File(['%PDF'], 'letter.pdf', { type: 'application/pdf' });

  it('will not submit a form with nothing changed', async () => {
    load();
    const user = await open();
    await edit(user);
    await user.click(screen.getByRole('button', { name: /Submit for approval/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing has changed yet');
    expect(h.post).not.toHaveBeenCalled();
  });

  it('asks for the reason, then for the authorization letter, before anything is sent', async () => {
    load();
    const user = await open();
    await edit(user);
    const person = screen.getByLabelText(/Contact person/);
    await user.clear(person);
    await user.type(person, 'Ravi Kumar');
    expect(screen.getByText(/You are changing:/)).toHaveTextContent('company details');

    await user.click(screen.getByRole('button', { name: /Submit for approval/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tell us why these details are changing.');

    await user.type(screen.getByLabelText(/Why are these details changing/), 'New contact');
    await user.click(screen.getByRole('button', { name: /Submit for approval/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Attach the signed authorization letter');
    expect(h.post).not.toHaveBeenCalled();
  });

  it('sends the payload, the letter and a new document, then returns to the refreshed KYC', async () => {
    load();
    h.post.mockResolvedValue({ data: { message: 'Your KYC has been updated', data: { version_no: 1 } } });
    const user = await open();
    await edit(user);

    const person = screen.getByLabelText(/Contact person/);
    await user.clear(person);
    await user.type(person, 'Ravi Kumar');
    await user.type(screen.getByLabelText(/Why are these details changing/), 'New contact');
    await user.upload(screen.getByLabelText(/Authorization letter/), letter());
    await user.upload(screen.getByLabelText(/GST certificate/), new File(['%PDF'], 'gst.pdf', { type: 'application/pdf' }));
    expect(screen.getByText(/You are changing:/)).toHaveTextContent('company details and documents');

    await user.click(screen.getByRole('button', { name: /Submit for approval/ }));
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1));

    const [url, body] = h.post.mock.calls[0] as [string, FormData];
    expect(url).toBe('/api/supplier/kyc/modify');
    const payload = JSON.parse(String(body.get('payload')));
    expect(payload.snapshot_hash).toBe(KYC.snapshot_hash);
    expect(payload.reason).toBe('New contact');
    expect(payload.basic.contact_person).toBe('Ravi Kumar');
    expect(payload.addresses).toHaveLength(2);
    expect(payload.banks[0].kyc_bank_sno).toBe(3);
    expect((body.getAll('authorization_file') as File[]).map((f) => f.name)).toEqual(['letter.pdf']);
    expect((body.get('doc_gst_file') as File).name).toBe('gst.pdf');

    // back to the (reloaded) read-only KYC
    await screen.findByRole('button', { name: /Edit details/ });
    expect(h.get).toHaveBeenCalledTimes(2);
  });

  it('keeps the form and shows the server’s message when the save is refused', async () => {
    load();
    h.post.mockRejectedValue({ response: { data: { error: 'Address 1: the pincode is not valid (6 digits).' } } });
    const user = await open();
    await edit(user);
    const pin = screen.getAllByLabelText(/Pincode/)[0];
    await user.clear(pin);
    await user.type(pin, '12');
    await user.type(screen.getByLabelText(/Why are these details changing/), 'Fix pincode');
    await user.upload(screen.getByLabelText(/Authorization letter/), letter());
    await user.click(screen.getByRole('button', { name: /Submit for approval/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Address 1: the pincode is not valid (6 digits).');
    expect(screen.getByRole('button', { name: /Submit for approval/ })).toBeEnabled();
    expect(h.get).toHaveBeenCalledTimes(1); // not reloaded
  });

  it('switching to portal payment swaps the bank form for the portal form', async () => {
    load();
    const user = await open();
    await edit(user);
    expect(screen.getByLabelText(/Account number/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Through my own website / portal'));
    expect(screen.queryByLabelText(/Account number/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Portal web address/)).toBeInTheDocument();
    expect(screen.getByText(/kept on record but no longer used for payments/)).toBeInTheDocument();
  });

  it('cannot remove the only address / bank account / contact, and moves the primary mark on removal', async () => {
    load();
    const user = await open();
    await edit(user);
    const removes = screen.getAllByRole('button', { name: /Remove/ });
    // 2 addresses, then 1 bank, then 1 contact
    expect(removes).toHaveLength(4);
    expect(removes[2]).toBeDisabled();
    expect(removes[3]).toBeDisabled();
    await user.click(removes[0]); // remove the primary address
    expect(screen.getByText('Addresses (1)')).toBeInTheDocument();
    expect(screen.getAllByText('Primary').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Remove/ })[0]).toBeDisabled();
  });
});
