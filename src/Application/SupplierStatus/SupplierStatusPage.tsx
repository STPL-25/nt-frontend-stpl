import React, { useMemo, useState } from "react";
import {
  BadgeCheck, Search, X, RefreshCw, Clock, CheckCircle2, XCircle, Users, Building2, Mail, Phone, Hash,
  Calendar, User, Tag,
} from "lucide-react";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "@/CustomComponent/PageComponents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import ApprovalTrail from "@/components/ApprovalTrail";
import { getStatusInfo } from "@/utils/statusUtils";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatDate";
import useFetch from "@/hooks/useFetchHook";
import { apiGetSupplierStatusList, apiGetSupplierStatusTimeline } from "@/Services/Api";
import {
  buildSupplierTrail, countByStatus, displayName, filterSuppliers, pendingLine, STATUS_WORD,
  type StatusFilter, type SupplierStatusRow, type SupplierTimelineData,
} from "./supplierStatusModel";

// ── Small pieces ──────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ElementType> = { A: CheckCircle2, P: Clock, R: XCircle };

function SupplierStatusBadge({ status }: { status: string | null }) {
  const info = getStatusInfo(status);
  const Icon = STATUS_ICON[status ?? ""] ?? Clock;
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", info.cls)}
      data-testid="supplier-status-badge"
    >
      <Icon className="h-3 w-3" />
      {STATUS_WORD[status ?? ""] ?? info.label}
    </span>
  );
}

const CATEGORY_STYLE: Record<string, string> = {
  "Service Vendor": "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400",
  Supplier: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400",
};

function CategoryChip({ category }: { category: string }) {
  return (
    <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_STYLE[category] ?? "border-border bg-muted text-muted-foreground")}>
      {category}
    </span>
  );
}

/** Approved on / Rejected on — the last thing that happened to the supplier. */
function lastActionLine(row: SupplierStatusRow): string | null {
  if (row.status === "P" || !row.last_action_date) return null;
  const verb = row.status === "A" ? "Approved" : "Rejected";
  const who = row.last_action_by_name || row.last_action_by;
  return `${verb} ${formatDate(row.last_action_date)}${who ? ` by ${who}` : ""}`;
}

interface TileProps {
  value: StatusFilter;
  label: string;
  count: number;
  icon: React.ElementType;
  tone: string;
  active: boolean;
  onSelect: (v: StatusFilter) => void;
}

function FilterTile({ value, label, count, icon: Icon, tone, active, onSelect }: TileProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(value)}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-all hover:shadow-md",
        active ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-none tabular-nums">{count}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Detail sheet ─────────────────────────────────────────────────────────────

