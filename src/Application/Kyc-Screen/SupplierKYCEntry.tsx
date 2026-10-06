import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, MapPin, FileText, CreditCard, Users, Upload, CheckCircle2, Loader2, Info,
} from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  useBasicInfoFields, useAddressFields, useBankFields,
  useContactFields, useDocumentFields,
} from "@/FieldDatas/KycFieldDatas";
import usePost from "@/hooks/usePostHook";
import { toast } from "sonner";
import { apiPostKycData, apiGetGSTNDetails } from "@/Services/Api";
import { encryptFormMeta } from "@/Services/apiCrypto";
import DynamicDialog from "@/CustomComponent/InputComponents/CustomModelComponent";
import { useKycSections } from "@/hooks/useKycSections";
import { SectionActionCard, FormSection, PageHeader } from "@/CustomComponent/PageComponents";
import {
  AddressModalContent, BankModalContent,
  ContactModalContent, DocumentModalContent, EMPTY_PORTAL, type PortalPayment,
} from "./KycModalSections";
import { IFSC_PATTERN, buildIfscBankPatch, getErrorMessage } from "./ifscUtils";
import {
  PAN_PATTERN, UDYAM_PATTERN, ACCOUNT_PATTERN, cashfreeUrls, verifyPan, verifyMsme, verifyBank,
  buildBankVerifyPatch, MsmeVerifiedCard, type MsmeDetails,
  verifyIfsc, checkDuplicate, useVerifyBusy, VerifyLock, FieldActiveNote,
} from "./cashfreeVerify";
import { PINCODE_PATTERN, buildPincodeAddressPatch } from "./pincodeUtils";
import {
  GSTIN_PATTERN, unwrapGstRecord, buildGstSubmissionFields, getGstLegalName,
  buildGstAddressPatch, buildGstAdditionalAddressPatches, completeGstAddressState,
  matchBusinessTypeValue, isGstActive, clearGstSubmissionFields, derivePanFromGstin,
  fetchGstStateMaster,
  type GstSubmissionFields,
} from "./gstUtils";

const toText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const SECTION_META: Record<string, { title: string; description: string; icon: any }> = {
  address:   { title: "Address Details",   description: "Business locations and registered addresses",          icon: MapPin },
  account:   { title: "Bank Account",      description: "Bank account and cancelled cheque, or pay via your website",             icon: CreditCard },
  contacts:  { title: "Contact Persons",   description: "Owner / authorized representatives with ID proof",    icon: Users },
  documents: { title: "Documents",         description: "Upload GST certificate, PAN card and MSME certificate", icon: Upload },
};

interface SupplierKYCEntryProps {
  // All default to the staff-protected endpoints (used when this screen is
  // rendered inside the authenticated Dashboard). The standalone /supplier_kyc
  // route passes the public equivalents instead — see ApplicationPages/SupplierKycPage.tsx.
  masterOptionsUrl?: string;
  submitUrl?: string;
  gstDetailsUrl?: string;
  /** Public page renders its own hero, so the dashboard PageHeader is dropped. */
  hideHeader?: boolean;
}

