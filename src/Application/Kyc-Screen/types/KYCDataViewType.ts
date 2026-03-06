
export interface KYCData {
  kyc_basic_info_sno: number;
  div_sno: number | null;
  ecno: number | null;
  brn_sno: number | null;
  dept_sno: number | null;
  com_sno: number | null;
  company_name: string;
  contact_person: string;
  email: string;
  mobile_number: string;
  business_type: string;
  is_gst_avail: string;
  gst_no: string;
  is_msme_avail: string;
  msme_no: string | null;
  pan_no: string;
  created_by: string | null;
  created_date: string;
  modified_by: string | null;
  modified_date: string | null;
  is_active: string;
  status: string;
  supp_code: string | null;
  old_supp_code: string | null;
  kyc_address: string;
  kyc_bank_info: string;
  kyc_contact_details: string;
  kyc_uploaded_doc: string;
}

export interface APIResponse {
  success: boolean;
  data: KYCData[];
}