import { useSelector } from "react-redux";
import type { RootState } from "@/globalState/store";
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
import type { FieldType
} from "./Data";


// Define expected shape of form data if needed
// Adjust according to your actual form structure
interface FormState {
  [key: string]: any;
}

export const useMasterDataFields = () => {
  // Typed selector
  const formData: FormState = useSelector(
    (state: RootState) => state.form
  ) || {};

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
