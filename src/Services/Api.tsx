const baseUrl = import.meta.env.VITE_API_URL || "";

// Auth / Sign-in / Sign-up
export const apiLogUser  = baseUrl + "/api/secure/log_user";
export const apiSignUp   = baseUrl + "/api/secure/sign_up";
export const apiGetAllUsersSignUp = baseUrl + "/api/secure/get_all_users_sign_up";

// Auth / Sidebar
// DEPRECATED — replaced by the nt_user_permissions_json backed route below.
// export const apiFetchSidebarData = baseUrl + "/api/user_approval/get_user_screens_and_permisssions/";
// export const apiFetchSidebarDataByEcno = (ecno: string) =>
//   `${baseUrl}/api/user_approval/get_user_screens_and_permisssions/${ecno}`;
export const apiFetchSidebarData = baseUrl + "/api/user_approval/get_user_screens_and_permisssions_json/";
export const apiFetchSidebarDataByEcno = (ecno: string) =>
  `${baseUrl}/api/user_approval/get_user_screens_and_permisssions_json/${ecno}`;

// Hierarchy
export const apiGetHierarchyDetails = baseUrl + "/api/user_approval/get_hierachy_com_details";

// User Approval
export const apiGetScreensWithGroups  = baseUrl + "/api/user_approval/get_screens_with_groups";
export const apiGetPermissionDetails  = baseUrl + "/api/user_approval/get_permission_details";

// DEPRECATED — replaced by the JSON-column based endpoints below.
// export const apiSaveUserPermissions   = baseUrl + "/api/user_approval/save_user_permissions";
// export const getUserPermissions = (ecno: string) =>
//   `${baseUrl}/api/user_approval/get_user_permissions/${ecno}`;

// nt_user_permissions_json — hierarchy + screens/permissions stored as JSON columns
export const apiSaveUserPermissionsJson   = baseUrl + "/api/user_approval/save_user_permissions_json";
export const apiUpdateUserPermissionsJson = baseUrl + "/api/user_approval/update_user_permissions_json";
export const apiDeleteUserPermissionsJson = baseUrl + "/api/user_approval/delete_user_permissions_json";
export const getUserPermissionsJson = (userId: string) =>
  `${baseUrl}/api/user_approval/get_user_permissions_json/${userId}`;

// KYC
export const apiGetAllKycDatas = baseUrl + "/api/kyc/get_all_kycs";
export const apiPostKycData = baseUrl + "/api/kyc/create_kyc_records";
export const apiGetKycPendingApprovals = baseUrl + "/api/kyc/get_pending_approvals";
export const apiKycApproveAction = baseUrl + "/api/kyc/approve_kyc";
export const apiGetGSTNDetails = baseUrl + "/api/kyc/Get_GSTN_Details";
export const apiGetKycOrgMappings = (kycId: number | string) => baseUrl + `/api/kyc/get_kyc_org_mappings/${kycId}`;

// Public Supplier KYC — anonymous self-service submission at /supplier_kyc,
// no staff session required (see backend-stpl/src/Kyc/routes/PublicKyc.routes.js)
export const apiPublicKycMasterOptions = baseUrl + "/api/public_kyc/master_options";
export const apiPublicKycCreate        = baseUrl + "/api/public_kyc/create_kyc_records";
export const apiPublicKycGetGSTNDetails = baseUrl + "/api/public_kyc/Get_GSTN_Details";

// Common Masters
export const apiFetchCommonMaster = baseUrl + "/api/common_master/";
export const getAllRequiredMasterForOptions = baseUrl + "/api/common_master/getRequiredMasterForOptions";
export const apiPostCommonMaster   = (master: string) => `${baseUrl}/api/common_master/${master}`;
export const apiUpdateCommonMaster = (master: string) => `${baseUrl}/api/${master}`;
export const apiDeleteCommonMaster = (master: string) => `${baseUrl}/api/${master}`;

// Common Basic Details (hierarchy + employee)
export const apiCommonBasicDetails = baseUrl + "/api/common_basic_details";
export const apiGetEmployee = baseUrl + "/api/common_basic_details/getEmployee";
export const apiGetSignEmployee = baseUrl + "/api/common_basic_details/getSignUpEmployee";

