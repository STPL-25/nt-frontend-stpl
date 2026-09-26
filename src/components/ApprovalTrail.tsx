import React from "react";
import { Check, Clock, X, Circle, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A vertical "who approved, who is next" trail — one row per approval stage with the
 * approver's name, what happened (approved / pending / rejected / still to come), when,
 * and the comment they left. Shared by PR Tracking (PR approval + PO approval) and the
 * Supplier Status screen so an approval looks identical everywhere it is shown.
 */

export type ApprovalStepState = "approved" | "pending" | "rejected" | "upcoming";

export interface ApprovalStep {
  key: string | number;
  /** Stage / role name, e.g. "Manager Approval". */
  label: string;
  /** Who acts at this stage — a display name (callers fall back to the code themselves). */
  person?: string | null;
  state: ApprovalStepState;
  /** Already-formatted date/time the stage was acted on. */
  at?: string | null;
  /** The approver's comment, if they left one. */
  comment?: string | null;
  /** An extra line such as "Forwarded to A. Kumar". */
  note?: string | null;
  /** Overrides the status chip's wording ("Submitted") when approved/pending/… doesn't fit. */
  word?: string;
}

const STATE_META: Record<
  ApprovalStepState,
  { word: string; icon: React.ElementType; dot: string; chip: string; card: string }
> = {
  approved: {
    word: "Approved",
    icon: Check,
    dot: "border-emerald-500 bg-emerald-500 text-white",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    card: "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/10",
  },
  pending: {
    word: "Pending",
    icon: Clock,
    dot: "border-amber-500 bg-amber-500 text-white",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    card: "border-amber-300 bg-amber-50/60 ring-2 ring-amber-300/50 dark:border-amber-800 dark:bg-amber-950/20",
  },
  rejected: {
    word: "Rejected",
    icon: X,
    dot: "border-red-500 bg-red-500 text-white",
    chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
    card: "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10",
  },
  upcoming: {
    word: "Awaiting",
    icon: Circle,
    dot: "border-border bg-muted text-muted-foreground/50",
    chip: "bg-muted text-muted-foreground border-border",
    card: "border-dashed border-border bg-transparent",
  },
};

export default function ApprovalTrail({
  steps,
  className,
}: {
  steps: ApprovalStep[];
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <ol className={cn("space-y-0", className)} aria-label="Approval trail">
      {steps.map((step, i) => {
        const meta = STATE_META[step.state];
        const Icon = meta.icon;
        const isLast = i === steps.length - 1;
        // The rail after a step is "live" only once that step has actually been approved.
        const railLive = step.state === "approved";

        return (
          <li key={step.key} className="flex gap-3" data-state={step.state}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  meta.dot
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={3} />
              </span>
              {!isLast && (
                <span className={cn("my-1 w-px flex-1", railLive ? "bg-emerald-400/60" : "bg-border")} />
              )}
            </div>

            <div className={cn("min-w-0 flex-1", !isLast && "pb-3")}>
              <div className={cn("rounded-lg border px-3 py-2", meta.card)}>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      step.state === "upcoming" && "text-muted-foreground"
                    )}
                  >
                    {step.person || "—"}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      meta.chip
                    )}
                  >
                    {step.word ?? meta.word}
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.label}
                  {step.at ? ` · ${step.at}` : ""}
                </p>

                {step.note && <p className="mt-1 text-xs text-muted-foreground">{step.note}</p>}

                {step.comment && (
                  <p className="mt-1.5 flex gap-1.5 rounded-md bg-background/70 px-2 py-1.5 text-xs italic text-foreground/80">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 break-words">{step.comment}</span>
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
