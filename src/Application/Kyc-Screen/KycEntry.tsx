import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, FileText, CreditCard, Users, Upload, CheckCircle2, X, Loader2, ChevronRight, Plus, Star } from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { useBasicInfoFields, useAddressFields, useBankFields, useContactFields, useDocumentFields, useComDivBranchDeptFields } from "@/FieldDatas/KycFieldDatas";
import usePost from "@/hooks/usePostHook";
import { toast } from "sonner";
import { apiPostKycData } from "@/Services/Api";
import DynamicDialog from "@/CustomComponent/InputComponents/CustomModelComponent";
import { DynamicFormData, AdditionalAddress, BankDetail, ContactDetail } from "./types/KycEntryType";
import { useAppState } from "@/globalState/hooks/useAppState";
// Extended types with isPrimary flag
interface AddressWithPrimary extends AdditionalAddress {
  id: string;
  isPrimary: boolean;
}

interface BankDetailWithPrimary extends BankDetail {
  isPrimary: boolean;
}

interface ContactDetailWithPrimary extends ContactDetail {
  isPrimary: boolean;
}

export default function SupplierKYCForm() {
  const addressFields = useAddressFields();
  const documentFields = useDocumentFields();
  const bankFields = useBankFields();
  const contactFields = useContactFields();
  const { postData, loading: submitting, error: submitError } = usePost();

  const { userData } = useAppState();
  console.log(userData)
  // Initialize state objects
  const initialAddressInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    addressFields.filter((field) => field.input).forEach((field) => {
      obj[field.field] = "";
    });
    return obj;
  }, [addressFields]);

  const initialBankInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    bankFields.filter((field) => field.input).forEach((field) => {
      obj[field.field] = "";
    });
    return obj;
  }, [bankFields]);

  const initialContactInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    contactFields.filter((field) => field.input).forEach((field) => {
      obj[field.field] = "";
    });
    return obj;
  }, [contactFields]);

  const initialDocumentInfo = useMemo(() => {
    const obj: DynamicFormData = {};
    documentFields.filter((field) => field.input).forEach((field) => {
      obj[field.field] = null;
    });
    return obj;
  }, [documentFields]);

  // State declarations
  const [basicInfo, setBasicInfo] = useState<DynamicFormData>({});
  const [documentInfo, setDocumentInfo] = useState<DynamicFormData>(initialDocumentInfo);
  
  // **REFACTORED: Single state arrays with primary flags**
  const [addresses, setAddresses] = useState<AddressWithPrimary[]>([
    {
      id: `address_primary_${Date.now()}`,
      isPrimary: true,
      ...initialAddressInfo
    }
  ]);

  const [bankDetails, setBankDetails] = useState<BankDetailWithPrimary[]>([
    {
      id: `bank_primary_${Date.now()}`,
      isPrimary: true,
      cancelChequeFile: null,
      ...initialBankInfo
    }
  ]);

  const [contacts, setContacts] = useState<ContactDetailWithPrimary[]>([
    {
      id: `contact_primary_${Date.now()}`,
      isPrimary: true,
      document: null,
      ...initialContactInfo
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>("");
  
  // Hierarchy state
  const [selectedCompany, setSelectedCompany] = useState<number[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<number[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);

  const { fields: hierarchyFields, loading: hierarchyLoading, error: hierarchyError } = useComDivBranchDeptFields(selectedCompany, selectedDivision);

  const basicInfoFields = useBasicInfoFields(basicInfo);

  // General change handlers
  const handleChange = (setState: React.Dispatch<React.SetStateAction<DynamicFormData>>) =>
    (field: string, value: any) => {
      setState((prev) => ({ ...prev, [field]: value }));
    };

  const handleBasicChange = handleChange(setBasicInfo);
  const handleDocumentChange = handleChange(setDocumentInfo);

  const handleHierarchyChange = (field: string, vals: (number | string)[]) => {
    switch (field) {
      case "com_sno":
        setSelectedCompany(vals.map(v => Number(v)));
        setSelectedDivision([]);
        setSelectedBranch([]);
        break;
      case "div_sno":
        setSelectedDivision(vals.map(v => Number(v)));
        setSelectedBranch([]);
        break;
      case "brn_sno":
        setSelectedBranch(vals.map(v => Number(v)));
        break;
      case "dept_sno":
        setSelectedDepartment(vals.map(String));
        break;
    }
  };

  const getHierarchyValue = (field: string) => {
    const valueMap: Record<string, any> = {
      "com_sno": selectedCompany,
      "div_sno": selectedDivision,
      "brn_sno": selectedBranch,
      "dept_sno": selectedDepartment,
    };
    return valueMap[field] || [];
  };

  // **REFACTORED: Address handlers**
  const handleAddAddress = () => {
    const newAddress: AddressWithPrimary = {
      id: `address_${Date.now()}`,
      isPrimary: false,
      ...initialAddressInfo
    };
    setAddresses((prev) => [...prev, newAddress]);
  };

  const handleRemoveAddress = (index: number) => {
    if (addresses.length === 1) {
      toast.error("At least one address is required");
      return;
    }
    if (addresses[index].isPrimary) {
      toast.error("Cannot remove primary address");
      return;
    }
    setAddresses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddressChange = (index: number, field: string, value: string) => {
    setAddresses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSetPrimaryAddress = (index: number) => {
    setAddresses((prev) => {
      return prev.map((addr, i) => ({
        ...addr,
        isPrimary: i === index
      }));
    });
    toast.success("Primary address updated");
  };

  // **REFACTORED: Bank account handlers**
  const handleAddBankDetail = () => {
    const newBankDetail: BankDetailWithPrimary = {
      id: `bank_${Date.now()}`,
      isPrimary: false,
      cancelChequeFile: null,
      ...initialBankInfo
    };
    setBankDetails((prev) => [...prev, newBankDetail]);
  };

  const handleRemoveBankDetail = (index: number) => {
    if (bankDetails.length === 1) {
      toast.error("At least one bank account is required");
      return;
    }
    if (bankDetails[index].isPrimary) {
      toast.error("Cannot remove primary bank account");
      return;
    }
    setBankDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBankDetailChange = (index: number, field: string, value: string) => {
    setBankDetails((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleBankCancelChequeChange = (index: number, file: File | null) => {
    setBankDetails((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], cancelChequeFile: file };
      return updated;
    });
  };

  const handleSetPrimaryBank = (index: number) => {
    setBankDetails((prev) => {
      return prev.map((bank, i) => ({
        ...bank,
        isPrimary: i === index
      }));
    });
    toast.success("Primary bank account updated");
  };

  // **REFACTORED: Contact handlers**
  const handleAddContact = () => {
    const newContact: ContactDetailWithPrimary = {
      id: `contact_${Date.now()}`,
      isPrimary: false,
      document: null,
      ...initialContactInfo
    };
    setContacts((prev) => [...prev, newContact]);
  };

  const handleRemoveContact = (index: number) => {
    if (contacts.length === 1) {
      toast.error("At least one contact is required");
      return;
    }
    if (contacts[index].isPrimary) {
      toast.error("Cannot remove primary contact");
      return;
    }
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: string, value: any) => {
    setContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleContactDocumentChange = (index: number, file: File | null) => {
    setContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], document: file };
      return updated;
    });
  };

  const handleSetPrimaryContact = (index: number) => {
    setContacts((prev) => {
      return prev.map((contact, i) => ({
        ...contact,
        isPrimary: i === index
      }));
    });
    toast.success("Primary contact updated");
  };

  const handleOpenModal = (section: string) => {
    setCurrentSection(section);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentSection("");
  };

  const handleModalSave = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    handleCloseModal();
  };

  const resetForm = () => {
    // setBasicInfo({});
    // setDocumentInfo(initialDocumentInfo);
    
    // // **REFACTORED: Reset to single primary items**
    // setAddresses([{
    //   id: `address_primary_${Date.now()}`,
    //   isPrimary: true,
    //   ...initialAddressInfo
    // }]);

    // setBankDetails([{
    //   id: `bank_primary_${Date.now()}`,
    //   isPrimary: true,
    //   cancelChequeFile: null,
    //   ...initialBankInfo
    // }]);

    // setContacts([{
    //   id: `contact_primary_${Date.now()}`,
    //   isPrimary: true,
    //   document: null,
    //   ...initialContactInfo
    // }]);
    
    // setSelectedCompany([]);
    // setSelectedDivision([]);
    // setSelectedBranch([]);
    // setSelectedDepartment([]);
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();

      formData.append("companyIds", JSON.stringify(selectedCompany));
      formData.append("divisionIds", JSON.stringify(selectedDivision));
      formData.append("branchIds", JSON.stringify(selectedBranch));
      formData.append("departmentIds", JSON.stringify(selectedDepartment));
      formData.append("created_by", userData[0]?.ecno ||"");
      Object.entries(basicInfo).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      // **REFACTORED: Addresses - Send all as array with isPrimary flag**
      const addressesData = addresses.map(({ id, ...address }) => ({
        id,
        ...address
      }));
      formData.append("addresses", JSON.stringify(addressesData));

      // **REFACTORED: Bank Details - Send all as array with isPrimary flag**
      const bankDetailsData = bankDetails.map(({ id, cancelChequeFile, ...bank }) => ({
        id,
        ...bank,
        hasCancelCheque: !!cancelChequeFile,
      }));
      formData.append("bankDetails", JSON.stringify(bankDetailsData));

      bankDetails.forEach((bank, index) => {
        if (bank.cancelChequeFile) {
          formData.append(`bankCancelCheque_${index}`, bank.cancelChequeFile);
        }
      });

      // **REFACTORED: Contacts - Send all as array with isPrimary flag**
      const contactsData = contacts.map(({ id, document, ...contact }) => ({
        id,
        ...contact,
        hasDocument: !!document,
      }));
      formData.append("contacts", JSON.stringify(contactsData));

      contacts.forEach((contact, index) => {
        if (contact.document) {
          formData.append(`contactDocument_${index}`, contact.document);
        }
      });

      // General Documents
      Object.entries(documentInfo).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value);
        }
      });

      const response = await postData(apiPostKycData, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response) {
        toast.success("KYC submitted successfully!");
        resetForm();
      }
    } catch (error: any) {
      console.error("KYC submission error:", error);
      toast.error(error?.message || "An error occurred while submitting KYC");
    }
  };

  const getCompletionStatus = (section: string) => {
    switch (section) {
      case "address":
        return addresses.some((addr) => 
          addressFields.some((field) => field.require && addr[field.field])
        );
      case "documents":
        return documentFields.some((field) => documentInfo[field.field]);
      case "account":
        return bankDetails.some((bank) => 
          bankFields.some((field) => field.require && bank[field.field]) && 
          bank.cancelChequeFile !== null
        );
      case "contacts":
        return contacts.some((contact) => 
          contactFields.some((field) => field.require && contact[field.field])
        );
      default:
        return false;
    }
  };

  const SectionButton = ({ title, description, icon: Icon, section }: {
    title: string; description?: string; icon: any; section: string;
  }) => {
    const isComplete = getCompletionStatus(section);

    return (
      <button
        onClick={() => handleOpenModal(section)}
        className="group relative w-full text-left overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 text-base group-hover:text-primary transition-colors">
                {title}
              </h3>
              {isComplete ? (
                <Badge className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-600 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Done
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex-shrink-0 text-xs">
                  Pending
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 flex-shrink-0" />
        </div>
      </button>
    );
  };

  const renderModalContent = () => {
    switch (currentSection) {
      case "address":
        return (
          <div className="space-y-6">
            {addresses.map((address, index) => (
              <div
                key={address.id}
                className={`relative rounded-lg border p-4 ${
                  address.isPrimary 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base flex items-center gap-2 text-gray-900">
                    <MapPin className="h-5 w-5 text-primary" />
                    {address.isPrimary ? 'Primary Address' : `Address ${index + 1}`}
                    {address.isPrimary && (
                      <Badge className="ml-2 bg-amber-500 hover:bg-amber-600">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    {!address.isPrimary && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimaryAddress(index)}
                        className="text-xs"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set as Primary
                      </Button>
                    )}
                    {!address.isPrimary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAddress(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addressFields
                    .filter((field) => field.input)
                    .map((field) => (
                      <CustomInputField
                        key={`${field.field}-${address.id}`}
                        field={`${field.field}-${address.id}`}
                        label={field.label}
                        require={field.require && address.isPrimary}
                        value={address[field.field] || ""}
                        onChange={(value) =>
                          handleAddressChange(index, field.field, value)
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
              className="w-full border-dashed hover:border-solid"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Address
            </Button>
          </div>
        );

      case "account":
        return (
          <div className="space-y-6">
            {bankDetails.map((bank, index) => (
              <div
                key={bank.id}
                className={`relative rounded-lg border p-4 ${
                  bank.isPrimary 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base flex items-center gap-2 text-gray-900">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {bank.isPrimary ? 'Primary Bank Account' : `Bank Account ${index + 1}`}
                    {bank.isPrimary && (
                      <Badge className="ml-2 bg-amber-500 hover:bg-amber-600">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    {!bank.isPrimary && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimaryBank(index)}
                        className="text-xs"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set as Primary
                      </Button>
                    )}
                    {!bank.isPrimary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBankDetail(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bankFields
                    .filter((field) => field.input)
                    .map((field) => (
                      <CustomInputField
                        key={`${field.field}-${bank.id}`}
                        field={`${field.field}-${bank.id}`}
                        label={field.label}
                        require={field.require && bank.isPrimary}
                        value={bank[field.field] || ""}
                        onChange={(value) =>
                          handleBankDetailChange(index, field.field, value)
                        }
                        placeholder={field.placeholder}
                        type={field.type}
                      />
                    ))}
                </div>

                <Separator className="my-4" />
                
                {/* Cancel Cheque */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Cancelled Cheque Leaf <span className="text-red-500">*</span>
                  </label>
                  <CustomInputField
                    field={`bank-cancel-cheque-${bank.id}`}
                    label=""
                    type="file"
                    value={bank.cancelChequeFile ?? null}
                    onChange={(fileOrNull: File | null) =>
                      handleBankCancelChequeChange(index, fileOrNull)
                    }
                  />
                  {bank.cancelChequeFile && (
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {bank.cancelChequeFile.name}
                    </p>
                  )}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddBankDetail}
              className="w-full border-dashed hover:border-solid"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Bank Account
            </Button>
          </div>
        );

      case "contacts":
        return (
          <div className="space-y-6">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className={`relative rounded-lg border p-4 ${
                  contact.isPrimary 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base flex items-center gap-2 text-gray-900">
                    <Users className="h-5 w-5 text-primary" />
                    {contact.isPrimary ? 'Primary Contact Person' : `Contact Person ${index + 1}`}
                    {contact.isPrimary && (
                      <Badge className="ml-2 bg-amber-500 hover:bg-amber-600">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    {!contact.isPrimary && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimaryContact(index)}
                        className="text-xs"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set as Primary
                      </Button>
                    )}
                    {!contact.isPrimary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveContact(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contactFields
                    .filter((field) => field.input)
                    .map((field) => (
                      <CustomInputField
                        key={`${field.field}-${contact.id}`}
                        field={`${field.field}-${contact.id}`}
                        label={field.label}
                        require={field.require && contact.isPrimary}
                        value={contact[field.field] || ""}
                        onChange={(value) =>
                          handleContactChange(index, field.field, value)
                        }
                        placeholder={field.placeholder}
                        type={field.type}
                      />
                    ))}
                </div>

                <Separator className="my-4" />
                
                {/* Document */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Supporting Document (ID Proof)
                  </label>
                  <CustomInputField
                    field={`contact-document-${contact.id}`}
                    label=""
                    type="file"
                    value={contact.document ?? null}
                    onChange={(fileOrNull: File | null) =>
                      handleContactDocumentChange(index, fileOrNull)
                    }
                  />
                  {contact.document && (
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {contact.document.name}
                    </p>
                  )}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddContact}
              className="w-full border-dashed hover:border-solid"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Contact Person
            </Button>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-6 px-4 lg:px-8">
      <div className="mx-auto space-y-6">
        {hierarchyError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="text-sm">Failed to load hierarchy data: {hierarchyError}</p>
          </div>
        )}

        {/* Basic Information Card */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl">Basic Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {hierarchyFields.map((field) => (
                <CustomInputField
                  key={field.field}
                  field={field.field}
                  label={field.label}
                  type={field.type}
                  options={field.options}
                  value={getHierarchyValue(field.field)}
                  onChange={(vals: (number | string)[]) =>
                    handleHierarchyChange(field.field, vals)
                  }
                  require={field.require}
                  disabled={field.disabled}
                  placeholder={field.placeholder}
                />
              ))}
            </div>

            {basicInfoFields.some((f) => f.input) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {basicInfoFields
                    .filter((field) => field.input)
                    .map((field) => (
                      <div key={field.field}>
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Additional Sections Grid */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Additional Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionButton
              title="Address Details"
              description="Business locations and registered addresses"
              icon={MapPin}
              section="address"
            />
            <SectionButton
              title="Bank Account"
              description="Banking information and cancelled cheque for each account"
              icon={CreditCard}
              section="account"
            />
            <SectionButton
              title="Contact Information"
              description="Owner/authorized person and additional contacts with documents"
              icon={Users}
              section="contacts"
            />
            <SectionButton
              title="Documents"
              description="Upload certificates and required documents"
              icon={Upload}
              section="documents"
            />
          </div>
        </div>

        {/* Submit Section */}
        <Card className="">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="text-center md:text-left">
                {submitError && (
                  <p className="text-sm text-red-600 mt-2">{submitError}</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="sm:w-auto"
                  disabled={submitting}
                >
                  Reset Form
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
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

      {/* Modal */}
      <DynamicDialog
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        title={getModalTitle()}
        Icon={ModalIcon}
        children={renderModalContent()}
        onSave={handleModalSave}
        onCancel={handleCloseModal}
      />
    </div>
  );
}
