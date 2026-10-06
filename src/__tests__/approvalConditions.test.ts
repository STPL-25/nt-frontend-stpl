import { describe, it, expect } from "vitest";
import {
  blankCondition,
  blankRule,
  changeRuleOp,
  cleanCondition,
  describeCondition,
  findField,
  formatFieldNumber,
  kindOfRule,
  normalizeCondition,
  opsForKind,
  retargetRule,
  validateCondition,
  type ConditionFieldDef,
  type StageCondition,
} from "@/Application/RoleApproval/approvalConditions";

// What a workflow type offers comes from the database registry, so the same key means different things
// per type. These mirror rows of approval_condition_field.
const PR_FIELDS: ConditionFieldDef[] = [
  { field_key: "amount", field_label: "Amount (PR total)", value_kind: "number", unit: "INR" },
  { field_key: "category", field_label: "Category", value_kind: "list", option_source: "ProductCategoryMaster" },
  { field_key: "priority", field_label: "Priority", value_kind: "list", option_source: "PriorityMaster" },
];
const PAYMENT_FIELDS: ConditionFieldDef[] = [
  { field_key: "amount", field_label: "Payment amount", value_kind: "number", unit: "INR" },
  { field_key: "payment_mode", field_label: "Payment mode", value_kind: "list", option_source: "PaymentModeMaster" },
  { field_key: "days_overdue", field_label: "Days overdue", value_kind: "number", unit: "days" },
];

const cond = (rules: StageCondition["rules"], match: "all" | "any" = "all"): StageCondition => ({ match, rules });

describe("normalizeCondition", () => {
  it("returns null for nothing, empty text, junk, and rule-less objects", () => {
    expect(normalizeCondition(undefined)).toBeNull();
    expect(normalizeCondition("")).toBeNull();
    expect(normalizeCondition("not json")).toBeNull();
    expect(normalizeCondition({ match: "all", rules: [] })).toBeNull();
    expect(normalizeCondition("amount > 50000")).toBeNull(); // the old free-text condition is not a rule set
  });

  it("reads an object or a JSON string", () => {
    const raw = { match: "any", rules: [{ field: "amount", op: "gt", value: 5 }] };
    expect(normalizeCondition(raw)).toEqual({ match: "any", rules: [{ field: "amount", op: "gt", value: 5 }] });
    expect(normalizeCondition(JSON.stringify(raw))?.rules).toHaveLength(1);
  });

  it("keeps a rule on ANY field key — the registry, not this file, decides what exists", () => {
    const c = normalizeCondition({ rules: [{ field: "payment_mode", op: "in", value: [1] }, { field: "days_overdue", op: "eq", value: 3 }] });
    expect(c?.rules.map((r) => r.field)).toEqual(["payment_mode", "days_overdue"]);
  });

  it("drops rules with no field or an unknown operator, and defaults match to all", () => {
    const c = normalizeCondition({ rules: [{ op: "gt", value: 1 }, { field: "amount", op: "wat", value: 1 }, { field: "amount", op: "eq", value: 1 }] });
    expect(c).toEqual({ match: "all", rules: [{ field: "amount", op: "eq", value: 1 }] });
  });
});

describe("field lookup and kinds", () => {
  it("finds a field by key", () => {
    expect(findField(PR_FIELDS, "priority")?.field_label).toBe("Priority");
    expect(findField(PR_FIELDS, "nope")).toBeUndefined();
    expect(findField(null, "amount")).toBeUndefined();
  });

  it("offers number operators for numbers and list operators for lists", () => {
    expect(opsForKind("number").map((o) => o.value)).toEqual(["gt", "gte", "lt", "lte", "eq", "between"]);
    expect(opsForKind("list").map((o) => o.value)).toEqual(["in", "not_in"]);
  });

  it("takes a rule's kind from the registry, or from its operator when the registry no longer has the field", () => {
    expect(kindOfRule({ field: "days_overdue", op: "in", value: [] }, PAYMENT_FIELDS)).toBe("number"); // registry wins
    expect(kindOfRule({ field: "gone", op: "between", value: [1, 2] }, PR_FIELDS)).toBe("number");
    expect(kindOfRule({ field: "gone", op: "in", value: [1] }, PR_FIELDS)).toBe("list");
  });
});

