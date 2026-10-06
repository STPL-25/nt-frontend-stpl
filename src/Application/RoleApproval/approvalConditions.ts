// Conditional routing rules for one approval stage — the shape stored in
// workflow_stage.stage_order_json[n].condition and evaluated by the database
// (dbo.fn_approval_condition_met, sql/99). Keep the two in step:
//
//   {"match":"all"|"any","rules":[{"field":"amount","op":"gt","value":50000},
//                                  {"field":"category","op":"in","value":[3,4]}]}
//
// No condition (or no rules) means the stage is always required.
//
// WHICH FIELDS EXIST IS NOT DECIDED HERE. What "amount" means (the total of a PR's lines, a payment's
// amount, ...) and which other values a rule can test depend on the workflow's entity type, so the
// list comes from the database (approval_condition_field via GET /workflow_approval/getConditionFields).
// This file only knows two KINDS of field — a number (compared with gt/gte/lt/lte/eq/between) and a
// list of ids (in / not_in) — and works with whatever ConditionFieldDef[] it is handed.

export type ConditionKind = "number" | "list";
export type ConditionOp = "gt" | "gte" | "lt" | "lte" | "eq" | "between" | "in" | "not_in";

/** One row of the field registry, as the API returns it. */
export interface ConditionFieldDef {
  field_key: string;
  field_label: string;
  value_kind: ConditionKind;
  /** list fields: the master (getRequiredMasterForOptions) that supplies the choices, e.g. "PriorityMaster" */
  option_source?: string | null;
  /** number fields: "INR", "days", ... */
  unit?: string | null;
  help_text?: string | null;
  sort_order?: number;
}

export interface ConditionRule {
  field: string;
  op: ConditionOp;
  /** number ops: a number · between: [low, high] · list ops: an id list */
  value: number | Array<number | null> | null;
}

export interface StageCondition {
  match: "all" | "any";
  rules: ConditionRule[];
}

export interface ConditionOption {
  label: string;
  value: string | number;
}

/** Choices for list fields, keyed by the field's option_source (the master name). */
export type ConditionLookups = Record<string, ConditionOption[] | undefined>;

export const NUMBER_OPS: { value: ConditionOp; label: string }[] = [
  { value: "gt", label: "is more than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "eq", label: "is exactly" },
  { value: "between", label: "is between" },
];

export const LIST_OPS: { value: ConditionOp; label: string }[] = [
  { value: "in", label: "is any of" },
  { value: "not_in", label: "is none of" },
];

export const opsForKind = (kind: ConditionKind) => (kind === "number" ? NUMBER_OPS : LIST_OPS);

const NUMBER_OP_VALUES = new Set<string>(NUMBER_OPS.map((o) => o.value));
const ALL_OP_VALUES = new Set<string>([...NUMBER_OPS, ...LIST_OPS].map((o) => o.value));

/** priority_master names, used for display when the master list has not loaded. */
export const PRIORITY_LABELS: Record<number, string> = { 1: "High", 2: "Medium", 3: "Low", 4: "Critical" };

export const findField = (fields: ConditionFieldDef[] | null | undefined, key: string) =>
  fields?.find((f) => f.field_key === key);

/** A rule's kind: the registry's word for it, or — for a field the registry no longer offers — what its operator implies. */
export const kindOfRule = (rule: ConditionRule, fields?: ConditionFieldDef[] | null): ConditionKind =>
  findField(fields, rule.field)?.value_kind ?? (NUMBER_OP_VALUES.has(rule.op) ? "number" : "list");

export const blankRule = (def: ConditionFieldDef): ConditionRule => ({
  field: def.field_key,
  op: opsForKind(def.value_kind)[0].value,
  value: def.value_kind === "number" ? null : [],
});

export const blankCondition = (fields: ConditionFieldDef[]): StageCondition | null =>
  fields.length ? { match: "all", rules: [blankRule(fields[0])] } : null;

/** A rule pointed at a different field keeps nothing of the old operator/value. */
export const retargetRule = (rule: ConditionRule, def: ConditionFieldDef): ConditionRule =>
  rule.field === def.field_key ? rule : blankRule(def);

/** The rule's operator changed: a "between" needs a pair, the other number operators a single number. */
export const changeRuleOp = (rule: ConditionRule, op: ConditionOp): ConditionRule => {
  if (!NUMBER_OP_VALUES.has(rule.op) || !NUMBER_OP_VALUES.has(op)) return { ...rule, op };
  if (op === "between") {
    const lo = typeof rule.value === "number" ? rule.value : Array.isArray(rule.value) ? rule.value[0] ?? null : null;
    return { ...rule, op, value: [lo, Array.isArray(rule.value) ? rule.value[1] ?? null : null] };
  }
  const single = Array.isArray(rule.value) ? rule.value[0] ?? null : rule.value;
  return { ...rule, op, value: single };
};

/** Read a stage's saved condition (object or JSON string); null when there is none. */
export function normalizeCondition(raw: unknown): StageCondition | null {
  let c: any = raw;
  if (typeof c === "string") {
    if (!c.trim()) return null;
    try {
      c = JSON.parse(c);
    } catch {
      return null;
    }
  }
  if (!c || typeof c !== "object" || !Array.isArray(c.rules)) return null;
  const rules: ConditionRule[] = c.rules
    .filter((r: any) => r && typeof r.field === "string" && r.field && ALL_OP_VALUES.has(String(r.op)))
    .map((r: any) => ({ field: r.field, op: r.op, value: r.value ?? null }));
  if (rules.length === 0) return null;
  return { match: c.match === "any" ? "any" : "all", rules };
}

/**
 * First problem with a condition being edited, or null when it can be saved. With `fields`, a rule on a
 * field the workflow type no longer offers is a problem too (the database would read it as unreadable
 * and keep the stage required, which is rarely what the author meant).
 */
export function validateCondition(
  c: StageCondition | null | undefined,
  fields?: ConditionFieldDef[] | null
): string | null {
  if (!c || c.rules.length === 0) return null;
  for (const [i, r] of c.rules.entries()) {
    const n = i + 1;
    const def = findField(fields, r.field);
    if (fields && !def) return `Rule ${n}: "${r.field}" is not available for this kind of workflow`;
    const label = (def?.field_label ?? r.field).toLowerCase();
    if (kindOfRule(r, fields) === "number") {
      if (r.op === "between") {
        const [lo, hi] = Array.isArray(r.value) ? r.value : [null, null];
        if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) return `Rule ${n}: enter both values for ${label}`;
        if (lo < 0 || hi < 0) return `Rule ${n}: values cannot be negative`;
        if (lo > hi) return `Rule ${n}: the first value must not be more than the second`;
      } else {
        if (typeof r.value !== "number" || !Number.isFinite(r.value)) return `Rule ${n}: enter a value for ${label}`;
        if (r.value < 0) return `Rule ${n}: the value cannot be negative`;
      }
    } else if (!Array.isArray(r.value) || r.value.length === 0) {
      return `Rule ${n}: choose at least one option for ${label}`;
    }
  }
  return null;
}

