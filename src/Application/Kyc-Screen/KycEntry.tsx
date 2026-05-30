import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, MapPin, FileText, CreditCard, Users, Upload, CheckCircle2, Loader2,
  type LucideIcon,
} from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  useBasicInfoFields, useAddressFields, useBankFields,
  useContactFields, useDocumentFields, useComDivBranchDeptFields,
} from "@/FieldDatas/KycFieldDatas";
import usePost from "@/hooks/usePostHook";
import { toast } from "sonner";
import { apiGetGSTNDetails, apiPostKycData } from "@/Services/Api";
import { encryptFormMeta } from "@/Services/apiCrypto";
import DynamicDialog from "@/CustomComponent/InputComponents/CustomModelComponent";
import { useAppState } from "@/globalState/hooks/useAppState";
import { usePermissions } from "@/globalState/hooks/usePermissions";
import { useKycSections } from "@/hooks/useKycSections";
import { SectionActionCard, FormSection } from "@/CustomComponent/PageComponents";
import {
  AddressModalContent, BankModalContent,
  ContactModalContent, DocumentModalContent,
} from "./KycModalSections";

const SECTION_META: Record<string, { title: string; description: string; icon: LucideIcon }> = {
  address:   { title: "Address Details",      description: "Business locations and registered addresses",                   icon: MapPin },
  account:   { title: "Bank Account",         description: "Banking information and cancelled cheque for each account",     icon: CreditCard },
  contacts:  { title: "Contact Information",  description: "Owner / authorized person and additional contacts",             icon: Users },
  documents: { title: "Documents",            description: "Upload certificates and required documents",                    icon: Upload },
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type GstAddressPatch = Partial<Record<
  "door_no" | "street" | "area" | "taluk" | "city" | "state" | "pincode",
  string
>>;

type IfscBankPatch = Partial<Record<
  "bank_name" | "bank_branch_name" | "bank_address",
  string
>>;

type UnknownRecord = Record<string, unknown>;

type GstSubmissionFields = {
  legal_name: string;
  trade_name: string;
  txp_type: string;
  gst_status: string;
  gst_blk_status: string;
  date_of_reg: string;
};

type GstDisplayRow = {
  label: string;
  value: string;
};

const GST_BACKEND_FIELD_KEYS: (keyof GstSubmissionFields)[] = [
  "legal_name",
  "trade_name",
  "txp_type",
  "gst_status",
  "gst_blk_status",
  "date_of_reg",
];

const toText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const firstText = (...values: unknown[]) =>
  values.map(toText).find(Boolean) || "";

const joinText = (...values: unknown[]) =>
  values.map(toText).filter(Boolean).join(", ");

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === "object" && value !== null ? (value as UnknownRecord) : null;

const getRecord = (record: UnknownRecord | null, key: string) =>
  asRecord(record?.[key]);

const unwrapGstRecord = (payload: unknown): UnknownRecord | null => {
  const payloadRecord = asRecord(payload);
  const root = payloadRecord?.data ?? payload;
  if (Array.isArray(root)) return asRecord(root[0]);

  const rootRecord = asRecord(root);
  if (Array.isArray(rootRecord?.data)) return asRecord(rootRecord.data[0]);
  return rootRecord;
};

const getGstAddressRecord = (record: UnknownRecord | null) =>
    getRecord(getRecord(record, "pradr"), "addr") ??
    getRecord(getRecord(record, "principalPlaceOfBusiness"), "address") ??
    getRecord(getRecord(record, "principal_place_of_business"), "address") ??
    getRecord(record, "address") ??
    record ??
    {};

const getGstLegalName = (payload: unknown) => {
  return buildGstSubmissionFields(payload).legal_name;
};

const buildGstSubmissionFields = (payload: unknown): GstSubmissionFields => {
  const record = unwrapGstRecord(payload);
  const address = getGstAddressRecord(record);

  return {
    legal_name: firstText(
      record?.LegalName,
      record?.legalName,
      record?.legal_name,
      record?.lgnm,
      address?.LegalName,
      address?.legalName,
      address?.legal_name,
      address?.lgnm
    ),
    trade_name: firstText(
      record?.TradeName,
      record?.tradeName,
      record?.trade_name,
      record?.tradeNam,
      record?.tradenm
    ),
    txp_type: firstText(
      record?.TxpType,
   
    ),
    gst_status: firstText(
      record?.Status,
     
    ),
    gst_blk_status: firstText(
      record?.BlkStatus,
     
    ),
    date_of_reg: firstText(
      record?.DtDReg,
      
    ),
  };
};

const humanizeGstLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const flattenGstDetails = (value: unknown, path: string[] = []): GstDisplayRow[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      flattenGstDetails(entry, [...path, String(index + 1)])
    );
  }

  const record = asRecord(value);
  if (record) {
    return Object.entries(record).flatMap(([key, entry]) =>
      flattenGstDetails(entry, [...path, key])
    );
  }

  const text = toText(value);
  if (!text || path.length === 0) return [];

  return [{
    label: path.map(humanizeGstLabel).join(" / "),
    value: text,
  }];
};