describe("validateCondition", () => {
  it("accepts no condition and complete ones", () => {
    expect(validateCondition(null, PR_FIELDS)).toBeNull();
    expect(validateCondition(cond([{ field: "amount", op: "gt", value: 50000 }]), PR_FIELDS)).toBeNull();
    expect(validateCondition(cond([{ field: "category", op: "in", value: [3] }]), PR_FIELDS)).toBeNull();
    expect(validateCondition(cond([{ field: "amount", op: "between", value: [10, 20] }]), PR_FIELDS)).toBeNull();
    expect(validateCondition(cond([{ field: "days_overdue", op: "eq", value: 0 }]), PAYMENT_FIELDS)).toBeNull();
  });

  it("flags a blank value, an empty list and a backwards range — naming the field it is about", () => {
    expect(validateCondition(cond([blankRule(PR_FIELDS[0])]), PR_FIELDS)).toMatch(/Rule 1: enter a value for amount \(pr total\)/);
    expect(validateCondition(cond([blankRule(PR_FIELDS[1])]), PR_FIELDS)).toMatch(/choose at least one option for category/);
    expect(validateCondition(cond([blankRule(PAYMENT_FIELDS[2])]), PAYMENT_FIELDS)).toMatch(/enter a value for days overdue/);
    expect(validateCondition(cond([{ field: "amount", op: "between", value: [20, 10] }]), PR_FIELDS)).toMatch(/must not be more/);
    expect(validateCondition(cond([{ field: "amount", op: "between", value: [10, null] }]), PR_FIELDS)).toMatch(/both values/);
    expect(validateCondition(cond([{ field: "amount", op: "gt", value: -1 }]), PR_FIELDS)).toMatch(/negative/);
  });

  it("flags a rule on a field this kind of workflow does not offer", () => {
    expect(validateCondition(cond([{ field: "payment_mode", op: "in", value: [1] }]), PR_FIELDS)).toMatch(
      /Rule 1: "payment_mode" is not available for this kind of workflow/
    );
    // ...but without a field list (nothing to compare with) only the values are checked
    expect(validateCondition(cond([{ field: "payment_mode", op: "in", value: [1] }]))).toBeNull();
  });

  it("names the failing rule", () => {
    expect(
      validateCondition(cond([{ field: "amount", op: "gt", value: 1 }, blankRule(PR_FIELDS[1])]), PR_FIELDS)
    ).toMatch(/^Rule 2:/);
  });
});

describe("rule editing helpers", () => {
  it("a blank condition starts on the first field on offer, and is invalid until filled in", () => {
    const c = blankCondition(PAYMENT_FIELDS);
    expect(c?.rules[0]).toEqual({ field: "amount", op: "gt", value: null });
    expect(validateCondition(c, PAYMENT_FIELDS)).not.toBeNull();
    expect(blankCondition([])).toBeNull(); // a workflow type with no fields cannot have conditions
  });

  it("resets operator and value when the field changes, keeps the rule when it does not", () => {
    const r = { field: "amount", op: "gt" as const, value: 5 };
    expect(retargetRule(r, PR_FIELDS[0])).toBe(r);
    expect(retargetRule(r, PR_FIELDS[1])).toEqual({ field: "category", op: "in", value: [] });
    expect(retargetRule(r, PAYMENT_FIELDS[1])).toEqual({ field: "payment_mode", op: "in", value: [] });
  });

  it("switches a number rule to/from between without losing the first number", () => {
    const gt = { field: "amount", op: "gt" as const, value: 5000 };
    const between = changeRuleOp(gt, "between");
    expect(between).toEqual({ field: "amount", op: "between", value: [5000, null] });
    expect(changeRuleOp(between, "eq")).toEqual({ field: "amount", op: "eq", value: 5000 });
  });

  it("only changes the operator for list rules", () => {
    const r = { field: "category", op: "in" as const, value: [1, 2] };
    expect(changeRuleOp(r, "not_in")).toEqual({ field: "category", op: "not_in", value: [1, 2] });
  });
});

