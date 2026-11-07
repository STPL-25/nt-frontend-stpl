import { describe, it, expect } from 'vitest';
import type { SupplierKycSnapshot } from '@/Services/SupplierService';
import { compareSnapshots, type CompareSection } from '@/Application/Kyc-Screen/kycCompare';
import { changeRequestToRecord, recordKey } from '@/Application/Kyc-Screen/kycChangeRequestRecord';
import { KYC } from './supplierKycFixture';

const snap = (): SupplierKycSnapshot => JSON.parse(JSON.stringify({
  basic: KYC.basic, payment: KYC.payment, addresses: KYC.addresses, banks: KYC.banks, contacts: KYC.contacts, documents: KYC.documents,
}));
const section = (list: CompareSection[], key: string) => list.find((s) => s.key === key)!;
const field = (s: CompareSection, label: string) => s.fields!.find((f) => f.label === label)!;

describe('compareSnapshots', () => {
  it('an unchanged record is unchanged everywhere', () => {
    const sections = compareSnapshots(snap(), snap());
    expect(sections.map((s) => s.key)).toEqual(['BASIC', 'PAYMENT', 'ADDRESS', 'BANK', 'CONTACT', 'DOCUMENT']);
    expect(sections.every((s) => !s.changed)).toBe(true);
  });

  it('company details: previous and current side by side, only the changed field is marked', () => {
    const after = snap();
    after.basic.contact_person = 'Ravi Kumar';
    after.basic.is_gst_avail = 'N';
    after.basic.gst_no = null;
    const basic = section(compareSnapshots(snap(), after), 'BASIC');
    expect(basic.changed).toBe(true);
    expect(field(basic, 'Contact person')).toEqual({ label: 'Contact person', previous: 'Ravi', current: 'Ravi Kumar', changed: true });
    expect(field(basic, 'GST registered')).toMatchObject({ previous: 'Yes', current: 'No', changed: true });
    expect(field(basic, 'GST number')).toMatchObject({ previous: '33ABCDE1234F1Z5', current: '—', changed: true });
    expect(field(basic, 'Email').changed).toBe(false);
    expect(field(basic, 'Company name')).toMatchObject({ previous: 'ACME', current: 'ACME', changed: false });
  });

  it('the business type is compared by its name (older rows hold the text itself)', () => {
    const after = snap();
    after.basic.business_type = '4';
    after.basic.business_type_name = 'Private Limited Company';
    const f = field(section(compareSnapshots(snap(), after), 'BASIC'), 'Business type');
    expect(f).toMatchObject({ previous: 'Partnership', current: 'Private Limited Company', changed: true });

    const legacy = snap();
    legacy.basic.business_type = 'Electrical Contractor';
    legacy.basic.business_type_name = null;
    expect(field(section(compareSnapshots(legacy, legacy), 'BASIC'), 'Business type').current).toBe('Electrical Contractor');
  });

  it('payment method: a switch to the supplier portal is shown in words', () => {
    const after = snap();
    after.payment = { pay_via_portal: 'Y', payment_portal_name: 'Pay here', payment_portal_url: 'https://pay.example.com', payment_instructions: null };
    const pay = section(compareSnapshots(snap(), after), 'PAYMENT');
    expect(field(pay, 'Payment method')).toMatchObject({ previous: 'Bank transfer', current: "Through the supplier's own portal", changed: true });
    expect(field(pay, 'Portal address')).toMatchObject({ previous: '—', current: 'https://pay.example.com', changed: true });
  });

  it('an edited bank account shows both versions of the changed fields; an unchanged one is "same"', () => {
    const after = snap();
    after.banks[0].ac_number = '999999999999';
    after.banks[0].ifsc = 'ICIC0000001';
    after.addresses[1].city = 'Madurai';
    const sections = compareSnapshots(snap(), after);

    const bank = section(sections, 'BANK').rows![0];
    expect(bank.kind).toBe('changed');
    expect(bank.fields.find((f) => f.label === 'Account number')).toMatchObject({ previous: '123456789012', current: '999999999999', changed: true });
    expect(bank.fields.find((f) => f.label === 'IFSC')).toMatchObject({ previous: 'HDFC0000001', current: 'ICIC0000001', changed: true });
    expect(bank.fields.find((f) => f.label === 'Bank')!.changed).toBe(false);

    const addr = section(sections, 'ADDRESS').rows!;
    expect(addr.map((r) => r.kind)).toEqual(['same', 'changed']);
    expect(addr[0].title).toBe('Primary address');
    expect(addr[1].fields.find((f) => f.label === 'City')).toMatchObject({ previous: 'Chennai', current: 'Madurai' });
  });

  it('a new row is "added" (previous record blank), a dropped one "removed" (current record blank)', () => {
    const after = snap();
    after.addresses = [after.addresses[0], { ...after.addresses[1], kyc_address_sno: 99, city: 'Madurai' }]; // row 8 dropped, row 99 new
    const rows = section(compareSnapshots(snap(), after), 'ADDRESS').rows!;
    expect(rows.map((r) => r.kind)).toEqual(['same', 'removed', 'added']);
    const removed = rows[1];
    expect(removed.fields.find((f) => f.label === 'City')).toMatchObject({ previous: 'Chennai', current: '—', changed: true });
    const added = rows[2];
    expect(added.fields.find((f) => f.label === 'City')).toMatchObject({ previous: '—', current: 'Madurai', changed: true });
    expect(section(compareSnapshots(snap(), after), 'ADDRESS').changed).toBe(true);
  });

  it('contacts: the primary mark comes from the contact type', () => {
    const after = snap();
    after.contacts = [{ ...after.contacts[0], contact_type: 'SECONDARY' }];
    const row = section(compareSnapshots(snap(), after), 'CONTACT').rows![0];
    expect(row.kind).toBe('changed');
    expect(row.fields.find((f) => f.label === 'Primary')).toMatchObject({ previous: 'Yes', current: 'No', changed: true });
  });

  it('documents: a replaced file is one removed + one added; a kept one is kept', () => {
    const after = snap();
    after.documents = [{ ...KYC.documents[0], kyc_document_sno: 11, document_name: 'pan-new.pdf' }];
    const docs = section(compareSnapshots(snap(), after), 'DOCUMENT').documents!;
    expect(docs.map((d) => `${d.kind}:${d.name}`)).toEqual(['removed:pan.pdf', 'added:pan-new.pdf']);
    expect(docs[0].typeLabel).toBe('PAN card');
    expect(compareSnapshots(snap(), snap()).find((s) => s.key === 'DOCUMENT')!.documents!.map((d) => d.kind)).toEqual(['same']);
  });

  it('copes with a request that has no snapshots at all', () => {
    const sections = compareSnapshots(null, null);
    expect(sections).toHaveLength(6);
    expect(sections.every((s) => !s.changed)).toBe(true);
  });
});

