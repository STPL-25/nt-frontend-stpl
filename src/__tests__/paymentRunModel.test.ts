import { describe, it, expect } from "vitest";
import {
  amountInWords, blockReason, dueState, groupLines, inBankFile, msmeNote, notInFileReason, parseAmountInput, pickSender, planFund, rankEntries,
  senderLabel, senderProblem, totalOf,
} from "@/Application/Payment/paymentRunModel";
import type { PaymentEntry, PaymentEntryLine, PaymentSender } from "@/Services/GrnService/paymentNetApi";

let seq = 0;
const entry = (over: Partial<PaymentEntry> = {}): PaymentEntry => ({
  payment_sno: ++seq, payment_no: `PAY-${seq}`, vendor_sno: 1, vendor_name: "Supplier", supp_code: null, vendor_email: null, mode: "NEFT",
  debit_account: null, reference_no: null, remarks: null, payment_date: "2026-10-22", status: "Approved", current_approver_id: null, workflow_types_id: null,
  created_by: "KTM1148", created_at: "2026-10-22T10:00:00.000Z", approved_at: null, processed_at: null, batch_sno: null, batch_no: null,
  gross_amount: 100, tds_amount: 0, advance_adjusted: 0, note_adjusted: 0, net_paid: 100, amount: 100,
  com_sno: 1, div_sno: 1, brn_sno: 1, dept_sno: 1, com_name: "Co",
  msme_class: null, msme_label: null, msme_tier: 4, msme_no: null, is_statutory: false,
  pay_via_portal: false, payment_portal_name: null, payment_portal_url: null,
  ac_holder_name: "X", ac_number: "123", ifsc: "KKBK0000961", bank_name: "Bank", bank_branch_name: null, channel: "BANK", bank_ready: true,
  invoice_count: 1, invoice_nos: null, supplier_invoice_nos: null, po_nos: null, gate_entry_nos: null, grn_nos: null,
  first_gate_entry_date: null, first_grn_date: null, accepted_date: "2026-10-01", due_date: "2026-11-01", statutory_due_date: null,
  days_to_due: 10, is_overdue: false,
  ...over,
});
const ids = (list: PaymentEntry[]) => list.map((e) => e.payment_no);

describe("rankEntries", () => {
  const micro = entry({ payment_no: "micro", msme_tier: 1, msme_class: "MICRO", due_date: "2026-11-20", accepted_date: "2026-10-05" });
  const small = entry({ payment_no: "small", msme_tier: 2, msme_class: "SMALL", due_date: "2026-11-02", accepted_date: "2026-10-03" });
  const medium = entry({ payment_no: "medium", msme_tier: 3, msme_class: "MEDIUM", due_date: "2026-10-30", accepted_date: "2026-09-01" });
  const overdueOther = entry({ payment_no: "overdue-other", msme_tier: 4, due_date: "2026-10-10", accepted_date: "2026-09-10" });
  const laterOther = entry({ payment_no: "later-other", msme_tier: 4, due_date: "2026-11-30", accepted_date: "2026-10-20" });
  const all = [laterOther, medium, overdueOther, small, micro];

  it("MSME first: Micro, Small, Medium, then everyone else - each group by due date", () => {
    expect(ids(rankEntries(all, "MSME_FIRST"))).toEqual(["micro", "small", "medium", "overdue-other", "later-other"]);
  });

  it("earliest due date ignores the MSME type except as a tie-break", () => {
    expect(ids(rankEntries(all, "DUE_DATE"))).toEqual(["overdue-other", "medium", "small", "micro", "later-other"]);
    const tie = [entry({ payment_no: "b", msme_tier: 4, due_date: "2026-11-01" }), entry({ payment_no: "a", msme_tier: 1, due_date: "2026-11-01" })];
    expect(ids(rankEntries(tie, "DUE_DATE"))).toEqual(["a", "b"]);
  });

  it("oldest goods received first", () => {
    expect(ids(rankEntries(all, "OLDEST_RECEIPT"))).toEqual(["medium", "overdue-other", "small", "micro", "later-other"]);
  });

  it("a payment with no due date or no receipt date goes last in its group, and the input is not reordered", () => {
    const none = entry({ payment_no: "none", msme_tier: 1, due_date: null, accepted_date: null });
    const dated = entry({ payment_no: "dated", msme_tier: 1, due_date: "2026-12-31" });
    const input = [none, dated];
    expect(ids(rankEntries(input, "MSME_FIRST"))).toEqual(["dated", "none"]);
    expect(ids(input)).toEqual(["none", "dated"]);
  });

  it("equal rank: the smaller amount first, then the older payment", () => {
    const a = entry({ payment_no: "big", net_paid: 900 });
    const b = entry({ payment_no: "small", net_paid: 100 });
    expect(ids(rankEntries([a, b], "MSME_FIRST"))).toEqual(["small", "big"]);
  });
});

