import { describe, it, expect } from "vitest";
import {
  buildWorkflowLabels,
  planTypeRowSync,
  workflowShortLabel,
} from "@/Application/RoleApproval/workflowUtils";
import type { WorkflowMasterRow } from "@/Application/RoleApproval/types/ApprovalWorkflowManagerTypes";

const wf = (over: Partial<WorkflowMasterRow> & { workflow_id: number }): WorkflowMasterRow => ({
  workflow_name: "PurchaseRequisition Approval Workflow",
  workflow_code: "WF_X",
  entity_type: "PurchaseRequisition",
  description: "",
  is_active: "Y",
  division_short: "",
  branch_names: "",
  ...over,
});

describe("workflowShortLabel", () => {
  it("abbreviates PR/PO and appends division short name and branch", () => {
    expect(
      workflowShortLabel(wf({ workflow_id: 3, division_short: "TCS", branch_names: "TCS-Coimbatore" }))
    ).toBe("PR · TCS · TCS-Coimbatore");
    expect(
      workflowShortLabel(wf({ workflow_id: 7, entity_type: "PurchaseOrder", division_short: "TCS", branch_names: "TCS-Coimbatore" }))
    ).toBe("PO · TCS · TCS-Coimbatore");
  });

  it("is just KYC for a KYC workflow, whatever division/branch it covers", () => {
    expect(
      workflowShortLabel(wf({ workflow_id: 4, entity_type: "KYC", division_short: "S", branch_names: "Sri Nachammal Vidyavani CBSE School" }))
    ).toBe("KYC");
  });

  it("joins several divisions with / and collapses long branch lists to +N", () => {
    const label = workflowShortLabel(
      wf({
        workflow_id: 20,
        entity_type: "PurchaseOrder",
        division_short: "SKJ|SKTM|TCS",
        branch_names: "Mettupalayam|SKTM-Coimbatore|TCS-Coimbatore",
      })
    );
    expect(label).toBe("PO · SKJ/SKTM/TCS · Mettupalayam, SKTM-Coimbatore +1");
  });

  it("un-camel-cases entities without an abbreviation", () => {
    expect(workflowShortLabel(wf({ workflow_id: 31, entity_type: "BankPaymentVoucher" }))).toBe("Bank Payment Voucher");
  });

  it("copes with a DB that predates the scope columns", () => {
    const old = wf({ workflow_id: 1 });
    delete old.division_short;
    delete old.branch_names;
    expect(workflowShortLabel(old)).toBe("PR");
  });
});

describe("buildWorkflowLabels", () => {
  it("keeps a lone KYC workflow as plain KYC", () => {
    const labels = buildWorkflowLabels([wf({ workflow_id: 2, entity_type: "KYC" })]);
    expect(labels.get(2)).toBe("KYC");
  });

  it("tells several KYC workflows apart by division/branch instead of showing KYC three times", () => {
    const labels = buildWorkflowLabels([
      wf({ workflow_id: 2, entity_type: "KYC" }),
      wf({ workflow_id: 4, entity_type: "KYC", division_short: "S", branch_names: "School" }),
      wf({ workflow_id: 10, entity_type: "KYC", division_short: "TCS", branch_names: "TCS-Coimbatore" }),
    ]);
    expect(labels.get(2)).toBe("KYC");
    expect(labels.get(4)).toBe("KYC · S · School");
    expect(labels.get(10)).toBe("KYC · TCS · TCS-Coimbatore");
  });

  it("appends the workflow id when labels are still identical", () => {
    const same = { division_short: "TCS", branch_names: "TCS-Coimbatore" };
    const labels = buildWorkflowLabels([
      wf({ workflow_id: 1, ...same }),
      wf({ workflow_id: 3, ...same }),
      wf({ workflow_id: 5, ...same }),
      wf({ workflow_id: 8, division_short: "S", branch_names: "School" }),
    ]);
    expect(labels.get(1)).toBe("PR · TCS · TCS-Coimbatore #1");
    expect(labels.get(3)).toBe("PR · TCS · TCS-Coimbatore #3");
    expect(labels.get(5)).toBe("PR · TCS · TCS-Coimbatore #5");
    expect(labels.get(8)).toBe("PR · S · School");
    expect(new Set(labels.values()).size).toBe(4);
  });
});

describe("planTypeRowSync", () => {
  // the reported case: PR type saved for Canteen (dept 1), user adds the new PACKING dept (4)
  const canteen = [{ id: 26, dept_sno: "1", brn_sno: "4" }];

  it("plans a row for a department newly selected on an existing type", () => {
    const plan = planTypeRowSync(canteen, ["1", "4"], ["4"]);
    expect(plan.addDepts).toEqual(["4"]);
    expect(plan.keep).toEqual(canteen);
    expect(plan.remove).toEqual([]);
  });

  it("does nothing when the selection matches what is saved", () => {
    const plan = planTypeRowSync(canteen, ["1"], ["4"]);
    expect(plan.addDepts).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("removes the row of a deselected department", () => {
    const rows = [...canteen, { id: 40, dept_sno: "4", brn_sno: "4" }];
    const plan = planTypeRowSync(rows, ["1"], ["4"]);
    expect(plan.remove).toEqual([{ id: 40, dept_sno: "4", brn_sno: "4" }]);
    expect(plan.keep).toEqual(canteen);
  });

  it("treats numeric selections the same as string ones", () => {
    const plan = planTypeRowSync(canteen, [1, 4] as unknown as string[], [4] as unknown as string[]);
    expect(plan.addDepts).toEqual(["4"]);
    expect(plan.remove).toEqual([]);
  });

  it("plans every selected department for a brand-new card with no rows", () => {
    expect(planTypeRowSync([], ["1", "4"], ["4"]).addDepts).toEqual(["1", "4"]);
  });

  it("never drops a legacy branch-only row just because no department is selected", () => {
    const legacy = [{ id: 19, dept_sno: "", brn_sno: "1" }];
    const plan = planTypeRowSync(legacy, [], ["1"]);
    expect(plan.keep).toEqual(legacy);
    expect(plan.remove).toEqual([]);
  });

  it("drops a legacy branch-only row when its branch is deselected", () => {
    const legacy = [{ id: 19, dept_sno: "", brn_sno: "1" }];
    expect(planTypeRowSync(legacy, [], ["4"]).remove).toEqual(legacy);
  });
});
