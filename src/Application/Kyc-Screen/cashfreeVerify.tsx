/**
 * Cashfree PAN / Udyam(MSME) / bank-account verification helpers shared by
 * KycEntry (staff) and SupplierKYCEntry (staff + public /supplier_kyc). GST
 * lookup itself still goes through the existing Get_GSTN_Details endpoint —
 * the backend now answers it from Cashfree. Every response is stored by the
 * backend and linked to the KYC when it is created.
 */
import axios from "axios";
import { useCallback, useState, type ReactNode } from "react";
import { BadgeCheck, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
export const ACCOUNT_PATTERN = /^[0-9]{6,20}$/;

type Json = Record<string, any>;

// Staff and public forms hit sibling routes (/api/kyc vs /api/public_kyc);
// derive them from whichever GST url the form was given.
export const cashfreeUrls = (gstUrl: string) => ({
  pan: gstUrl.replace("Get_GSTN_Details", "verify_pan"),
  msme: gstUrl.replace("Get_GSTN_Details", "verify_msme"),
  bank: gstUrl.replace("Get_GSTN_Details", "verify_bank_account"),
  ifsc: gstUrl.replace("Get_GSTN_Details", "verify_ifsc"),
  duplicate: gstUrl.replace("Get_GSTN_Details", "check_duplicate"),
});

const post = async (url: string, body: Json): Promise<Json> => {
  const res = await axios.post(url, body);
  return (res.data?.data ?? {}) as Json;
};

export const verifyPan = (urls: ReturnType<typeof cashfreeUrls>, pan: string) =>
  post(urls.pan, { pan });

export const verifyMsme = (urls: ReturnType<typeof cashfreeUrls>, msme_no: string) =>
  post(urls.msme, { msme_no });

// Is a live (approved / pending) KYC already registered with this GST (or, for a
// supplier with no GST, this PAN)? Called before any paid lookup.
export const checkDuplicate = (
  urls: ReturnType<typeof cashfreeUrls>,
  body: { gst_no?: string; pan_no?: string; is_gst_avail: "true" | "false" }
) => post(urls.duplicate, body);

// IFSC -> bank / branch / address (Cashfree; replaces the old Razorpay lookup).
export const verifyIfsc = (urls: ReturnType<typeof cashfreeUrls>, ifsc: string) =>
  post(urls.ifsc, { ifsc });

export const verifyBank = (
  urls: ReturnType<typeof cashfreeUrls>,
  ac_number: string,
  ifsc: string,
  name?: string
) => post(urls.bank, { ac_number, ifsc, name });

/** Bank fields filled from a successful account verification. */
export const buildBankVerifyPatch = (res: Json) => {
  const ifsc = (res?.ifsc_details ?? {}) as Json;
  const patch: Record<string, string> = {
    ac_holder_name: String(res?.name_at_bank ?? "").trim(),
    bank_name: String(ifsc.bank ?? res?.bank_name ?? "").trim(),
    bank_branch_name: String(ifsc.branch ?? res?.branch ?? "").trim(),
    bank_address: String(ifsc.address ?? "").trim(),
  };
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v));
};

export type MsmeDetails = Json;

/** Summary of a verified Udyam registration, with the stored certificate if we have one. */
export function MsmeVerifiedCard({ details }: { details: MsmeDetails | null }) {
  if (!details) return null;
  const rows: [string, unknown][] = [
    ["Enterprise", details.enterprise_name],
    ["Type", details.enterprise_type],
    ["Organisation", details.organization_type],
    ["Major activity", details.major_activity],
    ["Udyam registered", details.date_of_udyam_registration],
  ];
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
        <BadgeCheck className="h-4 w-4" /> MSME verified ({details.udyam_number})
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="text-muted-foreground">{label}:</dt>
            <dd className="font-medium">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {details.msme_certificate_url && (
        <a
          href={details.msme_certificate_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View MSME certificate
        </a>
      )}
    </div>
  );
}

/**
 * Counts in-flight verification calls. While any is running the form is
 * locked (see VerifyLock) so values can't be changed under a lookup.
 */
export function useVerifyBusy() {
  const [pending, setPending] = useState(0);
  const track = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    setPending((n) => n + 1);
    try {
      return await run();
    } finally {
      setPending((n) => Math.max(0, n - 1));
    }
  }, []);
  return { busy: pending > 0, track };
}

/** Disables every field inside (native fieldset) while a lookup is running. */
export function VerifyLock({ busy, children, className }: { busy: boolean; children: ReactNode; className?: string }) {
  return (
    <fieldset
      disabled={busy}
      aria-busy={busy}
      className={`m-0 min-w-0 border-0 p-0 transition-opacity ${busy ? "pointer-events-none opacity-60" : ""} ${className ?? ""}`}
    >
      {busy && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying details… fields are locked until it completes.
        </div>
      )}
      {children}
    </fieldset>
  );
}

/** Green confirmation line shown under a field whose value the registry reports as active. */
export function ActiveNote({ label }: { label: string }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {label} is active
    </p>
  );
}

const ACTIVE_LABELS: Record<string, string> = { gst_no: "GST", pan_no: "PAN", msme_no: "MSME", ac_number: "Account" };

/** ActiveNote for a basic-info / bank field when its flag is set. */
export function FieldActiveNote({
  field,
  active,
  errors = {},
}: {
  field: string;
  active: Record<string, boolean>;
  errors?: Record<string, string>;
}) {
  if (errors[field]) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
        <XCircle className="h-3.5 w-3.5 shrink-0" /> {errors[field]}
      </p>
    );
  }
  return active[field] && ACTIVE_LABELS[field] ? <ActiveNote label={ACTIVE_LABELS[field]} /> : null;
}
