import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, BookOpen, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <TwoPaneLayout
      icon={BookOpen}
      title="A/C Double Entry"
      description="Record journal entries with balanced debit and credit lines"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <JournalEntrySidebar
          entries={entries}
          loading={loadingEntries}
          selectedEntry={selectedEntry}
          onSelectEntry={(entry) => { handleSelectEntry(entry); setSidebarOpen(false); }}
          onNewEntry={canCreate("AccountEntryPage") ? () => { handleNewEntry(); setSidebarOpen(false); } : undefined}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> Entries
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={fetchEntries}
            disabled={loadingEntries}
          >
            <RefreshCw size={15} className={loadingEntries ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="px-4 sm:px-6 py-5 space-y-4">
        <AccountSummaryCard entries={entries} />

        {!showForm ? (
          <EmptyState
            icon={BookOpen}
            message="Select or Create an Entry"
            description="Choose a journal entry from the left panel to view details, or click 'New Entry' to record a new double-entry transaction"
          />
        ) : (
          <>
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
          </>
        )}
      </div>
    </TwoPaneLayout>
  );
};

export default AccountEntryPage;
