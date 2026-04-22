const baseUrl = import.meta.env.VITE_API_URL || "";

// Auth / Sidebar
export const apiFetchSidebarData = baseUrl + "/api/user_approval/get_user_screens_and_permisssions/";
export const apiFetchSidebarDataByEcno = (ecno: string) =>
  `${baseUrl}/api/user_approval/get_user_screens_and_permisssions/${ecno}`;

// Hierarchy
export const apiGetHierarchyDetails = baseUrl + "/api/user_approval/get_hierachy_com_details";

// User Approval
export const getUserPermissions = (userId: string) =>
  `${baseUrl}/api/user_approval/get_user_permissions/${userId}`;

// KYC
export const apiGetAllKycDatas = baseUrl + "/api/kyc/get_all_kycs";
export const apiPostKycData = baseUrl + "/api/kyc/create_kyc_records";

// Common Masters
export const apiFetchCommonMaster = baseUrl + "/api/common_master/";
export const getAllRequiredMasterForOptions = baseUrl + "/api/common_master/getRequiredMasterForOptions";

// Common Basic Details (hierarchy + employee)
export const apiCommonBasicDetails = baseUrl + "/api/common_basic_details";
export const apiGetEmployee = baseUrl + "/api/common_basic_details/getEmployee";
export const apiGetSignEmployee = baseUrl + "/api/common_basic_details/getSignUpEmployee";

// Notifications
export const apiGetNotifications = baseUrl + "/api/notifications";
export const apiMarkNotificationRead = (id: string) => `${baseUrl}/api/notifications/${id}/read`;
export const apiMarkAllNotificationsRead = baseUrl + "/api/notifications/read-all";

// Master Items (legacy)
export const apiGetMasterItems = baseUrl + "/api/MasterItems";

// Workflow Approval — approval_workflow_master
export const apiSaveFullWorkflow    = baseUrl + "/api/workflow_approval/saveFullWorkflow";
export const apiGetWorkflows        = baseUrl + "/api/workflow_approval/getWorkflows";
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

// Legacy (keep for backward compat)
export const createWorkFlowApproval = apiSaveFullWorkflow;
export const getWorkflows           = apiGetWorkflows;
export const getWorkflowByEntity    = apiGetWorkflowByEntity;

// Purchase Requisition — DB
export const createPrRecord = baseUrl + "/api/pr/createPrRecords";
export const getPrRecords = baseUrl + "/api/pr/getPrRecords";
export const prApproveAction = baseUrl + "/api/pr/approvePr";

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
export const purchaseTeamGetQuotations = (prBasicSno: number) =>
  `${baseUrl}/api/purchase_team/getSupplierQuotations/${prBasicSno}`;
export const purchaseTeamSelectQuotation = baseUrl + "/api/purchase_team/selectQuotation";
export const purchaseTeamCreatePO = baseUrl + "/api/purchase_team/createPOFromQuotation";
export const purchaseTeamUpdateItemQty = baseUrl + "/api/purchase_team/updateItemQuantity";
export const purchaseTeamSaveQuotationDraft = baseUrl + "/api/purchase_team/saveQuotationDraft";
export const purchaseTeamGetQuotationDrafts = baseUrl + "/api/purchase_team/getQuotationDrafts";
export const purchaseTeamDeleteQuotationDraft = (draftId: string) =>
  `${baseUrl}/api/purchase_team/deleteQuotationDraft/${draftId}`;

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
export const acGetEntries         = baseUrl + "/api/ac_entry/getEntries";
export const acCreateEntry        = baseUrl + "/api/ac_entry/createEntry";
export const acUpdateEntry        = (entry_sno: number) => `${baseUrl}/api/ac_entry/updateEntry/${entry_sno}`;
export const acPostEntry          = (entry_sno: number) => `${baseUrl}/api/ac_entry/postEntry/${entry_sno}`;
export const acReverseEntry       = (entry_sno: number) => `${baseUrl}/api/ac_entry/reverseEntry/${entry_sno}`;

// A/C Double Entry — Chart of Accounts / Ledgers
export const acGetLedgers         = baseUrl + "/api/ac_entry/getLedgers";
export const acCreateLedger       = baseUrl + "/api/ac_entry/createLedger";
export const acUpdateLedger       = (ledger_sno: number) => `${baseUrl}/api/ac_entry/updateLedger/${ledger_sno}`;
