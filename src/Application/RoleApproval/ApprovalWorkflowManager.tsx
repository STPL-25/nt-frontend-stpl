import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useApprovalFlowHierarchy } from "@/FieldDatas/ApprovalWorkFlow";
import { toast } from "sonner";
import usePost from "@/hooks/usePostHook";
import useUpdate from "@/hooks/useUpdateHook";
import useFetch from "@/hooks/useFetchHook";
import {
  apiSaveFullWorkflow,
  apiGetSignEmployee,
  apiGetWorkflows,
  apiGetWorkflowTypes,
  apiUpdateWorkflow,
  apiUpdateWorkflowType,
  apiUpdateWorkflowStage,
  apiSaveWorkflowType,
  apiSaveWorkflowStage,
} from "@/Services/Api";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  WorkflowFormData,
  WorkflowType,
  WorkflowTypeExtended,
  WorkflowMasterRow,
  StageOrderItem,
} from "./types/ApprovalWorkflowManagerTypes";
import { usePermissions } from "@/globalState/hooks/usePermissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelMode = "idle" | "loading" | "create" | "edit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyStage = (): StageOrderItem => ({
  approver_ecno: "",
  stage: "",
  required_approvals: "1",
  is_mandatory: "Y",
  escalation_hours: "24",
  approver_condition: "",
  next_approver_ecno: "",
  can_forward: "Y",
  can_backward: "N",
  can_edit_data: "N",
});

const emptyType = (): WorkflowTypeExtended => ({
  workflow_types_name: "",
  com_snos: [],
  div_snos: [],
  brn_snos: [],
  dept_snos: [],
  is_active: true,
  stages: [emptyStage()],
  _typeIds: [],
});

const emptyWorkflow = (): WorkflowFormData => ({
  workflow_name: "",
  workflow_code: "",
  entity_type: "",
  description: "",
  is_active: true,
});

const YN_OPTIONS = [
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
];

// ─── WorkflowTypeCard ─────────────────────────────────────────────────────────