describe("planFund", () => {
  const a = entry({ payment_no: "A", net_paid: 600_000 });
  const b = entry({ payment_no: "B", net_paid: 300_000 });
  const c = entry({ payment_no: "C", net_paid: 200_000 });
  const d = entry({ payment_no: "D", net_paid: 50_000 });

  it("takes payments in order while the fund lasts", () => {
    const p = planFund([a, b, c, d], 1_000_000);
    expect(ids([a, b, c, d].filter((e) => p.picked.has(e.payment_sno)))).toEqual(["A", "B", "D"]);
    expect(p.used).toBe(950_000);
    expect(p.left).toBe(50_000);
  });

  it("a payment that does not fit is skipped, not a stop: a smaller one further down still uses the money", () => {
    const p = planFund([a, b, c, d], 700_000);
    expect(p.verdict.get(a.payment_sno)).toBe("PAY");
    expect(p.verdict.get(b.payment_sno)).toBe("SHORT");   // 100,000 left, needs 300,000
    expect(p.verdict.get(c.payment_sno)).toBe("SHORT");
    expect(p.verdict.get(d.payment_sno)).toBe("PAY");
    expect(p.needs.get(b.payment_sno)).toBe(200_000);     // 300,000 - 100,000 left when its turn came
    expect(p.left).toBe(50_000);
  });

  it("covers a payment to the paisa, and reports a shortfall of one paisa", () => {
    const x = entry({ net_paid: 0.1 });
    const y = entry({ net_paid: 0.2 });
    expect(planFund([x, y], 0.3).picked.size).toBe(2);                  // 0.1 + 0.2 is not 0.3 in floating point; paise are
    const z = entry({ net_paid: 100.01 });
    const p = planFund([z], 100);
    expect(p.verdict.get(z.payment_sno)).toBe("SHORT");
    expect(p.needs.get(z.payment_sno)).toBe(0.01);
  });

  it("never takes a bank transfer whose supplier has no bank account, and says so", () => {
    const noBank = entry({ payment_no: "nobank", net_paid: 10, bank_ready: false });
    expect(blockReason(noBank)).toMatch(/bank account/);
    const p = planFund([noBank, a], 1_000_000);
    expect(p.verdict.get(noBank.payment_sno)).toBe("BLOCKED");
    expect(p.picked.has(noBank.payment_sno)).toBe(false);
    expect(p.picked.has(a.payment_sno)).toBe(true);
  });

  it("cheque / portal payments are not blocked by missing bank details, and a payment with nothing to pay out costs no fund", () => {
    const cheque = entry({ channel: "MANUAL", bank_ready: true, ac_number: null, net_paid: 500 });
    const setOff = entry({ channel: "ADJUSTMENT", net_paid: 0 });
    expect(blockReason(cheque)).toBe("");
    const p = planFund([cheque, setOff], 500);
    expect(p.picked.size).toBe(2);
    expect(p.left).toBe(0);
  });

  it("with no fund only zero-value payments are covered", () => {
    const setOff = entry({ net_paid: 0, channel: "ADJUSTMENT" });
    const p = planFund([a, setOff], 0);
    expect([...p.picked]).toEqual([setOff.payment_sno]);
    expect(p.verdict.get(a.payment_sno)).toBe("SHORT");
  });
});

