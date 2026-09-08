import {
  useCompanyMasterFields,
  useDivisionMasterFields,
  useBranchMasterFields,
  useUomMasterFields,
  useTransportMasterFields,
  useAcYearFields,
  useGSTMasterFields,
  useDeptMasterFields,
  usePrefixFieldsMaster,
  usePriorityFieldsMaster,
  useBankAccountTypeFieldsMaster,
  useWarehouseLocationFieldsMaster,
  useDesignationMasterFields,
  useScreensFieldsMaster,
  usePermissionFieldsMaster,
  useProductCatagoryMaster,
  useProductFieldsMaster,
  useProductSubCatagoryMaster,
  useSupplierCatagoryFieldsMaster,
  usePaymentModeFieldsMaster,
  useServiceMasterFields,
  useWorkflowMasterFields,
  useRecurrenceCadenceMasterFieldsMaster,
  useServiceMasterSupplierMappingFieldsMaster,
} from "./Data";
import type { FieldType } from "./Data";

export const useMasterDataFields = () => {

  const fields = {
    CompanyMaster: useCompanyMasterFields(),
    DivisionMaster: useDivisionMasterFields(),
    BranchMaster: useBranchMasterFields(),
    UomMaster: useUomMasterFields(),
    TransportMaster: useTransportMasterFields(),
    AcYearMaster: useAcYearFields(),
    GSTStateCodeMaster: useGSTMasterFields(),
    DeptMaster: useDeptMasterFields(),
    PrefixMaster: usePrefixFieldsMaster(),
    PriorityMaster: usePriorityFieldsMaster(),
    BankAccountTypeMaster: useBankAccountTypeFieldsMaster(),
    WarehouseLocationMaster: useWarehouseLocationFieldsMaster(),
    DesignationMaster: useDesignationMasterFields(),
    ScreenMaster: useScreensFieldsMaster(),
    ScreenPermission: usePermissionFieldsMaster(),
    ProductMaster: useProductFieldsMaster(),
    ProductCategoryMaster: useProductCatagoryMaster(),
    ProductSubCategoryMaster: useProductSubCatagoryMaster(),
    SupplierCatagoryMaster: useSupplierCatagoryFieldsMaster(),
    PaymentModeMaster: usePaymentModeFieldsMaster(),
    ServiceMaster: useServiceMasterFields(),
    WorkflowMaster: useWorkflowMasterFields(),
    RecurrenceCadenceMaster: useRecurrenceCadenceMasterFieldsMaster(),
    ServiceMasterSupplierMapping: useServiceMasterSupplierMappingFieldsMaster(),

  };

  return { fields };
};
