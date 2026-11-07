/**
 * The KYC correction page (/kyc_resubmit): a supplier whose KYC was rejected opens the private link we e-mailed and fixes it.
 * Pure functions (no React) so they can be tested on their own. The server (backend-stpl src/KycResubmit + sql/155) is the
 * authority - it re-checks every field and every file; the checks here only save the supplier a round trip.
 */

// ── what the server sends (POST /api/public_kyc/resubmit/open) ───────────────────────────────────────────

export interface ResubmitChoice { value: string; label: string }
export interface ResubmitAddress {
  kyc_address_sno: number; door_no: string | null; street: string | null; area: string | null; city: string | null; taluk: string | null;
  state: string | null; state_code: number | null; pincode: string | null; location_link: string | null; is_primary: 'Y' | 'N';
}
export interface ResubmitBank {
  kyc_bank_sno: number; ac_holder_name: string | null; ac_number: string | null; ac_type: string | null; ifsc: string | null;
  bank_name: string | null; bank_branch_name: string | null; bank_address: string | null; is_primary: 'Y' | 'N';
}
export interface ResubmitContact {
  kyc_contact_sno: number; contact_name: string | null; contact_position: string | null; contact_mobile: string | null;
  contact_email: string | null; is_primary: 'Y' | 'N';
}
export interface ResubmitData {
  link: { reject_reason: string; rejected_date: string; expires_at: string };
  kyc: {
    company_name: string | null; legal_name: string | null; trade_name: string | null; contact_person: string | null; email: string | null;
    mobile_number: string | null; business_type: string | null; supplier_cat_code: string | null; pan_no: string | null;
    is_gst_avail: 'Y' | 'N'; gst_no: string | null; is_msme_avail: 'Y' | 'N'; msme_no: string | null; msme_type: string | null;
    pay_via_portal: 'Y' | 'N'; payment_portal_name: string | null; payment_portal_url: string | null; payment_instructions: string | null;
  };
  addresses: ResubmitAddress[];
  banks: ResubmitBank[];
  contacts: ResubmitContact[];
  documents: { document_type: string; label: string; document_name: string; uploaded_date: string | null }[];
  choices: { business_types: ResubmitChoice[]; account_types: ResubmitChoice[]; supplier_categories: ResubmitChoice[] };
  uploads: { fields: { type: string; label: string }[]; allowed: string; max_mb: number; max_files: number };
}

