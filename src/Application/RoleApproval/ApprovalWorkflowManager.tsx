


import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, CheckCircle } from "lucide-react";
import { useApprovalFlowHierarchy } from "@/FieldDatas/ApprovalWorkFlow";
import { toast } from "sonner";
import usePost from "@/hooks/usePostHook";
import { createWorkFlowApproval } from "@/Services/Api";
import { Separator } from "@/components/ui/separator";
import { WorkflowFormData, WorkflowType, AuthBranch, WorkflowStage, Approver, Condition } from "./types/ApprovalWorkflowManagerTypes";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
// AuthBranch Component - Dynamic rendering
const AuthBranchItem: React.FC<{
  branch: AuthBranch;
  branchIdx: number;
  updateAuthBranch: (index: number, field: keyof AuthBranch, value: any) => void;
  removeAuthBranch: (index: number) => void;
}> = ({ branch, branchIdx, updateAuthBranch, removeAuthBranch }) => {
  const { authBranchFields } = useApprovalFlowHierarchy(
    branch.com_sno ? [Number(branch.com_sno)] : [],
    branch.div_sno ? [Number(branch.div_sno)] : [],
    branch.brn_sno ? [Number(branch.brn_sno)] : []
  );

  return (
    <Card className="mb-2 bg-muted/50">
      <CardContent className="pt-4">
        <div className="grid grid-cols-4 gap-3">
          {authBranchFields.map((fieldConfig) => (
            <CustomInputField
              key={fieldConfig.field}
              {...fieldConfig}
              value={branch[fieldConfig.field as keyof AuthBranch]}
              onChange={(value) => updateAuthBranch(branchIdx, fieldConfig.field as keyof AuthBranch, value)}
            />
          ))}
        </div>

        <Button
          onClick={() => removeAuthBranch(branchIdx)}
          variant="ghost"
          size="sm"
          className="mt-2 text-red-500 hover:text-red-600"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Remove
        </Button>
      </CardContent>
    </Card>
  );
};

