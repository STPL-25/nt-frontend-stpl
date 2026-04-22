// ── A/C Double Entry Types ────────────────────────────────────────────────────

export type VoucherType = 'Journal' | 'Payment' | 'Receipt' | 'Contra' | 'Sales' | 'Purchase';

export type EntryStatus = 'Draft' | 'Posted' | 'Reversed';

export interface AccountLedger {
  ledger_sno: number;
  ledger_code: string;
  ledger_name: string;
  account_group: string;       // Assets, Liabilities, Income, Expense, Equity
  account_type: string;        // e.g. Bank, Cash, Creditor, Debtor, etc.
  opening_balance: number;
  current_balance: number;
  nature: 'Debit' | 'Credit';  // Normal balance side
}

export interface EntryLine {
  id: string;                  // local ID for React key
  ledger_sno?: number;
  ledger_code: string;
  ledger_name: string;
  account_group: string;
  description: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  entry_sno?: number;
  entry_no: string;
  entry_date: string;
  voucher_type: VoucherType;
  reference_no?: string;
  narration: string;
  total_debit: number;
  total_credit: number;
  status: EntryStatus;
  lines: EntryLine[];
  created_by?: string;
  created_at?: string;
  posted_at?: string;
}

export interface DoubleEntryFormState {
  entry_date: string;
  voucher_type: string;
  reference_no: string;
  narration: string;
}

export const VOUCHER_TYPES: VoucherType[] = [
  'Journal', 'Payment', 'Receipt', 'Contra', 'Sales', 'Purchase',
];

export const ACCOUNT_GROUPS = [
  'Assets', 'Liabilities', 'Equity', 'Income', 'Expense',
];

// Blank entry line factory
export const makeBlankLine = (): EntryLine => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  ledger_code: '',
  ledger_name: '',
  account_group: '',
  description: '',
  debit: 0,
  credit: 0,
});
