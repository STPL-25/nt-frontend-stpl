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

export interface CascadeOption {
  value: string | number;
  label: string;
  brn_sno?: string | number | null;
  div_sno?: string | number | null;
  com_sno?: string | number | null;
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

  // Full department master list, each option carrying its own real com_sno/div_sno/brn_sno —
  // used as the source of truth for which branch a department actually belongs to (never a
  // cross-join guess). Exposed separately from the filtered dropdown options below.
  const allDepartments: CascadeOption[] = useMemo(
    () => (masterOptions?.DeptMaster ?? []) as CascadeOption[],
    [masterOptions?.DeptMaster]
  );

  // Branch name lookup, used to disambiguate departments when more than one branch is selected
  // (e.g. two different companies can each have a branch/dept with the same name).
  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of (hierarchyData?.companies ?? []) as Company[]) {
      for (const d of c.divisions ?? []) {
        for (const b of d.branches ?? []) {
          map.set(String(b.brn_sno), b.brn_name);
        }
      }
    }
    return map;
  }, [hierarchyData]);

  // Filter departments to only those belonging to the selected branches, deduped by dept_sno
  const deptOptions: Option[] = useMemo(() => {
    const filtered =
      selectedBranch.length === 0
        ? allDepartments
        : allDepartments.filter((d) => d.brn_sno != null && selectedBranch.includes(Number(d.brn_sno)));
    const seen = new Set<string>();
    const multiBranch = selectedBranch.length > 1;
    const out: Option[] = [];
    for (const d of filtered) {
      const key = String(d.value);
      if (seen.has(key)) continue;
      seen.add(key);
      const brnName = d.brn_sno != null ? branchNameById.get(String(d.brn_sno)) : undefined;
      out.push({
        value: d.value,
        label: multiBranch && brnName ? `${d.label} (${brnName})` : d.label,
      });
    }
    return out;
  }, [allDepartments, selectedBranch, branchNameById]);

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
    const multiCompany = selectedCompany.length > 1;
    return hierarchyData.companies
      .filter((c: Company) => selectedCompany.includes(Number(c.com_sno)))
      .flatMap((c: Company) =>
        c.divisions.map((d: Division) => ({
          label: multiCompany ? `${d.div_name} (${c.com_name})` : d.div_name,
          value: d.div_sno,
        }))
      );
  }, [hierarchyData, selectedCompany]);

  const branchOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedDivision.length === 0) return [];
    const multiDivision = selectedDivision.length > 1;
    return hierarchyData.companies
      .flatMap((c: Company) => c.divisions.map((d: Division) => ({ ...d, com_name: c.com_name })))
      .filter((d: Division & { com_name: string }) => selectedDivision.includes(Number(d.div_sno)))
      .flatMap((d: Division & { com_name: string }) =>
        d.branches.map((b: Branch) => ({
          label: multiDivision ? `${b.brn_name} (${d.div_name})` : b.brn_name,
          value: b.brn_sno,
        }))
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
    allDepartments,
    entityTypeCount,
    workflowsLoading,
    workflowFields,
    workflowTypeFields,
    hierarchyLoading,
    hierarchyError,
    hierarchyData,
  };
};
