import React, { ReactElement, useMemo, useState, useEffect } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
import {  Building, MapPin, FileCheck, IndianRupee, Package, FolderOpen,
  Receipt, Hash, Archive, Briefcase, TrendingUp, GitBranch, Truck, Landmark, Warehouse, Wrench, UserCog, FileText, Repeat, Link2, Gauge,} from "lucide-react";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
import usePost from "@/hooks/usePostHook";
import { apiGetSignEmployee } from "@/Services/Api";
import type { FieldType, OptionType } from "./fieldType/fieldType";

export type { FieldType, OptionType };

/* ---------- Master Items (with typed icons) ---------- */

export interface MasterItemType {
  icon: ReactElement;
  name: string;
  category: string;
  color: string;
  id: string;
  // Hidden from a non-staff (temporary login_id/password) session's Masters
  // grid — see MasterItemsGrid's staff check in MasterPageScreen.tsx.
  staffOnly?: boolean;
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
   { icon: <Hash className="w-5 h-5" />, name: "UOM", category: "inventory", color: "bg-green-600", id: "UomMaster" },
  { icon: <Truck className="w-5 h-5" />, name: "Transporter Master", category: "logistics", color: "bg-red-600", id: "TransportMaster" },
  { icon: <Landmark className="w-5 h-5" />, name: "Bank Account Type", category: "compliance", color: "bg-cyan-600", id: "BankAccountTypeMaster" },
  { icon: <Warehouse className="w-5 h-5" />, name: "Warehouse Location", category: "inventory", color: "bg-orange-600", id: "WarehouseLocationMaster" },
  { icon: <UserCog className="w-5 h-5" />, name: "Designation Master", category: "administration", color: "bg-fuchsia-600", id: "DesignationMaster" },
  { icon: <FileText className="w-5 h-5" />, name: "Terms & Conditions", category: "compliance", color: "bg-sky-600", id: "TermsConditionsMaster", staffOnly: true },
  { icon: <Gauge className="w-5 h-5" />, name: "Product Stock Level", category: "inventory", color: "bg-pink-600", id: "ProductStockLevelMaster", staffOnly: true },
  { icon: <FolderOpen className="w-5 h-5" />, name: "Supplier Category", category: "compliance", color: "bg-lime-600", id: "SupplierCatagoryMaster" },
  { icon: <Landmark className="w-5 h-5" />, name: "Payment Mode", category: "compliance", color: "bg-emerald-500", id: "PaymentModeMaster" },
  { icon: <Repeat className="w-5 h-5" />, name: "Service Type", category: "services", color: "bg-violet-500", id: "ServiceTypeMaster" },
  { icon: <Wrench className="w-5 h-5" />, name: "Service", category: "services", color: "bg-indigo-600", id: "ServiceMaster" },
  { icon: <Gauge className="w-5 h-5" />, name: "Recurrence Cadence", category: "services", color: "bg-teal-600", id: "RecurrenceCadenceMaster" },

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

// Fixed taxonomy already in live use across every existing uom_master row —
// enforcing it as a dropdown (rather than free text) stops a typo'd class
// (e.g. "Wieght") from silently orphaning a unit out of its class's
// same-class conversion-unit picker on Product Master (see
// useProductFieldsMaster's conversionUnitOptions below).
const UOM_CLASS_OPTIONS = [
  { label: "Mass / Weight", value: "MASS" },
  { label: "Volume", value: "VOLUME" },
  { label: "Length", value: "LENGTH" },
  { label: "Area", value: "AREA" },
  { label: "Quantity / Count", value: "QUANTITY" },
];

const useUomMasterFields = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "uom_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "uom_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "uom_name", label: "Name", require: true, view: true, type: "text", input: true },
      { field: "uom_class", label: "UOM Class", require: true, view: true, type: "select", options: UOM_CLASS_OPTIONS, input: true },
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

const usePaymentModeFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "payment_mode_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "payment_mode_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "payment_mode_name", label: "Payment Mode Name", require: true, view: true, type: "text", input: true },
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
const useSupplierCatagoryFieldsMaster = (): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "supp_cat_sno", label: "Supplier Category ID", require: false, view: false, type: "text", input: false },
      { field: "supp_cat_name", label: "Supplier Category Name", require: true, view: true, type: "text", input: true },
      { field: "supp_cat_code", label: "Supplier Category Code", require: false, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};
const useProductSubCatagoryMaster = (): FieldType[] => {
  const { options, loading } = useMasterOptions(['ProductCategoryMaster']);
  const { formData } = useAppState();
  return useMemo<FieldType[]>(
    () => [
      { field: "subcat_sno", label: "Sub Category ID", require: false, view: false, type: "text", input: false },

      { field: "cat_sno", label: "Category", require: true, view: false, type: "select", options: options?.ProductCategoryMaster, input: true },
      { field: "cat_name", label: "Category", require: true, view: true, type: "select", options: options?.ProductCategoryMaster, input: false },

      { field: "subcat_name", label: "Sub Category Name", require: true, view: true, type: "text", input: true },
      { field: "subcat_description", label: "Sub Category Description", require: false, view: true, type: "text", input: true },
      { field: "subcat_notes", label: "Sub Category Notes", require: false, view: true, type: "text", input: true },
      // Regular = day-to-day stock drawn via Store Requisition; Non-Regular =
      // one-off/specific-need items that skip requisition and go straight to
      // Store Issue once GRN receives them; Perishable = same auto-issue-off-
      // GRN fast path as Non-Regular, plus a shelf-life (below) that flags
      // unconsumed stock as Expiry Stock on the Inventory page. Defaults to
      // Regular server-side.
      {
        field: "subcat_stock_type", label: "Stock Type", require: false, view: true, type: "select",
        options: [
          { label: "Regular", value: "Regular" },
          { label: "Non-Regular", value: "Non-Regular" },
          { label: "Perishable", value: "Perishable" },
        ],
        input: true,
      },
      {
        field: "perishable_days",
        label: "Perishable Days (shelf life)",
        require: formData?.subcat_stock_type === "Perishable",
        view: true,
        type: "number",
        input: formData?.subcat_stock_type === "Perishable",
        placeholder: "e.g. 2",
      },
      { field: "subcat_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, loading, formData?.subcat_stock_type]
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
  // uom_con_factor, uom_class) ride along as `extra` on each UomMaster option
  // (see CommonMasterRepo.js fieldMappings). A non-base unit with no fixed
  // uom_con_factor (e.g. Box, Tin) varies per product, so the moment one is
  // selected here, a Quantity + Unit pair appears and is required — that's
  // the pop-up-on-selection behavior for capturing "1 Box = how many pieces"
  // or "1 Tin = how many KG".
  const selectedUom: any = useMemo(
    () => options?.UomMaster?.find((u: any) => String(u.value) === String(formData?.uom_sno)),
    [options?.UomMaster, formData?.uom_sno]
  );
  const needsProdConFactor = !!selectedUom
    && selectedUom.uom_base_uom_flag === 'N'
    && (selectedUom.uom_con_factor === null || selectedUom.uom_con_factor === undefined);

  // Restrict the conversion-unit picker to units sharing the selected UOM's
  // class (e.g. Tin → MASS → KG/G/LB/OZ/TON only, never Liters), so "1 Tin =
  // 20 ___" can only be answered with a weight unit.
  const conversionUnitOptions = useMemo(
    () => (selectedUom
      ? (options?.UomMaster ?? []).filter((u: any) => u.uom_class === selectedUom.uom_class)
      : []),
    [options?.UomMaster, selectedUom]
  );

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
        label: selectedUom ? `Quantity per 1 ${selectedUom.label} (e.g. 20 for a 20 KG Tin)` : "Quantity per Unit",
        require: needsProdConFactor,
        view: true,
        type: "number",
        input: needsProdConFactor,
      },
      {
        field: "prod_uom_con_uom_sno",
        label: "In Unit",
        require: needsProdConFactor,
        view: false,
        type: "select",
        options: conversionUnitOptions,
        input: needsProdConFactor,
      },
      { field: "con_uom_name", label: "In Unit", require: false, view: true, type: "text", input: false },
      { field: "tax_sno", label: "Tax", require: true, view: false, type: "select", options: options?.TaxMaster, input: false },
      { field: "sku", label: "SKU", require: false, view: false, type: "text", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
      { field: "prod_description", label: "Description", require: false, view: true, type: "textarea", input: true },


      // { field: "created_date", label: "Created Date", require: false, view: true, type: "date", input: false },
      // { field: "created_by", label: "Created By", require: false, view: true, type: "text", input: false },
      // { field: "modified_date", label: "Modified Date", require: false, view: false, type: "date", input: false },
      // { field: "modified_by", label: "Modified By", require: false, view: false, type: "text", input: false },
    ],
    [options, loading, needsProdConFactor, selectedUom, conversionUnitOptions]
  );
};


const useServiceTypeFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "service_type_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "service_type_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "service_type_name", label: "Service Type Name", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useServiceFieldsMaster = (formData?: any): FieldType[] => {
  const { options } = useMasterOptions(["ServiceTypeMaster", "UomMaster"]);

  // Incharge = the employee responsible when this service is fulfilled
  // internally instead of by a vendor (sql/81_service_agreement_dispatch_grn.sql).
  // Set here, at service creation, only — no update proc exists for
  // service_master. ecno is stored as an opaque string (same convention as
  // approver_ecno elsewhere), so the employee list is fetched the same way
  // ApprovalWorkflowManager.tsx already does for its approver picker, rather
  // than through a master/FK the backend doesn't have.
  const { postData } = usePost<any>();
  const [employeeOptions, setEmployeeOptions] = useState<OptionType[]>([]);
  useEffect(() => {
    postData(apiGetSignEmployee, {})
      .then((res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        setEmployeeOptions(list.map((e) => ({ label: `${e.ename} (${e.ecno})`, value: e.ecno })));
      })
      .catch(() => setEmployeeOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo<FieldType[]>(
    () => [
      { field: "service_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "service_name", label: "Service Name", require: true, view: true, type: "text", input: true },
      { field: "service_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "service_type_sno", label: "Service Type", require: true, view: false, type: "select", options: options?.ServiceTypeMaster || [], input: true },
      { field: "service_type_name", label: "Service Type", require: false, view: true, type: "text", input: false },
      { field: "default_uom_sno", label: "Default UOM", require: false, view: false, type: "select", options: options?.UomMaster || [], input: true },
      { field: "default_uom_name", label: "Default UOM", require: false, view: true, type: "text", input: false },
      {
        field: "incharge_ecno", label: "Incharge", require: false, view: true, type: "select",
        options: employeeOptions, input: true,
        placeholder: "Only needed if this service can be routed to an internal Incharge instead of the supplier",
      },
      { field: "description", label: "Description", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, employeeOptions]
  );
};

const useRecurrenceCadenceFieldsMaster = (formData?: any): FieldType[] => {
  const interval_unit_options: OptionType[] = useMemo(() => ([
    { label: "Day", value: "DAY" },
    { label: "Month", value: "MONTH" },
  ]), []);
  return useMemo<FieldType[]>(
    () => [
      { field: "recurrence_cadence_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "cadence_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "cadence_name", label: "Cadence Name", require: true, view: true, type: "text", input: true },
      { field: "interval_unit", label: "Interval Unit", require: true, view: true, type: "select", options: interval_unit_options, input: true },
      { field: "interval_value", label: "Interval Value", require: true, view: true, type: "number", input: true, placeholder: "e.g. 15 for DAY, 1/2/3/12 for MONTH" },
      { field: "description", label: "Description", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [interval_unit_options]
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
  useSupplierCatagoryFieldsMaster,
  usePaymentModeFieldsMaster,
  useWorkflowMasterFields,
  useServiceTypeFieldsMaster,
  useServiceFieldsMaster,
  useRecurrenceCadenceFieldsMaster,
};

