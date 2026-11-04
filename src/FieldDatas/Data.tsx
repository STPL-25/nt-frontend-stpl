import React, { ReactElement, useMemo, useState, useEffect } from "react";
import { useAppState } from "@/globalState/hooks/useAppState";
import {  Building, MapPin, FileCheck, IndianRupee, Package, FolderOpen,
  Receipt, Hash, Archive, Briefcase, TrendingUp, GitBranch, Truck, Landmark, Warehouse, Wrench, UserCog, FileText, Repeat, Link2, Gauge, BookOpen, Boxes, Banknote,} from "lucide-react";
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

// Every tile below needs its own access row in `screens` (comp "masters.<id>", group "Individual Masters" — see
// backend sql/151) or nobody sees it: MasterPageScreen shows a tile only to users with View on that row.
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
  { icon: <Boxes className="w-5 h-5" />, name: "Stock Type", category: "inventory", color: "bg-purple-600", id: "StockTypeMaster" },
  { icon: <Package className="w-5 h-5" />, name: "Product", category: "inventory", color: "bg-indigo-500", id: "ProductMaster" },
   { icon: <Hash className="w-5 h-5" />, name: "UOM", category: "inventory", color: "bg-green-600", id: "UomMaster" },
  { icon: <Hash className="w-5 h-5" />, name: "UOM Class", category: "inventory", color: "bg-green-700", id: "UomClassMaster" },
  { icon: <Truck className="w-5 h-5" />, name: "Transporter Master", category: "logistics", color: "bg-red-600", id: "TransportMaster" },
  { icon: <Landmark className="w-5 h-5" />, name: "Bank Account Type", category: "compliance", color: "bg-cyan-600", id: "BankAccountTypeMaster" },
  { icon: <IndianRupee className="w-5 h-5" />, name: "Payment Terms", category: "finance", color: "bg-teal-600", id: "PaymentTermsMaster" },
  { icon: <Warehouse className="w-5 h-5" />, name: "Warehouse Location", category: "inventory", color: "bg-orange-600", id: "WarehouseLocationMaster" },
  { icon: <UserCog className="w-5 h-5" />, name: "Designation Master", category: "administration", color: "bg-fuchsia-600", id: "DesignationMaster" },
  { icon: <FileText className="w-5 h-5" />, name: "Terms & Conditions", category: "compliance", color: "bg-sky-600", id: "TermsConditionsMaster", staffOnly: true },
  { icon: <Gauge className="w-5 h-5" />, name: "Product Stock Level", category: "inventory", color: "bg-pink-600", id: "ProductStockLevelMaster", staffOnly: true },
  { icon: <Receipt className="w-5 h-5" />, name: "TDS Section", category: "finance", color: "bg-rose-600", id: "TdsSectionMaster" },
  { icon: <FolderOpen className="w-5 h-5" />, name: "Supplier Category", category: "compliance", color: "bg-lime-600", id: "SupplierCatagoryMaster" },
  { icon: <Landmark className="w-5 h-5" />, name: "Payment Mode", category: "compliance", color: "bg-emerald-500", id: "PaymentModeMaster" },
  { icon: <Repeat className="w-5 h-5" />, name: "Service Type", category: "services", color: "bg-violet-500", id: "ServiceTypeMaster" },
  { icon: <Wrench className="w-5 h-5" />, name: "Service", category: "services", color: "bg-indigo-600", id: "ServiceMaster" },
  { icon: <Gauge className="w-5 h-5" />, name: "Recurrence Cadence", category: "services", color: "bg-teal-600", id: "RecurrenceCadenceMaster" },
  { icon: <BookOpen className="w-5 h-5" />, name: "Account Head", category: "finance", color: "bg-emerald-700", id: "AccountHeadMaster" },
  // The company's own bank accounts a Payment Run is paid from + the payment file each bank takes (sql/138)
  { icon: <Banknote className="w-5 h-5" />, name: "Payment Bank", category: "finance", color: "bg-sky-700", id: "PaymentBankMaster" },
  // The layout of the payment file, bank by bank: the format, then its columns (sql/149)
  { icon: <FileText className="w-5 h-5" />, name: "Bank File Format", category: "finance", color: "bg-sky-800", id: "BankFileFormatMaster" },
  { icon: <FileText className="w-5 h-5" />, name: "Bank File Format Columns", category: "finance", color: "bg-sky-900", id: "BankFileFormatColumnMaster" },

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

const useUomClassFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "uom_class_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "uom_class_code", label: "Code (e.g. MASS)", require: true, view: true, type: "text", input: true },
      { field: "uom_class_name", label: "Class Name", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const useUomMasterFields = (formData?: any): FieldType[] => {
  // Classes come from the UOM Class master (value = class code, which is what
  // uom_master.uom_class stores). Picking from a list rather than typing stops
  // a typo'd class (e.g. "Wieght") from orphaning a unit out of its class's
  // same-class conversion-unit picker on Product Master (see
  // useProductFieldsMaster's conversionUnitOptions below).
  const { options } = useMasterOptions(['UomClassMaster']);
  const uomClassOptions = options?.UomClassMaster;
  return useMemo<FieldType[]>(
    () => [
      { field: "uom_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "uom_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "uom_name", label: "Name", require: true, view: true, type: "text", input: true },
      { field: "uom_class", label: "UOM Class", require: true, view: true, type: "select", options: uomClassOptions || [], input: true },
      { field: "uom_base_uom_flag", label: "UOM Base", require: true, view: true, type: "text", input: true },
      // Leave blank for a packaging unit whose count varies per product
      // (e.g. Box) — that product then supplies its own conversion via
      // Product Master's "Pieces per Unit" field instead.
      { field: "uom_con_factor", label: "UOM Conversion Factor (blank if it varies by product, e.g. Box)", require: false, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [uomClassOptions]
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

const usePaymentTermsFieldsMaster = (formData?: any): FieldType[] => {
  return useMemo<FieldType[]>(
    () => [
      { field: "payment_terms_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "payment_terms_code", label: "Code", require: true, view: true, type: "text", input: true },
      { field: "payment_terms_name", label: "Payment Terms", require: true, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    []
  );
};

const YES_NO_OPTIONS: OptionType[] = [
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
];

const useTdsSectionFieldsMaster = (formData?: any): FieldType[] => {
  const applies_to_options: OptionType[] = useMemo(() => ([
    { label: "Services", value: "Service" },
    { label: "Products", value: "Product" },
    { label: "Services & Products", value: "Both" },
  ]), []);
  return useMemo<FieldType[]>(
    () => [
      { field: "tds_section_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "section_code", label: "Section", require: true, view: true, type: "text", input: true, placeholder: "e.g. 194C" },
      { field: "description", label: "Description", require: true, view: true, type: "text", input: true },
      { field: "applies_to", label: "Applies To", require: true, view: true, type: "select", options: applies_to_options, input: true },
      { field: "rate_individual", label: "Individual / HUF Rate (%)", require: true, view: true, type: "number", input: true },
      { field: "rate_other", label: "Company / Others Rate (%)", require: true, view: true, type: "number", input: true },
      { field: "rate_no_pan", label: "No PAN Rate (%)", require: false, view: true, type: "number", input: true, placeholder: "Default 20" },
      { field: "single_threshold", label: "Single Payment Limit", require: false, view: true, type: "number", input: true, placeholder: "0 = none" },
      { field: "annual_threshold", label: "Annual Limit", require: false, view: true, type: "number", input: true, placeholder: "0 = none" },
      { field: "excess_only", label: "Tax Only Above Annual Limit", require: false, view: true, type: "select", options: YES_NO_OPTIONS, input: true },
      { field: "is_goods_default", label: "Default Goods Section", require: false, view: true, type: "select", options: YES_NO_OPTIONS, input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [applies_to_options]
  );
};

const usePaymentModeFieldsMaster =(formData?: any): FieldType[] => {
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
  const { options, loading } = useMasterOptions(['ProductCategoryMaster', 'StockTypeMaster']);
  const { formData } = useAppState();
  return useMemo<FieldType[]>(
    () => [
      { field: "subcat_sno", label: "Sub Category ID", require: false, view: false, type: "text", input: false },

      { field: "cat_sno", label: "Category", require: true, view: false, type: "select", options: options?.ProductCategoryMaster, input: true },
      { field: "cat_name", label: "Category", require: true, view: true, type: "select", options: options?.ProductCategoryMaster, input: false },

      { field: "subcat_name", label: "Sub Category Name", require: true, view: true, type: "text", input: true },
      { field: "subcat_description", label: "Sub Category Description", require: false, view: true, type: "text", input: true },
      { field: "subcat_notes", label: "Sub Category Notes", require: false, view: true, type: "text", input: true },
      // Options come from the Stock Type master (sql/136). Built-ins: Regular =
      // day-to-day stock drawn via Store Requisition; Non-Regular = one-off/
      // specific-need items that skip requisition and go straight to Store
      // Issue once GRN receives them; Perishable = same auto-issue-off-GRN
      // fast path as Non-Regular, plus a shelf-life (below) that flags
      // unconsumed stock as Expiry Stock on the Inventory page. A type added in
      // the master behaves like Regular. Defaults to Regular server-side.
      {
        field: "subcat_stock_type", label: "Stock Type", require: false, view: true, type: "select",
        options: options?.StockTypeMaster || [],
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

const useStockTypeFieldsMaster = (): FieldType[] => {
  const { formData } = useAppState();
  // GRN auto-issue, asset tracking and expiry tracking key off a built-in type's
  // exact name, so it can't be renamed — the stored procedure rejects it too
  // (sql/136); only the description of a built-in row is editable.
  const nameLocked = formData?.is_system === "Y";
  return useMemo<FieldType[]>(
    () => [
      { field: "stock_type_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "stock_type_name", label: "Stock Type", require: true, view: true, type: "text", input: true, disabled: nameLocked },
      { field: "is_system", label: "Built-in", require: false, view: true, type: "select", options: YES_NO_OPTIONS, input: false },
      { field: "subcategory_count", label: "Sub Categories", require: false, view: true, type: "number", input: false },
      // Last on purpose: cells don't wrap, so a long description would push the columns after it off-screen.
      { field: "stock_type_desc", label: "Description", require: false, view: true, type: "textarea", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [nameLocked]
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
  const {options, loading} = useMasterOptions(['ProductCategoryMaster','ProductSubCategoryMaster','UomMaster','TaxMaster','AccountLedgerMaster']);

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

  // The "In Unit" picker offers every unit (no class restriction), so
  // "1 Tin = 20 ___" can be answered with any unit.
  const conversionUnitOptions = useMemo(
    () => options?.UomMaster ?? [],
    [options?.UomMaster]
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
      { field: "tax_sno", label: "GST", require: true, view: false, type: "select", options: options?.TaxMaster, input: false },
      // Ledger the purchase of this product is booked to (Tally trial balance). Optional: blank falls back to the sub-category, then Suspense.
      { field: "account_head_sno", label: "Account Head", require: false, view: false, type: "search-select", options: options?.AccountLedgerMaster, input: true,
        placeholder: "Ledger this product is booked to" },
      { field: "account_head_name", label: "Account Head", require: false, view: true, type: "text", input: false },
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

const HEAD_TYPE_OPTIONS: OptionType[] = [
  { label: "Asset", value: "ASSET" },
  { label: "Liability", value: "LIABILITY" },
  { label: "Expense", value: "EXPENSE" },
  { label: "Income", value: "INCOME" },
  { label: "Equity", value: "EQUITY" },
];

const useAccountHeadFieldsMaster = (formData?: any): FieldType[] => {
  const { options } = useMasterOptions(['AccountHeadMaster']);
  // only groups can be a parent
  const groupOptions = useMemo<OptionType[]>(
    () => (options?.AccountHeadMaster ?? []).filter((o: any) => o.is_group === 'Y'),
    [options?.AccountHeadMaster]
  );
  return useMemo<FieldType[]>(
    () => [
      { field: "head_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "head_code", label: "Code", require: false, view: true, type: "text", input: true, placeholder: "Auto if left blank" },
      { field: "head_name", label: "Account Head / Ledger Name", require: true, view: true, type: "text", input: true },
      { field: "head_type", label: "Type", require: true, view: true, type: "select", options: HEAD_TYPE_OPTIONS, input: true },
      { field: "parent_head_sno", label: "Under Group", require: false, view: false, type: "search-select", options: groupOptions, input: true },
      { field: "parent_name", label: "Under Group", require: false, view: true, type: "text", input: false },
      { field: "is_group", label: "Is a Group (holds other heads)", require: false, view: true, type: "select",
        options: [{ label: "No - ledger", value: "N" }, { label: "Yes - group", value: "Y" }], input: true },
      { field: "gst_rate", label: "GST Rate %", require: false, view: true, type: "number", input: true },
      { field: "product_count", label: "Products", require: false, view: true, type: "text", input: false },
      { field: "source", label: "Source", require: false, view: true, type: "text", input: false },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [groupOptions]
  );
};

/**
 * Payment Bank master: the SENDER of the payment file - which bank account the company pays from, the type of payment file that
 * bank takes, and what goes in the file name / e-mail position. The receiver's bank details come from the supplier KYC, not here.
 */
const usePaymentBankFieldsMaster = (): FieldType[] => {
  const { companyDetails, filteredDivDetails, filteredBranchDetails } = useAppState();
  const fileTypeOptions = useMemo<OptionType[]>(() => [{ label: "Bank upload file (28 fields, NEFT / RTGS)", value: "BANK_UPLOAD" }], []);
  const { options } = useMasterOptions(['BankFileFormatMaster']);
  return useMemo<FieldType[]>(
    () => [
      { field: "payment_bank_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "com_sno", label: "Company", require: true, view: false, type: "select", options: companyDetails || [], input: true },
      { field: "com_name", label: "Company", require: false, view: true, type: "text", input: false },
      { field: "div_sno", label: "Division", require: true, view: false, type: "select", options: filteredDivDetails || [], input: true },
      { field: "div_name", label: "Division", require: false, view: true, type: "text", input: false },
      { field: "brn_sno", label: "Business Branch", require: true, view: false, type: "select", options: filteredBranchDetails || [], input: true },
      { field: "brn_name", label: "Business Branch", require: false, view: true, type: "text", input: false },
      { field: "profile_name", label: "Account Name", require: true, view: true, type: "text", input: true, placeholder: "e.g. HDFC Current A/c" },
      { field: "bank_name", label: "Bank Name", require: true, view: true, type: "text", input: true },
      { field: "branch_name", label: "Bank Branch", require: false, view: true, type: "text", input: true },
      { field: "ac_holder_name", label: "Account Holder Name", require: true, view: true, type: "text", input: true },
      { field: "ac_number", label: "Account Number", require: true, view: true, type: "text", input: true, placeholder: "Digits only" },
      { field: "ifsc", label: "IFSC", require: true, view: true, type: "text", input: true, placeholder: "e.g. HDFC0000123" },
      // blank = the only type there is today; the stored procedure fills it in
      { field: "file_type", label: "Payment File Type", require: false, view: false, type: "select", options: fileTypeOptions, input: true },
      // The layout this bank's file is written in (Bank File Format master) - the file is written only from it
      { field: "file_format_sno", label: "Bank File Format", require: true, view: false, type: "select", options: options?.BankFileFormatMaster || [], input: true },
      { field: "file_format_name", label: "Bank File Format", require: false, view: true, type: "text", input: false },
      { field: "file_prefix", label: "File Name Prefix", require: true, view: true, type: "text", input: true, placeholder: "e.g. SPACETEX" },
      { field: "client_code", label: "Client Code", require: true, view: true, type: "text", input: true, placeholder: "e.g. SPA311" },
      { field: "file_code", label: "Starting File Code (.100)", require: true, view: true, type: "text", input: true, placeholder: "100 or .100" },
      // goes in the file wherever the Bank File Format column is "Our alert e-mail" (position 28 of the standard format)
      { field: "alert_email", label: "Alert E-mail (in the file)", require: false, view: true, type: "text", input: true, placeholder: "e.g. payment@company.com" },
      { field: "is_default", label: "Default Account", require: false, view: true, type: "select", options: YES_NO_OPTIONS, input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [companyDetails, filteredDivDetails, filteredBranchDetails, fileTypeOptions, options]
  );
};

/**
 * Bank File Format master: one layout of the payment file (separator, header line, line ending, quotes). Its fields are the
 * Bank File Format Column master. A Payment Bank account picks the layout its file is written in.
 */
const useBankFileFormatFieldsMaster = (): FieldType[] => {
  const delimiterOptions = useMemo<OptionType[]>(() => [
    { label: "Comma ( , )", value: "COMMA" }, { label: "Pipe ( | )", value: "PIPE" }, { label: "Tab", value: "TAB" },
    { label: "Semicolon ( ; )", value: "SEMICOLON" }, { label: "None - fixed width", value: "NONE" },
  ], []);
  const lineEndingOptions = useMemo<OptionType[]>(() => [{ label: "LF (Unix)", value: "LF" }, { label: "CRLF (Windows)", value: "CRLF" }], []);
  return useMemo<FieldType[]>(
    () => [
      { field: "format_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "format_name", label: "Format Name", require: true, view: true, type: "text", input: true, placeholder: "e.g. HDFC bulk NEFT" },
      { field: "delimiter", label: "Separator", require: false, view: true, type: "select", options: delimiterOptions, input: true },
      { field: "has_header", label: "Header Line", require: false, view: true, type: "select", options: YES_NO_OPTIONS, input: true },
      { field: "quote_text", label: "Quote Every Value", require: false, view: true, type: "select", options: YES_NO_OPTIONS, input: true },
      { field: "line_ending", label: "Line Ending", require: false, view: true, type: "select", options: lineEndingOptions, input: true },
      { field: "column_count", label: "Columns", require: false, view: true, type: "text", input: false },
      { field: "remarks", label: "Remarks", require: false, view: true, type: "text", input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [delimiterOptions, lineEndingOptions]
  );
};

/**
 * Bank File Format Column master: one field of a layout - its position on the line and where its value comes from.
 * Keep this list in step with grn-service paymentnet/bankFileFormat.js SOURCE_FIELDS and the check in sql/149.
 */
const BANK_FILE_SOURCE_OPTIONS: OptionType[] = [
  { label: "Transfer type code (N = NEFT, R = RTGS)", value: "TRANSFER_TYPE" },
  { label: "Payment mode (NEFT / RTGS)", value: "MODE" },
  { label: "Receiver's account number", value: "ACCOUNT_NO" },
  { label: "Amount the bank sends (2 decimals)", value: "AMOUNT" },
  { label: "Receiver's name", value: "BENEFICIARY_NAME" },
  { label: "Reference (supplier id-payment no)", value: "REFERENCE" },
  { label: "Payment number", value: "PAYMENT_NO" },
  { label: "Supplier id", value: "SUPPLIER_CODE" },
  { label: "Payment details 1 (invoice no(s) / tax head)", value: "DETAIL_1" },
  { label: "Payment details 2 (FULL / PART / period)", value: "DETAIL_2" },
  { label: "Payment details 3 (TDS, advance, notes / registration no)", value: "DETAIL_3" },
  { label: "Payment date", value: "PAYMENT_DATE" },
  { label: "Receiver's IFSC", value: "IFSC" },
  { label: "Receiver's bank", value: "BANK_NAME" },
  { label: "Receiver's branch", value: "BRANCH_NAME" },
  { label: "Line number in the file", value: "SERIAL_NO" },
  { label: "Our account number", value: "SENDER_ACCOUNT_NO" },
  { label: "Our account holder name", value: "SENDER_NAME" },
  { label: "Our IFSC", value: "SENDER_IFSC" },
  { label: "Our bank", value: "SENDER_BANK_NAME" },
  { label: "Our client code with the bank", value: "SENDER_CLIENT_CODE" },
  { label: "Our alert e-mail", value: "SENDER_EMAIL" },
  { label: "Fixed text (type it in 'Fixed Text')", value: "FIXED" },
  { label: "Empty", value: "BLANK" },
];
const useBankFileFormatColumnFieldsMaster = (): FieldType[] => {
  const { options } = useMasterOptions(['BankFileFormatMaster']);
  const padOptions = useMemo<OptionType[]>(() => [{ label: "Left", value: "L" }, { label: "Right", value: "R" }], []);
  const dateOptions = useMemo<OptionType[]>(() => ["DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DDMMYYYY", "YYYYMMDD"].map((v) => ({ label: v, value: v })), []);
  return useMemo<FieldType[]>(
    () => [
      { field: "column_sno", label: "S.No", require: false, view: false, type: "text", input: false },
      { field: "format_sno", label: "Format", require: true, view: false, type: "select", options: options?.BankFileFormatMaster || [], input: true },
      { field: "format_name", label: "Format", require: false, view: true, type: "text", input: false },
      { field: "position", label: "Position", require: true, view: true, type: "number", input: true, placeholder: "1, 2, 3 ..." },
      { field: "header_text", label: "Header Text", require: false, view: true, type: "text", input: true },
      { field: "source_field", label: "Value Comes From", require: true, view: true, type: "select", options: BANK_FILE_SOURCE_OPTIONS, input: true },
      { field: "fixed_value", label: "Fixed Text", require: false, view: true, type: "text", input: true, placeholder: "only for Fixed text" },
      { field: "max_len", label: "Max Length", require: false, view: true, type: "number", input: true },
      { field: "pad_side", label: "Pad On", require: false, view: true, type: "select", options: padOptions, input: true },
      { field: "pad_char", label: "Pad Character", require: false, view: true, type: "text", input: true, placeholder: "one character, e.g. 0" },
      { field: "date_format", label: "Date Format", require: false, view: true, type: "select", options: dateOptions, input: true },
      { field: "is_active", label: "Active Status", require: false, view: false, type: "text", input: false },
    ],
    [options, padOptions, dateOptions]
  );
};

export {
  masterItems,
  usePaymentBankFieldsMaster,
  useBankFileFormatFieldsMaster,
  useBankFileFormatColumnFieldsMaster,
  useAccountHeadFieldsMaster,
  useStockTypeFieldsMaster,
  useCompanyMasterFields,
  useDivisionMasterFields,
  useBranchMasterFields,
  useUomMasterFields,
  useUomClassFieldsMaster,
  useTransportMasterFields,
  useAcYearFields,
  useGSTMasterFields,
  useDeptMasterFields,
  usePrefixFieldsMaster,
  usePriorityFieldsMaster,
  useBankAccountTypeFieldsMaster,
  useTdsSectionFieldsMaster,
  usePaymentTermsFieldsMaster,
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

