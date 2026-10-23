import type { NoteKind, PaymentAdjustments, PendingNote } from '@/Services/GrnService/paymentNetApi';

// Pure helpers behind the debit / credit note part of the Payment page. Which notes may be redeemed on which bill is decided
// by the server (sql/64): a note raised against a bill that is already paid in full - or against a PO whose invoice is not
// entered yet - is offered on every bill of the supplier, one raised against a bill still open only with that bill. The page
// asks again whenever the ticked invoices change, and a payment released elsewhere takes its notes off this screen at once.

/** Invoices (not payment buckets) behind the ticked bills - what the server needs to work out which notes are on offer. */
export const invoiceSnosOf = (bills: { invoice_sno: number }[]): number[] =>
  [...new Set(bills.map((b) => b.invoice_sno))].sort((a, b) => a - b);

/** Keep only the ticks whose note is still on offer (the offer changes with the bills ticked and with other users' payments). */
export const keepOffered = (picked: Set<number>, offered: PendingNote[]): Set<number> => {
  const ids = new Set(offered.map((n) => n.note_sno));
  return new Set([...picked].filter((id) => ids.has(id)));
};

/** Keep the ticked bills that can still be paid after a refresh (someone else may have paid some of them meanwhile). */
export const stillPayable = (selected: Set<number>, bills: { bill_sno: number }[]): Set<number> => {
  const ids = new Set(bills.map((b) => b.bill_sno));
  return new Set([...selected].filter((id) => ids.has(id)));
};

/** Take the notes a payment just redeemed out of the adjustments on screen; `dropped` is what was actually on offer here. */
export const withoutRedeemed = (
  adj: PaymentAdjustments,
  redeemed: { type: NoteKind; note_sno: number }[],
): { adj: PaymentAdjustments; dropped: PendingNote[] } => {
  const isGone = (kind: NoteKind, n: PendingNote) => redeemed.some((r) => r.type === kind && Number(r.note_sno) === n.note_sno);
  return {
    adj: {
      ...adj,
      debitNotes: adj.debitNotes.filter((n) => !isGone('DEBIT', n)),
      creditNotes: adj.creditNotes.filter((n) => !isGone('CREDIT', n)),
    },
    dropped: [...adj.debitNotes.filter((n) => isGone('DEBIT', n)), ...adj.creditNotes.filter((n) => isGone('CREDIT', n))],
  };
};

/** One line saying why a note is on offer on this payment. */
export const noteSourceLine = (n: PendingNote): string | null => {
  if (n.source_invoices) {
    return n.scope === 'SUPPLIER'
      ? `Supplier credit - raised against paid bill ${n.source_invoices}`
      : `Raised against this bill - ${n.source_invoices}`;
  }
  // no bill behind it: raised on a PO whose supplier invoice has not been entered yet
  return n.scope === 'SUPPLIER' ? 'Supplier credit - its invoice is not entered yet' : null;
};
