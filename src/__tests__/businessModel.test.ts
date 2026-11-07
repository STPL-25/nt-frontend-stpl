import { describe, it, expect } from "vitest";
import {
  bankStatusLabel, breakdownOf, buildExpenseTrend, dateOnly, diffKpi, expenseOrgOptions, filterExpenses, filterPayments, formatDay, formatInr, formatInrCompact, formatQty,
  isEmptyOverview, monthLabel, pct, share, sumOf,
  type BizExpense, type BizExpenseOrgMonth, type BizKpi, type BizMonth, type BizPayment, type BusinessOverview,
} from "@/Application/OrgDashboard/businessModel";

describe("money formatting (Indian grouping)", () => {
  it("shows crore / lakh for headline figures and whole rupees below a lakh", () => {
    expect(formatInrCompact(112570856.24)).toBe("₹11.26 Cr");
    expect(formatInrCompact(10000000)).toBe("₹1 Cr");
    expect(formatInrCompact(404306600)).toBe("₹40.43 Cr");
    expect(formatInrCompact(146500)).toBe("₹1.47 L");
    expect(formatInrCompact(100000)).toBe("₹1 L");
    expect(formatInrCompact(99040)).toBe("₹99,040");
    expect(formatInrCompact(0)).toBe("₹0");
    expect(formatInrCompact(null)).toBe("₹0");
    expect(formatInrCompact(undefined)).toBe("₹0");
  });

  it("keeps the sign on negatives", () => {
    expect(formatInrCompact(-250000)).toBe("-₹2.5 L");
  });

  it("formats the exact figure with two decimals", () => {
    expect(formatInr(1234567.5)).toBe("₹12,34,567.50");
    expect(formatInr(null)).toBe("₹0.00");
  });

  it("formats quantities without trailing noise", () => {
    expect(formatQty(1480.4)).toBe("1,480.4");
    expect(formatQty(2062)).toBe("2,062");
    expect(formatQty(undefined)).toBe("0");
  });

  it("never prints NaN", () => {
    expect(formatInrCompact(Number.NaN)).toBe("₹0");
    expect(formatInr(Number.NaN)).toBe("₹0.00");
    expect(formatQty(Number.NaN)).toBe("0");
  });
});

describe("dates are read as plain dates, never shifted by the time zone", () => {
  it("takes the date part of what the API sends", () => {
    expect(dateOnly("2026-10-29T00:00:00.000Z")).toBe("2026-10-29");
    expect(dateOnly(null)).toBe("");
  });
  it("labels days and months", () => {
    expect(formatDay("2026-10-29T00:00:00.000Z")).toBe("29 Oct 2026");
    expect(formatDay("2026-01-01")).toBe("01 Jan 2026");
    expect(formatDay(null)).toBe("-");
    expect(formatDay("garbage")).toBe("-");
    expect(monthLabel("2026-11-01T00:00:00.000Z")).toBe("Nov 26");
    expect(monthLabel("")).toBe("");
  });
});

describe("shares", () => {
  it("is a 0..1 fraction and survives a zero whole", () => {
    expect(share(1, 4)).toBe(0.25);
    expect(share(5, 4)).toBe(1);
    expect(share(-1, 4)).toBe(0);
    expect(share(3, 0)).toBe(0);
    expect(share(null, null)).toBe(0);
    expect(pct(86, 103)).toBe(83);
  });
});

const exp = (over: Partial<BizExpense>): BizExpense => ({
  invoice_sno: 1, invoice_no: "INV-1", vendor_invoice_no: "V-77", vendor_name: "Acme Cleaning", po_no: "PO-9", invoice_date: "2026-10-01", due_date: null,
  expense_class: "Service", kind: "RECURRING", what: "Housekeeping", dept_name: "Admin", amount: 1000, paid: 400, in_payment: 100, unpaid: 500, ...over,
});
const pay = (over: Partial<BizPayment>): BizPayment => ({
  payment_sno: 1, payment_no: "PAY-1", vendor_name: "Acme", payment_date: "2026-10-01", stage: "WAITING", payment_type: "BILL", mode: "NEFT", status: "Pending Approval",
  bank_status: null, utr_no: null, batch_no: null, dept_name: "Admin", amount: 500, event_at: null, ...over,
});

