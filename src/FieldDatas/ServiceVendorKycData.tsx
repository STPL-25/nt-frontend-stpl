import { useMemo } from "react";
import { useMasterOptions } from "../hooks/ReUsableHook/useMasterOptions";
import { useBankFields } from "./KycFieldDatas";
import type { FieldType } from "./fieldType/fieldType";

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

// Same "fetch all + client-filter by parent selection" idiom as
// FieldDatas/ServiceAgreementData.tsx's useOrgCascadeOptions.
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

/**
 * Fields for the Service Vendor KYC create form — org scope, basic company/
 * contact/PAN/GST/MSME info, a single primary bank account (reuses the goods-
 * KYC's useBankFields verbatim) and a preferred payment mode. No address
 * section (a service vendor's work site varies per engagement).
 */
export const useServiceVendorKycFields = (params: OrgCascadeParams): FieldType[] => {
  const { options } = useMasterOptions([
    "CompanyMaster", "DivisionMaster", "BranchMaster", "DeptMaster",
    "SupplierCatagoryMaster", "BusinessDetailsMatster", "PaymentModeMaster",
  ]);
  const { CompanyMaster, divisionOptions, branchOptions, deptOptions } = useOrgCascadeOptions(params, options);
  const bankFields = useBankFields();

  return useMemo<FieldType[]>(
    () => [
      ...orgCascadeFields(CompanyMaster, divisionOptions, branchOptions, deptOptions),

      { field: "company_name", label: "Company Name", require: true, type: "text", placeholder: "Enter company name", input: true, view: true },
      { field: "contact_person", label: "Contact Person", require: true, type: "text", placeholder: "Contact person name", input: true, view: true },
      { field: "mobile_number", label: "Mobile Number", require: true, type: "text", placeholder: "+91 98765 43210", input: true, view: true },
      { field: "email", label: "Email Address", require: true, type: "email", placeholder: "vendor@example.com", input: true, view: true },
      { field: "business_type", label: "Business Type", require: true, type: "select", options: options?.BusinessDetailsMatster, placeholder: "Select business type", input: true, view: true },
      { field: "supplier_cat_code", label: "Category", require: false, type: "select", options: options?.SupplierCatagoryMaster, placeholder: "Select category", input: true, view: true },
      { field: "pan_no", label: "PAN Number", require: true, type: "text", placeholder: "ABCDE1234F", input: true, view: true },
      {
        field: "is_gst_avail", label: "GST Available", require: true, type: "radio", input: true, view: true,
        options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }],
      },
      { field: "gst_no", label: "GST Number", require: false, type: "text", placeholder: "22AAAAA0000A1Z5", input: true, view: true },
      {
        field: "is_msme_avail", label: "MSME Available", require: true, type: "radio", input: true, view: true,
        options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }],
      },
      { field: "msme_no", label: "MSME Number", require: false, type: "text", placeholder: "UDYAM-XX-00-0000000", input: true, view: true },

      ...bankFields,
      { field: "preferred_payment_mode", label: "Preferred Payment Mode", require: false, type: "select", options: options?.PaymentModeMaster, placeholder: "Select payment mode", input: true, view: true },

      { field: "document", label: "Supporting Document", require: false, type: "file", input: true, view: true },
      { field: "remarks", label: "Remarks", require: false, type: "textarea", placeholder: "Any additional notes", input: true, view: true },
    ],
    [CompanyMaster, divisionOptions, branchOptions, deptOptions, options, bankFields]
  );
};