describe('changeRequestToRecord / recordKey', () => {
  const request = (over = {}) => {
    const after = snap();
    after.basic.company_name = 'ACME INDUSTRIES';
    return {
      kyc_modified_sno: 5, kyc_basic_info_sno: 55, supp_code: 'SUP55', company_name: 'ACME', pan_no: 'ABCDE1234F', version_no: 2, reason: 'r',
      changed_sections: 'BASIC', source: 'SUPPLIER_PORTAL', modified_by: 'x', modified_date: '2026-11-07T04:00:00.000Z', old_data: snap(), new_data: after, files: [],
      status: 'P' as const, stage_no: 1, stage_total: 2, stage_name: 'Store Incharge', current_approver_ecno: 'ED001', ...over,
    };
  };

  it("lists the request under the supplier as the approver knows it (the PREVIOUS record), even when the request renames the company", () => {
    const r = request();
    const rec = changeRequestToRecord(r);
    expect(rec).toMatchObject({ kyc_basic_info_sno: 55, company_name: 'ACME', supp_code: 'SUP55', status: 'P', pan_no: 'ABCDE1234F', gst_no: '33ABCDE1234F1Z5', current_approver_id: 'ED001' });
    expect(r.new_data.basic.company_name).toBe('ACME INDUSTRIES'); // the request asks for a new name; the list does not use it
    expect(rec.change_request).toBe(r);
    expect(rec.created_date).toBe('2026-11-07T04:00:00.000Z');
  });

  it('falls back to the current record when the previous one is missing, and to a generic name when both are', () => {
    expect(changeRequestToRecord(request({ old_data: null, company_name: null })).company_name).toBe('ACME INDUSTRIES');
    expect(changeRequestToRecord(request({ old_data: null, new_data: null, company_name: null })).company_name).toBe('Supplier');
  });

  it('a request and a new submission never share a list key', () => {
    const rec = changeRequestToRecord(request());
    expect(recordKey(rec)).toBe('change-5');
    expect(recordKey({ kyc_basic_info_sno: 55 })).toBe('kyc-55');
    expect(recordKey(rec)).not.toBe(recordKey({ kyc_basic_info_sno: 55 }));
  });
});
