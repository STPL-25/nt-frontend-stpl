import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2 } from 'lucide-react';
import type { PaymentRecord } from './types';
import { formatDate, formatINR } from './helpers';

interface PaymentHistoryViewProps {
  payments: PaymentRecord[];
  loading: boolean;
}

const statusBadge: Record<string, string> = {
  'Pending':   'bg-amber-100 text-amber-700 border-amber-200',
  'Processed': 'bg-blue-100  text-blue-700  border-blue-200',
  'Cleared':   'bg-green-100 text-green-700 border-green-200',
  'Failed':    'bg-red-100   text-red-700   border-red-200',
};

const PaymentHistoryView: React.FC<PaymentHistoryViewProps> = ({ payments, loading }) => {
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History size={16} className="text-purple-600" />
            Payment History
            <Badge variant="outline" className="text-xs ml-1">{payments.length}</Badge>
          </CardTitle>
          {payments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Total paid: <span className="font-semibold text-foreground">{formatINR(total)}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground/70 py-6 justify-center">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading payments...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground/70 gap-2">
            <History size={28} />
            <p className="text-sm">No payments recorded for this bill yet.</p>
          </div>
        ) : (
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Payment No</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Mode</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p, idx) => (
                  <TableRow key={p.payment_sno ?? idx}>
                    <TableCell className="text-xs font-medium text-primary">{p.payment_no}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="text-xs">{p.mode}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.bank_account ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reference_no ?? '—'}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatINR(p.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${statusBadge[p.status]}`}>{p.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentHistoryView;
