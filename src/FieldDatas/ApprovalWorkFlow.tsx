import { useMemo } from "react";
import { useAppSelector } from "@/globalState/hooks/useAppState";
import {
  selectCompanyHierarchy,
  selectCompanyHierarchyLoading,
  selectCompanyHierarchyError,
} from "@/globalState/features/hierarchyCompanyDetailsSlice";
import useFetch from "@/hooks/useFetchHook";
import { apiGetWorkflows } from "@/Services/Api";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";

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

interface CascadeOption {
  value: string | number;
  label: string;
  brn_sno?: string | number | null;
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
  const hierarchyData = useAppSelector(selectCompanyHierarchy);
  const hierarchyLoading = useAppSelector(selectCompanyHierarchyLoading);
  const hierarchyError = useAppSelector(selectCompanyHierarchyError);
  const { data: workflowsData, loading: workflowsLoading } = useFetch<any>(apiGetWorkflows);
  const { options: masterOptions } = useMasterOptions(['DeptMaster']);

  // Filter departments to only those belonging to the selected branches, deduped by dept_sno
  const deptOptions: Option[] = useMemo(() => {
    const all = (masterOptions?.DeptMaster ?? []) as CascadeOption[];
    if (selectedBranch.length === 0) return all;
    const seen = new Set<string>();
    return all.filter((d) => {
      if (d.brn_sno == null || !selectedBranch.includes(Number(d.brn_sno))) return false;
      const key = String(d.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [masterOptions?.DeptMaster, selectedBranch]);

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

  // Step 1 — Basic workflow info fields (workflow_code excluded — auto-generated on save)
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

  // Workflow type fields — multi-select for all hierarchy levels + department
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
        field: "com_snos",
        label: "Company",
        require: true,
        type: "multi-select",
        placeholder: "Select companies",
        input: true,
        options: companyOptions,
        view: true,
        disabled: hierarchyLoading || !!hierarchyError,
      },
      {
        field: "div_snos",
        label: "Division",
        require: true,
        type: "multi-select",
        placeholder: "Select divisions",
        input: true,
        options: divisionOptions,
        view: true,
        disabled: divisionOptions.length === 0,
      },
      {
        field: "brn_snos",
        label: "Branch",
        require: true,
        type: "multi-select",
        placeholder: "Select branches",
        input: true,
        options: branchOptions,
        view: true,
        disabled: branchOptions.length === 0,
      },
      {
        field: "dept_snos",
        label: "Department",
        require: true,
        type: "multi-select",
        placeholder: "Select departments",
        input: true,
        options: deptOptions,
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
    [companyOptions, divisionOptions, branchOptions, deptOptions, hierarchyLoading, hierarchyError]
  );

  return {
    companyOptions,
    divisionOptions,
    branchOptions,
    departmentOptions: deptOptions,
    entityTypeCount,
    workflowsLoading,
    workflowFields,
    workflowTypeFields,
    hierarchyLoading,
    hierarchyError,
    hierarchyData,
  };
};