describe("totalOf / groupLines", () => {
  it("adds up the ticked payments in paise", () => {
    const x = entry({ net_paid: 0.1 }); const y = entry({ net_paid: 0.2 }); const z = entry({ net_paid: 5 });
    expect(totalOf([x, y, z], new Set([x.payment_sno, y.payment_sno]))).toBe(0.3);
    expect(totalOf([x, y, z], new Set())).toBe(0);
  });

  it("groups the invoice lines by payment, keeping their order", () => {
    const line = (payment_sno: number, invoice_no: string) => ({ payment_sno, invoice_no } as PaymentEntryLine);
    const g = groupLines([line(1, "I1"), line(2, "I2"), line(1, "I3")]);
    expect(g.get(1)?.map((l) => l.invoice_no)).toEqual(["I1", "I3"]);
    expect(g.get(2)).toHaveLength(1);
  });
});

describe("dueState", () => {
  it("overdue, today, the coming week and later", () => {
    const due = (d: number | null) => dueState({ due_date: d == null ? null : "2026-11-01", days_to_due: d });
    expect(due(-12)).toEqual({ text: "Overdue 12 days", tone: "danger" });
    expect(due(-1)).toEqual({ text: "Overdue 1 day", tone: "danger" });
    expect(due(0)).toEqual({ text: "Due today", tone: "warning" });
    expect(due(5)).toEqual({ text: "Due in 5 days", tone: "warning" });
    expect(due(30)).toEqual({ text: "Due in 30 days", tone: "neutral" });
    expect(due(null)).toEqual({ text: "No due date", tone: "neutral" });
  });
});

describe("msmeNote", () => {
  it("Micro / Small carry the statutory limit and the date, Medium does not, a non-MSME has no chip", () => {
    expect(msmeNote({ msme_class: "MICRO", msme_label: "Micro", statutory_due_date: "2026-11-29T00:00:00.000Z" }, 45))
      .toEqual({ label: "Micro MSME", hint: "Statutory limit 45 days from goods received - pay by 2026-11-29" });
    expect(msmeNote({ msme_class: "MEDIUM", msme_label: "Medium", statutory_due_date: null }, 45)?.hint).toMatch(/does not apply/);
    expect(msmeNote({ msme_class: "MSME", msme_label: "MSME", statutory_due_date: null }, 45)).toMatchObject({ label: "MSME" });
    expect(msmeNote({ msme_class: "MSME", msme_label: "MSME", statutory_due_date: null }, 45)?.hint).toMatch(/not recorded/);
    expect(msmeNote({ msme_class: null, msme_label: null, statutory_due_date: null }, 45)).toBeNull();
  });
});

describe("the bank file: which payments are a line of it", () => {
  it("only a bank transfer by NEFT or RTGS is - whatever the case of the mode", () => {
    expect(inBankFile(entry({ channel: "BANK", mode: "NEFT" }))).toBe(true);
    expect(inBankFile(entry({ channel: "BANK", mode: "rtgs" }))).toBe(true);
    expect(inBankFile(entry({ channel: "BANK", mode: "UPI" }))).toBe(false);
    expect(inBankFile(entry({ channel: "MANUAL", mode: "Cheque" }))).toBe(false);
    expect(inBankFile(entry({ channel: "PORTAL", mode: "NEFT" }))).toBe(false);
    expect(inBankFile(entry({ channel: "ADJUSTMENT", mode: "NEFT", net_paid: 0 }))).toBe(false);
  });

  it("says why a payment is left out: how it is paid instead, or that UPI is not in the file", () => {
    expect(notInFileReason(entry({ channel: "BANK", mode: "NEFT" }))).toBe("");
    expect(notInFileReason(entry({ channel: "MANUAL", mode: "Cash" }))).toBe("Cheque / cash / DD");
    expect(notInFileReason(entry({ channel: "PORTAL", mode: "NEFT" }))).toBe("Supplier portal");
    expect(notInFileReason(entry({ channel: "ADJUSTMENT", mode: "NEFT" }))).toBe("Nothing to pay out");
    expect(notInFileReason(entry({ channel: "BANK", mode: "UPI" }))).toBe("UPI - not in the bank file");
  });
});

