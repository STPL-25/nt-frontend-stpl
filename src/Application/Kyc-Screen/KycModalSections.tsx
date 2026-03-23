/**
 * Shared modal section content for KYC forms.
 * Used by both KycEntry (staff) and SupplierKYCEntry.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MapPin, CreditCard, Users, Upload, Plus, CheckCircle2 } from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { PrimaryItemCard } from "@/CustomComponent/PageComponents/PrimaryItemCard";
import type { AddressWithPrimary, BankDetailWithPrimary, ContactDetailWithPrimary } from "@/hooks/useKycSections";

// ─── Address ──────────────────────────────────────────────────────────────────

interface AddressSectionProps {
  addresses: AddressWithPrimary[];
  addressFields: any[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, field: string, value: string) => void;
  onSetPrimary: (i: number) => void;
}

export function AddressModalContent({
  addresses,
  addressFields,
  onAdd,
  onRemove,
  onChange,
  onSetPrimary,
}: AddressSectionProps) {
  return (
    <div className="space-y-6">
      {addresses.map((address, index) => (
        <PrimaryItemCard
          key={address.id}
          index={index}
          isPrimary={address.isPrimary}
          icon={MapPin}
          primaryLabel="Primary Address"
          secondaryLabel="Address"
          onSetPrimary={() => onSetPrimary(index)}
          onRemove={() => onRemove(index)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addressFields
              .filter((f) => f.input)
              .map((f) => (
                <CustomInputField
                  key={`${f.field}-${address.id}`}
                  field={`${f.field}-${address.id}`}
                  label={f.label}
                  require={f.require && address.isPrimary}
                  value={address[f.field] || ""}
                  onChange={(value) => onChange(index, f.field, value)}
                  placeholder={f.placeholder}
                  type={f.type}
                />
              ))}
          </div>
        </PrimaryItemCard>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="w-full border-dashed hover:border-solid"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Address
      </Button>
    </div>
  );
}

// ─── Bank ─────────────────────────────────────────────────────────────────────

interface BankSectionProps {
  bankDetails: BankDetailWithPrimary[];
  bankFields: any[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, field: string, value: string) => void;
  onSetPrimary: (i: number) => void;
  onChequeChange: (i: number, file: File | null) => void;
}

export function BankModalContent({
  bankDetails,
  bankFields,
  onAdd,
  onRemove,
  onChange,
  onSetPrimary,
  onChequeChange,
}: BankSectionProps) {
  return (
    <div className="space-y-6">
      {bankDetails.map((bank, index) => (
        <PrimaryItemCard
          key={bank.id}
          index={index}
          isPrimary={bank.isPrimary}
          icon={CreditCard}
          primaryLabel="Primary Bank Account"
          secondaryLabel="Bank Account"
          onSetPrimary={() => onSetPrimary(index)}
          onRemove={() => onRemove(index)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bankFields
              .filter((f) => f.input)
              .map((f) => (
                <CustomInputField
                  key={`${f.field}-${bank.id}`}
                  field={`${f.field}-${bank.id}`}
                  label={f.label}
                  require={f.require && bank.isPrimary}
                  value={bank[f.field] || ""}
                  onChange={(value) => onChange(index, f.field, value)}
                  placeholder={f.placeholder}
                  type={f.type}
                />
              ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Cancelled Cheque Leaf <span className="text-destructive">*</span>
            </label>
            <CustomInputField
              field={`bank-cancel-cheque-${bank.id}`}
              label=""
              type="file"
              value={bank.cancelChequeFile ?? null}
              onChange={(file: File | null) => onChequeChange(index, file)}
            />
            {bank.cancelChequeFile instanceof File && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                {bank.cancelChequeFile.name}
              </p>
            )}
          </div>
        </PrimaryItemCard>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="w-full border-dashed hover:border-solid"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Bank Account
      </Button>
    </div>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

interface ContactSectionProps {
  contacts: ContactDetailWithPrimary[];
  contactFields: any[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, field: string, value: any) => void;
  onSetPrimary: (i: number) => void;
  onDocumentChange: (i: number, file: File | null) => void;
  documentLabel?: string;
}

export function ContactModalContent({
  contacts,
  contactFields,
  onAdd,
  onRemove,
  onChange,
  onSetPrimary,
  onDocumentChange,
  documentLabel = "Supporting Document (ID Proof)",
}: ContactSectionProps) {
  return (
    <div className="space-y-6">
      {contacts.map((contact, index) => (
        <PrimaryItemCard
          key={contact.id}
          index={index}
          isPrimary={contact.isPrimary}
          icon={Users}
          primaryLabel="Primary Contact"
          secondaryLabel="Contact"
          onSetPrimary={() => onSetPrimary(index)}
          onRemove={() => onRemove(index)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contactFields
              .filter((f) => f.input)
              .map((f) => (
                <CustomInputField
                  key={`${f.field}-${contact.id}`}
                  field={`${f.field}-${contact.id}`}
                  label={f.label}
                  require={f.require && contact.isPrimary}
                  value={contact[f.field] || ""}
                  onChange={(value) => onChange(index, f.field, value)}
                  placeholder={f.placeholder}
                  type={f.type}
                />
              ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              {documentLabel}
            </label>
            <CustomInputField
              field={`contact-document-${contact.id}`}
              label=""
              type="file"
              value={contact.document ?? null}
              onChange={(file: File | null) => onDocumentChange(index, file)}
            />
            {contact.document && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                {contact.document.name}
              </p>
            )}
          </div>
        </PrimaryItemCard>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="w-full border-dashed hover:border-solid"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Contact
      </Button>
    </div>
  );
}

// ─── Documents ────────────────────────────────────────────────────────────────

interface DocumentSectionProps {
  documentFields: any[];
  documentInfo: Record<string, any>;
  onChange: (field: string, file: File | null) => void;
}

export function DocumentModalContent({
  documentFields,
  documentInfo,
  onChange,
}: DocumentSectionProps) {
  return (
    <div className="space-y-4">
      {documentFields
        .filter((f) => f.input)
        .map((f) => (
          <CustomInputField
            key={f.field}
            field={f.field}
            label={f.label}
            require={f.require}
            type="file"
            value={documentInfo[f.field] ?? null}
            onChange={(file: File | null) => onChange(f.field, file)}
          />
        ))}
    </div>
  );
}
