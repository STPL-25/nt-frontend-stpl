import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis,
} from "recharts";
import {
  BadgeCheck, Boxes, ClipboardList, Hourglass, Info, Laptop, PackageCheck, PiggyBank, Receipt, Repeat, Send, ShoppingCart, Truck, Wallet, Warehouse,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ErrorState } from "@/CustomComponent/PageComponents";
import { cn } from "@/lib/utils";
import {
  breakdownOf, formatDay, formatInr, formatInrCompact, formatQty, isEmptyOverview, monthLabel, pct, share,
  type BizBudget, type BizVendorExpense, type BusinessOverview as BusinessData, type ExpenseKind,
} from "./businessModel";
import { useBusinessOverview } from "./useBusinessOverview";
import { useMediaQuery } from "./dashboardHooks";
import { LiveStatus, Panel } from "./DashboardParts";
import { KpiCard, Pill, SectionHeader, SplitBar } from "./BusinessParts";
import { BIZ_TONE } from "./bizTone";
import ExpenseTrendChart from "./ExpenseTrendChart";

const ACTIVITY_CHART: ChartConfig = {
  pr_count: { label: "PR raised", color: "#0ea5e9" },
  po_count: { label: "PO raised", color: "#8b5cf6" },
  gate_count: { label: "Gate entries", color: "#f59e0b" },
  grn_count: { label: "GRN done", color: "#22c55e" },
};

/**
 * Business overview - the numbers people open the Dashboard for: stock and assets, PR / PO, gate entries and GRN, payments, budget and
 * expenses. Everything is decided in sp_nt_GetBusinessDashboard (backend sql/153): the page only draws what it is sent, and the
 * procedure limits it to the part of the organisation the signed-in user has access to.
 */
