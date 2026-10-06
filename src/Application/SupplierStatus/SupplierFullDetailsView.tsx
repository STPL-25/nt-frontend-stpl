import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/CustomComponent/PageComponents";
import { getErrorMessage } from "@/lib/errors";
import useFetch from "@/hooks/useFetchHook";
import { apiGetSupplierFullDetails } from "@/Services/Api";
import {
  buildSections, downloadSupplierExcel, downloadSupplierPdf, type SupplierFullDetails,
} from "./supplierFullDetails";

type Format = "pdf" | "excel";

/**
 * Excel / PDF download of every detail entered for a supplier. Fetches on click so it can sit on a
 * screen (e.g. KYC approval) that does not otherwise load the full record.
 */
export function SupplierDownloadButtons({
  source, recordId, preloaded, size = "sm",
}: { source: string; recordId: number | string; preloaded?: SupplierFullDetails | null; size?: "sm" | "default" }) {
  const [busy, setBusy] = useState<Format | null>(null);

  const run = async (format: Format) => {
    setBusy(format);
    try {
      let details = preloaded ?? null;
      if (!details) {
        const res = await axios.get<{ success: boolean; data: SupplierFullDetails }>(apiGetSupplierFullDetails(source, recordId));
        details = res.data.data;
      }
      await (format === "pdf" ? downloadSupplierPdf(details) : downloadSupplierExcel(details));
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not generate the download"));
    } finally {
      setBusy(null);
    }
  };

  const icon = (f: Format, Icon: typeof FileText) => (busy === f ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />);
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size={size} className="gap-1.5" disabled={busy !== null} onClick={() => run("pdf")}>
        {icon("pdf", FileText)}Download PDF
      </Button>
      <Button type="button" variant="outline" size={size} className="gap-1.5" disabled={busy !== null} onClick={() => run("excel")}>
        {icon("excel", FileSpreadsheet)}Download Excel
      </Button>
    </div>
  );
}

/** Every address, bank account, contact and document entered for a supplier, with downloads. */
export default function SupplierFullDetailsView({ source, recordId }: { source: string; recordId: number }) {
  const { data, loading, error } = useFetch<{ success: boolean; data: SupplierFullDetails }>(apiGetSupplierFullDetails(source, recordId));
  const details = data?.data;

  if (loading) return <LoadingState message="Loading all entered details…" />;
  if (error) return <ErrorState message={error} />;
  if (!details) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Download className="h-4 w-4 text-primary" />All entered details</h3>
        <SupplierDownloadButtons source={source} recordId={recordId} preloaded={details} />
      </div>

      {buildSections(details).map((s) => (
        <section key={s.title} className="rounded-xl border bg-card p-3 shadow-sm">
          <h4 className="mb-2 text-sm font-semibold">{s.title}</h4>
          {s.kind === "facts" ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {s.facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="break-words text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : s.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">None on file.</p>
          ) : (
            // One card per entry: the tables have 9–11 columns, far too wide for the side sheet
            <ul className="space-y-2">
              {s.rows.map((row, i) => (
                <li key={i} className="rounded-lg border bg-muted/20 p-2.5">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {s.columns.map((col, c) => c === 0 ? null : (
                      <div key={col} className="min-w-0">
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{col}</dt>
                        <dd className="break-words text-sm">{row[c]}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
