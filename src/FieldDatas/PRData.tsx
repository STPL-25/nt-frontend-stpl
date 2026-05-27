// import { useMemo } from "react";
// import { useMasterOptions } from "../hooks/ReUsableHook/useMasterOptions";
// import { FieldType } from "./fieldType/fieldType";
// import type { HierarchyResponse } from "@/globalState/features/hierarchyCompanyDetailsSlice";

// interface CascadeOption {
//   value: string | number;
//   label: string;
//   com_sno?: string | number | null;
//   div_sno?: string | number | null;
//   brn_sno?: string | number | null;
// }

// interface PRBasicInfoFieldsParams {
//   hierarchyData?: HierarchyResponse | null;
//   selectedCompany?: string;
//   selectedDivision?: string;
//   selectedBranch?: string;
// }

// export const usePRBasicInfoFields = (params?: PRBasicInfoFieldsParams): FieldType[] => {
//   const { hierarchyData, selectedCompany, selectedDivision, selectedBranch } = params || {};
//   const { options } = useMasterOptions(['CompanyMaster','DivisionMaster','BranchMaster','DeptMaster','PriorityMaster', ]);
//   const {CompanyMaster, DivisionMaster, BranchMaster} = options || {};
// console.log("Hierarchy Data in PRBasicInfoFields:", options);
//   // Company options from hierarchy
  
//   return useMemo<FieldType[]>(
//     () => [
//       {
//         field: "com_sno",
//         label: "Company",
//         require: true,
//         view: false,
//         type: "select",
//         options: CompanyMaster,
//         input: true,
//       },
//       {
//         field: "com_name",
//         label: "Company",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       {
//         field: "div_sno",
//         label: "Division",
//         require: true,
//         view: false,
//         type: "select",
//         options: DivisionMaster,
//         input: true,
//       },
//       {
//         field: "div_name",
//         label: "Division",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       {
//         field: "brn_sno",
//         label: "Branch",
//         require: true,
//         view: false,
//         type: "select",
//         options: BranchMaster,
//         input: true,
//       },
//       {
//         field: "brn_name",
//         label: "Branch",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       {
//         field: "dept_sno",
//         label: "Department",
//         require: true,
//         view: false,
//         type: "select",
//         options: deptOptions,
//         input: true,
//       },
//       {
//         field: "dept_name",
//         label: "Department",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       {
//         field: "req_date",
//         label: "Request Date",
//         require: true,
//         view: true,
//         type: "date",
//         input: true,
//       },
//       {
//         field: "required_date",
//         label: "Required Date",
//         require: true,
//         view: true,
//         type: "date",
//         input: true,
//       },
//       {
//         field: "priority_sno",
//         label: "Priority",
//         require: true,
//         view: false,
//         type: "select",
//         options: options?.PriorityMaster,
//         input: true,
//       },
//       {
//         field: "priority_name",
//         label: "Priority",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       {
//         field: "purpose",
//         label: "Purpose",
//         require: false,
//         view: true,
//         type: "textarea",
//         input: true,
//       },
//       {
//         field: "pr_basic_sno",
//         label: "PR No.",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       {
//         field: "is_active",
//         label: "Active Status",
//         require: false,
//         view: false,
//         type: "text",
//         input: false,
//         defaultValue: true,
//       },
//     ],
//     [companyOptions, divisionOptions, branchOptions, deptOptions, options]
//   );
// };

// export type PRItemType = "product" | "service";

// interface PRItemFieldsParams {
//   itemType?: PRItemType | "";
//   allowedItemTypes?: PRItemType[];
// }

// export const usePRItemDetailsFields = (params?: PRItemFieldsParams): FieldType[] => {
//   const itemType = params?.itemType ?? "";
//   const allowedItemTypes =
//     params?.allowedItemTypes && params.allowedItemTypes.length > 0
//       ? params.allowedItemTypes
//       : (["product", "service"] as PRItemType[]);
//   const { options } = useMasterOptions(['ProductMaster', 'UomMaster']);

//   const supportsProducts = allowedItemTypes.includes("product");
//   const supportsServices = allowedItemTypes.includes("service");
//   // const isProduct = supportsProducts && (!itemType || itemType === "product");
//   const isService = supportsServices && itemType === "service";
//   const showCategory = allowedItemTypes.length > 1;
//   const itemTypeOptions = allowedItemTypes.map((type) => ({
//     value: type,
//     label: type === "product" ? "Product" : "Service",
//   }));

