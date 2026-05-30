import { useMemo } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
import type { FieldType, OptionType } from "./fieldType/fieldType";

export type { FieldType, OptionType };

/* ---------- Static Options (no master table) ---------- */

const categoryOptions: OptionType[] = [
  { value: "software",  label: "Software" },
  { value: "hardware",  label: "Hardware" },
  { value: "services",  label: "Services" },
  { value: "training",  label: "Training" },
  { value: "travel",    label: "Travel" },
  { value: "other",     label: "Other" },
];

/* ---------- Hooks ---------- */

const useBudgetCommonFields = (): FieldType[] => {
  const { deptDetails } = useAppState();
  const { options } = useMasterOptions(["PriorityMaster"]);

  const priorityOptions: OptionType[] = useMemo(
    () =>
      (options?.PriorityMaster ?? []).length > 0
        ? (options.PriorityMaster as OptionType[])
        : [
            { value: "low",    label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high",   label: "High" },
            { value: "urgent", label: "Urgent" },
          ],
    [options?.PriorityMaster]
  );

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
    [deptDetails, priorityOptions]
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
