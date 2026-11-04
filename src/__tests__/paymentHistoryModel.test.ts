import { describe, it, expect } from "vitest";
import {
  compactRupees, countWords, filterHistory, fundUsePct, groupHistoryByDay, itemTotals, lineKind, linesByItem, localYmd, monthSummary, payeeSummary,
  rangeBounds, runStatus, sumHistory, toHistoryItems, type HistoryFilter,
} from "@/Application/Payment/paymentHistoryModel";
import type { PaymentBatch, PaymentBatchItem, PaymentBatchLine, PortalPayment } from "@/Services/GrnService/paymentNetApi";

const run = (over: Partial<PaymentBatch> = {}): PaymentBatch => ({
  batch_sno: 1, batch_no: "PB-1", batch_date: "2026-11-02T00:00:00.000Z", com_sno: 1, com_name: "Space", div_sno: 1, div_name: "SKTM", brn_sno: 1, brn_name: "CBE",
  fund_plan_amount: 1000, total_amount: 500, item_count: 1, status: "Generated", file_name: "F.100", has_file: true, created_by: "KTM1148",
  created_at: "2026-11-02 10:00:00", payment_bank_sno: 3, sender_bank_name: "HDFC", sender_ac_last4: "1234", vendor_names: ["NEO DIAMONDS"], payment_nos: ["PAY-1"],
  ...over,
});
const txn = (over: Partial<PortalPayment> = {}): PortalPayment => ({
  txn_sno: 1, payment_sno: 9, payment_no: "PAY-9", vendor_name: "Amazon Web Service", supp_code: "SVK-1", portal_name: null, txn_mode: "UPI", txn_id: "8525",
  txn_date: "2026-11-02T00:00:00.000Z", net_paid: 2124, amount_paid: 2024, discount_amount: 100, remarks: null, recorded_by: "KTM1148",
  recorded_at: "2026-11-02 18:34:50", com_sno: 1, com_name: "Space", ...over,
});
const none: HistoryFilter = { from: null, to: null, search: "", scope: "", bank: "", kind: "ALL" };

