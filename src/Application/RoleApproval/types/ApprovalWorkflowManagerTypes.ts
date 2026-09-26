export interface WorkflowFormData {
  workflow_name: string;
  workflow_code: string; // auto-generated on save, not shown in form
  entity_type: string;
  description: string;
  is_active: boolean;
}

// One approval stage stored in workflow_stage.stage_order_json
export interface StageOrderItem {
  approver_ecno: string;
  stage: string;
  required_approvals: string;
  is_mandatory: string;       // "Y" | "N"
  escalation_hours: string;
  approver_condition: string;
  next_approver_ecno: string;
  can_forward: string;        // "Y" | "N"
  can_backward: string;       // "Y" | "N"
  can_edit_data: string;      // "Y" | "N"
}

// UI model — com_snos/div_snos are cascade helpers, not persisted.
// On submit, each selected dept_sno becomes one workflow_types row, scoped to that
// department's own real com_sno/div_sno/brn_sno (never a branch × department cross-join).
export interface WorkflowType {
  workflow_types_name: string;
  workflow_types_description: string;
  com_snos: string[];  // multi-select — UI only
  div_snos: string[];  // multi-select — UI only
  brn_snos: string[];  // multi-select → FK branch_master
  dept_snos: string[]; // multi-select → FK dept_master
  is_active: boolean;
  stages: StageOrderItem[];
}

// One saved workflow_types row behind an edit-mode type card. dept_sno is "" for
// legacy branch-only rows that were never scoped to a department.
export interface WorkflowTypeRow {
  id: number;
  dept_sno: string;
  brn_sno: string;
}

// WorkflowType extended with DB row IDs for edit mode
export interface WorkflowTypeExtended extends WorkflowType {
  _typeIds: number[]; // DB workflow_types_id values; empty for newly added types
  _rows: WorkflowTypeRow[]; // same rows with their dept/branch, so edits can be diffed against the DB
}

// Shape returned by GET /getWorkflows
export interface WorkflowMasterRow {
  workflow_id: number;
  workflow_name: string;
  workflow_code: string;
  entity_type: string;
  description: string;
  is_active: string; // "Y" | "N"
  // '|'-delimited scope of the workflow's active types (sql/93); absent on an older DB
  division_short?: string;
  branch_names?: string;
}