describe("filters", () => {
  const rows = [
    exp({ invoice_sno: 1, kind: "RECURRING", vendor_name: "Acme Cleaning" }),
    exp({ invoice_sno: 2, kind: "NON_RECURRING", vendor_name: "Bright Stationers", what: "Pencils", expense_class: "Product", po_no: "PO-12" }),
    exp({ invoice_sno: 3, kind: "NON_RECURRING", vendor_name: null, what: null, po_no: null, invoice_no: null }),
  ];
  it("filters expenses by kind", () => {
    expect(filterExpenses(rows, "ALL", "").map((r) => r.invoice_sno)).toEqual([1, 2, 3]);
    expect(filterExpenses(rows, "RECURRING", "").map((r) => r.invoice_sno)).toEqual([1]);
    expect(filterExpenses(rows, "NON_RECURRING", "").map((r) => r.invoice_sno)).toEqual([2, 3]);
  });
  it("searches vendor, bill, PO and what it was for - case-insensitive, and tolerates empty fields", () => {
    expect(filterExpenses(rows, "ALL", "bright").map((r) => r.invoice_sno)).toEqual([2]);
    expect(filterExpenses(rows, "ALL", "PO-12").map((r) => r.invoice_sno)).toEqual([2]);
    expect(filterExpenses(rows, "ALL", "pencil").map((r) => r.invoice_sno)).toEqual([2]);
    expect(filterExpenses(rows, "NON_RECURRING", "  acme ")).toEqual([]);
    expect(filterExpenses(rows, "ALL", "zzz")).toEqual([]);
  });
  it("filters payments by stage and searches UTR / batch", () => {
    const list = [pay({ payment_sno: 1 }), pay({ payment_sno: 2, stage: "SENT", utr_no: "UTR123", batch_no: "PB-7" }), pay({ payment_sno: 3, stage: "APPROVED", vendor_name: null })];
    expect(filterPayments(list, "SENT", "").map((p) => p.payment_sno)).toEqual([2]);
    expect(filterPayments(list, "ALL", "utr123").map((p) => p.payment_sno)).toEqual([2]);
    expect(filterPayments(list, "ALL", "pb-7").map((p) => p.payment_sno)).toEqual([2]);
    expect(filterPayments(list, "APPROVED", "").map((p) => p.payment_sno)).toEqual([3]);
  });
  it("sums a column", () => {
    expect(sumOf(rows, (r) => r.amount)).toBe(3000);
    expect(sumOf([], () => 1)).toBe(0);
    expect(sumOf([{ v: null }, { v: 2 }], (r) => r.v)).toBe(2);
  });
});

describe("bank status wording", () => {
  it("says what the bank said, and treats no answer as still awaiting", () => {
    expect(bankStatusLabel("PAID")).toBe("Bank confirmed");
    expect(bankStatusLabel("returned")).toBe("Returned by bank");
    expect(bankStatusLabel("PENDING")).toBe("Awaiting bank");
    expect(bankStatusLabel(null)).toBe("Awaiting bank");
  });
});

const zeroKpi = (): BizKpi => new Proxy({} as BizKpi, { get: () => 0 });
const overview = (kpi: Partial<BizKpi>, over: Partial<BusinessOverview> = {}): BusinessOverview => ({
  meta: { as_of: "2026-11-04", month_start: "2026-11-01", no_scope: 0, scope_rows: 1 },
  kpi: { ...(zeroKpi() as object), ...kpi } as BizKpi, monthly: [], breakdown: [], top_items: [], assets_by_dept: [], budgets: [], payments: [], expenses: [],
  expense_by_vendor: [], agreements: [], expense_monthly_org: [], ...over,
});

const month = (month_start: string, exp_recurring = 0, exp_non_recurring = 0): BizMonth => ({
  month_start, pr_count: 0, po_count: 0, po_value: 0, gate_count: 0, grn_count: 0, exp_recurring, exp_non_recurring, pay_sent: 0,
});

const orgExpense = (over: Partial<BizExpenseOrgMonth>): BizExpenseOrgMonth => ({
  month_start: "2026-10-01", com_sno: 1, com_name: "Space Textiles", div_sno: 10, div_name: "Textiles", brn_sno: 100, brn_name: "Coimbatore",
  dept_sno: 1000, dept_name: "Accounts", invoice_count: 1, total_expense: 100, recurring_expense: 60, non_recurring_expense: 40, ...over,
});

