import React, { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ExternalLink, FileText, GitCompare, History, ReceiptText, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import useFetch from '@/hooks/useFetchHook';
import { getServiceAgreementHistory } from '@/Services/Api';
import {
  Callout, Fact, FactGrid, StatusPill, SupplierSplitTable, TypeBadge,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  AGREEMENT_STATUS, CYCLE_STATUS, DAY_COUNT_LABEL, HISTORY_EVENT, VERSION_ACTION, VERSION_OUTCOME,
  diffTerms, facilityLabel, formatDate, formatINR, ordinalDay, statusMeta,
  type AgreementTerms,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

interface HistoryEvent { action_type: string; status_by?: string | null; comment?: string | null; created_at: string }

interface HistoryVersion {
  version_no: number;
  action_type: string;
  outcome: string;
  period_start_date: string;
  period_end_date: string;
  submitted_by?: string | null;
  submitted_at: string;
  decided_at?: string | null;
  superseded_at?: string | null;
  note?: string | null;
  terms: AgreementTerms;
  events?: HistoryEvent[] | null;
}

interface HistoryCycle {
  cycle_sno: number;
  billing_period_start: string;
  qty?: number | null;
  net_cost?: number | null;
  status: string;
  entered_by?: string | null;
  suppliers?: { vendor_sno: number; vendor_name?: string | null; share_pct: number; rate_amount: number; net_cost: number; po_no?: string | null }[] | null;
}

interface HistoryData {
  agreement_no: string;
  status: string;
  service_name: string;
  service_type_code: string;
  versions: HistoryVersion[];
  cycles: HistoryCycle[];
}

const dateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const dayKey = (v: string) => v.slice(0, 10);

// ─── One version ───────────────────────────────────────────────────────────

const VersionCard: React.FC<{
  version: HistoryVersion; previous?: HistoryVersion; isCurrent: boolean; isLast: boolean; defaultOpen: boolean;
}> = ({ version, previous, isCurrent, isLast, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const outcome = statusMeta(VERSION_OUTCOME, version.outcome);
  const t = useMemo<AgreementTerms>(() => version.terms ?? {}, [version.terms]);
  const changes = useMemo(() => diffTerms(previous?.terms, t), [previous, t]);
  const suppliers = t.suppliers ?? [];
  const stat = t.statutory ?? null;

  return (
    <li className="relative pl-8">
      {!isLast && <span aria-hidden className="absolute left-[11px] top-6 bottom-[-1rem] w-px bg-border" />}
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card text-[10px] font-bold',
          isCurrent ? 'border-primary text-primary ring-4 ring-primary/15' : 'border-border text-muted-foreground',
        )}
      >
        {version.version_no}
      </span>

      <div className="rounded-xl border bg-card shadow-xs">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start gap-3 rounded-xl p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-4"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold">Version {version.version_no}</span>
              <StatusPill tone={version.action_type === 'RENEWED' ? 'violet' : 'primary'}>{VERSION_ACTION[version.action_type] ?? version.action_type}</StatusPill>
              <StatusPill tone={outcome.tone}>{outcome.label}</StatusPill>
              {isCurrent && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">Current</span>}
            </div>
            <p className="text-sm font-medium">{formatDate(version.period_start_date)} – {formatDate(version.period_end_date)}</p>
            <p className="text-xs text-muted-foreground">
              Submitted by {version.submitted_by ?? '—'} on {dateTime(version.submitted_at)}
              {version.superseded_at && ` · replaced ${formatDate(version.superseded_at)}`}
            </p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat?.facility_type ? 'Sanctioned' : 'Rate'}</p>
            <p className="text-sm font-bold tabular-nums">
              {stat?.facility_type ? formatINR(stat.sanctioned_amount) : t.rate_amount != null ? formatINR(t.rate_amount) : '—'}
            </p>
          </div>
          <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="@container space-y-4 border-t px-3.5 py-4 sm:px-4">
            {version.note && <Callout tone="neutral">{version.note}</Callout>}

            {changes.length > 0 && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/20 dark:bg-violet-500/5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  <GitCompare className="h-3.5 w-3.5" /> Changed from version {previous?.version_no}
                </p>
                <ul className="space-y-1.5 text-sm">
                  {changes.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{c.label}</span>
                      {c.note ? <span className="text-muted-foreground">{c.note}</span> : (
                        <span className="tabular-nums">
                          <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.from}</span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="font-semibold">{c.to}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FactGrid>
              <Fact label="Service">{t.service_name ?? '—'}</Fact>
              <Fact label="Quantity">{t.qty ?? '—'}</Fact>
              {!stat?.facility_type && <Fact label="Rate">{t.rate_amount != null ? `${formatINR(t.rate_amount)}${t.rate_uom_name ? ` / ${t.rate_uom_name}` : ''}` : '—'}</Fact>}
              {!stat?.facility_type && <Fact label="Recurrence">{t.cadence_name ?? '—'}</Fact>}
              {!stat?.facility_type && <Fact label="PO generation day">{t.po_generation_day ?? '—'}</Fact>}
              {!stat?.facility_type && <Fact label="Notify before">{t.notify_days_before != null ? `${t.notify_days_before} day${Number(t.notify_days_before) === 1 ? '' : 's'}` : '—'}</Fact>}
              {t.ceiling_amount != null && <Fact label="Ceiling per cycle">{formatINR(t.ceiling_amount)}</Fact>}
              {version.decided_at && <Fact label="Decided">{dateTime(version.decided_at)}</Fact>}
            </FactGrid>

            {suppliers.length > 0 && !stat?.facility_type && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Suppliers</p>
                <SupplierSplitTable
                  suppliers={suppliers.map((s) => ({ vendor_name: s.vendor_name, amount: s.share_amount, pct: s.share_pct }))}
                  amountLabel="Amount per cycle"
                />
              </div>
            )}

            {stat?.facility_type && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Loan details</p>
                <FactGrid>
                  {suppliers[0]?.vendor_name && <Fact label="Lender">{suppliers[0].vendor_name}</Fact>}
                  <Fact label="Type">{facilityLabel(stat.facility_type)}</Fact>
                  {stat.facility_ref_no && <Fact label="Reference">{stat.facility_ref_no}</Fact>}
                  <Fact label="Sanctioned">{formatINR(stat.sanctioned_amount)}</Fact>
                  {stat.drawing_power != null && <Fact label="Drawing power">{formatINR(stat.drawing_power)}</Fact>}
                  {stat.disbursed_amount != null && <Fact label="Disbursed">{formatINR(stat.disbursed_amount)}</Fact>}
                  {stat.disbursement_date && <Fact label="Interest starts">{formatDate(stat.disbursement_date)}</Fact>}
                  <Fact label="Rate type">{stat.rate_type === 'FLOATING' ? `Floating (${stat.benchmark_name ?? 'Repo'}-linked)` : 'Fixed'}</Fact>
                  {stat.rate_type === 'FLOATING' && <Fact label={`${stat.benchmark_name ?? 'Repo'} + spread`}>{stat.benchmark_rate_pct}% + {stat.spread_pct}%</Fact>}
                  <Fact label="Interest rate">{stat.interest_rate_pct}%</Fact>
                  {stat.interest_payment_day != null && <Fact label="Interest paid on">{ordinalDay(stat.interest_payment_day)} of the month</Fact>}
                  {stat.day_count_basis != null && <Fact label="Day-count basis">{DAY_COUNT_LABEL[String(stat.day_count_basis)] ?? '—'}</Fact>}
                </FactGrid>
              </div>
            )}

            {(t.remarks || t.terms_conditions) && (
              <div className="space-y-3">
                {t.remarks && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><StickyNote className="h-3 w-3" />Remarks</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{t.remarks}</p>
                  </div>
                )}
                {t.terms_conditions && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Terms &amp; conditions</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{t.terms_conditions}</p>
                  </div>
                )}
              </div>
            )}

            {t.agreement_doc_url && (
              <a
                href={t.agreement_doc_url} target="_blank" rel="noreferrer"
                className="group flex items-center gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-sm font-medium">Agreement document for this version</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              </a>
            )}

            {(version.events?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Approval trail</p>
                <ol className="space-y-2">
                  {version.events!.map((e, i) => {
                    const meta = statusMeta(HISTORY_EVENT, e.action_type);
                    return (
                      <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                        <span className="text-xs text-muted-foreground">{e.status_by ?? '—'} · {dateTime(e.created_at)}</span>
                        {e.comment && <p className="basis-full break-words pl-1 text-xs text-foreground/80">“{e.comment}”</p>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

// ─── Cycles ────────────────────────────────────────────────────────────────

const CyclesList: React.FC<{ cycles: HistoryCycle[]; versions: HistoryVersion[] }> = ({ cycles, versions }) => {
  if (cycles.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No cycles have been raised for this agreement yet.</p>;
  }
  const versionFor = (d: string) => versions.find((v) => dayKey(v.period_start_date) <= dayKey(d) && dayKey(d) <= dayKey(v.period_end_date))?.version_no;
  return (
    <ul className="space-y-3">
      {cycles.map((c) => {
        const status = statusMeta(CYCLE_STATUS, c.status);
        const v = versionFor(c.billing_period_start);
        const suppliers = c.suppliers ?? [];
        return (
          <li key={c.cycle_sno} className="rounded-xl border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{formatDate(c.billing_period_start)}</span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                {v != null && <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">v{v}</span>}
              </div>
              <span className="text-sm font-bold tabular-nums">{c.net_cost != null ? formatINR(c.net_cost) : <span className="text-xs font-normal text-muted-foreground">Awaiting entry</span>}</span>
            </div>
            {suppliers.length > 0 && (
              <ul className="mt-3 divide-y rounded-lg border text-sm">
                {suppliers.map((s) => (
                  <li key={s.vendor_sno} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-2">
                    <span className="min-w-0 truncate font-medium">{s.vendor_name ?? '—'}</span>
                    <span className="flex items-center gap-3 text-xs">
                      {s.po_no ? <span className="inline-flex items-center gap-1 text-muted-foreground"><ReceiptText className="h-3 w-3" />{s.po_no}</span> : <span className="text-muted-foreground">PO not raised</span>}
                      <span className="font-semibold tabular-nums text-foreground">{formatINR(s.net_cost)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};

// ─── Dialog ────────────────────────────────────────────────────────────────

export const AgreementHistoryDialog: React.FC<{
  agreement: { agreement_sno: number; agreement_no: string; service_type_code: string; status: string };
  onClose: () => void;
}> = ({ agreement, onClose }) => {
  const { data, loading, error } = useFetch<{ success: boolean; data: HistoryData }>(
    getServiceAgreementHistory, '', { agreement_sno: agreement.agreement_sno },
  );
  const history = data?.data;
  const versions = history?.versions ?? [];
  const cycles = history?.cycles ?? [];
  const status = statusMeta(AGREEMENT_STATUS, history?.status ?? agreement.status);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            History · {agreement.agreement_no}
            <TypeBadge type={agreement.service_type_code} />
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </DialogTitle>
          <DialogDescription>
            Every version of this agreement — its terms, suppliers and approvals — and the purchase orders raised under it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          {loading && (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          )}
          {!loading && error && <Callout tone="danger">Couldn’t load the history: {error}</Callout>}
          {!loading && !error && history && (
            <Tabs defaultValue="versions" className="gap-4">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="versions" className="sm:px-4">Versions ({versions.length})</TabsTrigger>
                <TabsTrigger value="cycles" className="sm:px-4">Cycles &amp; POs ({cycles.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="versions">
                {versions.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No versions recorded.</p>
                ) : (
                  <ol className="space-y-4">
                    {versions.map((v, i) => (
                      <VersionCard
                        key={v.version_no}
                        version={v}
                        previous={versions[i + 1]}
                        isCurrent={i === 0}
                        isLast={i === versions.length - 1}
                        defaultOpen={i === 0}
                      />
                    ))}
                  </ol>
                )}
              </TabsContent>
              <TabsContent value="cycles"><CyclesList cycles={cycles} versions={versions} /></TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
