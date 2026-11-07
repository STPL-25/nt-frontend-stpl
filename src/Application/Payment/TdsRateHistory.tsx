import React, { useState } from 'react';
import axios from 'axios';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage } from '@/lib/errors';
import { payNetTdsRateLog, type TdsRateLogEntry } from '@/Services/GrnService/paymentNetApi';
import { enteredLine } from './tdsRateModel';

const money = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null | undefined) => (n == null ? 'section rate' : `${Number(n)}%`);

const ACTION_TEXT: Record<TdsRateLogEntry['action_type'], string> = { ENTERED: 'Entered', CHANGED: 'Changed', CLEARED: 'Cleared' };

/**
 * "Rate history" for ONE invoice (sql/84): every time its TDS rate was typed, changed or cleared on a payment - the login that did it,
 * when, old -> new rate, and the TDS that came out of it. Opens on click and reads the log then, so the Payment page stays light.
 */
export const TdsRateHistoryButton: React.FC<{ invoiceSno: number; billNo: string }> = ({ invoiceSno, billNo }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TdsRateLogEntry[] | null>(null);
  const [error, setError] = useState('');

  const show = async () => {
    setOpen(true);
    setRows(null);
    setError('');
    try {
      const res = await axios.get(payNetTdsRateLog, { params: { invoice_sno: invoiceSno } });
      setRows(res?.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the TDS rate history'));
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 px-1 text-[11px] text-muted-foreground" onClick={show}
        title="Who entered which TDS rate on this invoice" aria-label={`TDS rate history of ${billNo}`}>
        <History className="h-3 w-3" />History
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-4 sm:w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>TDS rate history - {billNo}</DialogTitle>
            <DialogDescription>Every time the TDS rate of this invoice was entered, changed or cleared on a payment, and by which login.</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!error && rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!error && rows !== null && rows.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No TDS rate has been typed on this invoice - the section's own rate is used.</p>
            )}
            {!error && rows !== null && rows.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs">Entered by / when</TableHead><TableHead className="text-xs">What</TableHead><TableHead className="text-xs">Section</TableHead>
                    <TableHead className="text-right text-xs">Rate</TableHead><TableHead className="text-right text-xs">TDS</TableHead><TableHead className="text-xs">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.log_sno}>
                      <TableCell className="whitespace-nowrap text-xs font-medium">{enteredLine(r.entered_by, r.entered_at)}</TableCell>
                      <TableCell className="text-xs">{ACTION_TEXT[r.action_type] ?? r.action_type}</TableCell>
                      <TableCell className="text-xs">{r.section_code ?? <span className="text-muted-foreground">No TDS</span>}
                        {r.section_rate_pct != null && <span className="block text-muted-foreground">section rate {Number(r.section_rate_pct)}%</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{pct(r.previous_rate_pct)} → <b>{pct(r.entered_rate_pct)}</b></TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                        {money(r.tds_amount)}{r.tds_taxable != null && <span className="block text-muted-foreground">on {money(r.tds_taxable)}</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{r.payment_no ?? '—'}{r.payment_status && <span className="block text-muted-foreground">{r.payment_status}</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
