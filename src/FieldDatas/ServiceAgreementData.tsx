import { useMemo } from "react";
import { useMasterOptions } from "../hooks/ReUsableHook/useMasterOptions";
import { FieldType } from "./fieldType/fieldType";

import type { AgreementType } from "@/CustomComponent/ServiceComponents/serviceUtils";

// Fixed, Unfixed and Statutory (loan / repo / cash credit). Lives in serviceUtils so the
// shared badges and helpers can use it too; re-exported for the existing importers.
export type { AgreementType };

interface CascadeOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
  service_type_sno?: string | number | null;
  service_type_code?: string | null;
}

interface OrgCascadeParams {
  selectedCompany?: string;
  selectedDivision?: string;
  selectedBranch?: string;
}

/**
 * Shared org cascade (Company -> Division -> Branch -> Department), same
 * client-side-filter-by-parent-selection idiom as usePRBasicInfoFields
 * (FieldDatas/PRData.tsx) — all four masters fetched once unfiltered, no
 * server refetch on cascade change.
 */
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

interface ServiceAgreementFieldsParams extends OrgCascadeParams {
  agreementType: AgreementType;
}

/**
 * Fields for the Service Agreement create/edit form — Fixed, Unfixed and
 * Statutory. rate_amount/qty are entered here once and never re-entered at
 * approval time (see sql/86) — for Unfixed and Statutory, the actual
 * per-cycle amount is instead entered separately in the Service PO screen
 * when each cycle comes due. Suppliers and the Statutory facility block are
 * not plain fields; the page renders dedicated editors for them.
 */
export const useServiceAgreementFields = (params: ServiceAgreementFieldsParams): FieldType[] => {
  const { agreementType, ...cascadeParams } = params;
  const { options } = useMasterOptions([
    "CompanyMaster", "DivisionMaster", "BranchMaster", "DeptMaster",
    "ServiceMaster", "ServiceTypeMaster", "VendorMaster", "UomMaster", "RecurrenceCadenceMaster",
  ]);
  const { CompanyMaster, divisionOptions, branchOptions, deptOptions } = useOrgCascadeOptions(cascadeParams, options);

  // ServiceMaster narrowed to services whose type matches the chosen
  // agreement type — resolved via ServiceTypeMaster's service_type_code
  // extra field rather than a hardcoded sno, since master snos aren't stable.
  const serviceOptions = useMemo(() => {
    const serviceTypeSno = (options?.ServiceTypeMaster ?? []).find(
      (t: CascadeOption) => t.service_type_code === agreementType
    )?.value;
    if (serviceTypeSno == null) return [];
    return (options?.ServiceMaster ?? []).filter(
      (s: CascadeOption) => String(s.service_type_sno) === String(serviceTypeSno)
    );
  }, [options?.ServiceMaster, options?.ServiceTypeMaster, agreementType]);

  // Only month-based cadences need a PO generation day — a day-based cadence
  // (e.g. every 15 days) counts from the agreement's own start date instead.
  const cadenceOptions = options?.RecurrenceCadenceMaster ?? [];

  return useMemo<FieldType[]>(
    () => [
      ...orgCascadeFields(CompanyMaster, divisionOptions, branchOptions, deptOptions),
      { field: "service_sno", label: "Service", require: true, view: false, type: "search-select", options: serviceOptions, input: true },
      { field: "service_name", label: "Service", require: false, view: true, type: "text", input: false },
      // Suppliers are captured by the supplier-split editor (one or more suppliers, each with an
      // amount), not a single select — so this is display-only; the form posts `vendors[]`.
      { field: "vendor_sno", label: "Supplier", require: false, view: false, type: "search-select", options: options?.VendorMaster, input: false },
      { field: "vendor_name", label: "Supplier", require: false, view: true, type: "text", input: false },

      { field: "qty", label: "Quantity", require: true, view: true, type: "number", input: true, defaultValue: 1 },
      {
        field: "rate_amount", label: "Rate Amount", require: true, view: true,
        type: "number", input: true,
      },
      { field: "rate_uom_sno", label: "Rate UOM (per)", require: false, view: false, type: "search-select", options: options?.UomMaster, input: true },
      { field: "rate_uom_name", label: "Rate UOM", require: false, view: true, type: "text", input: false },

      { field: "recurrence_cadence_sno", label: "Recurrence Cadence", require: true, view: true, type: "select", options: cadenceOptions, input: true },
      { field: "cadence_name", label: "Cadence", require: false, view: false, type: "text", input: false },

      {
        field: "po_generation_day", label: "PO Generation Day (1-31)", require: false, view: true, type: "number",
        input: true, placeholder: "e.g. 5 for the 5th",
      },
      {
        field: "notify_days_before", label: "Notify Before (days)", require: false, view: true, type: "number",
        input: true, defaultValue: 0, placeholder: "e.g. 2",
      },

      { field: "period_start_date", label: "Duration From", require: true, view: true, type: "date", input: true },
      { field: "period_end_date", label: "Duration To", require: true, view: true, type: "date", input: true },
      { field: "agreement_document", label: "Agreement Document", require: true, view: false, type: "file", input: true },
      { field: "remarks", label: "Remarks", require: false, view: true, type: "textarea", input: true },
      {
        field: "terms_conditions", label: "Terms & Conditions", require: false, view: true, type: "textarea",
        input: true, placeholder: "Optional — any terms specific to this agreement",
      },
    ],
    [CompanyMaster, divisionOptions, branchOptions, deptOptions, serviceOptions, cadenceOptions, options]
  );
};
