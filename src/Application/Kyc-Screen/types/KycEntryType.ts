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
};
