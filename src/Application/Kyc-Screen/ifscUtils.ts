/**
 * Shared IFSC lookup helpers for the Bank Account section, used by both
 * KycEntry (staff) and SupplierKYCEntry.
 */

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export type IfscBankPatch = Partial<Record<
  "bank_name" | "bank_branch_name" | "bank_address",
  string
>>;

const toText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const firstText = (...values: unknown[]) =>
  values.map(toText).find(Boolean) || "";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export const buildIfscBankPatch = (payload: unknown): IfscBankPatch => {
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

// Fields auto-populated by the IFSC lookup — locked to prevent values that
// don't match the looked-up bank/branch.
export const IFSC_DERIVED_BANK_FIELDS = ["bank_name", "bank_branch_name", "bank_address"] as const;

export const getErrorMessage = (error: unknown, fallback: string) => {
  const requestError = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };

  return requestError.response?.data?.error ||
    requestError.response?.data?.message ||
    requestError.message ||
    fallback;
};
