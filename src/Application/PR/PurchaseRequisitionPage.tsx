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
} from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePRBasicInfoFields, usePRItemDetailsFields } from '@/FieldDatas/PRData';
import usePost from '@/hooks/usePostHook';
import axios from 'axios';
import { createPrRecord, prSaveDraft, prUpdateDraft, prSubmitDraft } from '@/Services/Api';
import { toast } from 'sonner';
import { useAppState } from '@/globalState/hooks/useAppState';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';

interface FormErrors {
  [key: string]: string;
}

// Name-field mapping for dropdown fields that don't follow _sno → _name pattern
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
  // Optional: if provided, the form loads this draft for editing
  editDraftId?: string;
  editDraftData?: Record<string, any>;
  onDraftSubmitted?: () => void;
}

const PurchaseRequisitionPage: React.FC<PRPageProps> = ({
  editDraftId,
  editDraftData,
  onDraftSubmitted,
}) => {
  const { data: hierarchyData, userData } = useAppState();

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

  // Dynamic initial state
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

  const [basicFormData, setBasicFormData] = useState<Record<string, any>>(() =>
    buildInitialBasicFormData()
  );
  const [currentItem, setCurrentItem] = useState<Record<string, any>>(() => buildEmptyItem());
  const [savedItems, setSavedItems] = useState<Record<string, any>[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [itemErrors, setItemErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(editDraftId ?? null);

  const { postData } = usePost();

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

  // ── Field change handlers ─────────────────────────────────────────────────

  const handleBasicFieldChange = (fieldName: string, value: any) => {
    setBasicFormData((prev) => {
      const updated = { ...prev, [fieldName]: value };

      // Cascade: clear dependent fields on hierarchy change
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

      // Auto-populate name field from selected option
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

      // Auto-calculate total_cost
      if (fieldName === 'qty' || fieldName === 'est_cost') {
        const qty = fieldName === 'qty' ? parseFloat(value) || 0 : parseFloat(updated.qty) || 0;
        const cost =
          fieldName === 'est_cost' ? parseFloat(value) || 0 : parseFloat(updated.est_cost) || 0;
        updated.total_cost = qty * cost;
      }

      // Auto-populate name field from selected option
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

  // ── Validation ───────────────────────────────────────────────────────────

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

  const handleSaveAsDraft = async () => {
    if (!validateBasicForm()) {
      toast.error('Please fill the required basic info fields before saving as draft');
      return;
    }
    setSavingDraft(true);
    try {
      const payload = buildPayload();
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let res;
      if (draftId) {
        res = await axios.put(prUpdateDraft(draftId), payload, { headers });
        toast.success('Draft updated successfully');
      } else {
        res = await axios.post(prSaveDraft, payload, { headers });
        if (res.data?.draftId) setDraftId(res.data.draftId);
        toast.success('Draft saved — you can continue editing or submit later');
      }
    } catch {
      toast.error('Failed to save draft. Please try again.');
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
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let res;
      if (draftId) {
        // Submit existing draft (Redis → DB)
        await axios.put(prUpdateDraft(draftId), buildPayload(), { headers });
        res = await axios.post(prSubmitDraft(draftId), {}, { headers });
      } else {
        // Direct submit to DB
        res = await axios.post(createPrRecord, buildPayload(), { headers });
      }

      const msg = res?.data?.data?.[0]?.Message || 'Purchase Requisition submitted successfully!';
      toast.success(msg);
      handleReset();
      onDraftSubmitted?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Submission failed. Please try again.');
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
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Purchase Requisition</CardTitle>
              <CardDescription>Non-trade purchase requisition form</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {draftId && (
                <Badge variant="secondary" className="text-xs">
                  <Save className="h-3 w-3 mr-1" />
                  Draft
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <section>
              <h3 className="text-base font-semibold mb-4 pb-2 border-b">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {inputBasicFields.map((field) => (
                  <div key={field.field} data-error={!!errors[field.field]}>
                    <CustomInputField
                      field={field.field}
                      label={field.label}
                      require={field.require}
                      type={field.type}
                      options={field.options}
                      value={basicFormData[field.field] ?? ''}
                      onChange={(value) => handleBasicFieldChange(field.field, value)}
                      error={errors[field.field]}
                      placeholder={`Select ${field.label.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Item Entry */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {editingItemId ? 'Edit Item' : 'Add Item'}
                </h3>
                {editingItemId && (
                  <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel Edit
                  </Button>
                )}
              </div>

              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inputItemFields.map((field) =>
                      field.field === 'total_cost' ? (
                        <div key={field.field}>
                          <label className="text-sm font-medium mb-1 block">{field.label}</label>
                          <div className="font-semibold py-2 px-3 bg-background rounded border text-green-600">
                            ₹{(parseFloat(currentItem.total_cost) || 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div key={field.field} data-error={!!itemErrors[field.field]}>
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
                          />
                        </div>
                      )
                    )}
                  </div>

                  {Object.keys(itemErrors).length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-4">
                      <ul className="list-disc list-inside text-destructive text-sm space-y-1">
                        {Object.values(itemErrors).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end mt-4">
                    {editingItemId ? (
                      <Button
                        type="button"
                        onClick={handleUpdateItem}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Update Item
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Items Table */}
            {savedItems.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-base font-semibold">Items List ({savedItems.length})</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px] text-center">S.No</TableHead>
                        {viewItemFields.map((field) => (
                          <TableHead key={field.field} className="min-w-[120px]">
                            {field.label}
                          </TableHead>
                        ))}
                        <TableHead className="w-[90px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedItems.map((item, index) => (
                        <TableRow
                          key={item.id}
                          className={editingItemId === item.id ? 'bg-blue-50' : ''}
                        >
                          <TableCell className="text-center font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          {viewItemFields.map((field) => (
                            <TableCell key={field.field}>
                              {field.field === 'total_cost' || field.field === 'est_cost' ? (
                                <span className="font-medium text-green-600">
                                  ₹{(parseFloat(item[field.field]) || 0).toFixed(2)}
                                </span>
                              ) : (
                                <span>{item[field.field] ?? '—'}</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="flex gap-1 justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditItem(item.id)}
                                disabled={editingItemId !== null}
                                title="Edit item"
                                className="h-8 w-8"
                              >
                                <Edit2 className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(item.id)}
                                title="Remove item"
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
                  <div className="bg-muted/30 rounded-lg p-4 min-w-[280px]">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Total Items:</span>
                      <span className="font-medium">{savedItems.length}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold border-t pt-2">
                      <span>Total Estimated Amount:</span>
                      <span className="text-green-600">₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {savedItems.length === 0 && (
              <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/20">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No items added yet. Fill in the item details above and click "Add Item".</p>
              </div>
            )}

            {/* Form Errors */}
            {Object.keys(errors).length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-destructive font-semibold text-sm mb-2">Please fix the following:</p>
                <ul className="list-disc list-inside text-destructive text-sm space-y-1">
                  {Object.values(errors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={submitting || savingDraft}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={submitting || savingDraft}
                >
                  {savingDraft ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {draftId ? 'Update Draft' : 'Save as Draft'}
                    </>
                  )}
                </Button>

                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={savedItems.length === 0 || submitting || savingDraft}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Requisition
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseRequisitionPage;