const clearGstSubmissionFields = (record: Record<string, unknown>) => {
  const next = { ...record };
  GST_BACKEND_FIELD_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
};

const buildGstAddressPatch = (payload: unknown): GstAddressPatch => {
  const record = unwrapGstRecord(payload);
  const address = getGstAddressRecord(record);

  const patch: GstAddressPatch = {
    door_no: joinText(
      address?.flno,
      address?.AddrFlno,
      address?.floor_no,
      address?.bno,
      address?.AddrBno,
      address?.door_no,
      address?.building_no
    ),
    street: firstText(
      address?.st,
      address?.AddrSt,
      address?.street,
      address?.street_name
    ),
    area: firstText(
      address?.loc,
      address?.AddrLoc,
      address?.bnm,
      address?.AddrBnm,
      address?.area,
      address?.locality
    ),
    taluk: firstText(
      address?.taluk,
      address?.Taluk,
      address?.subDistrict,
      address?.sub_district
    ),
    city: firstText(
      address?.city,
      address?.City,
      address?.dst,
      address?.AddrDst,
      address?.district
    ),
    state: firstText(
      address?.state,
      address?.State,
      address?.stcd,
      address?.AddrStcd,
      address?.state_name
    ),
    pincode: firstText(
      address?.pncd,
      address?.AddrPncd,
      address?.pincode,
      address?.pinCode,
      address?.postal_code
    ),
  };

  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => Boolean(value))
  ) as GstAddressPatch;
};

const buildIfscBankPatch = (payload: unknown): IfscBankPatch => {
  const record = asRecord(payload);

  const patch: IfscBankPatch = {
    bank_name: firstText(record?.BANK, record?.bank),
    bank_branch_name: firstText(record?.BRANCH, record?.branch),
    bank_address: firstText(record?.ADDRESS, record?.address),
  };

  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => Boolean(value))
  ) as IfscBankPatch;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const requestError = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };

  return requestError.response?.data?.error ||
    requestError.response?.data?.message ||
    requestError.message ||
    fallback;
};

