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

// Notifications
export const apiGetNotifications = baseUrl + "/api/notifications";
export const apiMarkNotificationRead = (id: string) => `${baseUrl}/api/notifications/${id}/read`;
export const apiMarkAllNotificationsRead = baseUrl + "/api/notifications/read-all";

// Master Items (legacy)
export const apiGetMasterItems = baseUrl + "/api/MasterItems";

// Workflow Approval
export const createWorkFlowApproval = baseUrl + "/api/workflow_approval/createWorkFlowApproval";
export const getWorkflows = baseUrl + "/api/workflow_approval/getWorkflows";
export const getWorkflowByEntity = (entityType: string) =>
  `${baseUrl}/api/workflow_approval/getWorkflowByEntity/${entityType}`;

// Purchase Requisition — DB
export const createPrRecord = baseUrl + "/api/pr/createPrRecords";
export const getPrRecords = baseUrl + "/api/pr/getPrRecords";

// Purchase Requisition — Draft (Redis, per-user)
export const prSaveDraft = baseUrl + "/api/pr/saveDraft";
export const prGetDrafts = baseUrl + "/api/pr/getDrafts";
export const prGetDraft = (draftId: string) => `${baseUrl}/api/pr/getDraft/${draftId}`;
export const prUpdateDraft = (draftId: string) => `${baseUrl}/api/pr/updateDraft/${draftId}`;
export const prDeleteDraft = (draftId: string) => `${baseUrl}/api/pr/deleteDraft/${draftId}`;
export const prSubmitDraft = (draftId: string) => `${baseUrl}/api/pr/submitDraft/${draftId}`;

// Purchase Requisition — Dept-scoped shared drafts (Redis, dept-level visibility)
export const prSaveDeptDraft = baseUrl + "/api/pr/saveDeptDraft";
export const prGetDeptDrafts = baseUrl + "/api/pr/getDeptDrafts";
export const prUpdateDeptDraft = (draftId: string) => `${baseUrl}/api/pr/updateDeptDraft/${draftId}`;
export const prDeleteDeptDraft = (draftId: string) => `${baseUrl}/api/pr/deleteDeptDraft/${draftId}`;
export const prSubmitDeptDraft = (draftId: string) => `${baseUrl}/api/pr/submitDeptDraft/${draftId}`;
export const prSubmitAllDeptDrafts = baseUrl + "/api/pr/submitAllDeptDrafts";
