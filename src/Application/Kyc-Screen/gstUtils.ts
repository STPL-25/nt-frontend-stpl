/**
 * Shared GSTN lookup helpers for the Basic Information section, used by both
 * KycEntry (staff) and SupplierKYCEntry. Extracted out of KycEntry so the
 * two forms don't fork this ~150-line parsing logic.
 */

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// A valid GSTIN embeds the holder's PAN as characters 3-12 (5 letters + 4
// digits + 1 letter), so once the GSTIN passes GSTIN_PATTERN the PAN can be
// read off directly without waiting on the lookup response.
export const derivePanFromGstin = (gstin: unknown) => {
  const gst = String(gstin ?? "").trim().toUpperCase();
  return GSTIN_PATTERN.test(gst) ? gst.slice(2, 12) : "";
};

export type UnknownRecord = Record<string, unknown>;

export type GstAddressPatch = Partial<Record<
  "door_no" | "street" | "area" | "taluk" | "city" | "state" | "state_code" | "pincode",
  string
>>;

export type GstSubmissionFields = {
  legal_name: string;
  trade_name: string;
  txp_type: string;
  gst_status: string;
  gst_blk_status: string;
  date_of_reg: string;
};

export type GstDisplayRow = {
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

export const unwrapGstRecord = (payload: unknown): UnknownRecord | null => {
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

export const getGstLegalName = (payload: unknown) => {
  return buildGstSubmissionFields(payload).legal_name;
};

export const buildGstSubmissionFields = (payload: unknown): GstSubmissionFields => {
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
    txp_type: firstText(record?.TxpType),
    gst_status: firstText(record?.Status),
    gst_blk_status: firstText(record?.BlkStatus),
    date_of_reg: firstText(record?.DtDReg),
  };
};

const humanizeGstLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const flattenGstDetails = (value: unknown, path: string[] = []): GstDisplayRow[] => {
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

export const clearGstSubmissionFields = (record: Record<string, unknown>) => {
  const next = { ...record };
  GST_BACKEND_FIELD_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
};

export const buildGstAddressPatch = (payload: unknown): GstAddressPatch => {
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
    // stcd/AddrStcd is the numeric GST state code (e.g. "33") — used above
    // only as a last-resort fallback for the state NAME when nothing better
    // is present, and captured here properly as its own field so it can be
    // saved to kyc_address_info.state_code.
    state_code: firstText(
      address?.stcd,
      address?.AddrStcd,
      address?.state_code,
      address?.stateCode
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
