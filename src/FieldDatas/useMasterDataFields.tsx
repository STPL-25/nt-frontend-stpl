import {
  useCompanyMasterFields,
  useDivisionMasterFields,
  useBranchMasterFields,
  useUomMasterFields,
  useAcYearFields,
  useGSTMasterFields,
  useDeptMasterFields,
  usePrefixFieldsMaster,
  usePriorityFieldsMaster,
  useScreensFieldsMaster,
  usePermissionFieldsMaster,
  useProductCatagoryMaster,
  useProductFieldsMaster,
  useProductSubCatagoryMaster,
  useWorkflowMasterFields,
} from "./Data";
import type { FieldType } from "./Data";

export const useMasterDataFields = () => {

  const fields = {
    CompanyMaster: useCompanyMasterFields(),
    DivisionMaster: useDivisionMasterFields(),
    BranchMaster: useBranchMasterFields(),
    UomMaster: useUomMasterFields(),
    AcYearMaster: useAcYearFields(),
    GSTStateCodeMaster: useGSTMasterFields(),
    DeptMaster: useDeptMasterFields(),
    PrefixMaster: usePrefixFieldsMaster(),
    PriorityMaster: usePriorityFieldsMaster(),
    ScreenMaster: useScreensFieldsMaster(),
    ScreenPermission: usePermissionFieldsMaster(),
    ProductMaster: useProductFieldsMaster(),
    ProductCategoryMaster: useProductCatagoryMaster(),
    ProductSubCategoryMaster: useProductSubCatagoryMaster(),
    WorkflowMaster: useWorkflowMasterFields(),

  };

  return { fields };
};
