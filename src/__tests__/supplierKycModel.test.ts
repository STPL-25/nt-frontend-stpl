import { describe, it, expect } from 'vitest';
import {
  blankAddress, buildForm, changedSections, describeSections, ensurePrimary, fileProblem, kycFileUrl, toPayload, withPrimary,
} from '@/Application/SupplierPortal/supplierKycModel';
import { KYC } from './supplierKycFixture';

describe('changedSections', () => {
  it('reports nothing for the form exactly as it was loaded', () => {
    expect(changedSections(KYC, buildForm(KYC), 0)).toEqual([]);
  });

  it('ignores spaces, and the case of GST / IFSC (the server stores them upper-case)', () => {
    const f = buildForm(KYC);
    f.contact_person = '  Ravi ';
    f.gst_no = '33abcde1234f1z5';
    f.banks[0].ifsc = 'hdfc0000001';
    expect(changedSections(KYC, f, 0)).toEqual([]);
  });

  it('names the section that changed', () => {
    const f = buildForm(KYC);
    f.contact_person = 'Ravi Kumar';
    expect(changedSections(KYC, f, 0)).toEqual(['BASIC']);

    const g = buildForm(KYC);
    g.addresses[1].city = 'Madurai';
    g.banks[0].ac_number = '999999999999';
    g.contacts[0].contact_email = 'new@acme.com';
    expect(changedSections(KYC, g, 0)).toEqual(['ADDRESS', 'BANK', 'CONTACT']);
  });

  it('counts an added or removed row, a changed primary, and new documents', () => {
    const added = buildForm(KYC);
    added.addresses.push(blankAddress());
    expect(changedSections(KYC, added, 0)).toEqual(['ADDRESS']);

    const removed = buildForm(KYC);
    removed.addresses = removed.addresses.slice(0, 1);
    expect(changedSections(KYC, removed, 0)).toEqual(['ADDRESS']);

    const primary = buildForm(KYC);
    primary.addresses = withPrimary(primary.addresses, primary.addresses[1].key);
    expect(changedSections(KYC, primary, 0)).toEqual(['ADDRESS']);

    expect(changedSections(KYC, buildForm(KYC), 2)).toEqual(['DOCUMENT']);
  });

  it('paying through a portal is a payment change and retires the bank accounts', () => {
    const f = buildForm(KYC);
    f.pay_via_portal = true;
    f.payment_portal_name = 'Pay here';
    f.payment_portal_url = 'https://pay.example.com';
    expect(changedSections(KYC, f, 0)).toEqual(['PAYMENT', 'BANK']);
  });

  it('turning GST off clears the number, so it is a company-details change', () => {
    const f = buildForm(KYC);
    f.is_gst_avail = false;
    expect(changedSections(KYC, f, 0)).toEqual(['BASIC']);
  });
});

describe('toPayload', () => {
  it('sends flags as Y/N, without the local row keys, with the hash and the trimmed reason', () => {
    const f = buildForm(KYC);
    const p = toPayload(f, KYC.snapshot_hash, '  Moved office ');
    expect(p.snapshot_hash).toBe(KYC.snapshot_hash);
    expect(p.reason).toBe('Moved office');
    expect(p.basic).toMatchObject({ is_gst_avail: 'Y', gst_no: '33ABCDE1234F1Z5', is_msme_avail: 'N', pay_via_portal: 'N' });
    expect(p.addresses[0]).toMatchObject({ kyc_address_sno: 7, is_primary: 'Y', pincode: '641001', state_code: '33' });
    expect(p.addresses[1].is_primary).toBe('N');
    expect(p.banks[0]).toMatchObject({ kyc_bank_sno: 3, ac_number: '123456789012', is_primary: 'Y' });
    expect(p.contacts[0]).toMatchObject({ kyc_contact_sno: 4, is_primary: 'Y' });
    expect(JSON.stringify(p)).not.toContain('"key"');
  });

  it('sends no bank accounts and no GST/MSME values that do not apply', () => {
    const f = buildForm(KYC);
    f.pay_via_portal = true;
    f.payment_portal_name = 'Pay here';
    f.payment_portal_url = 'https://pay.example.com';
    f.is_gst_avail = false;
    const p = toPayload(f, KYC.snapshot_hash, 'x');
    expect(p.banks).toEqual([]);
    expect(p.basic.gst_no).toBe('');
    expect(p.basic.payment_portal_url).toBe('https://pay.example.com');
  });
});

describe('primary rows', () => {
  it('withPrimary leaves exactly one primary', () => {
    const rows = buildForm(KYC).addresses;
    const out = withPrimary(rows, rows[1].key);
    expect(out.map((r) => r.is_primary)).toEqual([false, true]);
  });

  it('ensurePrimary hands the mark to the first row when the primary one was removed', () => {
    const rows = buildForm(KYC).addresses.slice(1).map((r) => ({ ...r, is_primary: false }));
    expect(ensurePrimary(rows)[0].is_primary).toBe(true);
    expect(ensurePrimary([])).toEqual([]);
  });
});

describe('files', () => {
  it('kycFileUrl points a stored link at this app’s API origin', () => {
    expect(kycFileUrl('http://localhost:8001/dwl/NON_TRADE_DATAS/KYC_DATAS/a.pdf')).toMatch(/\/dwl\/NON_TRADE_DATAS\/KYC_DATAS\/a\.pdf$/);
    expect(kycFileUrl('https://other.example.com/a.pdf')).toBe('https://other.example.com/a.pdf');
    expect(kycFileUrl(null)).toBe('');
  });

  it('fileProblem refuses the wrong type, an empty file and a big one', () => {
    const f = (name: string, size: number) => new File([new Uint8Array(size)], name);
    expect(fileProblem(f('a.pdf', 10))).toBe('');
    expect(fileProblem(f('a.PNG', 10))).toBe('');
    expect(fileProblem(f('a.docx', 10))).toMatch(/not a PDF or an image/);
    expect(fileProblem(f('a.pdf', 0))).toMatch(/empty/);
    expect(fileProblem(f('a.pdf', 11 * 1024 * 1024))).toMatch(/over 10 MB/);
  });
});

describe('describeSections', () => {
  it('reads as a sentence', () => {
    expect(describeSections(['BANK'])).toBe('bank accounts');
    expect(describeSections('BASIC,BANK,DOCUMENT')).toBe('company details, bank accounts and documents');
    expect(describeSections([])).toBe('details');
  });
});
