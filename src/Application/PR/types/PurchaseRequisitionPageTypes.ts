export interface RequisitionItem {
  id: string;
  itemDescription: string;
  specification: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  totalCost: number;
  remarks: string;
}


export interface FormErrors {
  [key: string]: string;
}

export interface FieldConfig {
  field: string;
  label: string;
  type: string;
  require?: boolean;
  input?: boolean;
  options?: any;
  defaultValue?: any;
}