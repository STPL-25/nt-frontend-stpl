import { formatDate } from "@/lib/formatDate";

// Shape of GET /api/kyc/supplier_details/:source/:id — see backend-stpl/sql/108_supplier_full_details.sql.
export interface SupplierFullDetails {
  basic: {
    source: "KYC" | "SERVICE_KYC";
    record_id: number;
    company_name: string | null;
    legal_name: string | null;
    trade_name: string | null;
    supp_code: string | null;
    status: string | null;
    category: string;
    contact_person: string | null;
    email: string | null;
    mobile_number: string | null;
    business_type_name: string | null;
    is_gst_avail: string | null;
    gst_no: string | null;
    gst_status: string | null;
    gst_blk_status: string | null;
    date_of_reg: string | null;
    is_msme_avail: string | null;
    msme_no: string | null;
    pan_no: string | null;
    created_by: string | null;
    created_date: string | null;
    /** 'Y' when the supplier is paid on its own website instead of a bank account (sql/109). */
    pay_via_portal?: string | null;
    payment_portal_name?: string | null;
    payment_portal_url?: string | null;
    payment_instructions?: string | null;
  };
  addresses: Record<string, any>[];
  banks: Record<string, any>[];
  contacts: Record<string, any>[];
  documents: Record<string, any>[];
  verifications: Record<string, any>[];
}

/** A block of the export: label/value facts, or a table with one row per entry. */
export type DetailSection =
  | { kind: "facts"; title: string; facts: [string, string][] }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] };

const STATUS_WORD: Record<string, string> = { A: "Approved", P: "Approval pending", R: "Rejected" };

const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};
const dash = (v: unknown): string => txt(v) || "—";
const yesNo = (v: unknown): string => (txt(v).toUpperCase() === "Y" ? "Yes" : txt(v).toUpperCase() === "N" ? "No" : dash(v));

export const isPrimaryEntry = (e: Record<string, any>): boolean =>
  txt(e.address_type).toUpperCase() === "PRIMARY" ||
  txt(e.contact_type).toUpperCase() === "PRIMARY" ||
  txt(e.is_primary).toUpperCase() === "Y";

/** Every section, in the order they appear in the screen, the Excel workbook and the PDF. */
export function buildSections(d: SupplierFullDetails): DetailSection[] {
  const b = d.basic;
  const sections: DetailSection[] = [
    {
      kind: "facts",
      title: "Supplier details",
      facts: [
        ["Company name", dash(b.company_name)],
        ["Legal name", dash(b.legal_name)],
        ["Trade name", dash(b.trade_name)],
        ["Supplier code", dash(b.supp_code)],
        ["Category", dash(b.category)],
        ["Approval status", STATUS_WORD[b.status ?? ""] ?? dash(b.status)],
        ["Business type", dash(b.business_type_name)],
        ["Contact person", dash(b.contact_person)],
        ["Mobile", dash(b.mobile_number)],
        ["Email", dash(b.email)],
        ["GST registered", yesNo(b.is_gst_avail)],
        ["GST no.", dash(b.gst_no)],
        ["GST status", dash(b.gst_status)],
        ["GST blocked status", dash(b.gst_blk_status)],
        ["Date of registration", dash(formatDate(b.date_of_reg))],
        ["PAN", dash(b.pan_no)],
        ["MSME certified", yesNo(b.is_msme_avail)],
        ["MSME no.", dash(b.msme_no)],
        ["Submitted by", dash(b.created_by)],
        ["Submitted on", dash(formatDate(b.created_date))],
      ],
    },
    {
      kind: "table",
      title: `Addresses / places of business (${d.addresses.length})`,
      columns: ["#", "Type", "Door / Building", "Street", "Area", "City", "Taluk", "State", "State code", "Pincode", "Map link"],
      rows: d.addresses.map((a, i) => [
        String(i + 1), dash(a.address_type), dash(a.door_no), dash(a.street), dash(a.area), dash(a.city),
        dash(a.taluk), dash(a.state), dash(a.state_code), dash(a.pincode), dash(a.location_link),
      ]),
    },
    txt(b.pay_via_portal).toUpperCase() === "Y"
      ? {
          kind: "facts",
          title: "Payment — via supplier website / portal (no bank account)",
          facts: [
            ["Portal name", dash(b.payment_portal_name)],
            ["Portal URL", dash(b.payment_portal_url)],
            ["Payment instructions", dash(b.payment_instructions)],
          ],
        }
      : {
          kind: "table",
          title: `Bank details (${d.banks.length})`,
          columns: ["#", "Account holder", "Account no.", "Account type", "IFSC", "Bank", "Branch", "Bank address", "Primary"],
          rows: d.banks.map((k, i) => [
            String(i + 1), dash(k.ac_holder_name), dash(k.ac_number), dash(k.ac_type_name ?? k.ac_type), dash(k.ifsc),
            dash(k.bank_name), dash(k.bank_branch_name), dash(k.bank_address), yesNo(k.is_primary),
          ]),
        },
    {
      kind: "table",
      title: `Contacts (${d.contacts.length})`,
      columns: ["#", "Type", "Name", "Position", "Mobile", "Email"],
      rows: d.contacts.map((c, i) => [
        String(i + 1), dash(c.contact_type), dash(c.contact_name), dash(c.contact_position), dash(c.contact_mobile), dash(c.contact_email),
      ]),
    },
    {
      kind: "table",
      title: `Documents (${d.documents.length})`,
      columns: ["#", "Type", "Name", "File path", "Uploaded"],
      rows: d.documents.map((x, i) => [
        String(i + 1), dash(x.document_type), dash(x.document_name), dash(x.document_path), dash(formatDate(x.uploaded_date)),
      ]),
    },
  ];

  if (d.verifications.length > 0) {
    sections.push({
      kind: "table",
      title: `Verification results (${d.verifications.length})`,
      columns: ["#", "Check", "Identifier", "Valid", "Status", "Taxpayer type", "Nature of business", "MSME type", "Checked on"],
      rows: d.verifications.map((v, i) => [
        String(i + 1), dash(v.verify_type), dash(v.identifier),
        v.is_valid === true || v.is_valid === 1 ? "Yes" : v.is_valid === false || v.is_valid === 0 ? "No" : "—",
        dash(v.pan_status ?? v.gst_status), dash(v.gst_taxpayer_type),
        dash(v.nature_of_business_activities ?? v.major_activity), dash(v.msme_type), dash(formatDate(v.created_at)),
      ]),
    });
  }
  return sections;
}

