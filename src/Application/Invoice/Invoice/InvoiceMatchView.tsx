import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import type { Invoice } from './types';
import { formatINR, parseAllocations, matchStatusTone } from './helpers';

interface InvoiceMatchViewProps {
  invoice: Invoice;
  matching: boolean;
  onMatch: () => void;
}

const InvoiceMatchView: React.FC<InvoiceMatchViewProps> = ({ invoice, matching, onMatch }) => {
  const allocations = parseAllocations(invoice);
  const totalHeld = allocations.reduce((s, a) => s + (a.hold_amount || 0), 0);
  const totalRelease = allocations.reduce((s, a) => s + (a.release_amount || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          Match Status — {invoice.invoice_no}
        </CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onMatch} disabled={matching || allocations.length === 0}>
          <RefreshCw size={13} className={matching ? 'animate-spin mr-1' : 'mr-1'} />
          {matching ? 'Matching…' : 'Run Match'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {allocations.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 py-2">Allocate this invoice across buckets first.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-xs bg-muted/30 rounded-md p-3">
              <div><p className="text-muted-foreground/70">Invoice Amount</p><p className="font-medium text-foreground">{formatINR(invoice.invoice_amount)}</p></div>
              <div><p className="text-muted-foreground/70">Held (mismatched)</p><p className="font-semibold text-red-600">{formatINR(totalHeld)}</p></div>
              <div><p className="text-muted-foreground/70">Payable (matched)</p><p className="font-semibold text-green-700">{formatINR(totalRelease)}</p></div>
            </div>

            <div className="border rounded overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Bucket</TableHead>
                    <TableHead className="text-xs text-right">Allocated</TableHead>
                    <TableHead className="text-xs text-right">Match %</TableHead>
                    <TableHead className="text-xs text-right">Held</TableHead>
                    <TableHead className="text-xs text-right">Payable</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map(a => (
                    <TableRow key={a.invoice_alloc_sno}>
                      <TableCell>
                        <Badge className={`text-xs ${a.bucket_type === 'MATERIAL' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                          {a.bucket_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{formatINR(a.allocated_amount)}</TableCell>
                      <TableCell className="text-xs text-right">
                        {a.matched_qty_ratio != null ? `${(a.matched_qty_ratio * 100).toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-right text-red-600">{formatINR(a.hold_amount)}</TableCell>
                      <TableCell className="text-xs text-right text-green-700">{formatINR(a.release_amount)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs ${matchStatusTone[a.match_status] ?? ''}`}>{a.match_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground/70">
              A mismatch on one bucket only holds that bucket's amount — the other bucket's payable
              portion is unaffected and can be released independently in Payments.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceMatchView;