function SupplierDetail({ row }: { row: SupplierStatusRow }) {
  const { data, loading, error } = useFetch<{ success: boolean; data: SupplierTimelineData }>(
    apiGetSupplierStatusTimeline(row.source, row.record_id)
  );
  const timeline = data?.data;
  const steps = useMemo(() => (timeline ? buildSupplierTrail(timeline) : []), [timeline]);
  const header = timeline?.header ?? row;
  const pending = pendingLine(row);

  return (
    <div className="space-y-5 px-4 pb-6">
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SupplierStatusBadge status={row.status} />
          <CategoryChip category={row.category} />
          {row.supp_code && <span className="font-mono text-xs text-muted-foreground">{row.supp_code}</span>}
        </div>
        {pending && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {pending}
          </p>
        )}
        {row.status === "A" && (
          <p className="text-sm text-muted-foreground">
            {lastActionLine(row) ?? "Approved"}
            {row.supp_code ? ` — supplier code ${row.supp_code} issued.` : "."}
          </p>
        )}
        {row.status === "R" && <p className="text-sm text-muted-foreground">{lastActionLine(row) ?? "Rejected"}.</p>}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Fact icon={User} label="Contact person" value={header.contact_person} />
          <Fact icon={Tag} label="Business type" value={header.business_type_name} />
          <Fact icon={Mail} label="Email" value={header.email} />
          <Fact icon={Phone} label="Mobile" value={header.mobile_number} />
          <Fact icon={Hash} label="GST" value={header.gst_no} />
          <Fact icon={Hash} label="PAN" value={header.pan_no} />
          <Fact icon={Calendar} label="Submitted" value={[formatDate(header.created_date), header.created_by_name || header.created_by].filter(Boolean).join(" · ")} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Approval trail</h3>
        {loading ? (
          <LoadingState message="Loading approval trail…" />
        ) : error ? (
          <ErrorState message={error} />
        ) : steps.length === 0 ? (
          <EmptyState icon={Clock} message="No approval activity recorded yet" />
        ) : (
          <ApprovalTrail steps={steps} />
        )}
        {timeline && row.source === "KYC" && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Approval comments are not recorded for regular supplier KYC, only who acted and when.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SupplierStatusPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useFetch<{ success: boolean; data: SupplierStatusRow[] }>(
    apiGetSupplierStatusList, "", null, refreshKey
  );
  const rows = useMemo(() => data?.data ?? [], [data]);

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SupplierStatusRow | null>(null);

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);
  const visible = useMemo(() => filterSuppliers(rows, filter, search, category), [rows, filter, search, category]);

  const open = (row: SupplierStatusRow) => setSelected(row);

  return (
    <div className="flex h-full min-h-full flex-col bg-muted/30">
      <PageHeader
        icon={BadgeCheck}
        title="Supplier Status"
        description="Every supplier's KYC at a glance — approved, waiting for approval (and with whom), or rejected"
      />

      <div className="container mx-auto space-y-5 px-4 py-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Filter by status">
          <FilterTile value="all" label="All suppliers" count={counts.all} icon={Users} tone="bg-primary/10 text-primary" active={filter === "all"} onSelect={setFilter} />
          <FilterTile value="A" label="Approved" count={counts.A} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" active={filter === "A"} onSelect={setFilter} />
          <FilterTile value="P" label="Approval pending" count={counts.P} icon={Clock} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" active={filter === "P"} onSelect={setFilter} />
          <FilterTile value="R" label="Rejected" count={counts.R} icon={XCircle} tone="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" active={filter === "R"} onSelect={setFilter} />
        </div>

        <Card className="shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, supplier code, GST, PAN, contact, approver…"
                  aria-label="Search suppliers"
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {search && (
                  <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {categories.length > 1 && (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Filter by category"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <Button variant="outline" className="h-10 gap-2" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
              </Button>
            </div>

            {loading && rows.length === 0 ? (
              <LoadingState message="Loading suppliers…" />
            ) : error ? (
              <ErrorState message={error} />
            ) : visible.length === 0 ? (
              <EmptyState icon={Building2} message={rows.length === 0 ? "No suppliers yet" : "No suppliers match the current filters"} />
            ) : (
              <>
                {/* Desktop / tablet: table */}
                <div className="hidden overflow-x-auto rounded-lg border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>GST / PAN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((r) => (
                        <TableRow
                          key={`${r.source}-${r.record_id}`}
                          tabIndex={0}
                          role="button"
                          aria-label={`View approval status of ${displayName(r)}`}
                          onClick={() => open(r)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r); } }}
                          className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
                        >
                          <TableCell className="max-w-[260px]">
                            <p className={cn("truncate font-semibold", !r.company_name && "italic text-muted-foreground")}>{displayName(r)}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {r.supp_code && <span className="font-mono text-[11px] text-muted-foreground">{r.supp_code}</span>}
                              <CategoryChip category={r.category} />
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[220px] text-sm">
                            <p className="truncate">{r.contact_person || "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.email || r.mobile_number || ""}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p className="font-mono">{r.gst_no || "—"}</p>
                            <p className="font-mono text-muted-foreground">{r.pan_no || ""}</p>
                          </TableCell>
                          <TableCell>
                            <SupplierStatusBadge status={r.status} />
                            {pendingLine(r) && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">{pendingLine(r)}</p>}
                            {lastActionLine(r) && <p className="mt-1 text-xs text-muted-foreground">{lastActionLine(r)}</p>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            <p>{formatDate(r.created_date) ?? "—"}</p>
                            <p>{r.created_by_name || r.created_by || ""}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Phones: cards */}
                <div className="space-y-2 md:hidden">
                  {visible.map((r) => (
                    <button
                      key={`${r.source}-${r.record_id}`}
                      onClick={() => open(r)}
                      className="w-full space-y-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn("truncate text-sm font-semibold", !r.company_name && "italic text-muted-foreground")}>{displayName(r)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {r.supp_code && <span className="font-mono text-[11px] text-muted-foreground">{r.supp_code}</span>}
                            <CategoryChip category={r.category} />
                          </div>
                        </div>
                        <SupplierStatusBadge status={r.status} />
                      </div>
                      {pendingLine(r) && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{pendingLine(r)}</p>}
                      {lastActionLine(r) && <p className="text-xs text-muted-foreground">{lastActionLine(r)}</p>}
                      <p className="text-[11px] text-muted-foreground">
                        Submitted {formatDate(r.created_date) ?? "—"}{r.created_by_name ? ` by ${r.created_by_name}` : ""}
                      </p>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {rows.length} supplier{rows.length === 1 ? "" : "s"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="pr-12">
            <SheetTitle className="capitalize">{selected ? displayName(selected) : ""}</SheetTitle>
            <SheetDescription>Where this supplier's approval stands — who has acted and who is next.</SheetDescription>
          </SheetHeader>
          {selected && <SupplierDetail key={`${selected.source}-${selected.record_id}`} row={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SupplierStatusPage;
