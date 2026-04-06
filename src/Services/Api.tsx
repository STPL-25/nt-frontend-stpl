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

// Purchase Requisition — Dept-scoped shared drafts (Redis, dept-level visibility)
export const prSaveDeptDraft = baseUrl + "/api/pr/saveDeptDraft";
export const prGetDeptDrafts = baseUrl + "/api/pr/getDeptDrafts";
export const prUpdateDeptDraft = (draftId: string) => `${baseUrl}/api/pr/updateDeptDraft/${draftId}`;
export const prDeleteDeptDraft = (draftId: string) => `${baseUrl}/api/pr/deleteDeptDraft/${draftId}`;
export const prSubmitDeptDraft = (draftId: string) => `${baseUrl}/api/pr/submitDeptDraft/${draftId}`;
export const prSubmitAllDeptDrafts = baseUrl + "/api/pr/submitAllDeptDrafts";
