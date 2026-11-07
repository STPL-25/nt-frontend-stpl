import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  post: vi.fn(), status: { current: null as unknown }, loading: { current: false },
  toastSuccess: vi.fn(), toastError: vi.fn(), toastWarning: vi.fn(), fetchUrl: vi.fn(),
}));

vi.mock('axios', () => ({ default: { post: h.post } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: h.toastError, success: h.toastSuccess, info: vi.fn(), warning: h.toastWarning }) }));
vi.mock('@/hooks/useFetchHook', () => ({
  default: (url: string | null) => { h.fetchUrl(url); return { data: { success: true, data: h.status.current }, loading: h.loading.current, error: null }; },
}));

import KycResubmitLinkPanel from '@/Application/SupplierStatus/KycResubmitLinkPanel';

const link = (over: Record<string, unknown> = {}) => ({
  link_sno: 1, sent_to: 'r@acme.example', email_sent: 'Y', email_note: null, reject_reason: 'PAN unreadable', created_by: 'ED001',
  created_date: '2026-11-07T04:00:00Z', expires_at: '2026-11-14T04:00:00Z', opened_date: null, used_date: null, link_state: 'OPEN', resubmit_count: 0, ...over,
});

beforeEach(() => {
  Object.values(h).forEach((v) => typeof v === 'function' && 'mockReset' in v && (v as ReturnType<typeof vi.fn>).mockReset());
  h.status.current = link();
  h.loading.current = false;
});

describe('KycResubmitLinkPanel', () => {
  it('asks the server about this KYC and shows where the link stands', () => {
    render(<KycResubmitLinkPanel kycId={77} />);
    expect(h.fetchUrl).toHaveBeenCalledWith(expect.stringMatching(/\/api\/kyc\/resubmit\/status\/77$/));
    expect(screen.getByText('Waiting for the supplier to correct the KYC')).toBeInTheDocument();
    expect(screen.getByText(/Sent to r@acme.example/)).toBeInTheDocument();
    expect(screen.getByText(/has not opened it yet/)).toBeInTheDocument();
    expect(screen.getByText(/PAN unreadable/)).toBeInTheDocument();
  });

  it('offers to send a link when none was ever sent', () => {
    h.status.current = null;
    render(<KycResubmitLinkPanel kycId={77} />);
    expect(screen.getByText('No correction link has been sent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Send link$/ })).toBeInTheDocument();
  });

  it('sends a new link with the reason written in the box, as the logged-in approver (the server decides who)', async () => {
    const user = userEvent.setup();
    h.post.mockResolvedValue({ data: { success: true, message: 'A new correction link was e-mailed to r@acme.example', data: { emailSent: true } } });
    render(<KycResubmitLinkPanel kycId={77} />);

    await user.click(screen.getByRole('button', { name: /Send new link/ }));
    const box = screen.getByLabelText(/What should the supplier correct/);
    expect(box).toHaveValue('PAN unreadable'); // starts from the last reason
    await user.clear(box);
    await user.type(box, 'Upload a clear PAN card');
    await user.click(screen.getByRole('button', { name: /^Send link$/ }));

    await waitFor(() => expect(h.post).toHaveBeenCalled());
    expect(h.post.mock.calls[0][0]).toMatch(/\/api\/kyc\/resubmit\/send$/);
    expect(h.post.mock.calls[0][1]).toEqual({ kyc_basic_info_sno: 77, reason: 'Upload a clear PAN card' });
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith('A new correction link was e-mailed to r@acme.example'));
    expect(screen.queryByLabelText(/What should the supplier correct/)).not.toBeInTheDocument();
  });

  it('warns when the link was made but the e-mail did not go out', async () => {
    const user = userEvent.setup();
    h.post.mockResolvedValue({ data: { success: true, data: { emailSent: false, reason: 'The e-mail was not sent (SMTP down).' } } });
    render(<KycResubmitLinkPanel kycId={77} />);
    await user.click(screen.getByRole('button', { name: /Send new link/ }));
    await user.click(screen.getByRole('button', { name: /^Send link$/ }));
    await waitFor(() => expect(h.toastWarning).toHaveBeenCalledWith('The e-mail was not sent (SMTP down).', expect.anything()));
  });

  it('shows why the server refused (for example, not an approver of this KYC)', async () => {
    const user = userEvent.setup();
    h.post.mockRejectedValue({ response: { data: { error: 'Only an approver of this KYC can send the supplier a correction link.' } } });
    render(<KycResubmitLinkPanel kycId={77} />);
    await user.click(screen.getByRole('button', { name: /Send new link/ }));
    await user.click(screen.getByRole('button', { name: /^Send link$/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('Only an approver of this KYC can send the supplier a correction link.'));
  });

  it('will not send without a reason', async () => {
    const user = userEvent.setup();
    render(<KycResubmitLinkPanel kycId={77} />);
    await user.click(screen.getByRole('button', { name: /Send new link/ }));
    await user.clear(screen.getByLabelText(/What should the supplier correct/));
    await user.click(screen.getByRole('button', { name: /^Send link$/ }));
    expect(h.toastError).toHaveBeenCalledWith('Write what the supplier has to correct.');
    expect(h.post).not.toHaveBeenCalled();
  });
});
