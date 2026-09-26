import type { ApprovalStep } from "@/components/ApprovalTrail";
import { formatDate } from "@/lib/formatDate";

// Row shape of GET /api/kyc/supplier_status — see backend-stpl/sql/97_supplier_status_tracking.sql.
export interface SupplierStatusRow {
  /** "KYC" = kyc_basic_info, "SERVICE_KYC" = a Service Vendor KYC request not yet provisioned. */
  source: "KYC" | "SERVICE_KYC";
  record_id: number;
  company_name: string | null;
  supp_code: string | null;
  /** A = approved, P = approval pending, R = rejected. */
  status: string | null;
  category: string;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  gst_no: string | null;
  pan_no: string | null;
  business_type_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_date: string | null;
  current_approver_id: string | null;
  current_approver_name: string | null;
  stage_no: number | null;
  total_stages: number | null;
  last_action_by: string | null;
  last_action_by_name: string | null;
  last_action_date: string | null;
}

export interface SupplierTimelineData {
  header: Partial<SupplierStatusRow> & { legal_name?: string | null; trade_name?: string | null; msme_no?: string | null };
  /** The configured approval chain today (may differ from who actually approved, if it was edited since). */
  stages: { stage_no: number; stage_name: string | null; approver_ecno: string | null; approver_name: string | null }[];
  /** What actually happened, oldest first. */
  history: { event: string; status_by: string | null; status_by_name: string | null; event_date: string | null; comment: string | null }[];
}

export type StatusFilter = "all" | "A" | "P" | "R";

export const STATUS_WORD: Record<string, string> = { A: "Approved", P: "Approval Pending", R: "Rejected" };

export const displayName = (row: Pick<SupplierStatusRow, "company_name" | "record_id" | "source">): string =>
  row.company_name?.trim() || `Unnamed ${row.source === "SERVICE_KYC" ? "service vendor request" : "KYC"} #${row.record_id}`;

const person = (name?: string | null, code?: string | null) => (name && name.trim()) || code || null;

export function countByStatus(rows: SupplierStatusRow[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: rows.length, A: 0, P: 0, R: 0 };
  for (const r of rows) if (r.status === "A" || r.status === "P" || r.status === "R") counts[r.status] += 1;
  return counts;
}

export function filterSuppliers(
  rows: SupplierStatusRow[],
  filter: StatusFilter,
  search: string,
  category: string = "all"
): SupplierStatusRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (category !== "all" && r.category !== category) return false;
    if (!q) return true;
    return [
      r.company_name, r.supp_code, r.gst_no, r.pan_no, r.contact_person, r.email, r.mobile_number,
      r.current_approver_name, r.created_by_name, r.business_type_name,
    ].some((v) => v && String(v).toLowerCase().includes(q));
  });
}

/** "Pending with KEERTHIKA G · stage 1 of 2" — null unless the supplier is awaiting approval. */
export function pendingLine(row: SupplierStatusRow): string | null {
  if (row.status !== "P") return null;
  const who = person(row.current_approver_name, row.current_approver_id);
  const stage = row.stage_no && row.total_stages ? ` · stage ${row.stage_no} of ${row.total_stages}` : "";
  return who ? `With ${who}${stage}` : "Waiting for an approver";
}

const prettify = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

/**
 * The supplier's approval trail. Built from what actually HAPPENED (history), not from the
 * configured chain — the chain can be edited after a supplier was approved (e.g. KYC approver
 * changed from one person to another), so matching history to today's chain would mislabel it.
 * The chain is used only for what is still ahead: the current approver's stage name and the
 * stages after it while the supplier is pending.
 */
export function buildSupplierTrail(t: SupplierTimelineData): ApprovalStep[] {
  const { header, stages, history } = t;
  const steps: ApprovalStep[] = [];
  const stageNameFor = (code?: string | null) => stages.find((s) => s.approver_ecno === code)?.stage_name || null;

  const submitted = history.find((h) => h.event === "SUBMITTED");
  steps.push({
    key: "submitted",
    label: "KYC submitted",
    person: person(submitted?.status_by_name ?? header.created_by_name, submitted?.status_by ?? header.created_by),
    state: "approved",
    word: "Submitted",
    at: formatDate(submitted?.event_date ?? header.created_date),
    comment: submitted?.comment ?? null,
  });

  history
    .filter((h) => h.event !== "SUBMITTED")
    .forEach((h, i) => {
      const rejected = h.event === "REJECTED";
      const known = h.event === "APPROVED" || rejected;
      steps.push({
        key: `event-${i}`,
        label: stageNameFor(h.status_by) ?? (known ? "Approval" : prettify(h.event)),
        person: person(h.status_by_name, h.status_by),
        state: rejected ? "rejected" : "approved",
        word: known ? undefined : prettify(h.event),
        at: formatDate(h.event_date),
        comment: h.comment,
      });
    });

  // The final decision was made but history has no row for it (older data): still show the outcome,
  // naming whoever last touched the record if that is known.
  const decided = (event: string) => history.some((h) => h.event === event);
  if ((header.status === "R" && !decided("REJECTED")) || (header.status === "A" && !decided("APPROVED"))) {
    steps.push({
      key: "outcome",
      label: "Approval",
      person: person(header.last_action_by_name, header.last_action_by) ?? "Not recorded",
      state: header.status === "R" ? "rejected" : "approved",
      at: formatDate(header.last_action_date),
    });
  }

  if (header.status === "P") {
    const currentIdx = stages.findIndex((s) => s.approver_ecno === header.current_approver_id);
    steps.push({
      key: "pending",
      label: (currentIdx >= 0 && stages[currentIdx].stage_name) || "Approval",
      person: person(header.current_approver_name, header.current_approver_id) ?? "Approver not assigned",
      state: "pending",
    });
    if (currentIdx >= 0) {
      stages.slice(currentIdx + 1).forEach((s) =>
        steps.push({
          key: `upcoming-${s.stage_no}`,
          label: s.stage_name || `Stage ${s.stage_no}`,
          person: person(s.approver_name, s.approver_ecno),
          state: "upcoming",
        })
      );
    }
  }

  return steps;
}
