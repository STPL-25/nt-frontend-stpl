import type { SupplierKycSnapshot } from "@/Services/SupplierService";
import { DOCUMENT_LABEL } from "@/Application/SupplierPortal/supplierKycModel";

/**
 * The KYC Approval screen shows a supplier's change request as two records side by side: the KYC as it is now ("previous record") and
 * the KYC as it will be once the request is approved ("current record"). This builds that comparison from the two snapshots a request
 * carries (grn sql/92 fn_nt_KycSnapshot): company details and payment method field by field, and every address / bank account /
 * contact / document paired up by its row id so an edited row shows both versions, a new row shows as added and a dropped one as removed.
 */

export type RowKind = "same" | "changed" | "added" | "removed";
export type SectionKey = "BASIC" | "PAYMENT" | "ADDRESS" | "BANK" | "CONTACT" | "DOCUMENT";

export interface FieldDiff { label: string; previous: string; current: string; changed: boolean }
export interface RowDiff { id: number; kind: RowKind; title: string; fields: FieldDiff[] }
export interface DocDiff { id: number; kind: "same" | "added" | "removed"; type: string; typeLabel: string; name: string; path: string | null }
export interface CompareSection {
  key: SectionKey;
  title: string;
  /** Anything in this section differs. */
  changed: boolean;
  fields?: FieldDiff[];
  rows?: RowDiff[];
  documents?: DocDiff[];
}

type Row = Record<string, unknown>;
type Def = [key: string, label: string, format?: (v: unknown) => string];

const txt = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const show = (v: unknown): string => txt(v) || "—";
const yesNo = (v: unknown): string => (txt(v).toUpperCase() === "Y" ? "Yes" : "No");

const BASIC: Def[] = [
  ["company_name", "Company name"], ["legal_name", "Legal name"], ["trade_name", "Trade name"],
  ["business_type_name", "Business type"], ["contact_person", "Contact person"], ["mobile_number", "Mobile"], ["email", "Email"],
  ["pan_no", "PAN"], ["is_gst_avail", "GST registered", yesNo], ["gst_no", "GST number"],
  ["is_msme_avail", "MSME registered", yesNo], ["msme_no", "MSME number"], ["msme_type", "MSME type"],
];
const PAYMENT: Def[] = [
  ["pay_via_portal", "Payment method", (v) => (txt(v).toUpperCase() === "Y" ? "Through the supplier's own portal" : "Bank transfer")],
  ["payment_portal_name", "Portal name"], ["payment_portal_url", "Portal address"], ["payment_instructions", "Payment instructions"],
];
const ADDRESS: Def[] = [
  ["door_no", "Door / building"], ["street", "Street"], ["area", "Area"], ["city", "City"], ["taluk", "Taluk"], ["state", "State"],
  ["state_code", "State code"], ["pincode", "Pincode"], ["location_link", "Map link"], ["is_primary", "Primary", yesNo],
];
const BANK: Def[] = [
  ["ac_holder_name", "Account holder"], ["ac_number", "Account number"], ["ac_type_name", "Account type"], ["ifsc", "IFSC"],
  ["bank_name", "Bank"], ["bank_branch_name", "Branch"], ["bank_address", "Bank address"], ["is_primary", "Primary", yesNo],
];
const CONTACT: Def[] = [
  ["contact_name", "Name"], ["contact_position", "Position"], ["contact_mobile", "Mobile"], ["contact_email", "Email"], ["is_primary", "Primary", yesNo],
];

const fieldDiffs = (defs: Def[], prev: Row | undefined, next: Row | undefined): FieldDiff[] =>
  defs.map(([key, label, fmt]) => {
    const f = fmt ?? show;
    const was = prev ? txt(prev[key]) : "";
    const now = next ? txt(next[key]) : "";
    return { label, previous: prev ? f(prev[key]) : "—", current: next ? f(next[key]) : "—", changed: was !== now };
  });

