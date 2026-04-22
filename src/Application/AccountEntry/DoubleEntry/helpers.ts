import type { AccountLedger, JournalEntry } from './types';

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export const generateEntryNo = (voucherType: string): string => {
  const prefix: Record<string, string> = {
    Journal: 'JV', Payment: 'PV', Receipt: 'RV', Contra: 'CV', Sales: 'SV', Purchase: 'PUR',
  };
  const p = prefix[voucherType] ?? 'JV';
  const ts = String(Date.now()).slice(-6);
  return `${p}-${new Date().getFullYear()}-${ts}`;
};

export const isBalanced = (totalDebit: number, totalCredit: number): boolean =>
  Math.abs(totalDebit - totalCredit) < 0.001;

export const getDifference = (totalDebit: number, totalCredit: number): number =>
  Math.abs(totalDebit - totalCredit);

// ── Mock chart of accounts ────────────────────────────────────────────────────

export const MOCK_LEDGERS: AccountLedger[] = [
  { ledger_sno: 1,  ledger_code: 'CA-001', ledger_name: 'Cash in Hand',        account_group: 'Assets',      account_type: 'Cash',     opening_balance: 50000,  current_balance: 48500,  nature: 'Debit' },
  { ledger_sno: 2,  ledger_code: 'CA-002', ledger_name: 'Bank — SBI Current',   account_group: 'Assets',      account_type: 'Bank',     opening_balance: 500000, current_balance: 482000, nature: 'Debit' },
  { ledger_sno: 3,  ledger_code: 'CA-003', ledger_name: 'Bank — HDFC Current',  account_group: 'Assets',      account_type: 'Bank',     opening_balance: 200000, current_balance: 195000, nature: 'Debit' },
  { ledger_sno: 4,  ledger_code: 'AR-001', ledger_name: 'Accounts Receivable',  account_group: 'Assets',      account_type: 'Debtor',   opening_balance: 120000, current_balance: 145000, nature: 'Debit' },
  { ledger_sno: 5,  ledger_code: 'AR-002', ledger_name: 'Customer — Alpha Ltd', account_group: 'Assets',      account_type: 'Debtor',   opening_balance: 30000,  current_balance: 42000,  nature: 'Debit' },
  { ledger_sno: 6,  ledger_code: 'AR-003', ledger_name: 'Customer — Beta Corp', account_group: 'Assets',      account_type: 'Debtor',   opening_balance: 15000,  current_balance: 18000,  nature: 'Debit' },
  { ledger_sno: 7,  ledger_code: 'FA-001', ledger_name: 'Machinery & Equipment',account_group: 'Assets',      account_type: 'Fixed',    opening_balance: 800000, current_balance: 780000, nature: 'Debit' },
  { ledger_sno: 8,  ledger_code: 'FA-002', ledger_name: 'Furniture & Fixtures', account_group: 'Assets',      account_type: 'Fixed',    opening_balance: 50000,  current_balance: 48000,  nature: 'Debit' },
  { ledger_sno: 9,  ledger_code: 'CL-001', ledger_name: 'Accounts Payable',     account_group: 'Liabilities', account_type: 'Creditor', opening_balance: 80000,  current_balance: 92000,  nature: 'Credit' },
  { ledger_sno: 10, ledger_code: 'CL-002', ledger_name: 'Supplier — XYZ Pvt',  account_group: 'Liabilities', account_type: 'Creditor', opening_balance: 25000,  current_balance: 30000,  nature: 'Credit' },
  { ledger_sno: 11, ledger_code: 'CL-003', ledger_name: 'TDS Payable',          account_group: 'Liabilities', account_type: 'Tax',      opening_balance: 5000,   current_balance: 7500,   nature: 'Credit' },
  { ledger_sno: 12, ledger_code: 'CL-004', ledger_name: 'GST Payable',          account_group: 'Liabilities', account_type: 'Tax',      opening_balance: 18000,  current_balance: 22000,  nature: 'Credit' },
  { ledger_sno: 13, ledger_code: 'EQ-001', ledger_name: 'Share Capital',         account_group: 'Equity',      account_type: 'Capital',  opening_balance: 1000000,current_balance: 1000000,nature: 'Credit' },
  { ledger_sno: 14, ledger_code: 'EQ-002', ledger_name: 'Retained Earnings',    account_group: 'Equity',      account_type: 'Capital',  opening_balance: 200000, current_balance: 230000, nature: 'Credit' },
  { ledger_sno: 15, ledger_code: 'IN-001', ledger_name: 'Sales Revenue',         account_group: 'Income',      account_type: 'Revenue',  opening_balance: 0,      current_balance: 450000, nature: 'Credit' },
  { ledger_sno: 16, ledger_code: 'IN-002', ledger_name: 'Interest Income',       account_group: 'Income',      account_type: 'Revenue',  opening_balance: 0,      current_balance: 8500,   nature: 'Credit' },
  { ledger_sno: 17, ledger_code: 'IN-003', ledger_name: 'Other Income',          account_group: 'Income',      account_type: 'Revenue',  opening_balance: 0,      current_balance: 5000,   nature: 'Credit' },
  { ledger_sno: 18, ledger_code: 'EX-001', ledger_name: 'Cost of Goods Sold',   account_group: 'Expense',     account_type: 'COGS',     opening_balance: 0,      current_balance: 280000, nature: 'Debit' },
  { ledger_sno: 19, ledger_code: 'EX-002', ledger_name: 'Salaries & Wages',     account_group: 'Expense',     account_type: 'Salary',   opening_balance: 0,      current_balance: 120000, nature: 'Debit' },
  { ledger_sno: 20, ledger_code: 'EX-003', ledger_name: 'Rent Expense',          account_group: 'Expense',     account_type: 'Rent',     opening_balance: 0,      current_balance: 36000,  nature: 'Debit' },
  { ledger_sno: 21, ledger_code: 'EX-004', ledger_name: 'Electricity Expense',  account_group: 'Expense',     account_type: 'Utility',  opening_balance: 0,      current_balance: 18000,  nature: 'Debit' },
  { ledger_sno: 22, ledger_code: 'EX-005', ledger_name: 'Depreciation',          account_group: 'Expense',     account_type: 'Non-Cash', opening_balance: 0,      current_balance: 22000,  nature: 'Debit' },
  { ledger_sno: 23, ledger_code: 'EX-006', ledger_name: 'Office Supplies',       account_group: 'Expense',     account_type: 'Admin',    opening_balance: 0,      current_balance: 4500,   nature: 'Debit' },
  { ledger_sno: 24, ledger_code: 'EX-007', ledger_name: 'Travel & Conveyance',  account_group: 'Expense',     account_type: 'Admin',    opening_balance: 0,      current_balance: 9000,   nature: 'Debit' },
];

