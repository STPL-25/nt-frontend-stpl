import type { SupplierKycSnapshot } from "@/Services/SupplierService";

/** One change a supplier made to its own KYC on the portal (grn sql/92 kyc_modified_data). */
export interface KycModification {
  kyc_modified_sno: number;
  version_no: number;
  reason: string;
  /** Comma list of BASIC, PAYMENT, ADDRESS, BANK, CONTACT, DOCUMENT. */
  changed_sections: string;
  /** The whole KYC before and after. */
  old_data: SupplierKycSnapshot | null;
  new_data: SupplierKycSnapshot | null;
  source: string;
  modified_by: string;
  modified_date: string;
  files: { file_kind: string; file_name: string; file_path: string; file_size?: number | null }[];
  /** P waiting for approval, A approved (live), R rejected, C withdrawn. Absent on a change made before approval stages existed (applied at once). */
  status?: "P" | "A" | "R" | "C";
  decided_by?: string | null;
  decided_date?: string | null;
  decision_note?: string | null;
  /** The approval stage it waits at (1-based), how many there are, its name, and who must act now. */
  stage_no?: number | null;
  stage_total?: number | null;
  stage_name?: string | null;
  current_approver_ecno?: string | null;
  approvals?: KycApprovalAction[];
}

/** One approve / reject action in a request's approval trail. */
export interface KycApprovalAction {
  seq_no: number;
  stage_name: string | null;
  approver_ecno: string;
  action: "A" | "R";
  note: string | null;
  acted_date: string;
}

/** A change request as the KYC Change Approvals screen lists it: the request plus the supplier it is about. */
export interface KycChangeRequest extends KycModification {
  kyc_basic_info_sno: number;
  supp_code: string | null;
  company_name: string | null;
  pan_no?: string | null;
  /** True when it is this approver's turn. */
  is_mine?: boolean;
}

export const CHANGE_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  P: { label: "Waiting", tone: "warning" },
  A: { label: "Approved", tone: "success" },
  R: { label: "Rejected", tone: "danger" },
  C: { label: "Withdrawn", tone: "neutral" },
};
/** A request with no status was applied at once (made before approval stages existed). */
export const changeStatus = (status: string | null | undefined) => CHANGE_STATUS[status || "A"] ?? CHANGE_STATUS.A;

/** "Stage 1 of 2 (Store Incharge)" */
export const stageText = (m: Pick<KycModification, "stage_no" | "stage_total" | "stage_name">): string =>
  m.stage_no && m.stage_total ? `Stage ${m.stage_no} of ${m.stage_total}${m.stage_name ? ` (${m.stage_name})` : ""}` : "";

/** Changes that move money or who is paid: shown to the approver with extra care. */
export const touchesPayment = (m: Pick<KycModification, "changed_sections">): boolean => /\b(BANK|PAYMENT)\b/.test(m.changed_sections);

export interface ChangeLine { section: string; text: string }

const txt = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const show = (v: unknown): string => txt(v) || "—";
const yesNo = (v: unknown): string => (txt(v).toUpperCase() === "Y" ? "Yes" : "No");

const BASIC_FIELDS: [string, string, (v: unknown) => string][] = [
  ["company_name", "Company name", show], ["legal_name", "Legal name", show], ["trade_name", "Trade name", show],
  ["contact_person", "Contact person", show], ["email", "Email", show], ["mobile_number", "Mobile", show],
  ["business_type_name", "Business type", show],
  ["is_gst_avail", "GST registered", yesNo], ["gst_no", "GST number", show],
  ["is_msme_avail", "MSME registered", yesNo], ["msme_no", "MSME number", show], ["msme_type", "MSME type", show],
];
const PAYMENT_FIELDS: [string, string, (v: unknown) => string][] = [
  ["pay_via_portal", "Payment method", (v) => (txt(v).toUpperCase() === "Y" ? "Through supplier portal" : "Bank transfer")],
  ["payment_portal_name", "Portal name", show], ["payment_portal_url", "Portal address", show], ["payment_instructions", "Payment instructions", show],
];
const ADDRESS_FIELDS: [string, string][] = [
  ["door_no", "Door / building"], ["street", "Street"], ["area", "Area"], ["city", "City"], ["taluk", "Taluk"], ["state", "State"],
  ["state_code", "State code"], ["pincode", "Pincode"], ["location_link", "Map link"], ["is_primary", "Primary"],
];
const BANK_FIELDS: [string, string][] = [
  ["ac_holder_name", "Account holder"], ["ac_number", "Account number"], ["ac_type_name", "Account type"], ["ifsc", "IFSC"],
  ["bank_name", "Bank"], ["bank_branch_name", "Branch"], ["bank_address", "Bank address"], ["is_primary", "Primary"],
];
const CONTACT_FIELDS: [string, string][] = [
  ["contact_name", "Name"], ["contact_position", "Position"], ["contact_mobile", "Mobile"], ["contact_email", "Email"], ["contact_type", "Type"],
];

