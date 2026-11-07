/**
 * "My KYC" on the supplier portal: the change form's state, what it sends, and which parts of the KYC it changes.
 * Pure functions (no React) so they can be tested on their own. The server (grn-service supplierKyc.validation.js and
 * sp_nt_SupplierModifyKyc) is the authority; the checks here only save the supplier a round trip - above all, "nothing has
 * changed" is caught before any file is uploaded.
 */
import type {
  SupplierKyc, SupplierKycAddress, SupplierKycBank, SupplierKycContact,
} from '@/Services/SupplierService';
import { SUPPLIER_SERVICE_BASE } from '@/Services/SupplierService';

export type KycSection = 'BASIC' | 'PAYMENT' | 'ADDRESS' | 'BANK' | 'CONTACT' | 'DOCUMENT';

export const SECTION_LABEL: Record<KycSection, string> = {
  BASIC: 'Company details',
  PAYMENT: 'Payment method',
  ADDRESS: 'Addresses',
  BANK: 'Bank accounts',
  CONTACT: 'Contacts',
  DOCUMENT: 'Documents',
};

/** The KYC documents a supplier can replace. A new copy replaces the one on file; "Other" only adds. */
export const DOCUMENT_SLOTS = [
  { type: 'pan_file', label: 'PAN card' },
  { type: 'gst_file', label: 'GST certificate' },
  { type: 'msme_file', label: 'MSME / Udyam certificate' },
  { type: 'bankCancelCheque_0', label: 'Cancelled cheque / bank letter' },
] as const;
export const OTHER_DOCUMENT = { type: 'other_file', label: 'Other documents' } as const;
export const MAX_OTHER_DOCUMENTS = 3;
export const MAX_AUTHORIZATION_FILES = 3;
export const MAX_FILE_MB = 10;
export const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const FILE_EXT = /\.(pdf|png|jpe?g|webp)$/i;

export const DOCUMENT_LABEL: Record<string, string> = {
  ...Object.fromEntries(DOCUMENT_SLOTS.map((s) => [s.type, s.label])),
  [OTHER_DOCUMENT.type]: OTHER_DOCUMENT.label,
  AUTHORIZATION: 'Authorization letter',
};

export const MSME_TYPES = ['Micro', 'Small', 'Medium'] as const;

