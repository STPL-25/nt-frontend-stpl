import { useMemo, useState } from "react";
import { Hourglass, Laptop, Package, Receipt, Repeat, Search, Warehouse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  STAGE_LABEL, bankStatusLabel, breakdownOf, filterExpenses, filterPayments, formatDay, formatInr, formatQty, sumOf,
  type BizAgreement, type BizAssetDept, type BizExpense, type BizPayment, type BizStockLine, type BusinessOverview, type ExpenseFilter, type PayStage, type PaymentFilter,
} from "./businessModel";
import { EmptyRows, Pill, Segmented, SplitBar } from "./BusinessParts";
import { BIZ_TONE, type BizTone } from "./bizTone";

const PAGE = 50;

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} className="h-8 pl-8 text-xs" />
    </div>
  );
}

function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
      Showing {shown} of {total}
      <Button type="button" variant="outline" size="sm" onClick={onMore}>Show {Math.min(PAGE, total - shown)} more</Button>
    </div>
  );
}

const num = "text-right tabular-nums";
const money = (v: number | null | undefined) => <span title={formatInr(v)}>{formatInr(v)}</span>;

// ── payments ───────────────────────────────────────────────────────────────────────────────────
const STAGE_TONE: Record<PayStage, BizTone> = { WAITING: "amber", APPROVED: "sky", SENT: "green" };

