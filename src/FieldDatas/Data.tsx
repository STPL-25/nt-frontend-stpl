import React, { ReactElement, useMemo } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
import {  Building, MapPin, FileCheck, IndianRupee, Package, FolderOpen,
  Receipt, Hash, Archive, Briefcase, TrendingUp, GitBranch, Truck, Landmark, Warehouse, Wrench, UserCog,} from "lucide-react";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
import type { FieldType, OptionType } from "./fieldType/fieldType";

export type { FieldType, OptionType };

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
  // { icon: <Calendar className="w-5 h-5" />, name: "Acc Year", category: "finance", color: "bg-slate-500", id: "AcYearMaster" },
  { icon: <Archive className="w-5 h-5" />, name: "Department Master", category: "organization", color: "bg-blue-600", id: "DeptMaster" },
  { icon: <Receipt className="w-5 h-5" />, name: "GST State Code", category: "finance", color: "bg-rose-500", id: "GSTStateCodeMaster" },
  // { icon: <Hash className="w-5 h-5" />, name: "Prefix Master", category: "administration", color: "bg-stone-500", id: "PrefixMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "Screen Master", category: "administration", color: "bg-stone-500", id: "ScreenMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "Screen Permission", category: "administration", color: "bg-stone-500", id: "ScreenPermission" },
  { icon: <GitBranch className="w-5 h-5" />, name: "Workflow Master", category: "approvals", color: "bg-violet-600", id: "WorkflowMaster" },

  { icon: <TrendingUp className="w-5 h-5" />, name: "Priority Master", category: "finance", color: "bg-emerald-600", id: "PriorityMaster" },
  // { icon: <FileCheck className="w-5 h-5" />, name: "PO Approval", category: "approvals", color: "bg-orange-500", id: "POApproval" },
  // { icon: <IndianRupee className="w-5 h-5" />, name: "Ledger Master", category: "finance", color: "bg-emerald-500", id: "ledger_master" },
  { icon: <FolderOpen className="w-5 h-5" />, name: "Product Category", category: "inventory", color: "bg-yellow-500", id: "ProductCategoryMaster" },
  { icon: <FolderOpen className="w-5 h-5" />, name: "Product Sub Category", category: "inventory", color: "bg-amber-500", id: "ProductSubCategoryMaster" },
  { icon: <Package className="w-5 h-5" />, name: "Product", category: "inventory", color: "bg-indigo-500", id: "ProductMaster" },
  { icon: <Wrench className="w-5 h-5" />, name: "Service Master", category: "inventory", color: "bg-teal-600", id: "ServiceMaster" },
   { icon: <Hash className="w-5 h-5" />, name: "UOM", category: "inventory", color: "bg-green-600", id: "UomMaster" },
  { icon: <Truck className="w-5 h-5" />, name: "Transporter Master", category: "logistics", color: "bg-red-600", id: "TransportMaster" },
  { icon: <Landmark className="w-5 h-5" />, name: "Bank Account Type", category: "compliance", color: "bg-cyan-600", id: "BankAccountTypeMaster" },
  { icon: <Warehouse className="w-5 h-5" />, name: "Warehouse Location", category: "inventory", color: "bg-orange-600", id: "WarehouseLocationMaster" },
  { icon: <UserCog className="w-5 h-5" />, name: "Designation Master", category: "administration", color: "bg-fuchsia-600", id: "DesignationMaster" },

  // { icon: <FileText className="w-5 h-5" />, name: "KYC", category: "compliance", color: "bg-teal-500", id: "kyc_master" },
  // { icon: <Tag className="w-5 h-5" />, name: "Product Rate and Discount", category: "inventory", color: "bg-cyan-500", id: "product_rate_discount" },
  // { icon: <UserPlus className="w-5 h-5" />, name: "User Creation", category: "administration", color: "bg-violet-500", id: "user_creation" },
  // { icon: <Menu className="w-5 h-5" />, name: "Menu Creation", category: "administration", color: "bg-amber-500", id: "menu_creation" },
  // { icon: <CheckCircle className="w-5 h-5" />, name: "Payment Approval", category: "approvals", color: "bg-lime-500", id: "payment_approval" },
  // { icon: <CreditCard className="w-5 h-5" />, name: "Payment Type", category: "finance", color: "bg-pink-500", id: "payment_type" },
  // { icon: <Gift className="w-5 h-5" />, name: "Customer Gift", category: "customer", color: "bg-fuchsia-500", id: "customer_gift" },
  // { icon: <FileText className="w-5 h-5" />, name: "Approval Footer", category: "approvals", color: "bg-sky-500", id: "approval_footer" },
  // { icon: <Settings className="w-5 h-5" />, name: "Request Type", category: "administration", color: "bg-yellow-600", id: "request_type" },
  // { icon: <Truck className="w-5 h-5" />, name: "Vehicle Master", category: "logistics", color: "bg-red-600", id: "vehicle_master" },
  // { icon: <PiggyBank className="w-5 h-5" />, name: "Dept Budget", category: "finance", color: "bg-emerald-600", id: "dept_budget" },
];



