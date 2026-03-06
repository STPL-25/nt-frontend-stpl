// import { useMemo } from "react";
// import { useAppState } from "@/globalState/hooks/useAppState";
// import { Option, Company, Division, Branch } from "@/Application/Kyc-Screen/types/KycEntryType";


// export type FieldInputType = | "text"  | "number"  | "select"  | "date"   | "email"   | "textarea"  | "file"  | "radio"   | "multi-select";

// export interface OptionType {
//   value: string | number;
//   label: string;
// }

// export interface FieldType {
//   field: string;
//   label: string;
//   require?: boolean;
//   view?: boolean;
//   type: FieldInputType;
//   input?: boolean;
//   placeholder?: string;
//   options?: OptionType[] | any[];
//   disabled?: boolean;
// }

// export const useApprovalFlowHierarchy = ( selectedCompany: number[], selectedDivision: number[], selectedBranch: number[]) => {
   
//   const { data: hierarchyData,loading: hierarchyLoading, error: hierarchyError  } = useAppState();

//   // Generate Company Options
//   const companyOptions: Option[] = useMemo(() => {
//     if (!hierarchyData?.companies) return [];
    
//     return hierarchyData.companies.map((company: Company) => ({
//       label: company.com_name,
//       value: company.com_sno,
//     }));
//   }, [hierarchyData]);

//   // Generate Division Options (filtered by selected companies)
//   const divisionOptions: Option[] = useMemo(() => {
//     if (!hierarchyData?.companies || selectedCompany.length === 0) return [];
    
//     return hierarchyData.companies
//       .filter((company: Company) => 
//         selectedCompany.includes(company.com_sno)
//       )
//       .flatMap((company: Company) => 
//         company.divisions.map((division: Division) => ({
//           label: division.div_name,
//           value: division.div_sno,
//         }))
//       );
//   }, [hierarchyData, selectedCompany]);

//   // Generate Branch Options (filtered by selected divisions)
//   const branchOptions: Option[] = useMemo(() => {
//     if (!hierarchyData?.companies || selectedDivision.length === 0) return [];
    
//     return hierarchyData.companies
//       .flatMap((company: Company) => company.divisions)
//       .filter((division: Division) => 
//         selectedDivision.includes(division.div_sno)
//       )
//       .flatMap((division: Division) => 
//         division.branches.map((branch: Branch) => ({
//           label: branch.brn_name,
//           value: branch.brn_sno,
//         }))
//       );
//   }, [hierarchyData, selectedDivision]);

//   // Generate Department Options (filtered by selected branches)
//   const departmentOptions: Option[] = useMemo(() => {
//     if (!hierarchyData?.companies || selectedBranch.length === 0) return [];
    
//     return hierarchyData.companies
//       .flatMap((company: Company) => company.divisions)
//       .flatMap((division: Division) => division.branches)
//       .filter((branch: Branch) => 
//         selectedBranch.includes(branch.brn_sno)
//       )
//       .flatMap((branch: Branch) => 
//         branch.departments?.map((dept: Department) => ({
//           label: dept.dept_name,
//           value: dept.dept_sno,
//         })) || []
//       );
//   }, [hierarchyData, selectedBranch]);

//   // Generate User/Approver Options (filtered by selected departments)
//   const approverOptions: Option[] = useMemo(() => {
//     if (!hierarchyData?.users) return [];
    
//     return hierarchyData.users.map((user: any) => ({
//       label: `${user.username} - ${user.designation}`,
//       value: user.userid,
//     }));
//   }, [hierarchyData]);

//   // Field Configuration for Approval Flow
//   const approvalFlowFields: FieldType[] = useMemo(
//     () => [
//       { 
//         field: "com_sno", 
//         label: "Company", 
//         require: true, 
//         type: "multi-select", 
//         placeholder: "Select companies",
//         input: true,
//         options: companyOptions,
//         view: true,
//         disabled: hierarchyLoading || !!hierarchyError
//       },
//       { 
//         field: "div_sno", 
//         label: "Division", 
//         require: true, 
//         type: "multi-select", 
//         placeholder: "Select divisions",
//         input: true,
//         options: divisionOptions,
//         view: true,
//         disabled: selectedCompany.length === 0 || divisionOptions.length === 0
//       },
//       { 
//         field: "brn_sno", 
//         label: "Branch", 
//         require: true, 
//         type: "multi-select", 
//         placeholder: "Select branches",
//         input: true,
//         options: branchOptions,
//         view: true,
//         disabled: selectedDivision.length === 0 || branchOptions.length === 0
//       },
//       { 
//         field: "dept_sno", 
//         label: "Department", 
//         require: true, 
//         type: "multi-select", 
//         placeholder: "Select departments",
//         input: true,
//         options: departmentOptions,
//         view: true,
//         disabled: selectedBranch.length === 0 || departmentOptions.length === 0
//       },
//     ],
//     [
//       companyOptions, 
//       divisionOptions, 
//       branchOptions, 
//       departmentOptions,
//       hierarchyLoading,
//       hierarchyError,
//       selectedCompany.length,
//       selectedDivision.length,
//       selectedBranch.length
//     ]
//   );

