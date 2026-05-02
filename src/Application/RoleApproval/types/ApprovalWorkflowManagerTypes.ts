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
// On submit, each brn_sno × dept_sno pair becomes one workflow_types row.
export interface WorkflowType {
  workflow_types_name: string;
  com_snos: string[];  // multi-select — UI only
  div_snos: string[];  // multi-select — UI only
  brn_snos: string[];  // multi-select → FK branch_master
  dept_snos: string[]; // multi-select → FK dept_master
  is_active: boolean;
  stages: StageOrderItem[];
}

// WorkflowType extended with DB row IDs for edit mode
export interface WorkflowTypeExtended extends WorkflowType {
  _typeIds: number[]; // DB workflow_types_id values; empty for newly added types
}

// Shape returned by GET /getWorkflows
export interface WorkflowMasterRow {
  workflow_id: number;
  workflow_name: string;
  workflow_code: string;
  entity_type: string;
  description: string;
  is_active: string; // "Y" | "N"
}
