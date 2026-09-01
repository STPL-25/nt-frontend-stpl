import React from "react";
import {
  FileText, ClipboardList, ShoppingCart, Send, Truck, Warehouse, PackageCheck, Boxes,
  Check, Clock, X, Circle,
} from "lucide-react";
import { StatusBadge } from "@/utils/statusUtils";
import { cn } from "@/lib/utils";

// Shape returned by GET /api/pr_tracking/getTimeline/:pr_no — see
// backend-stpl/src/PRTracking/services/PRTracking.service.js#getPRTrackingTimeline,
// which names the 13 result sets from sql/29_pr_tracking.sql +
// sql/30_pr_tracking_approval_names.sql's sp_nt_GetPRTrackingTimeline, in
// this exact order.
export interface PRTrackingTimelineData {
  prHeader: any[];
  quotations: any[];
  quotationHistory: any[];
  purchaseOrders: any[];
  poHistory: any[];
  dispatchSlips: any[];
  dispatchDeliveries: any[];
  gateEntries: any[];
  grns: any[];
  grnHistory: any[];
  inventoryMovements: any[];
  /** Full multi-stage approval chain (stage_no, approver_ecno, approver_name, ...), in order. */
  approvalStages: any[];
  /** Full ordered pr_history_data audit trail, one row per stage actually acted on. */
  approvalHistory: any[];
}

function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface StageProps {
  icon: React.ElementType;
  title: string;
  reached: boolean;
  isLast?: boolean;
  children?: React.ReactNode;
}

function Stage({ icon: Icon, title, reached, isLast, children }: StageProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
            reached
              ? "bg-primary/10 border-primary text-primary"
              : "bg-muted border-border text-muted-foreground/40"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && (
          <div className={cn("w-px flex-1 my-1", reached ? "bg-primary/40" : "bg-border")} />
        )}
      </div>
      <div className={cn("pb-6 flex-1 min-w-0", !reached && "opacity-40")}>
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-1 space-y-1.5">{children}</div>
      </div>
    </div>
  );
}

type ApprovalState = "approved" | "pending" | "rejected" | "not_reached";

