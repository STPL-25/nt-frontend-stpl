import type { PayableBillNet, PaymentInvoiceFigures } from '@/Services/GrnService/paymentNetApi';

// Pure helpers behind part payments (sql/70): how much of a bill can be paid today, what the person entering a payment (or the
// approver) typed, and what is left. The server decides everything that matters - these only keep the screen from sending a
// number it already knows will be refused, and say in words what a part payment leaves behind.

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v) || 0;

/** The most that can be paid on a bill today: what is outstanding, less the GST kept back until the invoice shows in GSTR-2B. */
export const payCap = (b: Pick<PayableBillNet, 'outstanding' | 'payable_now'>): number =>
  Math.max(0, round2(b.payable_now === undefined || b.payable_now === null ? num(b.outstanding) : num(b.payable_now)));

/** A bill that is not in 2B yet is closed to payment unless part of it (its taxable value) can be paid now. */
export const heldBy2b = (b: Pick<PayableBillNet, 'on_hold_2b' | 'outstanding' | 'payable_now'>): boolean =>
  !!b.on_hold_2b && (b.payable_now === undefined || b.payable_now === null || payCap(b) <= 0.005);

/** Text typed into an amount box -> number (NaN when it is not a number). */
export const parseAmount = (raw: string | undefined): number => (raw === undefined || raw.trim() === '' ? NaN : Number(raw.replace(/,/g, '')));

/** Amount to pay now on a bill: what was typed, else the most that can be paid. */
export const amountOf = (b: PayableBillNet, typed: Record<number, string>): number => {
  const raw = typed[b.bill_sno];
  if (raw === undefined) return payCap(b);
  const n = parseAmount(raw);
  return Number.isFinite(n) ? round2(n) : 0;
};

/** Why the amount typed for a bill cannot be saved (empty = fine). */
export const amountProblem = (b: PayableBillNet, typed: Record<number, string>): string => {
  const raw = typed[b.bill_sno];
  if (raw === undefined) return '';
  const n = parseAmount(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Enter the amount to pay now';
  const cap = payCap(b);
  if (n > cap + 0.005) {
    return num(b.outstanding) > cap + 0.005
      ? `At most ${cap.toFixed(2)} now - the GST part follows once the invoice is in GSTR-2B`
      : `At most ${cap.toFixed(2)} is left on this invoice`;
  }
  return '';
};

/** Full or part, in words, for a bill that will have `pay` paid on it now. */
export const billKind = (b: PayableBillNet, pay: number): { part: boolean; left: number } => {
  const left = round2(num(b.outstanding) - pay);
  return { part: left > 0.005 || num(b.paid_amount) + num(b.reserved_amount) > 0.005, left: Math.max(0, left) };
};

/**
 * Advances are filled in up to what is being paid. When the amount to pay comes down (a part payment), take the excess off the newest
 * advance first so the payment does not try to net off more than it pays.
 */
export const clampAdvances = (adv: Record<number, string>, room: number): Record<number, string> => {
  let over = round2(Object.values(adv).reduce((t, v) => t + (Number(v) || 0), 0) - Math.max(0, room));
  if (over <= 0.005) return adv;
  const next = { ...adv };
  for (const key of Object.keys(next).map(Number).sort((a, b) => b - a)) {
    if (over <= 0.005) break;
    const cur = Number(next[key]) || 0;
    const cut = Math.min(cur, over);
    next[key] = cut >= cur ? '' : String(round2(cur - cut));
    over = round2(over - cut);
  }
  return next;
};

/** What the approver typed for each invoice -> why it cannot be sent (empty = fine). `typed` holds only the invoices that were edited. */
export const reduceProblem = (fig: PaymentInvoiceFigures[], typed: Record<number, string>): string => {
  let changed = false;
  let anyLeft = false;
  for (const f of fig) {
    const raw = typed[f.invoice_sno];
    const n = raw === undefined ? num(f.this_amount) : parseAmount(raw);
    if (!Number.isFinite(n) || n < 0) return `Enter an amount for ${f.invoice_no} (0 leaves it out of this payment)`;
    if (n > num(f.this_amount) + 0.005) return `${f.invoice_no}: the payment was saved for ${num(f.this_amount).toFixed(2)} - it can only be reduced`;
    if (n < num(f.this_amount) - 0.005) changed = true;
    if (n > 0.005) anyLeft = true;
  }
  if (!anyLeft) return 'Not every invoice can be left out - reject or cancel the payment instead';
  return changed ? '' : 'Nothing is reduced yet';
};

/** One line saying what a payment on an invoice leaves behind. */
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const leftLine = (balance: number, onHold2b: boolean, hold2b = 0): string => {
  if (balance <= 0.005) return 'Nothing left on this invoice';
  const gst = onHold2b && hold2b > 0.005 ? ` (of which ${inr(hold2b)} GST waits for GSTR-2B)` : '';
  return `${inr(balance)} stays on the invoice${gst}`;
};
