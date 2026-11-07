import { describe, it, expect } from 'vitest';
import {
  buildForm, buildRequest, contentProblem, ensurePrimary, fileProblem, formProblem, linkSummary, sniffKind, toPayload, tokenFromHash,
  whenText, withPrimary, type LinkStatus, type ResubmitData, type ResubmitForm,
} from '@/Application/Kyc-Screen/kycResubmitModel';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'; // 43 characters

const data = (over: Partial<ResubmitData> = {}): ResubmitData => ({
  link: { reject_reason: 'PAN unreadable', rejected_date: '2026-11-07T04:00:00Z', expires_at: '2026-11-14T04:00:00Z' },
  kyc: {
    company_name: 'Acme', legal_name: null, trade_name: null, contact_person: 'Ravi', email: 'r@acme.example', mobile_number: '9876543210',
    business_type: '1', supplier_cat_code: 'PS', pan_no: 'ABCDE1234F', is_gst_avail: 'Y', gst_no: '33ABCDE1234F1Z5', is_msme_avail: 'N', msme_no: null,
    msme_type: null, pay_via_portal: 'N', payment_portal_name: null, payment_portal_url: null, payment_instructions: null,
  },
  addresses: [{ kyc_address_sno: 5, door_no: '1', street: 'Mill Rd', area: 'Peelamedu', city: 'CBE', taluk: null, state: 'TN', state_code: 33, pincode: '641004', location_link: null, is_primary: 'Y' }],
  banks: [{ kyc_bank_sno: 8, ac_holder_name: 'Acme', ac_number: '123456789012', ac_type: '10', ifsc: 'HDFC0001234', bank_name: 'HDFC', bank_branch_name: 'RS', bank_address: 'CBE', is_primary: 'Y' }],
  contacts: [{ kyc_contact_sno: 3, contact_name: 'Ravi', contact_position: null, contact_mobile: '9876543210', contact_email: 'r@acme.example', is_primary: 'Y' }],
  documents: [{ document_type: 'pan_file', label: 'PAN card', document_name: 'pan.pdf', uploaded_date: '2026-10-01' }],
  choices: { business_types: [], account_types: [], supplier_categories: [] },
  uploads: { fields: [], allowed: 'PDF, PNG, JPG or WEBP', max_mb: 5, max_files: 6 },
  ...over,
});

const file = (name: string, bytes: number[] | string, type = 'application/octet-stream') =>
  new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name, { type });