describe("rangeBounds", () => {
  it("gives inclusive local-day bounds, including across a month / year end", () => {
    expect(rangeBounds("7D", "2026-11-03")).toEqual({ from: "2026-10-28", to: "2026-11-03" });
    expect(rangeBounds("30D", "2026-11-03")).toEqual({ from: "2026-10-05", to: "2026-11-03" });
    expect(rangeBounds("MONTH", "2026-11-03")).toEqual({ from: "2026-11-01", to: "2026-11-03" });
    expect(rangeBounds("LAST_MONTH", "2026-11-03")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeBounds("LAST_MONTH", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(rangeBounds("LAST_MONTH", "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(rangeBounds("ALL", "2026-11-03")).toEqual({ from: null, to: null });
    expect(rangeBounds("CUSTOM", "2026-11-03", { from: "2026-10-10", to: "" })).toEqual({ from: "2026-10-10", to: null });
  });

  it("localYmd is the local calendar day, not the UTC one", () => {
    expect(localYmd(new Date(2026, 10, 3, 0, 30))).toBe("2026-11-03");
  });
});

describe("history list", () => {
  const items = toHistoryItems(
    [run({ batch_sno: 1, created_at: "2026-11-02 10:00:00" }), run({ batch_sno: 2, batch_no: "PB-2", batch_date: "2026-10-30T00:00:00.000Z", created_at: "2026-10-30 09:00:00", com_sno: 2, payment_bank_sno: 4, sender_bank_name: "SBI", total_amount: 300, item_count: 2, vendor_names: ["SILVER ZONE"] })],
    [txn({ txn_sno: 7, recorded_at: "2026-11-02 18:34:50" }), txn({ txn_sno: 8, txn_date: "2026-10-31T00:00:00.000Z", recorded_at: "2026-10-31 11:00:00", amount_paid: 1000 })],
  );

  it("merges bank runs and portal payments newest first: by day, then by the time each was made / recorded", () => {
    expect(items.map((i) => i.key)).toEqual(["P7", "R1", "P8", "R2"]);
  });

  it("groups by day with run / portal counts and totals", () => {
    const days = groupHistoryByDay(items);
    expect(days.map((d) => [d.day, d.runs, d.portal, d.payments, d.amount])).toEqual([
      ["2026-11-02", 1, 1, 2, 2524],
      ["2026-10-31", 0, 1, 1, 1000],
      ["2026-10-30", 1, 0, 2, 300],
    ]);
    expect(countWords(days[0])).toBe("1 run · 1 paid on portal");
    expect(countWords({ runs: 0, portal: 0 })).toBe("Nothing paid");
  });

  it("filters by kind, period and search - supplier names, payment nos and transaction ids included", () => {
    expect(filterHistory(items, { ...none, kind: "PORTAL" }).map((i) => i.key)).toEqual(["P7", "P8"]);
    expect(filterHistory(items, { ...none, kind: "RUN" }).map((i) => i.key)).toEqual(["R1", "R2"]);
    expect(filterHistory(items, { ...none, from: "2026-10-31", to: "2026-10-31" }).map((i) => i.key)).toEqual(["P8"]);
    expect(filterHistory(items, { ...none, search: "silver" }).map((i) => i.key)).toEqual(["R2"]);
    expect(filterHistory(items, { ...none, search: "pay-1" }).map((i) => i.key)).toEqual(["R1", "R2"]);
    expect(filterHistory(items, { ...none, search: "8525" }).map((i) => i.key)).toEqual(["P7", "P8"]);
    expect(filterHistory(items, { ...none, search: "portal" }).map((i) => i.key)).toEqual(["P7", "P8"]);
  });

  it("a company / branch filter keeps that company's portal payments; a bank account filter leaves portal payments out", () => {
    expect(filterHistory(items, { ...none, scope: "1|1|1" }).map((i) => i.key)).toEqual(["P7", "R1", "P8"]);
    expect(filterHistory(items, { ...none, scope: "2|1|1" }).map((i) => i.key)).toEqual(["R2"]);
    expect(filterHistory(items, { ...none, bank: "3" }).map((i) => i.key)).toEqual(["R1"]);
  });

  it("month summary counts portal payments with bank runs", () => {
    const m = monthSummary(items, "2026-11-03");
    expect(m.thisMonth).toEqual({ amount: 2524, payments: 2, runs: 1, portal: 1, portalAmount: 2024 });
    expect(m.lastMonth).toMatchObject({ amount: 1300, runs: 1, portal: 1 });
    expect(sumHistory([])).toEqual({ amount: 0, payments: 0, runs: 0, portal: 0, portalAmount: 0 });
  });
});

describe("run helpers", () => {
  it("fund use, status, payees and compact amounts", () => {
    expect(fundUsePct({ total_amount: 80835, fund_plan_amount: 165978.53 })).toBe(49);
    expect(fundUsePct({ total_amount: 10, fund_plan_amount: 0 })).toBeNull();
    expect(fundUsePct({ total_amount: 200, fund_plan_amount: 100 })).toBe(100);
    expect(runStatus({ has_file: false, file_type: "BANK_UPLOAD" }).label).toBe("Bank file made");
    expect(runStatus({ has_file: false, file_type: null }).label).toBe("No bank transfer");
    expect(payeeSummary(["A", "B", "C", "D"])).toBe("A, B +2");
    expect(payeeSummary(["A", "B"])).toBe("A, B");
    expect(payeeSummary(undefined)).toBe("");
    expect(compactRupees(12500000)).toBe("₹1.25 Cr");
    expect(compactRupees(3861722.89)).toBe("₹38.62 L");
    expect(compactRupees(80835.4)).toBe("₹80,835");
  });

  it("matches invoice lines to their payment (by batch item, else payment) and totals the payments", () => {
    const items = [
      { batch_item_sno: 1, payment_sno: 10, amount: 900, gross_amount: 1000, tds_amount: 100 },
      { batch_item_sno: 2, payment_sno: 11, amount: 500, gross_amount: null },
    ] as PaymentBatchItem[];
    const lines = [{ batch_item_sno: 2, payment_sno: 99, invoice_sno: 1 }, { batch_item_sno: 5, payment_sno: 10, invoice_sno: 2 }] as PaymentBatchLine[];
    const by = linesByItem(items, lines);
    expect(by.get(11)?.map((l) => l.invoice_sno)).toEqual([1]);
    expect(by.get(10)?.map((l) => l.invoice_sno)).toEqual([2]);
    expect(itemTotals(items)).toEqual({ gross: 1500, tds: 100, advance: 0, notes: 0, net: 1400 });
    expect(lineKind({ kind: "PART", part_no: 2 }).label).toBe("Part 2");
    expect(lineKind({ kind: "FINAL", part_no: 3 }).label).toBe("Final part");
    expect(lineKind({ kind: "FULL", part_no: 1 }).label).toBe("Full");
  });
});
