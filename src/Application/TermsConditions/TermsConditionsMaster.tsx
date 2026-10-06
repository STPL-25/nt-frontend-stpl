import React, { useEffect, useMemo, useState } from "react";
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
import { FileText, Plus, Pencil, Trash2, Star, Loader2, X, ListPlus, ArrowLeft } from "lucide-react";
import { useAppState } from "@/globalState/hooks/useAppState";
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
  // Edit keeps the saved single scope (immutable); create picks many.
  com_snos: string[];
  div_snos: string[];
  brn_snos: string[];
  dept_snos: string[];
  is_default: boolean;
  scopeLabel?: string;
}

const emptyForm = (): FormState => ({
  tc_title: "", points: [], com_snos: [], div_snos: [], brn_snos: [], dept_snos: [], is_default: false,
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
  const { setCurrentScreen, setSelectedMaster } = useAppState() as any;
  const goBackToMasters = () => { setCurrentScreen("main"); setSelectedMaster?.(null); };
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

  const isEdit = form.tc_sno != null;

  const {
    companyOptions: rawCompanyOptions, divisionOptions: rawDivisionOptions,
    branchOptions: rawBranchOptions, departmentOptions: rawDepartmentOptions, allDepartments,
  } = useApprovalFlowHierarchy(
    form.com_snos.map(Number), form.div_snos.map(Number), form.brn_snos.map(Number)
  );

  // The multi-select matches option values with ===, and the hierarchy/master
  // options carry raw ids while form state holds strings — normalise to strings.
  const toStr = (opts: { label: string; value: string | number }[]) =>
    opts.map((o) => ({ ...o, value: String(o.value) }));
  const companyOptions = useMemo(() => toStr(rawCompanyOptions), [rawCompanyOptions]);
  const divisionOptions = useMemo(() => toStr(rawDivisionOptions), [rawDivisionOptions]);
  const branchOptions = useMemo(() => toStr(rawBranchOptions), [rawBranchOptions]);
  const departmentOptions = useMemo(() => toStr(rawDepartmentOptions), [rawDepartmentOptions]);

  // Drop selections that fell out of the cascade (e.g. a company was
  // deselected, so its divisions/branches/departments are no longer valid).
  useEffect(() => {
    if (isEdit) return;
    const keep = (sel: string[], opts: { value: string }[]) => {
      const ok = new Set(opts.map((o) => o.value));
      const next = sel.filter((v) => ok.has(v));
      return next.length === sel.length ? sel : next;
    };
    setForm((f) => {
      const div_snos = keep(f.div_snos, divisionOptions);
      const brn_snos = keep(f.brn_snos, branchOptions);
      const dept_snos = keep(f.dept_snos, departmentOptions);
      if (div_snos === f.div_snos && brn_snos === f.brn_snos && dept_snos === f.dept_snos) return f;
      return { ...f, div_snos, brn_snos, dept_snos };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionOptions, branchOptions, departmentOptions]);

  const openCreate = () => { setForm(emptyForm()); setPointDraft(""); setDialogOpen(true); };
  const openEdit = (row: TermsConditionsRow) => {
    setForm({
      tc_sno: row.tc_sno,
      tc_title: row.tc_title,
      points: textToPoints(row.tc_text),
      com_snos: [String(row.com_sno)],
      div_snos: [String(row.div_sno)],
      brn_snos: [String(row.brn_sno)],
      dept_snos: [String(row.dept_sno)],
      is_default: row.is_default === "Y",
      scopeLabel: scopeLabel(row),
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

  const handleSave = async () => {
    // A point still sitting in the draft box (typed but not yet added) is
    // included too — clicking Save shouldn't silently drop it.
    const finalPoints = pointDraft.trim() ? [...form.points, pointDraft.trim()] : form.points;

    if (!form.tc_title.trim() || finalPoints.length === 0) {
      toast.error("Title and at least one point are required.");
      return;
    }
    const base = {
      tc_title: form.tc_title.trim(),
      tc_text: pointsToText(finalPoints),
      is_default: form.is_default ? "Y" : "N",
    };

    try {
      if (isEdit) {
        await updateData(apiUpdateTermsConditions, null, { tc_sno: form.tc_sno, ...base });
        toast.success("Terms & conditions updated");
      } else {
        if (!form.com_snos.length || !form.div_snos.length || !form.brn_snos.length || !form.dept_snos.length) {
          toast.error("Select at least one Company, Division, Branch and Department.");
          return;
        }
        // One scope per selected department, using that department's own real
        // company/division/branch chain (never a cross-join guess), and only
        // if that chain lies inside what was ticked above.
        const coms = new Set(form.com_snos), divs = new Set(form.div_snos), brns = new Set(form.brn_snos);
        const seen = new Set<string>();
        const scopes: { com_sno: number; div_sno: number; brn_sno: number; dept_sno: number }[] = [];
        for (const d of allDepartments) {
          const dept = String(d.value);
          if (!form.dept_snos.includes(dept) || seen.has(dept)) continue;
          if (!coms.has(String(d.com_sno)) || !divs.has(String(d.div_sno)) || !brns.has(String(d.brn_sno))) continue;
          seen.add(dept);
          scopes.push({ com_sno: Number(d.com_sno), div_sno: Number(d.div_sno), brn_sno: Number(d.brn_sno), dept_sno: Number(dept) });
        }
        if (scopes.length === 0) {
          toast.error("None of the selected departments belong to the selected company / division / branch.");
          return;
        }
        await postData(apiCreateTermsConditions, { ...base, scopes });
        toast.success(scopes.length > 1 ? `Terms & conditions saved for ${scopes.length} departments` : "Terms & conditions saved");
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
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-1" onClick={goBackToMasters}>
            <ArrowLeft className="h-4 w-4" /> Back to Masters
          </Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Terms & Conditions" : "Add Terms & Conditions"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <CustomInputField
              field="tc_title" label="Title" type="text" require
              placeholder="e.g. Standard, Import, Urgent"
              value={form.tc_title} onChange={(v) => setForm((f) => ({ ...f, tc_title: v }))}
            />

            {isEdit ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">Scope</p>
                <p className="text-sm text-muted-foreground">{form.scopeLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Scope can't be changed after creation — add a new entry instead.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomInputField
                  field="com_snos" label="Company" type="multi-select" require
                  options={companyOptions} placeholder="Select companies"
                  value={form.com_snos} onChange={(v: string[]) => setForm((f) => ({ ...f, com_snos: v ?? [] }))}
                />
                <CustomInputField
                  field="div_snos" label="Division" type="multi-select" require
                  options={divisionOptions} disabled={!form.com_snos.length} placeholder="Select divisions"
                  value={form.div_snos} onChange={(v: string[]) => setForm((f) => ({ ...f, div_snos: v ?? [] }))}
                />
                <CustomInputField
                  field="brn_snos" label="Branch" type="multi-select" require
                  options={branchOptions} disabled={!form.div_snos.length} placeholder="Select branches"
                  value={form.brn_snos} onChange={(v: string[]) => setForm((f) => ({ ...f, brn_snos: v ?? [] }))}
                />
                <CustomInputField
                  field="dept_snos" label="Department" type="multi-select" require
                  options={departmentOptions} disabled={!form.brn_snos.length} placeholder="Select departments"
                  value={form.dept_snos} onChange={(v: string[]) => setForm((f) => ({ ...f, dept_snos: v ?? [] }))}
                />
              </div>
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
