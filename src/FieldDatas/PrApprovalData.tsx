import { FieldType } from "./fieldType/fieldType";
import { useMemo } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";


export const usePrApprovalSideCardDatas = (): FieldType[] => {

  return useMemo<FieldType[]>(
    () => [
      { field: "pr_no", label: "PR No", require: false, view: true, type: "text", input: false },
      { field: "ename", label: "Employee Name", require: true, view: true, type: "text", input: true },
      { field: "dept", label: "Department", require: true, view: true, type: "text", input: true },
      { field: "total_cost", label: "Total Estimation Cost", require: true, view: true, type: "text", input: true },
      { field: "purpose", label: "Purpose", require: true, view: false, type: "select", options:  [], input: true },
      { field: "priority_name", label: "Priority", require: true, view: true, type: "text", input: false },
    ],
    []
  );
};