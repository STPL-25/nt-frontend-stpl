import { describe, it, expect } from "vitest";
import {
  buildSupplierTrail, countByStatus, displayName, filterSuppliers, pendingLine,
  type SupplierStatusRow, type SupplierTimelineData,
} from "@/Application/SupplierStatus/supplierStatusModel";

const row = (over: Partial<SupplierStatusRow> = {}): SupplierStatusRow => ({
  source: "KYC", record_id: 1, company_name: "Silver Zone", supp_code: "SCL2603", status: "A", category: "Supplier",
  contact_person: "Keerthi", email: "a@b.com", mobile_number: "9999999999", gst_no: "27ADBFS8275R1Z3", pan_no: "ADBFS8275R1Z",
  business_type_name: "Public Limited Company", created_by: "KTM1148", created_by_name: "JAYAPRAKASH. K", created_date: "2026-07-31T13:57:08Z",
  current_approver_id: null, current_approver_name: null, stage_no: null, total_stages: 1,
  last_action_by: "SNV11097", last_action_by_name: "KEERTHIKA G", last_action_date: "2026-08-12T00:00:00Z",
  ...over,
});

const ROWS = [
  row({ record_id: 1 }),
  row({ record_id: 2, company_name: "Amazon Web Service", supp_code: "SVK-2026-0002", category: "Service Vendor", gst_no: null }),
  row({ record_id: 3, company_name: "Pending Traders", status: "P", supp_code: null, gst_no: null, current_approver_id: "ED001", current_approver_name: "Vikram V", stage_no: 1, total_stages: 2 }),
  row({ record_id: 4, company_name: null, status: "R", supp_code: null, gst_no: null }),
];

describe("countByStatus / filterSuppliers", () => {
  it("counts each status", () => {
    expect(countByStatus(ROWS)).toEqual({ all: 4, A: 2, P: 1, R: 1 });
  });

  it("filters by status", () => {
    expect(filterSuppliers(ROWS, "P", "").map((r) => r.record_id)).toEqual([3]);
    expect(filterSuppliers(ROWS, "A", "").map((r) => r.record_id)).toEqual([1, 2]);
  });

  it("searches name, code, GST and the approver a pending one is with", () => {
    expect(filterSuppliers(ROWS, "all", "amazon").map((r) => r.record_id)).toEqual([2]);
    expect(filterSuppliers(ROWS, "all", "SVK-2026").map((r) => r.record_id)).toEqual([2]);
    expect(filterSuppliers(ROWS, "all", "27adbfs").map((r) => r.record_id)).toEqual([1]);
    expect(filterSuppliers(ROWS, "all", "vikram").map((r) => r.record_id)).toEqual([3]);
  });

  it("combines status, category and search", () => {
    expect(filterSuppliers(ROWS, "A", "", "Service Vendor").map((r) => r.record_id)).toEqual([2]);
    expect(filterSuppliers(ROWS, "P", "", "Service Vendor")).toEqual([]);
  });
});

describe("displayName / pendingLine", () => {
  it("names a blank incomplete KYC by its number", () => {
    expect(displayName(ROWS[3])).toBe("Unnamed KYC #4");
    expect(displayName({ company_name: "", record_id: 9, source: "SERVICE_KYC" })).toBe("Unnamed service vendor request #9");
  });

  it("says who a pending supplier is with and which stage", () => {
    expect(pendingLine(ROWS[2])).toBe("With Vikram V · stage 1 of 2");
  });

  it("falls back to the code, and returns null when not pending", () => {
    expect(pendingLine(row({ status: "P", current_approver_id: "ED001", current_approver_name: null, stage_no: null, total_stages: null }))).toBe("With ED001");
    expect(pendingLine(row({ status: "P", current_approver_id: null }))).toBe("Waiting for an approver");
    expect(pendingLine(ROWS[0])).toBeNull();
  });
});

