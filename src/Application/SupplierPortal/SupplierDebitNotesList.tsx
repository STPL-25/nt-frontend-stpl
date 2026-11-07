import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ReceiptText, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetailHero, Fact, FactGrid, FilterChips, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { TONE, type Tone } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { cn } from '@/lib/utils';
import {
  supplierAxios,
  supplierGetDebitNotes,
  supplierGetDebitNoteDetail,
  supplierGetCreditNotes,
  supplierGetCreditNoteDetail,
  parseSupplierDebitNoteItems,
  type SupplierDebitNoteListItem,
  type SupplierCreditNoteListItem,
} from '@/Services/SupplierService';
import { formatDate, formatINR } from './helpers';
import { InvoiceLedgerPanel, LedgerFileList, LedgerUploadButton } from './SupplierNoteLedgerParts';
import { useNoteLedgers, type NoteLedgers } from './useNoteLedgers';
import { groupNotesByInvoice, ledgersForNote, targetKey } from './supplierNoteLedgerModel';

type Kind = 'DEBIT' | 'CREDIT';
type Filter = 'ALL' | Kind;

/** One debit or credit note, in the shape the list works with. */
interface Note {
  kind: Kind;
  sno: number;
  no: string;
  po_no: string;
  grn_no: string;
  invoice: string | null;
  date: string;
  total_amount: number;
  remarks: string | null;
  status: string;
}
/** An item line - debit and credit notes carry the same columns. */
interface NoteItem {
  key: number;
  prod_name: string;
  specification: string | null;
  unit_name: string | null;
  reason_type: string;
  qty: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
}

const REASON_TONE: Record<string, Tone> = { Damage: 'danger', Shortage: 'warning', Return: 'info', Excess: 'success' };
const th = 'h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

const fromDebit = (n: SupplierDebitNoteListItem): Note => ({
  kind: 'DEBIT', sno: n.debit_note_sno, no: n.debit_note_no, po_no: n.po_no, grn_no: n.grn_no, invoice: n.vendor_invoice_no,
  date: n.debit_note_date, total_amount: Number(n.total_amount) || 0, remarks: n.remarks, status: n.status,
});
const fromCredit = (n: SupplierCreditNoteListItem): Note => ({
  kind: 'CREDIT', sno: n.credit_note_sno, no: n.credit_note_no, po_no: n.po_no, grn_no: n.grn_no, invoice: n.vendor_invoice_no,
  date: n.credit_note_date, total_amount: Number(n.total_amount) || 0, remarks: n.remarks, status: n.status,
});

const loadItems = async (note: Note): Promise<NoteItem[]> => {
  if (note.kind === 'DEBIT') {
    const res = await supplierAxios.get(supplierGetDebitNoteDetail(note.sno));
    return parseSupplierDebitNoteItems(res.data?.data?.items ?? []).map((i) => ({ ...i, key: i.debit_note_item_sno }));
  }
  const res = await supplierAxios.get(supplierGetCreditNoteDetail(note.sno));
  const raw = res.data?.data?.items;
  const list: NoteItem[] = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw ?? '[]'); } catch { return []; } })();
  return list.map((i: NoteItem & { credit_note_item_sno?: number }) => ({ ...i, key: i.credit_note_item_sno ?? i.key }));
};

/** Ledger of one note: the files uploaded for it, those of its invoice that cover it, and the upload button. */
const NoteLedgerStrip: React.FC<{ note: Note; ledgers: NoteLedgers }> = ({ note, ledgers }) => {
  const { own, viaInvoice } = ledgersForNote(ledgers.ledgers, note);
  const target = { scope: 'NOTE', note_kind: note.kind, note_sno: note.sno } as const;
  return (
    <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Ledger</p>
          <p className="text-xs text-muted-foreground">
            {note.invoice ? `Upload one for this note, or one for invoice ${note.invoice} above to cover all its notes.` : 'Upload your ledger for this note.'}
          </p>
        </div>
        <LedgerUploadButton
          label="Upload ledger for this note"
          busy={ledgers.busyKey === targetKey(target)}
          disabled={ledgers.busyKey != null}
          onPick={(file) => ledgers.upload(target, file)}
        />
      </div>
      {own.length > 0 && <LedgerFileList files={own} onRemove={ledgers.remove} busyKey={ledgers.busyKey} />}
      {viaInvoice.length > 0 && <LedgerFileList files={viaInvoice} tag={() => `Invoice ${note.invoice}`} />}
      {own.length === 0 && viaInvoice.length === 0 && <p className="text-xs text-muted-foreground">No ledger uploaded yet.</p>}
    </div>
  );
};

