import React from "react";
import {
  FileText, ClipboardList, ShoppingCart, Send, Truck, Warehouse, PackageCheck, Boxes,
  Check, X, MapPin, PartyPopper, Hourglass, Ban,
} from "lucide-react";
import { StatusBadge } from "@/utils/statusUtils";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import ApprovalTrail from "@/components/ApprovalTrail";
import {
  buildDeliveryLanes, buildPrApprovalSteps, buildPoApproval, buildSummary, describeLane, nameOf,
  type PRTrackingTimelineData, type DeliveryLane, type MilestoneKey, type Milestone, type TrackingSummary,
} from "./prTrackingModel";

export type { PRTrackingTimelineData } from "./prTrackingModel";

// ── Milestone bar ─────────────────────────────────────────────────────────────

function MilestoneBar({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="grid grid-cols-7" aria-label="Progress">
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1;
        const done = m.state === "done";
        return (
          <li key={m.key} className="relative flex flex-col items-center gap-1.5 text-center" data-state={m.state}>
            {!isLast && (
              <span
                className={cn(
                  "absolute left-1/2 top-3 h-0.5 w-full -translate-y-1/2",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                m.state === "done" && "border-primary bg-primary text-primary-foreground",
                m.state === "current" && "border-amber-500 bg-background text-amber-600 ring-4 ring-amber-200/70 dark:ring-amber-500/20",
                m.state === "rejected" && "border-red-500 bg-red-500 text-white",
                m.state === "upcoming" && "border-border bg-background text-muted-foreground/50"
              )}
            >
              {m.state === "done" ? <Check className="h-3 w-3" strokeWidth={3} />
                : m.state === "rejected" ? <X className="h-3 w-3" strokeWidth={3} />
                : m.state === "current" ? <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                : i + 1}
            </span>
            <span
              className={cn(
                "px-0.5 text-[10px] leading-tight",
                m.state === "upcoming" ? "text-muted-foreground/70" : "font-semibold text-foreground",
                m.state === "current" && "text-amber-700 dark:text-amber-400"
              )}
            >
              {m.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const TONE_STYLE: Record<TrackingSummary["tone"], { box: string; icon: React.ElementType }> = {
  progress: { box: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200", icon: Hourglass },
  done:     { box: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200", icon: PartyPopper },
  rejected: { box: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200", icon: Ban },
};

function SummaryCard({ data, summary }: { data: PRTrackingTimelineData; summary: TrackingSummary }) {
  const header = data.prHeader?.[0];
  const core = data.prCore?.[0];
  const status = core?.status ?? header?.status;
  const tone = TONE_STYLE[summary.tone];
  const ToneIcon = tone.icon;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{header?.pr_no ?? core?.pr_no}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Raised by {nameOf(header?.created_by_name ?? core?.created_by_name, header?.created_by ?? core?.created_by) ?? "—"}
            {formatDate(header?.created_date ?? core?.created_date) ? ` · ${formatDate(header?.created_date ?? core?.created_date)}` : ""}
          </p>
          {header?.purpose && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{header.purpose}</p>}
        </div>
        <StatusBadge status={status} />
      </div>

      <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", tone.box)} data-testid="pr-headline">
        <ToneIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
            Where it is now{summary.tone === "progress" ? ` · step ${summary.step} of ${summary.milestones.length}` : ""}
          </p>
          <p className="text-sm font-semibold leading-snug">{summary.headline}</p>
        </div>
      </div>

      <MilestoneBar milestones={summary.milestones} />
    </div>
  );
}

// ── Vertical timeline ────────────────────────────────────────────────────────

type StageState = "done" | "current" | "upcoming";

interface StageProps {
  icon: React.ElementType;
  title: string;
  state: StageState;
  isLast?: boolean;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}

function Stage({ icon: Icon, title, state, isLast, aside, children }: StageProps) {
  return (
    <div className="flex gap-3" data-stage-state={state}>
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
            state === "done" && "border-primary bg-primary/10 text-primary",
            state === "current" && "border-amber-500 bg-amber-50 text-amber-600 ring-4 ring-amber-200/60 dark:bg-amber-950/30 dark:ring-amber-500/20",
            state === "upcoming" && "border-border bg-muted text-muted-foreground/40"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && <div className={cn("my-1 w-px flex-1", state === "done" ? "bg-primary/40" : "bg-border")} />}
      </div>
      <div className={cn("min-w-0 flex-1 pb-6", state === "upcoming" && "opacity-50")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{title}</p>
          {aside}
        </div>
        <div className="mt-1.5 space-y-1.5">{children}</div>
      </div>
    </div>
  );
}

/** Free-text status from tables whose statuses are not single-letter codes ("GRN Done", "In", …). */
function Pill({ text, tone = "neutral" }: { text: string; tone?: "good" | "info" | "neutral" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
        tone === "info" && "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        tone === "neutral" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

const line = "text-xs text-muted-foreground";

const PO_EVENT_LABEL: Record<string, string> = {
  SENT_TO_SUPPLIER: "Emailed to supplier",
  SUPPLIER_ACK: "Supplier acknowledged",
  AUTO_ISSUED: "PO auto-issued",
  APPROVED_ISSUED: "Issued after approval",
  APPROVED: "Approved",
};
const prettify = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "");

/** Quotation -> PO approval -> PO -> Dispatch -> Gate Entry -> GRN -> Inventory for one delivery lane. */
function DeliveryLaneStages({
  lane, data, prApproved, isLastLane,
}: { lane: DeliveryLane; data: PRTrackingTimelineData; prApproved: boolean; isLastLane: boolean }) {
  const po = buildPoApproval(lane, data.quotationStages ?? []);
  const progress = describeLane(lane, po);
  const order: MilestoneKey[] = ["poApproval", "poRaised", "gateEntry", "grn", "stock"];
  const reached = (key: MilestoneKey): StageState => {
    if (!prApproved) return "upcoming";
    if (progress.complete) return "done";
    const cur = order.indexOf(progress.key);
    const idx = order.indexOf(key);
    return idx < cur ? "done" : idx === cur ? "current" : "upcoming";
  };

  const hasQuotation = lane.quotations.length > 0;
  const hasPO = lane.purchaseOrders.length > 0;
  const poSent = lane.poHistory.some((h) => h.action_type === "SENT_TO_SUPPLIER");
  const hasDispatch = lane.dispatchSlips.length > 0;
  const hasGateEntry = lane.gateEntries.length > 0;
  const hasGRN = lane.grns.length > 0;
  const hasInventory = lane.inventoryMovements.length > 0;
  const selectedQuotation = lane.quotations.find((q) => q.is_selected === "1" || q.is_selected === 1) ?? lane.quotations[0];

  return (
    <>
      <Stage icon={ShoppingCart} title="PO Approval" state={reached("poApproval")}>
        {!hasQuotation && (
          <p className={line}>
            {prApproved
              ? "Waiting for the Purchase team to collect supplier quotations."
              : "Starts once the PR is approved."}
          </p>
        )}
        {lane.quotations.map((q) => (
          <div key={q.sq_basic_sno} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">{q.vendor_name || `Supplier #${q.vendor_sno}`}</span>
            <span className="text-muted-foreground">{q.quotation_ref_no || `Quotation #${q.sq_basic_sno}`}</span>
            {q === selectedQuotation && lane.quotations.length > 1 && <Pill text="Selected" tone="info" />}
          </div>
        ))}
        {po.selectedBy && (
          <p className={line}>
            Quotation selected by {po.selectedBy.name ?? "Purchase team"}
            {po.selectedBy.comment && po.selectedBy.comment !== "Supplier quotation selected" ? ` — "${po.selectedBy.comment}"` : ""}
          </p>
        )}
        {po.steps.length > 0 ? (
          <div className="pt-1"><ApprovalTrail steps={po.steps} /></div>
        ) : (
          hasQuotation && !hasPO && <p className={line}>Approval chain will be assigned once the quotation is selected.</p>
        )}
      </Stage>

      <Stage icon={Send} title="PO Raised" state={reached("poRaised")}>
        {!hasPO && <p className={line}>The PO is raised automatically when the last approver signs off.</p>}
        {lane.purchaseOrders.map((p) => (
          <div key={p.po_basic_sno} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-sm font-semibold">{p.po_df_no || `PO #${p.po_basic_sno}`}</span>
              <StatusBadge status={p.status} />
              {p.supplier_ack_status && <Pill text={`Supplier: ${p.supplier_ack_status}`} tone="good" />}
            </div>
            <p className={line}>
              {[p.vendor_name, formatDate(p.po_date)].filter(Boolean).join(" · ")}
              {p.po_pdf_url && (
                <>
                  {" · "}
                  <a href={p.po_pdf_url} target="_blank" rel="noreferrer" className="text-primary underline">PO PDF</a>
                </>
              )}
            </p>
          </div>
        ))}
        {poSent && <p className={line}>Emailed to supplier</p>}
        {lane.poHistory
          .filter((h) => h.action_type !== "SENT_TO_SUPPLIER")
          .map((h, i: number) => (
            <p key={i} className={line}>
              {PO_EVENT_LABEL[h.action_type] ?? prettify(h.action_type)}
              {nameOf(h.status_by_name, h.status_by) ? ` by ${nameOf(h.status_by_name, h.status_by)}` : ""}
              {h.comment ? ` — "${h.comment}"` : ""}
            </p>
          ))}
      </Stage>

      <Stage icon={Truck} title="Supplier Dispatch" state={hasDispatch ? "done" : "upcoming"}>
        {lane.dispatchSlips.map((d) => (
          <p key={d.dispatch_slip_sno} className={line}>
            {d.dispatch_slip_no} · {d.dispatch_mode} via {d.transport_name || "—"} · <Pill text={d.status} tone="info" />
          </p>
        ))}
        {lane.dispatchDeliveries.map((d) => (
          <p key={d.delivery_sno} className={line}>
            LR: {d.lr_no || "—"} · Invoice {d.invoice_no} · Qty {d.qty ?? "—"}
          </p>
        ))}
        {!hasDispatch && (
          <p className={line}>
            {hasGateEntry || hasGRN
              ? "No supplier dispatch was recorded for this delivery."
              : "The supplier's dispatch details appear here when they send the goods."}
          </p>
        )}
      </Stage>

      <Stage icon={Warehouse} title="Gate Entry" state={reached("gateEntry")}>
        {!hasGateEntry && <p className={line}>Recorded by the security desk when the goods arrive.</p>}
        {lane.gateEntries.map((g) => (
          <div key={g.gate_entry_sno} className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-sm font-semibold">{g.gate_entry_no}</span>
              <Pill text={g.status} tone={g.status === "GRN Done" ? "good" : "info"} />
            </div>
            <p className={line}>
              Received by {nameOf(g.receiver_name, g.receiver_ecno) ?? "—"} · {formatDateTime(g.created_at)}
            </p>
            <p className={line}>
              {[
                g.received_qty != null ? `Qty ${g.received_qty}` : null,
                g.bundles ? `${g.bundles} bundle${g.bundles === 1 ? "" : "s"}` : null,
                g.invoice_no ? `Invoice ${g.invoice_no}` : null,
                g.transport_name || null,
                g.lr_no ? `LR ${g.lr_no}` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        ))}
      </Stage>

      <Stage icon={PackageCheck} title="GRN" state={reached("grn")}>
        {!hasGRN && <p className={line}>Goods Receipt Note is posted after the goods are checked in.</p>}
        {lane.grns.map((g) => (
          <div key={g.grn_basic_sno} className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-sm font-semibold">{g.grn_ref || `GRN #${g.grn_no ?? g.grn_basic_sno}`}</span>
              <StatusBadge status={g.status} />
            </div>
            <p className={line}>
              Posted by {nameOf(g.created_by_name, g.created_by) ?? "—"} · received {formatDate(g.received_date)}
              {g.remarks ? ` — "${g.remarks}"` : ""}
            </p>
          </div>
        ))}
        {lane.grnHistory.map((h, i: number) => (
          <p key={i} className={line}>
            {h.event_type}
            {nameOf(h.status_by_name, h.status_by) ? ` · ${nameOf(h.status_by_name, h.status_by)}` : ""} · {formatDateTime(h.status_at)}
          </p>
        ))}
      </Stage>

      <Stage icon={Boxes} title="Received Stock (Inventory Updated)" state={hasInventory ? "done" : reached("stock")} isLast={isLastLane}>
        {!hasInventory && <p className={line}>Stock is added to inventory when the GRN is received.</p>}
        {lane.inventoryMovements.map((m) => (
          <p key={m.movement_sno} className={line}>
            {m.item_name} · +{m.quantity} {m.uom || ""} · balance {m.balance_after} · {formatDateTime(m.created_at)}
          </p>
        ))}
      </Stage>
    </>
  );
}

// ── Whole timeline ───────────────────────────────────────────────────────────

export default function PRTimelineStepper({ data }: { data: PRTrackingTimelineData }) {
  const header = data.prHeader?.[0];
  const core = data.prCore?.[0];
  const status: string | undefined = core?.status ?? header?.status;
  const prApproved = status === "A";

  const lanes = buildDeliveryLanes(data);
  const summary = buildSummary(data, lanes);
  const prSteps = buildPrApprovalSteps(data);
  const isSplit = lanes.length > 1;

  const prApprovalState: StageState = status === "A" ? "done" : status === "P" ? "current" : "upcoming";
  const requester = nameOf(header?.created_by_name ?? core?.created_by_name, header?.created_by ?? core?.created_by);

  return (
    <div className="space-y-5 py-2">
      <SummaryCard data={data} summary={summary} />

      <div>
        <Stage icon={FileText} title="PR Raised" state="done">
          <p className={line}>
            By {requester ?? "—"} · {formatDate(header?.created_date ?? core?.created_date) ?? "—"}
          </p>
        </Stage>

        <Stage
          icon={ClipboardList}
          title="PR Approval"
          state={status === "R" ? "current" : prApprovalState}
          aside={<StatusBadge status={status} />}
        >
          {prSteps.length > 0 ? (
            <ApprovalTrail steps={prSteps} />
          ) : (
            <p className={line}>
              {status === "A"
                ? "Approved automatically — no approval chain is configured for this request."
                : status === "R"
                  ? "Rejected."
                  : "Waiting for an approver."}
            </p>
          )}
        </Stage>

        {isSplit && (
          <div className="-mt-2 mb-3 pl-12">
            <div className="flex items-start gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                Split into {lanes.length} deliveries — each supplier's quotation, PO approval, dispatch, gate entry and GRN
                are tracked separately below.
              </span>
            </div>
          </div>
        )}

        {lanes.map((lane, i) => {
          const stages = (
            <DeliveryLaneStages
              lane={lane}
              data={data}
              prApproved={prApproved}
              isLastLane={i === lanes.length - 1}
            />
          );
          if (!isSplit) return <React.Fragment key={lane.label}>{stages}</React.Fragment>;

          const vendor = lane.purchaseOrders[0]?.vendor_name ?? lane.quotations[0]?.vendor_name;
          return (
            <div key={lane.label} className="mb-2">
              <p className="mb-2 pl-12 text-xs font-semibold text-primary">
                Delivery {i + 1} — {lane.label}
                {vendor ? ` · ${vendor}` : ""}
              </p>
              {stages}
            </div>
          );
        })}
      </div>
    </div>
  );
}