const WorkflowTypeCard: React.FC<{
  type: WorkflowType;
  typeIndex: number;
  employeeOptions: { label: string; value: string }[];
  onChange: (i: number, field: keyof WorkflowType, value: any) => void;
  onStageChange: (
    ti: number,
    si: number,
    field: keyof StageOrderItem,
    value: string
  ) => void;
  onAddStage: (ti: number) => void;
  onRemoveStage: (ti: number, si: number) => void;
  onMoveStage: (ti: number, si: number, dir: "up" | "down") => void;
  onRemove: (i: number) => void;
  removable?: boolean;
}> = React.memo(
  ({
    type,
    typeIndex,
    employeeOptions,
    onChange,
    onStageChange,
    onAddStage,
    onRemoveStage,
    onMoveStage,
    onRemove,
    removable = true,
  }) => {
    const [stagesOpen, setStagesOpen] = useState(true);
    const { workflowTypeFields } = useApprovalFlowHierarchy(
      type.com_snos.map(Number),
      type.div_snos.map(Number),
      type.brn_snos.map(Number)
    );

    const handleTypeField = useCallback(
      (field: string, v: any) => {
        if (field === "com_snos") {
          onChange(typeIndex, "com_snos", v);
          onChange(typeIndex, "div_snos", []);
          onChange(typeIndex, "brn_snos", []);
        } else if (field === "div_snos") {
          onChange(typeIndex, "div_snos", v);
          onChange(typeIndex, "brn_snos", []);
        } else {
          onChange(typeIndex, field as keyof WorkflowType, v);
        }
      },
      [typeIndex, onChange]
    );

    return (
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                Type {typeIndex + 1}
              </Badge>
              <span className="font-medium text-sm">
                {type.workflow_types_name || "Unnamed Type"}
              </span>
              {!type.is_active && (
                <Badge variant="destructive" className="text-xs">
                  Inactive
                </Badge>
              )}
              {type.brn_snos.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {type.brn_snos.length} Branch{type.brn_snos.length > 1 ? "es" : ""}
                </Badge>
              )}
              {type.dept_snos.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {type.dept_snos.length} Dept{type.dept_snos.length > 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {type.stages.length} Stage{type.stages.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {removable && (
              <Button
                onClick={() => onRemove(typeIndex)}
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-600 h-8 w-8 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <CustomInputField
            {...workflowTypeFields[0]}
            value={type.workflow_types_name}
            onChange={(v) => onChange(typeIndex, "workflow_types_name", v)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflowTypeFields.slice(1, 5).map((fc) => (
              <CustomInputField
                key={fc.field}
                {...fc}
                value={type[fc.field as keyof WorkflowType] as string[]}
                onChange={(v) => handleTypeField(fc.field, v)}
              />
            ))}
          </div>
          <CustomInputField
            {...workflowTypeFields[5]}
            value={type.is_active}
            onChange={(v) => onChange(typeIndex, "is_active", v)}
          />

          {/* Stages */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                onClick={() => setStagesOpen((o) => !o)}
              >
                {stagesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Stages ({type.stages.length})
              </button>
              {stagesOpen && (
                <Button onClick={() => onAddStage(typeIndex)} size="sm" variant="outline">
                  <Plus className="w-3 h-3 mr-1" /> Add Stage
                </Button>
              )}
            </div>

            {stagesOpen && (
              <div className="space-y-3">
                {type.stages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No stages yet. Click "Add Stage" to begin.
                  </p>
                )}
                {type.stages.map((stage, si) => (
                  <Card key={si} className="border bg-muted/20">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1 pt-1">
                          <Button onClick={() => onMoveStage(typeIndex, si, "up")} disabled={si === 0} variant="outline" size="icon" className="h-6 w-6">
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Badge variant="secondary" className="justify-center text-xs px-1">{si + 1}</Badge>
                          <Button onClick={() => onMoveStage(typeIndex, si, "down")} disabled={si === type.stages.length - 1} variant="outline" size="icon" className="h-6 w-6">
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <CustomInputField field="stage" label="Stage Name" type="text" placeholder="e.g., Manager Review" require={true} input={true} view={true} value={stage.stage} onChange={(v) => onStageChange(typeIndex, si, "stage", v)} />
                            <CustomInputField field="approver_ecno" label="Approver" type="select" placeholder="Select approver" require={true} input={true} view={true} options={employeeOptions} value={stage.approver_ecno} onChange={(v) => onStageChange(typeIndex, si, "approver_ecno", v)} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <CustomInputField field="required_approvals" label="Required Approvals" type="number" min="1" input={true} view={true} value={stage.required_approvals} onChange={(v) => onStageChange(typeIndex, si, "required_approvals", v)} />
                            <CustomInputField field="is_mandatory" label="Is Mandatory" type="select" input={true} view={true} options={YN_OPTIONS} value={stage.is_mandatory} onChange={(v) => onStageChange(typeIndex, si, "is_mandatory", v)} />
                            <CustomInputField field="escalation_hours" label="Escalation Hours" type="number" min="1" input={true} view={true} value={stage.escalation_hours} onChange={(v) => onStageChange(typeIndex, si, "escalation_hours", v)} />
                            <CustomInputField field="next_approver_ecno" label="Next Approver" type="select" placeholder="Select (optional)" input={true} view={true} options={[{ label: "None", value: "0" }, ...employeeOptions]} value={stage.next_approver_ecno} onChange={(v) => onStageChange(typeIndex, si, "next_approver_ecno", v)} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <CustomInputField field="approver_condition" label="Approver Condition" type="text" placeholder="e.g., amount > 50000" input={true} view={true} value={stage.approver_condition} onChange={(v) => onStageChange(typeIndex, si, "approver_condition", v)} />
                            <CustomInputField field="can_forward" label="Can Forward" type="select" input={true} view={true} options={YN_OPTIONS} value={stage.can_forward} onChange={(v) => onStageChange(typeIndex, si, "can_forward", v)} />
                            <CustomInputField field="can_backward" label="Can Backward" type="select" input={true} view={true} options={YN_OPTIONS} value={stage.can_backward} onChange={(v) => onStageChange(typeIndex, si, "can_backward", v)} />
                            <CustomInputField field="can_edit_data" label="Can Edit Data" type="select" input={true} view={true} options={YN_OPTIONS} value={stage.can_edit_data} onChange={(v) => onStageChange(typeIndex, si, "can_edit_data", v)} />
                          </div>
                        </div>

                        <Button onClick={() => onRemoveStage(typeIndex, si)} variant="ghost" size="icon" className="text-red-500 hover:text-red-600 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApprovalFlowDynamic() {
  const { canCreate, canEdit } = usePermissions();
  const canSave = canCreate("ApprovalWorkflowPage") || canEdit("ApprovalWorkflowPage");

  // ── List ──────────────────────────────────────────────────────────────────
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const { data: listData, loading: listLoading } = useFetch<{ data: WorkflowMasterRow[] }>(
    apiGetWorkflows, "", null, listRefreshKey
  );
  const workflows: WorkflowMasterRow[] = Array.isArray(listData?.data) ? listData!.data : [];
  console.log(listData?.data);
  // ── Panel / selection state ───────────────────────────────────────────────
  const [mode, setMode] = useState<PanelMode>("idle");
  const [selectedId, setSelectedId] = useState<string>("");       // drives the select dropdown
  const [selectedRow, setSelectedRow] = useState<WorkflowMasterRow | null>(null);

  // ── Employees ─────────────────────────────────────────────────────────────
  const [employeeOptions, setEmployeeOptions] = useState<{ label: string; value: string }[]>([]);

  // ── Create state ──────────────────────────────────────────────────────────
  const [createWorkflow, setCreateWorkflow] = useState<WorkflowFormData>(emptyWorkflow);
  const [createTypes, setCreateTypes] = useState<WorkflowTypeExtended[]>([emptyType()]);
  const [createSaving, setCreateSaving] = useState(false);
  const [savedWorkflowId, setSavedWorkflowId] = useState<number | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editWorkflow, setEditWorkflow] = useState<WorkflowFormData>(emptyWorkflow);
  const [editTypes, setEditTypes] = useState<WorkflowTypeExtended[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const { postData } = usePost<any>();
  const { updateData } = useUpdate<any>();
  const { workflowFields, entityTypeCount, hierarchyData } = useApprovalFlowHierarchy();
  const isSaving = createSaving || editSaving;

  useEffect(() => {
    postData(apiGetSignEmployee, {})
      .then((res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        setEmployeeOptions(list.map((e) => ({ label: `${e.ename} (${e.ecno})`, value: e.ecno })));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dropdown options ──────────────────────────────────────────────────────
  const workflowOptions = useMemo(
    () => workflows.map((wf) => ({
      label: `${wf.workflow_name} (${wf.workflow_code})`,
      value: String(wf.workflow_id),
    })),
    [workflows]
  );

  // ── Branch parent lookup ──────────────────────────────────────────────────
  const buildBranchParent = useCallback((): Record<string, { div_sno: string; com_sno: string }> => {
    const map: Record<string, { div_sno: string; com_sno: string }> = {};
    for (const com of hierarchyData?.companies ?? []) {
      for (const div of com.divisions ?? []) {
        for (const brn of div.branches ?? []) {
          map[String(brn.brn_sno)] = { div_sno: String(div.div_sno), com_sno: String(com.com_sno) };
        }
      }
    }
    return map;
  }, [hierarchyData]);

  // ── Type/stage handlers factory ───────────────────────────────────────────
  const makeHandlers = (
    setter: React.Dispatch<React.SetStateAction<WorkflowTypeExtended[]>>,
    getTypes: () => WorkflowTypeExtended[]
  ) => ({
    updateType: (index: number, field: keyof WorkflowType, value: any) =>
      setter((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))),
    removeType: (index: number) => {
      const t = getTypes()[index];
      if (t._typeIds.length > 0) {
        setter((prev) => prev.map((wt, i) => (i === index ? { ...wt, is_active: false } : wt)));
        toast.info(`"${t.workflow_types_name}" marked inactive. Save to apply.`);
      } else {
        setter((prev) => prev.filter((_, i) => i !== index));
      }
    },
    addStage: (ti: number) =>
      setter((prev) => prev.map((t, i) => (i === ti ? { ...t, stages: [...t.stages, emptyStage()] } : t))),
    updateStage: (ti: number, si: number, field: keyof StageOrderItem, value: string) =>
      setter((prev) =>
        prev.map((t, i) =>
          i === ti ? { ...t, stages: t.stages.map((s, j) => (j === si ? { ...s, [field]: value } : s)) } : t
        )
      ),
    removeStage: (ti: number, si: number) =>
      setter((prev) => prev.map((t, i) => (i === ti ? { ...t, stages: t.stages.filter((_, j) => j !== si) } : t))),
    moveStage: (ti: number, si: number, dir: "up" | "down") =>
      setter((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const arr = [...t.stages];
          const target = dir === "up" ? si - 1 : si + 1;
          if (target < 0 || target >= arr.length) return t;
          [arr[si], arr[target]] = [arr[target], arr[si]];
          return { ...t, stages: arr };
        })
      ),
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ch = useMemo(() => makeHandlers(setCreateTypes, () => createTypes), [createTypes]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eh = useMemo(() => makeHandlers(setEditTypes, () => editTypes), [editTypes]);

  // ── Select workflow from dropdown ─────────────────────────────────────────
  const handleSelectById = useCallback(
    async (id: string) => {
      setSelectedId(id);
      if (!id) { setMode("idle"); setSelectedRow(null); return; }

      const wf = workflows.find((w) => String(w.workflow_id) === id);
      if (!wf) return;

      setSelectedRow(wf);
      setMode("loading");
      try {
        const typesRes = await axios.get(apiGetWorkflowTypes(wf.workflow_id));

        // Response shape: { decrypted: { data: [{ "JSON_F52E2B61-...": "<json string>" }] } }
        const jsonKey = "JSON_F52E2B61-18A1-11d1-B105-00805F49916B";
        const rawJson = typesRes.data?.decrypted?.data?.[0]?.[jsonKey];
        const parsed = rawJson ? JSON.parse(rawJson) : null;
        const workflowTypeRows: any[] = parsed?.workflows?.[0]?.workflow_types ?? [];

        const bp = buildBranchParent();
        const groups: Record<string, WorkflowTypeExtended> = {};

        for (const row of workflowTypeRows) {
          const name = row.workflow_types_name;

          let stages: StageOrderItem[] = [];
          if (row.stages?.length > 0 && row.stages[0].stage_order_json) {
            try { stages = JSON.parse(row.stages[0].stage_order_json); } catch { stages = []; }
          }

          if (!groups[name]) {
            groups[name] = {
              workflow_types_name: name,
              com_snos: [], div_snos: [], brn_snos: [], dept_snos: [],
              is_active: row.is_active === "Y",
              stages,
              _typeIds: [],
            };
          }
          const g = groups[name];
          const brn = String(row.brn_sno);
          if (!g.brn_snos.includes(brn)) g.brn_snos.push(brn);
          if (!g.dept_snos.includes(String(row.dept_sno))) g.dept_snos.push(String(row.dept_sno));
          if (bp[brn]) {
            if (!g.com_snos.includes(bp[brn].com_sno)) g.com_snos.push(bp[brn].com_sno);
            if (!g.div_snos.includes(bp[brn].div_sno)) g.div_snos.push(bp[brn].div_sno);
          }
          g._typeIds.push(row.workflow_types_id);
        }

        setEditWorkflow({
          workflow_name: wf.workflow_name,
          workflow_code: wf.workflow_code,
          entity_type: wf.entity_type,
          description: wf.description ?? "",
          is_active: wf.is_active === "Y",
        });
        setEditTypes(Object.values(groups));
        setMode("edit");
      } catch {
        toast.error("Failed to load workflow details");
        setMode("idle");
        setSelectedRow(null);
        setSelectedId("");
      }
    },
    [workflows, buildBranchParent]
  );

  const handleNewWorkflow = useCallback(() => {
    setSelectedId("");
    setSelectedRow(null);
    setCreateWorkflow(emptyWorkflow());
    setCreateTypes([emptyType()]);
    setSavedWorkflowId(null);
    setMode("create");
  }, []);

  const handleReset = useCallback(() => {
    setSelectedId("");
    setSelectedRow(null);
    setMode("idle");
    setCreateWorkflow(emptyWorkflow());
    setCreateTypes([emptyType()]);
    setSavedWorkflowId(null);
  }, []);

  const handleDiscard = useCallback(() => {
    if (mode === "create") {
      setCreateWorkflow(emptyWorkflow());
      setCreateTypes([emptyType()]);
      setSavedWorkflowId(null);
    } else if (mode === "edit" && selectedId) {
      handleSelectById(selectedId);
    }
  }, [mode, selectedId, handleSelectById]);

  // ── Create submit ─────────────────────────────────────────────────────────
  const validateCreate = useCallback((): boolean => {
    if (!createWorkflow.workflow_name || !createWorkflow.entity_type) {
      toast.error("Workflow name and entity type are required"); return false;
    }
    for (const t of createTypes) {
      if (!t.workflow_types_name) { toast.error("Each type must have a name"); return false; }
      if (!t.brn_snos.length || !t.dept_snos.length) {
        toast.error(`"${t.workflow_types_name}" needs at least one branch and department`); return false;
      }
      if (!t.stages.length || t.stages.some((s) => !s.stage || !s.approver_ecno)) {
        toast.error(`"${t.workflow_types_name}" — each stage needs a name and approver`); return false;
      }
    }
    return true;
  }, [createWorkflow, createTypes]);

  const handleCreateSubmit = useCallback(async () => {
    // if (!validateCreate()) return;
    setCreateSaving(true);
    const count = entityTypeCount[createWorkflow.entity_type] || 0;
    const autoCode = `WF_${createWorkflow.entity_type}_${String(count + 1).padStart(3, "0")}`;
    const bp = buildBranchParent();
    const expandedTypes = createTypes.flatMap((t) =>
      t.brn_snos.flatMap((brn) =>
        t.dept_snos.map((dept) => ({
          workflow_types_name: t.workflow_types_name,
          com_sno: bp[String(brn)]?.com_sno ?? "",
          div_sno: bp[String(brn)]?.div_sno ?? "",
          brn_sno: brn, dept_sno: dept,
          is_active: t.is_active ? "Y" : "N",
          stage_order_json: JSON.stringify(t.stages),
        }))
      )
    );
    try {
      const data = await postData(apiSaveFullWorkflow, {
        workflow_name: createWorkflow.workflow_name,
        workflow_code: autoCode,
        entity_type: createWorkflow.entity_type,
        description: createWorkflow.description,
        is_active: createWorkflow.is_active ? "Y" : "N",
        workflow_types: expandedTypes,
      });
      setSavedWorkflowId(data?.data?.[0]?.workflow_id ?? null);
      toast.success(`Workflow saved! Code: ${autoCode}`);
      setListRefreshKey((k) => k + 1);
      setCreateWorkflow(emptyWorkflow());
      setCreateTypes([emptyType()]);
    } catch {
      toast.error("Failed to save workflow");
    } finally {
      setCreateSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validateCreate, createWorkflow, createTypes, entityTypeCount, buildBranchParent]);

  // ── Edit submit ───────────────────────────────────────────────────────────
  const handleUpdateSubmit = useCallback(async () => {
    if (!selectedRow) return;
    if (!editWorkflow.workflow_name) { toast.error("Workflow name is required"); return; }
    setEditSaving(true);
    try {
      await updateData(apiUpdateWorkflow, null, {
        workflow_id: selectedRow.workflow_id,
        workflow_name: editWorkflow.workflow_name,
        description: editWorkflow.description,
        is_active: editWorkflow.is_active ? "Y" : "N",
      });
      const bp = buildBranchParent();
      for (const type of editTypes) {
        if (type._typeIds.length > 0) {
          for (const typeId of type._typeIds) {
            await updateData(apiUpdateWorkflowType, null, {
              workflow_types_id: typeId,
              workflow_types_name: type.workflow_types_name,
              is_active: type.is_active ? "Y" : "N",
            });
            await updateData(apiUpdateWorkflowStage, null, {
              workflow_types_id: typeId,
              stage_order_json: JSON.stringify(type.stages),
            });
          }
        } else {
          if (!type.workflow_types_name || !type.brn_snos.length || !type.dept_snos.length) continue;
          for (const brn of type.brn_snos) {
            for (const dept of type.dept_snos) {
              const res = await postData(apiSaveWorkflowType, {
                workflow_id: selectedRow.workflow_id,
                workflow_types_name: type.workflow_types_name,
                com_sno: bp[String(brn)]?.com_sno ?? "",
                div_sno: bp[String(brn)]?.div_sno ?? "",
                brn_sno: brn, dept_sno: dept,
                is_active: type.is_active ? "Y" : "N",
              });
              const newTypeId = res?.data?.[0]?.workflow_types_id;
              if (newTypeId) {
                await postData(apiSaveWorkflowStage, {
                  workflow_types_id: newTypeId,
                  stage_order_json: JSON.stringify(type.stages),
                });
              }
            }
          }
        }
      }
      toast.success("Workflow updated successfully!");
      setListRefreshKey((k) => k + 1);
      setSelectedRow((prev) => prev
        ? { ...prev, workflow_name: editWorkflow.workflow_name, description: editWorkflow.description, is_active: editWorkflow.is_active ? "Y" : "N" }
        : prev
      );
    } catch {
      toast.error("Failed to update workflow");
    } finally {
      setEditSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow, editWorkflow, editTypes, buildBranchParent]);

  const activeTypes  = (mode === "create" ? createTypes : editTypes);
  const activeWf     = mode === "create" ? createWorkflow : editWorkflow;
  const hasFormOpen  = mode === "create" || mode === "edit";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-screen">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="bg-background border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Approval Workflows
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure multi-stage approval chains per entity and branch
            </p>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row" style={{ minHeight: 0 }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-background border-b lg:border-b-0 lg:border-r overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Select Workflow */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Select Workflow
              </p>
              <CustomInputField
                field="workflow"
                label="Workflow"
                type="select"
                options={workflowOptions}
                value={selectedId}
                onChange={handleSelectById}
                placeholder={listLoading ? "Loading workflows…" : "Choose a workflow…"}
              />
            </div>

            {/* Workflow summary card — shown when a workflow is selected */}
            {selectedRow && mode !== "create" && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Workflow Details
                </p>
                <Badge
                  variant={selectedRow.is_active === "Y" ? "default" : "secondary"}
                  className="gap-1.5 px-3 py-1.5 text-sm font-normal w-full justify-center"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {selectedRow.is_active === "Y" ? "Active" : "Inactive"}
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Entity Type</p>
                  <p className="text-xs font-medium text-foreground">{selectedRow.entity_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Code</p>
                  <p className="text-xs font-medium font-mono text-foreground">{selectedRow.workflow_code}</p>
                </div>
                {selectedRow.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                    <p className="text-xs text-foreground line-clamp-2">{selectedRow.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* "Creating new" indicator */}
            {mode === "create" && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  New Workflow
                </p>
                <p className="text-xs text-muted-foreground">
                  Fill in the details on the right to create a new approval workflow.
                </p>
              </div>
            )}

            {/* Loading indicator */}
            {mode === "loading" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading workflow…
              </div>
            )}

            {/* Action buttons — shown when form is open */}
            {hasFormOpen && canSave && (
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full gap-2"
                  // onClick={mode === "create" ? handleCreateSubmit : handleUpdateSubmit}
                  onClick={handleCreateSubmit}
                  disabled={isSaving}
                >
                  {isSaving
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Save className="h-4 w-4" />}
                  {isSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleDiscard}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4" />
                  Discard Changes
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground text-sm"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  Clear Selection
                </Button>
              </div>
            )}

            {/* New Workflow button — shown when no form is open */}
            {!hasFormOpen && canSave && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleNewWorkflow}
              >
                <Plus className="h-4 w-4" />
                New Workflow
              </Button>
            )}

          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Idle state */}
          {mode === "idle" && (
            <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 text-muted-foreground">
              <div className="bg-muted rounded-full p-6">
                <Layers size={40} className="opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-foreground/60">Select a Workflow</p>
                <p className="text-sm mt-1">
                  Choose a workflow from the left panel to view and edit its configuration
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {mode === "loading" && (
            <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading workflow details…</p>
            </div>
          )}

          {/* Form (create or edit) */}
          {hasFormOpen && (
            <div className="p-5 space-y-5">

              {/* Right panel section header — mirrors role approval's "Screen Permissions" header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {mode === "create"
                      ? "New Workflow"
                      : <>
                          Workflow Configuration
                          {selectedRow && (
                            <span className="ml-2 font-normal text-muted-foreground">
                              — {selectedRow.workflow_name}
                            </span>
                          )}
                        </>}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mode === "create"
                      ? "Workflow code is auto-generated on save"
                      : "Edit settings, approval types, and stage configuration"}
                  </p>
                </div>
                {mode === "edit" && selectedRow && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedRow.workflow_code}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {selectedRow.entity_type}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Basic info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {workflowFields.slice(0, 2).map((fc) => (
                      <CustomInputField
                        key={fc.field}
                        {...fc}
                        disabled={fc.disabled || (mode === "edit" && fc.field === "entity_type")}
                        value={activeWf[fc.field as keyof WorkflowFormData]}
                        onChange={(v) => {
                          if (mode === "create") {
                            setCreateWorkflow((prev) => {
                              const next = { ...prev, [fc.field]: v };
                              if (fc.field === "entity_type" && v && !prev.workflow_name)
                                next.workflow_name = `${v} Approval Workflow`;
                              return next;
                            });
                          } else {
                            setEditWorkflow((prev) => ({ ...prev, [fc.field]: v }));
                          }
                        }}
                      />
                    ))}
                  </div>
                  <CustomInputField
                    {...workflowFields[2]}
                    value={activeWf.description}
                    onChange={(v) =>
                      mode === "create"
                        ? setCreateWorkflow((p) => ({ ...p, description: v }))
                        : setEditWorkflow((p) => ({ ...p, description: v }))
                    }
                  />
                  <CustomInputField
                    {...workflowFields[3]}
                    value={activeWf.is_active}
                    onChange={(v) =>
                      mode === "create"
                        ? setCreateWorkflow((p) => ({ ...p, is_active: v }))
                        : setEditWorkflow((p) => ({ ...p, is_active: v }))
                    }
                  />
                </CardContent>
              </Card>

              {/* Workflow Types */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Workflow Types</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Each type expands into one entry per branch × department
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      mode === "create"
                        ? setCreateTypes((p) => [...p, emptyType()])
                        : setEditTypes((p) => [...p, emptyType()])
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Type
                  </Button>
                </div>

                {activeTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No types yet. Click "Add Type" to begin.
                  </p>
                )}

                {activeTypes.map((type, index) => (
                  <WorkflowTypeCard
                    key={index}
                    type={type}
                    typeIndex={index}
                    employeeOptions={employeeOptions}
                    onChange={mode === "create" ? ch.updateType : eh.updateType}
                    onStageChange={mode === "create" ? ch.updateStage : eh.updateStage}
                    onAddStage={mode === "create" ? ch.addStage : eh.addStage}
                    onRemoveStage={mode === "create" ? ch.removeStage : eh.removeStage}
                    onMoveStage={mode === "create" ? ch.moveStage : eh.moveStage}
                    onRemove={mode === "create" ? ch.removeType : eh.removeType}
                    removable={type._typeIds.length === 0}
                  />
                ))}
              </div>

              {/* Create success banner */}
              {mode === "create" && savedWorkflowId && (
                <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                          Workflow Created Successfully!
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          Workflow ID: {savedWorkflowId}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