export default function KycEntryForm() {
  const addressFields  = useAddressFields();
  const documentFields = useDocumentFields();
  const bankFields     = useBankFields();
  const contactFields  = useContactFields();
  const { postData, loading: submitting, error: submitError } = usePost();
  const { postData: fetchGstDetails, loading: fetchingGst } = usePost<{
    success: boolean;
    data?: unknown;
  }>();
  const { userData } = useAppState();
  const { canCreate, canEdit } = usePermissions();

  const [basicInfo, setBasicInfo]               = useState<Record<string, unknown>>({});
  const [isModalOpen, setIsModalOpen]           = useState(false);
  const [isGstDialogOpen, setIsGstDialogOpen]   = useState(false);
  const [gstDetails, setGstDetails]             = useState<UnknownRecord | null>(null);
  const [gstSubmissionFields, setGstSubmissionFields] = useState<GstSubmissionFields | null>(null);
  const [currentSection, setCurrentSection]     = useState("");
  const [selectedCompany, setSelectedCompany]   = useState<number[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<number[]>([]);
  const [selectedBranch, setSelectedBranch]     = useState<number[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);

  const { fields: hierarchyFields, error: hierarchyError } = useComDivBranchDeptFields(
    selectedCompany,
    selectedDivision
  );
  const basicInfoFields = useBasicInfoFields(basicInfo);

  const kyc = useKycSections(addressFields, bankFields, contactFields, documentFields);
  const lastFetchedGstRef = useRef("");
  const lastFetchedIfscRef = useRef<Record<string, string>>({});
  const latestIfscRef = useRef<Record<string, string>>({});

  // ── Handlers ──────────────────────────────────────────────────────────────

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

    try {
      const response = await fetchGstDetails(apiGetGSTNDetails, { gst });
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

  const handleBasicChange = (field: string, value: unknown) => {
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

  const handleHierarchyChange = (field: string, vals: (number | string)[]) => {
    switch (field) {
      case "com_sno":
        setSelectedCompany(vals.map(Number));
        setSelectedDivision([]);
        setSelectedBranch([]);
        break;
      case "div_sno":
        setSelectedDivision(vals.map(Number));
        setSelectedBranch([]);
        break;
      case "brn_sno":
        setSelectedBranch(vals.map(Number));
        break;
      case "dept_sno":
        setSelectedDepartment(vals.map(String));
        break;
    }
  };

  const getHierarchyValue = (field: string) =>
    ({ com_sno: selectedCompany, div_sno: selectedDivision, brn_sno: selectedBranch, dept_sno: selectedDepartment }[field] ?? []);

  const openModal = (section: string) => { setCurrentSection(section); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setCurrentSection(""); };

  const handleReset = () => {
    setBasicInfo({});
    setGstDetails(null);
    setGstSubmissionFields(null);
    setIsGstDialogOpen(false);
    lastFetchedGstRef.current = "";
    lastFetchedIfscRef.current = {};
    latestIfscRef.current = {};
    setSelectedCompany([]); setSelectedDivision([]); setSelectedBranch([]); setSelectedDepartment([]);
    kyc.resetSections();
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();

      // Collect non-file metadata and encrypt as a single _ep field
      const bankData    = kyc.bankDetails.map(({ id, cancelChequeFile, ...b }) => ({ id, ...b, hasCancelCheque: !!cancelChequeFile }));
      const contactData = kyc.contacts.map(({ id, document, ...c }) => ({ id, ...c, hasDocument: !!document }));
      const basicInfoScalars = Object.fromEntries(
        Object.entries(basicInfo).filter(([, v]) => !(v instanceof File))
      );

      formData.append("_ep", await encryptFormMeta({
        companyIds:    selectedCompany,
        divisionIds:   selectedDivision,
        branchIds:     selectedBranch,
        departmentIds: selectedDepartment,
        created_by:    userData[0]?.ecno || "",
        addresses:     kyc.addresses.map(({ id, ...a }) => ({ id, ...a })),
        bankDetails:   bankData,
        contacts:      contactData,
        ...basicInfoScalars,
      }));

      // Append binary files separately (cannot be encrypted)
      kyc.bankDetails.forEach((b, i) => { if (b.cancelChequeFile) formData.append(`bankCancelCheque_${i}`, b.cancelChequeFile); });
      kyc.contacts.forEach((c, i)    => { if (c.document) formData.append(`contactDocument_${i}`, c.document); });
      Object.entries(kyc.documentInfo).forEach(([k, v]) => { if (v instanceof File) formData.append(k, v); });

      const response = await postData(apiPostKycData, formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (response) {
        toast.success("KYC submitted successfully!");
        handleReset();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "An error occurred while submitting KYC"));
    }
  };

  // ── Modal content ─────────────────────────────────────────────────────────

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
  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/20 py-6 px-4 lg:px-8">
      <div className="mx-auto space-y-6">
        {hierarchyError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
            Failed to load hierarchy data: {hierarchyError}
          </div>
        )}

        {/* Basic Information */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {hierarchyFields.filter((f) => f.input).map((field) => (
                <CustomInputField
                  key={field.field}
                  field={field.field}
                  label={field.label}
                  type={field.type}
                  options={field.options || []}
                  value={getHierarchyValue(field.field)}
                  onChange={(vals: (number | string)[]) => handleHierarchyChange(field.field, vals)}
                  require={field.require}
                  disabled={field.disabled}
                  placeholder={field.placeholder}
                />
              ))}
            </div>

            {basicInfoFields?.some((f) => f.input) && (
              <>
                {/* <Separator /> */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {basicInfoFields?.filter((f) => f.input)
                    .map((field) => (
                      <CustomInputField
                        key={field.field}
                        field={field.field}
                        label={field.label}
                        require={field.require}
                        value={basicInfo[field.field] || ""}
                        onChange={(v) => handleBasicChange(field.field, v)}
                        placeholder={field.placeholder}
                        type={field.type}
                        options={field.options || []}
                        disabled={field.field === "gst_no" && fetchingGst}
                      />
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Additional Sections */}
        <FormSection icon={FileText} title="Additional Information" description="click each card to fill details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div>
                {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} disabled={submitting}>
                  Reset Form
                </Button>
                {(canCreate("KYCEntry") || canEdit("KYCEntry")) && (
                  <Button
                    onClick={handleSubmit}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Submit KYC</>
                    )}
                  </Button>
                )}
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
