import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ post: vi.fn(), toastError: vi.fn() }));

vi.mock('axios', () => ({
  default: { post: h.post, isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: h.toastError, success: vi.fn(), info: vi.fn(), warning: vi.fn() }) }));

import KycResubmitPage from '@/ApplicationPages/KycResubmitPage';
import type { ResubmitData } from '@/Application/Kyc-Screen/kycResubmitModel';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';

const openData = (over: Partial<ResubmitData> = {}): ResubmitData => ({
  link: { reject_reason: 'The PAN card is not readable and the bank account number is wrong.', rejected_date: '2026-11-07T04:00:00Z', expires_at: '2026-11-14T04:00:00Z' },
  kyc: {
    company_name: 'Acme Textiles', legal_name: null, trade_name: null, contact_person: 'Ravi', email: 'r@acme.example', mobile_number: '9876543210',
    business_type: '1', supplier_cat_code: 'PS', pan_no: 'ABCDE1234F', is_gst_avail: 'N', gst_no: null, is_msme_avail: 'N', msme_no: null, msme_type: null,
    pay_via_portal: 'N', payment_portal_name: null, payment_portal_url: null, payment_instructions: null,
  },
  addresses: [{ kyc_address_sno: 5, door_no: '1', street: 'Mill Rd', area: 'Peelamedu', city: 'Coimbatore', taluk: null, state: 'Tamil Nadu', state_code: 33, pincode: '641004', location_link: null, is_primary: 'Y' }],
  banks: [{ kyc_bank_sno: 8, ac_holder_name: 'Acme', ac_number: '123456789012', ac_type: '10', ifsc: 'HDFC0001234', bank_name: 'HDFC', bank_branch_name: 'RS Puram', bank_address: 'Coimbatore', is_primary: 'Y' }],
  contacts: [{ kyc_contact_sno: 3, contact_name: 'Ravi', contact_position: null, contact_mobile: '9876543210', contact_email: 'r@acme.example', is_primary: 'Y' }],
  documents: [{ document_type: 'pan_file', label: 'PAN card', document_name: 'pan-old.pdf', uploaded_date: '2026-10-01' }],
  choices: { business_types: [{ value: '1', label: 'Manufacturer' }], account_types: [{ value: '10', label: 'Savings' }], supplier_categories: [{ value: 'PS', label: 'Product Supplier' }] },
  uploads: {
    fields: [{ type: 'pan_file', label: 'PAN card' }, { type: 'gst_file', label: 'GST certificate' }, { type: 'other_file', label: 'Other document' }],
    allowed: 'PDF, PNG, JPG or WEBP', max_mb: 5, max_files: 6,
  },
  ...over,
});

const axiosError = (status: number, error: string) => Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status, data: { success: false, error } } });
const pdf = (name = 'pan.pdf') => new File(['%PDF-1.4 sample'], name, { type: 'application/pdf' });

const visit = (hash: string) => {
  window.history.replaceState(null, '', `/kyc_resubmit${hash}`);
  return render(<KycResubmitPage />);
};

beforeEach(() => {
  h.post.mockReset();
  h.toastError.mockReset();
  window.scrollTo = vi.fn();
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
});
afterEach(() => window.history.replaceState(null, '', '/'));

