import { useMemo } from "react";
import { useAppSelector } from "@/globalState/hooks/useAppState";
import {
  selectCompanyHierarchy,
  selectCompanyHierarchyLoading,
  selectCompanyHierarchyError,
} from "@/globalState/features/hierarchyCompanyDetailsSlice";
import useFetch from "@/hooks/useFetchHook";
import { apiGetWorkflows } from "@/Services/Api";
interface Option {
  label: string;
  value: string | number;
}

interface Company {
  com_sno: string;
  com_name: string;
  divisions: Division[];
}

interface Division {
  div_sno: string;
  div_name: string;
  branches: Branch[];
}

interface Branch {
  brn_sno: string;
  brn_name: string;
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

// Static department list (matches KycFieldDatas)
const DEPT_OPTIONS: Option[] = [
  { value: "1", label: "Procurement" },
  { value: "2", label: "Finance" },
  { value: "3", label: "Operations" },
  { value: "4", label: "HR" },
  { value: "5", label: "Administration" },
];

export const useApprovalFlowHierarchy = (
  selectedCompany: number[] = [],
  selectedDivision: number[] = [],
  selectedBranch: number[] = []
) => {
  // Use dedicated selectors to avoid the useAppState() spread-overwrite bug
  const hierarchyData = useAppSelector(selectCompanyHierarchy);
  const hierarchyLoading = useAppSelector(selectCompanyHierarchyLoading);
  const hierarchyError = useAppSelector(selectCompanyHierarchyError);
  const { data: workflowsData, loading: workflowsLoading } = useFetch<any>(apiGetWorkflows);

  const entityTypeOptions: Option[] = useMemo(() => {
    const list: any[] = Array.isArray(workflowsData?.data) ? workflowsData.data : [];
    const seen = new Set<string>();
    return list.reduce<Option[]>((acc, w) => {
      if (w.entity_type && !seen.has(w.entity_type)) {
        seen.add(w.entity_type);
        acc.push({ label: w.entity_type, value: w.entity_type });
      }
      return acc;
    }, []);
  }, [workflowsData]);

  const entityTypeCount: Record<string, number> = useMemo(() => {
    const list: any[] = Array.isArray(workflowsData?.data) ? workflowsData.data : [];
    return list.reduce<Record<string, number>>((acc, w) => {
      if (w.entity_type) acc[w.entity_type] = (acc[w.entity_type] || 0) + 1;
      return acc;
    }, {});
  }, [workflowsData]);
  const companyOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies) return [];
    return hierarchyData.companies.map((c: Company) => ({
      label: c.com_name,
      value: c.com_sno,
    }));
  }, [hierarchyData]);

  const divisionOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedCompany.length === 0) return [];
    return hierarchyData.companies
      .filter((c: Company) => selectedCompany.includes(Number(c.com_sno)))
      .flatMap((c: Company) =>
        c.divisions.map((d: Division) => ({ label: d.div_name, value: d.div_sno }))
      );
  }, [hierarchyData, selectedCompany]);

  const branchOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedDivision.length === 0) return [];
    return hierarchyData.companies
      .flatMap((c: Company) => c.divisions)
      .filter((d: Division) => selectedDivision.includes(Number(d.div_sno)))
      .flatMap((d: Division) =>
        d.branches.map((b: Branch) => ({ label: b.brn_name, value: b.brn_sno }))
      );
  }, [hierarchyData, selectedDivision]);

  // Step 1 — Basic workflow info fields
  const workflowFields: FieldType[] = useMemo(
    () => [
      {
        field: "entity_type",
        label: "Entity Type",
        require: true,
        type: "select",
        placeholder: "Select entity type",
        input: true,
        options: entityTypeOptions,
        view: true,
      },
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
        field: "description",
        label: "Description",
        require: false,
        type: "textarea",
        placeholder: "Describe the purpose of this workflow...",
        input: true,
        view: true,
        rows: 3,
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
    [entityTypeOptions]
  );

  // Step 2 — Workflow type fields (cascade company→division→branch + static dept)
  const workflowTypeFields: FieldType[] = useMemo(
    () => [
      {
        field: "workflow_types_name",
        label: "Type Name",
        require: true,
        type: "text",
        placeholder: "e.g., Standard Approval, Fast Track",
        input: true,
        view: true,
      },
      {
        field: "com_sno",
        label: "Company",
        require: true,
        type: "select",
        placeholder: "Select company",
        input: true,
        options: companyOptions,
        view: true,
        disabled: hierarchyLoading || !!hierarchyError,
      },
      {
        field: "div_sno",
        label: "Division",
        require: true,
        type: "select",
        placeholder: "Select division",
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
        placeholder: "Select branch",
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
        placeholder: "Select department",
        input: true,
        options: DEPT_OPTIONS,
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
    [companyOptions, divisionOptions, branchOptions, hierarchyLoading, hierarchyError]
  );

  return {
    companyOptions,
    divisionOptions,
    branchOptions,
    departmentOptions: DEPT_OPTIONS,
    entityTypeCount,
    workflowsLoading,
    workflowFields,
    workflowTypeFields,
    hierarchyLoading,
    hierarchyError,
  };
};
