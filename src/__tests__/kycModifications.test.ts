import { describe, it, expect } from 'vitest';
import type { SupplierKycSnapshot } from '@/Services/SupplierService';
import { authorizationFiles, changeStatus, describeChange, stageText, touchesPayment } from '@/Application/SupplierStatus/kycModifications';
import { KYC } from './supplierKycFixture';

const snap = (): SupplierKycSnapshot => JSON.parse(JSON.stringify({
  basic: KYC.basic, payment: KYC.payment, addresses: KYC.addresses, banks: KYC.banks, contacts: KYC.contacts, documents: KYC.documents,
}));

describe('describeChange', () => {
  it('has nothing to say about an unchanged KYC, or a change without its snapshots', () => {
    expect(describeChange({ old_data: snap(), new_data: snap() })).toEqual([]);
    expect(describeChange({ old_data: null, new_data: snap() })).toEqual([]);
  });

  it('lists company, payment and row changes with old → new', () => {
    const before = snap();
    const after = snap();
    after.basic.contact_person = 'Ravi Kumar';
    after.basic.is_gst_avail = 'N';
    after.basic.gst_no = null;
    after.banks[0].ac_number = '999999999999';
    after.banks[0].ifsc = 'ICIC0000001';
    after.addresses[1].is_primary = 'Y';
    after.addresses[0].is_primary = 'N';
    after.addresses.push({ ...after.addresses[1], kyc_address_sno: 9, city: 'Madurai', is_primary: 'N' });
    after.contacts = [];
    after.payment.pay_via_portal = 'Y';
    const text = describeChange({ old_data: before, new_data: after }).map((l) => `${l.section} | ${l.text}`);

    expect(text).toContain('Company details | Contact person: Ravi → Ravi Kumar');
    expect(text).toContain('Company details | GST registered: Yes → No');
    expect(text).toContain('Company details | GST number: 33ABCDE1234F1Z5 → —');
    expect(text).toContain('Payment method | Payment method: Bank transfer → Through supplier portal');
    expect(text).toContain('Bank accounts | Bank account (HDFC 123456789012) - Account number: 123456789012 → 999999999999');
    expect(text).toContain('Bank accounts | Bank account (HDFC 123456789012) - IFSC: HDFC0000001 → ICIC0000001');
    expect(text.some((t) => t.startsWith('Addresses | Address added:') && t.includes('Madurai'))).toBe(true);
    expect(text.some((t) => t.includes('Primary: No → Yes'))).toBe(true);
    expect(text).toContain('Contacts | Contact removed: Ravi');
  });

  it('shows a replaced document as one removed and one added', () => {
    const before = snap();
    const after = snap();
    after.documents = [{ ...before.documents[0], kyc_document_sno: 11, document_name: 'pan-new.pdf' }];
    const text = describeChange({ old_data: before, new_data: after }).map((l) => l.text);
    expect(text).toEqual([
      'Document added: pan_file (pan-new.pdf)',
      'Document replaced / removed: pan_file (pan.pdf)',
    ]);
  });
});

describe('request status helpers', () => {
  it('reads the status the way an approver expects; no status = applied at once (made before approval stages)', () => {
    expect(changeStatus('P')).toEqual({ label: 'Waiting', tone: 'warning' });
    expect(changeStatus('A').label).toBe('Approved');
    expect(changeStatus('R').tone).toBe('danger');
    expect(changeStatus('C').label).toBe('Withdrawn');
    expect(changeStatus(undefined).label).toBe('Approved');
    expect(changeStatus('?').label).toBe('Approved');
  });

  it('stageText says where a request is', () => {
    expect(stageText({ stage_no: 1, stage_total: 2, stage_name: 'Store Incharge' })).toBe('Stage 1 of 2 (Store Incharge)');
    expect(stageText({ stage_no: 2, stage_total: 2, stage_name: null })).toBe('Stage 2 of 2');
    expect(stageText({ stage_no: null, stage_total: null, stage_name: null })).toBe('');
  });

  it('touchesPayment flags a change to the bank account or payment method', () => {
    expect(touchesPayment({ changed_sections: 'BASIC,BANK' })).toBe(true);
    expect(touchesPayment({ changed_sections: 'PAYMENT' })).toBe(true);
    expect(touchesPayment({ changed_sections: 'ADDRESS,CONTACT,DOCUMENT' })).toBe(false);
    expect(touchesPayment({ changed_sections: 'BASIC' })).toBe(false);
  });
});

describe('authorizationFiles', () => {
  it('keeps only the authorization letters', () => {
    const files = [
      { file_kind: 'AUTHORIZATION', file_name: 'a.pdf', file_path: 'http://x/a.pdf' },
      { file_kind: 'gst_file', file_name: 'g.pdf', file_path: 'http://x/g.pdf' },
    ];
    expect(authorizationFiles({ files }).map((f) => f.file_name)).toEqual(['a.pdf']);
  });
});