describe('opening the link', () => {
  it('explains a link with no token and asks the server nothing', async () => {
    visit('');
    expect(await screen.findByText('This link cannot be used')).toBeInTheDocument();
    expect(screen.getByText(/needs the private link from your e-mail/i)).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it('sends the token in the body (never in the URL) and shows what to correct, with the KYC filled in', async () => {
    h.post.mockResolvedValue({ data: { success: true, data: openData() } });
    visit(`#t=${TOKEN}`);
    expect(await screen.findByText(/The PAN card is not readable and the bank account number is wrong/)).toBeInTheDocument();

    const [url, body] = h.post.mock.calls[0];
    expect(url).toMatch(/\/api\/public_kyc\/resubmit\/open$/);
    expect(url).not.toContain(TOKEN);
    expect(body).toEqual({ token: TOKEN });

    expect(screen.getByLabelText(/Company name/)).toHaveValue('Acme Textiles');
    expect(screen.getByLabelText(/^PAN \*$/)).toHaveValue('ABCDE1234F');
    expect(screen.getByDisplayValue('123456789012')).toBeInTheDocument();
    expect(screen.getByText('pan-old.pdf')).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toMatch(/noindex/);
  });

  it.each([
    [410, 'This link has expired. Ask our purchase team to send you a new one.'],
    [410, 'A newer link was sent for this KYC. Open the latest link in your e-mail.'],
    [429, 'Too many attempts. Please wait a while and try again.'],
  ])('shows the reason a link cannot be used (%s)', async (status, message) => {
    h.post.mockRejectedValue(axiosError(status, message));
    visit(`#t=${TOKEN}`);
    expect(await screen.findByText('This link cannot be used')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText(/contact our purchase team/i)).toBeInTheDocument();
  });
});

describe('sending the corrected KYC', () => {
  const ready = async () => {
    h.post.mockResolvedValueOnce({ data: { success: true, data: openData() } });
    visit(`#t=${TOKEN}`);
    await screen.findByLabelText(/Company name/);
  };

  it('uploads with the token first, then thanks the supplier and closes the form', async () => {
    const user = userEvent.setup();
    await ready();
    await user.clear(screen.getByLabelText(/Company name/));
    await user.type(screen.getByLabelText(/Company name/), 'Acme Textiles Pvt Ltd');
    await user.upload(document.getElementById('doc-pan_file') as HTMLInputElement, pdf());
    expect(await screen.findByText('pan.pdf')).toBeInTheDocument();

    h.post.mockResolvedValueOnce({ data: { success: true, message: 'Thank you. Your corrected KYC has been sent for approval.' } });
    await user.click(screen.getByRole('button', { name: /Send corrected KYC/ }));

    expect(await screen.findByText('Your corrected KYC has been sent')).toBeInTheDocument();
    expect(screen.getByText(/Thank you. Your corrected KYC has been sent for approval./)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Company name/)).not.toBeInTheDocument();

    const [url, body] = h.post.mock.calls[1];
    expect(url).toMatch(/\/api\/public_kyc\/resubmit\/save$/);
    expect(body).toBeInstanceOf(FormData);
    const keys: string[] = [];
    (body as FormData).forEach((_value, key) => keys.push(key));
    expect(keys).toEqual(['token', 'payload', 'pan_file']);
    expect((body as FormData).get('token')).toBe(TOKEN);
    expect(JSON.parse(String((body as FormData).get('payload'))).basic.company_name).toBe('Acme Textiles Pvt Ltd');
  });

  it('refuses a program renamed to .pdf on the spot, with the reason, and keeps it off the form', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await ready();
    const exe = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0])], 'invoice.pdf', { type: 'application/pdf' });
    await user.upload(document.getElementById('doc-pan_file') as HTMLInputElement, exe);
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.stringMatching(/not a real PDF/)));
    expect(screen.queryByText('invoice.pdf')).not.toBeInTheDocument();
  });

  it('refuses a file type that is not allowed', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await ready();
    await user.upload(document.getElementById('doc-gst_file') as HTMLInputElement, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.stringMatching(/Only PDF, PNG, JPG or WEBP/)));
  });

  it('tells the supplier what is wrong without sending anything', async () => {
    const user = userEvent.setup();
    await ready();
    await user.clear(screen.getByLabelText(/^PAN \*$/));
    await user.type(screen.getByLabelText(/^PAN \*$/), 'bad');
    await user.click(screen.getByRole('button', { name: /Send corrected KYC/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid PAN/i);
    expect(h.post).toHaveBeenCalledTimes(1); // only the open
  });

  it('shows the server\'s reason for an unsafe file and lets the supplier try again', async () => {
    const user = userEvent.setup();
    await ready();
    h.post.mockRejectedValueOnce(axiosError(422, '"pan.pdf" contains scripts, embedded files or other active content, so it was not accepted.'));
    await user.click(screen.getByRole('button', { name: /Send corrected KYC/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/active content/);
    expect(screen.getByLabelText(/Company name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send corrected KYC/ })).toBeEnabled();
  });

  it('switches to the "link cannot be used" message when the server says the link is spent', async () => {
    const user = userEvent.setup();
    await ready();
    h.post.mockRejectedValueOnce(axiosError(410, 'Your corrected KYC has already been sent with this link.'));
    await user.click(screen.getByRole('button', { name: /Send corrected KYC/ }));
    expect(await screen.findByText('This link cannot be used')).toBeInTheDocument();
    expect(screen.getByText(/already been sent with this link/)).toBeInTheDocument();
  });

  it('asks for a PAN card when none is on file', async () => {
    const user = userEvent.setup();
    h.post.mockResolvedValueOnce({ data: { success: true, data: openData({ documents: [] }) } });
    visit(`#t=${TOKEN}`);
    await screen.findByLabelText(/Company name/);
    await user.click(screen.getByRole('button', { name: /Send corrected KYC/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload your PAN card.');
    expect(h.post).toHaveBeenCalledTimes(1);
  });
});
