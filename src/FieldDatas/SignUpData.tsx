import { useMemo } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
export type OptionType = {
  value: string | number;
  label: string;
};

export type FieldType = {
  field: string;
  label: string;
  type: "text" | "number" | "password" | "select";
  placeholder?: string;
  require?: boolean;
  options?: OptionType[] | any[]; // tighten this when you know exact shape
  maxLength?: number;
  show?: boolean;
  showToggle?: boolean;
};

/**
 * useSignUpFields
 */
const useSignUpFields = (): FieldType[] => {
  // leave useAppState loosely typed for now; you can tighten these types later
  const { companyDetails, divDetails, branchDetails, deptDetails, setDeptDetails, formData } =
    useAppState() as any;

  return useMemo<FieldType[]>(
    () => [
      { field: "ecno", label: "Ecno", type: "text", placeholder: "Enter ECNO", require: true },
      // {
      //   field: "com_sno",
      //   label: "Company",
      //   type: "select",
      //   require: true,
      //   options: companyDetails || [],
      //   placeholder: "Select Company",
      // },
      // {
      //   field: "div_sno",
      //   label: "Division",
      //   type: "select",
      //   require: true,
      //   options: divDetails || [],
      //   placeholder: "Select Division",
      // },
      // {
      //   field: "brn_sno",
      //   label: "Branch",
      //   type: "select",
      //   require: true,
      //   options: branchDetails || [],
      //   placeholder: "Select Branch",
      // },
      // {
      //   field: "dept_sno",
      //   label: "Department",
      //   type: "select",
      //   require: true,
      //   options: deptDetails || [],
      //   placeholder: "Select Department",
      // },
      {
        field: "sign_up_cug",
        label: "Cug Mobile Number",
        type: "number",
        placeholder: "Enter CUG Mobile Number",
        require: true,
        maxLength: 10,
      },
      // { field: "sign_up_otp", label: "Otp", type: "number", placeholder: "Enter OTP", require: true, maxLength: 6, show: false },
      { field: "sign_up_pass", label: "Password", type: "password", placeholder: "Enter Password", require: true, maxLength: 6, show: false },
      { field: "con_sign_up_pass", label: "Confirm Password", type: "password", placeholder: "Enter Confirm Password", require: true, maxLength: 6, show: false },
    ],
    // keep dependency list similar to original
    [companyDetails, divDetails, branchDetails, formData?.com_sno, formData?.div_sno, formData?.brn_no]
  );
};

/**
 * useLoginFields
 */
const useLoginFields = (): FieldType[] => {
  return [
    { field: "ecno", label: "Ecno", type: "text", placeholder: "Enter ECNO", require: true },
    { field: "sign_up_pass", label: "Password", type: "password", placeholder: "Enter Password", require: true, showToggle: true },
  ];
};

export { useSignUpFields, useLoginFields };
