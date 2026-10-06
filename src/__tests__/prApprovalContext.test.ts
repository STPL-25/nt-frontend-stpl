import { describe, it, expect } from "vitest";
import {
  buildEditPayload,
  draftTotal,
  formatWhen,
  initEditDraft,
  lineTotal,
  personLabel,
  successMessage,
  summarizeEdit,
  toDateInput,
  validateEditDraft,
} from "@/Application/PR/prApprovalContext";

const pr = { purpose: "Office supplies", required_date: "2026-10-05T00:00:00.000Z", priority_sno: 2 };
const items = [
  { pr_item_sno: 11, prod_name: "Ghee", uom_name: "KG", qty: "12", est_cost: "10000" },
  { pr_item_sno: 12, service_name: "Cleaning", uom_name: "", qty: 1, est_cost: 500 },
  { prod_name: "no id" },
];

describe("edit draft", () => {
  it("starts from the PR as it is, ignoring lines without an id", () => {
    const d = initEditDraft(pr, items);
    expect(d.items).toHaveLength(2);
    expect(d.items[0]).toMatchObject({ pr_item_sno: 11, name: "Ghee", uom: "KG", qty: "12", est_cost: "10000", orig_qty: 12, orig_cost: 10000 });
    expect(d.items[1].name).toBe("Cleaning");
    expect(d.required_date).toBe("2026-10-05");
    expect(d.priority_sno).toBe("2");
    expect(draftTotal(d)).toBe(120500);
  });

  it("no change -> nothing to send", () => {
    expect(buildEditPayload(initEditDraft(pr, items))).toEqual({ edits: {}, changed: false });
  });

  it("sends only what changed", () => {
    const d = initEditDraft(pr, items);
    d.items[0].qty = "3";
    d.purpose = "  Reduced order ";
    d.priority_sno = "1";
    const { edits, changed } = buildEditPayload(d);
    expect(changed).toBe(true);
    expect(edits).toEqual({ purpose: "Reduced order", priority_sno: 1, items: [{ pr_item_sno: 11, qty: 3, est_cost: 10000 }] });
  });

  it("a whitespace-only difference in purpose is not a change", () => {
    const d = initEditDraft(pr, items);
    d.purpose = "Office supplies  ";
    expect(buildEditPayload(d).changed).toBe(false);
  });

  it("line totals follow the inputs, blank inputs count as zero", () => {
    const d = initEditDraft(pr, items);
    d.items[0].qty = "3";
    expect(lineTotal(d.items[0])).toBe(30000);
    d.items[0].qty = "";
    expect(lineTotal(d.items[0])).toBe(0);
  });

  it("validates quantity, cost, size, date and purpose", () => {
    const base = () => initEditDraft(pr, items);
    expect(validateEditDraft(base())).toBeNull();
    let d = base(); d.items[0].qty = "0";
    expect(validateEditDraft(d)).toMatch(/Ghee: quantity must be more than zero/);
    d = base(); d.items[0].qty = "abc";
    expect(validateEditDraft(d)).toMatch(/quantity/);
    d = base(); d.items[0].est_cost = "-1";
    expect(validateEditDraft(d)).toMatch(/cost cannot be negative/);
    d = base(); d.items[0].qty = "1000"; d.items[0].est_cost = "100000";
    expect(validateEditDraft(d)).toMatch(/too large/);
    d = base(); d.required_date = "";
    expect(validateEditDraft(d)).toMatch(/required-by/);
    d = base(); d.purpose = "  ";
    expect(validateEditDraft(d)).toMatch(/Purpose/);
  });
});

describe("summarizeEdit", () => {
  const before = JSON.stringify({
    header: { purpose: "Office supplies", required_date: "2026-10-05", priority_sno: 2 },
    items: [{ pr_item_sno: 11, qty: 12, est_cost: 10000, total_cost: 120000 }],
    amount: 120000,
  });
  const after = JSON.stringify({
    header: { purpose: "Reduced", required_date: "2026-10-05", priority_sno: 1 },
    items: [{ pr_item_sno: 11, qty: 3, est_cost: 10000, total_cost: 30000 }],
    amount: 30000,
  });

  it("lists amount, header and line changes in words", () => {
    expect(summarizeEdit(before, after, { 11: "Ghee" })).toEqual([
      "Amount ₹1,20,000 → ₹30,000",
      'Purpose "Office supplies" → "Reduced"',
      "Priority Medium → High",
      "Ghee: quantity 12 → 3",
    ]);
  });

  it("falls back to the item number and copes with junk", () => {
    expect(summarizeEdit(before, after)).toContain("Item #11: quantity 12 → 3");
    expect(summarizeEdit(null, after)).toEqual([]);
    expect(summarizeEdit("nope", "nope")).toEqual([]);
  });
});

describe("small formatters", () => {
  it("toDateInput reads the date part of a midnight-UTC timestamp", () => {
    expect(toDateInput("2026-10-05T00:00:00.000Z")).toBe("2026-10-05");
    expect(toDateInput(undefined)).toBe("");
  });

  it("formatWhen reads a stored timestamp as written (no timezone shift)", () => {
    expect(formatWhen("2026-09-18T15:40:00.000Z")).toBe("18 Sep 2026, 3:40 pm");
    expect(formatWhen("2026-09-18T00:05:00.000Z")).toBe("18 Sep 2026, 12:05 am");
    expect(formatWhen(null)).toBe("");
  });

  it("personLabel avoids repeating a code that is also the name", () => {
    expect(personLabel("Asha K", "KTM1")).toBe("Asha K (KTM1)");
    expect(personLabel("KTM1", "KTM1")).toBe("KTM1");
    expect(personLabel(null, "KTM1")).toBe("KTM1");
    expect(personLabel(null, null)).toBe("—");
  });

  it("successMessage names the target when known", () => {
    expect(successMessage("forward", "GM")).toBe("Forwarded to GM");
    expect(successMessage("send_back", null)).toBe("PR sent back");
    expect(successMessage("edit")).toMatch(/restarted/);
  });
});
