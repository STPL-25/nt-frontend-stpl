/**
 * Shared modal section content for KYC forms.
 * Used by both KycEntry (staff) and SupplierKYCEntry.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MapPin, CreditCard, Users, Upload, Plus, CheckCircle2, Loader2 } from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { PrimaryItemCard } from "@/CustomComponent/PageComponents/PrimaryItemCard";
import type { AddressWithPrimary, BankDetailWithPrimary, ContactDetailWithPrimary } from "@/hooks/useKycSections";
import { IFSC_DERIVED_BANK_FIELDS } from "./ifscUtils";
import { ActiveNote } from "./cashfreeVerify";

// ─── Address ──────────────────────────────────────────────────────────────────

interface AddressSectionProps {
  addresses: AddressWithPrimary[];
  addressFields: any[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, field: string, value: string) => void;
  onSetPrimary: (i: number) => void;
  /** address.id whose pincode lookup is in flight, if any */
  fetchingPincodeId?: string | null;
}

export function AddressModalContent({
  addresses,
  addressFields,
  onAdd,
  onRemove,
  onChange,
  onSetPrimary,
  fetchingPincodeId = null,
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
              .map((f) => {
                const isFetchingThisPincode = f.field === "pincode" && fetchingPincodeId === address.id;
                return (
                  <div key={`${f.field}-${address.id}`} className="relative">
                    <CustomInputField
                      field={`${f.field}-${address.id}`}
                      label={f.label}
                      require={f.require && address.isPrimary}
                      value={address[f.field] || ""}
                      onChange={(value) => onChange(index, f.field, value)}
                      placeholder={f.placeholder}
                      type={f.type}
                      disabled={isFetchingThisPincode}
                    />
                    {isFetchingThisPincode && (
                      <Loader2 className="absolute right-2 top-9 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                );
              })}
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
  /** bank.id of the account whose IFSC lookup is in flight, if any */
  fetchingIfscId?: string | null;
  /** bank.id -> account confirmed active by the bank verification */
  activeBankIds?: Record<string, boolean>;
  /**
   * Optional "pay via the supplier's website" mode (public supplier KYC only).
   * Omit `onPayModeChange` and the section behaves exactly as before.
   */
  payViaPortal?: boolean;
  onPayModeChange?: (viaPortal: boolean) => void;
  portal?: PortalPayment;
  onPortalChange?: (field: keyof PortalPayment, value: string) => void;
}

export interface PortalPayment {
  payment_portal_name: string;
  payment_portal_url: string;
  payment_instructions: string;
}

export const EMPTY_PORTAL: PortalPayment = { payment_portal_name: "", payment_portal_url: "", payment_instructions: "" };

/** Bank account vs. "we are paid on our own website" — a required choice at the top of the Bank section. */
function PayModeChooser({ viaPortal, onChange }: { viaPortal: boolean; onChange: (v: boolean) => void }) {
  const opts = [
    { value: false, title: "Bank transfer", hint: "We receive payment in our bank account" },
    { value: true, title: "Our website / portal", hint: "Payment is made on our own website — no bank account details" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="How should we pay you?">
      {opts.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={viaPortal === o.value}
          onClick={() => onChange(o.value)}
          className={`text-left rounded-lg border p-3 transition-colors ${
            viaPortal === o.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
          }`}
        >
          <p className="text-sm font-medium">{o.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{o.hint}</p>
        </button>
      ))}
    </div>
  );
}

export function BankModalContent({
  bankDetails,
  bankFields,
  onAdd,
  onRemove,
  onChange,
  onSetPrimary,
  onChequeChange,
  fetchingIfscId = null,
  activeBankIds = {},
  payViaPortal = false,
  onPayModeChange,
  portal = EMPTY_PORTAL,
  onPortalChange,
}: BankSectionProps) {
  const chooser = onPayModeChange ? <PayModeChooser viaPortal={payViaPortal} onChange={onPayModeChange} /> : null;

  if (payViaPortal && onPortalChange) {
    return (
      <div className="space-y-6">
        {chooser}
        <div className="rounded-lg border p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            No bank account or cancelled cheque is needed. Tell us where we make the payment.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomInputField field="payment_portal_name" label="Portal / Website Name" require
              value={portal.payment_portal_name} onChange={(v) => onPortalChange("payment_portal_name", v)}
              placeholder="e.g. Acme Corp Vendor Payments" type="text" />
            <CustomInputField field="payment_portal_url" label="Portal URL" require
              value={portal.payment_portal_url} onChange={(v) => onPortalChange("payment_portal_url", v)}
              placeholder="https://pay.example.com" type="text" />
          </div>
          <CustomInputField field="payment_instructions" label="Payment Instructions (optional)"
            value={portal.payment_instructions} onChange={(v) => onPortalChange("payment_instructions", v)}
            placeholder="e.g. Pay with the invoice number as reference" type="text" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {chooser}
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
              .map((f) => {
                const isFetchingThisIfsc = f.field === "ifsc" && fetchingIfscId === bank.id;
                // Auto-filled from the IFSC lookup — locked so values can't drift from the looked-up branch
                const isIfscDerived = IFSC_DERIVED_BANK_FIELDS.includes(f.field);
                return (
                  <div key={`${f.field}-${bank.id}`} className="relative">
                    <CustomInputField
                      field={`${f.field}-${bank.id}`}
                      label={f.label}
                      require={f.require && bank.isPrimary}
                      value={bank[f.field] || ""}
                      onChange={(value) => onChange(index, f.field, value)}
                      placeholder={f.placeholder}
                      type={f.type}
                      options={f.options}
                      disabled={isFetchingThisIfsc || isIfscDerived}
                    />
                    {isFetchingThisIfsc && (
                      <Loader2 className="absolute right-2 top-9 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {f.field === "ac_number" && activeBankIds[bank.id] && <ActiveNote label="Account" />}
                  </div>
                );
              })}
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
