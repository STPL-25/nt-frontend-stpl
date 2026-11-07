/**
 * Pure rules for the ledger uploads on the supplier portal's Debit / Credit Notes screen (sql/87_supplier_note_ledger.sql).
 * A ledger is attached to ONE note, or to an INVOICE - and an invoice ledger covers every debit and credit note on that invoice.
 * Kept free of React / axios so the grouping and matching can be unit-tested.
 */
import type { SupplierNoteLedger } from '@/Services/SupplierService';

export type NoteKind = 'DEBIT' | 'CREDIT';

/** The part of a note the ledger rules need. */
export interface LedgerNoteRef {
  kind: NoteKind;
  sno: number;
  /** the supplier's invoice number on the note (from the gate entry); null / blank when there is none */
  invoice: string | null;
  date: string;
  total_amount: number;
}

export const LEDGER_MAX_MB = 10;
/** a supplier's ledger usually arrives as a PDF, a scan / photo, or an Excel / CSV export (grn-service accepts the same list) */
export const LEDGER_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xls', '.xlsx', '.csv'];
export const LEDGER_ACCEPT = LEDGER_EXTENSIONS.join(',');

/** Same invoice however it was typed: case and surrounding spaces do not matter. '' = the note has no invoice. */
export const invoiceKey = (invoice?: string | null): string => (invoice ?? '').trim().toUpperCase();

/** null when the file can be uploaded, else the reason it cannot. */
export function checkLedgerFile(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!LEDGER_EXTENSIONS.includes(ext)) return 'The ledger must be a PDF, an image, or an Excel / CSV file.';
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > LEDGER_MAX_MB * 1024 * 1024) return `The ledger file must be under ${LEDGER_MAX_MB} MB.`;
  return null;
}

/** One invoice with the debit / credit notes on it. */
export interface InvoiceGroup {
  key: string;
  /** the invoice number as the first note spells it */
  invoice_no: string;
  debit_count: number;
  credit_count: number;
  debit_total: number;
  credit_total: number;
  /** credit - debit: what these notes do to the supplier's payment (negative = deducted) */
  net: number;
  latest_date: string;
}

/** Notes grouped by invoice, newest first. Notes with no invoice number are left out - they can only take a per-note ledger. */
export function groupNotesByInvoice(notes: LedgerNoteRef[]): InvoiceGroup[] {
  const groups = new Map<string, InvoiceGroup>();
  for (const n of notes) {
    const key = invoiceKey(n.invoice);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { key, invoice_no: (n.invoice ?? '').trim(), debit_count: 0, credit_count: 0, debit_total: 0, credit_total: 0, net: 0, latest_date: n.date };
      groups.set(key, g);
    }
    if (n.kind === 'DEBIT') { g.debit_count += 1; g.debit_total += n.total_amount; }
    else { g.credit_count += 1; g.credit_total += n.total_amount; }
    if (String(n.date) > String(g.latest_date)) g.latest_date = n.date;
  }
  const list = [...groups.values()].map((g) => ({ ...g, net: g.credit_total - g.debit_total }));
  return list.sort((a, b) => String(b.latest_date).localeCompare(String(a.latest_date)) || a.key.localeCompare(b.key));
}

/** Ledgers uploaded against this exact invoice (they cover all of its notes). */
export function ledgersForInvoice(ledgers: SupplierNoteLedger[], invoice: string | null | undefined): SupplierNoteLedger[] {
  const key = invoiceKey(invoice);
  if (!key) return [];
  return ledgers.filter((l) => l.scope === 'INVOICE' && invoiceKey(l.invoice_no) === key);
}

/** What backs one note: ledgers uploaded for the note itself, and the invoice ledgers that cover it. */
export function ledgersForNote(ledgers: SupplierNoteLedger[], note: Pick<LedgerNoteRef, 'kind' | 'sno' | 'invoice'>): {
  own: SupplierNoteLedger[];
  viaInvoice: SupplierNoteLedger[];
} {
  return {
    own: ledgers.filter((l) => l.scope === 'NOTE' && l.note_kind === note.kind && l.note_sno === note.sno),
    viaInvoice: ledgersForInvoice(ledgers, note.invoice),
  };
}

/** Identifies one upload slot (a note, or an invoice) so the screen can show which button is busy. */
export const targetKey = (t: { scope: 'NOTE'; note_kind: NoteKind; note_sno: number } | { scope: 'INVOICE'; invoice_no: string }): string =>
  t.scope === 'NOTE' ? `n-${t.note_kind}-${t.note_sno}` : `i-${invoiceKey(t.invoice_no)}`;
