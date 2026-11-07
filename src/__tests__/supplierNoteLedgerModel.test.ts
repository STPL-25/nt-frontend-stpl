import { describe, it, expect } from "vitest";
import {
  checkLedgerFile, groupNotesByInvoice, invoiceKey, ledgersForInvoice, ledgersForNote, targetKey, type LedgerNoteRef,
} from "@/Application/SupplierPortal/supplierNoteLedgerModel";
import type { SupplierNoteLedger } from "@/Services/SupplierService";

const note = (over: Partial<LedgerNoteRef> = {}): LedgerNoteRef => ({
  kind: "DEBIT", sno: 1, invoice: "INV-1", date: "2026-10-20", total_amount: 100, ...over,
});
const ledger = (over: Partial<SupplierNoteLedger> = {}): SupplierNoteLedger => ({
  ledger_sno: 1, scope: "NOTE", note_kind: "DEBIT", note_sno: 1, invoice_no: null,
  file_url: "http://x/dwl/a.pdf", file_name: "a.pdf", remarks: null, uploaded_by: null, uploaded_date: "2026-11-05 10:00:00", ...over,
});

describe("invoiceKey", () => {
  it("ignores case and surrounding spaces; blank means no invoice", () => {
    expect(invoiceKey(" inv-1 ")).toBe("INV-1");
    expect(invoiceKey("INV-1")).toBe(invoiceKey("inv-1"));
    expect(invoiceKey("   ")).toBe("");
    expect(invoiceKey(null)).toBe("");
    expect(invoiceKey(undefined)).toBe("");
  });
});

describe("checkLedgerFile", () => {
  it("accepts PDF, images and Excel / CSV up to 10 MB", () => {
    for (const name of ["a.pdf", "scan.PNG", "p.jpeg", "x.webp", "ledger.xlsx", "ledger.xls", "ledger.csv"]) {
      expect(checkLedgerFile({ name, size: 1024 })).toBeNull();
    }
    expect(checkLedgerFile({ name: "a.pdf", size: 10 * 1024 * 1024 })).toBeNull();
  });
  it("refuses other types, empty files and files over 10 MB", () => {
    expect(checkLedgerFile({ name: "page.html", size: 10 })).toMatch(/PDF/);
    expect(checkLedgerFile({ name: "noext", size: 10 })).toMatch(/PDF/);
    expect(checkLedgerFile({ name: "a.pdf", size: 0 })).toMatch(/empty/);
    expect(checkLedgerFile({ name: "a.pdf", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
  });
});

describe("groupNotesByInvoice", () => {
  it("puts debit and credit notes of one invoice together and nets them (credit - debit)", () => {
    const groups = groupNotesByInvoice([
      note({ kind: "DEBIT", sno: 1, total_amount: 300, invoice: "INV-1" }),
      note({ kind: "CREDIT", sno: 1, total_amount: 120, invoice: "inv-1 " }),   // same invoice typed differently
      note({ kind: "DEBIT", sno: 2, total_amount: 50, invoice: "INV-2", date: "2026-10-25" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["INV-2", "INV-1"]);               // newest note first
    const g1 = groups[1];
    expect(g1).toMatchObject({ invoice_no: "INV-1", debit_count: 1, credit_count: 1, debit_total: 300, credit_total: 120, net: -180 });
  });
  it("leaves out notes that have no invoice number", () => {
    expect(groupNotesByInvoice([note({ invoice: null }), note({ invoice: "  " })])).toEqual([]);
  });
  it("keeps the latest note date of the invoice", () => {
    const [g] = groupNotesByInvoice([note({ date: "2026-10-01" }), note({ sno: 2, date: "2026-10-09" }), note({ sno: 3, date: "2026-10-03" })]);
    expect(g.latest_date).toBe("2026-10-09");
  });
});

describe("ledgersForNote / ledgersForInvoice", () => {
  const all = [
    ledger({ ledger_sno: 1, scope: "NOTE", note_kind: "DEBIT", note_sno: 1 }),
    ledger({ ledger_sno: 2, scope: "NOTE", note_kind: "CREDIT", note_sno: 1 }),     // credit note 1 is NOT debit note 1
    ledger({ ledger_sno: 3, scope: "INVOICE", note_kind: null, note_sno: null, invoice_no: "inv-1" }),
    ledger({ ledger_sno: 4, scope: "INVOICE", note_kind: null, note_sno: null, invoice_no: "INV-2" }),
  ];
  it("a note gets its own ledgers plus the ledgers of its invoice - never another note's", () => {
    const { own, viaInvoice } = ledgersForNote(all, { kind: "DEBIT", sno: 1, invoice: "INV-1" });
    expect(own.map((l) => l.ledger_sno)).toEqual([1]);
    expect(viaInvoice.map((l) => l.ledger_sno)).toEqual([3]);
    const credit = ledgersForNote(all, { kind: "CREDIT", sno: 1, invoice: "INV-1" });
    expect(credit.own.map((l) => l.ledger_sno)).toEqual([2]);
    expect(credit.viaInvoice.map((l) => l.ledger_sno)).toEqual([3]);                // the same invoice ledger covers the credit note too
  });
  it("a note without an invoice is covered by no invoice ledger", () => {
    expect(ledgersForNote(all, { kind: "DEBIT", sno: 9, invoice: null })).toEqual({ own: [], viaInvoice: [] });
    expect(ledgersForInvoice(all, "")).toEqual([]);
  });
  it("invoice ledgers match whatever the case", () => {
    expect(ledgersForInvoice(all, " Inv-2").map((l) => l.ledger_sno)).toEqual([4]);
  });
});

describe("targetKey", () => {
  it("is stable per note / per invoice", () => {
    expect(targetKey({ scope: "NOTE", note_kind: "CREDIT", note_sno: 4 })).toBe("n-CREDIT-4");
    expect(targetKey({ scope: "INVOICE", invoice_no: " inv-1" })).toBe(targetKey({ scope: "INVOICE", invoice_no: "INV-1 " }));
  });
});
