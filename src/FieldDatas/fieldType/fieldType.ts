export interface OptionType {
  value: string | number;
  label: string;
}

export type FieldInputType = "text" | "number" | "select" | "date" | "email" | "textarea" | "checkbox" | "radio" | "file";

export interface FieldType {
  field: string;
  label: string;
  require?: boolean;
  view?: boolean;
  type: FieldInputType;
  input?: boolean;
  placeholder?: string;
  options?: OptionType[] | any[];
  defaultValue?: any;
}
