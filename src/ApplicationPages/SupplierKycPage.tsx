// Standalone, unauthenticated /supplier_kyc route — a supplier with no
// staff login can reach this directly and submit their own KYC. Reuses the
// same form as the staff-Dashboard-embedded SupplierKYCEntry, just pointed
// at the public (non-verifyJWT) master-options and submit endpoints.
// See App.tsx for the route registration and backend-stpl/src/Kyc/routes/PublicKyc.routes.js
// for what those public endpoints expose.
import SupplierKYCEntry from "@/Application/Kyc-Screen/SupplierKYCEntry";
import { apiPublicKycMasterOptions, apiPublicKycCreate, apiPublicKycGetGSTNDetails } from "@/Services/Api";

export default function SupplierKycPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <SupplierKYCEntry
        masterOptionsUrl={apiPublicKycMasterOptions}
        submitUrl={apiPublicKycCreate}
        gstDetailsUrl={apiPublicKycGetGSTNDetails}
      />
    </div>
  );
}
