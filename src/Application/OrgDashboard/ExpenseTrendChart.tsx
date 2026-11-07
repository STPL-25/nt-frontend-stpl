import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Building2, GitBranch, Landmark, ReceiptIndianRupee, TrendingUp, UsersRound } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "./DashboardParts";
import {
  buildExpenseTrend,
  expenseOrgOptions,
  formatInr,
  formatInrCompact,
  monthLabel,
  type BusinessOverview,
  type ExpenseOrgLevel,
} from "./businessModel";

const CHART_CONFIG: ChartConfig = {
  total_expense: { label: "Total expense", color: "#247ac9" },
};

const LEVELS: { value: ExpenseOrgLevel; label: string; allLabel: string; icon: typeof Building2 }[] = [
  { value: "company", label: "Company", allLabel: "All accessible companies", icon: Building2 },
  { value: "division", label: "Division", allLabel: "All accessible divisions", icon: GitBranch },
  { value: "branch", label: "Branch", allLabel: "All accessible branches", icon: Landmark },
  { value: "department", label: "Department", allLabel: "All accessible departments", icon: UsersRound },
];

export default function ExpenseTrendChart({ data }: { data: BusinessOverview }) {
  const [level, setLevel] = useState<ExpenseOrgLevel>("company");
  const [entity, setEntity] = useState("all");

  const levelMeta = LEVELS.find((item) => item.value === level) ?? LEVELS[0];
  const options = useMemo(() => expenseOrgOptions(data.expense_monthly_org ?? [], level), [data.expense_monthly_org, level]);
  const selectedId = entity === "all" ? null : Number(entity);
  const trend = useMemo(
    () => buildExpenseTrend(data.monthly, data.expense_monthly_org ?? [], level, selectedId),
    [data.monthly, data.expense_monthly_org, level, selectedId]
  );
  const selected = selectedId == null ? null : options.find((option) => option.id === selectedId) ?? null;

  const total = trend.reduce((sum, month) => sum + month.total_expense, 0);
  const average = trend.length ? total / trend.length : 0;
  const peak = trend.reduce((best, month) => month.total_expense > best.total_expense ? month : best, trend[0] ?? { month_start: "", total_expense: 0, recurring_expense: 0, non_recurring_expense: 0, invoice_count: 0 });
  const chartData = trend.map((month) => ({ ...month, label: monthLabel(month.month_start) }));

  const changeLevel = (next: ExpenseOrgLevel) => {
    setLevel(next);
    setEntity("all");
  };

  return (
    <Panel
      title="Monthly total expense"
      subtitle={`Last 12 months · ${selected?.path ?? levelMeta.allLabel}`}
      icon={ReceiptIndianRupee}
      bodyClassName="p-4 sm:p-5"
    >
      <div className="grid gap-3 border-b border-border/60 pb-4 sm:grid-cols-2 xl:grid-cols-[210px_minmax(280px,1fr)]">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">View by</span>
          <Select value={level} onValueChange={(value) => changeLevel(value as ExpenseOrgLevel)}>
            <SelectTrigger className="h-10 rounded-xl bg-background/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {LEVELS.map(({ value, label, icon: Icon }) => (
                <SelectItem key={value} value={value}><Icon className="h-4 w-4" />{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select {levelMeta.label.toLowerCase()}</span>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="h-10 rounded-xl bg-background/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="max-w-[min(90vw,520px)]">
              <SelectItem value="all">{levelMeta.allLabel}</SelectItem>
              {options.map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.path}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Summary label="12-month total" value={formatInrCompact(total)} icon={ReceiptIndianRupee} />
        <Summary label="Monthly average" value={formatInrCompact(average)} icon={TrendingUp} />
        <Summary label="Highest month" value={peak.total_expense > 0 ? `${monthLabel(peak.month_start)} · ${formatInrCompact(peak.total_expense)}` : "No expense"} icon={Landmark} />
      </div>

      {total > 0 ? (
        <ChartContainer config={CHART_CONFIG} className="mt-4 aspect-auto h-[280px] w-full sm:h-[340px]" role="img" aria-label={`Monthly total expense for ${selected?.path ?? levelMeta.allLabel}`}>
          <AreaChart data={chartData} margin={{ left: 4, right: 10, top: 16, bottom: 0 }}>
            <defs>
              <linearGradient id="expenseTotalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-total_expense)" stopOpacity={0.42} />
                <stop offset="100%" stopColor="var(--color-total_expense)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" fontSize={11} />
            <YAxis tickLine={false} axisLine={false} width={58} fontSize={11} tickFormatter={(value: number) => formatInrCompact(value).replace("₹", "")} />
            <ChartTooltip
              cursor={{ stroke: "var(--color-total_expense)", strokeOpacity: 0.25 }}
              content={<ChartTooltipContent formatter={(value) => <span className="font-semibold tabular-nums">{formatInr(Number(value))}</span>} />}
            />
            <Area type="monotone" dataKey="total_expense" stroke="var(--color-total_expense)" strokeWidth={2.5} fill="url(#expenseTotalFill)" dot={{ r: 3, fill: "var(--color-total_expense)" }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 text-center sm:min-h-[340px]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ReceiptIndianRupee className="h-6 w-6" /></span>
          <p className="mt-3 text-sm font-semibold">No expenses for this selection</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">No billed expenses were recorded during the last 12 months. Choose another {levelMeta.label.toLowerCase()} or view all accessible records.</p>
        </div>
      )}
    </Panel>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ReceiptIndianRupee }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/25 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold tabular-nums sm:text-base" title={value}>{value}</p>
      </div>
    </div>
  );
}
