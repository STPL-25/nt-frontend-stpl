import type { KycChangeRequest } from "@/Application/SupplierStatus/kycModifications";
import type { KYCApprovalRecord } from "./types/KYCApprovalType";

/**
 * A supplier's change request (grn sql/93) listed on the KYC Approval screen next to the submissions waiting for approval. The list and
 * the dialog only need the supplier's headline details, which are taken from the PREVIOUS record - the supplier as the approver knows
 * it, even when the request renames it; the detail panel then shows the full previous-vs-current comparison from `change_request`.
 */
export function changeRequestToRecord(r: KycChangeRequest): KYCApprovalRecord {
  const b = r.old_data?.basic ?? r.new_data?.basic;
  return {
    kyc_basic_info_sno: r.kyc_basic_info_sno,
    company_name: r.company_name || b?.company_name || "Supplier",
    contact_person: b?.contact_person ?? "",
    email: b?.email ?? "",
    mobile_number: b?.mobile_number ?? "",
    business_type: b?.business_type ?? "",
    business_type_name: b?.business_type_name ?? null,
    is_gst_avail: b?.is_gst_avail ?? "N",
    gst_no: b?.gst_no ?? "",
    is_msme_avail: b?.is_msme_avail ?? "N",
    msme_no: b?.msme_no ?? null,
    pan_no: b?.pan_no ?? r.pan_no ?? "",
    msme_type: b?.msme_type ?? null,
    legal_name: b?.legal_name ?? null,
    trade_name: b?.trade_name ?? null,
    status: "P",
    supp_code: r.supp_code,
    created_date: r.modified_date,
    approver_ecno: r.current_approver_ecno ?? undefined,
    current_approver_id: r.current_approver_ecno ?? undefined,
    kyc_address: "[]",
    kyc_bank_info: "[]",
    kyc_contact_details: "[]",
    kyc_uploaded_doc: "[]",
    change_request: r,
  };
}

/** A list row's identity. A supplier's change request and a new KYC share the same kyc_basic_info_sno space only by accident. */
export const recordKey = (k: Pick<KYCApprovalRecord, "kyc_basic_info_sno" | "change_request">): string =>
  k.change_request ? `change-${k.change_request.kyc_modified_sno}` : `kyc-${k.kyc_basic_info_sno}`;
