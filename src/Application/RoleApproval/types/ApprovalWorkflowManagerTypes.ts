 interface ApprovalWorkflow {
  workflow_id: number;
  workflow_name: string;
  workflow_code: string;
  entity_type: string;
  description: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  modified_by: string;
  modified_at: Date;
}

 interface ApprovalWorkflowType {
  workflow_types_id: number;
  workflow_types_name: string;
  workflow_id: number;
  workflow_name: string;
  types_branches: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  modified_by: string;
  modified_at: Date;
}

 interface ApprovalWorkflowStage {
  stage_id: number;
  workflow_id: number;
  workflow_types_id: number; // NEW: Link to workflow type
  stage_order: number;
  stage_name: string;
  stage_type: string;
  required_approvals: boolean;
  is_mandatory: boolean;
  can_skip: number;
  escalation_hours: number;
  com_sno: number; // NEW: Company
  div_sno: number; // NEW: Division
  brn_sno: number; // NEW: Branch
  dept_sno: number; // NEW: Department
  is_active: boolean;
  created_at: Date;
}

 interface ApproverTable {
  approver_id: number;
  nt_sign_up_sno: number;
  workflow_id: number;
  stage_id: number;
  com_sno: number;
  div_sno: number;
  brn_sno: number;
  dept_sno: number;
  created_by: string;
  created_at: Date;
  is_active: boolean;
}

 interface ApprovalCondition {
  condition_id: number;
  workflow_id: number;
  workflow_types_id: number; 
  stage_id: number; 
  condition_name: string;
  condition_type: string;
  operator_type: string;
  condition_value: string;
  priority_order: number;
  is_active: boolean;
  created_at: Date;
}
interface AuthBranch {
  workflow_types_id: number;
  com_sno: string;
  div_sno: string;
  brn_sno: string;
  dept_sno: string;
}

interface Approver {
  primary_approver_id: string;
  secondary_approver_id: string;
  stage_id: number;
  com_sno: string;
  div_sno: string;
  brn_sno: string;
  dept_sno: string;
  is_active: boolean;
}

interface WorkflowFormData {
  workflow_name: string;
  workflow_code: string;
  entity_type: string;
  description: string;
  is_active: boolean;
}

interface WorkflowType {
  workflow_types_name: string;
  types_branches: string;
  is_active: boolean;
}

interface WorkflowStage {
  stage_order: number;
  stage_name: string;
  stage_type: "approval" | "notification" | "review";
  required_approvals: number;
  is_mandatory: boolean;
  can_skip: boolean;
  escalation_hours: number;
  is_active: boolean;
}

interface Condition {
  condition_name: string;
  condition_type: "amount" | "date" | "custom_field";
  operator_type: ">" | "<" | "=" | ">=" | "<=" | "!=" | "contains" | "not_contains";
  condition_value: string;
  priority_order: number;
  stage_id: number;
  target_stage_id: number;
  is_active: boolean;
}

export type { ApprovalWorkflow, ApprovalWorkflowType, ApprovalWorkflowStage, ApproverTable, ApprovalCondition, AuthBranch, Approver, WorkflowFormData, WorkflowType, WorkflowStage, Condition };