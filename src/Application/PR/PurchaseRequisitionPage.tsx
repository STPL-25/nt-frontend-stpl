import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Save,
  Send,
  FileText,
  RefreshCw,
  Building2,
  Package,
  Users,
} from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePRBasicInfoFields, usePRItemDetailsFields } from '@/FieldDatas/PRData';
import usePost from '@/hooks/usePostHook';
import axios from 'axios';
import {
  createPrRecord,
  prSaveDraft,
  prUpdateDraft,
  prSubmitDraft,
  prSaveDeptDraft,
  prUpdateDeptDraft,
} from '@/Services/Api';
import { toast } from 'sonner';
import { useAppState } from '@/globalState/hooks/useAppState';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import PRDraftSidebar, { type DeptDraft } from './PRDraftSidebar';

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

  const currentUserEcno: string = useMemo(() => {
    const u = Array.isArray(userData) ? userData[0] : userData;
    return u?.ecno ?? '';
  }, [userData]);

  // Cascade tracking
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const basicInfoFields = usePRBasicInfoFields({
    hierarchyData,
    selectedCompany,
    selectedDivision,
    selectedBranch,
  });
  const itemDetailsFields = usePRItemDetailsFields();

  // Scope key for shared drafts: "{com_sno}:{div_sno}:{brn_sno}"
  const [scopeKey, setScopeKey] = useState<string | null>(null);

  // Draft state
  const [basicFormData, setBasicFormData] = useState<Record<string, any>>({});
  const [currentItem, setCurrentItem] = useState<Record<string, any>>({});
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

  const { postData } = usePost();

  // ── Initial form state builders ──────────────────────────────────────────

  const buildInitialBasicFormData = useCallback(() => {
    const d: Record<string, any> = {};
    basicInfoFields.forEach((field: FieldType) => {
      if (!field.input) return;
      if (field.defaultValue !== undefined) {
        d[field.field] = field.defaultValue;
      } else if (field.field === 'req_date') {
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
    const item: Record<string, any> = {};
    itemDetailsFields.forEach((field: FieldType) => {
      if (!field.input || field.field === 'pr_item_sno' || field.field === 'pr_basic_sno') return;
      if (field.defaultValue !== undefined) item[field.field] = field.defaultValue;
      else if (field.field === 'qty') item[field.field] = 1;
      else if (field.field === 'est_cost' || field.field === 'total_cost') item[field.field] = 0;
      else if (field.field === 'is_active') item[field.field] = true;
      else if (field.type === 'number') item[field.field] = 0;
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
    const { com_sno, div_sno, brn_sno } = basicFormData;
    if (com_sno && div_sno && brn_sno) {
      const key = `${com_sno}:${div_sno}:${brn_sno}`;
      setScopeKey(key);
    } else {
      setScopeKey(null);
    }
  }, [basicFormData.com_sno, basicFormData.div_sno, basicFormData.brn_sno]);

  // ── Socket.IO: join/leave pr:scope room when scopeKey changes ────────────

  useEffect(() => {
    if (!socket) return;
    if (scopeKey) {
      socket.emit('join-pr-scope', scopeKey);
      return () => {
        socket.emit('leave-pr-scope', scopeKey);
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

      if (fieldName === 'qty' || fieldName === 'est_cost') {
        const qty = fieldName === 'qty' ? parseFloat(value) || 0 : parseFloat(updated.qty) || 0;
        const cost =
          fieldName === 'est_cost' ? parseFloat(value) || 0 : parseFloat(updated.est_cost) || 0;
        updated.total_cost = qty * cost;
      }

      const field = itemDetailsFields.find((f) => f.field === fieldName);
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

  const validateItem = (): boolean => {
    const errs: FormErrors = {};
    inputItemFields.forEach((field) => {
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

  // ── Totals ────────────────────────────────────────────────────────────────

  const totalAmount = useMemo(
    () => savedItems.reduce((sum, item) => sum + (parseFloat(item.total_cost) || 0), 0),
    [savedItems]
  );

  // ── Draft Actions ─────────────────────────────────────────────────────────

  const buildPayload = () => ({
    basicInfo: { ...basicFormData, is_active: true },
    items: savedItems.map(({ id, ...item }) => ({ ...item, is_active: true })),
    totalAmount,
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Save as shared dept draft
  const saveToDeptDraft = async () => {
    const payload = { ...buildPayload(), scopeKey };
    if (deptDraftId && deptDraftScopeKey) {
      const res = await axios.put(
        prUpdateDeptDraft(deptDraftId),
        { ...payload, scopeKey: deptDraftScopeKey },
        { headers: getAuthHeaders() }
      );
      return res;
    } else {
      const res = await axios.post(prSaveDeptDraft, payload, { headers: getAuthHeaders() });
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
      const payload = buildPayload();
      const headers = getAuthHeaders();
      let res;
      if (draftId) {
        res = await axios.put(prUpdateDraft(draftId), payload, { headers });
        toast.success('Draft updated');
      } else {
        res = await axios.post(prSaveDraft, payload, { headers });
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

    if (!validateBasicForm()) {
      const first = document.querySelector('[data-error="true"]');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (savedItems.length === 0) {
      toast.error('Please add at least one item to the requisition');
      return;
    }

    setSubmitting(true);
    try {
      const headers = getAuthHeaders();
      let res;
      if (draftId) {
        await axios.put(prUpdateDraft(draftId), buildPayload(), { headers });
        res = await axios.post(prSubmitDraft(draftId), {}, { headers });
      } else {
        res = await axios.post(createPrRecord, buildPayload(), { headers });
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

  const itemGridFields = useMemo(
    () => inputItemFields.filter((f) => f.type !== 'textarea' && f.field !== 'total_cost'),
    [inputItemFields]
  );
  const itemTextareaFields = useMemo(
    () => inputItemFields.filter((f) => f.type === 'textarea'),
    [inputItemFields]
  );

  const isDeptDraftMode = !!(deptDraftId && deptDraftScopeKey);
  const isPrivateDraftMode = !!draftId && !isDeptDraftMode;

  return (
    <div className="relative">
      {/* Main form — adds right padding when sidebar is potentially open */}
      <div className="container mx-auto py-6 px-4 ">
        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Purchase Requisition</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Non-trade purchase requisition form
                  </CardDescription>
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
                    Scope: {scopeKey.split(':').join(' › ')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Basic Information ─────────────────────────────────── */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
                </div>

                {/* Main grid fields (selects, dates, numbers) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5">
                  {basicGridFields.map((field) => (
                    <div
                      key={field.field}
                      data-error={!!errors[field.field]}
                      className="flex flex-col"
                    >
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
              </section>

              {/* ── Item Entry ────────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {editingItemId ? 'Edit Item' : 'Add Item'}
                    </h3>
                  </div>
                  {editingItemId && (
                    <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 text-xs">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel Edit
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                  {/* Grid fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5">
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

                    {/* Total cost — computed display */}
                    <div className="flex flex-col">
                      <label className="text-sm font-medium mb-1.5 block">Total Cost</label>
                      <div className="h-10 flex items-center px-3 bg-background rounded-md border font-semibold text-emerald-600">
                        ₹{(parseFloat(currentItem.total_cost) || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Textarea fields (remarks) — full width */}
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
                        placeholder="Enter remarks..."
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
              </section>

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
                                {field.field === 'total_cost' || field.field === 'est_cost' ? (
                                  <span className="font-medium text-emerald-600">
                                    ₹{(parseFloat(item[field.field]) || 0).toFixed(2)}
                                  </span>
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

                  {/* Total */}
                  <div className="flex justify-end">
                    <div className="bg-muted/30 rounded-xl p-4 min-w-[260px] border">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Total Items:</span>
                        <span className="font-medium text-foreground">{savedItems.length}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-2">
                        <span>Total Estimated Amount:</span>
                        <span className="text-emerald-600">₹{totalAmount.toFixed(2)}</span>
                      </div>
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
                    title={!scopeKey ? 'Select Company, Division, Branch first' : ''}
                  >
                    {savingDraft ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4 mr-2" />
                    )}
                    {isDeptDraftMode ? 'Update Shared' : 'Save as Shared'}
                  </Button>

                  {/* Submit */}
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
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Real-time shared draft sidebar */}
      <PRDraftSidebar
        scopeKey={scopeKey}
        socket={socket as any}
        onEditDraft={(draft) => setSidebarEditDraft(draft)}
        currentUserEcno={currentUserEcno}
      />
    </div>
  );
};

export default PurchaseRequisitionPage;
