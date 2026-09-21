import { useMemo } from "react";
import { useMasterOptions } from "../hooks/ReUsableHook/useMasterOptions";
import { FieldType } from "./fieldType/fieldType";

interface CascadeOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
}

interface OrgCascadeParams {
  selectedCompany?: string;
  selectedDivision?: string;
  selectedBranch?: string;
}

/** Same client-side-filter-by-parent-selection cascade used across the
 * Service* Vendor Driven forms (ServiceVendorEntryData.tsx). */
function useOrgCascadeOptions(params: OrgCascadeParams | undefined, options: any) {
  const { selectedCompany, selectedDivision, selectedBranch } = params || {};
  const { CompanyMaster, DivisionMaster, BranchMaster, DeptMaster } = options || {};

  const divisionOptions = useMemo(() => {
    if (!DivisionMaster) return [];
    if (!selectedCompany) return DivisionMaster;
    return DivisionMaster.filter((d: CascadeOption) => String(d.com_sno) === String(selectedCompany));
  }, [DivisionMaster, selectedCompany]);

  const branchOptions = useMemo(() => {
    if (!BranchMaster) return [];
    return BranchMaster.filter((b: CascadeOption) => {
      const matchCompany = !selectedCompany || String(b.com_sno) === String(selectedCompany);
      const matchDivision = !selectedDivision || String(b.div_sno) === String(selectedDivision);
      return matchCompany && matchDivision;
    });
  }, [BranchMaster, selectedCompany, selectedDivision]);

  const deptOptions = useMemo(() => {
    if (!DeptMaster) return [];
    return DeptMaster.filter((d: CascadeOption) => {
      const matchCompany = !selectedCompany || String(d.com_sno) === String(selectedCompany);
      const matchDivision = !selectedDivision || String(d.div_sno) === String(selectedDivision);
      const matchBranch = !selectedBranch || String(d.brn_sno) === String(selectedBranch);
      return matchCompany && matchDivision && matchBranch;
    });
  }, [DeptMaster, selectedCompany, selectedDivision, selectedBranch]);

  return { CompanyMaster, divisionOptions, branchOptions, deptOptions };
}

function orgCascadeFields(CompanyMaster: any, divisionOptions: any, branchOptions: any, deptOptions: any): FieldType[] {
  return [
    { field: "com_sno", label: "Company", require: true, view: false, type: "select", options: CompanyMaster, input: true },
    { field: "com_name", label: "Company", require: false, view: true, type: "text", input: false },
    { field: "div_sno", label: "Division", require: true, view: false, type: "select", options: divisionOptions, input: true },
    { field: "div_name", label: "Division", require: false, view: true, type: "text", input: false },
    { field: "brn_sno", label: "Branch", require: true, view: false, type: "select", options: branchOptions, input: true },
    { field: "brn_name", label: "Branch", require: false, view: true, type: "text", input: false },
    { field: "dept_sno", label: "Department", require: true, view: false, type: "select", options: deptOptions, input: true },
    { field: "dept_name", label: "Department", require: false, view: true, type: "text", input: false },
  ];
}

const PAYMENT_CYCLE_OPTIONS = [
  { label: "Every 15 days", value: 15 },
  { label: "Every 30 days", value: 30 },
  { label: "Custom", value: "CUSTOM" },
];

/** Header fields for a Vendor-Driven Purchase Requisition — supplier and
 * payment cadence are picked up front, unlike a Regular PR where the
 * vendor is only resolved later at the PO/quotation stage. */
export const useVendorDrivenPRHeaderFields = (params: OrgCascadeParams | undefined): FieldType[] => {
  const { options } = useMasterOptions([
    "CompanyMaster", "DivisionMaster", "BranchMaster", "DeptMaster",
    "PriorityMaster", "VendorMaster",
  ]);
  const { CompanyMaster, divisionOptions, branchOptions, deptOptions } = useOrgCascadeOptions(params, options);

  return useMemo<FieldType[]>(
    () => [
      ...orgCascadeFields(CompanyMaster, divisionOptions, branchOptions, deptOptions),
      { field: "vendor_sno", label: "Supplier", require: true, view: false, type: "search-select", options: options?.VendorMaster, input: true },
      { field: "vendor_name", label: "Supplier", require: false, view: true, type: "text", input: false },
      { field: "req_date", label: "Request Date", require: true, view: true, type: "date", input: true },
      { field: "required_date", label: "Required Date", require: true, view: true, type: "date", input: true },
      { field: "priority_sno", label: "Priority", require: true, view: false, type: "select", options: options?.PriorityMaster, input: true },
      { field: "payment_cycle_days", label: "Payment Cycle", require: true, view: true, type: "select", options: PAYMENT_CYCLE_OPTIONS, input: true, defaultValue: 15 },
      { field: "purpose", label: "Purpose", require: false, view: true, type: "textarea", input: true },
      // One verification document for the whole requisition — not per line.
      // A canteen order can have a dozen vegetable/grocery lines covered by
      // a single delivery challan/invoice, so requiring a separate upload
      // per item was pure friction. usp_InsertVendorDrivenPurchaseRequest
      // now requires this at the header level instead.
      { field: "attachment", label: "Verification Document", require: true, view: false, type: "file", input: true },
    ],
    [CompanyMaster, divisionOptions, branchOptions, deptOptions, options]
  );
};

/** One product line being added to the requisition. rate/gst_pct/
 * discount_pct default to 0 client-side so a GST-exempt or non-discounted
 * line needs no extra toggle — matches usp_InsertVendorDrivenPurchaseRequest's
 * own COALESCE(...,0) handling server-side. */
export const useVendorDrivenPRItemFields = (): FieldType[] => {
  const { options } = useMasterOptions(["ProductMaster", "UomMaster"]);

  return useMemo<FieldType[]>(
    () => [
      { field: "prod_sno", label: "Product", require: true, view: false, type: "search-select", options: options?.ProductMaster, input: true },
      { field: "prod_name", label: "Product", require: false, view: true, type: "text", input: false },
      { field: "qty", label: "Quantity", require: true, view: true, type: "number", input: true },
      { field: "unit_sno", label: "Unit", require: true, view: false, type: "search-select", options: options?.UomMaster, input: true },
      { field: "unit_name", label: "Unit", require: false, view: true, type: "text", input: false },
      { field: "rate", label: "Rate", require: true, view: true, type: "number", input: true },
      { field: "discount_pct", label: "Discount %", require: false, view: true, type: "number", input: true, defaultValue: 0 },
      { field: "gst_pct", label: "GST %", require: false, view: true, type: "number", input: true, defaultValue: 0 },
      { field: "remarks", label: "Remarks", require: false, view: true, type: "text", input: true },
    ],
    [options]
  );
};
