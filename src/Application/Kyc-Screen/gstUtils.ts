/**
 * Shared GSTN lookup helpers for the Basic Information section, used by both
 * KycEntry (staff) and SupplierKYCEntry. Extracted out of KycEntry so the
 * two forms don't fork this ~150-line parsing logic.
 */
import axios from "axios";
import { apiFetchCommonMaster } from "@/Services/Api";

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
  "door_no" | "street" | "area" | "taluk" | "city" | "state" | "state_code" | "pincode" | "location_link",
  string
>>;

export type GstSubmissionFields = {
  legal_name: string;
  trade_name: string;
  txp_type: string;
  constitution_of_business: string;
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
  "constitution_of_business",
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
      record?.legal_name_of_business,
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
      record?.trade_name_of_business,
      record?.tradeName,
      record?.trade_name,
      record?.tradeNam,
      record?.tradenm
    ),
    txp_type: firstText(record?.TxpType, record?.taxpayer_type, record?.dty),
    constitution_of_business: firstText(
      record?.constitution_of_business,
      record?.ConstitutionOfBusiness,
      record?.ctb
    ),
    gst_status: firstText(record?.Status, record?.gst_in_status, record?.sts),
    gst_blk_status: firstText(record?.BlkStatus),
    date_of_reg: firstText(
      record?.DtReg,
      record?.dtReg,
      record?.date_of_reg,
      record?.rgdt
    ),
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

// Google Maps link from the coordinates GST returns; empty when either is
// missing or not a real number (the API sends "" for most addresses).
export const buildGoogleMapsUrl = (lat: unknown, lng: unknown) => {
  const latText = toText(lat);
  const lngText = toText(lng);
  const latitude = Number(latText);
  const longitude = Number(lngText);
  if (!latText || !lngText || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
  if (latitude === 0 && longitude === 0) return "";
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};

export const isGstActive = (status: unknown) => /^active$/i.test(toText(status));

const addressToPatch = (address: UnknownRecord | null): GstAddressPatch => {
  const patch: GstAddressPatch = {
    door_no: joinText(
      address?.flno,
      address?.flat_number,
      address?.building_number,
      address?.AddrFlno,
      address?.floor_no,
      address?.bno,
      address?.AddrBno,
      address?.door_no,
      address?.building_no,
      address?.bnm,
      address?.AddrBnm
    ),
    street: firstText(
      address?.st,
      address?.AddrSt,
      address?.street,
      address?.street_name
    ),
    area: firstText(
      address?.loc,
      address?.location,
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
      address?.state_name,
      address?.StateCode
    ),
    // stcd/AddrStcd/StateCode is the numeric GST state code (e.g. "33") —
    // used above only as a last-resort fallback for the state NAME when
    // nothing better is present, and captured here properly as its own
    // field so it can be saved to kyc_address_info.state_code.
    state_code: firstText(
      address?.stcd,
      address?.AddrStcd,
      address?.state_code,
      address?.stateCode,
      address?.StateCode
    ),
    pincode: firstText(
      address?.pncd,
      address?.AddrPncd,
      address?.pincode,
      address?.pinCode,
      address?.postal_code
    ),
    location_link: buildGoogleMapsUrl(
      firstText(address?.latitude, address?.lat, address?.Latitude),
      firstText(address?.longitude, address?.lng, address?.lg, address?.Longitude)
    ),
  };

  // kyc_address_info column widths (sql/106): door_no 300, other text 200, pincode 10.
  const buildingName = firstText(address?.building_name, address?.bnm, address?.AddrBnm);
  if (buildingName) patch.door_no = joinText(buildingName, patch.door_no);
  const clamped = Object.entries(patch).map(([key, value]) => [
    key,
    key === "location_link"
      ? value
      : String(value ?? "").slice(0, key === "pincode" ? 10 : key === "door_no" ? 300 : 200),
  ]);
  return Object.fromEntries(clamped.filter(([, value]) => Boolean(value))) as GstAddressPatch;
};

export const buildGstAddressPatch = (payload: unknown): GstAddressPatch => {
  const record = unwrapGstRecord(payload);
  // Prefer the raw split address so latitude/longitude survive; fall back to
  // the legacy pradr.addr shape.
  return addressToPatch(
    getRecord(record, "principal_place_split_address") ?? getGstAddressRecord(record)
  );
};

// "Additional places of business" — an array of { address, split_address }.
export const buildGstAdditionalAddressPatches = (payload: unknown): GstAddressPatch[] => {
  const record = unwrapGstRecord(payload);
  const list = record?.additional_address_array ?? record?.adadr;
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      const entryRecord = asRecord(entry);
      return addressToPatch(
        getRecord(entryRecord, "split_address") ?? getRecord(entryRecord, "addr") ?? entryRecord
      );
    })
    .filter((patch) => Object.keys(patch).length > 0);
};

