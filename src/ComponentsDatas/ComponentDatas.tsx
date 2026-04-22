import { lazy, LazyExoticComponent, ComponentType } from "react";


 export const MasterComponents = lazy(() => import(".././Application/Master-Screen/MasterPageScreen"));

 export const KYCEntry = lazy(() => import("../Application/Kyc-Screen/KycEntry"));
 export const SupplierKYCEntry = lazy(() => import("../Application/Kyc-Screen/SupplierKYCEntry"));
 export const RoleApproval = lazy(() => import("../Application/RoleApproval/UserRoleApprovalScreen"));
 export const KYCDataView = lazy(() => import("../Application/Kyc-Screen/KYCDataView"));
 export const PurchaseRequisitionPage = lazy(() => import("../Application/PR/PurchaseRequisitionPage"));
 export const ApprovalWorkflowPage = lazy(() => import("../Application/RoleApproval/ApprovalWorkflowManager"));
 export const PRApprovalScreen = lazy(() => import("../Application/PR/PRApprovalScreen"));
 export const StoreRequisition = lazy(() => import("../Application/Store/StoreRequisition"));
 export const StoreIssuePage = lazy(() => import("../Application/Store/StoreIssuePage"));
 export const StorePOGeneratePage = lazy(() => import("../Application/Store/StorePOGeneratePage"));
 export const PurchaseOrder = lazy(() => import("../Application/PurchaseOrder/PurchaseOrder"));
 export const PurchaseTeamPage = lazy(() => import("../Application/PurchaseOrder/PurchaseTeamPage"));
 export const PurchaseRequisitionReview = lazy(() => import("../Application/PR/PurchaseRequisitionReview"));
 export const GRNPage = lazy(() => import("../Application/GRN/GRNPage"));
 export const InventoryPage = lazy(() => import("../Application/Inventory/InventoryPage"));
 export const AccountEntryPage = lazy(() => import("../Application/AccountEntry/AccountEntryPage"));
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
  PurchaseRequisitionPage,
  ApprovalWorkflowPage,
  PRApprovalScreen,
  StoreRequisition,
  StoreIssuePage,
  StorePOGeneratePage,
  PurchaseOrder,
  PurchaseTeamPage,
  PurchaseRequisitionReview,
  GRNPage,
  InventoryPage,
  AccountEntryPage,
};
