import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { ExcessRequest } from './types';
import { formatDate } from './helpers';

interface Props {
  requests: ExcessRequest[];
  busyId: number | null;
  onDecide: (req: ExcessRequest, action: 'ACCEPT' | 'REJECT', remarks: string) => void;
}

/** Excess receipts (qty above the PO) waiting for the logged-in approver. */
const ExcessApprovalPanel: React.FC<Props> = ({ requests, busyId, onDecide }) => {
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  if (requests.length === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600" />
          Excess receipts awaiting your approval
          <Badge variant="outline" className="text-xs">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map(r => (
          <div key={r.excess_sno} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{r.prod_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.grn_no} · PO {r.po_no ?? '—'} · {r.vendor_name ?? '—'} · {formatDate(r.requested_at)}
                  {r.requested_by_name ? ` · by ${r.requested_by_name}` : ''}
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                +{r.excess_qty} {r.unit_name} above PO
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              PO still allowed {r.po_pending_qty ?? 0} {r.unit_name} · received {r.received_qty} {r.unit_name}
              {r.invoice_qty != null && <> · invoice {r.invoice_qty} {r.invoice_uom}</>}.
              Accept to add the excess to stock; reject to return it to the supplier.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Remarks (required to reject)"
                value={remarks[r.excess_sno] ?? ''}
                onChange={e => setRemarks(p => ({ ...p, [r.excess_sno]: e.target.value }))}
                className="h-8 text-xs max-w-xs"
              />
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                disabled={busyId === r.excess_sno}
                onClick={() => onDecide(r, 'ACCEPT', remarks[r.excess_sno] ?? '')}
              >
                <Check size={13} className="mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={busyId === r.excess_sno || !(remarks[r.excess_sno] ?? '').trim()}
                onClick={() => onDecide(r, 'REJECT', remarks[r.excess_sno] ?? '')}
              >
                <X size={13} className="mr-1" /> Reject &amp; return
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ExcessApprovalPanel;
