import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
} from "lucide-react";
import { useApprovalFlowHierarchy } from "@/FieldDatas/ApprovalWorkFlow";
import { toast } from "sonner";
import usePost from "@/hooks/usePostHook";
import { apiSaveFullWorkflow, apiGetEmployee, apiGetSignEmployee } from "@/Services/Api";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import {
  WorkflowFormData,
  WorkflowType,
  StageOrderItem,
} from "./types/ApprovalWorkflowManagerTypes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const emptyType = (): WorkflowType => ({
  workflow_types_name: "",
  com_sno: "",
  div_sno: "",
  brn_sno: "",
  dept_sno: "",
  is_active: true,
  stages: [emptyStage()],
});

const YN_OPTIONS = [
  { label: "Yes", value: "Y" },
  { label: "No",  value: "N" },
];

// ─── Workflow Type Card (cascade: company → division → branch + static dept) ─

const WorkflowTypeCard: React.FC<{
  type: WorkflowType;
  typeIndex: number;
  employeeOptions: { label: string; value: string }[];
  onChange: (i: number, field: keyof WorkflowType, value: any) => void;
  onStageChange: (typeIdx: number, stageIdx: number, field: keyof StageOrderItem, value: string) => void;
  onAddStage: (typeIdx: number) => void;
  onRemoveStage: (typeIdx: number, stageIdx: number) => void;
  onMoveStage: (typeIdx: number, stageIdx: number, dir: "up" | "down") => void;
  onRemove: (i: number) => void;
  showStages: boolean;
}> = React.memo(({ type, typeIndex, employeeOptions, onChange, onStageChange, onAddStage, onRemoveStage, onMoveStage, onRemove, showStages,}) => {
  const { workflowTypeFields } = useApprovalFlowHierarchy(
    type.com_sno ? [Number(type.com_sno)] : [],
    type.div_sno ? [Number(type.div_sno)] : [],
    type.brn_sno ? [Number(type.brn_sno)] : []
  );

  const handleTypeField = (field: string, v: string) => {
    // Reset downstream cascade values when parent changes
    if (field === "com_sno") {
      onChange(typeIndex, "com_sno", v);
      onChange(typeIndex, "div_sno", "");
      onChange(typeIndex, "brn_sno", "");
    } else if (field === "div_sno") {
      onChange(typeIndex, "div_sno", v);
      onChange(typeIndex, "brn_sno", "");
    } else {
      onChange(typeIndex, field as keyof WorkflowType, v);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Type {typeIndex + 1}</Badge>
            <span className="font-medium text-sm">
              {type.workflow_types_name || "Unnamed Type"}
            </span>
            {type.brn_sno && (
              <Badge variant="outline" className="text-xs">
                Brn: {type.brn_sno}
              </Badge>
            )}
            {type.dept_sno && (
              <Badge variant="outline" className="text-xs">
                Dept: {type.dept_sno}
              </Badge>
            )}
          </div>
          <Button
            onClick={() => onRemove(typeIndex)}
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 h-8 w-8"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Type Name */}
        <CustomInputField
          {...workflowTypeFields[0]}
          value={type.workflow_types_name}
          onChange={(v) => onChange(typeIndex, "workflow_types_name", v)}
        />

        {/* Branch/Dept cascade */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {workflowTypeFields.slice(1, 5).map((fc) => (
            <CustomInputField
              key={fc.field}
              {...fc}
              value={type[fc.field as keyof WorkflowType] as string}
              onChange={(v) => handleTypeField(fc.field, v)}
            />
          ))}
        </div>

        {/* is_active */}
        <CustomInputField
          {...workflowTypeFields[5]}
          value={type.is_active}
          onChange={(v) => onChange(typeIndex, "is_active", v)}
        />

        {/* ── Stage Configuration (shown in step 3) ── */}
        {showStages && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Stages ({type.stages.length})
              </h4>
              <Button
                onClick={() => onAddStage(typeIndex)}
                size="sm"
                variant="outline"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Stage
              </Button>
            </div>

            {type.stages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No stages yet. Click "Add Stage" to begin.
              </p>
            )}

            {type.stages.map((stage, stageIdx) => (
              <Card key={stageIdx} className="border bg-muted/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1 pt-1">
                      <Button
                        onClick={() => onMoveStage(typeIndex, stageIdx, "up")}
                        disabled={stageIdx === 0}
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Badge variant="secondary" className="justify-center text-xs px-1">
                        {stageIdx + 1}
                      </Badge>
                      <Button
                        onClick={() => onMoveStage(typeIndex, stageIdx, "down")}
                        disabled={stageIdx === type.stages.length - 1}
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* Row 1: Stage name + Approver */}
                      <div className="grid grid-cols-2 gap-3">
                        <CustomInputField
                          field="stage"
                          label="Stage Name"
                          type="text"
                          placeholder="e.g., Manager Review"
                          require={true}
                          input={true}
                          view={true}
                          value={stage.stage}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "stage", v)}
                        />
                        <CustomInputField
                          field="approver_ecno"
                          label="Approver"
                          type="select"
                          placeholder="Select approver"
                          require={true}
                          input={true}
                          view={true}
                          options={employeeOptions}
                          value={stage.approver_ecno}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "approver_ecno", v)}
                        />
                      </div>

                      {/* Row 2: Numeric fields */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <CustomInputField
                          field="required_approvals"
                          label="Required Approvals"
                          type="number"
                          min="1"
                          input={true}
                          view={true}
                          value={stage.required_approvals}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "required_approvals", v)}
                        />
                        <CustomInputField
                          field="is_mandatory"
                          label="Is Mandatory"
                          type="select"
                          input={true}
                          view={true}
                          options={YN_OPTIONS}
                          value={stage.is_mandatory}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "is_mandatory", v)}
                        />
                        <CustomInputField
                          field="escalation_hours"
                          label="Escalation Hours"
                          type="number"
                          min="1"
                          input={true}
                          view={true}
                          value={stage.escalation_hours}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "escalation_hours", v)}
                        />
                        <CustomInputField
                          field="next_approver_ecno"
                          label="Next Approver"
                          type="select"
                          placeholder="Select (optional)"
                          input={true}
                          view={true}
                          options={[{ label: "None", value: "0" }, ...employeeOptions]}
                          value={stage.next_approver_ecno}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "next_approver_ecno", v)}
                        />
                      </div>

                      {/* Row 3: Condition + flags */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-1">
                          <CustomInputField
                            field="approver_condition"
                            label="Approver Condition"
                            type="text"
                            placeholder="e.g., amount > 50000"
                            input={true}
                            view={true}
                            value={stage.approver_condition}
                            onChange={(v) => onStageChange(typeIndex, stageIdx, "approver_condition", v)}
                          />
                        </div>
                        <CustomInputField
                          field="can_forward"
                          label="Can Forward"
                          type="select"
                          input={true}
                          view={true}
                          options={YN_OPTIONS}
                          value={stage.can_forward}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "can_forward", v)}
                        />
                        <CustomInputField
                          field="can_backward"
                          label="Can Backward"
                          type="select"
                          input={true}
                          view={true}
                          options={YN_OPTIONS}
                          value={stage.can_backward}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "can_backward", v)}
                        />
                        <CustomInputField
                          field="can_edit_data"
                          label="Can Edit Data"
                          type="select"
                          input={true}
                          view={true}
                          options={YN_OPTIONS}
                          value={stage.can_edit_data}
                          onChange={(v) => onStageChange(typeIndex, stageIdx, "can_edit_data", v)}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => onRemoveStage(typeIndex, stageIdx)}
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

