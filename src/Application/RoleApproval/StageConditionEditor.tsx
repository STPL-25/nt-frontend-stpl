import React from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  PRIORITY_LABELS,
  blankCondition,
  blankRule,
  changeRuleOp,
  describeCondition,
  findField,
  kindOfRule,
  normalizeCondition,
  opsForKind,
  retargetRule,
  validateCondition,
  type ConditionFieldDef,
  type ConditionLookups,
  type ConditionOp,
  type ConditionRule,
  type StageCondition,
} from "./approvalConditions";

interface Props {
  value: StageCondition | null | undefined;
  onChange: (next: StageCondition | null) => void;
  /** What this kind of workflow can test — from the field registry, never assumed here. */
  fields: ConditionFieldDef[];
  /** Choices for list fields, keyed by each field's option_source. */
  lookups: ConditionLookups;
}

/** The choices for a list field: its master's options; priorities fall back to the fixed names. */
const optionsFor = (def: ConditionFieldDef | undefined, lookups: ConditionLookups): { label: string; value: string }[] => {
  const fromMaster = (def?.option_source ? lookups[def.option_source] : undefined) ?? [];
  if (fromMaster.length > 0) return fromMaster.map((o) => ({ label: o.label, value: String(o.value) }));
  if (def?.option_source === "PriorityMaster")
    return Object.entries(PRIORITY_LABELS as Record<string, string>).map(([value, label]) => ({ label, value }));
  return [];
};

const toNumberOrNull = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const unitHint = (def?: ConditionFieldDef, prefix = ""): string =>
  def?.unit === "INR" ? `${prefix}Amount in ₹`.trim() : def?.unit ? `${prefix}${def.unit}`.trim() : `${prefix}Value`.trim();

/**
 * Edits one stage's routing condition: "this stage is required when ALL / ANY of these rules hold".
 * No rules = the stage is always required. The fields on offer come from the workflow type's registry
 * (`fields`); the saved shape is documented in approvalConditions.ts and evaluated server-side.
 */
export const StageConditionEditor: React.FC<Props> = ({ value, onChange, fields, lookups }) => {
  const cond = normalizeCondition(value);
  const problem = validateCondition(cond, fields);

  const setRules = (rules: ConditionRule[]) =>
    onChange(rules.length === 0 ? null : { match: cond?.match ?? "all", rules });
  const updateRule = (i: number, rule: ConditionRule) => setRules((cond?.rules ?? []).map((r, j) => (j === i ? rule : r)));

  if (!cond) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3">
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Always required.</span> Add a condition to require this stage only
          for some requests.
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(blankCondition(fields))} disabled={fields.length === 0}>
          <Plus className="mr-1 h-3 w-3" /> Add condition
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="stage-condition-editor">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">Required when</span>
        <div className="w-24">
          <CustomInputField
            field="match"
            label=""
            type="select"
            input={true}
            view={true}
            options={[
              { label: "ALL", value: "all" },
              { label: "ANY", value: "any" },
            ]}
            value={cond.match}
            onChange={(v) => onChange({ ...cond, match: v === "any" ? "any" : "all" })}
          />
        </div>
        <span className="text-muted-foreground">of these are true</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 text-red-500 hover:text-red-600"
          onClick={() => onChange(null)}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Remove condition
        </Button>
      </div>

      {cond.rules.map((rule, i) => {
        const def = findField(fields, rule.field);
        const kind = kindOfRule(rule, fields);
        const range = rule.op === "between" && Array.isArray(rule.value) ? rule.value : [null, null];
        // A rule saved against a field this kind of workflow no longer offers: keep it visible, flagged, removable.
        const fieldOptions = def
          ? fields.map((f) => ({ label: f.field_label, value: f.field_key }))
          : [{ label: `${rule.field} (not available)`, value: rule.field }, ...fields.map((f) => ({ label: f.field_label, value: f.field_key }))];
        return (
          <div key={i} className="space-y-1" data-testid="condition-rule">
            <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[12rem_10rem_1fr_auto]">
              <CustomInputField
                field={`rule-${i}-field`}
                label=""
                type="select"
                input={true}
                view={true}
                options={fieldOptions}
                value={rule.field}
                onChange={(v) => {
                  const next = findField(fields, String(v));
                  if (next) updateRule(i, retargetRule(rule, next));
                }}
              />
              <CustomInputField
                field={`rule-${i}-op`}
                label=""
                type="select"
                input={true}
                view={true}
                options={opsForKind(kind)}
                value={rule.op}
                onChange={(v) => updateRule(i, changeRuleOp(rule, v as ConditionOp))}
              />
              {kind === "number" ? (
                rule.op === "between" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <CustomInputField
                      field={`rule-${i}-lo`}
                      label=""
                      type="number"
                      min="0"
                      placeholder={unitHint(def, "From ")}
                      input={true}
                      view={true}
                      value={range[0] ?? ""}
                      onChange={(v) => updateRule(i, { ...rule, value: [toNumberOrNull(v), range[1] ?? null] })}
                    />
                    <CustomInputField
                      field={`rule-${i}-hi`}
                      label=""
                      type="number"
                      min="0"
                      placeholder={unitHint(def, "To ")}
                      input={true}
                      view={true}
                      value={range[1] ?? ""}
                      onChange={(v) => updateRule(i, { ...rule, value: [range[0] ?? null, toNumberOrNull(v)] })}
                    />
                  </div>
                ) : (
                  <CustomInputField
                    field={`rule-${i}-value`}
                    label=""
                    type="number"
                    min="0"
                    placeholder={unitHint(def)}
                    input={true}
                    view={true}
                    value={typeof rule.value === "number" ? rule.value : ""}
                    onChange={(v) => updateRule(i, { ...rule, value: toNumberOrNull(v) })}
                  />
                )
              ) : (
                <CustomInputField
                  field={`rule-${i}-list`}
                  label=""
                  type="multi-select"
                  placeholder="Select…"
                  input={true}
                  view={true}
                  options={optionsFor(def, lookups)}
                  value={(Array.isArray(rule.value) ? rule.value : []).filter((x) => x != null).map(String)}
                  onChange={(v: string[]) => updateRule(i, { ...rule, value: (v ?? []).map(Number) })}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() => setRules(cond.rules.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {!def && (
              <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> This kind of workflow no longer offers "{rule.field}". Remove this rule or pick another field.
              </p>
            )}
            {def?.help_text && <p className="text-[11px] text-muted-foreground">{def.help_text}</p>}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setRules([...cond.rules, blankRule(fields[0])])} disabled={fields.length === 0}>
          <Plus className="mr-1 h-3 w-3" /> Add rule
        </Button>
        <p className={`text-xs ${problem ? "text-red-600" : "text-muted-foreground"}`} data-testid="condition-preview">
          {problem ?? describeCondition(cond, fields, lookups)}
        </p>
      </div>
    </div>
  );
};

export default StageConditionEditor;
