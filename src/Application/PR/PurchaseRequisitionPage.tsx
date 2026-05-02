import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {  Plus,  Trash2,  Edit2,  Check,  X,  Save,  Send,  FileText,  RefreshCw,  Building2,  Package,  Users,  FileSpreadsheet,  Upload,  Wrench,  Paperclip,} from 'lucide-react';
import { downloadExcelTemplate, parseExcelFile } from '@/utils/excelUtils';
import { FormSection } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePRBasicInfoFields, usePRItemDetailsFields } from '@/FieldDatas/PRData';
import axios from 'axios';
import {
  createPrRecord,
  prSaveDraft,
  prUpdateDraft,
  prDeleteDraft,
  prSaveDeptDraft,
  prUpdateDeptDraft,
} from '@/Services/Api';

import { SOCKET_JOIN_PR_SCOPE, SOCKET_LEAVE_PR_SCOPE } from '@/Services/Socket';
import { toast } from 'sonner';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import PRDraftSidebar, { type DeptDraft } from './PRDraftSidebar';
import { de } from 'date-fns/locale';

interface FormErrors {
  [key: string]: string;
}

const NAME_FIELD_MAP: Record<string, string> = {
  com_sno: 'com_name',
  div_sno: 'div_name',
  brn_sno: 'brn_name',
  dept_sno: 'dept_name',
  priority_sno: 'priority_name',
  prod_sno: 'prod_name',
  unit_sno: 'unit_name',
};

function resolveNameField(fieldName: string): string {
  return NAME_FIELD_MAP[fieldName] ?? fieldName.replace('_sno', '_name');
}

interface PRPageProps {
  editDraftId?: string;
  editDraftData?: Record<string, any>;
  onDraftSubmitted?: () => void;
}