export type GstStateMasterRow = {
  gst_code?: unknown;
  gst_state_un_name?: unknown;
};

// Picks the Business Type master option matching the GST "constitution of
// business" (e.g. "Private Limited" -> "Private Limited Company").
export const matchBusinessTypeValue = (
  constitution: string,
  options: { label: string; value: string | number }[] | string | undefined
): string => {
  if (!constitution || !Array.isArray(options)) return "";
  const norm = (v: unknown) => toText(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const target = norm(constitution);
  const hit =
    options.find((o) => norm(o.label) === target) ??
    options.find((o) => norm(o.label).includes(target) || target.includes(norm(o.label)));
  return hit ? String(hit.value) : "";
};

let gstStateMasterCache: GstStateMasterRow[] | null = null;
let gstStateMasterPromise: Promise<GstStateMasterRow[]> | null = null;

// GST State Code master (numeric state code -> state/UT name), maintained
// under Masters as "GSTStateCodeMaster". Some GST lookup providers only
// return the numeric StateCode, not the name, so this resolves it. Static
// reference data — fetched once per session and cached in module scope.
// The anonymous /supplier_kyc page must pass `publicUrl` (the staff route 401s
// without a session, which also flags the session as expired).
export const fetchGstStateMaster = async (publicUrl?: string): Promise<GstStateMasterRow[]> => {
  if (gstStateMasterCache) return gstStateMasterCache;
  if (!gstStateMasterPromise) {
    gstStateMasterPromise = axios
      .get(publicUrl ?? `${apiFetchCommonMaster}GSTStateCodeMaster`)
      .then((res) => {
        const rows = (res.data?.data ?? []) as GstStateMasterRow[];
        gstStateMasterCache = rows;
        return rows;
      })
      .catch(() => [])
      .finally(() => {
        gstStateMasterPromise = null;
      });
  }
  return gstStateMasterPromise;
};

export const resolveGstStateName = (
  stateCode: string,
  masterList: GstStateMasterRow[] | null | undefined
): string => {
  if (!stateCode || !Array.isArray(masterList)) return "";
  const match = masterList.find((row) => toText(row?.gst_code) === stateCode);
  return match ? toText(match?.gst_state_un_name) : "";
};

// GST returns the state name for every address, but only the principal place
// has a code (the GSTIN prefix). Fill whichever of name/code is missing.
export const completeGstAddressState = (
  patch: GstAddressPatch,
  masterList: GstStateMasterRow[] | null | undefined
): GstAddressPatch => {
  const next = { ...patch };
  if (next.state_code) {
    const resolved = resolveGstStateName(next.state_code, masterList);
    if (resolved) next.state = resolved;
  } else if (next.state && Array.isArray(masterList)) {
    const name = next.state.toLowerCase();
    const match = masterList.find((row) => toText(row?.gst_state_un_name).toLowerCase() === name);
    if (match) next.state_code = toText(match.gst_code);
  }
  return next;
};