// ── Mock posted journal entries ───────────────────────────────────────────────

export const MOCK_ENTRIES: JournalEntry[] = [
  {
    entry_sno: 1, entry_no: 'JV-2025-001', entry_date: '2025-03-01',
    voucher_type: 'Journal', reference_no: 'DEPR-MAR-25',
    narration: 'Monthly depreciation on machinery for March 2025',
    total_debit: 22000, total_credit: 22000, status: 'Posted',
    lines: [
      { id: 'l1', ledger_code: 'EX-005', ledger_name: 'Depreciation', account_group: 'Expense', description: 'Depreciation on machinery', debit: 22000, credit: 0 },
      { id: 'l2', ledger_code: 'FA-001', ledger_name: 'Machinery & Equipment', account_group: 'Assets', description: 'Accumulated depreciation', debit: 0, credit: 22000 },
    ],
    created_by: 'EMP001', created_at: '2025-03-01T09:00:00Z', posted_at: '2025-03-01T09:05:00Z',
  },
  {
    entry_sno: 2, entry_no: 'PV-2025-048', entry_date: '2025-03-05',
    voucher_type: 'Payment', reference_no: 'CHQ-001245',
    narration: 'Paid March rent to landlord via SBI cheque',
    total_debit: 36000, total_credit: 36000, status: 'Posted',
    lines: [
      { id: 'l3', ledger_code: 'EX-003', ledger_name: 'Rent Expense', account_group: 'Expense', description: 'March 2025 rent', debit: 36000, credit: 0 },
      { id: 'l4', ledger_code: 'CA-002', ledger_name: 'Bank — SBI Current', account_group: 'Assets', description: 'Cheque payment', debit: 0, credit: 36000 },
    ],
    created_by: 'EMP002', created_at: '2025-03-05T11:00:00Z', posted_at: '2025-03-05T11:10:00Z',
  },
  {
    entry_sno: 3, entry_no: 'RV-2025-012', entry_date: '2025-03-10',
    voucher_type: 'Receipt', reference_no: 'INV-ALPHA-2025-03',
    narration: 'Received payment from Alpha Ltd against invoice',
    total_debit: 42000, total_credit: 42000, status: 'Posted',
    lines: [
      { id: 'l5', ledger_code: 'CA-002', ledger_name: 'Bank — SBI Current', account_group: 'Assets', description: 'NEFT receipt', debit: 42000, credit: 0 },
      { id: 'l6', ledger_code: 'AR-002', ledger_name: 'Customer — Alpha Ltd', account_group: 'Assets', description: 'Clearing invoice', debit: 0, credit: 42000 },
    ],
    created_by: 'EMP001', created_at: '2025-03-10T14:30:00Z', posted_at: '2025-03-10T14:35:00Z',
  },
];
