export interface WorkflowFormData {
  workflow_name: string;
  workflow_code: string;
  entity_type: string;
  description: string;
  is_active: boolean;
}

// Stored as one item in workflow_stage.stage_order_json array
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

// Maps to workflow_types table: brn_sno + dept_sno stored in DB
// com_sno / div_sno are UI-only cascade helpers (not persisted)
export interface WorkflowType {
  workflow_types_name: string;
  com_sno: string;   // UI cascade only
  div_sno: string;   // UI cascade only
  brn_sno: string;   // FK → branch_master
  dept_sno: string;  // FK → dept_master
  is_active: boolean;
  stages: StageOrderItem[];
}