// Non-Staff User Management (admin-side — staff JWT). Login/reset-password/
// my-approvals for the portal itself go through Services/NonStaffService,
// a dedicated axios instance mirroring SupplierService (crypto-exempt at
// the gateway, not the internal app's session-cookie auth).
export const apiNonStaffCreate = baseUrl + "/api/nonstaff/create";
export const apiNonStaffList   = baseUrl + "/api/nonstaff/list";

// Notifications
export const apiGetNotifications = baseUrl + "/api/notifications";
export const apiMarkNotificationRead = (id: string) => `${baseUrl}/api/notifications/${id}/read`;
export const apiMarkAllNotificationsRead = baseUrl + "/api/notifications/read-all";

// Master Items (legacy)
export const apiGetMasterItems = baseUrl + "/api/MasterItems";

// Workflow Approval — approval_workflow_master
export const apiSaveFullWorkflow    = baseUrl + "/api/workflow_approval/saveFullWorkflow";
export const apiGetWorkflows        = baseUrl + "/api/workflow_approval/getWorkflows";
export const apiGetEntityTypes      = baseUrl + "/api/workflow_approval/getEntityTypes";
export const apiUpdateWorkflow      = baseUrl + "/api/workflow_approval/updateWorkflow";
export const apiGetWorkflowByEntity = (entityType: string) =>
  `${baseUrl}/api/workflow_approval/getWorkflowByEntity/${entityType}`;

// Workflow Approval — workflow_types
export const apiSaveWorkflowType    = baseUrl + "/api/workflow_approval/saveWorkflowType";
export const apiGetWorkflowTypes    = (workflowId: number) =>
  `${baseUrl}/api/workflow_approval/getWorkflowTypes/${workflowId}`;
export const apiUpdateWorkflowType  = baseUrl + "/api/workflow_approval/updateWorkflowType";

// Workflow Approval — workflow_stage
export const apiSaveWorkflowStage   = baseUrl + "/api/workflow_approval/saveWorkflowStage";
export const apiGetWorkflowStages   = (workflowTypesId: number) =>
  `${baseUrl}/api/workflow_approval/getWorkflowStages/${workflowTypesId}`;
export const apiUpdateWorkflowStage = baseUrl + "/api/workflow_approval/updateWorkflowStage";

// Workflow Approval — soft deletes (rows go is_active='N', history is kept)
export const apiDeleteWorkflow      = baseUrl + "/api/workflow_approval/deleteWorkflow";
export const apiDeleteWorkflowType  = baseUrl + "/api/workflow_approval/deleteWorkflowType";
export const apiDeleteWorkflowStage = baseUrl + "/api/workflow_approval/deleteWorkflowStage";

// Legacy (keep for backward compat)
export const createWorkFlowApproval = apiSaveFullWorkflow;
export const getWorkflows           = apiGetWorkflows;
export const getWorkflowByEntity    = apiGetWorkflowByEntity;

// Terms & Conditions Master — scoped by Company/Division/Branch/Department,
// consumed by PO creation to prefill the terms_conditions textarea.
export const apiGetTermsConditions    = baseUrl + "/api/terms_conditions/getTermsConditions";
export const apiCreateTermsConditions = baseUrl + "/api/terms_conditions/createTermsConditions";
export const apiUpdateTermsConditions = baseUrl + "/api/terms_conditions/updateTermsConditions";
export const apiDeleteTermsConditions = baseUrl + "/api/terms_conditions/deleteTermsConditions";
export const apiGetDefaultTermsConditions = (
  com_sno: number | string, div_sno: number | string, brn_sno: number | string, dept_sno: number | string
) => `${baseUrl}/api/terms_conditions/getDefaultTermsConditions?com_sno=${com_sno}&div_sno=${div_sno}&brn_sno=${brn_sno}&dept_sno=${dept_sno}`;

// Product Stock Level Master — per-product Min Qty/Max Qty/Reorder Level
// policy, scoped by Company/Division/Branch OR by a Warehouse Location.
// Reference-only integration into the Inventory Stock page (grn-service
// already returns master_min_qty/master_max_qty/master_reorder_level on
// getItems — see grn-service/sql/29_inventory_stock_level_reference.sql).
export const apiGetProductStockLevels    = baseUrl + "/api/product_stock_level/getProductStockLevels";
export const apiCreateProductStockLevel  = baseUrl + "/api/product_stock_level/createProductStockLevel";
export const apiUpdateProductStockLevel  = baseUrl + "/api/product_stock_level/updateProductStockLevel";
export const apiDeleteProductStockLevel  = baseUrl + "/api/product_stock_level/deleteProductStockLevel";

