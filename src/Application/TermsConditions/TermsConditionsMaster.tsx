import React, { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/CustomComponent/PageComponents";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { FileText, Plus, Pencil, Trash2, Star, Loader2, X, ListPlus } from "lucide-react";
import { useApprovalFlowHierarchy } from "@/FieldDatas/ApprovalWorkFlow";
import useFetch from "@/hooks/useFetchHook";
import usePost from "@/hooks/usePostHook";
import useUpdate from "@/hooks/useUpdateHook";
import useDelete from "@/hooks/useDeleteHook";
import { getErrorMessage } from "@/lib/errors";
import {
  apiGetTermsConditions,
  apiCreateTermsConditions,
  apiUpdateTermsConditions,
  apiDeleteTermsConditions,
} from "@/Services/Api";

interface TermsConditionsRow {
  tc_sno: number;
  tc_title: string;
  tc_text: string;
  com_sno: number; com_name: string;
  div_sno: number; div_name: string;
  brn_sno: number; brn_name: string;
  dept_sno: number; dept_name: string;
  is_default: "Y" | "N";
  is_active: "Y" | "N";
}

interface FormState {
  tc_sno?: number;
  tc_title: string;
  points: string[];
  com_sno: string;
  div_sno: string;
  brn_sno: string;
  dept_sno: string;
  is_default: boolean;
}

const emptyForm = (): FormState => ({
  tc_title: "", points: [], com_sno: "", div_sno: "", brn_sno: "", dept_sno: "", is_default: false,
});

// tc_text is stored as a single "1. ...\n2. ..." blob (no schema change) —
// these convert between that and the point-by-point list the form edits.
const pointsToText = (points: string[]): string =>
  points.map((p, i) => `${i + 1}. ${p}`).join("\n");

const textToPoints = (text: string): string[] =>
  (text ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);

const TermsConditionsMaster: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: listResponse, loading: listLoading } = useFetch<{ success: boolean; data: TermsConditionsRow[] }>(
    apiGetTermsConditions, "", null, refreshKey
  );
  const rows = listResponse?.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pointDraft, setPointDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TermsConditionsRow | null>(null);

  const { postData, loading: creating } = usePost();
  const { updateData, loading: updating } = useUpdate();
  const { deleteData, loading: deleting } = useDelete();
  const saving = creating || updating;

  const {
    companyOptions, divisionOptions, branchOptions, departmentOptions,
  } = useApprovalFlowHierarchy(
    form.com_sno ? [Number(form.com_sno)] : [],
    form.div_sno ? [Number(form.div_sno)] : [],
    form.brn_sno ? [Number(form.brn_sno)] : []
  );

  const isEdit = form.tc_sno != null;

  const openCreate = () => { setForm(emptyForm()); setPointDraft(""); setDialogOpen(true); };
  const openEdit = (row: TermsConditionsRow) => {
    setForm({
      tc_sno: row.tc_sno,
      tc_title: row.tc_title,
      points: textToPoints(row.tc_text),
      com_sno: String(row.com_sno),
      div_sno: String(row.div_sno),
      brn_sno: String(row.brn_sno),
      dept_sno: String(row.dept_sno),
      is_default: row.is_default === "Y",
    });
    setPointDraft("");
    setDialogOpen(true);
  };

  const addPoint = () => {
    const text = pointDraft.trim();
    if (!text) return;
    setForm((f) => ({ ...f, points: [...f.points, text] }));
    setPointDraft("");
  };

  const removePoint = (index: number) => {
    setForm((f) => ({ ...f, points: f.points.filter((_, i) => i !== index) }));
  };

  const handleScopeChange = (field: "com_sno" | "div_sno" | "brn_sno" | "dept_sno", value: string) => {
    setForm((f) => {
      if (field === "com_sno") return { ...f, com_sno: value, div_sno: "", brn_sno: "", dept_sno: "" };
      if (field === "div_sno") return { ...f, div_sno: value, brn_sno: "", dept_sno: "" };
      if (field === "brn_sno") return { ...f, brn_sno: value, dept_sno: "" };
      return { ...f, dept_sno: value };
    });
  };

  const handleSave = async () => {
    // A point still sitting in the draft box (typed but not yet added) is
    // included too — clicking Save shouldn't silently drop it.
    const finalPoints = pointDraft.trim() ? [...form.points, pointDraft.trim()] : form.points;

    if (!form.tc_title.trim() || finalPoints.length === 0) {
      toast.error("Title and at least one point are required.");
      return;
    }
    if (!form.com_sno || !form.div_sno || !form.brn_sno || !form.dept_sno) {
      toast.error("Company, Division, Branch and Department are all required.");
      return;
    }

    const payload = {
      tc_title: form.tc_title.trim(),
      tc_text: pointsToText(finalPoints),
      com_sno: Number(form.com_sno),
      div_sno: Number(form.div_sno),
      brn_sno: Number(form.brn_sno),
      dept_sno: Number(form.dept_sno),
      is_default: form.is_default ? "Y" : "N",
    };

    try {
      if (isEdit) {
        await updateData(apiUpdateTermsConditions, null, { tc_sno: form.tc_sno, ...payload });
        toast.success("Terms & conditions updated");
      } else {
        await postData(apiCreateTermsConditions, payload);
        toast.success("Terms & conditions saved");
      }
      setDialogOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save terms & conditions");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteData(apiDeleteTermsConditions, { tc_sno: pendingDelete.tc_sno });
      toast.success("Terms & conditions deleted");
      setPendingDelete(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Failed to delete terms & conditions"));
    }
  };

  const scopeLabel = (row: TermsConditionsRow) =>
    `${row.com_name} / ${row.div_name} / ${row.brn_name} / ${row.dept_name}`;

  return (
    <div className="flex flex-col min-h-full lg:h-full bg-muted/30">
      <PageHeader
        icon={FileText}
        title="Terms & Conditions Master"
        description="Author reusable Terms & Conditions text per Company / Division / Branch / Department, and flag one entry per scope as the default used on new Purchase Orders."
      />

      <div className="flex-1 lg:overflow-y-auto p-5 space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90">
            <Plus size={16} className="mr-1" /> Add Terms & Conditions
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Scope (Company / Division / Branch / Department)</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="animate-spin inline mr-2" size={16} /> Loading…
                  </TableCell></TableRow>
                )}
                {!listLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No terms & conditions configured yet.
                  </TableCell></TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.tc_sno}>
                    <TableCell className="align-top">
                      <p className="font-medium">{row.tc_title}</p>
                      <ol className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {textToPoints(row.tc_text).map((point, i) => (
                          <li key={i}>{i + 1}. {point}</li>
                        ))}
                      </ol>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top">{scopeLabel(row)}</TableCell>
                    <TableCell className="align-top">
                      {row.is_default === "Y" && (
                        <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                          <Star size={11} /> Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPendingDelete(row)}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Terms & Conditions" : "Add Terms & Conditions"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <CustomInputField
              field="tc_title" label="Title" type="text" require
              placeholder="e.g. Standard, Import, Urgent"
              value={form.tc_title} onChange={(v) => setForm((f) => ({ ...f, tc_title: v }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <CustomInputField
                field="com_sno" label="Company" type="select" require
                options={companyOptions} disabled={isEdit}
                placeholder="Select company"
                value={form.com_sno} onChange={(v) => handleScopeChange("com_sno", v)}
              />
              <CustomInputField
                field="div_sno" label="Division" type="select" require
                options={divisionOptions} disabled={isEdit || !form.com_sno}
                placeholder="Select division"
                value={form.div_sno} onChange={(v) => handleScopeChange("div_sno", v)}
              />
              <CustomInputField
                field="brn_sno" label="Branch" type="select" require
                options={branchOptions} disabled={isEdit || !form.div_sno}
                placeholder="Select branch"
                value={form.brn_sno} onChange={(v) => handleScopeChange("brn_sno", v)}
              />
              <CustomInputField
                field="dept_sno" label="Department" type="select" require
                options={departmentOptions} disabled={isEdit || !form.brn_sno}
                placeholder="Select department"
                value={form.dept_sno} onChange={(v) => handleScopeChange("dept_sno", v)}
              />
            </div>
            {isEdit && (
              <p className="text-xs text-muted-foreground -mt-2">
                Scope can't be changed after creation — add a new entry instead.
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Terms & Conditions <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground">Add one point at a time — each becomes its own numbered line.</p>

              {form.points.length > 0 && (
                <ol className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
                  {form.points.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 shrink-0 font-medium text-muted-foreground">{index + 1}.</span>
                      <span className="flex-1">{point}</span>
                      <button
                        type="button"
                        onClick={() => removePoint(index)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove point ${index + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex gap-2">
                <Input
                  value={pointDraft}
                  placeholder="e.g. Payment within 30 days of invoice"
                  onChange={(e) => setPointDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addPoint(); }
                  }}
                />
                <Button type="button" variant="outline" onClick={addPoint} disabled={!pointDraft.trim()}>
                  <ListPlus size={14} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            <CustomInputField
              field="is_default" label="Set as default for this scope" type="switch"
              value={form.is_default} onChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Terms & Conditions?</DialogTitle>
            <DialogDescription>
              "{pendingDelete?.tc_title}" will be removed and can't be used as a default anymore. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TermsConditionsMaster;
