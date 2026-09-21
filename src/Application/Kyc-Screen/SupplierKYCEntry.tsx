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
  ContactModalContent, DocumentModalContent,
} from "./KycModalSections";
import { IFSC_PATTERN, buildIfscBankPatch, getErrorMessage } from "./ifscUtils";
import {
  GSTIN_PATTERN, unwrapGstRecord, buildGstSubmissionFields, getGstLegalName,
  buildGstAddressPatch, flattenGstDetails, clearGstSubmissionFields, derivePanFromGstin,
  type UnknownRecord, type GstSubmissionFields,
} from "./gstUtils";

const toText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const SECTION_META: Record<string, { title: string; description: string; icon: any }> = {
  address:   { title: "Address Details",   description: "Business locations and registered addresses",          icon: MapPin },
  account:   { title: "Bank Account",      description: "Banking information and cancelled cheque",             icon: CreditCard },
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
}

export default function SupplierKYCEntry({
  masterOptionsUrl, submitUrl = apiPostKycData, gstDetailsUrl = apiGetGSTNDetails,
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
  const [isGstDialogOpen, setIsGstDialogOpen] = useState(false);
  const [gstDetails, setGstDetails]           = useState<UnknownRecord | null>(null);
  const [gstSubmissionFields, setGstSubmissionFields] = useState<GstSubmissionFields | null>(null);

  const basicInfoFields = useBasicInfoFields(basicInfo, masterOptionsUrl);
  const kyc = useKycSections(addressFields, bankFields, contactFields, documentFields);
  const lastFetchedIfscRef = useRef<Record<string, string>>({});
  const latestIfscRef = useRef<Record<string, string>>({});
  const [fetchingIfscId, setFetchingIfscId] = useState<string | null>(null);
  const lastFetchedGstRef = useRef("");

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

    // PAN is embedded in the GSTIN itself (characters 3-12), so it can be
    // filled in immediately, independent of whether the GST lookup below
    // succeeds — no need to wait on (or fail alongside) that network call.
    const panFromGstin = derivePanFromGstin(gst);
    if (panFromGstin) {
      setBasicInfo((prev) => ({ ...prev, pan_no: panFromGstin }));
    }

    try {
      const response = await fetchGstDetails(gstDetailsUrl, { gst });
      const gstRecord = unwrapGstRecord(response?.data);

      if (!gstRecord) {
        throw new Error("GST details response was empty");
      }

      const submissionFields = buildGstSubmissionFields(response?.data);
      const legalName = getGstLegalName(response?.data);
      const addressPatch = buildGstAddressPatch(response?.data);

      setGstDetails(gstRecord);
      setGstSubmissionFields(submissionFields);
      setIsGstDialogOpen(true);

      setBasicInfo((prev) => ({
        ...prev,
        ...submissionFields,
        ...(legalName ? { company_name: legalName } : {}),
      }));

      if (Object.keys(addressPatch).length === 0) {
        toast.error(
          legalName
            ? "GST legal name loaded, but address information was unavailable"
            : "GST details found, but address information was unavailable"
        );
        return;
      }

      const primaryAddressIndex = kyc.addresses.findIndex((address) => address.isPrimary);
      kyc.patchAddress(primaryAddressIndex >= 0 ? primaryAddressIndex : 0, addressPatch);
      toast.success(
        legalName
          ? "GST legal name and address details loaded"
          : "GST address details loaded into the primary address"
      );
    } catch (error: unknown) {
      lastFetchedGstRef.current = "";
      toast.error(getErrorMessage(error, "Unable to fetch GST details"));
    }
  };

  const handleBasicChange = (field: string, value: any) => {
    const nextValue = field === "gst_no" ? toText(value).toUpperCase() : value;
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
      setGstDetails(null);
      setGstSubmissionFields(null);
      setIsGstDialogOpen(false);
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
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`);

      if (!response.ok) {
        throw new Error(response.status === 404 ? "IFSC code not found" : "Unable to fetch IFSC details");
      }

      const bankPatch = buildIfscBankPatch(await response.json());

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

    if (field === "ifsc" && bankId) {
      latestIfscRef.current[bankId] = nextValue;
      void maybeFetchIfscDetails(bankId, nextValue);
    }
  };

  const openModal  = (section: string) => { setCurrentSection(section); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setCurrentSection(""); };

  const handleReset = () => {
    setBasicInfo({});
    setGstDetails(null);
    setGstSubmissionFields(null);
    setIsGstDialogOpen(false);
    lastFetchedGstRef.current = "";
    lastFetchedIfscRef.current = {};
    latestIfscRef.current = {};
    setFetchingIfscId(null);
    kyc.resetSections();
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();

      // Collect non-file metadata and encrypt as a single _ep field
      // Supplier flow: org assignment done later by staff
      const bankData    = kyc.bankDetails.map(({ id, cancelChequeFile, ...b }) => ({ id, ...b, hasCancelCheque: !!cancelChequeFile }));
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
        ...basicInfoScalars,
      }));

      // Append binary files separately (cannot be encrypted)
      kyc.bankDetails.forEach((b, i) => { if (b.cancelChequeFile) formData.append(`bankCancelCheque_${i}`, b.cancelChequeFile); });
      kyc.contacts.forEach((c, i)    => { if (c.document) formData.append(`contactDocument_${i}`, c.document); });
      Object.entries(kyc.documentInfo).forEach(([k, v]) => { if (v instanceof File) formData.append(k, v); });

      const response = await postData(submitUrl, formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (response) {
        toast.success("KYC submitted successfully! Our team will review and contact you.");
        handleReset();
      }
    } catch (error: any) {
      toast.error(error?.message || "An error occurred while submitting KYC");
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
            onChange={kyc.changeAddress}
            onSetPrimary={kyc.setPrimaryAddress}
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
  const gstDetailRows = gstDetails ? flattenGstDetails(gstDetails) : [];
  const gstSummaryRows = gstSubmissionFields
    ? [
        { label: "Legal Name", value: gstSubmissionFields.legal_name },
        { label: "Trade Name", value: gstSubmissionFields.trade_name },
        { label: "Taxpayer Type", value: gstSubmissionFields.txp_type },
        { label: "GST Status", value: gstSubmissionFields.gst_status },
        { label: "GST Block Status", value: gstSubmissionFields.gst_blk_status },
        { label: "Date Of Registration", value: gstSubmissionFields.date_of_reg },
      ]
    : [];

  return (
    <div className="min-h-full bg-muted/20">
      {/* Page Header */}
      <PageHeader
        icon={Building2}
        title="Supplier KYC Registration"
        description="Please fill in your business details accurately. Our team will review your submission."
      >
        {/* <div className="flex items-center gap-2 mt-3 lg:mt-0 bg-primary-foreground/10 rounded-lg px-3 py-2 w-fit border border-primary-foreground/20">
          <Info className="h-4 w-4 text-primary-foreground/70" />
          <span className="text-xs text-primary-foreground/80">
            Fields marked <span className="text-red-300 font-bold">*</span> are mandatory
          </span>
        </div> */}
      </PageHeader>

      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 space-y-6">
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
                  <CustomInputField
                    key={f.field}
                    field={f.field}
                    label={f.label}
                    require={f.require}
                    value={basicInfo[f.field] || ""}
                    onChange={(v) => handleBasicChange(f.field, v)}
                    placeholder={f.placeholder}
                    type={f.type}
                    options={f.options || []}
                    disabled={f.field === "gst_no" && fetchingGst}
                  />
                ))}
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
                isComplete={kyc.getCompletionStatus(key)}
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
      </div>

      <DynamicDialog
        open={isModalOpen}
        onOpenChange={closeModal}
        title={meta?.title || ""}
        Icon={meta?.icon}
        onSave={async () => { await new Promise((r) => setTimeout(r, 200)); closeModal(); }}
        onCancel={closeModal}
      >
        {renderModalContent()}
      </DynamicDialog>

      <DynamicDialog
        open={isGstDialogOpen}
        onOpenChange={setIsGstDialogOpen}
        title="GST Details"
        Icon={FileText}
        cancelText="Close"
        onCancel={() => setIsGstDialogOpen(false)}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gstSummaryRows.map(({ label, value }) => (
              <div key={label} className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-medium break-words">{value || "-"}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">All GST Response Details</h3>
            <div className="divide-y rounded-md border">
              {gstDetailRows.length > 0 ? (
                gstDetailRows.map(({ label, value }, index) => (
                  <div
                    key={`${label}-${index}`}
                    className="grid grid-cols-1 gap-1 p-3 text-sm sm:grid-cols-[minmax(180px,240px)_1fr] sm:gap-4"
                  >
                    <span className="text-muted-foreground break-words">{label}</span>
                    <span className="font-medium break-words">{value}</span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No GST details available.</div>
              )}
            </div>
          </div>
        </div>
      </DynamicDialog>
    </div>
  );
}
