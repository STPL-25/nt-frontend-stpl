import { useMemo } from "react";
import { useMasterOptions } from "../hooks/ReUsableHook/useMasterOptions";

interface OrgOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
  uom_name?: string | null;
  prod_code?: string | null;
}

interface Params {
  selectedCompany?: string;
  selectedDivision?: string;
  selectedBranch?: string;
}

/**
 * Option lists for the Special Agreement form: the Company -> Division -> Branch -> Department
 * cascade (all four masters fetched once and filtered client-side by the parent selection, same
 * idiom as ServiceAgreementData), plus approved suppliers and products.
 */
export const useSpecialAgreementOptions = ({ selectedCompany, selectedDivision, selectedBranch }: Params) => {
  const { options } = useMasterOptions([
    "CompanyMaster", "DivisionMaster", "BranchMaster", "DeptMaster", "VendorMaster", "ProductMaster",
  ]);

  const divisionOptions = useMemo<OrgOption[]>(() => {
    const all: OrgOption[] = options?.DivisionMaster ?? [];
    return selectedCompany ? all.filter((d) => String(d.com_sno) === String(selectedCompany)) : all;
  }, [options?.DivisionMaster, selectedCompany]);

  const branchOptions = useMemo<OrgOption[]>(() => {
    const all: OrgOption[] = options?.BranchMaster ?? [];
    return all.filter((b) =>
      (!selectedCompany || String(b.com_sno) === String(selectedCompany)) &&
      (!selectedDivision || String(b.div_sno) === String(selectedDivision)));
  }, [options?.BranchMaster, selectedCompany, selectedDivision]);

  const deptOptions = useMemo<OrgOption[]>(() => {
    const all: OrgOption[] = options?.DeptMaster ?? [];
    return all.filter((d) =>
      (!selectedCompany || String(d.com_sno) === String(selectedCompany)) &&
      (!selectedDivision || String(d.div_sno) === String(selectedDivision)) &&
      (!selectedBranch || String(d.brn_sno) === String(selectedBranch)));
  }, [options?.DeptMaster, selectedCompany, selectedDivision, selectedBranch]);

  return {
    companyOptions: (options?.CompanyMaster ?? []) as OrgOption[],
    divisionOptions, branchOptions, deptOptions,
    vendorOptions: (options?.VendorMaster ?? []) as OrgOption[],
    productOptions: (options?.ProductMaster ?? []) as OrgOption[],
  };
};