//   // Field Configuration for Approvers (with user selection)
//   const approverFields: FieldType[] = useMemo(
//     () => [
//       ...approvalFlowFields,
//       { 
//         field: "primary_approver_id", 
//         label: "Primary Approver", 
//         require: true, 
//         type: "select", 
//         placeholder: "Select primary approver",
//         input: true,
//         options: approverOptions,
//         view: true,
//         disabled: false
//       },
//       { 
//         field: "secondary_approver_id", 
//         label: "Secondary Approver", 
//         require: false, 
//         type: "select", 
//         placeholder: "Select secondary approver (optional)",
//         input: true,
//         options: [{ value: "0", label: "None" }, ...approverOptions],
//         view: true,
//         disabled: false
//       },
//     ],
//     [approvalFlowFields, approverOptions]
//   );

//   return {
//     approvalFlowFields,
//     approverFields,
//     companyOptions,
//     divisionOptions,
//     branchOptions,
//     departmentOptions,
//     approverOptions,
//     hierarchyLoading,
//     hierarchyError
//   };
// };
// hooks/useApprovalFlowHierarchy.ts
import { useMemo } from 'react';
import { useAppState } from '@/globalState/hooks/useAppState';
interface Option {
  label: string;
  value: string | number;
}

interface Company {
  com_sno: number;
  com_name: string;
  divisions: Division[];
}

interface Division {
  div_sno: number;
  div_name: string;
  branches: Branch[];
}

interface Branch {
  brn_sno: number;
  brn_name: string;
  departments?: Department[];
}

interface Department {
  dept_sno: number;
  dept_name: string;
}

interface FieldType {
  field: string;
  label: string;
  require?: boolean;
  type?: string;
  placeholder?: string;
  input?: boolean;
  options?: Option[];
  view?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
  min?: string | number;
}

