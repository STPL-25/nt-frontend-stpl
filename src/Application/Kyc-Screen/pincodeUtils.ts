/**
 * Shared pincode lookup helpers for the Address section, used by both
 * KycEntry (staff) and SupplierKYCEntry.
 */

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export type PincodeAddressPatch = Partial<Record<"area" | "taluk" | "city" | "state", string>>;

const toText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const firstText = (...values: unknown[]) =>
  values.map(toText).find(Boolean) || "";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export const buildPincodeAddressPatch = (payload: unknown): PincodeAddressPatch => {
  const root = asRecord(Array.isArray(payload) ? payload[0] : payload);
  const postOffices = Array.isArray(root?.PostOffice) ? root.PostOffice : [];
  const office = asRecord(postOffices[0]);

  if (root?.Status !== "Success" || !office) return {};

  const patch: PincodeAddressPatch = {
    area: firstText(office.Name),
    taluk: firstText(office.Block, office.Division),
    city: firstText(office.District),
    state: firstText(office.State),
  };

  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => Boolean(value))
  ) as PincodeAddressPatch;
};