// Purchase Requisition — DB
export const createPrRecord = baseUrl + "/api/pr/createPrRecords";
export const getPrRecords = baseUrl + "/api/pr/getPrRecords";
export const prApproveAction = baseUrl + "/api/pr/approvePr";

// Purchase Order — Approval
export const getPoRecords = baseUrl + "/api/po/getPoRecords";
export const poApproveAction = baseUrl + "/api/po/approvePo";

// PR Tracking — requester-facing real-time status of the full PR journey
export const prTrackingGetMine = baseUrl + "/api/pr_tracking/getMyTracking";
export const prTrackingCanViewOrg = baseUrl + "/api/pr_tracking/canViewOrgTracking";
export const prTrackingGetOrg = baseUrl + "/api/pr_tracking/getOrgTracking";
export const prTrackingGetTimeline = (pr_no: string) =>
  `${baseUrl}/api/pr_tracking/getTimeline/${encodeURIComponent(pr_no)}`;


// Invoice — DB (grn-service)
export const createInvoice = baseUrl + "/api/invoice/createInvoice";
export const linkInvoiceToPO = baseUrl + "/api/invoice/linkInvoiceToPO";
export const verifyInvoiceDelivery = baseUrl + "/api/invoice/verifyInvoiceDelivery";
export const allocateInvoice = baseUrl + "/api/invoice/allocateInvoice";
export const matchInvoice = baseUrl + "/api/invoice/matchInvoice";
export const getInvoicesByPO = (po_basic_sno: number | string) => `${baseUrl}/api/invoice/getInvoicesByPO/${po_basic_sno}`;
export const getAllInvoices = baseUrl + "/api/invoice/getAllInvoices";
export const getPendingInvoiceMatches = baseUrl + "/api/invoice/getPendingMatches";
export const getPoItemsForAllocation = (po_basic_sno: number | string) => `${baseUrl}/api/invoice/getPoItemsForAllocation/${po_basic_sno}`;
export const getVendorDrivenBillableChildPOs = baseUrl + "/api/invoice/getVendorDrivenBillableChildPOs";
export const consolidateVendorDrivenBills = baseUrl + "/api/invoice/consolidateVendorDrivenBills";

// Payment — DB (grn-service)
export const getPayableBills = baseUrl + "/api/payment/getPayableBills";
export const createPayment = baseUrl + "/api/payment/createPayment";
export const getPaymentHistory = baseUrl + "/api/payment/getPaymentHistory";

// Purchase Requisition — Draft (Redis, per-user)
export const prSaveDraft = baseUrl + "/api/pr/saveDraft";
export const prGetDrafts = baseUrl + "/api/pr/getDrafts";
export const prGetDraft = (draftId: string) => `${baseUrl}/api/pr/getDraft/${draftId}`;
export const prUpdateDraft = (draftId: string) => `${baseUrl}/api/pr/updateDraft/${draftId}`;
export const prDeleteDraft = (draftId: string) => `${baseUrl}/api/pr/deleteDraft/${draftId}`;
export const prSubmitDraft = (draftId: string) => `${baseUrl}/api/pr/submitDraft/${draftId}`;

// Store Purchase Order — DB-persisted POs
export const storePOCreate = baseUrl + "/api/store_po/createStorePO";
export const storePOGetAll = baseUrl + "/api/store_po/getStorePOs";

// Store Purchase Order — Drafts (Redis, per-user)
export const storePOSaveDraft = baseUrl + "/api/store_po/savePODraft";
export const storePOGetDrafts = baseUrl + "/api/store_po/getPODrafts";
export const storePOGetDraft = (draftId: string) => `${baseUrl}/api/store_po/getPODraft/${draftId}`;
export const storePOUpdateDraft = (draftId: string) => `${baseUrl}/api/store_po/updatePODraft/${draftId}`;
export const storePODeleteDraft = (draftId: string) => `${baseUrl}/api/store_po/deletePODraft/${draftId}`;
export const storePOSubmitDraft = (draftId: string) => `${baseUrl}/api/store_po/submitPODraft/${draftId}`;

