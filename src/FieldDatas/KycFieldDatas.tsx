import { useMemo } from "react";
import { useAppSelector } from "@/globalState/hooks/useAppState";
import {
  selectCompanyHierarchy,
  selectCompanyHierarchyLoading,
  selectCompanyHierarchyError,
} from "@/globalState/features/hierarchyCompanyDetailsSlice";
import { Option, Company, Division, Branch } from "@/Application/Kyc-Screen/types/KycEntryType";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
import axios from "axios";
import type { FieldType, OptionType } from "./fieldType/fieldType";

export type { FieldType, OptionType };

// Builds ONE company -> division -> branch -> department chain at a time (single-select,
// cascading). A KYC record can still be linked to several such chains — see
// `OrgMapping` / the "add mapping" list in KycEntry.tsx — but each chain is picked as a
// single, unambiguous path rather than four independent multi-selects. That's what
// prevents the old bug where selecting e.g. two companies and a division/branch that
// happen to share a name across those companies made it impossible to tell which
// company the selection actually belonged to (and the backend used to cross-join every
// selected value together instead of saving the real combination).
export const useComDivBranchDeptFields = (
  selectedCompany: number | "",
  selectedDivision: number | "",
  selectedBranch: number | ""
) => {
  // Use specific selectors to avoid collision from useAppState spreading both
  // hierarchyCompany and sidebarData (both have { data, loading, error } keys)
  const hierarchyData = useAppSelector(selectCompanyHierarchy);
  const hierarchyLoading = useAppSelector(selectCompanyHierarchyLoading);
  const hierarchyError = useAppSelector(selectCompanyHierarchyError);
  // Real department master rows (each carries its own brn_sno/div_sno/com_sno) — not the
  // old static placeholder list, which had no relationship to the masters at all.
  const { options: masterOptions } = useMasterOptions(["DeptMaster","BankAccountTypeMaster"]);

  const companyOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies) return [];
    return hierarchyData.companies.map((company: Company) => ({
      label: company.com_name,
      value: Number(company.com_sno),
    }));
  }, [hierarchyData]);

  const divisionOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedCompany === "") return [];
    const company = hierarchyData.companies.find(
      (c: Company) => Number(c.com_sno) === Number(selectedCompany)
    );
    return (company?.divisions ?? []).map((division: Division) => ({
      label: division.div_name,
      value: Number(division.div_sno),
    }));
  }, [hierarchyData, selectedCompany]);

  const branchOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedDivision === "") return [];
    const division = hierarchyData.companies
      .flatMap((company: Company) => company.divisions ?? [])
      .find((d: Division) => Number(d.div_sno) === Number(selectedDivision));
    return (division?.branches ?? []).map((branch: Branch) => ({
      label: branch.brn_name,
      value: Number(branch.brn_sno),
    }));
  }, [hierarchyData, selectedDivision]);

  const departmentOptions: Option[] = useMemo(() => {
    if (selectedBranch === "") return [];
    const all = (masterOptions?.DeptMaster ?? []) as (Option & {
      brn_sno?: number | string | null;
    })[];
    return all
      .filter((d) => d.brn_sno != null && Number(d.brn_sno) === Number(selectedBranch))
      .map((d) => ({ label: d.label, value: Number(d.value) }));
  }, [masterOptions?.DeptMaster, selectedBranch]);

  const fields: FieldType[] = useMemo(
    () => [
      {
        field: "com_sno",
        label: "Company",
        require: true,
        type: "select",
        placeholder: "Select company",
        input: true,
        options: companyOptions,
        view: true,
        disabled: hierarchyLoading || !!hierarchyError,
      },
      {
        field: "div_sno",
        label: "Division",
        require: true,
        type: "select",
        placeholder: "Select division",
        input: true,
        options: divisionOptions,
        view: true,
        disabled: selectedCompany === "" || divisionOptions.length === 0,
      },
      {
        field: "brn_sno",
        label: "Branch",
        require: true,
        type: "select",
        placeholder: "Select branch",
        input: true,
        options: branchOptions,
        view: true,
        disabled: selectedDivision === "" || branchOptions.length === 0,
      },
      {
        field: "dept_sno",
        label: "Department",
        require: true,
        type: "select",
        placeholder: "Select department",
        input: true,
        options: departmentOptions,
        view: true,
        disabled: selectedBranch === "" || departmentOptions.length === 0,
      },
    ],
    [
      companyOptions,
      divisionOptions,
      branchOptions,
      departmentOptions,
      hierarchyLoading,
      hierarchyError,
      selectedCompany,
      selectedDivision,
      selectedBranch,
    ]
  );

  return {
    fields,
    companyOptions,
    divisionOptions,
    branchOptions,
    departmentOptions,
    loading: hierarchyLoading,
    error: hierarchyError,
  };
};