export default function BusinessOverview() {
  const live = useBusinessOverview();
  const { data, loading, error, changed } = live;
  const roomy = useMediaQuery("(min-width: 640px)");     // phones: label every second month so the axis does not overlap

  if (loading && !data) return <BusinessSkeleton />;
  if (!data) return <ErrorState fullPage message={error ?? "Could not load the business overview."} onRetry={live.refresh} />;

  const k = data.kpi;
  const empty = isEmptyOverview(data);
  const poTypes = breakdownOf(data, "po_type");
  const poStatuses = breakdownOf(data, "po_status");
  const flash = (...keys: (keyof typeof k)[]) => keys.some((x) => changed.has(String(x)));

  return (
    <div className="flex flex-col gap-7 pb-8 lg:gap-8">
     

      {empty && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">{data.meta.no_scope === 1 ? "No organisation access is assigned to you yet" : "Nothing to show yet"}</p>
            <p className="text-xs text-muted-foreground">
              {data.meta.no_scope === 1
                ? "Ask an administrator to give you a company, division, branch or department on Role Approval - the numbers appear here as soon as you have one."
                : "There are no purchases, stock, payments or bills recorded for your part of the organisation so far."}
            </p>
          </div>
        </div>
      )}

      {/* ── stock & assets ── */}
      <section className="flex flex-col gap-3" aria-label="Stock and assets">
        <SectionHeader icon={Warehouse} title="Stock & assets" hint="What is on the shelf, and what departments are holding" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Inventory value" icon={Warehouse} tone="sky" delay={40}
            value={formatInrCompact(k.inv_value)} full={formatInr(k.inv_value)}
            sub={`${k.inv_in_stock_items} item${k.inv_in_stock_items === 1 ? "" : "s"} in stock · ${formatQty(k.inv_qty)} units`}
            foot={k.inv_unpriced_items > 0 ? <span className={BIZ_TONE.amber.text}>{k.inv_unpriced_items} item{k.inv_unpriced_items === 1 ? " has" : "s have"} no purchase price yet - not in this value</span> : "At cost, excluding GST"}
            flash={flash("inv_value", "inv_qty")}
          />
          <KpiCard
            label="Asset value" icon={Laptop} tone="violet" delay={80}
            value={formatInrCompact(k.asset_value)} full={formatInr(k.asset_value)}
            sub={`${k.asset_kinds} kind${k.asset_kinds === 1 ? "" : "s"} of asset held by departments`}
            foot={k.asset_unpriced_kinds > 0 ? <span className={BIZ_TONE.amber.text}>{k.asset_unpriced_kinds} kind{k.asset_unpriced_kinds === 1 ? " has" : "s have"} no purchase price yet - not in this value</span> : "At cost, excluding GST"}
            flash={flash("asset_value")}
          />
          <KpiCard
            label="Asset quantity" icon={Boxes} tone="teal" delay={120} className="sm:col-span-2 xl:col-span-1"
            value={formatQty(k.asset_qty)}
            sub={`${formatQty(k.asset_in_use_qty)} in use · ${formatQty(k.asset_service_qty)} out for service`}
            ratio={share(k.asset_in_use_qty, k.asset_qty)} ratioLabel="In use"
            flash={flash("asset_qty")}
          />
        </div>
      </section>

      {/* ── procurement ── */}
      <section className="flex flex-col gap-3" aria-label="Purchasing and receiving">
        <SectionHeader icon={ClipboardList} title="Purchasing & receiving" hint="Requests raised, orders placed, goods through the gate and received" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="PR raised" icon={ClipboardList} tone="sky" delay={40}
            value={k.pr_total.toLocaleString("en-IN")}
            sub={`${k.pr_month} this month · ${k.pr_pending} waiting for approval`}
            foot={`${formatInrCompact(k.pr_value)} estimated value`}
            ratio={share(k.pr_approved, k.pr_total)} ratioLabel="Approved" flash={flash("pr_total", "pr_pending")}
          />
          <KpiCard
            label="PO raised" icon={ShoppingCart} tone="violet" delay={80}
            value={k.po_total.toLocaleString("en-IN")}
            sub={`${formatInrCompact(k.po_value)} · ${k.po_month} this month`}
            foot={`${k.po_product} product · ${k.po_service} service · ${k.po_pending} waiting for approval`}
            flash={flash("po_total", "po_value")}
          />
          <KpiCard
            label="Gate entries" icon={Truck} tone="amber" delay={120}
            value={k.gate_total.toLocaleString("en-IN")}
            sub={`${k.gate_today} today · ${k.gate_month} this month`}
            foot={`${k.gate_waiting_grn} at the gate waiting for GRN`}
            ratio={share(k.gate_grn_done, k.gate_total)} ratioLabel="GRN done" flash={flash("gate_total", "gate_waiting_grn")}
          />
          <KpiCard
            label="GRN done" icon={PackageCheck} tone="green" delay={160}
            value={k.grn_done.toLocaleString("en-IN")}
            sub={`${k.grn_month} this month · ${formatInrCompact(k.grn_value)} received`}
            foot={`${k.grn_pending} waiting for approval · ${k.grn_approved} approved`}
            flash={flash("grn_done", "grn_pending")}
          />
        </div>

        <Panel title="Products and services" subtitle="How requests and orders split between goods and services" icon={ShoppingCart} bodyClassName="grid gap-5 p-4 sm:p-5 md:grid-cols-3">
          <SplitBar title="PR raised" format={(v) => v.toLocaleString("en-IN")} parts={[{ label: "Product", value: k.pr_product, tone: "sky" }, { label: "Service", value: k.pr_service, tone: "violet" }]} />
          <SplitBar title="PO raised" format={(v) => v.toLocaleString("en-IN")} parts={[{ label: "Product", value: k.po_product, tone: "sky" }, { label: "Service", value: k.po_service, tone: "violet" }]} />
          <SplitBar title="PO value" format={formatInrCompact} parts={[{ label: "Product", value: k.po_product_value, tone: "sky" }, { label: "Service", value: k.po_service_value, tone: "violet" }]} />
          {(poTypes.length > 0 || poStatuses.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-xs md:col-span-3">
              {poTypes.length > 0 && <span className="font-semibold text-foreground/80">PO by type</span>}
              {poTypes.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">{b.label}</span><span className="font-semibold tabular-nums">{b.cnt}</span><span className="tabular-nums text-muted-foreground">· {formatInrCompact(b.amount)}</span></span>
              ))}
              {poStatuses.length > 0 && <span className="font-semibold text-foreground/80 md:ml-4">PO by status</span>}
              {poStatuses.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">{b.label}</span><span className="font-semibold tabular-nums">{b.cnt}</span></span>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* ── payments ── */}
      <section className="flex flex-col gap-3" aria-label="Payments">
        <SectionHeader icon={Wallet} title="Payments" hint="From waiting for approval, to approved, to sent to the bank" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Payment waiting" icon={Hourglass} tone="amber" delay={40}
            value={formatInrCompact(k.pay_waiting_amount)} full={formatInr(k.pay_waiting_amount)}
            sub={`${k.pay_waiting_count} payment${k.pay_waiting_count === 1 ? "" : "s"} waiting for approval`}
            flash={flash("pay_waiting_count", "pay_waiting_amount")}
          />
          <KpiCard
            label="Payment approved" icon={BadgeCheck} tone="sky" delay={80}
            value={formatInrCompact(k.pay_approved_amount)} full={formatInr(k.pay_approved_amount)}
            sub={`${k.pay_approved_count} approved, not yet sent to the bank`}
            flash={flash("pay_approved_count", "pay_approved_amount")}
          />
          <KpiCard
            label="Payment sent" icon={Send} tone="green" delay={120}
            value={formatInrCompact(k.pay_sent_amount)} full={formatInr(k.pay_sent_amount)}
            sub={`${k.pay_sent_count} sent to the bank`}
            foot={`${k.pay_bank_paid_count} bank confirmed · ${k.pay_bank_pending_count} awaiting bank${k.pay_bank_returned_count ? ` · ${k.pay_bank_returned_count} returned` : ""}`}
            flash={flash("pay_sent_count", "pay_sent_amount")}
          />
          <KpiCard
            label="Bills not yet paid" icon={Receipt} tone="red" delay={160}
            value={formatInrCompact(k.bills_unpaid_amount)} full={formatInr(k.bills_unpaid_amount)}
            sub={`${k.bills_unpaid_count} bill${k.bills_unpaid_count === 1 ? "" : "s"} with nothing paid or queued`}
            flash={flash("bills_unpaid_count", "bills_unpaid_amount")}
          />
        </div>
      </section>

      {/* ── budget ── */}
      <section className="flex flex-col gap-3" aria-label="Budget">
        <SectionHeader icon={PiggyBank} title="Budget" hint="What was budgeted, what purchase orders have used, and what is left" />
        <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
          <BudgetCard data={data} flash={flash("bud_running_remaining", "bud_all_remaining")} />
          <Panel title="Budgets" subtitle={`${k.bud_count} budget${k.bud_count === 1 ? "" : "s"} for your departments`} icon={PiggyBank} className="lg:col-span-2">
            <BudgetList budgets={data.budgets} />
            {k.bud_count > 0 && (
              <p className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
                “Used” counts purchase orders tagged to the budget. {k.po_without_budget} of {k.po_total} purchase orders are not tagged to any budget, so they are not deducted here.
              </p>
            )}
          </Panel>
        </div>
      </section>

      {/* ── expenses ── */}
      <section className="flex flex-col gap-3" aria-label="Expenses">
        <SectionHeader icon={Receipt} title="Expenses" hint="Supplier bills, split into recurring (repeating service agreements) and non-recurring (everything else)" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ExpenseCard kind="RECURRING" data={data} flash={flash("exp_rec_amount", "exp_rec_paid")} />
          <ExpenseCard kind="NON_RECURRING" data={data} flash={flash("exp_non_amount", "exp_non_paid")} />
        </div>
        <ExpenseTrendChart data={data} />
        <div className="grid gap-3">
          <Panel title="Activity by month" subtitle="Requests, orders, gate entries and receipts, last 12 months" icon={ClipboardList} bodyClassName="p-3 sm:p-4">
            <ChartContainer config={ACTIVITY_CHART} className="aspect-auto h-[260px] w-full" role="img" aria-label="PR raised, PO raised, gate entries and GRN done each month over the last 12 months">
              <BarChart data={data.monthly.map((m) => ({ ...m, label: monthLabel(m.month_start) }))} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={roomy ? 0 : 1} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="pr_count" fill="var(--color-pr_count)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="po_count" fill="var(--color-po_count)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gate_count" fill="var(--color-gate_count)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="grn_count" fill="var(--color-grn_count)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Panel>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <VendorList title="Top vendors - recurring" kind="RECURRING" rows={data.expense_by_vendor} tone="violet" />
          <VendorList title="Top vendors - non-recurring" kind="NON_RECURRING" rows={data.expense_by_vendor} tone="amber" />
        </div>
      </section>
    </div>
  );
}