// Purchase Team — PR processing, supplier quotation, PO creation
export const purchaseTeamGetApprovedPRs = baseUrl + "/api/purchase_team/getApprovedPRs";
export const purchaseTeamGetVendors = baseUrl + "/api/purchase_team/getApprovedVendors";
export const purchaseTeamCreateQuotation = baseUrl + "/api/purchase_team/createSupplierQuotation";
export const purchaseTeamGetQuotations = (prBasicSno: number,pr_no: string) =>
  `${baseUrl}/api/purchase_team/getSupplierQuotations/${prBasicSno}/${pr_no}`;
export const purchaseTeamSelectQuotation = baseUrl + "/api/purchase_team/selectQuotation";
export const purchaseTeamCreatePO = baseUrl + "/api/purchase_team/createPOFromQuotation";
export const purchaseTeamSendPOEmail = baseUrl + "/api/purchase_team/sendPOEmail";
export const purchaseTeamUpdateItemQty = baseUrl + "/api/purchase_team/updateItemQuantity";
export const purchaseTeamSaveQuotationDraft = baseUrl + "/api/purchase_team/saveQuotationDraft";
export const purchaseTeamGetQuotationDrafts = baseUrl + "/api/purchase_team/getQuotationDrafts";
export const purchaseTeamDeleteQuotationDraft = (draftId: string) =>
  `${baseUrl}/api/purchase_team/deleteQuotationDraft/${draftId}`;

// Split groups
export const purchaseTeamSaveSplitGroup = baseUrl + "/api/purchase_team/saveSplitGroup";
export const purchaseTeamGetSplitGroups = (prBasicSno: number) =>
  `${baseUrl}/api/purchase_team/getSplitGroups/${prBasicSno}`;
export const purchaseTeamUpdateSplitGroupOrg = baseUrl + "/api/purchase_team/updateSplitGroupOrg";

// PO Confirmation (Step 1 before quotation)
export const purchaseTeamSavePOConfirmation = baseUrl + "/api/purchase_team/savePOConfirmation";
export const purchaseTeamGetPOConfirmation = (prBasicSno: number) =>
  `${baseUrl}/api/purchase_team/getPOConfirmation/${prBasicSno}`;

// GRN — Goods Receipt Note
export const grnGetPendingPOs = baseUrl + "/api/grn/getPendingPOs";
export const grnGetGRNsByPO = (po_basic_sno: number) =>
  `${baseUrl}/api/grn/getGRNsByPO/${po_basic_sno}`;
export const grnCreateGRN = baseUrl + "/api/grn/createGRN";
export const grnGetAllGRNs = baseUrl + "/api/grn/getAllGRNs";
export const grnSaveDraft = baseUrl + "/api/grn/saveGRNDraft";
export const grnGetDrafts = baseUrl + "/api/grn/getGRNDrafts";
export const grnGetDraft = (draftId: string) => `${baseUrl}/api/grn/getGRNDraft/${draftId}`;
export const grnUpdateDraft = (draftId: string) => `${baseUrl}/api/grn/updateGRNDraft/${draftId}`;
export const grnDeleteDraft = (draftId: string) => `${baseUrl}/api/grn/deleteGRNDraft/${draftId}`;
export const grnSubmitDraft = (draftId: string) => `${baseUrl}/api/grn/submitGRNDraft/${draftId}`;

// Purchase Requisition — Dept-scoped shared drafts (Redis, dept-level visibility)
export const prSaveDeptDraft = baseUrl + "/api/pr/saveDeptDraft";
export const prGetDeptDrafts = baseUrl + "/api/pr/getDeptDrafts";
export const prUpdateDeptDraft = (draftId: string) => `${baseUrl}/api/pr/updateDeptDraft/${draftId}`;
export const prDeleteDeptDraft = (draftId: string) => `${baseUrl}/api/pr/deleteDeptDraft/${draftId}`;
export const prSubmitDeptDraft = (draftId: string) => `${baseUrl}/api/pr/submitDeptDraft/${draftId}`;
export const prSubmitAllDeptDrafts = baseUrl + "/api/pr/submitAllDeptDrafts";

