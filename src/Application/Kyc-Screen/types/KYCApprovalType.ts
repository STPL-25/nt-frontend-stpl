// Row shape returned by sp_get_kyc_approval (vw_get_all_kyc_info + resolved master names).
// The four JSON blocks arrive as strings (FOR JSON PATH) and are parsed in the layout.
export interface KYCApprovalRecord {
  kyc_basic_info_sno: number;
  company_name: string;
  contact_person: string;
  email: string;
  mobile_number: string;
  /** The business_types master id, stored as text (legacy rows may hold free text instead). */
  business_type: string;
  /** business_types_name for `business_type` — falls back to the stored text when it is not a master id. */
  business_type_name?: string | null;
  is_gst_avail: string;
  gst_no: string;
  is_msme_avail: string;
  msme_no: string | null;
  pan_no: string;
  legal_name?: string | null;
  trade_name?: string | null;
  status: string;
  supp_code: string | null;
  created_date: string;
  approver_ecno?: string;
  current_approver_id?: string;
  workflow_types_id?: number;
  stage_order_json?: string | any[];
  kyc_history_data?: string | any[];
  kyc_address: string;
  /** JSON array; each bank carries `ac_type` (master id) and `ac_type_name` (resolved). */
  kyc_bank_info: string;
  kyc_contact_details: string;
  kyc_uploaded_doc: string;
}
