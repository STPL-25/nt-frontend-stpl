// ---------------------------------------------------------------------------
// Purchase Requisition domain types
// ---------------------------------------------------------------------------

export interface PRBasicInfo {
  com_sno?: number | string;
  div_sno?: number | string;
  brn_sno?: number | string;
  dept_sno?: number | string;
  pr_date?: string;
  required_date?: string;
  priority?: string;
  remarks?: string;
  [key: string]: unknown;
}

export interface PRItem {
  id?: string;
  prod_sno?: number | string;
  prod_name?: string;
  qty?: number | string;
  uom_sno?: number | string;
  est_cost?: number | string;
  total?: number;
  item_remarks?: string;
  [key: string]: unknown;
}

export interface PRDraft {
  draftId: string;
  ecno: string;
  basicInfo?: PRBasicInfo;
  items?: PRItem[];
  savedAt: string;
  updatedAt: string;
  scopeKey?: string;
  enteredBy?: { ecno: string; name: string };
  updatedBy?: { ecno: string; name: string };
}

export interface DraftSaveResult {
  draftId: string;
  savedAt: string;
  scopeKey?: string;
}