const APPROVAL_STATE_STYLE: Record<ApprovalState, { ring: string; icon: React.ElementType; iconCls: string }> = {
  approved:    { ring: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30", icon: Check, iconCls: "text-emerald-600 dark:text-emerald-400" },
  pending:     { ring: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 ring-2 ring-amber-300/60", icon: Clock, iconCls: "text-amber-600 dark:text-amber-400" },
  rejected:    { ring: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30", icon: X, iconCls: "text-red-600 dark:text-red-400" },
  not_reached: { ring: "border-border bg-muted/40", icon: Circle, iconCls: "text-muted-foreground/40" },
};

/**
 * The full multi-stage approval chain as a chip sequence — "Stage 1: Name
 * (Approved) -> Stage 2: Name (Pending)" — so the requester can see not just
 * "Pending" but WHO it's pending with and what comes next.
 */
function ApprovalChain({ stages, history, prStatus }: { stages: any[]; history: any[]; prStatus?: string }) {
  if (!stages.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-3">
      {stages.map((stage, idx) => {
        const entry = history[idx];
        let state: ApprovalState;
        if (entry) state = entry.status === "A" ? "approved" : entry.status === "R" ? "rejected" : "not_reached";
        else if (idx === history.length && prStatus === "P") state = "pending";
        else state = "not_reached";

        const { ring, icon: Icon, iconCls } = APPROVAL_STATE_STYLE[state];

        return (
          <React.Fragment key={stage.stage_no ?? idx}>
            {idx > 0 && <div className="h-px w-4 bg-border shrink-0" />}
            <div className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", ring)}>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", iconCls)} />
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight truncate">
                  {stage.approver_name || stage.approver_ecno}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  Stage {stage.stage_no}{stage.stage_name ? ` · ${stage.stage_name}` : ""}
                  {entry?.status_date ? ` · ${fmtDate(entry.status_date)}` : ""}
                </p>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface DeliveryLane {
  label: string;
  vendorSno?: number | string;
  quotations: any[];
  quotationHistory: any[];
  purchaseOrders: any[];
  poHistory: any[];
  dispatchSlips: any[];
  dispatchDeliveries: any[];
  gateEntries: any[];
  grns: any[];
  grnHistory: any[];
  inventoryMovements: any[];
}

/**
 * A PR can be split (by the Purchase Team, across vendors) AFTER approval —
 * supplier_quotation_info.pr_no / po_request_info.split_pr_no then carry a
 * suffixed pr_no ('PR26270008/1', '/2', ...) instead of the base one.
 * Everything downstream of a PO (dispatch/gate-entry/GRN/inventory) only
 * carries po_basic_sno, so it's bucketed into the same lane as its owning PO.
 * Returns one lane per distinct split label — a single-element result for an
 * unsplit PR, so callers don't need a separate code path for that case.
 */
function buildDeliveryLanes(data: PRTrackingTimelineData): DeliveryLane[] {
  const labels = new Set<string>();
  (data.quotations ?? []).forEach((q) => q.pr_no && labels.add(q.pr_no));
  (data.purchaseOrders ?? []).forEach((po) => po.split_pr_no && labels.add(po.split_pr_no));
  if (labels.size === 0) {
    return [{
      label: data.prHeader?.[0]?.pr_no ?? "",
      quotations: [], quotationHistory: [], purchaseOrders: [], poHistory: [],
      dispatchSlips: [], dispatchDeliveries: [], gateEntries: [], grns: [],
      grnHistory: [], inventoryMovements: [],
    }];
  }

  const poToLabel = new Map<number, string>();
  (data.purchaseOrders ?? []).forEach((po) => poToLabel.set(po.po_basic_sno, po.split_pr_no));

  const dispatchSlipToLabel = new Map<number, string>();
  (data.dispatchSlips ?? []).forEach((d) => {
    const label = poToLabel.get(d.po_basic_sno);
    if (label) dispatchSlipToLabel.set(d.dispatch_slip_sno, label);
  });

  // Same GRN-reference format sp_nt_UpsertInventoryItemByProduct's caller uses
  // ('GRN-2026-000019') — matches sql/29_pr_tracking.sql RS11's own join.
  const grnRefToLabel = new Map<string, string>();
  (data.grns ?? []).forEach((g) => {
    const label = poToLabel.get(g.po_basic_sno);
    if (label && g.grn_no != null && g.created_date) {
      const year = new Date(g.created_date).getFullYear();
      grnRefToLabel.set(`GRN-${year}-${String(g.grn_no).padStart(6, "0")}`, label);
    }
  });

  return Array.from(labels).sort().map((label) => {
    const lanePOs = (data.purchaseOrders ?? []).filter((po) => po.split_pr_no === label);
    return {
      label,
      vendorSno: lanePOs[0]?.vendor_sno ?? (data.quotations ?? []).find((q) => q.pr_no === label)?.vendor_sno,
      quotations: (data.quotations ?? []).filter((q) => q.pr_no === label),
      quotationHistory: (data.quotationHistory ?? []).filter((h) => h.pr_no === label),
      purchaseOrders: lanePOs,
      poHistory: (data.poHistory ?? []).filter((h) => poToLabel.get(h.po_basic_sno) === label),
      dispatchSlips: (data.dispatchSlips ?? []).filter((d) => poToLabel.get(d.po_basic_sno) === label),
      dispatchDeliveries: (data.dispatchDeliveries ?? []).filter(
        (d) => dispatchSlipToLabel.get(d.dispatch_slip_sno) === label
      ),
      gateEntries: (data.gateEntries ?? []).filter((g) => poToLabel.get(g.po_basic_sno) === label),
      grns: (data.grns ?? []).filter((g) => poToLabel.get(g.po_basic_sno) === label),
      grnHistory: (data.grnHistory ?? []).filter((h) => poToLabel.get(h.po_basic_sno) === label),
      inventoryMovements: (data.inventoryMovements ?? []).filter(
        (m) => grnRefToLabel.get(m.reference_no) === label
      ),
    };
  });
}

/** Quotation -> PO -> Dispatch -> Gate Entry -> GRN -> Inventory for one delivery lane. */
function DeliveryLaneStages({ lane, isLastLane }: { lane: DeliveryLane; isLastLane: boolean }) {
  const hasQuotation = lane.quotations.length > 0;
  const hasPO = lane.purchaseOrders.length > 0;
  const poSent = lane.poHistory.some((h: any) => h.action_type === "SENT_TO_SUPPLIER");
  const hasDispatch = lane.dispatchSlips.length > 0;
  const hasGateEntry = lane.gateEntries.length > 0;
  const hasGRN = lane.grns.length > 0;
  const hasInventory = lane.inventoryMovements.length > 0;

  return (
    <>
      <Stage icon={ShoppingCart} title="Purchase Quotation" reached={hasQuotation}>
        {lane.quotations.map((q: any) => (
          <div key={q.sq_basic_sno} className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={q.status} />
            <span className="text-muted-foreground">
              {q.quotation_ref_no || `Quotation #${q.sq_basic_sno}`}
            </span>
          </div>
        ))}
        {lane.quotationHistory.map((h: any, i: number) => (
          <p key={i} className="text-xs text-muted-foreground">
            {h.action_type} by {h.status_by} · {fmtDate(h.status_date)}
            {h.comment ? ` — "${h.comment}"` : ""}
          </p>
        ))}
      </Stage>

      <Stage icon={Send} title="PO Approval & Sent to Supplier" reached={hasPO}>
        {lane.purchaseOrders.map((po: any) => (
          <div key={po.po_basic_sno} className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={po.status} />
            {po.supplier_ack_status && (
              <span className="text-muted-foreground">Supplier: {po.supplier_ack_status}</span>
            )}
            {po.po_pdf_url && (
              <a href={po.po_pdf_url} target="_blank" rel="noreferrer" className="text-primary underline">
                PO PDF
              </a>
            )}
          </div>
        ))}
        {poSent && <p className="text-xs text-muted-foreground">Emailed to supplier</p>}
        {lane.poHistory.map((h: any, i: number) => (
          <p key={i} className="text-xs text-muted-foreground">
            {h.action_type} by {h.status_by}
            {h.comment ? ` — "${h.comment}"` : ""}
          </p>
        ))}
      </Stage>

      <Stage icon={Truck} title="Supplier Dispatch" reached={hasDispatch}>
        {lane.dispatchSlips.map((d: any) => (
          <p key={d.dispatch_slip_sno} className="text-xs text-muted-foreground">
            {d.dispatch_slip_no} · {d.dispatch_mode} via {d.transport_name || "—"} ·{" "}
            <StatusBadge status={d.status} />
          </p>
        ))}
        {lane.dispatchDeliveries.map((d: any) => (
          <p key={d.delivery_sno} className="text-xs text-muted-foreground">
            LR: {d.lr_no || "—"} · Invoice {d.invoice_no} · Qty {d.qty ?? "—"}
          </p>
        ))}
      </Stage>

      <Stage icon={Warehouse} title="Gate Entry" reached={hasGateEntry}>
        {lane.gateEntries.map((g: any) => (
          <p key={g.gate_entry_sno} className="text-xs text-muted-foreground">
            {g.gate_entry_no} · <StatusBadge status={g.status} /> · LR {g.lr_no || "—"} ·{" "}
            {fmtDate(g.created_at)}
          </p>
        ))}
      </Stage>

      <Stage icon={PackageCheck} title="GRN" reached={hasGRN}>
        {lane.grns.map((g: any) => (
          <p key={g.grn_basic_sno} className="text-xs text-muted-foreground">
            <StatusBadge status={g.status} /> · {fmtDate(g.received_date)}
          </p>
        ))}
        {lane.grnHistory.map((h: any, i: number) => (
          <p key={i} className="text-xs text-muted-foreground">
            {h.event_type} · {fmtDate(h.status_at)}
          </p>
        ))}
      </Stage>

      <Stage icon={Boxes} title="Received Stock (Inventory Updated)" reached={hasInventory} isLast={isLastLane}>
        {lane.inventoryMovements.map((m: any) => (
          <p key={m.movement_sno} className="text-xs text-muted-foreground">
            {m.item_name} · +{m.quantity} {m.uom || ""} · balance {m.balance_after} ·{" "}
            {fmtDate(m.created_at)}
          </p>
        ))}
      </Stage>
    </>
  );
}

export default function PRTimelineStepper({ data }: { data: PRTrackingTimelineData }) {
  const header = data.prHeader?.[0];
  const approvalStages = data.approvalStages ?? [];
  const approvalHistory = data.approvalHistory ?? [];
  const lanes = buildDeliveryLanes(data);
  const isSplit = lanes.length > 1;

  return (
    <div className="py-2">
      <Stage icon={FileText} title="PR Submitted" reached={!!header}>
        {header && (
          <p className="text-xs text-muted-foreground">
            {header.pr_no} · by {header.created_by_name || header.created_by} ·{" "}
            {fmtDate(header.created_date)}
          </p>
        )}
      </Stage>

      <Stage icon={ClipboardList} title="PR Approval" reached={!!header}>
        {header && (
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={header.status} />
            {header.status === "P" && approvalStages[approvalHistory.length] && (
              <span className="text-xs text-muted-foreground">
                Pending with {approvalStages[approvalHistory.length].approver_name
                  || approvalStages[approvalHistory.length].approver_ecno}
              </span>
            )}
          </div>
        )}
        <ApprovalChain stages={approvalStages} history={approvalHistory} prStatus={header?.status} />
        {approvalHistory
          .filter((h: any) => h.commends)
          .map((h: any, i: number) => (
            <p key={i} className="text-xs text-muted-foreground mt-1">
              {h.status_by_name || h.status_by}: "{h.commends}"
            </p>
          ))}
      </Stage>

      {isSplit ? (
        <div className="pl-12 -mt-2 mb-2">
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Split into {lanes.length} deliveries — each vendor's quotation, PO, dispatch, gate
            entry and GRN are tracked separately below.
          </div>
        </div>
      ) : null}

      {lanes.map((lane, i) =>
        isSplit ? (
          <div key={lane.label} className="pl-12 mb-2">
            <p className="text-xs font-semibold text-primary mb-2">
              Delivery {i + 1} — {lane.label}
            </p>
            <div className="pl-0 -ml-12">
              <DeliveryLaneStages lane={lane} isLastLane={i === lanes.length - 1} />
            </div>
          </div>
        ) : (
          <DeliveryLaneStages key={lane.label} lane={lane} isLastLane />
        )
      )}
    </div>
  );
}
