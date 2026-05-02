import { useMemo } from "react";
import { useAppSelector } from "@/globalState/hooks/useAppState";
import {
  selectCompanyHierarchy,
  selectCompanyHierarchyLoading,
  selectCompanyHierarchyError,
} from "@/globalState/features/hierarchyCompanyDetailsSlice";
import { Option, Company, Division, Branch } from "@/Application/Kyc-Screen/types/KycEntryType";

export type FieldInputType =
  | "text"
  | "number"
  | "select"
  | "date"
  | "email"
  | "textarea"
  | "file"
  | "radio"
  | "multi-select";

export interface OptionType {
  value: string | number;
  label: string;
}

export interface FieldType {
  field: string;
  label: string;
  require?: boolean;
  view?: boolean;
  type: FieldInputType;
  input?: boolean;
  placeholder?: string;
  options?: OptionType[] | any[];
  disabled?: boolean;
}

export const useComDivBranchDeptFields = (
  selectedCompany: number[],
  selectedDivision: number[]
) => {
  // Use specific selectors to avoid collision from useAppState spreading both
  // hierarchyCompany and sidebarData (both have { data, loading, error } keys)
  const hierarchyData = useAppSelector(selectCompanyHierarchy);
  const hierarchyLoading = useAppSelector(selectCompanyHierarchyLoading);
  const hierarchyError = useAppSelector(selectCompanyHierarchyError);

  const companyOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies) return [];
    return hierarchyData.companies.map((company: Company) => ({
      label: company.com_name,
      value: Number(company.com_sno),
    }));
  }, [hierarchyData]);

  const divisionOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedCompany.length === 0) return [];
    return hierarchyData.companies
      .filter((company: Company) =>
        selectedCompany.includes(Number(company.com_sno))
      )
      .flatMap((company: any) =>
        company.divisions.map((division: Division) => ({
          label: division.div_name,
          value: Number(division.div_sno),
        }))
      );
  }, [hierarchyData, selectedCompany]);

  const branchOptions: Option[] = useMemo(() => {
    if (!hierarchyData?.companies || selectedDivision.length === 0) return [];
    return hierarchyData.companies
      .flatMap((company: any) => company.divisions)
      .filter((division: Division) =>
        selectedDivision.includes(Number(division.div_sno))
      )
      .flatMap((division: Division) =>
        division.branches.map((branch: Branch) => ({
          label: branch.brn_name,
          value: Number(branch.brn_sno),
        }))
      );
  }, [hierarchyData, selectedDivision]);

  const departmentOptions: Option[] = useMemo(
    () => [
      { value: "1", label: "Procurement" },
      { value: "2", label: "Finance" },
      { value: "3", label: "Operations" },
      { value: "4", label: "HR" },
      { value: "5", label: "Administration" },
    ],
    []
  );

  const fields: FieldType[] = useMemo(
    () => [
      {
        field: "com_sno",
        label: "Company",
        require: true,
        type: "multi-select",
        placeholder: "Select companies",
        input: false,
        options: companyOptions,
        view: false,
        disabled: hierarchyLoading || !!hierarchyError,
      },
      {
        field: "div_sno",
        label: "Division",
        require: false,
        type: "multi-select",
        placeholder: "Select divisions",
        input: false,
        options: divisionOptions,
        view: false,
        disabled: selectedCompany.length === 0 || divisionOptions.length === 0,
      },
      {
        field: "brn_sno",
        label: "Branch",
        require: false,
        type: "multi-select",
        placeholder: "Select branches",
        input: false,
        options: branchOptions,
        view: false,
        disabled: selectedDivision.length === 0 || branchOptions.length === 0,
      },
      {
        field: "dept_sno",
        label: "Department",
        require: false,
        type: "multi-select",
        placeholder: "Select departments",
        input: false,
        options: departmentOptions,
        view: false,
        disabled: false,
      },
    ],
    [companyOptions, divisionOptions, branchOptions, departmentOptions]
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

export const useBasicInfoFields = (basicInfo: any): FieldType[] => {
  const isGstAvail = basicInfo?.is_gst_avail === "true";
  const isMsmeAvail = basicInfo?.is_msme_avail === "true";

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
        type: "text",
        placeholder: "E.g. MSME, Sole Proprietor, Pvt Ltd",
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
        field: "msme_no",
        label: "MSME Number",
        require: isMsmeAvail,
        type: "text",
        placeholder: "UDYAM-XX-00-0000000",
        input: !!isMsmeAvail,
        view: true,
      },
    ],
    [isGstAvail, isMsmeAvail]
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
        type: "text",
        placeholder: "Savings / Current",
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
    []
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
