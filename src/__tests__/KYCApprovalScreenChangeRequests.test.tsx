import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KYC } from './supplierKycFixture';

const h = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), canEdit: vi.fn(() => true), toastError: vi.fn(), toastSuccess: vi.fn(), pending: { current: [] as unknown[] },
}));

vi.mock('axios', () => ({
  default: {
    get: h.get, post: vi.fn(),
    // the supplier-service client (imported for its types / constants) builds its own instance at load time
    create: () => ({ interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }, get: vi.fn(), post: vi.fn() }),
  },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: h.toastError, success: h.toastSuccess, info: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/hooks/useFetchHook', () => ({ default: () => ({ data: { success: true, data: h.pending.current }, loading: false, error: null }) }));
vi.mock('@/hooks/usePostHook', () => ({ default: () => ({ postData: h.post, loading: false }) }));
vi.mock('@/imports', () => ({ useAppState: () => ({ userData: [{ ecno: 'ED001' }] }) }));
vi.mock('@/Services/Socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  SOCKET_JOIN_KYC_APPROVAL: 'join', SOCKET_LEAVE_KYC_APPROVAL: 'leave', SOCKET_KYC_APPROVAL_UPDATED: 'updated',
}));
vi.mock('@/globalState/hooks/usePermissions', () => ({ usePermissions: () => ({ canEdit: h.canEdit }) }));
vi.mock('@/Services/authUrl', () => ({ getAuthFileUrl: (u: string) => `${u}?token=t` }));

import KYCApprovalScreen from '@/Application/Kyc-Screen/KYCApprovalScreen';

const snap = () => JSON.parse(JSON.stringify({
  basic: KYC.basic, payment: KYC.payment, addresses: KYC.addresses, banks: KYC.banks, contacts: KYC.contacts, documents: KYC.documents,
}));

const changeRequest = (over: Record<string, unknown> = {}) => {
  const after = snap();
  after.basic.contact_person = 'Ravi Kumar';
  after.banks[0].ac_number = '999999999999';
  return {
    kyc_modified_sno: 5, kyc_basic_info_sno: 55, supp_code: 'SUP55', company_name: 'ACME', pan_no: 'ABCDE1234F',
    version_no: 2, reason: 'We changed our bank and our contact person', changed_sections: 'BASIC,BANK', modified_by: 'r@acme.com', modified_date: '2026-11-07T04:00:00.000Z',
    old_data: snap(), new_data: after, status: 'P', decided_by: null, decided_date: null, decision_note: null,
    stage_no: 1, stage_total: 2, stage_name: 'Store Incharge', current_approver_ecno: 'ED001', is_mine: true,
    files: [
      { file_kind: 'AUTHORIZATION', file_name: 'letter.pdf', file_path: 'http://x/dwl/a/letter.pdf' },
      { file_kind: 'gst_file', file_name: 'gst-new.pdf', file_path: 'http://x/dwl/a/gst.pdf' },
    ],
    approvals: [], ...over,
  };
};

const submission = {
  kyc_basic_info_sno: 7, company_name: 'NEW SUPPLIER', contact_person: 'Meena', email: 'm@new.com', mobile_number: '9111111111', business_type: '1',
  business_type_name: 'Sole Proprietorship', is_gst_avail: 'N', gst_no: '', is_msme_avail: 'N', msme_no: null, pan_no: 'AAAAA0000A', status: 'P', supp_code: null,
  created_date: '2026-11-06T04:00:00.000Z', approver_ecno: 'ED001', kyc_address: '[]', kyc_bank_info: '[]', kyc_contact_details: '[]', kyc_uploaded_doc: '[]',
};

const open = async (requests: unknown[] = [changeRequest()], kycs: unknown[] = []) => {
  h.pending.current = kycs;
  h.get.mockResolvedValue({ data: { success: true, data: { waiting: requests, history: [] } } });
  const user = userEvent.setup();
  render(<KYCApprovalScreen />);
  await waitFor(() => expect(h.get).toHaveBeenCalled());
  return user;
};
const card = (name: string) => screen.getByText(name).closest('button, [role=button], div[class*="cursor-pointer"]') as HTMLElement;

