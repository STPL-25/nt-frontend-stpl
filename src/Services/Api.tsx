const baseUrl = import.meta.env.VITE_API_URL || "";

// Auth / Sidebar
export const apiFetchSidebarData = baseUrl + "/api/user_approval/get_user_screens_and_permisssions/";

// KYC
export const apiGetAllKycDatas = baseUrl + "/api/kyc/get_all_kycs";
export const apiPostKycData = baseUrl + "/api/kyc/create_kyc_records";

// Common Masters
export const apiFetchCommonMaster = baseUrl + "/api/common_master/";
export const getAllRequiredMasterForOptions = baseUrl + "/api/common_master/getRequiredMasterForOptions";

// Workflow Approval
export const createWorkFlowApproval = baseUrl + "/api/workflow_approval/createWorkFlowApproval";
export const getWorkflows = baseUrl + "/api/workflow_approval/getWorkflows";
export const getWorkflowByEntity = (entityType: string) =>
  `${baseUrl}/api/workflow_approval/getWorkflowByEntity/${entityType}`;

// Purchase Requisition — DB
export const createPrRecord = baseUrl + "/api/pr/createPrRecords";
export const getPrRecords = baseUrl + "/api/pr/getPrRecords";

// Purchase Requisition — Draft (Redis)
export const prSaveDraft = baseUrl + "/api/pr/saveDraft";
export const prGetDrafts = baseUrl + "/api/pr/getDrafts";
export const prGetDraft = (draftId: string) => `${baseUrl}/api/pr/getDraft/${draftId}`;
export const prUpdateDraft = (draftId: string) => `${baseUrl}/api/pr/updateDraft/${draftId}`;
export const prDeleteDraft = (draftId: string) => `${baseUrl}/api/pr/deleteDraft/${draftId}`;
export const prSubmitDraft = (draftId: string) => `${baseUrl}/api/pr/submitDraft/${draftId}`;

// User Approval
export const getUserPermissions = (userId: string) =>
  `${baseUrl}/api/user_approval/get_user_permissions/${userId}`;