//   return useMemo<FieldType[]>(
//     () => [
//       {
//         field: "pr_item_sno",
//         label: "PR Item ID",
//         require: false,
//         view: false,
//         type: "text",
//         input: false,
//       },
//       // {
//       //   field: "item_type",
//       //   label: "Category",
//       //   require: true,
//       //   view: showCategory,
//       //   type: "radio",
//       //   options: itemTypeOptions,
//       //   input: showCategory,
//       // },
//       {
//         field: "prod_sno",
//         label: "Product",
//         require: false,
//         view: false,
//         type: "select",
//         options: options?.ProductMaster,
//         input: false,
//       },
//       {
//         field: "prod_name",
//         label: "Product",
//         require: false,
//         view: false,
//         type: "text",
//         input: true,
//       },
//       // {
//       //   field: "service_desc",
//       //   label: "Service Description",
//       //   require: isService,
//       //   view: isService,
//       //   type: "textarea",
//       //   input: isService,
//       // },
//       {
//         field: "qty",
//         label: "Quantity",
//         require: true,
//         view: true,
//         type: "number",
//         input: true,
//       },
//       {
//         field: "unit_sno",
//         label: "Unit",
//         require: false,
//         view: false,
//         type: "select",
//         options: options?.UomMaster,
//         input: true,
//       },
//       {
//         field: "unit_name",
//         label: "Unit",
//         require: false,
//         view: true,
//         type: "text",
//         input: false,
//       },
//       // {
//       //   field: "item_attachment",
//       //   label: "Attachment (Image / PDF)",
//       //   require: false,
//       //   view: false,
//       //   type: "file",
//       //   input: isProduct,
//       // },
//       {
//         field: "remarks",
//         label: "Remarks",
//         require: false,
//         view: false,
//         type: "textarea",
//         input: true,
//       },
//       {
//         field: "is_active",
//         label: "Active",
//         require: false,
//         view: false,
//         type: "text",
//         input: false,
//         defaultValue: true,
//       },
//     ],
//     [options,  isService, showCategory, itemTypeOptions]
//   );
// };

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
  const {
    selectedCompany,
    selectedDivision,
    selectedBranch,
  } = params || {};

  const { options } = useMasterOptions([
    "CompanyMaster",
    "DivisionMaster",
    "BranchMaster",
    "DeptMaster",
    "PriorityMaster",
  ]);

  const { CompanyMaster, DivisionMaster, BranchMaster, DeptMaster } = options || {};

  // Division: filter by selected Company
  const divisionOptions = useMemo(() => {
    if (!DivisionMaster) return [];
    if (!selectedCompany) return DivisionMaster;
    return DivisionMaster.filter(
      (d: CascadeOption) => String(d.com_sno) === String(selectedCompany)
    );
  }, [DivisionMaster, selectedCompany]);

  // Branch: filter by selected Company + Division
  const branchOptions = useMemo(() => {
    if (!BranchMaster) return [];
    return BranchMaster.filter((b: CascadeOption) => {
      const matchCompany  = !selectedCompany  || String(b.com_sno) === String(selectedCompany);
      const matchDivision = !selectedDivision || String(b.div_sno) === String(selectedDivision);
      return matchCompany && matchDivision;
    });
  }, [BranchMaster, selectedCompany, selectedDivision]);

  // Department: filter by selected Company + Division + Branch
  const deptOptions = useMemo(() => {
    if (!DeptMaster) return [];
    return DeptMaster.filter((d: CascadeOption) => {
      const matchCompany  = !selectedCompany  || String(d.com_sno) === String(selectedCompany);
      const matchDivision = !selectedDivision || String(d.div_sno) === String(selectedDivision);
      const matchBranch   = !selectedBranch   || String(d.brn_sno) === String(selectedBranch);
      return matchCompany && matchDivision && matchBranch;
    });
  }, [DeptMaster, selectedCompany, selectedDivision, selectedBranch]);

  return useMemo<FieldType[]>(
    () => [
      {
        field: "com_sno",
        label: "Company",
        require: true,
        view: false,
        type: "select",
        options: CompanyMaster,
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
      {
        field: "dept_sno",
        label: "Department",
        require: true,
        view: false,
        type: "select",
        options: deptOptions,
        input: true,
      },
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
    [CompanyMaster, divisionOptions, branchOptions, deptOptions, options]
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export type PRItemType = "product" | "service";

interface PRItemFieldsParams {
  itemType?: PRItemType | "";
  allowedItemTypes?: PRItemType[];
}

export const usePRItemDetailsFields = (params?: PRItemFieldsParams): FieldType[] => {
  const itemType = params?.itemType ?? "";
  const allowedItemTypes =
    params?.allowedItemTypes && params.allowedItemTypes.length > 0
      ? params.allowedItemTypes
      : (["product", "service"] as PRItemType[]);

  const { options } = useMasterOptions(["ProductMaster", "UomMaster"]);

  const supportsServices = allowedItemTypes.includes("service");
  const isService = supportsServices && itemType === "service";
  const showCategory = allowedItemTypes.length > 1;
  const itemTypeOptions = allowedItemTypes.map((type) => ({
    value: type,
    label: type === "product" ? "Product" : "Service",
  }));

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
        require: true,
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
    [options, isService, showCategory, itemTypeOptions]
  );
};