// Radix (scroll area / dialogs) measures with ResizeObserver, which jsdom does not have
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.toastError.mockReset(); h.toastSuccess.mockReset();
  h.canEdit.mockReset(); h.canEdit.mockReturnValue(true); h.pending.current = [];
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

describe('KYC Approval screen - supplier change requests in the same list', () => {
  it('lists the change request next to a new KYC submission, with the stage and a payment warning tag', async () => {
    await open([changeRequest()], [submission]);
    expect(await screen.findByText('NEW SUPPLIER')).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('Change request')).toBeInTheDocument();
    expect(screen.getByText('Payment details')).toBeInTheDocument();
    expect(screen.getByText('Stage 1 of 2 (Store Incharge)')).toBeInTheDocument();
    expect(screen.getByText(/SUP55 · Request 2/)).toBeInTheDocument();
    expect(h.get.mock.calls[0][0]).toMatch(/\/api\/kyc\/change_requests$/);
    expect(screen.getByText(/2 pending KYCs/)).toBeInTheDocument();
  });

  it('opening a request shows the reason, the authorization letter and the previous record next to the current record', async () => {
    const user = await open();
    await user.click(await screen.findByText('ACME'));

    expect(await screen.findByText('Reason for the change')).toBeInTheDocument();
    expect(screen.getByText('We changed our bank and our contact person')).toBeInTheDocument();
    // the authorization letter is listed like any KYC document: name, type, Preview and Save
    const letterRow = screen.getByText('letter.pdf').closest('li') as HTMLElement;
    expect(within(letterRow).getByText(/Authorization letter/)).toBeInTheDocument();
    expect(within(letterRow).getByRole('button', { name: /Preview/ })).toBeInTheDocument();
    expect(within(letterRow).getByRole('link', { name: /Save/ })).toHaveAttribute('href', 'http://x/dwl/a/letter.pdf?token=t');
    expect(screen.getByText(/how the supplier is paid/)).toBeInTheDocument();
    expect(screen.getByText('New documents sent with the request')).toBeInTheDocument();

    const compare = screen.getByTestId('record-compare');
    expect(within(compare).getAllByText('Previous record').length).toBeGreaterThan(0);
    expect(within(compare).getAllByText('Current record').length).toBeGreaterThan(0);
    const company = within(screen.getByTestId('compare-BASIC'));
    expect(company.getByText('Ravi')).toBeInTheDocument();        // previous
    expect(company.getByText('Ravi Kumar')).toBeInTheDocument();  // current
    const bank = within(screen.getByTestId('compare-BANK'));
    expect(bank.getByText('123456789012')).toBeInTheDocument();
    expect(bank.getByText('999999999999')).toBeInTheDocument();
    // addresses were not touched: the section says so (and each row is collapsed as "No change")
    expect(within(screen.getByTestId('compare-ADDRESS')).getAllByText('No change').length).toBeGreaterThanOrEqual(1);
    expect(within(screen.getByTestId('compare-ADDRESS')).queryByText('Changed')).not.toBeInTheDocument();
    // only the two edited fields are marked as changed
    expect(compare.querySelectorAll('[data-testid=compare-BASIC] [data-changed=true]')).toHaveLength(1);
    expect(compare.querySelectorAll('[data-testid=compare-BANK] [data-changed=true]')).toHaveLength(1);
  });

  it("approve: goes to the change-request endpoint with the supplier's request, then the request leaves the list", async () => {
    h.post.mockResolvedValue({ success: true, message: 'Approved - now waiting for the next approver (stage 2 of 2)' });
    const user = await open();
    await user.click(await screen.findByText('ACME'));
    await user.click(await screen.findByRole('button', { name: /Approve change/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Approve KYC change')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Change request 2 · Stage 1 of 2 (Store Incharge)');
    expect(dialog).toHaveTextContent('previous record stays on file');
    await user.type(within(dialog).getByLabelText(/Comments/), 'Cheque matches');
    await user.click(within(dialog).getByRole('button', { name: /Confirm approval/ }));

    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1));
    expect(h.post.mock.calls[0][0]).toMatch(/\/api\/kyc\/change_requests\/act$/);
    expect(h.post.mock.calls[0][1]).toEqual({ kyc_modified_sno: 5, action: 'approve', note: 'Cheque matches' });
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith('Approved - now waiting for the next approver (stage 2 of 2)'));
    await waitFor(() => expect(screen.queryByText('Change request')).not.toBeInTheDocument());
  });

  it('reject: a reason is required, then it is sent as a reject with the note', async () => {
    h.post.mockResolvedValue({ success: true, message: 'Rejected - the supplier has been told' });
    const user = await open();
    await user.click(await screen.findByText('ACME'));
    await user.click(await screen.findByRole('button', { name: /Reject change/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Confirm rejection/ })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Comments/), 'The authorization letter is not signed');
    await user.click(within(dialog).getByRole('button', { name: /Confirm rejection/ }));
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1));
    expect(h.post.mock.calls[0][1]).toEqual({ kyc_modified_sno: 5, action: 'reject', note: 'The authorization letter is not signed' });
  });

  it('keeps the request and shows the server message when the decision is refused', async () => {
    h.post.mockRejectedValue({ response: { data: { error: 'This request is not waiting for you.' } } });
    const user = await open();
    await user.click(await screen.findByText('ACME'));
    await user.click(await screen.findByRole('button', { name: /Approve change/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Confirm approval/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('This request is not waiting for you.'));
    expect(screen.getAllByText('ACME').length).toBeGreaterThan(0);
  });

  it('a new KYC submission is still approved through its own endpoint (nothing changed there)', async () => {
    h.post.mockResolvedValue({ data: [{ result: 'SUCCESS' }] });
    const user = await open([changeRequest()], [submission]);
    await user.click(await screen.findByText('NEW SUPPLIER'));
    await user.click(await screen.findByRole('button', { name: /Approve KYC/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Approve KYC')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Confirm approval/ }));
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1));
    expect(h.post.mock.calls[0][0]).toMatch(/\/api\/kyc\/approve_kyc$/);
    expect(h.post.mock.calls[0][1]).toMatchObject({ kyc_basic_info_sno: 7, action: 'approve' });
  });

  it('without the approve permission it is view only', async () => {
    h.canEdit.mockReturnValue(false);
    const user = await open();
    await user.click(await screen.findByText('ACME'));
    await screen.findByText('Reason for the change');
    expect(screen.queryByRole('button', { name: /Approve change/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/View only/).length).toBeGreaterThan(0);
  });

  it('if the change requests cannot be loaded, new submissions still show and the approver is told', async () => {
    h.pending.current = [submission];
    h.get.mockRejectedValue({ response: { data: { error: 'Database error: boom' } } });
    render(<KYCApprovalScreen />);
    expect(await screen.findByText('NEW SUPPLIER')).toBeInTheDocument();
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('Database error: boom'));
    expect(screen.queryByText('Change request')).not.toBeInTheDocument();
  });

  it('search finds a change request by supplier name or code', async () => {
    const user = await open([changeRequest(), changeRequest({ kyc_modified_sno: 6, kyc_basic_info_sno: 56, company_name: 'GLOBAL STATIONERY', supp_code: 'SCL2602' })]);
    await screen.findByText('GLOBAL STATIONERY');
    await user.type(screen.getByPlaceholderText(/Search company/), 'scl2602');
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
    expect(screen.getByText('GLOBAL STATIONERY')).toBeInTheDocument();
  });
});

void card;
