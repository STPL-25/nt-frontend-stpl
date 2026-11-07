import React, { useRef } from 'react';
import { FileSpreadsheet, FileText, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Fact, FactGrid, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { cn } from '@/lib/utils';
import type { SupplierNoteLedger, SupplierNoteLedgerTarget } from '@/Services/SupplierService';
import { formatDate, formatINR } from './helpers';
import { LEDGER_ACCEPT, LEDGER_MAX_MB, ledgersForInvoice, targetKey, type InvoiceGroup } from './supplierNoteLedgerModel';
import type { NoteLedgers } from './useNoteLedgers';

/** A button that opens the file picker; hands the chosen file to `onPick`. */
export const LedgerUploadButton: React.FC<{ label: string; busy: boolean; disabled?: boolean; onPick: (file: File) => void }> = ({ label, busy, disabled, onPick }) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={LEDGER_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';   // picking the same file again must still fire
          if (file) onPick(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 text-xs"
        disabled={busy || disabled}
        title={`PDF, image, Excel or CSV - up to ${LEDGER_MAX_MB} MB`}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
        {busy ? 'Uploading…' : label}
      </Button>
    </>
  );
};

/** Uploaded files as links. Pass `onRemove` to let the supplier take one off; `tag` marks where a file came from. */
export const LedgerFileList: React.FC<{
  files: SupplierNoteLedger[];
  tag?: (file: SupplierNoteLedger) => string | null;
  onRemove?: (file: SupplierNoteLedger) => void;
  busyKey?: string | null;
}> = ({ files, tag, onRemove, busyKey }) => (
  <ul className="space-y-1.5">
    {files.map((f) => {
      const label = tag?.(f);
      const removing = busyKey === `rm-${f.ledger_sno}`;
      return (
        <li key={f.ledger_sno} className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
          <a
            href={f.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 font-medium text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{f.file_name || 'Ledger'}</span>
          </a>
          <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
            {label && <span className="hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline">{label}</span>}
            <span className="tabular-nums">{formatDate(f.uploaded_date)}</span>
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${f.file_name || 'ledger'}`}
                className="rounded p-0.5 hover:bg-muted hover:text-foreground disabled:opacity-50"
                disabled={removing || busyKey != null}
                onClick={() => onRemove(f)}
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            )}
          </span>
        </li>
      );
    })}
  </ul>
);

const netClass = (net: number) => (net < 0 ? 'text-red-600 dark:text-red-400' : net > 0 ? 'text-emerald-700 dark:text-emerald-300' : '');

/**
 * One upload per invoice: the ledger covers every debit and credit note on it. Shown only when at least one note carries an
 * invoice number. Per-note ledgers live on each note row.
 */
export const InvoiceLedgerPanel: React.FC<{ groups: InvoiceGroup[]; ledgers: NoteLedgers }> = ({ groups, ledgers }) => {
  if (groups.length === 0) return null;
  return (
    <Panel
      icon={FileSpreadsheet}
      title={`Ledger by invoice (${groups.length})`}
      description="Upload your ledger once for an invoice - it covers every debit and credit note on that invoice. To send a ledger for a single note, use the note below."
      bodyClassName="p-0 sm:p-0"
    >
      <div className="divide-y">
        {groups.map((g) => {
          const files = ledgersForInvoice(ledgers.ledgers, g.invoice_no);
          const target: SupplierNoteLedgerTarget = { scope: 'INVOICE', invoice_no: g.invoice_no };
          return (
            <div key={g.key} className="space-y-3 p-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <FactGrid className="min-w-0 flex-1 @xl:grid-cols-3">
                  <Fact label="Invoice">{g.invoice_no}</Fact>
                  <Fact label="Notes">
                    {[g.debit_count && `${g.debit_count} debit`, g.credit_count && `${g.credit_count} credit`].filter(Boolean).join(' + ')}
                  </Fact>
                  <Fact label="Net effect">
                    <span className={cn('tabular-nums', netClass(g.net))}>{g.net < 0 ? '- ' : g.net > 0 ? '+ ' : ''}{formatINR(Math.abs(g.net))}</span>
                  </Fact>
                </FactGrid>
                <LedgerUploadButton
                  label="Upload ledger"
                  busy={ledgers.busyKey === targetKey(target)}
                  disabled={ledgers.busyKey != null}
                  onPick={(file) => ledgers.upload(target, file)}
                />
              </div>
              {files.length > 0
                ? <LedgerFileList files={files} onRemove={ledgers.remove} busyKey={ledgers.busyKey} />
                : <p className="text-xs text-muted-foreground">No ledger uploaded for this invoice yet.</p>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