describe('the link', () => {
  it('reads the token after #t=', () => {
    expect(tokenFromHash(`#t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash(`t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash(`#x=1&t=${TOKEN}`)).toBe(TOKEN);
  });
  it('returns nothing for a missing or malformed token', () => {
    for (const h of ['', '#', '#t=', '#t=short', `#t=${TOKEN}x`, `#t=${TOKEN.slice(1)}`, '#t=<script>alert(1)</script>', `#t=${'!'.repeat(43)}`]) {
      expect(tokenFromHash(h)).toBe('');
    }
  });
});

describe('files', () => {
  it('refuses by name, size and emptiness', () => {
    expect(fileProblem(file('scan.pdf', 'x'))).toBe('');
    expect(fileProblem(file('a.PNG', 'x'))).toBe('');
    expect(fileProblem(file('run.exe', 'x'))).toMatch(/Only PDF, PNG, JPG or WEBP/);
    expect(fileProblem(file('page.svg', 'x'))).toMatch(/not allowed/);
    expect(fileProblem(file('x.pdf.js', 'x'))).toMatch(/not allowed/);
    expect(fileProblem(file('empty.pdf', ''))).toMatch(/empty/);
    expect(fileProblem(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf'))).toMatch(/larger than 5 MB/);
    expect(fileProblem(new File([new Uint8Array(3 * 1024 * 1024)], 'ok.pdf'), 2)).toMatch(/larger than 2 MB/);
  });

  it('knows a file by its first bytes', () => {
    expect(sniffKind(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe('pdf');
    expect(sniffKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image');
    expect(sniffKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image');
    expect(sniffKind(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image');
    expect(sniffKind(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull(); // MZ - a Windows program
    expect(sniffKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // PK - a zip
  });

  it('refuses a program renamed .pdf, a PDF renamed .png, and an empty-looking file; accepts the real thing', async () => {
    expect(await contentProblem(file('invoice.pdf', [0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toMatch(/not a real PDF/);
    expect(await contentProblem(file('scan.png', '%PDF-1.4 hello world'))).toMatch(/not a real picture/);
    expect(await contentProblem(file('real.pdf', '%PDF-1.4 hello world'))).toBe('');
    expect(await contentProblem(file('real.jpg', [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]))).toBe('');
    expect(await contentProblem(file('html.png', '<html><script>1</script></html>'))).toMatch(/not a real picture/);
  });
});

describe('the form', () => {
  it('is filled from the KYC on file, with the row numbers kept', () => {
    const f = buildForm(data());
    expect(f).toMatchObject({ company_name: 'Acme', pan_no: 'ABCDE1234F', is_gst_avail: true, gst_no: '33ABCDE1234F1Z5', pay_via_portal: false, note: '' });
    expect(f.addresses[0]).toMatchObject({ kyc_address_sno: 5, state_code: '33', is_primary: true, taluk: '' });
    expect(f.banks[0]).toMatchObject({ kyc_bank_sno: 8, ac_number: '123456789012' });
    expect(f.contacts[0].kyc_contact_sno).toBe(3);
  });

  it('starts a blank row where the KYC has none, so the supplier has something to fill', () => {
    const f = buildForm(data({ addresses: [], banks: [], contacts: [] }));
    expect(f.addresses).toHaveLength(1);
    expect(f.addresses[0]).toMatchObject({ kyc_address_sno: null, is_primary: true });
    expect(f.banks).toHaveLength(1);
    expect(f.contacts).toHaveLength(1);
  });

  it('keeps exactly one primary row', () => {
    const rows = [{ key: 'a', is_primary: true }, { key: 'b', is_primary: false }];
    expect(withPrimary(rows, 'b').map((r) => r.is_primary)).toEqual([false, true]);
    expect(ensurePrimary([{ is_primary: false }, { is_primary: false }]).map((r) => r.is_primary)).toEqual([true, false]);
    expect(ensurePrimary([{ is_primary: false }, { is_primary: true }]).map((r) => r.is_primary)).toEqual([false, true]);
  });

  it('sends Y / N flags, drops what does not apply, and never the key used for rendering', () => {
    const f = buildForm(data());
    f.note = '  fixed  ';
    f.is_gst_avail = false;
    const p = toPayload(f);
    expect(p.note).toBe('fixed');
    expect(p.basic).toMatchObject({ is_gst_avail: 'N', gst_no: '', is_msme_avail: 'N', pay_via_portal: 'N' });
    expect(p.addresses[0]).toMatchObject({ kyc_address_sno: 5, is_primary: 'Y' });
    expect(JSON.stringify(p)).not.toContain('"key"');
    f.pay_via_portal = true;
    expect(toPayload(f).banks).toEqual([]);
  });

  it('puts the token FIRST in the request, so the server can refuse a bad link before it keeps a file', () => {
    const body = buildRequest(TOKEN, buildForm(data()), { pan_file: [file('pan.pdf', '%PDF-1.4')], other_file: [file('a.png', 'x'), file('b.png', 'y')] });
    const keys: string[] = [];
    body.forEach((_value, key) => keys.push(key));
    expect(keys).toEqual(['token', 'payload', 'pan_file', 'other_file', 'other_file']);
    expect(body.get('token')).toBe(TOKEN);
    expect(JSON.parse(String(body.get('payload'))).basic.company_name).toBe('Acme');
  });
});

describe('what is wrong with the form', () => {
  const ok = () => buildForm(data());
  const problem = (change: (f: ResubmitForm) => void, hasPan = true) => {
    const f = ok();
    change(f);
    return formProblem(f, hasPan);
  };

  it('accepts a good form', () => expect(formProblem(ok(), true)).toBe(''));

  it.each([
    [(f: ResubmitForm) => { f.company_name = ' '; }, /company name/i],
    [(f: ResubmitForm) => { f.email = 'nope'; }, /valid email/i],
    [(f: ResubmitForm) => { f.mobile_number = '123'; }, /valid mobile/i],
    [(f: ResubmitForm) => { f.pan_no = 'ABC'; }, /valid PAN/i],
    [(f: ResubmitForm) => { f.gst_no = '33ABCDE1234F1Y5'; }, /valid GST/i],
    [(f: ResubmitForm) => { f.gst_no = '29AAAAA0000A1Z5'; }, /must contain your PAN/i],
    [(f: ResubmitForm) => { f.is_msme_avail = true; f.msme_no = ''; }, /MSME/i],
    [(f: ResubmitForm) => { f.addresses[0].pincode = '12'; }, /Address 1: enter a 6-digit pincode/i],
    [(f: ResubmitForm) => { f.addresses[0].city = ''; }, /Address 1: enter the city/i],
    [(f: ResubmitForm) => { f.banks[0].ac_number = '12ab'; }, /6 to 18 digits/i],
    [(f: ResubmitForm) => { f.banks[0].ac_number = '012345678'; }, /starting with 0/i],
    [(f: ResubmitForm) => { f.banks[0].ifsc = 'HDFC1001234'; }, /valid IFSC/i],
    [(f: ResubmitForm) => { f.banks = []; }, /bank account/i],
    [(f: ResubmitForm) => { f.contacts[0].contact_email = 'x'; }, /Contact 1: enter a valid email/i],
    [(f: ResubmitForm) => { f.pay_via_portal = true; f.payment_portal_name = 'P'; f.payment_portal_url = 'javascript:alert(1)'; }, /web address/i],
  ])('flags the first problem (%#)', (change, pattern) => {
    expect(problem(change)).toMatch(pattern);
  });

  it('asks for the PAN card when none is on file or chosen', () => {
    expect(problem(() => {}, false)).toBe('Upload your PAN card.');
  });

  it('does not ask for a bank account when paid through a portal', () => {
    expect(problem((f) => { f.pay_via_portal = true; f.payment_portal_name = 'P'; f.payment_portal_url = 'https://pay.example.com'; f.banks = []; })).toBe('');
  });
});

describe('what staff read about the link', () => {
  const base: LinkStatus = {
    link_sno: 1, sent_to: 'r@acme.example', email_sent: 'Y', email_note: null, reject_reason: 'PAN unreadable', created_by: 'ED001',
    created_date: '2026-11-07T04:00:00Z', expires_at: '2026-11-14T04:00:00Z', opened_date: null, used_date: null, link_state: 'OPEN', resubmit_count: 0,
  };

  it('says when no link was ever sent', () => {
    expect(linkSummary(null)).toMatchObject({ tone: 'warning', title: 'No correction link has been sent' });
  });
  it('an open link: waiting, and whether the supplier has opened it', () => {
    const waiting = linkSummary(base);
    expect(waiting).toMatchObject({ tone: 'info', title: 'Waiting for the supplier to correct the KYC' });
    expect(waiting.lines.join(' ')).toMatch(/has not opened it yet/);
    expect(linkSummary({ ...base, opened_date: '2026-11-08T04:00:00Z' }).lines.join(' ')).toMatch(/opened it on/);
  });
  it('warns loudly when the e-mail did not go out', () => {
    const s = linkSummary({ ...base, email_sent: 'N', email_note: 'SMTP down' });
    expect(s.tone).toBe('warning');
    expect(s.lines[0]).toMatch(/did NOT go out \(SMTP down\)/);
  });
  it('used, expired and replaced links', () => {
    expect(linkSummary({ ...base, link_state: 'USED', used_date: '2026-11-08T04:00:00Z' })).toMatchObject({ tone: 'success', title: 'Corrected and sent again by the supplier' });
    expect(linkSummary({ ...base, link_state: 'EXPIRED' })).toMatchObject({ tone: 'danger', title: 'The link expired' });
    expect(linkSummary({ ...base, link_state: 'REPLACED' })).toMatchObject({ tone: 'info', title: 'A newer link replaced this one' });
  });
  it('formats dates and survives bad ones', () => {
    expect(whenText('2026-11-07T04:00:00Z')).toMatch(/Nov 2026/);
    expect(whenText('garbage')).toBe('');
    expect(whenText(null)).toBe('');
  });
});
