import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';
import {
  supplierAxios,
  supplierNoteLedgers,
  supplierRemoveNoteLedger,
  type SupplierNoteLedger,
  type SupplierNoteLedgerTarget,
} from '@/Services/SupplierService';
import { checkLedgerFile, targetKey } from './supplierNoteLedgerModel';

/** The supplier's uploaded ledgers + upload / remove. `busyKey` is the upload slot (or `rm-<ledger>`) currently working. */
export function useNoteLedgers() {
  const [ledgers, setLedgers] = useState<SupplierNoteLedger[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await supplierAxios.get(supplierNoteLedgers);
      setLedgers((res.data?.data ?? []) as SupplierNoteLedger[]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load your uploaded ledgers'));
    }
  }, []);

  const upload = useCallback(async (target: SupplierNoteLedgerTarget, file: File) => {
    const problem = checkLedgerFile(file);
    if (problem) { toast.error(problem); return; }
    setBusyKey(targetKey(target));
    try {
      const body = new FormData();
      body.append('scope', target.scope);
      if (target.scope === 'NOTE') {
        body.append('note_kind', target.note_kind);
        body.append('note_sno', String(target.note_sno));
      } else {
        body.append('invoice_no', target.invoice_no);
      }
      body.append('ledger_file', file);
      const res = await supplierAxios.post(supplierNoteLedgers, body);
      toast.success(res.data?.message ?? 'Ledger uploaded');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not upload the ledger'));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  const remove = useCallback(async (ledger: SupplierNoteLedger) => {
    if (!window.confirm(`Remove "${ledger.file_name || 'this ledger'}"?`)) return;
    setBusyKey(`rm-${ledger.ledger_sno}`);
    try {
      await supplierAxios.delete(supplierRemoveNoteLedger(ledger.ledger_sno));
      toast.success('Ledger removed');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove the ledger'));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  return { ledgers, load, upload, remove, busyKey };
}
export type NoteLedgers = ReturnType<typeof useNoteLedgers>;
