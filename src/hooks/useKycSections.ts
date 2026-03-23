import { useState, useMemo } from "react";
import { toast } from "sonner";

export interface AddressWithPrimary {
  id: string;
  isPrimary: boolean;
  [key: string]: any;
}

export interface BankDetailWithPrimary {
  id: string;
  isPrimary: boolean;
  cancelChequeFile: File | null;
  [key: string]: any;
}

export interface ContactDetailWithPrimary {
  id: string;
  isPrimary: boolean;
  document: File | null;
  [key: string]: any;
}

type FieldDef = { field: string; input?: boolean; require?: boolean };

export function useKycSections(
  addressFields: FieldDef[],
  bankFields: FieldDef[],
  contactFields: FieldDef[],
  documentFields: FieldDef[]
) {
  const initialAddressInfo = useMemo(() => {
    const obj: Record<string, any> = {};
    addressFields.filter((f) => f.input).forEach((f) => (obj[f.field] = ""));
    return obj;
  }, [addressFields]);

  const initialBankInfo = useMemo(() => {
    const obj: Record<string, any> = {};
    bankFields.filter((f) => f.input).forEach((f) => (obj[f.field] = ""));
    return obj;
  }, [bankFields]);

  const initialContactInfo = useMemo(() => {
    const obj: Record<string, any> = {};
    contactFields.filter((f) => f.input).forEach((f) => (obj[f.field] = ""));
    return obj;
  }, [contactFields]);

  const initialDocumentInfo = useMemo(() => {
    const obj: Record<string, any> = {};
    documentFields.filter((f) => f.input).forEach((f) => (obj[f.field] = null));
    return obj;
  }, [documentFields]);

  const [addresses, setAddresses] = useState<AddressWithPrimary[]>([
    { id: `address_primary_${Date.now()}`, isPrimary: true, ...initialAddressInfo },
  ]);

  const [bankDetails, setBankDetails] = useState<BankDetailWithPrimary[]>([
    { id: `bank_primary_${Date.now()}`, isPrimary: true, cancelChequeFile: null, ...initialBankInfo },
  ]);

  const [contacts, setContacts] = useState<ContactDetailWithPrimary[]>([
    { id: `contact_primary_${Date.now()}`, isPrimary: true, document: null, ...initialContactInfo },
  ]);

  const [documentInfo, setDocumentInfo] = useState<Record<string, any>>(initialDocumentInfo);

  // ── Address ──────────────────────────────────────────────────────────────
  const addAddress = () =>
    setAddresses((prev) => [
      ...prev,
      { id: `address_${Date.now()}`, isPrimary: false, ...initialAddressInfo },
    ]);

  const removeAddress = (index: number) => {
    if (addresses.length === 1) return void toast.error("At least one address is required");
    if (addresses[index].isPrimary) return void toast.error("Cannot remove primary address");
    setAddresses((prev) => prev.filter((_, i) => i !== index));
  };

  const changeAddress = (index: number, field: string, value: string) =>
    setAddresses((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });

  const setPrimaryAddress = (index: number) => {
    setAddresses((prev) => prev.map((a, i) => ({ ...a, isPrimary: i === index })));
    toast.success("Primary address updated");
  };

  // ── Bank ─────────────────────────────────────────────────────────────────
  const addBank = () =>
    setBankDetails((prev) => [
      ...prev,
      { id: `bank_${Date.now()}`, isPrimary: false, cancelChequeFile: null, ...initialBankInfo },
    ]);

  const removeBank = (index: number) => {
    if (bankDetails.length === 1) return void toast.error("At least one bank account is required");
    if (bankDetails[index].isPrimary) return void toast.error("Cannot remove primary bank account");
    setBankDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const changeBank = (index: number, field: string, value: string) =>
    setBankDetails((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });

  const changeBankCheque = (index: number, file: File | null) =>
    setBankDetails((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], cancelChequeFile: file };
      return u;
    });

  const setPrimaryBank = (index: number) => {
    setBankDetails((prev) => prev.map((b, i) => ({ ...b, isPrimary: i === index })));
    toast.success("Primary bank account updated");
  };

  // ── Contact ──────────────────────────────────────────────────────────────
  const addContact = () =>
    setContacts((prev) => [
      ...prev,
      { id: `contact_${Date.now()}`, isPrimary: false, document: null, ...initialContactInfo },
    ]);

  const removeContact = (index: number) => {
    if (contacts.length === 1) return void toast.error("At least one contact is required");
    if (contacts[index].isPrimary) return void toast.error("Cannot remove primary contact");
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const changeContact = (index: number, field: string, value: any) =>
    setContacts((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });

  const changeContactDocument = (index: number, file: File | null) =>
    setContacts((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], document: file };
      return u;
    });

  const setPrimaryContact = (index: number) => {
    setContacts((prev) => prev.map((c, i) => ({ ...c, isPrimary: i === index })));
    toast.success("Primary contact updated");
  };

  // ── Document ─────────────────────────────────────────────────────────────
  const changeDocument = (field: string, value: any) =>
    setDocumentInfo((prev) => ({ ...prev, [field]: value }));

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetSections = () => {
    setAddresses([{ id: `address_primary_${Date.now()}`, isPrimary: true, ...initialAddressInfo }]);
    setBankDetails([{ id: `bank_primary_${Date.now()}`, isPrimary: true, cancelChequeFile: null, ...initialBankInfo }]);
    setContacts([{ id: `contact_primary_${Date.now()}`, isPrimary: true, document: null, ...initialContactInfo }]);
    setDocumentInfo(initialDocumentInfo);
  };

  // ── Completion checks ─────────────────────────────────────────────────────
  const getCompletionStatus = (section: string): boolean => {
    switch (section) {
      case "address":
        return addresses.some((a) => addressFields.some((f) => f.require && a[f.field]));
      case "documents":
        return documentFields.some((f) => documentInfo[f.field]);
      case "account":
        return bankDetails.some(
          (b) => bankFields.some((f) => f.require && b[f.field]) && b.cancelChequeFile !== null
        );
      case "contacts":
        return contacts.some((c) => contactFields.some((f) => f.require && c[f.field]));
      default:
        return false;
    }
  };

  return {
    // state
    addresses,
    bankDetails,
    contacts,
    documentInfo,
    initialAddressInfo,
    initialBankInfo,
    initialContactInfo,
    initialDocumentInfo,
    // address
    addAddress,
    removeAddress,
    changeAddress,
    setPrimaryAddress,
    // bank
    addBank,
    removeBank,
    changeBank,
    changeBankCheque,
    setPrimaryBank,
    // contact
    addContact,
    removeContact,
    changeContact,
    changeContactDocument,
    setPrimaryContact,
    // document
    changeDocument,
    // utils
    resetSections,
    getCompletionStatus,
  };
}
