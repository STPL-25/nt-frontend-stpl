import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, BookOpen } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';

import type { JournalEntry, EntryLine, DoubleEntryFormState } from './DoubleEntry/types';
import { MOCK_ENTRIES, today, generateEntryNo } from './DoubleEntry/helpers';

import JournalEntrySidebar from './DoubleEntry/JournalEntrySidebar';
import DoubleEntryForm from './DoubleEntry/DoubleEntryForm';
import EntryHistoryView from './DoubleEntry/EntryHistoryView';
import AccountSummaryCard from './DoubleEntry/AccountSummaryCard';

// ── Main Component ────────────────────────────────────────────────────────────

const AccountEntryPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit } = usePermissions();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Fetchers (temporary – using local mock data) ─────────────────────────────

  const fetchEntries = useCallback(() => {
    setLoadingEntries(true);
    setTimeout(() => {
      setEntries(MOCK_ENTRIES);
      setLoadingEntries(false);
    }, 300);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setIsNewEntry(false);
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setIsNewEntry(true);
  };

  const handleCancel = () => {
    setIsNewEntry(false);
    // stay on selectedEntry view if one was selected
  };

  const handleSave = (
    form: DoubleEntryFormState,
    lines: EntryLine[],
    status: 'Draft' | 'Posted',
  ) => {
    // Validation
    if (!form.entry_date)  { toast.error('Entry date is required'); return; }
    if (!form.narration.trim()) { toast.error('Narration is required'); return; }

    const filledLines = lines.filter(l => l.ledger_code);
    if (filledLines.length < 2) {
      toast.error('At least 2 account lines are required');
      return;
    }

    const totalDebit  = filledLines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = filledLines.reduce((s, l) => s + (l.credit || 0), 0);

    if (status === 'Posted' && Math.abs(totalDebit - totalCredit) >= 0.01) {
      toast.error('Entry cannot be posted — debits and credits are not balanced');
      return;
    }

    if (totalDebit === 0 && totalCredit === 0) {
      toast.error('Entry has zero amounts');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      if (isNewEntry) {
        const newEntry: JournalEntry = {
          entry_sno: Date.now(),
          entry_no: generateEntryNo(form.voucher_type),
          entry_date: form.entry_date,
          voucher_type: form.voucher_type as JournalEntry['voucher_type'],
          reference_no: form.reference_no || undefined,
          narration: form.narration,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status,
          lines: filledLines,
          created_by: 'Current User',
          created_at: new Date().toISOString(),
          posted_at: status === 'Posted' ? new Date().toISOString() : undefined,
        };
        setEntries(prev => [newEntry, ...prev]);
        setSelectedEntry(newEntry);
        setIsNewEntry(false);
        toast.success(`Entry ${newEntry.entry_no} ${status === 'Posted' ? 'posted' : 'saved as draft'} successfully`);
      } else if (selectedEntry) {
        const updated: JournalEntry = {
          ...selectedEntry,
          entry_date: form.entry_date,
          voucher_type: form.voucher_type as JournalEntry['voucher_type'],
          reference_no: form.reference_no || undefined,
          narration: form.narration,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status,
          lines: filledLines,
          posted_at: status === 'Posted' ? (selectedEntry.posted_at ?? new Date().toISOString()) : undefined,
        };
        setEntries(prev => prev.map(e => e.entry_sno === updated.entry_sno ? updated : e));
        setSelectedEntry(updated);
        toast.success(`Entry ${updated.entry_no} updated`);
      }
      setSaving(false);
    }, 400);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const showForm  = isNewEntry || (selectedEntry !== null);
  const showPostedDetail = selectedEntry && !isNewEntry && selectedEntry.status === 'Posted';

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <BookOpen className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">A/C Double Entry</h1>
            <p className="text-sm text-gray-500">
              Record journal entries with balanced debit and credit lines
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loadingEntries}>
          <RefreshCw size={15} className={loadingEntries ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT: Entry list sidebar */}
        <JournalEntrySidebar
          entries={entries}
          loading={loadingEntries}
          selectedEntry={selectedEntry}
          onSelectEntry={handleSelectEntry}
          onNewEntry={canCreate("AccountEntryPage") ? handleNewEntry : undefined}
        />

        {/* RIGHT: Main content */}
        <div className="flex-1 overflow-y-auto">
          {!showForm ? (
            /* Overview when nothing selected */
            <div className="px-6 py-5 space-y-4">
              <AccountSummaryCard entries={entries} />

              <div className="flex flex-col items-center justify-center h-48 gap-4 text-gray-400">
                <div className="bg-gray-100 p-5 rounded-full">
                  <BookOpen size={36} />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-gray-500">Select or Create an Entry</p>
                  <p className="text-sm mt-1">
                    Choose a journal entry from the left panel to view details,<br />
                    or click "New Entry" to record a new double-entry transaction
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {/* Summary stats */}
              <AccountSummaryCard entries={entries} />

              {/* New / Edit form */}
              {(isNewEntry || (selectedEntry && selectedEntry.status !== 'Posted')) && (
                <DoubleEntryForm
                  selectedEntry={selectedEntry}
                  isNewEntry={isNewEntry}
                  onSave={(canCreate("AccountEntryPage") || canEdit("AccountEntryPage")) ? handleSave : undefined}
                  onCancel={handleCancel}
                  saving={saving}
                />
              )}

              {/* View-only posted entry */}
              {showPostedDetail && !isNewEntry && (
                <EntryHistoryView entry={selectedEntry} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountEntryPage;
