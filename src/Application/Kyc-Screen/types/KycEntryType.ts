export type DynamicFormData = Record<string, any>;
export type AdditionalAddress = Record<string, string>;
export type BankDetail = Record<string, string> & { 
  id: string; 
  cancelChequeFile?: File | null; 
};
export type ContactDetail = Record<string, any> & { 
  id: string; 
  document?: File | null; 
};
export type Option = { label: string; value: string | number };

export type Branch = {
  brn_sno: number;
  brn_name: string;
};

export type Division = {
  division_id: number;
  div_sno: number;
  div_name: string;
  branches: Branch[];
};

export type Company = {
  com_sno: number;
  com_name: string;
  divisions: Division[];
};

// One real company -> division -> branch -> department chain that this KYC record is
// linked to. A record can have several of these (e.g. a supplier serving two
// companies), but each one is a fully-specified, unambiguous path — never independently
// selected IDs that get paired up (or cross-joined) later.
export type OrgMapping = {
  com_sno: number;
  div_sno: number;
  brn_sno: number;
  dept_sno: number;
  is_primary: boolean;
  // Display-only labels, kept alongside the IDs so the "added mappings" list doesn't
  // need to re-look them up.
  com_name: string;
  div_name: string;
  brn_name: string;
  dept_name: string;
};