describe("cleanCondition", () => {
  it("is null when there are no rules", () => {
    expect(cleanCondition(null)).toBeNull();
    expect(cleanCondition(cond([]))).toBeNull();
  });

  it("coerces string ids and numbers to numbers", () => {
    const out = cleanCondition(cond([{ field: "category", op: "in", value: ["3", "4"] as unknown as number[] }]));
    expect(out?.rules[0].value).toEqual([3, 4]);
    const amt = cleanCondition(cond([{ field: "amount", op: "gt", value: "50000" as unknown as number }]));
    expect(amt?.rules[0].value).toBe(50000);
  });
});

describe("describeCondition", () => {
  it("says 'Always required' with nothing", () => {
    expect(describeCondition(null, PR_FIELDS)).toBe("Always required");
  });

  it("the same key reads differently per kind of workflow — that is the point of the registry", () => {
    const rule = cond([{ field: "amount", op: "gt", value: 50000 }]);
    expect(describeCondition(rule, PR_FIELDS)).toBe("Amount (PR total) is more than ₹50,000");
    expect(describeCondition(rule, PAYMENT_FIELDS)).toBe("Payment amount is more than ₹50,000");
  });

  it("formats numbers in the field's own unit", () => {
    expect(describeCondition(cond([{ field: "amount", op: "between", value: [10000, 50000] }]), PR_FIELDS)).toBe(
      "Amount (PR total) is between ₹10,000 and ₹50,000"
    );
    expect(describeCondition(cond([{ field: "days_overdue", op: "lte", value: 15 }]), PAYMENT_FIELDS)).toBe("Days overdue is at most 15 days");
    expect(formatFieldNumber(12, { field_key: "n", field_label: "N", value_kind: "number" })).toBe("12");
    expect(formatFieldNumber(30, PAYMENT_FIELDS[2])).toBe("30 days");
  });

  it("names list options from the master named by the field's option_source", () => {
    const c = cond([{ field: "payment_mode", op: "in", value: [1, 2] }]);
    expect(describeCondition(c, PAYMENT_FIELDS, { PaymentModeMaster: [{ value: 1, label: "Cheque" }, { value: 2, label: "NEFT" }] })).toBe(
      "Payment mode is any of Cheque, NEFT"
    );
    expect(describeCondition(c, PAYMENT_FIELDS)).toBe("Payment mode is any of #1, #2"); // masters not loaded yet
  });

  it("falls back to fixed priority names, and joins with AND / OR", () => {
    const c = cond(
      [
        { field: "category", op: "in", value: [1] },
        { field: "priority", op: "not_in", value: [3] },
      ],
      "any"
    );
    expect(describeCondition(c, PR_FIELDS, { ProductCategoryMaster: [{ value: 1, label: "Stationery" }] })).toBe(
      "Category is any of Stationery OR Priority is none of Low"
    );
    expect(describeCondition(cond([{ field: "amount", op: "gte", value: 1000 }, { field: "priority", op: "in", value: [4] }]), PR_FIELDS)).toBe(
      "Amount (PR total) is at least ₹1,000 AND Priority is any of Critical"
    );
  });

  it("still reads a rule on a field the registry no longer offers, by its key", () => {
    expect(describeCondition(cond([{ field: "legacy_field", op: "gt", value: 2 }]), PR_FIELDS)).toBe("legacy_field is more than 2");
  });
});