export default function SupplierKYCEntry({
  masterOptionsUrl, submitUrl = apiPostKycData, gstDetailsUrl = apiGetGSTNDetails, hideHeader = false,
}: SupplierKYCEntryProps = {}) {
  const addressFields  = useAddressFields();
  const documentFields = useDocumentFields();
  const bankFields     = useBankFields(masterOptionsUrl);
  const contactFields  = useContactFields();
  const { postData, loading: submitting, error: submitError } = usePost();
  const { postData: fetchGstDetails, loading: fetchingGst } = usePost<{
    success: boolean;
    data?: unknown;
  }>();

  const [basicInfo, setBasicInfo]           = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [currentSection, setCurrentSection] = useState("");
  const [gstSubmissionFields, setGstSubmissionFields] = useState<GstSubmissionFields | null>(null);

  const basicInfoFields = useBasicInfoFields(basicInfo, masterOptionsUrl);
  const kyc = useKycSections(addressFields, bankFields, contactFields, documentFields);
  const lastFetchedIfscRef = useRef<Record<string, string>>({});
  const latestIfscRef = useRef<Record<string, string>>({});
  const [fetchingIfscId, setFetchingIfscId] = useState<string | null>(null);
  const lastFetchedPincodeRef = useRef<Record<string, string>>({});
  const latestPincodeRef = useRef<Record<string, string>>({});
  const [fetchingPincodeId, setFetchingPincodeId] = useState<string | null>(null);
  const lastFetchedGstRef = useRef("");
  // Corporates paid through their own website have no bank account to give (sql/109).
  const [payViaPortal, setPayViaPortal] = useState(false);
  const [portal, setPortal] = useState<PortalPayment>(EMPTY_PORTAL);
  const portalComplete = Boolean(portal.payment_portal_name.trim() && portal.payment_portal_url.trim());
  const isSectionComplete = (key: string) =>
    key === "account" && payViaPortal ? portalComplete : kyc.getCompletionStatus(key);
  // Cashfree PAN / MSME / bank-account verification (see cashfreeVerify.tsx)
  const { busy, track } = useVerifyBusy();
  const [panActive, setPanActive] = useState(false);
  // "User already exists" results from the pre-lookup duplicate check, by field.
  const [dupErrors, setDupErrors] = useState<Record<string, string>>({});
  const [activeBanks, setActiveBanks] = useState<Record<string, boolean>>({});
  const cfUrls = cashfreeUrls(gstDetailsUrl);
  const [msmeDetails, setMsmeDetails] = useState<MsmeDetails | null>(null);
  const lastVerifiedPanRef = useRef("");
  const lastVerifiedMsmeRef = useRef("");
  const panRegisteredNameRef = useRef("");
  const lastVerifiedBankRef = useRef<Record<string, string>>({});
  const bankVerifyTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // true when a live KYC already uses this GST / PAN (no GST) — shows the error and stops the lookup.
  const isDuplicate = async (field: "gst_no" | "pan_no", value: string, gstAvail: "true" | "false") => {
    try {
      const res = await track(() => checkDuplicate(cfUrls, { [field]: value, is_gst_avail: gstAvail }));
      if (res.exists) {
        setDupErrors((prev) => ({ ...prev, [field]: String(res.message) }));
        toast.error(String(res.message));
        return true;
      }
    } catch {
      // Check unavailable — the server re-checks on submit, so don't block the user here.
    }
    setDupErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
    return false;
  };

  // A verified PAN's registered name becomes the Company Name.
  const maybeVerifyPan = async (panValue: unknown) => {
    const pan = toText(panValue).toUpperCase();
    if (!PAN_PATTERN.test(pan) || lastVerifiedPanRef.current === pan) return;
    lastVerifiedPanRef.current = pan;
    try {
      const res = await track(() => verifyPan(cfUrls, pan));
      if (!res.valid || !res.registered_name) {
        setPanActive(false);
        toast.error(res.message || "PAN could not be verified");
        return;
      }
      const registeredName = String(res.registered_name);
      panRegisteredNameRef.current = registeredName;
      if (toText(res.pan).toUpperCase() === pan || res.valid) setPanActive(true);
      setBasicInfo((prev) =>
        toText(prev.pan_no).toUpperCase() === pan ? { ...prev, company_name: registeredName } : prev
      );
      toast.success("PAN verified — company name set to the registered name");
    } catch (error: unknown) {
      lastVerifiedPanRef.current = "";
      toast.error(getErrorMessage(error, "Unable to verify PAN"));
    }
  };

  const maybeVerifyMsme = async (value: unknown) => {
    const udyam = toText(value).toUpperCase();
    if (!UDYAM_PATTERN.test(udyam) || lastVerifiedMsmeRef.current === udyam) return;
    lastVerifiedMsmeRef.current = udyam;
    try {
      const res = await track(() => verifyMsme(cfUrls, udyam));
      if (res.status && res.status !== "SUCCESS") {
        toast.error("Udyam registration could not be verified");
        return;
      }
      setMsmeDetails(res);
      // Certificate already saved by the lookup: attach it as the MSME document (upload only needed if the lookup fails).
      if (res.msme_certificate_url && !(kyc.documentInfo.msme_file instanceof File)) {
        kyc.changeDocument("msme_file", res.msme_certificate_url);
      }
      toast.success(res.msme_certificate_url ? "MSME verified — certificate saved" : "MSME verified");
    } catch (error: unknown) {
      lastVerifiedMsmeRef.current = "";
      toast.error(getErrorMessage(error, "Unable to verify MSME number"));
    }
  };

  // Account numbers have no fixed length, so wait for the user to stop typing
  // before making the (billed) verification call.
  const scheduleBankVerify = (bankId: string, account: unknown, ifscValue: unknown) => {
    clearTimeout(bankVerifyTimersRef.current[bankId]);
    setActiveBanks((prev) => (prev[bankId] ? { ...prev, [bankId]: false } : prev));
    const ac = toText(account);
    const ifsc = toText(ifscValue).toUpperCase();
    if (!ACCOUNT_PATTERN.test(ac) || !IFSC_PATTERN.test(ifsc)) return;
    bankVerifyTimersRef.current[bankId] = setTimeout(async () => {
      const key = `${ac}|${ifsc}`;
      if (lastVerifiedBankRef.current[bankId] === key) return;
      lastVerifiedBankRef.current[bankId] = key;
      try {
        const res = await track(() => verifyBank(cfUrls, ac, ifsc));
        if (res.account_status !== "VALID") {
          setActiveBanks((prev) => ({ ...prev, [bankId]: false }));
          const why = res.account_status_code ? ` (${String(res.account_status_code).replace(/_/g, " ").toLowerCase()})` : "";
          toast.error(`Bank account could not be verified${why}`);
          return;
        }
        kyc.patchBank(bankId, buildBankVerifyPatch(res));
        setActiveBanks((prev) => ({ ...prev, [bankId]: true }));
        toast.success("Bank account verified — holder name and bank details filled");
      } catch (error: unknown) {
        lastVerifiedBankRef.current[bankId] = "";
        toast.error(getErrorMessage(error, "Unable to verify bank account"));
      }
    }, 1000);
  };

  const maybeFetchGstDetails = async (gstValue: unknown, isGstAvailable: unknown) => {
    const gst = toText(gstValue).toUpperCase();

    if (
      isGstAvailable !== "true" ||
      !GSTIN_PATTERN.test(gst) ||
      lastFetchedGstRef.current === gst
    ) {
      return;
    }

    lastFetchedGstRef.current = gst;

    // Registered already? Stop before spending any lookup.
    if (await isDuplicate("gst_no", gst, "true")) return;

    // PAN is embedded in the GSTIN itself (characters 3-12), so it can be
    // filled in immediately, independent of whether the GST lookup below
    // succeeds — no need to wait on (or fail alongside) that network call.
    const panFromGstin = derivePanFromGstin(gst);
    if (panFromGstin) {
      setBasicInfo((prev) => ({ ...prev, pan_no: panFromGstin }));
      void maybeVerifyPan(panFromGstin);
    }

    try {
      const response = await track(() => fetchGstDetails(gstDetailsUrl, { gst }));
      const gstRecord = unwrapGstRecord(response?.data);

      if (!gstRecord) {
        throw new Error("GST details response was empty");
      }

      const submissionFields = buildGstSubmissionFields(response?.data);
      const legalName = getGstLegalName(response?.data);
      const companyName = panRegisteredNameRef.current || submissionFields.trade_name || legalName;
      const stateMaster = await fetchGstStateMaster(
        gstDetailsUrl.includes("/api/public_kyc") ? gstDetailsUrl.replace("Get_GSTN_Details", "gst_state_codes") : undefined
      );
      const addressPatch = completeGstAddressState(
        { ...buildGstAddressPatch(response?.data), state_code: gst.slice(0, 2) },
        stateMaster
      );
      const additionalPatches = buildGstAdditionalAddressPatches(response?.data).map((patch) =>
        completeGstAddressState(patch, stateMaster)
      );
      const businessType = matchBusinessTypeValue(
        submissionFields.constitution_of_business,
        basicInfoFields.find((field) => field.field === "business_type")?.options
      );
      setGstSubmissionFields(submissionFields);

      setBasicInfo((prev) => ({
        ...prev,
        ...submissionFields,
        ...(companyName ? { company_name: companyName } : {}),
        ...(businessType ? { business_type: businessType } : {}),
      }));

      if (Object.keys(addressPatch).length === 0) {
        toast.error(
          companyName
            ? "GST company name loaded, but address information was unavailable"
            : "GST details found, but address information was unavailable"
        );
        return;
      }

      kyc.applyGstAddresses(addressPatch, additionalPatches);
      toast.success(
        companyName
          ? "GST company name and address details loaded"
          : "GST address details loaded into the primary address"
      );
    } catch (error: unknown) {
      lastFetchedGstRef.current = "";
      setDupErrors((prev) => ({ ...prev, gst_no: "" }));
      toast.error(getErrorMessage(error, "Unable to fetch GST details"));
    }
  };

  const handleBasicChange = (field: string, value: any) => {
    const nextValue = ["gst_no", "msme_no", "pan_no"].includes(field) ? toText(value).toUpperCase() : value;
    const nextGstNo = field === "gst_no" ? nextValue : basicInfo.gst_no;
    const nextIsGstAvailable =
      field === "is_gst_avail" ? nextValue : basicInfo.is_gst_avail;

    setBasicInfo((prev) => {
      const shouldClearDerivedGst =
        (field === "gst_no" && nextValue !== prev.gst_no) ||
        (field === "is_gst_avail" && nextValue !== "true");
      const next = shouldClearDerivedGst ? clearGstSubmissionFields(prev) : { ...prev };
      return { ...next, [field]: nextValue };
    });

    if (
      (field === "gst_no" && nextValue !== basicInfo.gst_no) ||
      (field === "is_gst_avail" && nextValue !== "true")
    ) {
      lastFetchedGstRef.current = "";
      setGstSubmissionFields(null);
    }

    // No GST: PAN is the unique key, so check it before the PAN lookup.
    const verifyPanIfUnique = async (pan: string) => {
      if (nextIsGstAvailable === "false" && PAN_PATTERN.test(pan) && (await isDuplicate("pan_no", pan, "false"))) return;
      void maybeVerifyPan(pan);
    };
    if (field === "pan_no" && nextValue !== basicInfo.pan_no) {
      panRegisteredNameRef.current = "";
      lastVerifiedPanRef.current = "";
      setPanActive(false);
      setDupErrors((prev) => ({ ...prev, pan_no: "" }));
      void verifyPanIfUnique(nextValue);
    }
    if (field === "is_gst_avail" && nextValue === "false" && basicInfo.pan_no) {
      void verifyPanIfUnique(toText(basicInfo.pan_no).toUpperCase());
    }
    if (field === "is_gst_avail" && nextValue === "true") setDupErrors((prev) => ({ ...prev, pan_no: "" }));

    if (
      (field === "msme_no" && nextValue !== basicInfo.msme_no) ||
      (field === "is_msme_avail" && nextValue !== "true")
    ) {
      lastVerifiedMsmeRef.current = "";
      setMsmeDetails(null);
      if (typeof kyc.documentInfo.msme_file === "string") kyc.changeDocument("msme_file", null);
    }
    if (field === "msme_no" || field === "is_msme_avail") {
      const isMsmeAvail = field === "is_msme_avail" ? nextValue : basicInfo.is_msme_avail;
      if (isMsmeAvail === "true") void maybeVerifyMsme(field === "msme_no" ? nextValue : basicInfo.msme_no);
    }

    if (field === "gst_no" || field === "is_gst_avail") {
      void maybeFetchGstDetails(nextGstNo, nextIsGstAvailable);
    }
  };

  const maybeFetchIfscDetails = async (bankId: string, ifscValue: unknown) => {
    const ifsc = toText(ifscValue).toUpperCase();

    if (
      !IFSC_PATTERN.test(ifsc) ||
      lastFetchedIfscRef.current[bankId] === ifsc
    ) {
      return;
    }

    lastFetchedIfscRef.current[bankId] = ifsc;
    setFetchingIfscId(bankId);

    try {
      const ifscDetails = await track(() => verifyIfsc(cfUrls, ifsc));

      if (ifscDetails.valid === false) {
        throw new Error("IFSC code not found");
      }

      const bankPatch = buildIfscBankPatch(ifscDetails);

      if (latestIfscRef.current[bankId] !== ifsc) {
        return;
      }

      if (Object.keys(bankPatch).length === 0) {
        toast.error("IFSC details found, but bank information was unavailable");
        return;
      }

      kyc.patchBank(bankId, bankPatch);
      toast.success("Bank details loaded from IFSC");
    } catch (error: unknown) {
      if (latestIfscRef.current[bankId] === ifsc) {
        lastFetchedIfscRef.current[bankId] = "";
        toast.error(getErrorMessage(error, "Unable to fetch IFSC details"));
      }
    } finally {
      if (latestIfscRef.current[bankId] === ifsc) {
        setFetchingIfscId((current) => (current === bankId ? null : current));
      }
    }
  };

  const handleBankChange = (index: number, field: string, value: string) => {
    const nextValue = field === "ifsc" ? toText(value).toUpperCase() : value;
    const bankId = kyc.bankDetails[index]?.id;

    kyc.changeBank(index, field, nextValue);

    if (bankId && (field === "ac_number" || field === "ifsc")) {
      const row = (kyc.bankDetails[index] ?? {}) as Record<string, unknown>;
      scheduleBankVerify(
        bankId,
        field === "ac_number" ? nextValue : row.ac_number,
        field === "ifsc" ? nextValue : row.ifsc
      );
    }

    if (field === "ifsc" && bankId) {
      latestIfscRef.current[bankId] = nextValue;
      void maybeFetchIfscDetails(bankId, nextValue);
    }
  };

  const maybeFetchPincodeDetails = async (addressId: string, pincodeValue: unknown) => {
    const pincode = toText(pincodeValue);

    if (
      !PINCODE_PATTERN.test(pincode) ||
      lastFetchedPincodeRef.current[addressId] === pincode
    ) {
      return;
    }

    lastFetchedPincodeRef.current[addressId] = pincode;
    setFetchingPincodeId(addressId);

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);

      if (!response.ok) {
        throw new Error("Unable to fetch pincode details");
      }

      const addressPatch = buildPincodeAddressPatch(await response.json());

      if (latestPincodeRef.current[addressId] !== pincode) {
        return;
      }

      if (Object.keys(addressPatch).length === 0) {
        toast.error("Pincode not found");
        return;
      }

      kyc.patchAddressById(addressId, addressPatch);
      toast.success("Address details loaded from pincode");
    } catch (error: unknown) {
      if (latestPincodeRef.current[addressId] === pincode) {
        lastFetchedPincodeRef.current[addressId] = "";
        toast.error(getErrorMessage(error, "Unable to fetch pincode details"));
      }
    } finally {
      if (latestPincodeRef.current[addressId] === pincode) {
        setFetchingPincodeId((current) => (current === addressId ? null : current));
      }
    }
  };

  const handleAddressChange = (index: number, field: string, value: string) => {
    const addressId = kyc.addresses[index]?.id;

    kyc.changeAddress(index, field, value);

    if (field === "pincode" && addressId) {
      latestPincodeRef.current[addressId] = value;
      void maybeFetchPincodeDetails(addressId, value);
    }
  };

  const openModal  = (section: string) => { setCurrentSection(section); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setCurrentSection(""); };

  const handleReset = () => {
    setDupErrors({});
    setPanActive(false);
    setActiveBanks({});
    setPayViaPortal(false);
    setPortal(EMPTY_PORTAL);
    setBasicInfo({});
    setGstSubmissionFields(null);
    lastFetchedGstRef.current = "";
    lastFetchedIfscRef.current = {};
    latestIfscRef.current = {};
    setFetchingIfscId(null);
    lastFetchedPincodeRef.current = {};
    latestPincodeRef.current = {};
    setFetchingPincodeId(null);
    kyc.resetSections();
  };

  const handleSubmit = async () => {
    if (Object.values(dupErrors).some(Boolean)) {
      toast.error(Object.values(dupErrors).find(Boolean) as string);
      return;
    }
    try {
      const formData = new FormData();

      // Collect non-file metadata and encrypt as a single _ep field
      // Supplier flow: org assignment done later by staff
      if (payViaPortal && !portalComplete) {
        toast.error("Enter the portal name and URL, or choose bank transfer");
        return;
      }
      const bankData    = payViaPortal ? [] : kyc.bankDetails.map(({ id, cancelChequeFile, ...b }) => ({ id, ...b, hasCancelCheque: !!cancelChequeFile }));
      const contactData = kyc.contacts.map(({ id, document, ...c }) => ({ id, ...c, hasDocument: !!document }));
      const basicInfoScalars = Object.fromEntries(
        Object.entries(basicInfo).filter(([, v]) => !(v instanceof File))
      );

      formData.append("_ep", await encryptFormMeta({
        companyIds:    [],
        divisionIds:   [],
        branchIds:     [],
        departmentIds: [],
        created_by:    "",
        addresses:     kyc.addresses.map(({ id, ...a }) => ({ id, ...a })),
        bankDetails:   bankData,
        contacts:      contactData,
        pay_via_portal: payViaPortal,
        ...(payViaPortal ? portal : {}),
        ...basicInfoScalars,
      }));

      // Append binary files separately (cannot be encrypted)
      if (!payViaPortal) kyc.bankDetails.forEach((b, i) => { if (b.cancelChequeFile) formData.append(`bankCancelCheque_${i}`, b.cancelChequeFile); });
      kyc.contacts.forEach((c, i)    => { if (c.document) formData.append(`contactDocument_${i}`, c.document); });
      Object.entries(kyc.documentInfo).forEach(([k, v]) => { if (v instanceof File) formData.append(k, v); });

      const response = await postData(submitUrl, formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (response) {
        toast.success("KYC submitted successfully! Our team will review and contact you.");
        handleReset();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "An error occurred while submitting KYC"));
    }
  };

  const renderModalContent = () => {
    switch (currentSection) {
      case "address":
        return (
          <AddressModalContent
            addresses={kyc.addresses}
            addressFields={addressFields}
            onAdd={kyc.addAddress}
            onRemove={kyc.removeAddress}
            onChange={handleAddressChange}
            onSetPrimary={kyc.setPrimaryAddress}
            fetchingPincodeId={fetchingPincodeId}
          />
        );
      case "account":
        return (
          <BankModalContent
            bankDetails={kyc.bankDetails}
            bankFields={bankFields}
            onAdd={kyc.addBank}
            onRemove={kyc.removeBank}
            onChange={handleBankChange}
            onSetPrimary={kyc.setPrimaryBank}
            onChequeChange={kyc.changeBankCheque}
            fetchingIfscId={fetchingIfscId}
            activeBankIds={activeBanks}
            payViaPortal={payViaPortal}
            onPayModeChange={setPayViaPortal}
            portal={portal}
            onPortalChange={(field, value) => setPortal((p) => ({ ...p, [field]: value }))}
          />
        );
      case "contacts":
        return (
          <ContactModalContent
            contacts={kyc.contacts}
            contactFields={contactFields}
            onAdd={kyc.addContact}
            onRemove={kyc.removeContact}
            onChange={kyc.changeContact}
            onSetPrimary={kyc.setPrimaryContact}
            onDocumentChange={kyc.changeContactDocument}
            documentLabel="ID Proof (optional)"
          />
        );
      case "documents":
        return (
          <DocumentModalContent
            documentFields={documentFields}
            documentInfo={kyc.documentInfo}
            onChange={kyc.changeDocument}
          />
        );
      default:
        return null;
    }
  };

  const meta = SECTION_META[currentSection];

  return (
    <div className={hideHeader ? "" : "min-h-full bg-muted/20"}>
      {!hideHeader && (
        <PageHeader
          icon={Building2}
          title="Supplier KYC Registration"
          description="Please fill in your business details accurately. Our team will review your submission."
        />
      )}

      <VerifyLock busy={busy} className={`block max-w-5xl mx-auto px-4 lg:px-8 space-y-6 ${hideHeader ? "relative z-10 -mt-14 pb-8 sm:-mt-16" : "py-6"}`}>
        {/* Business Information */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Business Information</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Basic details about your business</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {basicInfoFields
                .filter((f) => f.input)
                .map((f) => (
                  <div key={f.field}>
                    <CustomInputField
                      field={f.field}
                      label={f.label}
                      require={f.require}
                      value={basicInfo[f.field] || ""}
                      onChange={(v) => handleBasicChange(f.field, v)}
                      placeholder={f.placeholder}
                      type={f.type}
                      options={f.options || []}
                      disabled={f.field === "gst_no" && fetchingGst}
                      className={f.field === "gst_no" && isGstActive(gstSubmissionFields?.gst_status) ? "border-green-500 bg-green-50 text-green-700 focus-visible:ring-green-500" : undefined}
                    />
                    <FieldActiveNote field={f.field} errors={dupErrors} active={{ gst_no: isGstActive(gstSubmissionFields?.gst_status), pan_no: panActive, msme_no: Boolean(msmeDetails) }} />
                  </div>
                ))}
            </div>
            <div className="mt-4 empty:hidden">
              <MsmeVerifiedCard details={msmeDetails} />
            </div>
          </CardContent>
        </Card>

        {/* Additional Sections */}
        <FormSection icon={FileText} title="Additional Details" description="click each section to fill details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(SECTION_META).map(([key, { title, description, icon }]) => (
              <SectionActionCard
                key={key}
                title={title}
                description={description}
                icon={icon}
                isComplete={isSectionComplete(key)}
                onClick={() => openModal(key)}
              />
            ))}
          </div>
        </FormSection>

        {/* Submit */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Ready to submit?</p>
                <p className="text-xs text-muted-foreground">
                  Our team will review and assign your account within 2–3 business days.
                </p>
                {submitError && <p className="text-xs text-destructive mt-1">{submitError}</p>}
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={handleReset} disabled={submitting} className="flex-1 sm:flex-none">
                  Clear Form
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-4 w-4" />Submit KYC</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </VerifyLock>

      <DynamicDialog
        open={isModalOpen}
        onOpenChange={closeModal}
        title={meta?.title || ""}
        Icon={meta?.icon}
        onSave={async () => { await new Promise((r) => setTimeout(r, 200)); closeModal(); }}
        onCancel={closeModal}
      >
        <VerifyLock busy={busy}>{renderModalContent()}</VerifyLock>
      </DynamicDialog>

    </div>
  );
}