// Inventory
export const inventoryGetItems    = baseUrl + "/api/inventory/getItems";
export const inventoryCreateItem  = baseUrl + "/api/inventory/createItem";
export const inventoryUpdateItem  = (item_sno: number) => `${baseUrl}/api/inventory/updateItem/${item_sno}`;
export const inventoryDeleteItem  = (item_sno: number) => `${baseUrl}/api/inventory/deleteItem/${item_sno}`;
export const inventoryGetMovements = (item_sno: number) => `${baseUrl}/api/inventory/getMovements/${item_sno}`;
export const inventoryAdjustStock = baseUrl + "/api/inventory/adjustStock";

// A/C Double Entry — Journal Entries
// export const acGetEntries         = baseUrl + "/api/ac_entry/getEntries";
// export const acCreateEntry        = baseUrl + "/api/ac_entry/createEntry";
// export const acUpdateEntry        = (entry_sno: number) => `${baseUrl}/api/ac_entry/updateEntry/${entry_sno}`;
// export const acPostEntry          = (entry_sno: number) => `${baseUrl}/api/ac_entry/postEntry/${entry_sno}`;
// export const acReverseEntry       = (entry_sno: number) => `${baseUrl}/api/ac_entry/reverseEntry/${entry_sno}`;

// // A/C Double Entry — Chart of Accounts / Ledgers
// export const acGetLedgers         = baseUrl + "/api/ac_entry/getLedgers";
// export const acCreateLedger       = baseUrl + "/api/ac_entry/createLedger";
// export const acUpdateLedger       = (ledger_sno: number) => `${baseUrl}/api/ac_entry/updateLedger/${ledger_sno}`;

// Service Agreement
export const createServiceAgreement          = baseUrl + "/api/service_agreement/createServiceAgreement";
export const updateServiceAgreement          = baseUrl + "/api/service_agreement/updateServiceAgreement";
export const approveServiceAgreement         = baseUrl + "/api/service_agreement/approveServiceAgreement";
export const getServiceAgreements            = baseUrl + "/api/service_agreement/getServiceAgreements";
export const getServiceAgreementsForApproval = baseUrl + "/api/service_agreement/getServiceAgreementsForApproval";
export const getServiceAgreementHistory      = baseUrl + "/api/service_agreement/getServiceAgreementHistory";

// Service GRN (Unfixed agreements only — PO reference + invoice, no stock tracking)
export const createServiceGrn         = baseUrl + "/api/service_grn/createServiceGrn";
export const getPendingServiceGrnPOs  = baseUrl + "/api/service_grn/getPendingServiceGrnPOs";
export const getServiceGrns           = baseUrl + "/api/service_grn/getServiceGrns";

export const submitServicePoEntry        = baseUrl + "/api/service_po/submitServicePoEntry";
export const approveServicePoCycle       = baseUrl + "/api/service_po/approveServicePoCycle";
export const getServicePoCycles          = baseUrl + "/api/service_po/getServicePoCycles";
export const getServicePoCyclesForApproval = baseUrl + "/api/service_po/getServicePoCyclesForApproval";

// Loan payments — rate history, interest calculator, bank payment vouchers
export const getLoanAccounts                = baseUrl + "/api/loan_voucher/getLoanAccounts";
export const getLoanDetail                  = baseUrl + "/api/loan_voucher/getLoanDetail";
export const previewLoanInterest            = baseUrl + "/api/loan_voucher/previewLoanInterest";
export const addLoanRatePeriod              = baseUrl + "/api/loan_voucher/addLoanRatePeriod";
export const deleteLoanRatePeriod           = baseUrl + "/api/loan_voucher/deleteLoanRatePeriod";
export const addLoanPrincipalTxn            = baseUrl + "/api/loan_voucher/addLoanPrincipalTxn";
export const deleteLoanPrincipalTxn         = baseUrl + "/api/loan_voucher/deleteLoanPrincipalTxn";
export const createBankPaymentVoucher       = baseUrl + "/api/loan_voucher/createBankPaymentVoucher";
export const getBankPaymentVouchers         = baseUrl + "/api/loan_voucher/getBankPaymentVouchers";
export const getBankPaymentVoucher          = baseUrl + "/api/loan_voucher/getBankPaymentVoucher";
export const getBankPaymentVouchersForApproval = baseUrl + "/api/loan_voucher/getBankPaymentVouchersForApproval";
export const approveBankPaymentVoucher      = baseUrl + "/api/loan_voucher/approveBankPaymentVoucher";
export const markBankPaymentVoucherPaid     = baseUrl + "/api/loan_voucher/markBankPaymentVoucherPaid";