// ── budget ─────────────────────────────────────────────────────────────────────────────────────
function BudgetCard({ data, flash }: { data: BusinessData; flash: boolean }) {
  const k = data.kpi;
  if (k.bud_count === 0) {
    return <KpiCard label="Budget remaining" icon={PiggyBank} tone="slate" value="-" sub="No budget is set up for your departments" className="lg:col-span-1" />;
  }
  if (k.bud_running_count === 0) {
    return (
      <KpiCard
        label="Budget remaining" icon={PiggyBank} tone="amber" delay={40} className="lg:col-span-1"
        value={formatInrCompact(0)}
        sub={`No budget is running today · ${k.bud_count} ended budget${k.bud_count === 1 ? "" : "s"}`}
        foot={`${formatInrCompact(k.bud_all_remaining)} was left unspent when they ended`}
        flash={flash}
      />
    );
  }
  return (
    <KpiCard
      label="Budget remaining" icon={PiggyBank} tone="green" delay={40} className="lg:col-span-1"
      value={formatInrCompact(k.bud_running_remaining)} full={formatInr(k.bud_running_remaining)}
      sub={`of ${formatInrCompact(k.bud_running_budget)} across ${k.bud_running_count} running budget${k.bud_running_count === 1 ? "" : "s"}`}
      foot={`${formatInrCompact(k.bud_running_used)} used (${pct(k.bud_running_used, k.bud_running_budget)}%)`}
      ratio={share(k.bud_running_used, k.bud_running_budget)} ratioLabel="Used" flash={flash}
    />
  );
}

