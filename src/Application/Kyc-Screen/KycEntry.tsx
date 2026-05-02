import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2, MapPin, FileText, CreditCard, Users, Upload, CheckCircle2, Loader2,
} from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  useBasicInfoFields, useAddressFields, useBankFields,
  useContactFields, useDocumentFields, useComDivBranchDeptFields,
} from "@/FieldDatas/KycFieldDatas";
import usePost from "@/hooks/usePostHook";
import { toast } from "sonner";
import { apiPostKycData } from "@/Services/Api";
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

const SECTION_META: Record<string, { title: string; description: string; icon: any }> = {
  address:   { title: "Address Details",      description: "Business locations and registered addresses",                   icon: MapPin },
  account:   { title: "Bank Account",         description: "Banking information and cancelled cheque for each account",     icon: CreditCard },
  contacts:  { title: "Contact Information",  description: "Owner / authorized person and additional contacts",             icon: Users },
  documents: { title: "Documents",            description: "Upload certificates and required documents",                    icon: Upload },
};

export default function KycEntryForm() {
  const addressFields  = useAddressFields();
  const documentFields = useDocumentFields();
  const bankFields     = useBankFields();
  const contactFields  = useContactFields();
  const { postData, loading: submitting, error: submitError } = usePost();
  const { userData } = useAppState();
  const { canCreate, canEdit } = usePermissions();

  const [basicInfo, setBasicInfo]               = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen]           = useState(false);
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBasicChange = (field: string, value: any) =>
    setBasicInfo((prev) => ({ ...prev, [field]: value }));

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
    } catch (error: any) {
      toast.error(error?.message || "An error occurred while submitting KYC");
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
            onChange={kyc.changeBank}
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

            {basicInfoFields.some((f) => f.input) && (
              <>
                {/* <Separator /> */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {basicInfoFields
                    .filter((f) => f.input)
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
    </div>
  );
}