/* ---------- Hooks returning typed FieldType[] ---------- */

const useCompanyMasterFields = (): FieldType[] => {
  const { formData } = useAppState();
  return useMemo<FieldType[]>(
    () => [
      { field: "com_sno", label: "S.No", require: false, view: false, type: "text", input: false },
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
        // Required unless the company has explicitly said GST doesn't
        // apply — matches real data (e.g. "Sri Nachammal Vidyavani" has
        // Gst Applicable = N with Gst/Tan/Cin all blank).
        require: formData?.is_gst_applicable !== "N",
        view: true,
        type: "text",
        input: formData?.is_gst_applicable === "N" ? false : true,
      },
      {
        field: "add_tan",
        label: "Tan No",
        require: formData?.is_gst_applicable !== "N",
        view: true,
        type: "text",
        input: formData?.is_gst_applicable === "N" ? false : true,
      },
      {
        field: "add_cin",
        label: "Cin No",
        require: formData?.is_gst_applicable !== "N",
        view: true,
        type: "text",
        input: formData?.is_gst_applicable === "N" ? false : true,
      },
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
      { field: "div_sno", label: "S.No", require: false, view: false, type: "text", input: false },
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
  const { companyDetails, filteredDivDetails, filteredBranchDetails } = useAppState();

  return useMemo<FieldType[]>(
    () => [
      { field: "brn_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "com_sno", label: "Company Name", require: true, view: false, type: "select", options: companyDetails || [], input: true },
      { field: "div_sno", label: "Division Name", require: true, view: false, type: "select", options: filteredDivDetails || [], input: true },
      { field: "com_name", label: "Company Name", require: true, view: true, type: "select", options: companyDetails || [], input: false },
      { field: "div_name", label: "Division Name", require: true, view: true, type: "select", options: filteredDivDetails || [], input: false },
      { field: "brn_name", label: "Branch Name", require: true, view: true, type: "text", input: true },
      { field: "brn_prefix", label: "Branch Prefix", require: true, view: true, type: "text", input: true },
      { field: "add_door_no", label: "Door No", require: false, view: true, type: "text", input: true },
      { field: "add_street", label: "Street", require: false, view: true, type: "text", input: true },
      { field: "add_city", label: "City", require: true, view: true, type: "text", input: true },
      { field: "add_state", label: "State", require: true, view: true, type: "text", input: true },
      { field: "add_state_code", label: "State Code", require: true, view: true, type: "text", input: true },
      { field: "add_pin_code", label: "Pincode", require: true, view: true, type: "text", input: true },
    ],
    [companyDetails, filteredDivDetails, filteredBranchDetails]
  );
};

const useUomMasterFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "uom_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "uom_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "uom_name", label: "Name", require: true, view: true, type: "text", input: true },
      { field: "uom_class", label: "UOM Class", require: true, view: true, type: "text", input: true },
      { field: "uom_base_uom_flag", label: "UOM Base", require: true, view: true, type: "text", input: true },
      // Leave blank for a packaging unit whose count varies per product
      // (e.g. Box) — that product then supplies its own conversion via
      // Product Master's "Pieces per Unit" field instead.
      { field: "uom_con_factor", label: "UOM Conversion Factor (blank if it varies by product, e.g. Box)", require: false, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useTransportMasterFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "transport_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "transport_code", label: "Code", require: false, view: true, type: "text", input: true },
      { field: "transport_name", label: "Transporter Name", require: true, view: true, type: "text", input: true },
      { field: "contact_person", label: "Contact Person", require: false, view: true, type: "text", input: true },
      { field: "phone_no", label: "Phone No", require: false, view: true, type: "text", input: true },
      { field: "gst_no", label: "GST No", require: false, view: true, type: "text", input: true },
      { field: "address", label: "Address", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useAcYearFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "ac_sno", label: "S.No", require: false, view: false, type: "text", input: false },
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
      { field: "gst_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "gst_state_un_name", label: "State/Union Territory Name", require: true, view: true, type: "text", input: true },
      { field: "gst_code", label: "State Code", require: true, view: true, type: "text", input: true },
      { field: "gst_alpha_code", label: "Gst Alpha Code", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useDeptMasterFields = (formData?: any): FieldType[] => {
  const { companyDetails, filteredDivDetails, filteredBranchDetails } = useAppState();

  return useMemo<FieldType[]>(
    () => [
      { field: "dept_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "com_sno", label: "Company Name", require: true, view: false, type: "select", options: companyDetails || [], input: true },
      { field: "div_sno", label: "Division Name", require: true, view: false, type: "select", options: filteredDivDetails || [], input: true },
      { field: "com_name", label: "Company Name", require: true, view: true, type: "select", options: companyDetails || [], input: false },
      { field: "div_name", label: "Division Name", require: true, view: true, type: "select", options: filteredDivDetails || [], input: false },
      { field: "brn_sno", label: "Branch Name", require: true, view: false, type: "select", options: filteredBranchDetails || [], input: true },
      { field: "brn_name", label: "Branch Name", require: true, view: true, type: "select", options: filteredBranchDetails || [], input: false },
      { field: "dept_name", label: "Department Name", require: true, view: true, type: "text", input: true },
      { field: "dept_code", label: "Department Code", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [companyDetails, filteredDivDetails, filteredBranchDetails]
  );
};

const usePrefixFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "prefix_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "prefix_name", label: "Prefix", require: true, view: true, type: "text", input: true },
      { field: "prefix_desc", label: "Prefix Description", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const usePriorityFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "priority_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "priority_name", label: "Priority Name", require: true, view: true, type: "text", input: true },
      { field: "priority_desc", label: "Priority Description", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};
const useBankAccountTypeFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "bank_account_type_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "account_type_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "account_type_name", label: "Account Type Name", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useDesignationMasterFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "designation_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "designation_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "designation_name", label: "Designation Name", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useWarehouseLocationFieldsMaster = (formData?: any): FieldType[] => {
  const { options, loading } = useMasterOptions(['CompanyMaster', 'DivisionMaster', 'BranchMaster']);
  return useMemo<FieldType[]>(
    () => [
      { field: "location_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "location_code", label: "Location Code", require: true, view: true, type: "text", input: true },
      { field: "location_name", label: "Location Name", require: true, view: true, type: "text", input: true },
      // Multiple companies/divisions/branches can share one physical
      // location — division/branch are optional (blank = not restricted
      // within the selected companies).
      { field: "com_snos", label: "Companies", require: true, view: false, type: "multi-select", options: options?.CompanyMaster || [], input: true },
      { field: "div_snos", label: "Divisions", require: false, view: false, type: "multi-select", options: options?.DivisionMaster || [], input: true },
      { field: "brn_snos", label: "Branches", require: false, view: false, type: "multi-select", options: options?.BranchMaster || [], input: true },
      { field: "com_names", label: "Companies", require: false, view: true, type: "text", input: false },
      { field: "div_names", label: "Divisions", require: false, view: true, type: "text", input: false },
      { field: "brn_names", label: "Branches", require: false, view: true, type: "text", input: false },
      { field: "description", label: "Description", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, loading]
  );
};

const useScreensFieldsMaster = (formData?: any): FieldType[] => {
  const { options, loading } = useMasterOptions(['ScreenMaster']);
  return useMemo<FieldType[]>(
    () => [
      { field: "screen_id", label: "Screen ID", require: false, view: false, type: "text", input: false },
      { field: "screen_name", label: "Screen Name", require: true, view: true, type: "text", input: true },
      { field: "screen_code", label: "Screen Code", require: true, view: true, type: "text", input: false },
      { field: "parent_screen_id", label: "Parent Screen", require: false, view: true, type: "select", options: options?.ScreenMaster || [], input: true },
      { field: "display_order", label: "Display Order", require: false, view: true, type: "number", input: true },
      { field: "created_date", label: "Created Date", require: false, view: false, type: "date", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, loading]
  );
};

const usePermissionFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "permission_id", label: "Permission ID", require: false, view: false, type: "text", input: false },
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
      { field: "cat_sno", label: "Category ID", require: false, view: false, type: "text", input: false },
      { field: "cat_name", label: "Category Name", require: true, view: true, type: "text", input: true },
      // Not free-text notes — this is the product-code prefix (e.g. "STA" -> STA00001),
      // used by sp_nt_CreateProductRecord to generate every product under this category.
      { field: "cat_notes", label: "Product Code Prefix", require: true, view: true, type: "text", input: true },
      { field: "cat_description", label: "Category Description", require: false, view: true, type: "text", input: true },
      { field: "cat_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};
const useProductSubCatagoryMaster = (): FieldType[] => {
  const { options, loading } = useMasterOptions(['ProductCategoryMaster']);
  return useMemo<FieldType[]>(
    () => [
      { field: "subcat_sno", label: "Sub Category ID", require: false, view: false, type: "text", input: false },

      { field: "cat_sno", label: "Category", require: true, view: false, type: "select", options: options?.ProductCategoryMaster, input: true },
      { field: "cat_name", label: "Category", require: true, view: true, type: "select", options: options?.ProductCategoryMaster, input: false },

      { field: "subcat_name", label: "Sub Category Name", require: true, view: true, type: "text", input: true },
      { field: "subcat_description", label: "Sub Category Description", require: false, view: true, type: "text", input: true },
      { field: "subcat_notes", label: "Sub Category Notes", require: false, view: true, type: "text", input: true },
      { field: "subcat_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, loading]
  );
};

const useWorkflowMasterFields = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "workflow_id", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "workflow_name", label: "Workflow Name", require: true, view: true, type: "text", input: true },
      { field: "workflow_code", label: "Workflow Code", require: true, view: true, type: "text", input: true },
      { field: "entity_type", label: "Entity Type", require: true, view: true, type: "select", options: [
        { value: "Masters", label: "Masters" },
          { value: "PurchaseRequisition", label: "Purchase Requisition" },
          { value: "PurchaseOrder", label: "Purchase Order" },
          { value: "GRN", label: "GRN" },
          { value: "Payment", label: "Payment" },
          { value: "KYC", label: "KYC" },
        ], input: true },
      { field: "description", label: "Description", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
      { field: "created_by", label: "Created By", require: false, view: false, type: "text", input: false },
      { field: "created_at", label: "Created At", require: false, view: false, type: "date", input: false },
      { field: "modified_data", label: "Modified Data", require: false, view: false, type: "text", input: false },
      { field: "modified_by", label: "Modified By", require: false, view: false, type: "text", input: false },
      { field: "modified_at", label: "Modified At", require: false, view: false, type: "date", input: false },
    ],
    []
  );
};

const useProductFieldsMaster = (): FieldType[] => {
  const { formData } = useAppState();
  const {options, loading} = useMasterOptions(['ProductCategoryMaster','ProductSubCategoryMaster','UomMaster','TaxMaster']);

  // The selected UOM's own base/conversion flags (uom_base_uom_flag,
  // uom_con_factor) ride along as `extra` on each UomMaster option (see
  // CommonMasterRepo.js fieldMappings). A non-base unit with no fixed
  // uom_con_factor (e.g. Box) varies per product, so the moment one is
  // selected here, "Pieces per Unit" appears and is required — that's the
  // pop-up-on-selection behavior for capturing "1 Box = how many pieces".
  const selectedUom: any = useMemo(
    () => options?.UomMaster?.find((u: any) => String(u.value) === String(formData?.uom_sno)),
    [options?.UomMaster, formData?.uom_sno]
  );
  const needsProdConFactor = !!selectedUom
    && selectedUom.uom_base_uom_flag === 'N'
    && (selectedUom.uom_con_factor === null || selectedUom.uom_con_factor === undefined);

  return useMemo<FieldType[]>(
    () => [
      { field: "prod_sno", label: "Product ID", require: false, view: false, type: "text", input: false },
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
      {
        field: "prod_uom_con_factor",
        label: "Pieces per Unit (e.g. pieces in 1 Box)",
        require: needsProdConFactor,
        view: true,
        type: "number",
        input: needsProdConFactor,
      },
      { field: "tax_sno", label: "Tax", require: true, view: false, type: "select", options: options?.TaxMaster, input: false },
      { field: "sku", label: "SKU", require: false, view: false, type: "text", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
      { field: "prod_description", label: "Description", require: false, view: true, type: "textarea", input: true },


      // { field: "created_date", label: "Created Date", require: false, view: true, type: "date", input: false },
      // { field: "created_by", label: "Created By", require: false, view: true, type: "text", input: false },
      // { field: "modified_date", label: "Modified Date", require: false, view: false, type: "date", input: false },
      // { field: "modified_by", label: "Modified By", require: false, view: false, type: "text", input: false },
    ],
    [options, loading, needsProdConFactor]
  );
};

const useServiceMasterFields = (): FieldType[] => {
  const { formData } = useAppState();
  const { options, loading } = useMasterOptions(['ServiceTypeMaster', 'UomMaster']);
  return useMemo<FieldType[]>(
    () => [
      { field: "service_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "service_code", label: "Service Code", require: true, view: true, type: "text", input: true },
      { field: "service_name", label: "Service Name", require: true, view: true, type: "text", input: true },

      { field: "service_type_sno", label: "Service Type", require: true, view: false, type: "select", options: options?.ServiceTypeMaster || [], input: true },
      { field: "service_type_name", label: "Service Type", require: true, view: true, type: "select", options: options?.ServiceTypeMaster || [], input: false },

      { field: "default_uom_sno", label: "Default UOM", require: false, view: false, type: "select", options: options?.UomMaster || [], input: true },
      { field: "default_uom_name", label: "Default UOM", require: false, view: true, type: "select", options: options?.UomMaster || [], input: false },

      { field: "sac_code", label: "SAC Code", require: false, view: true, type: "text", input: true },

      { field: "is_recurring", label: "Recurring", require: false, view: true, type: "checkbox", input: true },
      // Only meaningful when Recurring is on — usp/sp_nt_CreateServiceRecords
      // throws if is_recurring=1 with no cadence, so gate it the same way
      // CompanyMaster gates its GST fields on is_gst_applicable.
      {
        field: "recurrence_cadence",
        label: "Recurrence Cadence",
        require: !!formData?.is_recurring,
        view: true,
        type: "select",
        options: [
          { value: "DAILY", label: "Daily" },
          { value: "EVERY_N_DAYS", label: "Every N Days" },
          { value: "MONTHLY", label: "Monthly" },
          { value: "QUARTERLY", label: "Quarterly" },
          { value: "HALF_YEARLY", label: "Half Yearly" },
          { value: "YEARLY_FIXED_DATE", label: "Yearly (Fixed Date)" },
        ],
        input: !!formData?.is_recurring,
      },
      {
        field: "recurrence_interval_days",
        label: "Recurrence Interval (Days)",
        require: formData?.recurrence_cadence === "EVERY_N_DAYS",
        view: true,
        type: "number",
        input: !!formData?.is_recurring && formData?.recurrence_cadence === "EVERY_N_DAYS",
      },

      { field: "description", label: "Description", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, loading, formData?.is_recurring, formData?.recurrence_cadence]
  );
};



export {
  masterItems,
  useCompanyMasterFields,
  useDivisionMasterFields,
  useBranchMasterFields,
  useUomMasterFields,
  useTransportMasterFields,
  useAcYearFields,
  useGSTMasterFields,
  useDeptMasterFields,
  usePrefixFieldsMaster,
  usePriorityFieldsMaster,
  useBankAccountTypeFieldsMaster,
  useWarehouseLocationFieldsMaster,
  useDesignationMasterFields,
  useScreensFieldsMaster,
  usePermissionFieldsMaster,
  useProductFieldsMaster,
  useProductCatagoryMaster,
  useProductSubCatagoryMaster,
  useServiceMasterFields,
  useWorkflowMasterFields,
};