type Row = Record<string, unknown>;
const rowsBy = (rows: Row[] | undefined, key: string): Map<number, Row> => new Map((rows ?? []).map((r) => [Number(r[key]), r]));
const oneLine = (r: Row, fields: [string, string][]): string => fields.map(([f]) => txt(r[f])).filter(Boolean).join(", ") || "—";

function diffRows(
  section: string, noun: string, key: string, a: Row[] | undefined, b: Row[] | undefined,
  fields: [string, string][], name: (r: Row) => string,
): ChangeLine[] {
  const before = rowsBy(a, key);
  const after = rowsBy(b, key);
  const out: ChangeLine[] = [];
  for (const [id, r] of after) {
    const was = before.get(id);
    if (!was) { out.push({ section, text: `${noun} added: ${name(r)}` }); continue; }
    for (const [f, label] of fields) {
      if (txt(was[f]) !== txt(r[f])) {
        const fmt = (v: unknown) => (f === "is_primary" ? (txt(v) === "Y" ? "Yes" : "No") : show(v));
        out.push({ section, text: `${noun} (${name(was)}) - ${label}: ${fmt(was[f])} → ${fmt(r[f])}` });
      }
    }
  }
  for (const [id, r] of before) if (!after.has(id)) out.push({ section, text: `${noun} removed: ${name(r)}` });
  return out;
}

/** What a change did, one line per value: "Company details - Email: a@x.com → b@x.com", "Bank account added: ...". */
export function describeChange(m: Pick<KycModification, "old_data" | "new_data">): ChangeLine[] {
  const o = m.old_data;
  const n = m.new_data;
  if (!o || !n) return [];
  const out: ChangeLine[] = [];

  for (const [f, label, fmt] of BASIC_FIELDS) {
    const was = (o.basic as unknown as Row)[f];
    const now = (n.basic as unknown as Row)[f];
    if (txt(was) !== txt(now)) out.push({ section: "Company details", text: `${label}: ${fmt(was)} → ${fmt(now)}` });
  }
  for (const [f, label, fmt] of PAYMENT_FIELDS) {
    const was = (o.payment as unknown as Row)[f];
    const now = (n.payment as unknown as Row)[f];
    if (txt(was) !== txt(now)) out.push({ section: "Payment method", text: `${label}: ${fmt(was)} → ${fmt(now)}` });
  }
  out.push(...diffRows("Addresses", "Address", "kyc_address_sno", o.addresses as unknown as Row[], n.addresses as unknown as Row[], ADDRESS_FIELDS, (r) => oneLine(r, ADDRESS_FIELDS.slice(0, 6))));
  out.push(...diffRows("Bank accounts", "Bank account", "kyc_bank_sno", o.banks as unknown as Row[], n.banks as unknown as Row[], BANK_FIELDS, (r) => `${show(r.bank_name)} ${show(r.ac_number)}`));
  out.push(...diffRows("Contacts", "Contact", "kyc_contact_sno", o.contacts as unknown as Row[], n.contacts as unknown as Row[], CONTACT_FIELDS, (r) => show(r.contact_name)));

  // a document is replaced, never edited: the old copy goes, the new one comes
  const docs = (r: Row) => `${show(r.document_type)} (${show(r.document_name)})`;
  const beforeDocs = rowsBy(o.documents as unknown as Row[], "kyc_document_sno");
  const afterDocs = rowsBy(n.documents as unknown as Row[], "kyc_document_sno");
  for (const [id, r] of afterDocs) if (!beforeDocs.has(id)) out.push({ section: "Documents", text: `Document added: ${docs(r)}` });
  for (const [id, r] of beforeDocs) if (!afterDocs.has(id)) out.push({ section: "Documents", text: `Document replaced / removed: ${docs(r)}` });
  return out;
}

/** "Authorization letter" files of a change. */
export const authorizationFiles = (m: Pick<KycModification, "files">) => m.files.filter((f) => f.file_kind === "AUTHORIZATION");
