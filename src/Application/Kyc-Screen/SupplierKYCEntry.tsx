import React, { useState } from "react";
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
import { apiPostKycData } from "@/Services/Api";
import DynamicDialog from "@/CustomComponent/InputComponents/CustomModelComponent";
import { useKycSections } from "@/hooks/useKycSections";
import { SectionActionCard, FormSection, PageHeader } from "@/CustomComponent/PageComponents";
import {
  AddressModalContent, BankModalContent,
  ContactModalContent, DocumentModalContent,
} from "./KycModalSections";

const SECTION_META: Record<string, { title: string; description: string; icon: any }> = {
  address:   { title: "Address Details",   description: "Business locations and registered addresses",          icon: MapPin },
  account:   { title: "Bank Account",      description: "Banking information and cancelled cheque",             icon: CreditCard },
  contacts:  { title: "Contact Persons",   description: "Owner / authorized representatives with ID proof",    icon: Users },
  documents: { title: "Documents",         description: "Upload GST certificate, PAN card and MSME certificate", icon: Upload },
};

export default function SupplierKYCEntry() {
  const addressFields  = useAddressFields();
  const documentFields = useDocumentFields();
  const bankFields     = useBankFields();
  const contactFields  = useContactFields();
  const { postData, loading: submitting, error: submitError } = usePost();

  const [basicInfo, setBasicInfo]           = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [currentSection, setCurrentSection] = useState("");

  const basicInfoFields = useBasicInfoFields(basicInfo);
  const kyc = useKycSections(addressFields, bankFields, contactFields, documentFields);

  const handleBasicChange = (field: string, value: any) =>
    setBasicInfo((prev) => ({ ...prev, [field]: value }));

  const openModal  = (section: string) => { setCurrentSection(section); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setCurrentSection(""); };

  const handleReset = () => {
    setBasicInfo({});
    kyc.resetSections();
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();
      // Supplier flow: org assignment done later by staff
      formData.append("companyIds",    JSON.stringify([]));
      formData.append("divisionIds",   JSON.stringify([]));
      formData.append("branchIds",     JSON.stringify([]));
      formData.append("departmentIds", JSON.stringify([]));
      formData.append("created_by",    "");

      Object.entries(basicInfo).forEach(([k, v]) => {
        if (v !== null && v !== undefined) formData.append(k, v);
      });

      formData.append("addresses", JSON.stringify(kyc.addresses.map(({ id, ...a }) => ({ id, ...a }))));

      const bankData = kyc.bankDetails.map(({ id, cancelChequeFile, ...b }) => ({ id, ...b, hasCancelCheque: !!cancelChequeFile }));
      formData.append("bankDetails", JSON.stringify(bankData));
      kyc.bankDetails.forEach((b, i) => { if (b.cancelChequeFile) formData.append(`bankCancelCheque_${i}`, b.cancelChequeFile); });

      const contactData = kyc.contacts.map(({ id, document, ...c }) => ({ id, ...c, hasDocument: !!document }));
      formData.append("contacts", JSON.stringify(contactData));
      kyc.contacts.forEach((c, i) => { if (c.document) formData.append(`contactDocument_${i}`, c.document); });

      Object.entries(kyc.documentInfo).forEach(([k, v]) => { if (v instanceof File) formData.append(k, v); });

      const response = await postData(apiPostKycData, formData, { headers: { "Content-Type": "multipart/form-data" } });
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
    <div className="min-h-screen bg-muted/20">
      {/* Page Header */}
      <PageHeader
        icon={Building2}
        title="Supplier KYC Registration"
        description="Please fill in your business details accurately. Our team will review your submission."
      >
        <div className="flex items-center gap-2 mt-3 lg:mt-0 bg-primary-foreground/10 rounded-lg px-3 py-2 w-fit border border-primary-foreground/20">
          <Info className="h-4 w-4 text-primary-foreground/70" />
          <span className="text-xs text-primary-foreground/80">
            Fields marked <span className="text-red-300 font-bold">*</span> are mandatory
          </span>
        </div>
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
    </div>
  );
}