const PurchaseRequisitionPage: React.FC<PRPageProps> = ({
  editDraftId,
  editDraftData,
  onDraftSubmitted,
}) => {
  const { data: hierarchyData, userData, socket } = useAppState();
  const { canCreate, canEdit } = usePermissions();

  const currentUserEcno: string = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u?.ecno ?? '';
  }, [userData]);

  // Cascade tracking
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // currentItem must be declared before usePRItemDetailsFields so itemType can drive conditional fields
  const [currentItem, setCurrentItem] = useState<Record<string, any>>({});
  const currentItemType: string = currentItem.item_type ?? '';

  const basicInfoFields = usePRBasicInfoFields({
    hierarchyData,
    selectedCompany,
    selectedDivision,
    selectedBranch,
  });
  const itemDetailsFields = usePRItemDetailsFields({ itemType: currentItemType });

  // Scope key for shared drafts: "{com_sno}:{div_sno}:{brn_sno}"
  const [scopeKey, setScopeKey] = useState<string | null>(null);

  // Draft state
  const [basicFormData, setBasicFormData] = useState<Record<string, any>>({});
  const [savedItems, setSavedItems] = useState<Record<string, any>[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [itemErrors, setItemErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(editDraftId ?? null);
  const [deptDraftId, setDeptDraftId] = useState<string | null>(null);
  const [deptDraftScopeKey, setDeptDraftScopeKey] = useState<string | null>(null);

  // Sidebar: editing a dept draft
  const [sidebarEditDraft, setSidebarEditDraft] = useState<DeptDraft | null>(null);

  const itemImportRef = useRef<HTMLInputElement>(null);
  const [importingItems, setImportingItems] = useState(false);


  // ── Excel helpers ─────────────────────────────────────────────────────────

  const handleDownloadItemTemplate = () => {
    downloadExcelTemplate(excelItemFields, 'PR_Items');
    toast.success('Item template downloaded — fill it and import back');
  };

  const handleImportItems = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportingItems(true);
    try {
      const { rows, errors } = await parseExcelFile(file, excelItemFields);

      if (errors.length > 0) errors.forEach((err) => toast.error(err));

      if (rows.length === 0) {
        toast.error('No valid rows found in the file');
        return;
      }

      const newItems = rows.map((row) => {
        const qty = parseFloat(String(row.qty)) || 1;
        return {
          ...buildEmptyItem(),
          ...row,
          qty,
          id: Date.now().toString() + Math.random().toString(36).slice(2),
        };
      });

      setSavedItems((prev) => [...prev, ...newItems]);
      toast.success(`${newItems.length} item${newItems.length > 1 ? 's' : ''} imported`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImportingItems(false);
    }
  };

  // ── Initial form state builders ──────────────────────────────────────────

  const buildInitialBasicFormData = useCallback(() => {
    const d: Record<string, any> = {};
    basicInfoFields.forEach((field: FieldType) => {
      if (!field.input) return;
      if (field.defaultValue !== undefined) {
        d[field.field] = field.defaultValue;
      } else if (field.type === 'date') {
        d[field.field] = new Date().toISOString().split('T')[0];
      } else if (field.type === 'number') {
        d[field.field] = 0;
      } else {
        d[field.field] = '';
      }
    });
    return d;
  }, [basicInfoFields]);

  const buildEmptyItem = useCallback(() => {
    const item: Record<string, any> = { item_type: '', item_attachment: null };
    itemDetailsFields.forEach((field: FieldType) => {
      if (!field.input || field.field === 'pr_item_sno' || field.field === 'pr_basic_sno') return;
      if (field.field === 'item_type' || field.field === 'item_attachment') return; // already set above
      if (field.defaultValue !== undefined) item[field.field] = field.defaultValue;
      else if (field.field === 'qty') item[field.field] = 1;
      else if (field.field === 'is_active') item[field.field] = true;
      else if (field.type === 'number') item[field.field] = 0;
      else if (field.type === 'file') item[field.field] = null;
      else item[field.field] = '';
    });
    return item;
  }, [itemDetailsFields]);

  // Initialize form state once field definitions are ready
  useEffect(() => {
    if (Object.keys(basicFormData).length === 0) {
      setBasicFormData(buildInitialBasicFormData());
    }
  }, [buildInitialBasicFormData]);

  useEffect(() => {
    if (Object.keys(currentItem).length === 0) {
      setCurrentItem(buildEmptyItem());
    }
  }, [buildEmptyItem]);

  // Load draft data if editing an existing draft
  useEffect(() => {
    if (editDraftData) {
      const basicInfo = editDraftData.basicInfo || {};
      setBasicFormData(basicInfo);
      setSavedItems(editDraftData.items || []);
      if (basicInfo.com_sno) setSelectedCompany(String(basicInfo.com_sno));
      if (basicInfo.div_sno) setSelectedDivision(String(basicInfo.div_sno));
      if (basicInfo.brn_sno) setSelectedBranch(String(basicInfo.brn_sno));
    }
  }, [editDraftData]);

  // Load sidebar-edited draft
  useEffect(() => {
    if (sidebarEditDraft) {
      const basicInfo = sidebarEditDraft.basicInfo || {};
      setBasicFormData(basicInfo as Record<string, any>);
      setSavedItems(sidebarEditDraft.items || []);
      setDeptDraftId(sidebarEditDraft.draftId);
      setDeptDraftScopeKey(sidebarEditDraft.scopeKey);
      if ((basicInfo as any).com_sno) setSelectedCompany(String((basicInfo as any).com_sno));
      if ((basicInfo as any).div_sno) setSelectedDivision(String((basicInfo as any).div_sno));
      if ((basicInfo as any).brn_sno) setSelectedBranch(String((basicInfo as any).brn_sno));
    }
  }, [sidebarEditDraft]);

  // ── Scope key: update when hierarchy selection changes ───────────────────

  useEffect(() => {
    const { com_sno, div_sno, brn_sno, dept_sno } = basicFormData;
    if (com_sno && div_sno && brn_sno && dept_sno) {
      const key = `${com_sno}:${div_sno}:${brn_sno}:${dept_sno}`;
      setScopeKey(key);
    } else {
      setScopeKey(null);
    }
  }, [basicFormData.com_sno, basicFormData.div_sno, basicFormData.brn_sno, basicFormData.dept_sno]);

  // ── Socket.IO: join/leave pr:scope room when scopeKey changes ────────────

  useEffect(() => {
    if (!socket) return;
    if (scopeKey) {
      socket.emit(SOCKET_JOIN_PR_SCOPE, scopeKey);
      return () => {
        socket.emit(SOCKET_LEAVE_PR_SCOPE, scopeKey);
      };
    }
  }, [scopeKey, socket]);

  // ── Field change handlers ─────────────────────────────────────────────────

  const handleBasicFieldChange = (fieldName: string, value: any) => {
    setBasicFormData((prev) => {
      const updated = { ...prev, [fieldName]: value };

      if (fieldName === 'com_sno') {
        updated.div_sno = '';
        updated.div_name = '';
        updated.brn_sno = '';
        updated.brn_name = '';
        updated.dept_sno = '';
        updated.dept_name = '';
        setSelectedCompany(String(value));
        setSelectedDivision('');
        setSelectedBranch('');
      } else if (fieldName === 'div_sno') {
        updated.brn_sno = '';
        updated.brn_name = '';
        updated.dept_sno = '';
        updated.dept_name = '';
        setSelectedDivision(String(value));
        setSelectedBranch('');
      } else if (fieldName === 'brn_sno') {
        updated.dept_sno = '';
        updated.dept_name = '';
        setSelectedBranch(String(value));
      }

      const field = basicInfoFields.find((f) => f.field === fieldName);
      if (field?.options && Array.isArray(field.options)) {
        const selectedOption = (field.options as any[]).find(
          (opt) => String(opt.value) === String(value)
        );
        if (selectedOption) {
          updated[resolveNameField(fieldName)] = selectedOption.label;
        }
      }

      return updated;
    });

    if (errors[fieldName]) {
      setErrors((prev) => {
        const e = { ...prev };
        delete e[fieldName];
        return e;
      });
    }
  };

  const handleItemFieldChange = (fieldName: string, value: any) => {
    setCurrentItem((prev) => {
      const updated = { ...prev, [fieldName]: value };

      // When product is selected, auto-fill UOM from product data (if available)
      if (fieldName === 'prod_sno' && value) {
        const prodField = itemDetailsFields.find((f) => f.field === 'prod_sno');
        const selectedProduct = (prodField?.options as any[])?.find(
          (opt) => String(opt.value) === String(value)
        );
        if (selectedProduct) {
          updated.prod_name = selectedProduct.label;
          if (selectedProduct.uom_sno) {
            updated.unit_sno = String(selectedProduct.uom_sno);
            updated.unit_name = selectedProduct.uom_name ?? '';
          }
        }
      }

      // When switching category, clear fields belonging to the other type
      if (fieldName === 'item_type') {
        if (value === 'service') {
          updated.prod_sno = '';
          updated.prod_name = '';
          updated.item_attachment = null;
        } else {
          updated.service_desc = '';
        }
      }

      const field = itemDetailsFields.find((f) => f.field === fieldName);
      if (field?.options && Array.isArray(field.options) && fieldName !== 'prod_sno' && fieldName !== 'item_type') {
        const selectedOption = (field.options as any[]).find(
          (opt) => String(opt.value) === String(value)
        );
        if (selectedOption) {
          updated[resolveNameField(fieldName)] = selectedOption.label;
        }
      }

      return updated;
    });

    if (itemErrors[fieldName]) {
      setItemErrors((prev) => {
        const e = { ...prev };
        delete e[fieldName];
        return e;
      });
    }
  };

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  const inputItemFields = useMemo(
    () => itemDetailsFields.filter((f) => f.input),
    [itemDetailsFields]
  );

  const viewItemFields = useMemo(
    () => itemDetailsFields.filter((f) => f.view),
    [itemDetailsFields]
  );

  const excelItemFields = useMemo(
    () =>
      inputItemFields
        .filter((f) => !['item_type', 'item_attachment'].includes(f.field) && !['checkbox', 'switch', 'file', 'radio'].includes(f.type ?? ''))
        .map((f) => ({
          field: f.field,
          label: f.label,
          type: f.type,
          require: f.require,
          options: Array.isArray(f.options) ? f.options : [],
        })),
    [inputItemFields]
  );

  const validateItem = (): boolean => {
    const errs: FormErrors = {};
    if (!currentItem.item_type) {
      errs.item_type = 'Please select Product or Service';
    }
    inputItemFields.forEach((field) => {
      if (['file', 'radio'].includes(field.type)) return;
      if (field.require && !currentItem[field.field]) {
        errs[field.field] = `${field.label} is required`;
      }
      if (field.field === 'qty' && (currentItem.qty <= 0 || !currentItem.qty)) {
        errs.qty = 'Quantity must be greater than 0';
      }
    });
    setItemErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddItem = () => {
    if (!validateItem()) return;
    setSavedItems((prev) => [...prev, { ...currentItem, id: Date.now().toString() }]);
    setCurrentItem(buildEmptyItem());
    setItemErrors({});
  };

  const handleEditItem = (itemId: string) => {
    const item = savedItems.find((i) => i.id === itemId);
    if (!item) return;
    const { id, ...rest } = item;
    setCurrentItem(rest);
    setEditingItemId(itemId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateItem = () => {
    if (!validateItem() || !editingItemId) return;
    setSavedItems((prev) =>
      prev.map((item) => (item.id === editingItemId ? { ...currentItem, id: editingItemId } : item))
    );
    setCurrentItem(buildEmptyItem());
    setEditingItemId(null);
    setItemErrors({});
  };

  const handleCancelEdit = () => {
    setCurrentItem(buildEmptyItem());
    setEditingItemId(null);
    setItemErrors({});
  };

  const handleDeleteItem = (itemId: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== itemId));
    if (editingItemId === itemId) handleCancelEdit();
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const inputBasicFields = useMemo(
    () => basicInfoFields.filter((f) => f.input),
    [basicInfoFields]
  );

  const validateBasicForm = (): boolean => {
    const errs: FormErrors = {};
    inputBasicFields.forEach((field) => {
      if (field.require && !basicFormData[field.field]) {
        errs[field.field] = `${field.label} is required`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Required Days ─────────────────────────────────────────────────────────

  const requiredDays = useMemo(() => {
    const { req_date, required_date } = basicFormData;
    if (!req_date || !required_date) return null;
    const diff = Math.round(
      (new Date(required_date).getTime() - new Date(req_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  }, [basicFormData.req_date, basicFormData.required_date]);

  // ── Draft Actions ─────────────────────────────────────────────────────────

  // For final submission — sends files as binary via FormData so backend uploads to FTP
  const buildFormData = (): FormData => {
    const formData = new FormData();
    const items = savedItems.map(({ id, ...item }) => {
      const resolved = { ...item, is_active: true };
      if (resolved.item_attachment instanceof File) {
        resolved.item_attachment = null; // replaced by the indexed field below
      }
      return resolved;
    });

    formData.append('basicInfo', JSON.stringify({ ...basicFormData, is_active: true }));
    formData.append('items', JSON.stringify(items));

    savedItems.forEach(({ item_attachment }, idx) => {
      if (item_attachment instanceof File) {
        formData.append(`item_attachment_${idx}`, item_attachment);
      }
    });

    return formData;
  };

  // For draft save/update — JSON only, File objects stripped (drafts are temporary, no FTP)
  const buildDraftPayload = () => {
    const items = savedItems.map(({ id, ...item }) => {
      const resolved = { ...item, is_active: true };
      if (resolved.item_attachment instanceof File) {
        resolved.item_attachment = null;
      }
      return resolved;
    });
    return {
      basicInfo: { ...basicFormData, is_active: true },
      items,
    };
  };

  // Save as shared dept draft
  const saveToDeptDraft = async () => {
    const payload = { ...buildDraftPayload(), scopeKey };
    if (deptDraftId && deptDraftScopeKey) {
      const res = await axios.put(
        prUpdateDeptDraft(deptDraftId),
        { ...payload, scopeKey: deptDraftScopeKey }
      );
      return res;
    } else {
      const res = await axios.post(prSaveDeptDraft, payload);
      if (res.data?.draftId) {
        setDeptDraftId(res.data.draftId);
        setDeptDraftScopeKey(res.data.scopeKey);
      }
      return res;
    }
  };

  const handleSaveAsDraft = async () => {
    if (!validateBasicForm()) {
      toast.error('Please fill the required basic info fields before saving as draft');
      return;
    }
    setSavingDraft(true);
    try {
      const payload = buildDraftPayload();
      let res;
      if (draftId) {
        res = await axios.put(prUpdateDraft(draftId), payload);
        toast.success('Draft updated');
      } else {
        res = await axios.post(prSaveDraft, payload);
        if (res.data?.draftId) setDraftId(res.data.draftId);
        toast.success('Draft saved — continue editing or submit later');
      }
    } catch {
      toast.error('Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAsSharedDraft = async () => {
    if (!validateBasicForm()) {
      toast.error('Please fill the required basic info fields before saving as draft');
      return;
    }
    if (!scopeKey) {
      toast.error('Select Company, Division and Branch first to save a shared draft');
      return;
    }
    setSavingDraft(true);
    try {
      await saveToDeptDraft();
      toast.success(
        deptDraftId ? 'Shared draft updated — visible to your team' : 'Shared draft saved — your team can see it in real time'
      );
    } catch {
      toast.error('Failed to save shared draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (savedItems.length === 0) {
      toast.error('Please add at least one item to the requisition');
      return;
    }

    setSubmitting(true);
    try {
      const formData = buildFormData();
      const res = await axios.post(createPrRecord, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Clean up private draft if one was open
      if (draftId) {
        try { await axios.delete(prDeleteDraft(draftId)); } catch { /* silent */ }
      }

      const msg = res?.data?.data?.[0]?.Message || 'Purchase Requisition submitted successfully!';
      toast.success(msg);
      handleReset();
      onDraftSubmitted?.();
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || 'Submission failed. Please try again.';
      toast.error(errMsg);

      // Auto-save to shared draft on failure
      if (validateBasicForm() && scopeKey) {
        try {
          await saveToDeptDraft();
          toast.info('Your data was auto-saved as a shared draft.');
        } catch {
          // Silent — user already sees the submit error
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setBasicFormData(buildInitialBasicFormData());
    setCurrentItem(buildEmptyItem());
    setSavedItems([]);
    setEditingItemId(null);
    setErrors({});
    setItemErrors({});
    setSelectedCompany('');
    setSelectedDivision('');
    setSelectedBranch('');
    setDraftId(null);
    setDeptDraftId(null);
    setDeptDraftScopeKey(null);
    setSidebarEditDraft(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Separate textarea fields to always render full-width at bottom
  const basicGridFields = useMemo(
    () => inputBasicFields.filter((f) => f.type !== 'textarea'),
    [inputBasicFields]
  );
  const basicTextareaFields = useMemo(
    () => inputBasicFields.filter((f) => f.type === 'textarea'),
    [inputBasicFields]
  );

  const itemTypeField = useMemo(
    () => inputItemFields.find((f) => f.field === 'item_type') ?? null,
    [inputItemFields]
  );
  const itemAttachmentField = useMemo(
    () => inputItemFields.find((f) => f.field === 'item_attachment') ?? null,
    [inputItemFields]
  );
  const itemGridFields = useMemo(
    () => inputItemFields.filter((f) =>
      f.type !== 'textarea' &&
      f.field !== 'item_type' &&
      f.field !== 'item_attachment'
    ),
    [inputItemFields]
  );
  const itemTextareaFields = useMemo(
    () => inputItemFields.filter((f) => f.type === 'textarea'),
    [inputItemFields]
  );

  const isDeptDraftMode = !!(deptDraftId && deptDraftScopeKey);
  const isPrivateDraftMode = !!draftId && !isDeptDraftMode;

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-screen">
      {/* Page Header */}
      <div className="bg-background border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Purchase Requisition</h1>
            <p className="text-xs text-muted-foreground">Non-trade purchase requisition form</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDeptDraftMode && (
            <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
              <Users className="h-3 w-3 mr-1" />
              Editing Shared Draft
            </Badge>
          )}
          {isPrivateDraftMode && (
            <Badge variant="secondary" className="text-xs">
              <Save className="h-3 w-3 mr-1" />
              Private Draft
            </Badge>
          )}
          {scopeKey && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Scope: {[basicFormData.com_sno, basicFormData.div_sno, basicFormData.brn_sno, basicFormData.dept_sno].filter(Boolean).join(' › ')}
            </Badge>
          )}
        </div>
      </div>

      {/* Main form */}
      <div className="container mx-auto py-6 px-4">
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Basic Information ─────────────────────────────────── */}
              <FormSection icon={Building2} title="Basic Information">

                {/* Main grid fields (selects, dates, numbers) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                  {basicGridFields.map((field) => (
                    <div
                      key={field.field}
                      data-error={!!errors[field.field]}
                      className="flex flex-col"
                    >
                      {field.field === 'required_date' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Label
                              htmlFor={field.field}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {field.label}
                              {field.require && <span className="text-red-500 ml-0.5">*</span>}
                            </Label>
                            {requiredDays !== null && (
                              <span className={`text-xs font-semibold px-1.5 py-0.3 rounded-full ${requiredDays < 0 ? 'bg-destructive/10 text-destructive' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'}`}>
                                {requiredDays < 0 ? `${requiredDays}d` : `+${requiredDays}d`}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Input
                              id={field.field}
                              name={field.field}
                              type="date"
                              className={cn('h-10', errors[field.field] && 'border-red-500')}
                              value={basicFormData[field.field] ?? ''}
                              onChange={(e) => handleBasicFieldChange(field.field, e.target.value)}
                              required={field.require}
                            />
                            {errors[field.field] && (
                              <p className="text-sm text-red-600">{errors[field.field]}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <CustomInputField
                          field={field.field}
                          label={field.label}
                          require={field.require}
                          type={field.type}
                          options={field.options}
                          value={basicFormData[field.field] ?? ''}
                          onChange={(value) => handleBasicFieldChange(field.field, value)}
                          error={errors[field.field]}
                          placeholder={
                            field.type === 'select'
                              ? `Select ${field.label.toLowerCase()}`
                              : undefined
                          }
                          className="h-10"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Textarea fields — full width */}
                {basicTextareaFields.map((field) => (
                  <div key={field.field} data-error={!!errors[field.field]}>
                    <CustomInputField
                      field={field.field}
                      label={field.label}
                      require={field.require}
                      type={field.type}
                      value={basicFormData[field.field] ?? ''}
                      onChange={(value) => handleBasicFieldChange(field.field, value)}
                      error={errors[field.field]}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                ))}

                {Object.keys(errors).length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <ul className="list-disc list-inside text-destructive text-xs space-y-0.5">
                      {Object.values(errors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </FormSection>

              {/* ── Item Entry ────────────────────────────────────────── */}
              {/* Hidden file input for Excel import */}
              <input
                ref={itemImportRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportItems}
              />

              <FormSection
                icon={Package}
                title={editingItemId ? 'Edit Item' : 'Add Item'}
                action={
                  editingItemId ? (
                    <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 text-xs">
                      <X className="h-3.5 w-3.5 mr-1" />Cancel Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadItemTemplate}
                        className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        title="Download Excel template for bulk item entry"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Template
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => itemImportRef.current?.click()}
                        disabled={importingItems}
                        className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                        title="Import multiple items from Excel"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {importingItems ? 'Importing…' : 'Import'}
                      </Button>
                    </div>
                  )
                }
              >

                <div className="rounded-xl border bg-muted/20 p-4 space-y-4">

                  {/* ── Category toggle (Product / Service) ── */}
                  {itemTypeField && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Category <span className="text-red-500">*</span>
                      </p>
                      <div className="flex gap-2">
                        {[
                          { value: 'product', label: 'Product', Icon: Package },
                          { value: 'service', label: 'Service', Icon: Wrench },
                        ].map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleItemFieldChange('item_type', value)}
                            className={cn(
                              'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                              currentItemType === value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </button>
                        ))}
                      </div>
                      {itemErrors.item_type && (
                        <p className="text-sm text-red-600 mt-1">{itemErrors.item_type}</p>
                      )}
                    </div>
                  )}

                  {/* ── Grid fields ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                    {itemGridFields.map((field) => (
                      <div key={field.field} data-error={!!itemErrors[field.field]} className="flex flex-col">
                        <CustomInputField
                          field={field.field}
                          label={field.label}
                          require={field.require}
                          type={field.type}
                          options={field.options}
                          value={currentItem[field.field] ?? ''}
                          onChange={(value) => handleItemFieldChange(field.field, value)}
                          error={itemErrors[field.field]}
                          placeholder={
                            field.type === 'number' ? '0' : `Select ${field.label.toLowerCase()}`
                          }
                          className="h-10"
                        />
                      </div>
                    ))}
                      {itemAttachmentField && (
                    <div className='w-60'>
                      {/* <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {itemAttachmentField.label}
                        <span className="text-muted-foreground/60 font-normal">(optional)</span>
                      </p> */}
                      <CustomInputField
                        field={itemAttachmentField.field}
                        label={itemAttachmentField.label}
                        type={itemAttachmentField.type}
                        value={currentItem[itemAttachmentField.field] ?? null}
                        onChange={(file) => handleItemFieldChange(itemAttachmentField.field, file)}
                      />
                    </div>
                  )}

                  </div>

                
                  {/* ── Textarea fields (service description, remarks) ── */}
                  {itemTextareaFields.map((field) => (
                    <div key={field.field} data-error={!!itemErrors[field.field]}>
                      <CustomInputField
                        field={field.field}
                        label={field.label}
                        require={field.require}
                        type={field.type}
                        value={currentItem[field.field] ?? ''}
                        onChange={(value) => handleItemFieldChange(field.field, value)}
                        error={itemErrors[field.field]}
                        placeholder={field.field === 'service_desc' ? 'Describe the service required...' : 'Enter remarks...'}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  ))}

                  {Object.keys(itemErrors).length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                      <ul className="list-disc list-inside text-destructive text-xs space-y-0.5">
                        {Object.values(itemErrors).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    {editingItemId ? (
                      <Button
                        type="button"
                        onClick={handleUpdateItem}
                        className="bg-emerald-600 hover:bg-emerald-700 h-9"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Update Item
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className="bg-blue-600 hover:bg-blue-700 h-9"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    )}
                  </div>
                </div>
              </FormSection>

              {/* ── Items Table ───────────────────────────────────────── */}
              {savedItems.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Items List
                    <Badge variant="secondary">{savedItems.length}</Badge>
                  </h3>
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="w-12 text-center text-xs">#</TableHead>
                          {viewItemFields.map((field) => (
                            <TableHead key={field.field} className="text-xs">
                              {field.label}
                            </TableHead>
                          ))}
                          <TableHead className="w-20 text-center text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {savedItems.map((item, index) => (
                          <TableRow
                            key={item.id}
                            className={editingItemId === item.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
                          >
                            <TableCell className="text-center text-xs text-muted-foreground font-medium">
                              {index + 1}
                            </TableCell>
                            {viewItemFields.map((field) => (
                              <TableCell key={field.field} className="text-xs">
                                {field.field === 'item_type' ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-xs capitalize',
                                      item.item_type === 'product'
                                        ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400'
                                        : 'border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-400'
                                    )}
                                  >
                                    {item.item_type === 'product' ? (
                                      <Package className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Wrench className="h-3 w-3 mr-1" />
                                    )}
                                    {item.item_type || '—'}
                                  </Badge>
                                ) : (
                                  <span>{item[field.field] ?? '—'}</span>
                                )}
                              </TableCell>
                            ))}
                            <TableCell>
                              <div className="flex gap-0.5 justify-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditItem(item.id)}
                                  disabled={editingItemId !== null}
                                  className="h-7 w-7"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Item count */}
                  <div className="flex justify-end">
                    <div className="bg-muted/30 rounded-xl px-4 py-2 border text-xs text-muted-foreground">
                      Total Items: <span className="font-medium text-foreground">{savedItems.length}</span>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="text-center py-10 text-muted-foreground border rounded-xl bg-muted/10">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No items added yet.</p>
                  <p className="text-xs mt-1 opacity-70">Fill in the item details above and click "Add Item".</p>
                </div>
              )}

              {/* ── Action Buttons ────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={submitting || savingDraft}
                  className="h-9"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Private draft */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAsDraft}
                    disabled={submitting || savingDraft}
                    className="h-9"
                  >
                    {savingDraft ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {draftId ? 'Update Draft' : 'Save Draft'}
                  </Button>

                  {/* Shared draft */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAsSharedDraft}
                    disabled={submitting || savingDraft || !scopeKey}
                    className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    title={!scopeKey ? 'Select Company, Division, Branch and Department first' : ''}
                  >
                    {savingDraft ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4 mr-2" />
                    )}
                    {isDeptDraftMode ? 'Update Shared' : 'Save as Shared'}
                  </Button>

                  {/* Submit — only shown if user can create */}
                  {(canCreate("PurchaseRequisitionPage") || canEdit("PurchaseRequisitionPage")) && (
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 h-9"
                    disabled={savedItems.length === 0 || submitting || savingDraft}
                  >
                    {submitting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Requisition
                  </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Real-time shared draft sidebar */}
      {/* <PRDraftSidebar
        scopeKey={scopeKey}
        socket={socket as any}
        onEditDraft={(draft) => setSidebarEditDraft(draft)}
        currentUserEcno={currentUserEcno}
      /> */}
    </div>
  );
};

export default PurchaseRequisitionPage;