/** Why a file cannot be used, or '' when it can. */
export function fileProblem(file: File): string {
  if (!FILE_EXT.test(file.name)) return `"${file.name}" is not a PDF or an image (PNG / JPG / WEBP).`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `"${file.name}" is over ${MAX_FILE_MB} MB.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return '';
}

/**
 * A stored file link, pointed at the API origin this page talks to. The upload step bakes the uploading server's own address
 * into the link (e.g. http://localhost:8001/dwl/...), which is a dead link anywhere else. Same rule as getAuthFileUrl for staff.
 */
export function kycFileUrl(url: string | null | undefined): string {
  if (!url) return '';
  const at = url.indexOf('/dwl/');
  if (at < 0) return url;
  return `${SUPPLIER_SERVICE_BASE.replace(/\/+$/, '')}${url.slice(at)}`;
}

// ── form state ──────────────────────────────────────────────────────────────────────────────────────────

export interface AddressRow {
  key: string;
  kyc_address_sno: number | null;
  door_no: string; street: string; area: string; city: string; taluk: string; state: string;
  state_code: string; pincode: string; location_link: string;
  is_primary: boolean;
}
export interface BankRow {
  key: string;
  kyc_bank_sno: number | null;
  ac_holder_name: string; ac_number: string; ac_type: string; ifsc: string;
  bank_name: string; bank_branch_name: string; bank_address: string;
  is_primary: boolean;
}
export interface ContactRow {
  key: string;
  kyc_contact_sno: number | null;
  contact_name: string; contact_position: string; contact_mobile: string; contact_email: string;
  is_primary: boolean;
}
export interface KycForm {
  company_name: string; legal_name: string; trade_name: string; contact_person: string; email: string; mobile_number: string;
  business_type: string;
  is_gst_avail: boolean; gst_no: string;
  is_msme_avail: boolean; msme_no: string; msme_type: string;
  pay_via_portal: boolean; payment_portal_name: string; payment_portal_url: string; payment_instructions: string;
  addresses: AddressRow[];
  banks: BankRow[];
  contacts: ContactRow[];
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
let keySeed = 0;
export const newKey = (): string => `row-${++keySeed}`;

export const blankAddress = (primary = false): AddressRow => ({
  key: newKey(), kyc_address_sno: null, door_no: '', street: '', area: '', city: '', taluk: '', state: '', state_code: '', pincode: '',
  location_link: '', is_primary: primary,
});
export const blankBank = (primary = false): BankRow => ({
  key: newKey(), kyc_bank_sno: null, ac_holder_name: '', ac_number: '', ac_type: '', ifsc: '', bank_name: '', bank_branch_name: '',
  bank_address: '', is_primary: primary,
});
export const blankContact = (primary = false): ContactRow => ({
  key: newKey(), kyc_contact_sno: null, contact_name: '', contact_position: '', contact_mobile: '', contact_email: '', is_primary: primary,
});

/** The form, filled with the KYC exactly as it is on file. */
export function buildForm(kyc: SupplierKyc): KycForm {
  const b = kyc.basic;
  const p = kyc.payment;
  return {
    company_name: s(b.company_name), legal_name: s(b.legal_name), trade_name: s(b.trade_name),
    contact_person: s(b.contact_person), email: s(b.email), mobile_number: s(b.mobile_number),
    business_type: s(b.business_type),
    is_gst_avail: b.is_gst_avail === 'Y', gst_no: s(b.gst_no),
    is_msme_avail: b.is_msme_avail === 'Y', msme_no: s(b.msme_no), msme_type: s(b.msme_type),
    pay_via_portal: p.pay_via_portal === 'Y', payment_portal_name: s(p.payment_portal_name),
    payment_portal_url: s(p.payment_portal_url), payment_instructions: s(p.payment_instructions),
    addresses: kyc.addresses.map((a) => ({
      key: newKey(), kyc_address_sno: a.kyc_address_sno,
      door_no: s(a.door_no), street: s(a.street), area: s(a.area), city: s(a.city), taluk: s(a.taluk), state: s(a.state),
      state_code: s(a.state_code), pincode: s(a.pincode), location_link: s(a.location_link), is_primary: a.is_primary === 'Y',
    })),
    banks: kyc.banks.map((k) => ({
      key: newKey(), kyc_bank_sno: k.kyc_bank_sno,
      ac_holder_name: s(k.ac_holder_name), ac_number: s(k.ac_number), ac_type: s(k.ac_type), ifsc: s(k.ifsc),
      bank_name: s(k.bank_name), bank_branch_name: s(k.bank_branch_name), bank_address: s(k.bank_address), is_primary: k.is_primary === 'Y',
    })),
    contacts: kyc.contacts.map((c) => ({
      key: newKey(), kyc_contact_sno: c.kyc_contact_sno,
      contact_name: s(c.contact_name), contact_position: s(c.contact_position), contact_mobile: s(c.contact_mobile),
      contact_email: s(c.contact_email), is_primary: c.contact_type === 'PRIMARY',
    })),
  };
}

/** Marks exactly one row as primary (the others lose it). */
export function withPrimary<T extends { key: string; is_primary: boolean }>(rows: T[], key: string): T[] {
  return rows.map((r) => ({ ...r, is_primary: r.key === key }));
}

/** After a row is removed, the primary mark must not be lost: the first row takes it. */
export function ensurePrimary<T extends { is_primary: boolean }>(rows: T[]): T[] {
  return rows.length > 0 && !rows.some((r) => r.is_primary) ? rows.map((r, i) => ({ ...r, is_primary: i === 0 })) : rows;
}

// ── what is sent ────────────────────────────────────────────────────────────────────────────────────────

const flag = (b: boolean) => (b ? 'Y' : 'N');

/** The JSON `payload` of the multipart request (the files travel next to it). */
export function toPayload(form: KycForm, snapshot_hash: string, reason: string) {
  return {
    snapshot_hash,
    reason: reason.trim(),
    basic: {
      company_name: form.company_name, legal_name: form.legal_name, trade_name: form.trade_name,
      contact_person: form.contact_person, email: form.email, mobile_number: form.mobile_number, business_type: form.business_type,
      is_gst_avail: flag(form.is_gst_avail), gst_no: form.is_gst_avail ? form.gst_no : '',
      is_msme_avail: flag(form.is_msme_avail), msme_no: form.is_msme_avail ? form.msme_no : '',
      msme_type: form.is_msme_avail ? form.msme_type : '',
      pay_via_portal: flag(form.pay_via_portal),
      payment_portal_name: form.pay_via_portal ? form.payment_portal_name : '',
      payment_portal_url: form.pay_via_portal ? form.payment_portal_url : '',
      payment_instructions: form.pay_via_portal ? form.payment_instructions : '',
    },
    addresses: form.addresses.map(({ key: _k, is_primary, ...a }) => ({ ...a, is_primary: flag(is_primary) })),
    banks: form.pay_via_portal ? [] : form.banks.map(({ key: _k, is_primary, ...b }) => ({ ...b, is_primary: flag(is_primary) })),
    contacts: form.contacts.map(({ key: _k, is_primary, ...c }) => ({ ...c, is_primary: flag(is_primary) })),
  };
}

// ── what changed ────────────────────────────────────────────────────────────────────────────────────────

const t = (v: unknown): string => s(v).trim();
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Which sections the form changes compared with the KYC on file. Errs towards "changed": a section is only reported
 * unchanged when every value matches after the trimming / upper-casing the server applies.
 */
export function changedSections(kyc: SupplierKyc, form: KycForm, newDocuments: number): KycSection[] {
  const out: KycSection[] = [];
  const b = kyc.basic;
  const p = kyc.payment;

  const basicNow = [
    t(form.company_name), t(form.legal_name), t(form.trade_name), t(form.contact_person), t(form.email), t(form.mobile_number),
    t(form.business_type), form.is_gst_avail ? 'Y' : 'N', form.is_gst_avail ? t(form.gst_no).toUpperCase() : '',
    form.is_msme_avail ? 'Y' : 'N', form.is_msme_avail ? t(form.msme_no).toUpperCase() : '', form.is_msme_avail ? t(form.msme_type) : '',
  ];
  const basicWas = [
    t(b.company_name), t(b.legal_name), t(b.trade_name), t(b.contact_person), t(b.email), t(b.mobile_number),
    t(b.business_type), b.is_gst_avail === 'Y' ? 'Y' : 'N', b.is_gst_avail === 'Y' ? t(b.gst_no).toUpperCase() : '',
    b.is_msme_avail === 'Y' ? 'Y' : 'N', b.is_msme_avail === 'Y' ? t(b.msme_no).toUpperCase() : '', b.is_msme_avail === 'Y' ? t(b.msme_type) : '',
  ];
  if (!same(basicNow, basicWas)) out.push('BASIC');

  const payNow = form.pay_via_portal ? ['Y', t(form.payment_portal_name), t(form.payment_portal_url), t(form.payment_instructions)] : ['N', '', '', ''];
  const payWas = p.pay_via_portal === 'Y' ? ['Y', t(p.payment_portal_name), t(p.payment_portal_url), t(p.payment_instructions)] : ['N', '', '', ''];
  if (!same(payNow, payWas)) out.push('PAYMENT');

  const addr = (a: SupplierKycAddress | AddressRow, primary: boolean) =>
    [t(a.door_no), t(a.street), t(a.area), t(a.city), t(a.taluk), t(a.state), t(a.state_code), t(a.pincode), t(a.location_link), primary];
  const addrNow = form.addresses.map((a) => [a.kyc_address_sno, ...addr(a, a.is_primary)]);
  const addrWas = kyc.addresses.map((a) => [a.kyc_address_sno, ...addr(a, a.is_primary === 'Y')]);
  if (!same(addrNow, addrWas)) out.push('ADDRESS');

  const bank = (k: SupplierKycBank | BankRow, primary: boolean) =>
    [t(k.ac_holder_name), t(k.ac_number), t(k.ac_type), t(k.ifsc).toUpperCase(), t(k.bank_name), t(k.bank_branch_name), t(k.bank_address), primary];
  const bankNow = form.pay_via_portal ? [] : form.banks.map((k) => [k.kyc_bank_sno, ...bank(k, k.is_primary)]);
  const bankWas = p.pay_via_portal === 'Y' ? [] : kyc.banks.map((k) => [k.kyc_bank_sno, ...bank(k, k.is_primary === 'Y')]);
  if (!same(bankNow, bankWas)) out.push('BANK');

  const contact = (c: SupplierKycContact | ContactRow, primary: boolean) =>
    [t(c.contact_name), t(c.contact_position), t(c.contact_mobile), t(c.contact_email), primary];
  const contactNow = form.contacts.map((c) => [c.kyc_contact_sno, ...contact(c, c.is_primary)]);
  const contactWas = kyc.contacts.map((c) => [c.kyc_contact_sno, ...contact(c, c.contact_type === 'PRIMARY')]);
  if (!same(contactNow, contactWas)) out.push('CONTACT');

  if (newDocuments > 0) out.push('DOCUMENT');
  return out;
}

export const describeSections = (sections: string | KycSection[]): string => {
  const list = (Array.isArray(sections) ? sections : sections.split(','))
    .map((x) => SECTION_LABEL[x.trim() as KycSection]?.toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return 'details';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
};

// ── display helpers ─────────────────────────────────────────────────────────────────────────────────────

export const dash = (v: unknown): string => t(v) || '—';

export const joinAddress = (a: Pick<SupplierKycAddress, 'door_no' | 'street' | 'area' | 'city' | 'taluk' | 'state' | 'pincode'>): string =>
  [a.door_no, a.street, a.area, a.city, a.taluk, a.state, a.pincode].map(t).filter(Boolean).join(', ') || '—';

export const STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  A: { label: 'Approved', tone: 'success' },
  P: { label: 'Approval pending', tone: 'warning' },
  R: { label: 'Rejected', tone: 'danger' },
};

export type ChangeTone = 'warning' | 'success' | 'danger' | 'neutral';

/** How a change request reads to the supplier. A request with no status was applied at once (made before approval stages existed). */
export const CHANGE_STATUS: Record<string, { label: string; tone: ChangeTone }> = {
  P: { label: 'Waiting for approval', tone: 'warning' },
  A: { label: 'Approved', tone: 'success' },
  R: { label: 'Rejected', tone: 'danger' },
  C: { label: 'Withdrawn', tone: 'neutral' },
};
export const changeStatus = (status: string | null | undefined) => CHANGE_STATUS[status || 'A'] ?? CHANGE_STATUS.A;

/** "Stage 1 of 2 (Store Incharge)" - where a waiting request is. */
export const stageText = (no?: number | null, total?: number | null, name?: string | null): string => {
  if (!no || !total) return '';
  return `Stage ${no} of ${total}${name ? ` (${name})` : ''}`;
};

/** Name for a stored choice (business type / account type): the master's label, else what is stored. */
export function choiceLabel(choices: { value: string; label: string }[], value: string | null | undefined): string {
  const v = t(value);
  return choices.find((c) => c.value === v)?.label ?? (v || '—');
}