export const useApprovalFlowHierarchy = (
  selectedCompany: number[] = [],
  selectedDivision: number[] = [],
  selectedBranch: number[] = []
) => {
  const { data: hierarchyData, loading: hierarchyLoading, error: hierarchyError } = useAppState();

  // Generate Company Options
  const companyOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies) return [];
    
    return hierarchyData.companies.map((company: Company) => ({
      label: company.com_name,
      value: company.com_sno,
    }));
  }, [hierarchyData]);

  // Generate Division Options (filtered by selected companies)
  const divisionOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedCompany.length === 0) return [];
    
    return hierarchyData.companies
      .filter((company: Company) => 
        selectedCompany.includes(company.com_sno)
      )
      .flatMap((company: Company) => 
        company.divisions.map((division: Division) => ({
          label: division.div_name,
          value: division.div_sno,
        }))
      );
  }, [hierarchyData, selectedCompany]);

  // Generate Branch Options (filtered by selected divisions)
  const branchOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedDivision.length === 0) return [];
    
    return hierarchyData.companies
      .flatMap((company: Company) => company.divisions)
      .filter((division: Division) => 
        selectedDivision.includes(division.div_sno)
      )
      .flatMap((division: Division) => 
        division.branches.map((branch: Branch) => ({
          label: branch.brn_name,
          value: branch.brn_sno,
        }))
      );
  }, [hierarchyData, selectedDivision]);

  // Generate Department Options (filtered by selected branches)
  const departmentOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedBranch.length === 0) return [];
    
    return hierarchyData.companies
      .flatMap((company: Company) => company.divisions)
      .flatMap((division: Division) => division.branches)
      .filter((branch: Branch) => 
        selectedBranch.includes(branch.brn_sno)
      )
      .flatMap((branch: Branch) => 
        branch.departments?.map((dept: Department) => ({
          label: dept.dept_name,
          value: dept.dept_sno,
        })) || []
      );
  }, [hierarchyData, selectedBranch]);

  // Generate User/Approver Options
  const approverOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.users) return [];
    
    return hierarchyData.users.map((user: any) => ({
      label: `${user.username} - ${user.designation}`,
      value: user.userid,
    }));
  }, [hierarchyData]);

  // Field Configuration for Basic Workflow Info
  const workflowFields: FieldType[] = useMemo(
    () => [
      {
        field: "workflow_name",
        label: "Workflow Name",
        require: true,
        type: "text",
        placeholder: "e.g., KYC Approval Workflow",
        input: true,
        view: true,
      },
      {
        field: "workflow_code",
        label: "Workflow Code",
        require: true,
        type: "text",
        placeholder: "e.g., WF_KYC_001",
        input: true,
        view: true,
      },
      {
        field: "entity_type",
        label: "Entity Type",
        require: true,
        type: "select",
        placeholder: "Select entity type",
        input: true,
        options: [
          { label: "KYC - Know Your Customer", value: "KYC" },
          { label: "PR - Purchase Requisition", value: "PR" },
          { label: "PO - Purchase Order", value: "PO" },
          { label: "INV - Invoice", value: "INV" },
          { label: "EXP - Expense Claim", value: "EXP" },
          { label: "LEAVE - Leave Request", value: "LEAVE" },
        ],
        view: true,
      },
      {
        field: "description",
        label: "Description",
        require: false,
        type: "textarea",
        placeholder: "Describe the purpose of this workflow...",
        input: true,
        view: true,
        rows: 4,
      },
      {
        field: "is_active",
        label: "Active Workflow",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
    ],
    []
  );

  // Field Configuration for Workflow Types
  const workflowTypeFields: FieldType[] = useMemo(
    () => [
      {
        field: "workflow_types_name",
        label: "Type Name",
        require: true,
        type: "text",
        placeholder: "e.g., Standard KYC, Fast Track KYC",
        input: true,
        view: true,
      },
      // {
      //   field: "types_branches",
      //   label: "Type Branches",
      //   require: false,
      //   type: "text",
      //   placeholder: "e.g., ALL, MUMBAI, DELHI",
      //   input: true,
      //   view: true,
      // },
      {
        field: "is_active",
        label: "Active",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
    ],
    []
  );

  // Field Configuration for Auth Branches (Hierarchy)
  const authBranchFields: FieldType[] = useMemo(
    () => [
      {
        field: "com_sno",
        label: "Company",
        require: true,
        type: "multi-select",
        placeholder: "Select",
        input: true,
        options: companyOptions,
        view: true,
        disabled: hierarchyLoading || !!hierarchyError,
        className: "h-9",
      },
      {
        field: "div_sno",
        label: "Division",
        require: true,
        type: "multi-select",
        placeholder: "Select",
        input: true,
        options: divisionOptions,
        view: true,
        disabled: divisionOptions.length === 0,
        className: "h-9",
      },
      {
        field: "brn_sno",
        label: "Branch",
        require: true,
        type: "multi-select",
        placeholder: "Select",
        input: true,
        options: branchOptions,
        view: true,
        disabled: branchOptions.length === 0,
        className: "h-9",
      },
      {
        field: "dept_sno",
        label: "Department",
        require: true,
        type: "multi-select",
        placeholder: "Select",
        input: true,
        options: departmentOptions,
        view: true,
        disabled: departmentOptions.length === 0,
        className: "h-9",
      },
    ],
    [
      companyOptions,
      divisionOptions,
      branchOptions,
      departmentOptions,
      hierarchyLoading,
      hierarchyError,
    ]
  );

  // Field Configuration for Stages
  const stageFields: FieldType[] = useMemo(
    () => [
      {
        field: "stage_name",
        label: "Stage Name",
        require: true,
        type: "text",
        placeholder: "e.g., Manager Approval, Finance Review",
        input: true,
        view: true,
      },
      {
        field: "stage_type",
        label: "Stage Type",
        require: false,
        type: "select",
        input: true,
        options: [
          { label: "Approval", value: "approval" },
          { label: "Review", value: "review" },
          { label: "Notification", value: "notification" },
        ],
        view: true,
      },
      {
        field: "required_approvals",
        label: "Required Approvals",
        require: false,
        type: "number",
        min: "1",
        input: true,
        view: true,
      },
      {
        field: "escalation_hours",
        label: "Escalation Hours",
        require: false,
        type: "number",
        min: "1",
        input: true,
        view: true,
      },
      {
        field: "is_mandatory",
        label: "Mandatory",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
      {
        field: "can_skip",
        label: "Can Skip",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
      {
        field: "is_active",
        label: "Active",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
    ],
    []
  );

  // Field Configuration for Approvers (with hierarchy + user selection)
  const approverFields: FieldType[] = useMemo(
    () => [
      {
        field: "stage_id",
        label: "Stage",
        require: true,
        type: "select",
        placeholder: "Select stage",
        input: true,
        options: [], // Will be populated dynamically with stages
        view: true,
      },
      {
        field: "primary_approver_id",
        label: "Primary Approver",
        require: true,
        type: "select",
        placeholder: "Select user",
        input: true,
        options: approverOptions,
        view: true,
      },
      {
        field: "secondary_approver_id",
        label: "Secondary Approver",
        require: false,
        type: "select",
        placeholder: "Select user",
        input: true,
        options: [{ value: "0", label: "None" }, ...approverOptions],
        view: true,
      },
      {
        field: "com_sno",
        label: "Company",
        require: true,
        type: "select",
        placeholder: "Select",
        input: true,
        options: companyOptions,
        view: true,
      },
      {
        field: "div_sno",
        label: "Division",
        require: true,
        type: "select",
        placeholder: "Select",
        input: true,
        options: divisionOptions,
        view: true,
        disabled: divisionOptions.length === 0,
      },
      {
        field: "brn_sno",
        label: "Branch",
        require: true,
        type: "select",
        placeholder: "Select",
        input: true,
        options: branchOptions,
        view: true,
        disabled: branchOptions.length === 0,
      },
      {
        field: "dept_sno",
        label: "Department",
        require: true,
        type: "select",
        placeholder: "Select",
        input: true,
        options: departmentOptions,
        view: true,
        disabled: departmentOptions.length === 0,
      },
      {
        field: "is_active",
        label: "Active",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
    ],
    [companyOptions, divisionOptions, branchOptions, departmentOptions, approverOptions]
  );

  // Field Configuration for Conditions
  const conditionFields: FieldType[] = useMemo(
    () => [
      {
        field: "condition_name",
        label: "Condition Name",
        require: false,
        type: "text",
        placeholder: "e.g., High Value Check",
        input: true,
        view: true,
      },
      {
        field: "condition_type",
        label: "Condition Type",
        require: false,
        type: "select",
        input: true,
        options: [
          { label: "Amount", value: "amount" },
          { label: "Date", value: "date" },
          { label: "Custom Field", value: "custom_field" },
        ],
        view: true,
      },
      {
        field: "operator_type",
        label: "Operator",
        require: false,
        type: "select",
        input: true,
        options: [
          { label: "> Greater than", value: ">" },
          { label: ">= Greater or equal", value: ">=" },
          { label: "< Less than", value: "<" },
          { label: "<= Less or equal", value: "<=" },
          { label: "= Equal to", value: "=" },
          { label: "!= Not equal", value: "!=" },
          { label: "Contains", value: "contains" },
          { label: "Not Contains", value: "not_contains" },
        ],
        view: true,
      },
      {
        field: "condition_value",
        label: "Value",
        require: false,
        type: "text",
        placeholder: "e.g., 100000",
        input: true,
        view: true,
      },
      {
        field: "stage_id",
        label: "From Stage",
        require: false,
        type: "select",
        placeholder: "Select",
        input: true,
        options: [], // Will be populated dynamically with stages
        view: true,
      },
      {
        field: "target_stage_id",
        label: "Route to Stage",
        require: false,
        type: "select",
        placeholder: "Select",
        input: true,
        options: [], // Will be populated dynamically with stages
        view: true,
      },
      {
        field: "is_active",
        label: "Active",
        require: false,
        type: "switch",
        input: true,
        view: true,
      },
    ],
    []
  );

  return {
    // Options
    companyOptions,
    divisionOptions,
    branchOptions,
    departmentOptions,
    approverOptions,
    
    // Field Configurations
    workflowFields,
    workflowTypeFields,
    authBranchFields,
    stageFields,
    approverFields,
    conditionFields,
    
    // Loading/Error states
    hierarchyLoading,
    hierarchyError,
  };
};
