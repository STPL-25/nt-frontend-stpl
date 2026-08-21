import { lazy, LazyExoticComponent, ComponentType } from "react";


 export const MasterComponents = lazy(() => import(".././Application/Master-Screen/MasterPageScreen"));

 export const KYCEntry = lazy(() => import("../Application/Kyc-Screen/KycEntry"));
 export const SupplierKYCEntry = lazy(() => import("../Application/Kyc-Screen/SupplierKYCEntry"));
 export const RoleApproval = lazy(() => import("../Application/RoleApproval/UserRoleApprovalScreen"));
 export const KYCDataView = lazy(() => import("../Application/Kyc-Screen/KYCDataView"));
 export const KYCApprovalScreen = lazy(() => import("../Application/Kyc-Screen/KYCApprovalScreen"));
 export const PurchaseRequisitionPage = lazy(() => import("../Application/PR/PurchaseRequisitionPage"));
 export const RoutineRequisitionPage = lazy(() => import("../Application/PR/RoutineRequisitionPage"));
 export const CivilWorksRequisitionPage = lazy(() => import("../Application/PR/CivilWorksRequisitionPage"));
 export const ElectricalWorksRequisitionPage = lazy(() => import("../Application/PR/ElectricalWorksRequisitionPage"));
 export const TransportationRequisitionPage = lazy(() => import("../Application/PR/TransportationRequisitionPage"));
 export const ApprovalWorkflowPage = lazy(() => import("../Application/RoleApproval/ApprovalWorkflowManager"));
 export const PRApprovalScreen = lazy(() => import("../Application/PR/PRApprovalScreen"));
 export const StoreRequisition = lazy(() => import("../Application/Store/StoreRequisition"));
 export const StoreIssuePage = lazy(() => import("../Application/Store/StoreIssuePage"));
 export const StorePOGeneratePage = lazy(() => import("../Application/Store/StorePOGeneratePage"));
 export const PurchaseOrder = lazy(() => import("../Application/PurchaseOrder/PurchaseOrder"));
 export const PurchaseTeamPage = lazy(() => import("../Application/PurchaseOrder/PurchaseTeamPage"));
 export const POApprovalScreen = lazy(() => import("../Application/PurchaseOrder/POApprovalScreen"));
//  export const PurchaseTeamPRView = lazy(() => import("../Application/PurchaseOrder/PurchaseTeamPRView"));
 export const PurchaseRequisitionReview = lazy(() => import("../Application/PR/PurchaseRequisitionReview"));
 export const GateEntryPage = lazy(() => import("../Application/GateEntry/GateEntryPage"));
 export const GRNPage = lazy(() => import("../Application/GRN/GRNPage"));
 export const POAmendmentPage = lazy(() => import("../Application/POAmendment/POAmendmentPage"));
 export const InventoryPage = lazy(() => import("../Application/Inventory/InventoryPage"));
 export const StockRequestPage = lazy(() => import("../Application/StockRequest/StockRequestPage"));
 export const StockIssuePage = lazy(() => import("../Application/StockRequest/StockIssuePage"));
 export const AccountEntryPage = lazy(() => import("../Application/AccountEntry/AccountEntryPage"));
 export const AccountsBillPage = lazy(() => import("../Application/Accounts/AccountsBillPage"));
 export const PaymentPage = lazy(() => import("../Application/Payment/PaymentPage"));
 export const ServicePOPage = lazy(() => import("../Application/ServicePO/ServicePOPage"));
 export const ServicePOApprovalScreen = lazy(() => import("../Application/ServicePO/ServicePOApprovalScreen"));
 export const ServiceAgreementPage = lazy(() => import("../Application/ServiceAgreement/ServiceAgreementPage"));
 export const ServiceAgreementApprovalScreen = lazy(() => import("../Application/ServiceAgreement/ServiceAgreementApprovalScreen"));
 export const ServiceEntryPage = lazy(() => import("../Application/ServiceEntry/ServiceEntryPage"));
 export const ServiceEntryApprovalScreen = lazy(() => import("../Application/ServiceEntry/ServiceEntryApprovalScreen"));
// Interface for the component map
export interface SectionComponentsMap {
  [key: string]: LazyExoticComponent<ComponentType<any>>;
}

// Strongly typed map
export const sectionComponents: SectionComponentsMap = {
  masters: MasterComponents,
  RoleApproval: RoleApproval,
  KYCEntry,
  SupplierKYCEntry,
  KYCDataView,
  KYCApprovalScreen,
  PurchaseRequisitionPage,
  RoutineRequisitionPage,
  CivilWorksRequisitionPage,
  ElectricalWorksRequisitionPage,
  TransportationRequisitionPage,
  ApprovalWorkflowPage,
  PRApprovalScreen,
  StoreRequisition,
  StoreIssuePage,
  StorePOGeneratePage,
  PurchaseOrder,
  PurchaseTeamPage,
  POApprovalScreen,
  // PurchaseTeamPRView,
  PurchaseRequisitionReview,
  GateEntryPage,
  GRNPage,
  POAmendmentPage,
  InventoryPage,
  StockRequestPage,
  StockIssuePage,
  AccountEntryPage,
  AccountsBillPage,
  PaymentPage,
  ServicePOPage,
  ServicePOApprovalScreen,
  ServiceAgreementPage,
  ServiceAgreementApprovalScreen,
  ServiceEntryPage,
  ServiceEntryApprovalScreen,
};
