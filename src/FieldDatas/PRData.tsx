import { useMemo } from "react";
import { useMasterOptions } from "../hooks/ReUsableHook/useMasterOptions";
import { FieldType } from "./fieldType/fieldType";
import type { HierarchyResponse } from "@/globalState/features/hierarchyCompanyDetailsSlice";

interface CascadeOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
}

interface PRBasicInfoFieldsParams {
  hierarchyData?: HierarchyResponse | null;
  selectedCompany?: string;
  selectedDivision?: string;
  selectedBranch?: string;
}

export const usePRBasicInfoFields = (params?: PRBasicInfoFieldsParams): FieldType[] => {
  const { hierarchyData, selectedCompany, selectedDivision, selectedBranch } = params || {};
  const { options } = useMasterOptions(['PriorityMaster', 'DeptMaster']);

  // Company options from hierarchy
  const companyOptions = useMemo(() => {
    if (!hierarchyData?.companies) return [];
    return hierarchyData.companies.map((c) => ({
      value: String(c.com_sno),
      label: c.com_name,
    }));
  }, [hierarchyData]);

  // Division options filtered by selected company
  const divisionOptions = useMemo(() => {
    if (!hierarchyData?.companies || !selectedCompany) return [];
    const company = hierarchyData.companies.find((c) => String(c.com_sno) === String(selectedCompany));
    if (!company) return [];
    return company.divisions.map((d) => ({
      value: String(d.div_sno),
      label: d.div_name,
    }));
  }, [hierarchyData, selectedCompany]);

  // Branch options filtered by selected division
  const branchOptions = useMemo(() => {
    if (!hierarchyData?.companies || !selectedDivision) return [];
    for (const company of hierarchyData.companies) {
      const division = company.divisions.find((d) => String(d.div_sno) === String(selectedDivision));
      if (division) {
        return division.branches.map((b) => ({
          value: String(b.brn_sno),
          label: b.brn_name,
        }));
      }
    }
    return [];
  }, [hierarchyData, selectedDivision]);

  // Department options filtered by selected branch
  const deptOptions = useMemo(() => {
    if (!options?.DeptMaster || !selectedBranch) return [];
    return (options.DeptMaster as CascadeOption[]).filter(
      (d) => d.brn_sno != null && String(d.brn_sno) === String(selectedBranch)
    );
  }, [options?.DeptMaster, selectedBranch]);

  return useMemo<FieldType[]>(
    () => [
      {
        field: "com_sno",
        label: "Company",
        require: true,
        view: false,
        type: "select",
        options: companyOptions,
        input: true,
      },
      {
        field: "com_name",
        label: "Company",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "div_sno",
        label: "Division",
        require: true,
        view: false,
        type: "select",
        options: divisionOptions,
        input: true,
      },
      {
        field: "div_name",
        label: "Division",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "brn_sno",
        label: "Branch",
        require: true,
        view: false,
        type: "select",
        options: branchOptions,
        input: true,
      },
      {
        field: "brn_name",
        label: "Branch",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      // {
      //   field: "dept_sno",
      //   label: "Department",
      //   require: true,
      //   view: false,
      //   type: "select",
      //   options: deptOptions,
      //   input: true,
      // },
      {
        field: "dept_name",
        label: "Department",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "req_date",
        label: "Request Date",
        require: true,
        view: true,
        type: "date",
        input: true,
      },
      {
        field: "required_date",
        label: "Required Date",
        require: true,
        view: true,
        type: "date",
        input: true,
      },
      {
        field: "priority_sno",
        label: "Priority",
        require: true,
        view: false,
        type: "select",
        options: options?.PriorityMaster,
        input: true,
      },
      {
        field: "priority_name",
        label: "Priority",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "purpose",
        label: "Purpose",
        require: false,
        view: true,
        type: "textarea",
        input: true,
      },
      {
        field: "pr_basic_sno",
        label: "PR No.",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "is_active",
        label: "Active Status",
        require: false,
        view: false,
        type: "text",
        input: false,
        defaultValue: true,
      },
    ],
    [companyOptions, divisionOptions, branchOptions, deptOptions, options]
  );
};

export const usePRItemDetailsFields = (): FieldType[] => {
  const { options } = useMasterOptions(['ProductMaster', 'UomMaster']);

  return useMemo<FieldType[]>(
    () => [
      {
        field: "pr_item_sno",
        label: "PR Item ID",
        require: false,
        view: false,
        type: "text",
        input: false,
      },
      {
        field: "prod_sno",
        label: "Product",
        require: false,
        view: false,
        type: "select",
        options: options?.ProductMaster,
        input: true,
      },
      {
        field: "prod_name",
        label: "Product",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "qty",
        label: "Quantity",
        require: false,
        view: true,
        type: "number",
        input: true,
      },
      {
        field: "unit_sno",
        label: "Unit",
        require: false,
        view: false,
        type: "select",
        options: options?.UomMaster,
        input: true,
      },
      {
        field: "unit_name",
        label: "Unit",
        require: false,
        view: true,
        type: "text",
        input: false,
      },
      {
        field: "est_cost",
        label: "Estimated Cost",
        require: false,
        view: true,
        type: "number",
        input: true,
      },
      {
        field: "total_cost",
        label: "Total Cost",
        require: false,
        view: true,
        type: "number",
        input: true,
      },
      {
        field: "remarks",
        label: "Remarks",
        require: false,
        view: true,
        type: "textarea",
        input: true,
      },
      {
        field: "is_active",
        label: "Active",
        require: false,
        view: false,
        type: "text",
        input: false,
        defaultValue: true,
      },
    ],
    [options]
  );
};