describe("organisation expense trend", () => {
  const months = [month("2026-10-01"), month("2026-11-01"), month("2026-12-01")];
  const rows = [
    orgExpense({ total_expense: 100, dept_sno: 1000, dept_name: "Accounts" }),
    orgExpense({ total_expense: 200, recurring_expense: 0, non_recurring_expense: 200, dept_sno: 1001, dept_name: "Admin" }),
    orgExpense({ month_start: "2026-11-01", com_sno: 2, com_name: "Garsons", div_sno: 20, div_name: "Retail", brn_sno: 200, brn_name: "Chennai", dept_sno: 2000, dept_name: "Stores", total_expense: 400 }),
  ];

  it("builds distinct path-labelled options for each level", () => {
    expect(expenseOrgOptions(rows, "company").map((option) => option.path)).toEqual(["Garsons", "Space Textiles"]);
    expect(expenseOrgOptions(rows, "department").map((option) => option.path)).toEqual([
      "Garsons › Retail › Chennai › Stores",
      "Space Textiles › Textiles › Coimbatore › Accounts",
      "Space Textiles › Textiles › Coimbatore › Admin",
    ]);
  });

  it("rolls leaf rows up to the selected company and fills missing months with zero", () => {
    const trend = buildExpenseTrend(months, rows, "company", 1);
    expect(trend.map((item) => item.total_expense)).toEqual([300, 0, 0]);
    expect(trend[0].invoice_count).toBe(2);
  });

  it("aggregates all accessible rows and keeps the common 12-month timeline", () => {
    expect(buildExpenseTrend(months, rows, "branch", null).map((item) => item.total_expense)).toEqual([300, 400, 0]);
  });

  it("falls back to the existing overall monthly totals while the new SQL result is being deployed", () => {
    const fallback = [month("2026-10-01", 60, 40), month("2026-11-01", 25, 75)];
    expect(buildExpenseTrend(fallback, [], "company", null).map((item) => item.total_expense)).toEqual([100, 100]);
  });
});

describe("empty state", () => {
  it("is empty with no data, with no organisation access, or with only zeros", () => {
    expect(isEmptyOverview(null)).toBe(true);
    expect(isEmptyOverview(overview({}, { meta: { as_of: "", month_start: "", no_scope: 1, scope_rows: 0 } }))).toBe(true);
    expect(isEmptyOverview(overview({}))).toBe(true);
  });
  it("is not empty as soon as any area has something", () => {
    expect(isEmptyOverview(overview({ pr_total: 1 }))).toBe(false);
    expect(isEmptyOverview(overview({ bud_count: 2 }))).toBe(false);
    expect(isEmptyOverview(overview({ exp_non_count: 5 }))).toBe(false);
  });
});

describe("breakdown + live diff", () => {
  it("returns one section in the procedure's order", () => {
    const data = overview({}, {
      breakdown: [
        { section: "po_status", label: "Approved", cnt: 127, amount: 1, sort_order: 2 },
        { section: "pr_status", label: "Pending approval", cnt: 17, amount: 1, sort_order: 1 },
        { section: "po_status", label: "Pending approval", cnt: 1, amount: 1, sort_order: 1 },
      ],
    });
    expect(breakdownOf(data, "po_status").map((b) => b.label)).toEqual(["Pending approval", "Approved"]);
    expect(breakdownOf(data, "nope")).toEqual([]);
    expect(breakdownOf(null, "po_status")).toEqual([]);
  });

  it("reports which numbers moved between two snapshots", () => {
    const a = { ...(zeroKpi() as object), pr_total: 103, pay_sent_count: 1 } as BizKpi;
    const b = { ...(zeroKpi() as object), pr_total: 104, pay_sent_count: 1, grn_done: 1 } as BizKpi;
    expect([...diffKpi(a, b)].sort()).toEqual(["grn_done", "pr_total"]);
    expect(diffKpi(null, b).size).toBe(0);   // the first load flashes nothing
    expect(diffKpi(a, a).size).toBe(0);
  });
});