function rowDiffs(
  key: string, prev: Row[] | undefined, next: Row[] | undefined, defs: Def[], title: (r: Row, n: number) => string,
): RowDiff[] {
  const was = new Map((prev ?? []).map((r) => [Number(r[key]), r]));
  const now = new Map((next ?? []).map((r) => [Number(r[key]), r]));
  const ids = [...was.keys(), ...[...now.keys()].filter((id) => !was.has(id))];
  return ids.map((id, i) => {
    const a = was.get(id);
    const b = now.get(id);
    const fields = fieldDiffs(defs, a, b);
    const kind: RowKind = !a ? "added" : !b ? "removed" : fields.some((f) => f.changed) ? "changed" : "same";
    return { id, kind, title: title((b ?? a) as Row, i + 1), fields };
  });
}

/** Contacts have no is_primary column: the type says it. */
const withPrimary = (rows: Row[] | undefined): Row[] | undefined =>
  rows?.map((c) => ({ ...c, is_primary: txt(c.contact_type).toUpperCase() === "PRIMARY" ? "Y" : "N" }));

/** business_type is a master id; the snapshot also carries its name (older rows may hold free text instead). */
const withBusinessName = (b: SupplierKycSnapshot["basic"] | undefined): Row | undefined =>
  b ? { ...(b as unknown as Row), business_type_name: txt(b.business_type_name) || txt(b.business_type) } : undefined;

/** Previous record vs current record, section by section. Either side may be missing (an old request without snapshots). */
export function compareSnapshots(previous: SupplierKycSnapshot | null | undefined, current: SupplierKycSnapshot | null | undefined): CompareSection[] {
  const p = previous ?? undefined;
  const c = current ?? undefined;

  const basic = fieldDiffs(BASIC, withBusinessName(p?.basic), withBusinessName(c?.basic));
  const payment = fieldDiffs(PAYMENT, p?.payment as unknown as Row | undefined, c?.payment as unknown as Row | undefined);
  const addresses = rowDiffs("kyc_address_sno", p?.addresses as unknown as Row[], c?.addresses as unknown as Row[], ADDRESS,
    (r, n) => (txt(r.is_primary) === "Y" ? "Primary address" : `Address ${n}`));
  const banks = rowDiffs("kyc_bank_sno", p?.banks as unknown as Row[], c?.banks as unknown as Row[], BANK,
    (r, n) => txt(r.bank_name) || `Bank account ${n}`);
  const contacts = rowDiffs("kyc_contact_sno", withPrimary(p?.contacts as unknown as Row[]), withPrimary(c?.contacts as unknown as Row[]), CONTACT,
    (r, n) => txt(r.contact_name) || `Contact ${n}`);

  const was = new Map((p?.documents ?? []).map((d) => [d.kyc_document_sno, d]));
  const now = new Map((c?.documents ?? []).map((d) => [d.kyc_document_sno, d]));
  const documents: DocDiff[] = [...was.keys(), ...[...now.keys()].filter((id) => !was.has(id))].map((id) => {
    const d = (now.get(id) ?? was.get(id))!;
    return {
      id, kind: !was.has(id) ? "added" : !now.has(id) ? "removed" : "same",
      type: txt(d.document_type), typeLabel: DOCUMENT_LABEL[txt(d.document_type)] ?? (txt(d.document_type) || "File"),
      name: txt(d.document_name) || "Document", path: d.document_path ?? null,
    };
  });

  return [
    { key: "BASIC", title: "Company details", changed: basic.some((f) => f.changed), fields: basic },
    { key: "PAYMENT", title: "Payment method", changed: payment.some((f) => f.changed), fields: payment },
    { key: "ADDRESS", title: "Addresses", changed: addresses.some((r) => r.kind !== "same"), rows: addresses },
    { key: "BANK", title: "Bank accounts", changed: banks.some((r) => r.kind !== "same"), rows: banks },
    { key: "CONTACT", title: "Contacts", changed: contacts.some((r) => r.kind !== "same"), rows: contacts },
    { key: "DOCUMENT", title: "Documents", changed: documents.some((d) => d.kind !== "same"), documents },
  ];
}
