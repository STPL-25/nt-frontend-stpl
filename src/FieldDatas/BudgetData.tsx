import { useMemo } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
/* ---------- Types ---------- */

export interface OptionType {
  value: string | number;
  label: string;
}

export interface FieldType {
  field: string;
  label: string;
  type: "text" | "number" | "select";
  placeholder?: string;
  require?: boolean;
  options?: OptionType[] | any[];
}

/* ---------- Static Options ---------- */

const priorityOptions: OptionType[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const categoryOptions: OptionType[] = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "services", label: "Services" },
  { value: "training", label: "Training" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

/* ---------- Hooks ---------- */

const useBudgetCommonFields = (): FieldType[] => {
  const { deptDetails } = useAppState();

  return useMemo<FieldType[]>(
    () => [
      {
        field: "title",
        label: "Title",
        type: "text",
        placeholder: "Enter Title",
        require: true,
      },
      {
        field: "dept_sno",
        label: "Department",
        type: "select",
        require: true,
        options: (deptDetails as OptionType[]) || [],
        placeholder: "Select Department",
      },
      {
        field: "req_by",
        label: "Requested By",
        type: "text",
        placeholder: "Enter Requested By",
        require: true,
      },
      {
        field: "priority",
        label: "Priority",
        type: "select",
        placeholder: "Select Priority",
        options: priorityOptions,
        require: true,
      },
    ],
    [deptDetails]
  );
};

const useBudgetItemFields = (): FieldType[] => {
  return [
    {
      field: "bud_dta_desc",
      label: "Description",
      type: "text",
      placeholder: "Enter Purpose",
      require: true,
    },
    {
      field: "bud_dta_ctg",
      label: "Category",
      type: "select",
      placeholder: "Select Category",
      options: categoryOptions,
      require: true,
    },
    {
      field: "bud_dta_req_qty",
      label: "Quantity",
      type: "number",
      placeholder: "Enter Quantity",
      require: true,
    },
    {
      field: "uom_sno",
      label: "UOM",
      type: "text",
      placeholder: "Select UOM",
      require: true,
      options: [],
    },
    {
      field: "bud_dta_unt_cst",
      label: "Unit Price",
      type: "number",
      placeholder: "Enter Unit Price",
      require: true,
    },
  ];
};

export { useBudgetCommonFields, useBudgetItemFields };
