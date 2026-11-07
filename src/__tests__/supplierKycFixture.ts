import type { SupplierKyc } from '@/Services/SupplierService';

/** A supplier's KYC as GET /api/supplier/kyc returns it (grn sql/92). */
export const KYC: SupplierKyc = {
  kyc_basic_info_sno: 55, supp_code: 'SUP55', status: 'A', pan_no: 'ABCDE1234F', supplier_category: 'Packaging', category: 'Supplier',
  created_date: '2026-10-01T10:00:00.000Z', modified_date: null, snapshot_hash: 'A'.repeat(64),
  basic: {
    company_name: 'ACME', legal_name: null, trade_name: 'Acme Traders', contact_person: 'Ravi', email: 'r@acme.com', mobile_number: '9000000000',
    business_type: '2', business_type_name: 'Partnership', is_gst_avail: 'Y', gst_no: '33ABCDE1234F1Z5', gst_status: 'Active', gst_blk_status: null,
    txp_type: null, date_of_reg: null, is_msme_avail: 'N', msme_no: null, msme_type: null, pan_no: 'ABCDE1234F',
  },
  payment: { pay_via_portal: 'N', payment_portal_name: null, payment_portal_url: null, payment_instructions: null },
  addresses: [
    { kyc_address_sno: 7, address_type: 'PRIMARY', door_no: '1', street: 'Mill Rd', area: 'RS Puram', city: 'Coimbatore', taluk: null, state: 'Tamil Nadu', state_code: 33, pincode: '641001', location_link: null, is_primary: 'Y' },
    { kyc_address_sno: 8, address_type: 'SECONDARY', door_no: '9', street: 'Dock Rd', area: 'Port', city: 'Chennai', taluk: null, state: 'Tamil Nadu', state_code: 33, pincode: '600001', location_link: null, is_primary: 'N' },
  ],
  banks: [{ kyc_bank_sno: 3, ac_holder_name: 'ACME', ac_number: '123456789012', ac_type: '2', ac_type_name: 'Current', ifsc: 'HDFC0000001', bank_name: 'HDFC', bank_branch_name: 'RS Puram', bank_address: 'Cbe', is_primary: 'Y' }],
  contacts: [{ kyc_contact_sno: 4, contact_type: 'PRIMARY', contact_name: 'Ravi', contact_position: 'Owner', contact_mobile: '9000000000', contact_email: 'r@acme.com' }],
  documents: [{ kyc_document_sno: 10, document_type: 'pan_file', document_name: 'pan.pdf', document_path: 'http://localhost:8001/dwl/NON_TRADE_DATAS/KYC_DATAS/pan.pdf', uploaded_date: '2026-10-01T10:00:00.000Z' }],
};
