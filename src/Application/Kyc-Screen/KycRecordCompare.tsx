import React from "react";
import { Building2, Eye, FileText, Landmark, MapPin, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, StatusPill } from "@/CustomComponent/ServiceComponents/ServiceParts";
import { cn } from "@/lib/utils";
import { getAuthFileUrl } from "@/Services/authUrl";
import type { SupplierKycSnapshot } from "@/Services/SupplierService";
import { compareSnapshots, type CompareSection, type DocDiff, type FieldDiff, type RowDiff, type RowKind, type SectionKey } from "./kycCompare";

const ICON: Record<SectionKey, LucideIcon> = {
  BASIC: Building2, PAYMENT: Wallet, ADDRESS: MapPin, BANK: Landmark, CONTACT: Users, DOCUMENT: FileText,
};

const KIND: Record<RowKind, { label: string; tone: "neutral" | "success" | "danger" | "warning" }> = {
  same: { label: "No change", tone: "neutral" },
  changed: { label: "Changed", tone: "warning" },
  added: { label: "Added", tone: "success" },
  removed: { label: "Removed", tone: "danger" },
};

/** Field | Previous record | Current record. A changed value is shaded on both sides so the eye goes straight to it. */
function DiffTable({ fields }: { fields: FieldDiff[] }) {
  return (
    <div className="overflow-hidden rounded-lg border text-sm" data-testid="diff-table">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground @md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="bg-muted/60 px-2.5 py-1.5">Field</div>
        <div className="bg-muted/60 px-2.5 py-1.5">Previous record</div>
        <div className="bg-muted/60 px-2.5 py-1.5">Current record</div>
      </div>
      {fields.map((f) => (
        <div key={f.label} data-changed={f.changed} className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-px border-t bg-border @md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 bg-card px-2.5 py-1.5 text-xs text-muted-foreground">{f.label}</div>
          <div className={cn("min-w-0 [overflow-wrap:anywhere] px-2.5 py-1.5", f.changed ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200" : "bg-card")}>{f.previous}</div>
          <div className={cn("min-w-0 [overflow-wrap:anywhere] px-2.5 py-1.5", f.changed ? "bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-card")}>{f.current}</div>
        </div>
      ))}
    </div>
  );
}

function RowBlock({ row }: { row: RowDiff }) {
  const k = KIND[row.kind];
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 break-words text-sm font-semibold">{row.title}</p>
      <StatusPill tone={k.tone}>{k.label}</StatusPill>
    </div>
  );
  if (row.kind === "same") {
    return (
      <li className="rounded-lg border bg-muted/20 p-3" data-testid="diff-row" data-kind="same">
        <details>
          <summary className="cursor-pointer list-none">{head}</summary>
          <div className="mt-3"><DiffTable fields={row.fields} /></div>
        </details>
      </li>
    );
  }
  return (
    <li className="space-y-2.5 rounded-lg border bg-muted/20 p-3" data-testid="diff-row" data-kind={row.kind}>
      {head}
      <DiffTable fields={row.fields} />
    </li>
  );
}

function DocRow({ doc, onPreview }: { doc: DocDiff; onPreview?: (d: { url: string; name: string; docType?: string }) => void }) {
  const k = doc.kind === "added" ? { label: "New - current record", tone: "success" as const }
    : doc.kind === "removed" ? { label: "Replaced / removed", tone: "danger" as const }
    : { label: "Kept", tone: "neutral" as const };
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3" data-testid="diff-doc" data-kind={doc.kind}>
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.name}</p>
        <p className="text-xs text-muted-foreground">{doc.typeLabel}</p>
      </div>
      <StatusPill tone={k.tone}>{k.label}</StatusPill>
      {doc.path && onPreview && (
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs"
          onClick={() => onPreview({ url: getAuthFileUrl(doc.path), name: doc.name, docType: doc.typeLabel })}>
          <Eye className="h-3.5 w-3.5" />Preview
        </Button>
      )}
    </li>
  );
}

function SectionPanel({ section, onPreview }: { section: CompareSection; onPreview?: (d: { url: string; name: string; docType?: string }) => void }) {
  const status = section.changed ? <StatusPill tone="warning">Changed</StatusPill> : <StatusPill tone="neutral">No change</StatusPill>;
  return (
    <div data-testid={`compare-${section.key}`}>
      <Panel icon={ICON[section.key]} title={section.title} action={status}>
        {section.fields && <DiffTable fields={section.fields} />}
        {section.rows && (section.rows.length === 0
          ? <p className="text-sm text-muted-foreground">None on either record.</p>
          : <ul className="space-y-3">{section.rows.map((r) => <RowBlock key={r.id} row={r} />)}</ul>)}
        {section.documents && (section.documents.length === 0
          ? <p className="text-sm text-muted-foreground">None on either record.</p>
          : <ul className="space-y-2">{section.documents.map((d) => <DocRow key={d.id} doc={d} onPreview={onPreview} />)}</ul>)}
      </Panel>
    </div>
  );
}

/**
 * A supplier's change request as two records side by side: the KYC as it is now (Previous record) and as it will be once the request
 * is approved (Current record). Changed values are shaded; unchanged rows collapse.
 */
export default function KycRecordCompare({ previous, current, onPreview }: {
  previous: SupplierKycSnapshot | null | undefined;
  current: SupplierKycSnapshot | null | undefined;
  onPreview?: (d: { url: string; name: string; docType?: string }) => void;
}) {
  if (!previous || !current) {
    return <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">The previous and current records are not available for this request.</p>;
  }
  const sections = compareSnapshots(previous, current);
  return (
    <div className="space-y-4" data-testid="record-compare">
      {sections.map((s) => <SectionPanel key={s.key} section={s} onPreview={onPreview} />)}
    </div>
  );
}