export function PaymentsTable({ rows, stage, onStage }: { rows: BizPayment[]; stage: PaymentFilter; onStage: (s: PaymentFilter) => void }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const shown = useMemo(() => filterPayments(rows, stage, query), [rows, stage, query]);
  const counts = useMemo(() => ({
    ALL: rows.length, WAITING: rows.filter((r) => r.stage === "WAITING").length, APPROVED: rows.filter((r) => r.stage === "APPROVED").length, SENT: rows.filter((r) => r.stage === "SENT").length,
  }), [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <Segmented<PaymentFilter>
          label="Payment stage"
          value={stage}
          onChange={(v) => { setLimit(PAGE); onStage(v); }}
          options={[
            { value: "ALL", label: "All", count: counts.ALL },
            { value: "WAITING", label: "Waiting", count: counts.WAITING },
            { value: "APPROVED", label: "Approved", count: counts.APPROVED },
            { value: "SENT", label: "Sent", count: counts.SENT },
          ]}
        />
        <SearchBox value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} label="Search payment, vendor, UTR…" />
      </div>
      {shown.length === 0 ? (
        <EmptyRows icon={Hourglass} title="No payments here" hint={rows.length ? "Nothing matches this filter." : "No payments in your part of the organisation yet."} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead><TableHead>Stage</TableHead>
                <TableHead>Bank</TableHead><TableHead>Department</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.slice(0, limit).map((p) => (
                <TableRow key={p.payment_sno}>
                  <TableCell className="font-medium">
                    {p.payment_no ?? `#${p.payment_sno}`}
                    <div className="text-[11px] font-normal text-muted-foreground">{p.payment_type === "ADVANCE" ? "Advance" : "Bill payment"}{p.mode ? ` · ${p.mode}` : ""}</div>
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">{p.vendor_name ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDay(p.payment_date)}</TableCell>
                  <TableCell><Pill tone={STAGE_TONE[p.stage]}>{STAGE_LABEL[p.stage]}</Pill></TableCell>
                  <TableCell className="text-xs">
                    {p.stage === "SENT" ? (
                      <>
                        <span className={cn("font-medium", p.bank_status === "PAID" ? BIZ_TONE.green.text : p.bank_status === "RETURNED" ? BIZ_TONE.red.text : "")}>{bankStatusLabel(p.bank_status)}</span>
                        {(p.batch_no || p.utr_no) && <div className="text-[11px] text-muted-foreground">{[p.batch_no, p.utr_no && `UTR ${p.utr_no}`].filter(Boolean).join(" · ")}</div>}
                      </>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>{p.dept_name ?? "-"}</TableCell>
                  <TableCell className={num}>{money(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5 text-xs sm:px-5">
            <span className="text-muted-foreground">{shown.length} payment{shown.length === 1 ? "" : "s"}</span>
            <span className="font-semibold tabular-nums">Total {formatInr(sumOf(shown, (r) => r.amount))}</span>
          </div>
          <ShowMore shown={Math.min(limit, shown.length)} total={shown.length} onMore={() => setLimit((l) => l + PAGE)} />
        </>
      )}
    </div>
  );
}

// ── expenses (invoices) ────────────────────────────────────────────────────────────────────────
export function ExpensesTable({ rows, kind, onKind }: { rows: BizExpense[]; kind: ExpenseFilter; onKind: (k: ExpenseFilter) => void }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const shown = useMemo(() => filterExpenses(rows, kind, query), [rows, kind, query]);
  const counts = useMemo(() => ({ ALL: rows.length, RECURRING: rows.filter((r) => r.kind === "RECURRING").length, NON_RECURRING: rows.filter((r) => r.kind === "NON_RECURRING").length }), [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <Segmented<ExpenseFilter>
          label="Expense kind"
          value={kind}
          onChange={(v) => { setLimit(PAGE); onKind(v); }}
          options={[
            { value: "ALL", label: "All", count: counts.ALL },
            { value: "RECURRING", label: "Recurring", count: counts.RECURRING },
            { value: "NON_RECURRING", label: "Non-recurring", count: counts.NON_RECURRING },
          ]}
        />
        <SearchBox value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} label="Search bill, vendor, PO…" />
      </div>
      {shown.length === 0 ? (
        <EmptyRows icon={Receipt} title="No bills here" hint={rows.length ? "Nothing matches this filter." : "No supplier bills in your part of the organisation yet."} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>For</TableHead><TableHead>Kind</TableHead>
                <TableHead>Department</TableHead><TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">To pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.slice(0, limit).map((e) => (
                <TableRow key={e.invoice_sno}>
                  <TableCell className="font-medium">
                    {e.invoice_no ?? `#${e.invoice_sno}`}
                    {e.vendor_invoice_no && <div className="text-[11px] font-normal text-muted-foreground">Vendor bill {e.vendor_invoice_no}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDay(e.invoice_date)}
                    {e.due_date && <div className="text-[11px] text-muted-foreground">Due {formatDay(e.due_date)}</div>}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate">{e.vendor_name ?? "-"}</TableCell>
                  <TableCell className="max-w-[16rem]">
                    <div className="truncate">{e.what ?? "-"}</div>
                    <div className="text-[11px] text-muted-foreground">{e.expense_class}{e.po_no ? ` · PO ${e.po_no}` : ""}</div>
                  </TableCell>
                  <TableCell>{e.kind === "RECURRING" ? <Pill tone="violet">Recurring</Pill> : <Pill tone="amber">Non-recurring</Pill>}</TableCell>
                  <TableCell>{e.dept_name ?? "-"}</TableCell>
                  <TableCell className={num}>{money(e.amount)}</TableCell>
                  <TableCell className={num}>{money(e.paid)}</TableCell>
                  <TableCell className={num}>
                    {money(Math.max(0, e.unpaid))}
                    {e.in_payment > 0.5 && <div className="text-[11px] text-muted-foreground">{formatInr(e.in_payment)} in a payment</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-border/60 bg-muted/30 px-4 py-2.5 text-xs sm:px-5">
            <span className="text-muted-foreground">{shown.length} bill{shown.length === 1 ? "" : "s"}</span>
            <span className="font-semibold tabular-nums">Billed {formatInr(sumOf(shown, (r) => r.amount))} · Paid {formatInr(sumOf(shown, (r) => r.paid))}</span>
          </div>
          <ShowMore shown={Math.min(limit, shown.length)} total={shown.length} onMore={() => setLimit((l) => l + PAGE)} />
        </>
      )}
    </div>
  );
}

// ── recurring agreements ───────────────────────────────────────────────────────────────────────
export function AgreementsTable({ rows }: { rows: BizAgreement[] }) {
  if (rows.length === 0) return <EmptyRows icon={Repeat} title="No running agreements" hint="Approved recurring service agreements for your part of the organisation will be listed here." />;
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agreement</TableHead><TableHead>Vendor</TableHead><TableHead>Service</TableHead><TableHead>Repeats</TableHead><TableHead>Department</TableHead>
            <TableHead>Period</TableHead><TableHead className="text-right">Each cycle</TableHead><TableHead className="text-right">Cycles billed</TableHead><TableHead className="text-right">Billed so far</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.agreement_sno}>
              <TableCell className="font-medium">{a.agreement_no ?? `#${a.agreement_sno}`}</TableCell>
              <TableCell className="max-w-[14rem] truncate">{a.vendor_name ?? "-"}</TableCell>
              <TableCell className="max-w-[14rem] truncate">{a.service_name ?? "-"}</TableCell>
              <TableCell>{a.cadence_name ?? "-"}</TableCell>
              <TableCell>{a.dept_name ?? "-"}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{formatDay(a.period_start)} – {formatDay(a.period_end)}</TableCell>
              <TableCell className={num}>{money(a.cycle_amount)}</TableCell>
              <TableCell className={num}>{a.cycles}</TableCell>
              <TableCell className={num}>{money(a.billed)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5 text-xs sm:px-5">
        <span className="text-muted-foreground">{rows.length} running agreement{rows.length === 1 ? "" : "s"}</span>
        <span className="font-semibold tabular-nums">Each cycle {formatInr(sumOf(rows, (r) => r.cycle_amount))} · Billed {formatInr(sumOf(rows, (r) => r.billed))}</span>
      </div>
    </div>
  );
}

// ── stock ──────────────────────────────────────────────────────────────────────────────────────
const STOCK_TONE: Record<string, BizTone> = { Regular: "sky", Perishable: "green", "Non-Regular": "violet" };

export function StockTable({ data }: { data: BusinessOverview }) {
  const lines: BizStockLine[] = data.top_items;
  const byType = breakdownOf(data, "stock_type");
  return (
    <div>
      {byType.length > 0 && (
        <div className="px-4 pb-1 pt-3 sm:px-5">
          <SplitBar
            title="Inventory value by stock type"
            format={formatInr}
            parts={byType.map((b) => ({ label: `${b.label} (${b.cnt} item${b.cnt === 1 ? "" : "s"})`, value: Number(b.amount ?? 0), tone: STOCK_TONE[b.label] ?? "slate" }))}
          />
        </div>
      )}
      {lines.length === 0 ? (
        <EmptyRows icon={Warehouse} title="No stock on hand" hint="Stock appears here once goods are received into your stores." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Stock type</TableHead><TableHead>Department</TableHead>
              <TableHead className="text-right">In stock</TableHead><TableHead className="text-right">Cost each</TableHead><TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((i) => (
              <TableRow key={i.item_sno}>
                <TableCell className="font-medium">{i.item_name}{i.item_code && <div className="text-[11px] font-normal text-muted-foreground">{i.item_code}</div>}</TableCell>
                <TableCell>{i.category ?? "-"}</TableCell>
                <TableCell><Pill tone={STOCK_TONE[i.stock_type] ?? "slate"}>{i.stock_type}</Pill></TableCell>
                <TableCell>{i.dept_name ?? "-"}</TableCell>
                <TableCell className={num}>{formatQty(i.current_stock)} {i.uom ?? ""}</TableCell>
                <TableCell className={num}>{i.unit_cost == null ? <span className="text-muted-foreground">no cost yet</span> : money(i.unit_cost)}</TableCell>
                <TableCell className={num}>{money(i.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
        The ten stock lines worth the most, valued at cost excluding GST. A line with no cost yet is on the shelf but adds nothing to the value until it has a purchase price.
      </p>
    </div>
  );
}

// ── assets ─────────────────────────────────────────────────────────────────────────────────────
export function AssetsTable({ rows }: { rows: BizAssetDept[] }) {
  if (rows.length === 0) return <EmptyRows icon={Laptop} title="No assets with departments" hint="Non-regular items issued to a department are counted as assets." />;
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Department</TableHead><TableHead className="text-right">Kinds</TableHead><TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">In use</TableHead><TableHead className="text-right">In service</TableHead><TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.dept_name}>
              <TableCell className="font-medium"><span className="inline-flex items-center gap-2"><Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{r.dept_name}</span></TableCell>
              <TableCell className={num}>{r.kinds}</TableCell>
              <TableCell className={num}>{formatQty(r.qty)}</TableCell>
              <TableCell className={num}>{formatQty(r.in_use_qty)}</TableCell>
              <TableCell className={num}>{formatQty(r.service_qty)}</TableCell>
              <TableCell className={num}>{money(r.value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
        Assets are non-regular items issued to a department and not yet returned. A department with a value of ₹0 holds items that have no purchase price recorded yet.
      </p>
    </div>
  );
}
