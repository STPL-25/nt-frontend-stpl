import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  MapPin,
  FileText,
  CreditCard,
  Users,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import {
  useBasicInfoFields,
  useAddressFields,
  useBankFields,
  useContactFields,
  useDocumentFields,
  type FieldType,
} from "@/FieldDatas/KycFieldDatas";
import usePost from "@/hooks/usePostHook";
import { toast } from "sonner";
import {selectHierarchy} from "@/globalState/features/hierarchyCompanyDetailsSlice";
type DynamicFormData = Record<string, any>;
type AdditionalAddress = Record<string, string>;

export default function SupplierKYCForm() {
  const addressFields = useAddressFields();
  const documentFields = useDocumentFields();
  const bankFields = useBankFields();
  const contactFields = useContactFields();
console.log(selectHierarchy)
  // Initialize the usePost hook
  const { postData, loading: submitting, error: submitError } = usePost();

  // Initialize dynamic states
  const initialAddressInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    addressFields.filter(field => field.input).forEach((field) => {
      obj[field.field] = "";
    });
    return obj;
  }, [addressFields]);

  const initialBankInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    bankFields.filter(field => field.input).forEach((field) => {
      obj[field.field] = "";
    });
    return obj;
  }, [bankFields]);

  const initialContactInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    contactFields.filter(field => field.input).forEach((field) => {
      obj[field.field] = "";
    });
    return obj;
  }, [contactFields]);

  const initialDocumentInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    documentFields.filter(field => field.input).forEach((field) => {
      obj[field.field] = null;
    });
    return obj;
  }, [documentFields]);

  // State management
  const [basicInfo, setBasicInfo] = useState<DynamicFormData>({});
  const [addressInfo, setAddressInfo] = useState<DynamicFormData>(initialAddressInfo);
  const [bankInfo, setBankInfo] = useState<DynamicFormData>(initialBankInfo);
  const [contactInfo, setContactInfo] = useState<DynamicFormData>(initialContactInfo);
  const [documentInfo, setDocumentInfo] = useState<DynamicFormData>(initialDocumentInfo);
  const [additionalAddresses, setAdditionalAddresses] = useState<AdditionalAddress[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const basicInfoFields = useBasicInfoFields(basicInfo);

  // Generic change handlers
  const handleChange = (
    setState: React.Dispatch<React.SetStateAction<DynamicFormData>>
  ) => (field: string, value: any) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleBasicChange = handleChange(setBasicInfo);
  const handleAddressChange = handleChange(setAddressInfo);
  const handleBankChange = handleChange(setBankInfo);
  const handleContactChange = handleChange(setContactInfo);
  const handleDocumentChange = handleChange(setDocumentInfo);

  // Additional addresses management
  const handleAddAddress = () => {
    const newAddress: AdditionalAddress = {};
    addressFields.forEach((field) => {
      newAddress[field.field] = "";
    });
    setAdditionalAddresses((prev) => [...prev, newAddress]);
  };

  const handleRemoveAddress = (index: number) => {
    setAdditionalAddresses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdditionalAddressChange = (
    index: number,
    field: string,
    value: string
  ) => {
    setAdditionalAddresses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Modal management
  const handleOpenModal = (section: string) => {
    setCurrentSection(section);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentSection("");
  };

  const handleModalSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("Saving section:", currentSection);
    setIsSaving(false);
    handleCloseModal();
  };

  // Validation function
  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Validate basic info
    basicInfoFields.forEach((field) => {
      if (field.require && !basicInfo[field.field]) {
        errors.push(`${field.label} is required`);
      }
    });

    // Validate address
    addressFields.forEach((field) => {
      if (field.require && !addressInfo[field.field]) {
        errors.push(`Address: ${field.label} is required`);
      }
    });

    // Validate bank info
    bankFields.forEach((field) => {
      if (field.require && !bankInfo[field.field]) {
        errors.push(`Bank: ${field.label} is required`);
      }
    });

    // Validate contact info
    contactFields.forEach((field) => {
      if (field.require && !contactInfo[field.field]) {
        errors.push(`Contact: ${field.label} is required`);
      }
    });

    // Validate documents
    documentFields.forEach((field) => {
      if (field.require && !documentInfo[field.field]) {
        errors.push(`Document: ${field.label} is required`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Form submission with FormData for file uploads
  const handleSubmit = async () => {
    // Validate form
    // if (!validateForm()) {
    //      toast.error(`Please fill all required fields. ${validationErrors.length} errors found.`);
      
  
    //   return;
    // }

    try {
      // Create FormData for file uploads
      const formData = new FormData();

      // Append basic info
      Object.entries(basicInfo).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      // Append address info
      Object.entries(addressInfo).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      // Append additional addresses as JSON
      if (additionalAddresses.length > 0) {
        formData.append("additionalAddresses", JSON.stringify(additionalAddresses));
      }

      // Append bank info
      Object.entries(bankInfo).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      // Append contact info
      Object.entries(contactInfo).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      // Append document files
      Object.entries(documentInfo).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value);
        }
      });

      // Submit using usePost hook
      const response = await postData(
        `${import.meta.env.VITE_API_URL}/api/kyc/create_kyc_records`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response) {
        toast.success("KYC submitted successfully!")
      
        // Reset form after successful submission
        setBasicInfo({});
        setAddressInfo(initialAddressInfo);
        setBankInfo(initialBankInfo);
        setContactInfo(initialContactInfo);
        setDocumentInfo(initialDocumentInfo);
        setAdditionalAddresses([]);
        setValidationErrors([]);
      }
    } catch (error: any) {
      console.error("KYC submission error:", error);
      toast.error(error?.message || "An error occurred while submitting KYC" );
    }
  };

  // Completion status
  const getCompletionStatus = (section: string) => {
    switch (section) {
      case "address":
        return addressFields.some(
          (field) => field.require && addressInfo[field.field]
        );
      case "documents":
        return documentFields.some((field) => documentInfo[field.field]);
      case "account":
        return bankFields.some((field) => field.require && bankInfo[field.field]);
      case "contacts":
        return contactFields.some(
          (field) => field.require && contactInfo[field.field]
        );
      default:
        return false;
    }
  };

  // Section Button Component
  const SectionButton = ({
    title,
    description,
    icon: Icon,
    section,
  }: {
    title: string;
    description?: string;
    icon: any;
    section: string;
  }) => {
    const isComplete = getCompletionStatus(section);

    return (
      <Card
        className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
        onClick={() => handleOpenModal(section)}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            {isComplete ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Contact groups helper
  const getContactGroups = () => {
    const groups: Record<string, FieldType[]> = {};
    contactFields.forEach((field) => {
      const prefix = field.field.match(/^[a-z]+/)?.[0] || "other";
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(field);
    });
    return groups;
  };

  const getGroupTitle = (prefix: string): string => {
    const titles: Record<string, string> = {
      owner: "Owner Details",
      bo: "Business Operations Contact",
      acc: "Accounts Contact",
    };
    return titles[prefix] || prefix.charAt(0).toUpperCase() + prefix.slice(1) + " Details";
  };

  // Render modal content
  const renderModalContent = () => {
    switch (currentSection) {
      case "address":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addressFields
                .filter((field) => field.input)
                .map((field) => (
                  <CustomInputField
                    key={field.field}
                    field={field.field}
                    label={field.label}
                    require={field.require}
                    value={addressInfo[field.field] || ""}
                    onChange={(v) => handleAddressChange(field.field, v)}
                    placeholder={field.placeholder}
                    type={field.type}
                  />
                ))}
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-4 text-lg">
                Additional Business Locations
              </h3>
              {additionalAddresses.map((addr, index) => (
                <div
                  key={index}
                  className="mb-6 p-4 border rounded-lg bg-slate-50 relative"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAddress(index)}
                    className="absolute top-2 right-2 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {addressFields
                      .filter((field) => field.input)
                      .map((field) => (
                        <CustomInputField
                          key={`${field.field}-${index}`}
                          field={`${field.field}-${index}`}
                          label={field.label}
                          value={addr[field.field] || ""}
                          onChange={(value) =>
                            handleAdditionalAddressChange(index, field.field, value)
                          }
                          placeholder={field.placeholder}
                          type={field.type}
                        />
                      ))}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAddress}
                className="w-full"
              >
                + Add Another Location
              </Button>
            </div>
          </div>
        );

      case "account":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bankFields
              .filter((field) => field.input)
              .map((field) => (
                <CustomInputField
                  key={field.field}
                  field={field.field}
                  label={field.label}
                  require={field.require}
                  value={bankInfo[field.field] || ""}
                  onChange={(v) => handleBankChange(field.field, v)}
                  placeholder={field.placeholder}
                  type={field.type}
                />
              ))}
          </div>
        );

      case "contacts":
        const contactGroups = getContactGroups();
        return (
          <div className="space-y-6">
            {Object.entries(contactGroups).map(([prefix, fields], groupIndex) => (
              <React.Fragment key={prefix}>
                {groupIndex > 0 && <Separator />}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {getGroupTitle(prefix)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields
                      .filter((field) => field.input)
                      .map((field) => (
                        <CustomInputField
                          key={field.field}
                          field={field.field}
                          label={field.label}
                          require={field.require}
                          value={contactInfo[field.field] || ""}
                          onChange={(v) => handleContactChange(field.field, v)}
                          placeholder={field.placeholder}
                          type={field.type}
                        />
                      ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        );

      case "documents":
        return (
          <div className="space-y-4">
            {documentFields
              .filter((field) => field.input)
              .map((field) => (
                <CustomInputField
                  key={field.field}
                  field={field.field}
                  label={field.label}
                  require={field.require}
                  type="file"
                  value={documentInfo[field.field] ?? null}
                  onChange={(fileOrNull: File | null) =>
                    handleDocumentChange(field.field, fileOrNull)
                  }
                />
              ))}
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    const titles: Record<string, string> = {
      address: "Address Details",
      documents: "Document Upload",
      account: "Bank Account Details",
      contacts: "Contact Information",
    };
    return titles[currentSection] || "";
  };

  const getModalIcon = () => {
    const icons: Record<string, any> = {
      address: MapPin,
      account: CreditCard,
      contacts: Users,
      documents: Upload,
    };
    return icons[currentSection] || FileText;
  };

  const ModalIcon = getModalIcon();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto">
        <div className="space-y-6">
          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <Card className="border-red-500 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-2">
                      Please fix the following errors:
                    </h3>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                      {validationErrors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {validationErrors.length > 5 && (
                        <li>... and {validationErrors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information Section */}
          <Card className="shadow-xl border-t-4 border-t-primary">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Basic Information
              </CardTitle>
              <CardDescription>Enter primary supplier details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {basicInfoFields
                  .filter((field) => field.input)
                  .map((field) => (
                    <div
                      key={field.field}
                      className={
                        field.type === "radio" ? "md:row-span-1 lg:row-span-1" : ""
                      }
                    >
                      <CustomInputField
                        field={field.field}
                        label={field.label}
                        require={field.require}
                        value={basicInfo[field.field] || ""}
                        onChange={(v) => handleBasicChange(field.field, v)}
                        placeholder={field.placeholder}
                        type={field.type}
                        options={field.options}
                      />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Sections */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Additional Sections
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionButton
                title="Address Details"
                description="Location and registered address information"
                icon={MapPin}
                section="address"
              />

              <SectionButton
                title="Bank Account Details"
                description="Banking information for transactions"
                icon={CreditCard}
                section="account"
              />

              <SectionButton
                title="Contact Information"
                description="Key personnel and their contact details"
                icon={Users}
                section="contacts"
              />

              <SectionButton
                title="Document Upload"
                description="Upload required certificates and documents"
                icon={Upload}
                section="documents"
              />
            </div>
          </div>

          {/* Submit Section */}
          <Card className="shadow-xl border-t-4 border-t-green-500">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-semibold mb-1">Ready to Submit</h3>
                 
                  {submitError && (
                    <p className="text-sm text-red-600 mt-2">{submitError}</p>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="flex-1 sm:flex-none h-11"
                    disabled={submitting}
                  >
                    Reset Form
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 sm:flex-none h-11 bg-green-600 hover:bg-green-700"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Submit KYC
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <ModalIcon className="h-6 w-6 text-primary" />
              {getModalTitle()}
            </DialogTitle>
          </DialogHeader>

          <Separator className="my-2" />

          <div className="overflow-y-auto max-h-[60vh] px-1">
            {renderModalContent()}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleModalSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
