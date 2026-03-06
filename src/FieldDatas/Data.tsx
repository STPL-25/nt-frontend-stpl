import React, { ReactElement, useMemo } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
import {  Building, MapPin, FileCheck, IndianRupee, Package, FolderOpen,
  Receipt,CreditCard, Calendar, Truck, Hash,PiggyBank, UserPlus,Menu,
  CheckCircle, Gift, FileText, Archive, Settings, Briefcase, Tag, TrendingUp,  Wallet,} from "lucide-react";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
/* ---------- Types ---------- */

export interface OptionType {
  value: string | number;
  label: string;
}

export type FieldInputType = "text" | "number" | "select"| "date" | "email" | "textarea"|"checkbox";

export interface FieldType {
  field: string;
  label: string;
  require?: boolean;
  view?: boolean;
  type: FieldInputType;
  input?: boolean;
  placeholder?: string;
  options?: OptionType[] | any[]; // you can tighten this later
}

/* ---------- Master Items (with typed icons) ---------- */

export interface MasterItemType {
  icon: ReactElement;
  name: string;
  category: string;
  color: string;
  id: string;
}

const masterItems: MasterItemType[] = [
  { icon: <Building className="w-5 h-5" />, name: "Company Master", category: "organization", color: "bg-blue-500", id: "CompanyMaster" },
  { icon: <Briefcase className="w-5 h-5" />, name: "Division Master", category: "organization", color: "bg-green-500", id: "DivisionMaster" },
  { icon: <MapPin className="w-5 h-5" />, name: "Branch Master", category: "organization", color: "bg-purple-500", id: "BranchMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "UOM", category: "inventory", color: "bg-green-600", id: "UomMaster" },
  { icon: <Calendar className="w-5 h-5" />, name: "Acc Year", category: "finance", color: "bg-slate-500", id: "AcYearMaster" },
  { icon: <Archive className="w-5 h-5" />, name: "Department Master", category: "organization", color: "bg-blue-600", id: "DeptMaster" },
  { icon: <Receipt className="w-5 h-5" />, name: "GST State Code", category: "finance", color: "bg-rose-500", id: "GSTStateCodeMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "Prefix Master", category: "administration", color: "bg-stone-500", id: "PrefixMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "Screen Master", category: "administration", color: "bg-stone-500", id: "ScreenMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "Screen Permission", category: "administration", color: "bg-stone-500", id: "ScreenPermission" },
  { icon: <TrendingUp className="w-5 h-5" />, name: "Priority Master", category: "finance", color: "bg-emerald-600", id: "PriorityMaster" },
  { icon: <FileCheck className="w-5 h-5" />, name: "PO Approval", category: "approvals", color: "bg-orange-500", id: "POApproval" },
  { icon: <IndianRupee className="w-5 h-5" />, name: "Ledger Master", category: "finance", color: "bg-emerald-500", id: "ledger_master" },
  { icon: <FolderOpen className="w-5 h-5" />, name: "Product Category", category: "inventory", color: "bg-yellow-500", id: "ProductCategoryMaster" },
  { icon: <Package className="w-5 h-5" />, name: "Product", category: "inventory", color: "bg-indigo-500", id: "ProductMaster" },
  { icon: <FileText className="w-5 h-5" />, name: "KYC", category: "compliance", color: "bg-teal-500", id: "kyc_master" },
  { icon: <Tag className="w-5 h-5" />, name: "Product Rate and Discount", category: "inventory", color: "bg-cyan-500", id: "product_rate_discount" },
  { icon: <UserPlus className="w-5 h-5" />, name: "User Creation", category: "administration", color: "bg-violet-500", id: "user_creation" },
  { icon: <Menu className="w-5 h-5" />, name: "Menu Creation", category: "administration", color: "bg-amber-500", id: "menu_creation" },
  { icon: <CheckCircle className="w-5 h-5" />, name: "Payment Approval", category: "approvals", color: "bg-lime-500", id: "payment_approval" },
  { icon: <CreditCard className="w-5 h-5" />, name: "Payment Type", category: "finance", color: "bg-pink-500", id: "payment_type" },
  { icon: <Gift className="w-5 h-5" />, name: "Customer Gift", category: "customer", color: "bg-fuchsia-500", id: "customer_gift" },
  { icon: <FileText className="w-5 h-5" />, name: "Approval Footer", category: "approvals", color: "bg-sky-500", id: "approval_footer" },
  { icon: <Settings className="w-5 h-5" />, name: "Request Type", category: "administration", color: "bg-yellow-600", id: "request_type" },
  { icon: <Truck className="w-5 h-5" />, name: "Vehicle Master", category: "logistics", color: "bg-red-600", id: "vehicle_master" },
  { icon: <PiggyBank className="w-5 h-5" />, name: "Dept Budget", category: "finance", color: "bg-emerald-600", id: "dept_budget" },
];



/* ---------- Hooks returning typed FieldType[] ---------- */

const useCompanyMasterFields = (): FieldType[] => {
  const { formData } = useAppState();
  console.log(formData)
  return useMemo<FieldType[]>(
    () => [
      { field: "com_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "com_name", label: "Company Name", require: true, view: true, type: "text", input: true },
      { field: "com_prefix", label: "Prefix", require: false, view: true, type: "text", input: true },
      { field: "add_pan", label: "Pan No", require: true, view: true, type: "text", input: true },
      { field: "is_gst_applicable", label: "Gst Applicable", require: true, view: true, type: "select",  options: [
          { value: "Y", label: "Yes" },
          { value: "N", label: "No" },
        ],
        input: true,
      },
      {
        field: "add_gst",
        label: "Gst No",
        require: true,
        view: true,
        type: "text",
        input: formData?.is_gst_applicable === "N" ? false : true,
      },
      { field: "add_tan", label: "Tan No", require: true, view: true, type: "text", input: true },
      { field: "add_cin", label: "Cin No", require: true, view: true, type: "text", input: true },
      { field: "add_door_no", label: "Door No", require: false, view: true, type: "text", input: true },
      { field: "add_street", label: "Street", require: false, view: true, type: "text", input: true },
      { field: "add_city", label: "City", require: true, view: true, type: "text", input: true },
      { field: "add_state", label: "State", require: true, view: true, type: "text", input: true },
      { field: "add_state_code", label: "State Code", require: true, view: true, type: "text", input: true },
      { field: "add_pin_code", label: "Pincode", require: true, view: true, type: "text", input: true },
      { field: "add_reg_door_no", label: "Reg Door No", require: true, view: true, type: "text", input: true },
      { field: "add_reg_street", label: "Reg Street", require: true, view: true, type: "text", input: true },
      { field: "add_reg_city", label: "Reg City", require: true, view: false, type: "text", input: true },
      { field: "add_reg_state", label: "Reg State", require: true, view: false, type: "text", input: true },
      { field: "add_reg_pincode", label: "Reg Pincode", require: true, view: false, type: "text", input: true },
    ],
    [formData?.is_gst_applicable]
  );
};

const useDivisionMasterFields = (formData?: any): FieldType[] => {
  const { companyDetails } = useAppState();

  return useMemo<FieldType[]>(
    () => [
      { field: "div_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "div_name", label: "Division Name", require: true, view: true, type: "text", input: true },
      { field: "div_prefix", label: "Division Prefix", require: true, view: true, type: "text", input: true },
      { field: "div_type", label: "Division Category", require: true, view: true, type: "text", input: true },
      { field: "com_sno", label: "Company Name", require: true, view: false, type: "select", options: companyDetails || [], input: true },
      { field: "com_name", label: "Company Name", require: true, view: true, type: "text", input: false },
      { field: "com_prefix", label: "Prefix", require: false, view: true, type: "text", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [companyDetails]
  );
};

const useBranchMasterFields = (formData?: any): FieldType[] => {
  const { companyDetails, divDetails } = useAppState();

  return useMemo<FieldType[]>(
    () => [
      { field: "brn_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "com_sno", label: "Company Name", require: true, view: false, type: "select", options: companyDetails || [], input: true },
      { field: "div_sno", label: "Division Name", require: true, view: false, type: "select", options: divDetails || [], input: true },
      { field: "com_name", label: "Company Name", require: true, view: true, type: "select", options: companyDetails || [], input: false },
      { field: "div_name", label: "Division Name", require: true, view: true, type: "select", options: divDetails || [], input: false },
      { field: "brn_name", label: "Branch Name", require: true, view: true, type: "text", input: true },
      { field: "brn_prefix", label: "Branch Prefix", require: true, view: true, type: "text", input: true },
      { field: "add_door_no", label: "Door No", require: false, view: true, type: "text", input: true },
      { field: "add_street", label: "Street", require: false, view: true, type: "text", input: true },
      { field: "add_city", label: "City", require: true, view: true, type: "text", input: true },
      { field: "add_state", label: "State", require: true, view: true, type: "text", input: true },
      { field: "add_state_code", label: "State Code", require: true, view: true, type: "text", input: true },
      { field: "add_pin_code", label: "Pincode", require: true, view: true, type: "text", input: true },
    ],
    [companyDetails, divDetails]
  );
};

const useUomMasterFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "uom_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "uom_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "uom_name", label: "Name", require: true, view: true, type: "text", input: true },
      { field: "uom_class", label: "UOM Class", require: true, view: true, type: "text", input: true },
      { field: "uom_base_uom_flag", label: "UOM Base", require: true, view: true, type: "text", input: true },
      { field: "uom_con_factor", label: "UOM Conversion Factor ", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useAcYearFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "ac_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "ac_year_code", label: "Year Code", require: true, view: true, type: "text", input: true },
      { field: "ac_year", label: "Year", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useGSTMasterFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "gst_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "gst_state_un_name", label: "State/Union Territory Name", require: true, view: true, type: "text", input: true },
      { field: "gst_code", label: "State Code", require: true, view: true, type: "text", input: true },
      { field: "gst_alpha_code", label: "Gst Alpha Code", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useDeptMasterFields = (formData?: any): FieldType[] => {
  const { companyDetails, divDetails, branchDetails } = useAppState();

  return useMemo<FieldType[]>(
    () => [
      { field: "dept_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "com_sno", label: "Company Name", require: true, view: false, type: "select", options: companyDetails || [], input: true },
      { field: "div_sno", label: "Division Name", require: true, view: false, type: "select", options: divDetails || [], input: true },
      { field: "com_name", label: "Company Name", require: true, view: true, type: "select", options: companyDetails || [], input: false },
      { field: "div_name", label: "Division Name", require: true, view: true, type: "select", options: divDetails || [], input: false },
      { field: "brn_sno", label: "Branch Name", require: true, view: false, type: "select", options: branchDetails || [], input: true },
      { field: "brn_name", label: "Branch Name", require: true, view: true, type: "select", options: branchDetails || [], input: false },
      { field: "dept_name", label: "Department Name", require: true, view: true, type: "text", input: true },
      { field: "dept_code", label: "Department Code", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [companyDetails, divDetails, branchDetails]
  );
};

const usePrefixFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "prefix_sno ", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "prefix_name ", label: "Prefix", require: true, view: true, type: "text", input: true },
      { field: "prefix_desc ", label: "Prefix Description", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const usePriorityFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "priority_sno", label: "S.No", require: false, view: true, type: "text", input: false },
      { field: "priority_name", label: "Priority Name", require: true, view: true, type: "text", input: true },
      { field: "priority_desc", label: "Priority Description", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};
const useScreensFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "screen_id", label: "Screen ID", require: false, view: true, type: "text", input: false },
      { field: "screen_name", label: "Screen Name", require: true, view: true, type: "text", input: true },
      { field: "screen_code", label: "Screen Code", require: true, view: true, type: "text", input: false },
      { field: "parent_screen_id", label: "Parent Screen", require: false, view: true, type: "select", input: true },
      { field: "display_order", label: "Display Order", require: false, view: true, type: "number", input: true },
      { field: "created_date", label: "Created Date", require: false, view: false, type: "date", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const usePermissionFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "permission_id", label: "Permission ID", require: false, view: true, type: "text", input: false },
      { field: "permission_name", label: "Permission Name", require: true, view: true, type: "text", input: true },
      { field: "permission_code", label: "Permission Code", require: true, view: true, type: "text", input: false },
      { field: "permission_description", label: "Permission Description", require: false, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};
const useProductCatagoryMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "cat_sno", label: "Category ID", require: false, view: true, type: "text", input: false },
      { field: "cat_name", label: "Category Name", require: true, view: true, type: "text", input: true },
      { field: "cat_notes", label: "Category Notes", require: true, view: true, type: "text", input: false },
      { field: "cat_description", label: "Category Description", require: false, view: true, type: "text", input: true },
      { field: "cat_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};
const useProductSubCatagoryMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "subcat_sno", label: "Sub Category ID", require: false, view: true, type: "text", input: false },
      { field: "subcat_name", label: "Sub Category Name", require: true, view: true, type: "text", input: true },
      { field: "subcat_notes", label: "Sub Category Notes", require: true, view: true, type: "text", input: false },
      { field: "subcat_description", label: "Sub Category Description", require: false, view: true, type: "text", input: true },
      { field: "subcat_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useProductFieldsMaster = (formData?: any): FieldType[] => {
  const {options, loading} = useMasterOptions(['ProductCategoryMaster','ProductSubCategoryMaster','UomMaster','TaxMaster']);
  return useMemo<FieldType[]>(
    () => [
      { field: "prod_sno", label: "Product ID", require: false, view: true, type: "text", input: false },
      // { field: "com_sno", label: "Company", require: true, view: true, type: "select", input: true },
      // { field: "div_sno", label: "Division", require: true, view: true, type: "select", input: true },
      // { field: "brn_sno", label: "Branch", require: true, view: true, type: "select", input: true },
      // { field: "dept_sno", label: "Department", require: true, view: true, type: "select", input: true },
      { field: "cat_sno", label: "Category", require: true, view: false, type: "select", options: options?.ProductCategoryMaster, input: true },
      { field: "cat_name", label: "Category", require: true, view: true, type: "select", options: options?.ProductCategoryMaster, input: false },

      { field: "subcat_sno", label: "Sub Category", require: true, view: false, type: "select", options: options?.ProductSubCategoryMaster, input: true },
      { field: "subcat_name", label: "Sub Category", require: true, view: true, type: "select", options: options?.ProductSubCategoryMaster, input: false },

      { field: "prod_code", label: "Product Code", require: false, view: true, type: "text", input: false },
      { field: "prod_name", label: "Product Name", require: true, view: true, type: "text", input: true },
      { field: "hsn_code", label: "HSN Code", require: false, view: true, type: "text", input: true },
      { field: "uom_sno", label: "Unit of Measurement", require: true, view: false, type: "select", options: options?.UomMaster, input: true },
      { field: "uom_name", label: "Unit of Measurement", require: true, view: true, type: "select", options: options?.UomMaster, input: false },
      { field: "tax_sno", label: "Tax", require: true, view: false, type: "select", options: options?.TaxMaster, input: false },
      { field: "sku", label: "SKU", require: false, view: false, type: "text", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
      { field: "prod_description", label: "Description", require: false, view: true, type: "textarea", input: true },


      // { field: "created_date", label: "Created Date", require: false, view: true, type: "date", input: false },
      // { field: "created_by", label: "Created By", require: false, view: true, type: "text", input: false },
      // { field: "modified_date", label: "Modified Date", require: false, view: false, type: "date", input: false },
      // { field: "modified_by", label: "Modified By", require: false, view: false, type: "text", input: false },
    ],
    [options,loading]
  );
};



export {
  masterItems,
  useCompanyMasterFields,
  useDivisionMasterFields,
  useBranchMasterFields,
  useUomMasterFields,
  useAcYearFields,
  useGSTMasterFields,
  useDeptMasterFields,
  usePrefixFieldsMaster,
  usePriorityFieldsMaster,
  useScreensFieldsMaster,
  usePermissionFieldsMaster,
  useProductFieldsMaster,
  useProductCatagoryMaster,
  useProductSubCatagoryMaster,
};