// Approver Component - Dynamic rendering
const ApproverItem: React.FC<{
  approver: Approver;
  index: number;
  stages: WorkflowStage[];
  updateApprover: (index: number, field: keyof Approver, value: any) => void;
  removeApprover: (index: number) => void;
}> = ({ approver, index, stages, updateApprover, removeApprover }) => {
  const { approverFields } = useApprovalFlowHierarchy(
    approver.com_sno ? [Number(approver.com_sno)] : [],
    approver.div_sno ? [Number(approver.div_sno)] : [],
    approver.brn_sno ? [Number(approver.brn_sno)] : []
  );

  // Add stage options dynamically
  const stageOptions = stages.map((stage, idx) => ({
    label: stage.stage_name || `Stage ${idx + 1}`,
    value: idx.toString(),
  }));

  // Update stage_id field with dynamic options
  const fieldsWithStages = approverFields.map((field) => {
    if (field.field === "stage_id") {
      return { ...field, options: stageOptions };
    }
    return field;
  });

  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Badge variant="outline">#{index + 1}</Badge>

          <div className="flex-1 space-y-4">
            {/* Stage Selection - First 3 fields */}
            <div className="grid grid-cols-3 gap-4">
              {fieldsWithStages.slice(0, 3).map((fieldConfig) => (
                <CustomInputField
                  key={fieldConfig.field}
                  {...fieldConfig}
                  value={
                    fieldConfig.field === "stage_id"
                      ? approver.stage_id.toString()
                      : approver[fieldConfig.field as keyof Approver]
                  }
                  onChange={(value) => {
                    const actualValue =
                      fieldConfig.field === "stage_id" ? parseInt(value) : value;
                    updateApprover(index, fieldConfig.field as keyof Approver, actualValue);
                  }}
                />
              ))}
            </div>

            {/* Hierarchy Selection - Next 4 fields */}
            <div className="grid grid-cols-4 gap-4">
              {fieldsWithStages.slice(3, 7).map((fieldConfig) => (
                <CustomInputField
                  key={fieldConfig.field}
                  {...fieldConfig}
                  value={approver[fieldConfig.field as keyof Approver]}
                  onChange={(value) =>
                    updateApprover(index, fieldConfig.field as keyof Approver, value)
                  }
                />
              ))}
            </div>

            {/* Active Switch - Last field */}
            <div className="flex items-center space-x-2">
              {fieldsWithStages.slice(7).map((fieldConfig) => (
                <CustomInputField
                  key={fieldConfig.field}
                  {...fieldConfig}
                  value={approver[fieldConfig.field as keyof Approver]}
                  onChange={(value) =>
                    updateApprover(index, fieldConfig.field as keyof Approver, value)
                  }
                />
              ))}
            </div>
          </div>

          <Button
            onClick={() => removeApprover(index)}
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const ApprovalFlowDynamic: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [workflowId, setWorkflowId] = useState<number | null>(null);

  // Form States
  const [workflow, setWorkflow] = useState<WorkflowFormData>({
    workflow_name: "",
    workflow_code: "",
    entity_type: "",
    description: "",
    is_active: true,
  });

  const [workflowTypes, setWorkflowTypes] = useState<WorkflowType[]>([
    {
      workflow_types_name: "",
      types_branches: "",
      is_active: true,
    },
  ]);

  const [authBranches, setAuthBranches] = useState<AuthBranch[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([
    {
      stage_order: 1,
      stage_name: "",
      stage_type: "approval",
      required_approvals: 1,
      is_mandatory: true,
      can_skip: false,
      escalation_hours: 24,
      is_active: true,
    },
  ]);

  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  const { postData } = usePost<any>();
  const { workflowFields, workflowTypeFields, stageFields, conditionFields } = useApprovalFlowHierarchy();

  // ============ WORKFLOW HANDLERS ============
  const handleWorkflowChange = (field: keyof WorkflowFormData, value: any) => {
    setWorkflow((prev) => ({ ...prev, [field]: value }));
  };

  // ============ WORKFLOW TYPES HANDLERS ============
  const addWorkflowType = () => {
    setWorkflowTypes((prev) => [
      ...prev,
      {
        workflow_types_name: "",
        types_branches: "",
        is_active: true,
      },
    ]);
  };

  const updateWorkflowType = (index: number, field: keyof WorkflowType, value: any) => {
    setWorkflowTypes((prev) =>
      prev.map((type, i) => (i === index ? { ...type, [field]: value } : type))
    );
  };

  const removeWorkflowType = (index: number) => {
    setWorkflowTypes((prev) => prev.filter((_, i) => i !== index));
    setAuthBranches((prev) => prev.filter((branch) => branch.workflow_types_id !== index));
  };

  // ============ AUTH BRANCHES HANDLERS ============
  const addAuthBranch = (workflowTypeIndex: number) => {
    setAuthBranches((prev) => [
      ...prev,
      {
        workflow_types_id: workflowTypeIndex,
        com_sno: "",
        div_sno: "",
        brn_sno: "",
        dept_sno: "",
      },
    ]);
  };

  const updateAuthBranch = (index: number, field: keyof AuthBranch, value: any) => {
    setAuthBranches((prev) =>
      prev.map((branch, i) => {
        if (i === index) {
          if (field === "com_sno") {
            return { ...branch, com_sno: value, div_sno: "", brn_sno: "", dept_sno: "" };
          }
          if (field === "div_sno") {
            return { ...branch, div_sno: value, brn_sno: "", dept_sno: "" };
          }
          if (field === "brn_sno") {
            return { ...branch, brn_sno: value, dept_sno: "" };
          }
          return { ...branch, [field]: value };
        }
        return branch;
      })
    );
  };

  const removeAuthBranch = (index: number) => {
    setAuthBranches((prev) => prev.filter((_, i) => i !== index));
  };

  // ============ STAGE HANDLERS ============
  const addStage = () => {
    setStages((prev) => [
      ...prev,
      {
        stage_order: prev.length + 1,
        stage_name: "",
        stage_type: "approval",
        required_approvals: 1,
        is_mandatory: true,
        can_skip: false,
        escalation_hours: 24,
        is_active: true,
      },
    ]);
  };

  const updateStage = (index: number, field: keyof WorkflowStage, value: any) => {
    setStages((prev) =>
      prev.map((stage, i) => (i === index ? { ...stage, [field]: value } : stage))
    );
  };

  const removeStage = (index: number) => {
    setStages((prev) =>
      prev.filter((_, i) => i !== index).map((stage, idx) => ({ ...stage, stage_order: idx + 1 }))
    );
  };

  const moveStage = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === stages.length - 1)
    )
      return;

    const newStages = [...stages];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];

    setStages(newStages.map((stage, idx) => ({ ...stage, stage_order: idx + 1 })));
  };

  // ============ APPROVER HANDLERS ============
  const addApprover = () => {
    setApprovers((prev) => [
      ...prev,
      {
        primary_approver_id: "",
        secondary_approver_id: "0",
        stage_id: 0,
        com_sno: "",
        div_sno: "",
        brn_sno: "",
        dept_sno: "",
        is_active: true,
      },
    ]);
  };

  const updateApprover = (index: number, field: keyof Approver, value: any) => {
    setApprovers((prev) =>
      prev.map((approver, i) => {
        if (i === index) {
          if (field === "com_sno") {
            return { ...approver, com_sno: value, div_sno: "", brn_sno: "", dept_sno: "" };
          }
          if (field === "div_sno") {
            return { ...approver, div_sno: value, brn_sno: "", dept_sno: "" };
          }
          if (field === "brn_sno") {
            return { ...approver, brn_sno: value, dept_sno: "" };
          }
          return { ...approver, [field]: value };
        }
        return approver;
      })
    );
  };

  const removeApprover = (index: number) => {
    setApprovers((prev) => prev.filter((_, i) => i !== index));
  };

  // ============ CONDITION HANDLERS ============
  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      {
        condition_name: "",
        condition_type: "amount",
        operator_type: ">",
        condition_value: "",
        priority_order: prev.length + 1,
        stage_id: 0,
        target_stage_id: 0,
        is_active: true,
      },
    ]);
  };

  const updateCondition = (index: number, field: keyof Condition, value: any) => {
    setConditions((prev) =>
      prev.map((condition, i) => (i === index ? { ...condition, [field]: value } : condition))
    );
  };

  const removeCondition = (index: number) => {
    setConditions((prev) =>
      prev.filter((_, i) => i !== index).map((cond, idx) => ({ ...cond, priority_order: idx + 1 }))
    );
  };

  // ============ VALIDATION ============
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!workflow.workflow_name || !workflow.workflow_code || !workflow.entity_type) {
          toast.error("Please fill all required workflow fields");
          return false;
        }
        return true;

      case 2:
        if (workflowTypes.some((type) => !type.workflow_types_name)) {
          toast.error("Please fill all workflow type names");
          return false;
        }
        return true;

      case 3:
        if (stages.length === 0) {
          toast.error("At least one stage is required");
          return false;
        }
        if (stages.some((stage) => !stage.stage_name)) {
          toast.error("Please fill all stage names");
          return false;
        }
        return true;

      case 4:
        if (approvers.length === 0) {
          toast.warning("No approvers added. Consider adding at least one.");
        }
        return true;

      case 5:
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // ============ SUBMIT HANDLER ============
  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setLoading(true);

    const payload = {
      workflow,
      workflowTypes,
      authBranches,
      stages,
      approvers,
      conditions,
    };

    try {
      const data = await postData(createWorkFlowApproval, payload);
      console.log("Workflow created:", data);
      setWorkflowId(data?.workflow_id || Math.floor(Math.random() * 1000) + 1);
      toast.success("Workflow saved successfully!");
    } catch (error) {
      toast.error("Failed to save workflow");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Add stage options dynamically to condition fields
  const stageOptions = stages.map((stage, idx) => ({
    label: stage.stage_name || `Stage ${idx + 1}`,
    value: idx.toString(),
  }));

  const conditionFieldsWithStages = conditionFields.map((field) => {
    if (field.field === "stage_id" || field.field === "target_stage_id") {
      return { ...field, options: stageOptions };
    }
    return field;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dynamic Workflow Configuration</h1>
          <p className="text-muted-foreground">
            Create approval workflows with cascading hierarchy selection
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {["Basic Info", "Workflow Types", "Stages", "Approvers", "Conditions"].map(
            (label, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      currentStep > index + 1
                        ? "bg-green-500 text-white"
                        : currentStep === index + 1
                        ? "bg-primary text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > index + 1 ? <CheckCircle className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className="text-xs mt-2 text-center max-w-[100px]">{label}</span>
                </div>
                {index < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      currentStep > index + 1 ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </React.Fragment>
            )
          )}
        </div>
      </div>

      {/* Step 1: Basic Workflow Info */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Workflow Information</CardTitle>
            <CardDescription>Define the core details of your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {workflowFields.slice(0, 2).map((fieldConfig) => (
                <CustomInputField
                  key={fieldConfig.field}
                  {...fieldConfig}
                  value={workflow[fieldConfig.field as keyof WorkflowFormData]}
                  onChange={(value) =>
                    handleWorkflowChange(fieldConfig.field as keyof WorkflowFormData, value)
                  }
                />
              ))}
            </div>

            {workflowFields.slice(2, 4).map((fieldConfig) => (
              <CustomInputField
                key={fieldConfig.field}
                {...fieldConfig}
                value={workflow[fieldConfig.field as keyof WorkflowFormData]}
                onChange={(value) =>
                  handleWorkflowChange(fieldConfig.field as keyof WorkflowFormData, value)
                }
              />
            ))}

            <div className="flex items-center space-x-2">
              {workflowFields.slice(4).map((fieldConfig) => (
                <CustomInputField
                  key={fieldConfig.field}
                  {...fieldConfig}
                  value={workflow[fieldConfig.field as keyof WorkflowFormData]}
                  onChange={(value) =>
                    handleWorkflowChange(fieldConfig.field as keyof WorkflowFormData, value)
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Workflow Types */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflow Types</CardTitle>
                <CardDescription>Define different types/variants for this workflow</CardDescription>
              </div>
              <Button onClick={addWorkflowType} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Type
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowTypes.map((type, index) => (
              <Card key={index} className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-2">
                      Type {index + 1}
                    </Badge>

                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {workflowTypeFields.slice(0, 2).map((fieldConfig) => (
                          <CustomInputField
                            key={fieldConfig.field}
                            {...fieldConfig}
                            value={type[fieldConfig.field as keyof WorkflowType]}
                            onChange={(value) =>
                              updateWorkflowType(index, fieldConfig.field as keyof WorkflowType, value)
                            }
                          />
                        ))}
                      </div>

                      <div className="flex items-center space-x-2">
                        {workflowTypeFields.slice(2).map((fieldConfig) => (
                          <CustomInputField
                            key={fieldConfig.field}
                            {...fieldConfig}
                            value={type[fieldConfig.field as keyof WorkflowType]}
                            onChange={(value) =>
                              updateWorkflowType(index, fieldConfig.field as keyof WorkflowType, value)
                            }
                          />
                        ))}
                      </div>

                      {/* Auth Branches Section */}
                      <Separator />
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-semibold">
                            Authorized Branches for this Type
                          </label>
                          <Button
                            onClick={() => addAuthBranch(index)}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Branch
                          </Button>
                        </div>

                        {authBranches
                          .filter((branch) => branch.workflow_types_id === index)
                          .map((branch) => {
                            const branchIdx = authBranches.indexOf(branch);
                            return (
                              <AuthBranchItem
                                key={branchIdx}
                                branch={branch}
                                branchIdx={branchIdx}
                                updateAuthBranch={updateAuthBranch}
                                removeAuthBranch={removeAuthBranch}
                              />
                            );
                          })}
                      </div>
                    </div>

                    <Button
                      onClick={() => removeWorkflowType(index)}
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Stages */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Approval Stages</CardTitle>
                <CardDescription>
                  Define the sequential stages for approval workflow
                </CardDescription>
              </div>
              <Button onClick={addStage} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Stage
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stages.map((stage, index) => (
              <Card key={index} className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    {/* Order Controls */}
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => moveStage(index, "up")}
                        disabled={index === 0}
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Badge variant="secondary" className="justify-center">
                        {stage.stage_order}
                      </Badge>
                      <Button
                        onClick={() => moveStage(index, "down")}
                        disabled={index === stages.length - 1}
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Stage Details */}
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {stageFields.slice(0, 2).map((fieldConfig) => (
                          <CustomInputField
                            key={fieldConfig.field}
                            {...fieldConfig}
                            value={stage[fieldConfig.field as keyof WorkflowStage]}
                            onChange={(value) =>
                              updateStage(index, fieldConfig.field as keyof WorkflowStage, value)
                            }
                          />
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {stageFields.slice(2, 4).map((fieldConfig) => (
                          <CustomInputField
                            key={fieldConfig.field}
                            {...fieldConfig}
                            value={stage[fieldConfig.field as keyof WorkflowStage]}
                            onChange={(value) => {
                              const actualValue =
                                fieldConfig.type === "number" ? parseInt(value) || 1 : value;
                              updateStage(
                                index,
                                fieldConfig.field as keyof WorkflowStage,
                                actualValue
                              );
                            }}
                          />
                        ))}

                        <div className="space-y-2">
                          <label className="text-sm text-transparent">Switches</label>
                          <div className="flex flex-col gap-2">
                            {stageFields.slice(4).map((fieldConfig) => (
                              <div key={fieldConfig.field} className="flex items-center space-x-2">
                                <CustomInputField
                                  {...fieldConfig}
                                  value={stage[fieldConfig.field as keyof WorkflowStage]}
                                  onChange={(value) =>
                                    updateStage(
                                      index,
                                      fieldConfig.field as keyof WorkflowStage,
                                      value
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      onClick={() => removeStage(index)}
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Approvers */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Stage Approvers</CardTitle>
                <CardDescription>
                  Assign primary and secondary approvers for each stage
                </CardDescription>
              </div>
              <Button onClick={addApprover} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Approver
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No approvers added yet. Click "Add Approver" to get started.</p>
              </div>
            ) : (
              approvers.map((approver, index) => (
                <ApproverItem
                  key={index}
                  approver={approver}
                  index={index}
                  stages={stages}
                  updateApprover={updateApprover}
                  removeApprover={removeApprover}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Conditions */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Routing Conditions</CardTitle>
                <CardDescription>
                  Define dynamic routing rules based on conditions (Optional)
                </CardDescription>
              </div>
              <Button onClick={addCondition} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Condition
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {conditions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No conditions added. Workflow will follow sequential stage order.</p>
                <p className="text-sm mt-2">
                  Add conditions for dynamic routing based on business rules.
                </p>
              </div>
            ) : (
              conditions.map((condition, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-2">
                        P{condition.priority_order}
                      </Badge>

                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {conditionFieldsWithStages.slice(0, 2).map((fieldConfig) => (
                            <CustomInputField
                              key={fieldConfig.field}
                              {...fieldConfig}
                              value={condition[fieldConfig.field as keyof Condition]}
                              onChange={(value) =>
                                updateCondition(
                                  index,
                                  fieldConfig.field as keyof Condition,
                                  value
                                )
                              }
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          {conditionFieldsWithStages.slice(2, 6).map((fieldConfig) => (
                            <CustomInputField
                              key={fieldConfig.field}
                              {...fieldConfig}
                              value={
                                fieldConfig.field === "stage_id" ||
                                fieldConfig.field === "target_stage_id"
                                  ? condition[fieldConfig.field as keyof Condition].toString()
                                  : condition[fieldConfig.field as keyof Condition]
                              }
                              onChange={(value) => {
                                const actualValue =
                                  fieldConfig.field === "stage_id" ||
                                  fieldConfig.field === "target_stage_id"
                                    ? parseInt(value)
                                    : value;
                                updateCondition(
                                  index,
                                  fieldConfig.field as keyof Condition,
                                  actualValue
                                );
                              }}
                            />
                          ))}
                        </div>

                        <div className="flex items-center space-x-2">
                          {conditionFieldsWithStages.slice(6).map((fieldConfig) => (
                            <CustomInputField
                              key={fieldConfig.field}
                              {...fieldConfig}
                              value={condition[fieldConfig.field as keyof Condition]}
                              onChange={(value) =>
                                updateCondition(
                                  index,
                                  fieldConfig.field as keyof Condition,
                                  value
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={() => removeCondition(index)}
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button onClick={handlePrevious} disabled={currentStep === 1} variant="outline" size="lg">
          Previous
        </Button>

        <div className="flex gap-2">
          {currentStep < 5 ? (
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

      {/* Success Message */}
      {workflowId && (
        <Card className="mt-6 border-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Workflow Created Successfully!</p>
                <p className="text-sm text-green-700">
                  Workflow ID: {workflowId} - Check browser console for full payload
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