function BudgetList({ budgets }: { budgets: BizBudget[] }) {
  if (budgets.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">No budgets for your departments.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {budgets.map((b) => {
        const used = share(b.used, b.budget);
        const over = b.budget > 0 && b.used > b.budget;
        return (
          <li key={b.bud_sno} className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">{b.bud_code ?? `Budget #${b.bud_sno}`}</span>
                {b.is_expired ? <Pill tone="slate">Ended</Pill> : <Pill tone="green">Running</Pill>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{b.dept_name ?? "All departments"} · {formatDay(b.bud_from)} – {formatDay(b.bud_to)}</p>
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Used {formatInrCompact(b.used)} of {formatInrCompact(b.budget)}</span>
                <span className={cn("font-semibold tabular-nums", over && BIZ_TONE.red.text)} title={formatInr(b.remaining)}>{formatInrCompact(b.remaining)} left</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(used * 100)}% of the budget used`}>
                <div className={cn("h-full rounded-full", over ? BIZ_TONE.red.bar : b.is_expired ? BIZ_TONE.slate.bar : BIZ_TONE.green.bar)} style={{ width: `${Math.max(used > 0 ? 2 : 0, used * 100)}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── expenses ───────────────────────────────────────────────────────────────────────────────────
function ExpenseCard({ kind, data, flash }: { kind: ExpenseKind; data: BusinessData; flash: boolean }) {
  const k = data.kpi;
  const rec = kind === "RECURRING";
  const amount = rec ? k.exp_rec_amount : k.exp_non_amount;
  const paid = rec ? k.exp_rec_paid : k.exp_non_paid;
  const count = rec ? k.exp_rec_count : k.exp_non_count;
  const month = rec ? k.exp_rec_month : k.exp_non_month;
  return (
    <KpiCard
      label={rec ? "Recurring expense" : "Non-recurring expense"} icon={rec ? Repeat : Receipt} tone={rec ? "violet" : "amber"} delay={40}
      value={formatInrCompact(amount)} full={formatInr(amount)}
      sub={`${count} bill${count === 1 ? "" : "s"} · ${formatInrCompact(paid)} paid · ${formatInrCompact(month)} this month`}
      foot={rec
        ? `${k.agreements_active} running agreement${k.agreements_active === 1 ? "" : "s"} · ${formatInrCompact(k.agreements_cycle_amount)} each cycle`
        : "Product purchases and one-off services"}
      ratio={share(paid, amount)} ratioLabel="Paid" flash={flash}
    />
  );
}

function VendorList({ title, kind, rows, tone }: { title: string; kind: ExpenseKind; rows: BizVendorExpense[]; tone: "violet" | "amber" }) {
  const list = rows.filter((r) => r.kind === kind);
  const max = Math.max(1, ...list.map((r) => r.amount));
  return (
    <Panel title={title} subtitle="By billed amount" icon={Wallet}>
      {list.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">No bills yet.</p>
      ) : (
        <ol className="divide-y divide-border/60">
          {list.map((r) => (
            <li key={r.vendor_name} className="px-4 py-2.5 sm:px-5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{r.vendor_name}</span>
                <span className="shrink-0 font-semibold tabular-nums" title={formatInr(r.amount)}>{formatInrCompact(r.amount)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", BIZ_TONE[tone].bar)} style={{ width: `${share(r.amount, max) * 100}%` }} /></div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{r.cnt} bill{r.cnt === 1 ? "" : "s"} · {formatInrCompact(r.paid)} paid</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function BusinessSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading the business overview">
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((__, i) => <Skeleton key={i} className="h-[124px] rounded-2xl" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