const fileStem = (d: SupplierFullDetails): string => {
  const name = (d.basic.company_name || `supplier-${d.basic.record_id}`).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return `Supplier_${name || d.basic.record_id}${d.basic.supp_code ? `_${d.basic.supp_code}` : ""}`;
};

/** One workbook: a "Supplier details" sheet plus one sheet per table section. */
export async function downloadSupplierExcel(d: SupplierFullDetails): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const sheetName = (title: string) => {
    let base = title.replace(/\s*\(\d+\)$/, "").replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Sheet";
    let n = base;
    for (let i = 2; used.has(n); i++) n = `${base} ${i}`;
    used.add(n);
    return n;
  };

  for (const s of buildSections(d)) {
    const aoa = s.kind === "facts" ? [["Field", "Value"], ...s.facts] : [s.columns, ...s.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = aoa[0].map((_, c) => ({ wch: Math.min(60, Math.max(10, ...aoa.map((r) => String(r[c] ?? "").length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName(s.title));
  }
  XLSX.writeFile(wb, `${fileStem(d)}.xlsx`);
}

/** The whole record as a landscape A4 PDF. */
export async function downloadSupplierPdf(d: SupplierFullDetails): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const b = d.basic;

  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(b.company_name || "Supplier", margin, 16);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
  doc.text(
    [b.supp_code ? `Supplier code ${b.supp_code}` : "", STATUS_WORD[b.status ?? ""] ?? "", b.category].filter(Boolean).join("  ·  "),
    margin, 22,
  );
  doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, pageW - margin, 16, { align: "right" });
  doc.setTextColor(0);

  let y = 28;
  const head = { fillColor: [30, 64, 175] as [number, number, number], textColor: 255 };
  for (const s of buildSections(d)) {
    const startY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : y;
    doc.setFont("helvetica", "bold").setFontSize(11);
    if (startY > 190) { doc.addPage(); }
    const titleY = startY > 190 ? 16 : startY;
    doc.text(s.title, margin, titleY);

    if (s.kind === "facts") {
      // two label/value pairs per row keeps the long list on one page
      const rows: string[][] = [];
      for (let i = 0; i < s.facts.length; i += 2) {
        rows.push([...s.facts[i], ...(s.facts[i + 1] ?? ["", ""])]);
      }
      autoTable(doc, {
        startY: titleY + 3, margin: { left: margin, right: margin }, theme: "grid",
        body: rows, styles: { fontSize: 9, cellPadding: 1.8 },
        columnStyles: { 0: { fontStyle: "bold", fillColor: [243, 244, 246], cellWidth: 40 }, 2: { fontStyle: "bold", fillColor: [243, 244, 246], cellWidth: 40 } },
      });
    } else if (s.rows.length === 0) {
      autoTable(doc, {
        startY: titleY + 3, margin: { left: margin, right: margin }, theme: "plain",
        body: [["None on file"]], styles: { fontSize: 9, textColor: 120 },
      });
    } else {
      autoTable(doc, {
        startY: titleY + 3, margin: { left: margin, right: margin }, theme: "grid",
        head: [s.columns], body: s.rows, headStyles: head,
        styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
        columnStyles: { 0: { cellWidth: 8 } },
      });
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFontSize(8).setTextColor(120);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }
  doc.save(`${fileStem(d)}.pdf`);
}
