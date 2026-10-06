// Standalone, unauthenticated /supplier_kyc route — a supplier with no
// staff login can reach this directly and submit their own KYC. Reuses the
// same form as the staff-Dashboard-embedded SupplierKYCEntry, just pointed
// at the public (non-verifyJWT) master-options and submit endpoints.
// See App.tsx for the route registration and backend-stpl/src/Kyc/routes/PublicKyc.routes.js
// for what those public endpoints expose.
import { BadgeCheck, FileCheck2, ShieldCheck } from "lucide-react";
import spaceLogo from "@/assets/space.png";
import SupplierKYCEntry from "@/Application/Kyc-Screen/SupplierKYCEntry";
import { apiPublicKycMasterOptions, apiPublicKycCreate, apiPublicKycGetGSTNDetails } from "@/Services/Api";

const HIGHLIGHTS = [
  { icon: BadgeCheck, label: "GST, PAN & bank verified instantly" },
  { icon: FileCheck2, label: "Documents auto-attached where possible" },
  { icon: ShieldCheck, label: "Reviewed by our team" },
];

export default function SupplierKycPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-700 via-sky-600 to-cyan-500">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-8 sm:pb-28 sm:pt-12 lg:px-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
            <div className="shrink-0 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5">
              <img src={spaceLogo} alt="Space Textiles (P) Ltd" className="h-16 w-16 object-contain sm:h-20 sm:w-20" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Space Textiles (P) Ltd</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Supplier Onboarding
              </h1>
             
            </div>
          </div>
       
        </div>
      </section>

      <SupplierKYCEntry
        masterOptionsUrl={apiPublicKycMasterOptions}
        submitUrl={apiPublicKycCreate}
        gstDetailsUrl={apiPublicKycGetGSTNDetails}
        hideHeader
      />

      <footer className="pb-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Space Textiles (P) Ltd · Your details are used only for supplier verification.
      </footer>
    </div>
  );
}