const NoteRow: React.FC<{ note: Note; ledgers: NoteLedgers }> = ({ note, ledgers }) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [items, setItems] = useState<NoteItem[] | null>(null);
  const debit = note.kind === 'DEBIT';

  const toggle = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (items) return;
    setLoadingItems(true);
    try {
      setItems(await loadItems(note));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? `Failed to load ${debit ? 'debit' : 'credit'} note items`);
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <div className="p-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{note.no}</span>
            <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE[debit ? 'danger' : 'success'])}>
              {debit ? 'Debit note' : 'Credit note'}
            </span>
            <StatusPill tone={debit ? 'danger' : 'success'}>{note.status}</StatusPill>
          </div>
          <FactGrid className="@4xl:grid-cols-5">
            <Fact label="PO">{note.po_no}</Fact>
            <Fact label="GRN">{note.grn_no}</Fact>
            <Fact label="Invoice">{note.invoice || '—'}</Fact>
            <Fact label="Date">{formatDate(note.date)}</Fact>
            <Fact label={debit ? 'Deducted' : 'Added'}>
              <span className={cn('tabular-nums', debit ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300')}>
                {debit ? '- ' : '+ '}{formatINR(note.total_amount)}
              </span>
            </Fact>
          </FactGrid>
          {note.remarks && <p className="text-xs text-muted-foreground">Note: {note.remarks}</p>}
          <NoteLedgerStrip note={note} ledgers={ledgers} />
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={toggle}>
          {expanded ? <><ChevronUp size={13} className="mr-1" /> Hide</> : <><ChevronDown size={13} className="mr-1" /> Items</>}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 overflow-x-auto rounded-lg border">
          {loadingItems ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Loading items…</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={th}>Item</TableHead>
                  <TableHead className={th}>Reason</TableHead>
                  <TableHead className={cn(th, 'text-center')}>Qty</TableHead>
                  <TableHead className={cn(th, 'text-right')}>Unit price</TableHead>
                  <TableHead className={cn(th, 'text-right')}>Amount</TableHead>
                  <TableHead className={th}>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items ?? []).map((item) => (
                  <TableRow key={item.key}>
                    <TableCell>
                      <p className="text-sm font-medium">{item.prod_name}</p>
                      {item.specification && <p className="text-xs text-muted-foreground">{item.specification}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium', TONE[REASON_TONE[item.reason_type] ?? 'neutral'])}>
                        {item.reason_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-xs">{item.qty} {item.unit_name}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatINR(item.unit_price)}</TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">{formatINR(item.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.remarks || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Debit and credit notes together. A debit note (damaged / short / returned goods) is taken off what the supplier is paid; a credit
 * note (more received than invoiced) is added to it. Same hero + panel layout as the staff screens.
 */
const SupplierDebitNotesList: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const ledgers = useNoteLedgers();
  const { load: loadLedgers } = ledgers;

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    loadLedgers();   // the uploaded ledgers load beside the notes; a failure there must not hide the notes
    try {
      // each list loads on its own: one failing must not hide the other
      const [debits, credits] = await Promise.allSettled([supplierAxios.get(supplierGetDebitNotes), supplierAxios.get(supplierGetCreditNotes)]);
      const merged: Note[] = [];
      if (debits.status === 'fulfilled') merged.push(...((debits.value.data?.data ?? []) as SupplierDebitNoteListItem[]).map(fromDebit));
      else toast.error((debits.reason as any)?.response?.data?.error ?? 'Failed to load debit notes');
      if (credits.status === 'fulfilled') merged.push(...((credits.value.data?.data ?? []) as SupplierCreditNoteListItem[]).map(fromCredit));
      else toast.error((credits.reason as any)?.response?.data?.error ?? 'Failed to load credit notes');
      merged.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.sno - a.sno);
      setNotes(merged);
    } finally {
      setLoading(false);
    }
  }, [loadLedgers]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const debits = notes.filter((n) => n.kind === 'DEBIT');
  const credits = notes.filter((n) => n.kind === 'CREDIT');
  const invoiceGroups = useMemo(
    () => groupNotesByInvoice(notes.map((n) => ({ kind: n.kind, sno: n.sno, invoice: n.invoice, date: n.date, total_amount: n.total_amount }))),
    [notes],
  );
  const sum = (list: Note[]) => list.reduce((s, n) => s + n.total_amount, 0);
  const net = sum(credits) - sum(debits);
  const shown = useMemo(() => notes.filter((n) => filter === 'ALL' || n.kind === filter), [notes, filter]);

  return (
    <div className="@container">
      <div className="space-y-4 px-3 py-4 sm:px-5">
        <DetailHero
          icon={ReceiptText}
          eyebrow="Supplier portal"
          title="Debit / Credit Notes"
          subtitle="Debit notes (damaged, short or returned goods) are deducted from what you are paid; credit notes (more received than invoiced) are added"
          metrics={[
            { label: `Debit notes (${debits.length})`, value: `- ${formatINR(sum(debits))}`, valueClassName: 'text-red-600 dark:text-red-400' },
            { label: `Credit notes (${credits.length})`, value: `+ ${formatINR(sum(credits))}`, valueClassName: 'text-emerald-700 dark:text-emerald-300' },
            {
              label: 'Net effect on your payments', value: `${net < 0 ? '- ' : net > 0 ? '+ ' : ''}${formatINR(Math.abs(net))}`,
              valueClassName: net < 0 ? 'text-red-600 dark:text-red-400' : net > 0 ? 'text-emerald-700 dark:text-emerald-300' : undefined,
            },
          ]}
        />

        <InvoiceLedgerPanel groups={invoiceGroups} ledgers={ledgers} />

        <Panel icon={ReceiptText} title={`Notes (${shown.length})`} bodyClassName="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5">
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All', count: notes.length },
                { value: 'DEBIT', label: 'Debit notes', count: debits.length },
                { value: 'CREDIT', label: 'Credit notes', count: credits.length },
              ]}
            />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={fetchNotes} disabled={loading} aria-label="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          {loading && notes.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {notes.length === 0
                ? 'No debit or credit notes - they appear here when goods are damaged, short, returned or received in excess.'
                : `No ${filter === 'DEBIT' ? 'debit' : 'credit'} notes.`}
            </p>
          ) : (
            <div className="divide-y">
              {shown.map((note) => <NoteRow key={`${note.kind}-${note.sno}`} note={note} ledgers={ledgers} />)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default SupplierDebitNotesList;
