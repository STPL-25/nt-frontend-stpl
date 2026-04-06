import { FieldType } from "./fieldType/fieldType";
import { useMemo } from "react";

export const usePrApprovalSideCardDatas = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "pr_no",              label: "PR No",              view: true, type: "text", input: false },
      { field: "created_by_name",    label: "Requested By",       view: true, type: "text", input: false },
      { field: "created_by",         label: "Employee No",        view: true, type: "text", input: false },
      { field: "dept_name",          label: "Department",         view: true, type: "text", input: false },
      { field: "brn_name",           label: "Branch",             view: true, type: "text", input: false },
      { field: "div_name",           label: "Division",           view: true, type: "text", input: false },
      { field: "com_name",           label: "Company",            view: true, type: "text", input: false },
      { field: "reg_date",           label: "Request Date",       view: true, type: "date",  input: false },
      { field: "required_date",      label: "Required By",        view: true, type: "date",  input: false },
      { field: "current_approver_id",label: "Current Approver",   view: true, type: "text", input: false },
    ],
    []
  );
};