describe("the account a run is paid from", () => {
  const sender = (over: Partial<PaymentSender> = {}): PaymentSender => ({
    payment_bank_sno: 1, com_sno: 1, com_name: "Space Textiles", profile_name: "HDFC Current A/c", bank_name: "HDFC BANK LIMITED", branch_name: "Coimbatore",
    ac_holder_name: "Space Textiles Pvt Ltd", ac_last4: "5678", ifsc: "HDFC0000123", file_type: "BANK_UPLOAD", client_code: "SPA311", alert_email: null, is_default: "N", ...over,
  });
  const hdfc = sender({ payment_bank_sno: 1, is_default: "Y" });
  const kotak = sender({ payment_bank_sno: 2, profile_name: "Kotak Current A/c", bank_name: "KOTAK", ac_last4: "3344" });

  it("is the one the user chose, else the company's default, else the only one", () => {
    expect(pickSender([hdfc, kotak], "2")?.payment_bank_sno).toBe(2);
    expect(pickSender([hdfc, kotak], "")?.payment_bank_sno).toBe(1);
    expect(pickSender([sender({ payment_bank_sno: 9 })], "")?.payment_bank_sno).toBe(9);
  });

  it("falls back to the default when the chosen account is no longer offered (another company was selected)", () => {
    expect(pickSender([hdfc, kotak], "77")?.payment_bank_sno).toBe(1);
  });

  it("is nobody when there are several accounts and no default: the user has to choose", () => {
    expect(pickSender([sender({ payment_bank_sno: 3 }), kotak], "")).toBeNull();
    expect(pickSender([], "")).toBeNull();
  });

  it("describes an account by name, bank and the last 4 digits only", () => {
    expect(senderLabel(hdfc)).toBe("HDFC Current A/c · HDFC BANK LIMITED ••••5678");
  });

  it("a run with no bank transfer needs no account at all", () => {
    expect(senderProblem(0, [], "")).toBeNull();
    expect(senderProblem(0, [hdfc, kotak], "")).toBeNull();
  });

  it("a run with bank transfers cannot go ahead without an account: none set up, or several and none picked", () => {
    expect(senderProblem(3, [], "")).toMatch(/Masters > Payment Bank/);
    expect(senderProblem(3, [sender({ payment_bank_sno: 3 }), kotak], "")).toMatch(/Choose the bank account/);
    expect(senderProblem(3, [hdfc, kotak], "")).toBeNull();
    expect(senderProblem(3, [sender({ payment_bank_sno: 3 }), kotak], "2")).toBeNull();
  });
});

describe("parseAmountInput / amountInWords", () => {
  it("reads rupees written the way people say them", () => {
    expect(parseAmountInput("50,00,000")).toBe(5_000_000);
    expect(parseAmountInput("₹ 50 lakh")).toBe(5_000_000);
    expect(parseAmountInput("50lakhs")).toBe(5_000_000);
    expect(parseAmountInput("50L")).toBe(5_000_000);
    expect(parseAmountInput("1.5 cr")).toBe(15_000_000);
    expect(parseAmountInput("2 Crore")).toBe(20_000_000);
    expect(parseAmountInput("75k")).toBe(75_000);
    expect(parseAmountInput("Rs. 1200.50")).toBe(1200.5);
  });

  it("is null for anything that is not a positive amount", () => {
    for (const bad of ["", "abc", "-5", "0", "5 million", "1.2.3", "lakh"]) expect(parseAmountInput(bad)).toBeNull();
  });

  it("says a large amount in lakh / crore", () => {
    expect(amountInWords(5_000_000)).toBe("50 Lakh");
    expect(amountInWords(12_500_000)).toBe("1.25 Crore");
    expect(amountInWords(150_000)).toBe("1.5 Lakh");
    expect(amountInWords(99_999)).toBe("");
    expect(amountInWords(NaN)).toBe("");
  });
});