/** What gets saved: null when there are no rules, otherwise the tidy object. */
export function cleanCondition(c: StageCondition | null | undefined): StageCondition | null {
  if (!c || c.rules.length === 0) return null;
  return {
    match: c.match === "any" ? "any" : "all",
    rules: c.rules.map((r) => ({
      field: r.field,
      op: r.op,
      value: Array.isArray(r.value) ? r.value.map((v) => (v == null ? v : Number(v))) : r.value == null ? null : Number(r.value),
    })),
  };
}

export const formatInr = (n: number): string =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** A number in the field's own unit: "₹50,000", "30 days", or a bare "12". */
export const formatFieldNumber = (n: number, def?: ConditionFieldDef): string => {
  if (def?.unit === "INR") return formatInr(n);
  const text = Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return def?.unit ? `${text} ${def.unit}` : text;
};

const names = (ids: Array<number | null>, options?: ConditionOption[], fallback?: Record<number, string>): string =>
  ids
    .filter((id): id is number => id != null)
    .map((id) => options?.find((o) => String(o.value) === String(id))?.label ?? fallback?.[id] ?? `#${id}`)
    .join(", ");

/** One rule in words, e.g. "Amount (PR total) is more than ₹50,000" / "Priority is any of High, Critical". */
export function describeRule(r: ConditionRule, fields?: ConditionFieldDef[] | null, lookups: ConditionLookups = {}): string {
  const def = findField(fields, r.field);
  const kind = kindOfRule(r, fields);
  const label = def?.field_label ?? r.field;
  const opLabel = opsForKind(kind).find((o) => o.value === r.op)?.label ?? r.op;
  if (kind === "number") {
    if (r.op === "between") {
      const [lo, hi] = Array.isArray(r.value) ? r.value : [null, null];
      return `${label} ${opLabel} ${lo == null ? "?" : formatFieldNumber(lo, def)} and ${hi == null ? "?" : formatFieldNumber(hi, def)}`;
    }
    return `${label} ${opLabel} ${typeof r.value === "number" ? formatFieldNumber(r.value, def) : "?"}`;
  }
  const ids = Array.isArray(r.value) ? r.value : [];
  const source = def?.option_source ? lookups[def.option_source] : undefined;
  const fallback = def?.option_source === "PriorityMaster" ? PRIORITY_LABELS : undefined;
  return `${label} ${opLabel} ${names(ids, source, fallback) || "?"}`;
}

/** The whole condition in words; "Always required" when there is none. */
export function describeCondition(
  c: StageCondition | null | undefined,
  fields?: ConditionFieldDef[] | null,
  lookups: ConditionLookups = {}
): string {
  const cond = normalizeCondition(c);
  if (!cond) return "Always required";
  return cond.rules.map((r) => describeRule(r, fields, lookups)).join(cond.match === "any" ? " OR " : " AND ");
}