describe("buildSupplierTrail", () => {
  const stages = [
    { stage_no: 1, stage_name: "KYC Approval", approver_ecno: "KTM1148", approver_name: "JAYAPRAKASH. K" },
    { stage_no: 2, stage_name: "Finance Approval", approver_ecno: "KTM1004", approver_name: "M.SARAVANAKUMAR" },
    { stage_no: 3, stage_name: "Director", approver_ecno: "KTM1006", approver_name: "V.NATARAJAN" },
  ];

  it("approved: submitted, then who approved and when — matches history, not today's chain", () => {
    // The chain now says ED001, but the supplier was approved by SNV11097 back then.
    const t: SupplierTimelineData = {
      header: { status: "A", created_by: "KTM1148", created_by_name: "JAYAPRAKASH. K", created_date: "2026-07-31T13:57:08Z" },
      stages: [{ stage_no: 1, stage_name: "STORE INCHARGE", approver_ecno: "ED001", approver_name: "Vikram V" }],
      history: [{ event: "APPROVED", status_by: "SNV11097", status_by_name: "KEERTHIKA G", event_date: "2026-07-31T00:00:00Z", comment: null }],
    };
    const steps = buildSupplierTrail(t);
    expect(steps.map((s) => [s.label, s.person, s.state])).toEqual([
      ["KYC submitted", "JAYAPRAKASH. K", "approved"],
      ["Approval", "KEERTHIKA G", "approved"],
    ]);
    expect(steps[0].word).toBe("Submitted");
  });

  it("pending: shows the approver it is with, then the stages still to come", () => {
    const t: SupplierTimelineData = {
      header: { status: "P", created_by: "KTM1148", created_by_name: "JAYAPRAKASH. K", current_approver_id: "KTM1004", current_approver_name: "M.SARAVANAKUMAR" },
      stages,
      history: [
        { event: "SUBMITTED", status_by: "KTM1148", status_by_name: "JAYAPRAKASH. K", event_date: "2026-09-01T00:00:00Z", comment: null },
        { event: "APPROVED", status_by: "KTM1148", status_by_name: "JAYAPRAKASH. K", event_date: "2026-09-02T00:00:00Z", comment: "docs verified" },
      ],
    };
    const steps = buildSupplierTrail(t);
    expect(steps.map((s) => `${s.label}:${s.state}`)).toEqual([
      "KYC submitted:approved",
      "KYC Approval:approved",
      "Finance Approval:pending",
      "Director:upcoming",
    ]);
    expect(steps[1].comment).toBe("docs verified");
    expect(steps[2].person).toBe("M.SARAVANAKUMAR");
  });

  it("rejected: the rejection carries the reason when one was recorded", () => {
    const t: SupplierTimelineData = {
      header: { status: "R", created_by: "KTM1148" },
      stages: [],
      history: [{ event: "REJECTED", status_by: "KTM1004", status_by_name: "M.SARAVANAKUMAR", event_date: "2026-09-02T00:00:00Z", comment: "GST mismatch" }],
    };
    const last = buildSupplierTrail(t).pop()!;
    expect(last).toMatchObject({ state: "rejected", person: "M.SARAVANAKUMAR", comment: "GST mismatch" });
  });

  it("still shows the outcome when history has no row for the decision (older data)", () => {
    const rejected = buildSupplierTrail({ header: { status: "R", created_by_name: "JAYAPRAKASH. K" }, stages: [], history: [] });
    expect(rejected.map((x) => [x.label, x.person, x.state])).toEqual([
      ["KYC submitted", "JAYAPRAKASH. K", "approved"],
      ["Approval", "Not recorded", "rejected"],
    ]);

    const approved = buildSupplierTrail({
      header: { status: "A", created_by_name: "JAYAPRAKASH. K", last_action_by: "KTM1004", last_action_by_name: "M.SARAVANAKUMAR", last_action_date: "2026-09-02T00:00:00Z" },
      stages: [], history: [],
    });
    expect(approved[1]).toMatchObject({ person: "M.SARAVANAKUMAR", state: "approved" });
  });

  it("uses the recorded SUBMITTED event when there is one, and never invents a pending step for an approved supplier", () => {
    const t: SupplierTimelineData = {
      header: { status: "A" },
      stages,
      history: [
        { event: "SUBMITTED", status_by: "KTM1148", status_by_name: "JAYAPRAKASH. K", event_date: "2026-09-23T14:46:46Z", comment: null },
        { event: "APPROVED", status_by: "KTM1148", status_by_name: "JAYAPRAKASH. K", event_date: "2026-09-23T14:46:47Z", comment: "Approved via seed script" },
      ],
    };
    const steps = buildSupplierTrail(t);
    expect(steps).toHaveLength(2);
    expect(steps.some((s) => s.state === "pending" || s.state === "upcoming")).toBe(false);
    expect(steps[1].label).toBe("KYC Approval"); // matched to the chain because the approver still is on it
  });
});
