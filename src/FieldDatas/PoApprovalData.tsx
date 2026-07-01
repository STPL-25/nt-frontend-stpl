import { FieldType } from "./fieldType/fieldType";
import { useMemo } from "react";

export const usePoApprovalSideCardDatas = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "quotation_ref_no",   label: "Quotation No",     view: true, type: "text", input: false },
      { field: "pr_no",              label: "PR Reference",     view: true, type: "text", input: false },
      { field: "company_name",       label: "Vendor",           view: true, type: "text", input: false },
      { field: "pr_created_by_name", label: "Created By",       view: true, type: "text", input: false },
      { field: "pr_created_by",      label: "Employee No",      view: true, type: "text", input: false },
      { field: "dept_name",          label: "Department",       view: true, type: "text", input: false },
      { field: "brn_name",           label: "Branch",           view: true, type: "text", input: false },
      { field: "div_name",           label: "Division",         view: true, type: "text", input: false },
      { field: "com_name",           label: "Company",          view: true, type: "text", input: false },
      { field: "quotation_date",     label: "Quotation Date",   view: true, type: "date", input: false },
      { field: "valid_upto",         label: "Valid Until",      view: true, type: "date", input: false },
      { field: "payment_terms",      label: "Payment Terms",    view: true, type: "text", input: false },
      { field: "approver_name",      label: "Current Approver", view: true, type: "text", input: false },
    ],
    []
  );
};
