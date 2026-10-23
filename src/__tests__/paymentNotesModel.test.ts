import { describe, it, expect } from "vitest";
import {
  invoiceSnosOf, keepOffered, noteSourceLine, stillPayable, withoutRedeemed,
} from "@/Application/Payment/paymentNotesModel";
import type { PaymentAdjustments, PendingNote } from "@/Services/GrnService/paymentNetApi";

const note = (over: Partial<PendingNote> = {}): PendingNote => ({
  note_sno: 1, note_no: "DN-1", po_basic_sno: 10, note_date: "2026-10-20", amount: 100, remarks: null,
  scope: "OWN", source_invoices: "INV-2026-000017 (NEO/586)",
  ...over,
});

const adj = (over: Partial<PaymentAdjustments> = {}): PaymentAdjustments => ({
  advances: [], tdsSections: [],
  debitNotes: [note({ note_sno: 7, note_no: "DN-7" }), note({ note_sno: 8, note_no: "DN-8", scope: "SUPPLIER" })],
  creditNotes: [note({ note_sno: 7, note_no: "CN-7" })],   // same number as a debit note: the two series are independent
  ...over,
});

describe("invoiceSnosOf", () => {
  it("lists each invoice once, sorted - several buckets of one invoice are one invoice", () => {
    expect(invoiceSnosOf([{ invoice_sno: 14 }, { invoice_sno: 12 }, { invoice_sno: 14 }, { invoice_sno: 17 }])).toEqual([12, 14, 17]);
    expect(invoiceSnosOf([])).toEqual([]);
  });
});

describe("keepOffered / stillPayable", () => {
  it("drops ticks whose note is no longer on offer", () => {
    expect([...keepOffered(new Set([7, 8, 9]), adj().debitNotes)]).toEqual([7, 8]);
    expect(keepOffered(new Set([7]), []).size).toBe(0);
  });

  it("drops ticked bills that were paid meanwhile", () => {
    expect([...stillPayable(new Set([1, 2, 3]), [{ bill_sno: 2 }, { bill_sno: 3 }, { bill_sno: 9 }])]).toEqual([2, 3]);
  });
});

describe("withoutRedeemed", () => {
  it("takes a redeemed debit note off the screen and reports it", () => {
    const { adj: next, dropped } = withoutRedeemed(adj(), [{ type: "DEBIT", note_sno: 8 }]);
    expect(next.debitNotes.map((n) => n.note_no)).toEqual(["DN-7"]);
    expect(next.creditNotes.map((n) => n.note_no)).toEqual(["CN-7"]);
    expect(dropped.map((n) => n.note_no)).toEqual(["DN-8"]);
  });

  it("a debit note and a credit note with the same number are different notes", () => {
    const { adj: next, dropped } = withoutRedeemed(adj(), [{ type: "CREDIT", note_sno: 7 }]);
    expect(next.debitNotes.map((n) => n.note_no)).toEqual(["DN-7", "DN-8"]);
    expect(next.creditNotes).toEqual([]);
    expect(dropped.map((n) => n.note_no)).toEqual(["CN-7"]);
  });

  it("handles a payment that redeemed nothing this screen offers, and string ids from the wire", () => {
    const base = adj();
    const { adj: same, dropped } = withoutRedeemed(base, [{ type: "DEBIT", note_sno: 99 }]);
    expect(dropped).toEqual([]);
    expect(same.debitNotes).toHaveLength(2);
    expect(withoutRedeemed(base, [{ type: "DEBIT", note_sno: "7" as unknown as number }]).dropped.map((n) => n.note_no)).toEqual(["DN-7"]);
  });

  it("leaves advances and TDS sections untouched", () => {
    const base = adj({ advances: [{ advance_sno: 1, advance_no: "ADV-1", po_basic_sno: null, paid_date: "2026-10-01", amount: 5, balance: 5 }] });
    expect(withoutRedeemed(base, [{ type: "DEBIT", note_sno: 7 }]).adj.advances).toBe(base.advances);
  });
});

describe("noteSourceLine", () => {
  it("says a note belongs to this bill", () => {
    expect(noteSourceLine(note())).toBe("Raised against this bill - INV-2026-000017 (NEO/586)");
  });

  it("says a note is the supplier's credit from a bill that is already paid", () => {
    expect(noteSourceLine(note({ scope: "SUPPLIER" }))).toBe("Supplier credit - raised against paid bill INV-2026-000017 (NEO/586)");
  });

  it("says a supplier credit has no invoice yet when it was raised on a PO whose invoice is not entered", () => {
    expect(noteSourceLine(note({ scope: "SUPPLIER", source_invoices: null }))).toBe("Supplier credit - its invoice is not entered yet");
  });

  it("shows nothing for a note of this bill when the server gave no bill reference", () => {
    expect(noteSourceLine(note({ source_invoices: null }))).toBeNull();
    expect(noteSourceLine(note({ source_invoices: undefined }))).toBeNull();
  });
});