// ── the link ─────────────────────────────────────────────────────────────────────────────────────────────

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The token from `#t=<token>` (the address bar keeps it after the #, so it never reaches a server log). '' when absent or malformed. */
export function tokenFromHash(hash: string): string {
  const t = new URLSearchParams(hash.replace(/^#/, '')).get('t') ?? '';
  return TOKEN_RE.test(t) ? t : '';
}

// ── files ────────────────────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_MB = 5;
export const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const FILE_EXT = /\.(pdf|png|jpe?g|webp)$/i;

/** Why a file cannot be used (before it is sent), or ''. The server checks the content again - this only saves a round trip. */
export function fileProblem(file: File, maxMb = DEFAULT_MAX_MB): string {
  if (!FILE_EXT.test(file.name)) return `"${file.name}" is not allowed. Only PDF, PNG, JPG or WEBP files can be uploaded.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > maxMb * 1024 * 1024) return `"${file.name}" is larger than ${maxMb} MB.`;
  return '';
}

async function firstBytes(file: Blob, n: number): Promise<Uint8Array> {
  const part = file.slice(0, n);
  if (typeof part.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(part);
  });
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** What the first bytes of a file say it is. */
export function sniffKind(b: Uint8Array): 'pdf' | 'image' | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image'; // PNG
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image'; // WEBP
  return null;
}

/**
 * A file whose name says PDF but whose bytes say otherwise (or the other way round) is refused here with the reason, so the
 * supplier does not wait for an upload to be told. The server does the real check.
 */
export async function contentProblem(file: File): Promise<string> {
  try {
    const kind = sniffKind(await firstBytes(file, 12));
    const wantsPdf = /\.pdf$/i.test(file.name);
    if (!kind || (kind === 'pdf') !== wantsPdf) return `"${file.name}" is not a real ${wantsPdf ? 'PDF' : 'picture'} (its content is different), so it cannot be uploaded.`;
  } catch {
    return `"${file.name}" could not be read.`;
  }
  return '';
}

// ── form state ───────────────────────────────────────────────────────────────────────────────────────────

export interface AddressRow {
  key: string; kyc_address_sno: number | null;
  door_no: string; street: string; area: string; city: string; taluk: string; state: string; state_code: string; pincode: string; location_link: string;
  is_primary: boolean;
}
export interface BankRow {
  key: string; kyc_bank_sno: number | null;
  ac_holder_name: string; ac_number: string; ac_type: string; ifsc: string; bank_name: string; bank_branch_name: string; bank_address: string;
  is_primary: boolean;
}
export interface ContactRow {
  key: string; kyc_contact_sno: number | null;
  contact_name: string; contact_position: string; contact_mobile: string; contact_email: string;
  is_primary: boolean;
}
export interface ResubmitForm {
  company_name: string; legal_name: string; trade_name: string; contact_person: string; email: string; mobile_number: string;
  business_type: string; supplier_cat_code: string; pan_no: string;
  is_gst_avail: boolean; gst_no: string; is_msme_avail: boolean; msme_no: string; msme_type: string;
  pay_via_portal: boolean; payment_portal_name: string; payment_portal_url: string; payment_instructions: string;
  addresses: AddressRow[]; banks: BankRow[]; contacts: ContactRow[];
  note: string;
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
let keySeed = 0;
const newKey = (): string => `row-${++keySeed}`;

export const blankAddress = (primary = false): AddressRow => ({
  key: newKey(), kyc_address_sno: null, door_no: '', street: '', area: '', city: '', taluk: '', state: '', state_code: '', pincode: '', location_link: '', is_primary: primary,
});
export const blankBank = (primary = false): BankRow => ({
  key: newKey(), kyc_bank_sno: null, ac_holder_name: '', ac_number: '', ac_type: '', ifsc: '', bank_name: '', bank_branch_name: '', bank_address: '', is_primary: primary,
});
export const blankContact = (primary = false): ContactRow => ({
  key: newKey(), kyc_contact_sno: null, contact_name: '', contact_position: '', contact_mobile: '', contact_email: '', is_primary: primary,
});

/** The form, filled with the KYC exactly as it is on file. */
export function buildForm(data: ResubmitData): ResubmitForm {
  const k = data.kyc;
  const form: ResubmitForm = {
    company_name: s(k.company_name), legal_name: s(k.legal_name), trade_name: s(k.trade_name), contact_person: s(k.contact_person),
    email: s(k.email), mobile_number: s(k.mobile_number), business_type: s(k.business_type), supplier_cat_code: s(k.supplier_cat_code),
    pan_no: s(k.pan_no),
    is_gst_avail: k.is_gst_avail === 'Y', gst_no: s(k.gst_no), is_msme_avail: k.is_msme_avail === 'Y', msme_no: s(k.msme_no), msme_type: s(k.msme_type),
    pay_via_portal: k.pay_via_portal === 'Y', payment_portal_name: s(k.payment_portal_name), payment_portal_url: s(k.payment_portal_url),
    payment_instructions: s(k.payment_instructions),
    addresses: data.addresses.map((a) => ({
      key: newKey(), kyc_address_sno: a.kyc_address_sno, door_no: s(a.door_no), street: s(a.street), area: s(a.area), city: s(a.city), taluk: s(a.taluk),
      state: s(a.state), state_code: s(a.state_code), pincode: s(a.pincode), location_link: s(a.location_link), is_primary: a.is_primary === 'Y',
    })),
    banks: data.banks.map((b) => ({
      key: newKey(), kyc_bank_sno: b.kyc_bank_sno, ac_holder_name: s(b.ac_holder_name), ac_number: s(b.ac_number), ac_type: s(b.ac_type), ifsc: s(b.ifsc),
      bank_name: s(b.bank_name), bank_branch_name: s(b.bank_branch_name), bank_address: s(b.bank_address), is_primary: b.is_primary === 'Y',
    })),
    contacts: data.contacts.map((c) => ({
      key: newKey(), kyc_contact_sno: c.kyc_contact_sno, contact_name: s(c.contact_name), contact_position: s(c.contact_position),
      contact_mobile: s(c.contact_mobile), contact_email: s(c.contact_email), is_primary: c.is_primary === 'Y',
    })),
    note: '',
  };
  if (form.addresses.length === 0) form.addresses = [blankAddress(true)];
  if (form.contacts.length === 0) form.contacts = [blankContact(true)];
  if (form.banks.length === 0 && !form.pay_via_portal) form.banks = [blankBank(true)];
  return form;
}

/** Marks exactly one row as primary (the others lose it). */
export function withPrimary<T extends { key: string; is_primary: boolean }>(rows: T[], key: string): T[] {
  return rows.map((r) => ({ ...r, is_primary: r.key === key }));
}

/** After a row is removed, the primary mark must not be lost: the first row takes it. */
export function ensurePrimary<T extends { is_primary: boolean }>(rows: T[]): T[] {
  return rows.length > 0 && !rows.some((r) => r.is_primary) ? rows.map((r, i) => ({ ...r, is_primary: i === 0 })) : rows;
}

// ── what is sent ─────────────────────────────────────────────────────────────────────────────────────────

const flag = (b: boolean) => (b ? 'Y' : 'N');

/** The JSON `payload` field of the request. */
export function toPayload(form: ResubmitForm) {
  return {
    note: form.note.trim(),
    basic: {
      company_name: form.company_name, legal_name: form.legal_name, trade_name: form.trade_name, contact_person: form.contact_person,
      email: form.email, mobile_number: form.mobile_number, business_type: form.business_type, supplier_cat_code: form.supplier_cat_code,
      pan_no: form.pan_no,
      is_gst_avail: flag(form.is_gst_avail), gst_no: form.is_gst_avail ? form.gst_no : '',
      is_msme_avail: flag(form.is_msme_avail), msme_no: form.is_msme_avail ? form.msme_no : '', msme_type: form.is_msme_avail ? form.msme_type : '',
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

/**
 * The multipart body. `token` is appended FIRST on purpose: the server reads it before the first file arrives and refuses an
 * unusable link without keeping any upload.
 */
export function buildRequest(token: string, form: ResubmitForm, docs: Record<string, File[]>): FormData {
  const body = new FormData();
  body.append('token', token);
  body.append('payload', JSON.stringify(toPayload(form)));
  for (const [type, list] of Object.entries(docs)) list.forEach((f) => body.append(type, f));
  return body;
}

// ── checks before sending ────────────────────────────────────────────────────────────────────────────────

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE = /^[1-9][0-9]{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^\+?[0-9]{10,14}$/;
const t = (v: string) => v.trim();

/**
 * The first thing wrong with the form, written for the supplier, or ''. Same rules as the server (resubmit.validation.js), which
 * remains the authority; this catches the common slips before the files are uploaded.
 */
export function formProblem(form: ResubmitForm, hasPan: boolean): string {
  const need = (v: string, what: string) => (t(v) ? '' : `Enter the ${what}.`);
  const basic =
    need(form.company_name, 'company name') || need(form.contact_person, 'contact person') || need(form.business_type, 'business type') ||
    (EMAIL.test(t(form.email)) ? '' : 'Enter a valid email.') ||
    (MOBILE.test(t(form.mobile_number).replace(/[\s-]/g, '')) ? '' : 'Enter a valid mobile number (10 digits, or + and the country code).') ||
    (PAN.test(t(form.pan_no).toUpperCase()) ? '' : 'Enter a valid PAN (10 characters, e.g. ABCDE1234F).');
  if (basic) return basic;

  if (form.is_gst_avail) {
    const gst = t(form.gst_no).toUpperCase();
    if (!GSTIN.test(gst)) return 'Enter a valid GST number (15 characters, e.g. 33ABCDE1234F1Z5).';
    if (gst.slice(2, 12) !== t(form.pan_no).toUpperCase()) return `The GST number must contain your PAN (${t(form.pan_no).toUpperCase()}) as characters 3 to 12.`;
  }
  if (form.is_msme_avail && !t(form.msme_no)) return 'Enter the MSME (Udyam) number.';
  if (form.pay_via_portal) {
    if (!t(form.payment_portal_name)) return 'Enter the payment portal name.';
    if (!/^https?:\/\/[^\s@]+\.[^\s@]+$/i.test(t(form.payment_portal_url))) return 'Enter the portal web address starting with https://';
  }

  for (const [i, a] of form.addresses.entries()) {
    const where = `Address ${i + 1}: `;
    const miss = need(a.door_no, 'door / building') || need(a.street, 'street') || need(a.area, 'area') || need(a.city, 'city') || need(a.state, 'state');
    if (miss) return where + miss.charAt(0).toLowerCase() + miss.slice(1);
    if (!PINCODE.test(t(a.pincode))) return `${where}enter a 6-digit pincode.`;
  }
  if (form.addresses.length === 0) return 'Add at least one address.';

  if (!form.pay_via_portal) {
    if (form.banks.length === 0) return 'Add your bank account, or choose to be paid through your own portal.';
    for (const [i, b] of form.banks.entries()) {
      const where = `Bank account ${i + 1}: `;
      if (!/^[0-9]{6,18}$/.test(t(b.ac_number))) return `${where}the account number must be 6 to 18 digits.`;
      if (t(b.ac_number).startsWith('0')) return `${where}account numbers starting with 0 cannot be saved here - please send it to the purchase team.`;
      if (!t(b.ac_holder_name)) return `${where}enter the account holder name.`;
      if (!t(b.ac_type)) return `${where}choose the account type.`;
      if (!IFSC.test(t(b.ifsc).toUpperCase())) return `${where}enter a valid IFSC (11 characters, e.g. HDFC0001234).`;
      if (!t(b.bank_name) || !t(b.bank_branch_name) || !t(b.bank_address)) return `${where}enter the bank name, branch and address.`;
    }
  }

  for (const [i, c] of form.contacts.entries()) {
    const where = `Contact ${i + 1}: `;
    if (!t(c.contact_name)) return `${where}enter the name.`;
    if (!MOBILE.test(t(c.contact_mobile).replace(/[\s-]/g, ''))) return `${where}enter a valid mobile number.`;
    if (!EMAIL.test(t(c.contact_email))) return `${where}enter a valid email.`;
  }
  if (form.contacts.length === 0) return 'Add at least one contact.';

  if (!hasPan) return 'Upload your PAN card.';
  return '';
}

/** "7 Nov 2026, 3:30 pm" in the supplier's own time zone; '' for a bad date. */
export function whenText(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── staff: the state of the last link (GET /api/kyc/resubmit/status/:kycId) ───────────────────────────────

export interface LinkStatus {
  link_sno: number; sent_to: string; email_sent: 'Y' | 'N'; email_note: string | null; reject_reason: string; created_by: string;
  created_date: string; expires_at: string; opened_date: string | null; used_date: string | null;
  link_state: 'OPEN' | 'USED' | 'EXPIRED' | 'REPLACED'; resubmit_count: number;
}

export type LinkTone = 'info' | 'success' | 'warning' | 'danger';

/** What staff read about the last correction link of a rejected KYC. `null` status = no link was ever sent (rejected before sql/155). */
export function linkSummary(status: LinkStatus | null): { tone: LinkTone; title: string; lines: string[] } {
  if (!status) {
    return { tone: 'warning', title: 'No correction link has been sent', lines: ['This KYC was rejected before correction links existed, or the e-mail address was missing. Send one so the supplier can fix it.'] };
  }
  const sent = `Sent to ${status.sent_to} on ${whenText(status.created_date)}${status.email_sent === 'Y' ? '' : ' - the e-mail did NOT go out' + (status.email_note ? ` (${status.email_note})` : '')}.`;
  const opened = status.opened_date ? `The supplier opened it on ${whenText(status.opened_date)}.` : 'The supplier has not opened it yet.';
  switch (status.link_state) {
    case 'USED':
      return { tone: 'success', title: 'Corrected and sent again by the supplier', lines: [sent, `Resubmitted on ${whenText(status.used_date)} - it is back with the approver.`] };
    case 'EXPIRED':
      return { tone: 'danger', title: 'The link expired', lines: [sent, `It expired on ${whenText(status.expires_at)}. ${opened}`, 'Send a new link so the supplier can still correct it.'] };
    case 'REPLACED':
      return { tone: 'info', title: 'A newer link replaced this one', lines: [sent, opened] };
    default:
      return { tone: status.email_sent === 'Y' ? 'info' : 'warning', title: 'Waiting for the supplier to correct the KYC', lines: [sent, `Valid until ${whenText(status.expires_at)}. ${opened}`] };
  }
}