const ApprovalFlowDynamic: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [savedWorkflowId, setSavedWorkflowId] = useState<number | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<{ label: string; value: string }[]>([]);

  const [workflow, setWorkflow] = useState<WorkflowFormData>({
    workflow_name: "",
    workflow_code: "",
    entity_type: "",
    description: "",
    is_active: true,
  });

  const [workflowTypes, setWorkflowTypes] = useState<WorkflowType[]>([emptyType()]);

  const { postData } = usePost<any>();
  const { workflowFields, entityTypeCount } = useApprovalFlowHierarchy();

  // Fetch employee list once on mount
  useEffect(() => {
    postData(apiGetSignEmployee, {})
      .then((res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        setEmployeeOptions(
          list.map((e) => ({ label: `${e.ename} (${e.ecno})`, value: e.ecno }))
        );
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Workflow master handlers ──
  const handleWorkflowChange = useCallback(
    (field: keyof WorkflowFormData, value: any) => {
      setWorkflow((prev) => {
        const updated: WorkflowFormData = { ...prev, [field]: value };
        if (field === "entity_type" && value) {
          const count = entityTypeCount[value] || 0;
          updated.workflow_code = `WF_${value}_${String(count + 1).padStart(3, "0")}`;
          if (!prev.workflow_name) {
            updated.workflow_name = `${value} Approval Workflow`;
          }
        }
        return updated;
      });
    },
    [entityTypeCount]
  );

  // ── WorkflowType handlers (all stable — functional setters only) ──
  const addWorkflowType = useCallback(
    () => setWorkflowTypes((prev) => [...prev, emptyType()]),
    []
  );

  const updateWorkflowType = useCallback(
    (index: number, field: keyof WorkflowType, value: any) =>
      setWorkflowTypes((prev) =>
        prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
      ),
    []
  );

  const removeWorkflowType = useCallback(
    (index: number) =>
      setWorkflowTypes((prev) => prev.filter((_, i) => i !== index)),
    []
  );

  // ── Stage handlers (per workflow type, all stable) ──
  const addStage = useCallback(
    (typeIdx: number) =>
      setWorkflowTypes((prev) =>
        prev.map((t, i) =>
          i === typeIdx ? { ...t, stages: [...t.stages, emptyStage()] } : t
        )
      ),
    []
  );

  const updateStage = useCallback(
    (typeIdx: number, stageIdx: number, field: keyof StageOrderItem, value: string) =>
      setWorkflowTypes((prev) =>
        prev.map((t, i) =>
          i === typeIdx
            ? {
                ...t,
                stages: t.stages.map((s, si) =>
                  si === stageIdx ? { ...s, [field]: value } : s
                ),
              }
            : t
        )
      ),
    []
  );

  const removeStage = useCallback(
    (typeIdx: number, stageIdx: number) =>
      setWorkflowTypes((prev) =>
        prev.map((t, i) =>
          i === typeIdx
            ? { ...t, stages: t.stages.filter((_, si) => si !== stageIdx) }
            : t
        )
      ),
    []
  );

  const moveStage = useCallback(
    (typeIdx: number, stageIdx: number, dir: "up" | "down") =>
      setWorkflowTypes((prev) =>
        prev.map((t, i) => {
          if (i !== typeIdx) return t;
          const arr = [...t.stages];
          const target = dir === "up" ? stageIdx - 1 : stageIdx + 1;
          if (target < 0 || target >= arr.length) return t;
          [arr[stageIdx], arr[target]] = [arr[target], arr[stageIdx]];
          return { ...t, stages: arr };
        })
      ),
    []
  );

  // ── Validation ──
  const validateStep = useCallback(
    (step: number): boolean => {
      if (step === 1) {
        if (!workflow.workflow_name || !workflow.workflow_code || !workflow.entity_type) {
          toast.error("Please fill all required workflow fields");
          return false;
        }
      }
      if (step === 2) {
        if (workflowTypes.some((t) => !t.workflow_types_name || !t.brn_sno || !t.dept_sno)) {
          toast.error("Each workflow type needs a name, branch, and department");
          return false;
        }
      }
      if (step === 3) {
        for (const t of workflowTypes) {
          if (t.stages.length === 0) {
            toast.error(`Workflow type "${t.workflow_types_name}" has no stages`);
            return false;
          }
          if (t.stages.some((s) => !s.stage || !s.approver_ecno)) {
            toast.error("Each stage must have a name and an approver");
            return false;
          }
        }
      }
      return true;
    },
    [workflow, workflowTypes]
  );

  const handleNext = useCallback(
    () => { if (validateStep(currentStep)) setCurrentStep((p) => Math.min(p + 1, 3)); },
    [validateStep, currentStep]
  );
  const handlePrevious = useCallback(
    () => setCurrentStep((p) => Math.max(p - 1, 1)),
    []
  );

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!validateStep(3)) return;
    setLoading(true);

    const payload = {
      workflow_name: workflow.workflow_name,
      workflow_code: workflow.workflow_code,
      entity_type:   workflow.entity_type,
      description:   workflow.description,
      is_active:     workflow.is_active ? "Y" : "N",
      workflow_types: workflowTypes.map((t) => ({
        workflow_types_name: t.workflow_types_name,
        brn_sno:             t.brn_sno,
        dept_sno:            t.dept_sno,
        is_active:           t.is_active ? "Y" : "N",
        stage_order_json:    JSON.stringify(t.stages),
      })),
    };

    try {
      const data = await postData(apiSaveFullWorkflow, payload);
      setSavedWorkflowId(data?.data?.[0]?.workflow_id ?? null);
      toast.success("Workflow saved successfully!");
    } catch {
      toast.error("Failed to save workflow");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validateStep, workflow, workflowTypes]);

  const steps = ["Basic Info", "Workflow Types", "Stage Configuration"];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Approval Workflow Configuration</h1>
        <p className="text-muted-foreground">
          Create approval workflows scoped to branch &amp; department
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    currentStep > i + 1
                      ? "bg-green-500 text-white"
                      : currentStep === i + 1
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {currentStep > i + 1 ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span className="text-xs mt-2 text-center max-w-[110px]">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-all ${
                    currentStep > i + 1 ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Step 1: Basic Workflow Info ── */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Workflow Information</CardTitle>
            <CardDescription>Define the core details of your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {workflowFields.slice(0, 2).map((fc) => (
                <CustomInputField
                  key={fc.field}
                  {...fc}
                  value={workflow[fc.field as keyof WorkflowFormData]}
                  onChange={(v) => handleWorkflowChange(fc.field as keyof WorkflowFormData, v)}
                />
              ))}
            </div>
            {workflowFields.slice(2, 4).map((fc) => (
              <CustomInputField
                key={fc.field}
                {...fc}
                value={workflow[fc.field as keyof WorkflowFormData]}
                onChange={(v) => handleWorkflowChange(fc.field as keyof WorkflowFormData, v)}
              />
            ))}
            <div className="flex items-center space-x-2">
              {workflowFields.slice(4).map((fc) => (
                <CustomInputField
                  key={fc.field}
                  {...fc}
                  value={workflow[fc.field as keyof WorkflowFormData]}
                  onChange={(v) => handleWorkflowChange(fc.field as keyof WorkflowFormData, v)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Workflow Types (branch + dept selection) ── */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflow Types</CardTitle>
                <CardDescription>
                  Each type is scoped to a specific branch and department
                </CardDescription>
              </div>
              <Button onClick={addWorkflowType} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Type
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowTypes.map((type, index) => (
              <WorkflowTypeCard
                key={index}
                type={type}
                typeIndex={index}
                employeeOptions={employeeOptions}
                onChange={updateWorkflowType}
                onStageChange={updateStage}
                onAddStage={addStage}
                onRemoveStage={removeStage}
                onMoveStage={moveStage}
                onRemove={removeWorkflowType}
                showStages={false}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Stage Configuration per workflow type ── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Stage Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure approval stages for each workflow type
              </p>
            </div>
          </div>

          {workflowTypes.map((type, index) => (
            <WorkflowTypeCard
              key={index}
              type={type}
              typeIndex={index}
              employeeOptions={employeeOptions}
              onChange={updateWorkflowType}
              onStageChange={updateStage}
              onAddStage={addStage}
              onRemoveStage={removeStage}
              onMoveStage={moveStage}
              onRemove={removeWorkflowType}
              showStages={true}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          variant="outline"
          size="lg"
        >
          Previous
        </Button>
        <div className="flex gap-2">
          {currentStep < 3 ? (
            <Button onClick={handleNext} size="lg">
              Next Step
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Saving..." : "Save Workflow"}
            </Button>
          )}
        </div>
      </div>

      {/* Success banner */}
      {savedWorkflowId && (
        <Card className="mt-6 border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Workflow Created Successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Workflow ID: {savedWorkflowId}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApprovalFlowDynamic;