export const useBasicInfoFields = (basicInfo: any) => {
  const isGstAvail = basicInfo?.is_gst_avail === "true";
  const isMsmeAvail = basicInfo?.is_msme_avail === "true";
  const { options } = useMasterOptions(['SupplierCatagoryMaster','BusinessDetailsMatster','BankAccountTypeMaster']);
  return useMemo<FieldType[]>(
    () => [
      {
        field: "is_gst_avail",
        label: "GST Available",
        require: true,
        type: "radio",
        options: [
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ],
        placeholder: "GST availability",
        input: true,
        view: true,
      },
      {
        field: "is_msme_avail",
        label: "MSME Available",
        require: true,
        type: "radio",
        options: [
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ],
        placeholder: "MSME availability",
        input: true,
        view: true,
      },
       {
        field: "supplier_cat_code",
        label: "Supplier Category",
        require: true,
        type: "select",
        placeholder: "Select supplier category",
        options: options?.SupplierCatagoryMaster,
        input: true,
        view: true,
      },
       {
        field: "gst_no",
        label: "GST Number",
        require: isGstAvail,
        type: "text",
        placeholder: "22AAAAA0000A1Z5",
        input: !!isGstAvail,
        view: true,
      },
       {
        field: "pan_no",
        label: "PAN Number",
        require: true,
        type: "text",
        placeholder: "ABCDE1234F",
        input: true,
        view: true,
      },
      {
        field: "company_name",
        label: "Company Name",
        require: true,
        type: "text",
        placeholder: "Enter company name",
        input: true,
        view: true,
      },
      {
        field: "contact_name",
        label: "Proprietor / Contact Person",
        require: true,
        type: "text",
        placeholder: "Contact person name",
        input: true,
        view: true,
      },
      {
        field: "mobile_number",
        label: "Mobile Number",
        require: true,
        type: "text",
        placeholder: "+91 98765 43210",
        input: true,
        view: true,
      },
      {
        field: "email",
        label: "Email Address",
        require: true,
        type: "email",
        placeholder: "supplier@example.com",
        input: true,
        view: true,
      },
      {
        field: "business_type",
        label: "Business Type",
        require: true,
        type: "select",
        placeholder: "Select company type",
        options: options?.BusinessDetailsMatster,
        input: true,
        view: true,
      },
    
     
      {
        field: "msme_no",
        label: "MSME Number",
        require: isMsmeAvail,
        type: "text",
        placeholder: "UDYAM-XX-00-0000000",
        input: !!isMsmeAvail,
        view: true,
      },
    ],
    [isGstAvail, isMsmeAvail, options]
  );
};

export const useAddressFields = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      {
        field: "door_no",
        label: "Door / Building No",
        require: true,
        type: "text",
        placeholder: "123",
        input: true,
        view: true,
      },
      {
        field: "street",
        label: "Street Name",
        require: true,
        type: "text",
        placeholder: "Main Street",
        input: true,
        view: true,
      },
      {
        field: "area",
        label: "Area / Locality",
        require: true,
        type: "text",
        placeholder: "Downtown",
        input: true,
        view: true,
      },
      {
        field: "taluk",
        label: "Taluk",
        require: false,
        type: "text",
        placeholder: "Taluk name",
        input: true,
        view: true,
      },
      {
        field: "city",
        label: "City",
        require: true,
        type: "text",
        placeholder: "City name",
        input: true,
        view: true,
      },
      {
        field: "state",
        label: "State",
        require: true,
        type: "text",
        placeholder: "State name",
        input: true,
        view: true,
      },
      {
        field: "pincode",
        label: "Pincode",
        require: true,
        type: "text",
        placeholder: "600001",
        input: true,
        view: true,
      },
      {
        field: "location_link",
        label: "Google Maps Link",
        require: false,
        type: "text",
        placeholder: "https://maps.google.com/...",
        input: true,
        view: true,
      },
    ],
    []
  );
};

export const useDocumentFields = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      {
        field: "gst_file",
        label: "GST Certificate",
        require: false,
        type: "file",
        input: true,
        view: true,
      },
      {
        field: "pan_file",
        label: "PAN Card",
        require: true,
        type: "file",
        input: true,
        view: true,
      },
      {
        field: "msme_file",
        label: "MSME Certificate",
        require: false,
        type: "file",
        input: true,
        view: true,
      },
    ],
    []
  );
};

export const useBankFields = (): FieldType[] => {
  // Real bank-account-type master (Savings/Current/Cash Credit/Overdraft, admin-managed
  // via the Masters screen) instead of the old free-text "Savings / Current" placeholder.
  const { options: masterOptions } = useMasterOptions(["BankAccountTypeMaster"]);

  return useMemo<FieldType[]>(
    () => [
      {
        field: "ac_holder_name",
        label: "Account Holder Name",
        require: true,
        type: "text",
        placeholder: "As per bank records",
        input: true,
        view: true,
      },
      {
        field: "ac_number",
        label: "Account Number",
        require: true,
        type: "text",
        placeholder: "1234567890",
        input: true,
        view: true,
      },
      {
        field: "ac_type",
        label: "Account Type",
        require: true,
        type: "select",
        placeholder: "Select account type",
        options: masterOptions?.BankAccountTypeMaster || [],
        input: true,
        view: true,
      },
      {
        field: "ifsc",
        label: "IFSC Code",
        require: true,
        type: "text",
        placeholder: "SBIN0001234",
        input: true,
        view: true,
      },
      {
        field: "bank_name",
        label: "Bank Name",
        require: true,
        type: "text",
        placeholder: "Bank name",
        input: true,
        view: true,
      },
      {
        field: "bank_branch_name",
        label: "Branch Name",
        require: true,
        type: "text",
        placeholder: "Branch location",
        input: true,
        view: true,
      },
      {
        field: "bank_address",
        label: "Bank Address",
        require: true,
        type: "textarea",
        placeholder: "Full bank branch address",
        input: true,
        view: true,
      },
    ],
    [masterOptions]
  );
};

export const useContactFields = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      {
        field: "ownername",
        label: "Name",
        require: true,
        type: "text",
        placeholder: "Full name",
        input: true,
        view: true,
      },
      {
        field: "ownerposition",
        label: "Position / Designation",
        require: false,
        type: "text",
        placeholder: "E.g. Owner, Manager",
        input: true,
        view: true,
      },
      {
        field: "ownermobile",
        label: "Mobile",
        require: true,
        type: "text",
        placeholder: "+91 98765 43210",
        input: true,
        view: true,
      },
      {
        field: "owneremail",
        label: "Email",
        require: true,
        type: "email",
        placeholder: "contact@example.com",
        input: true,
        view: true,
      },
    ],
    []
  );
};
