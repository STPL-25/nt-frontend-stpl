import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { formatDate } from './helpers';

export interface GRNApprovalRow {
  grn_basic_sno: number;
  grn_no: string;
  po_basic_sno: number;
  received_date?: string;
  created_by?: string;
  created_at?: string;
  item_count?: number;
  total_received_qty?: number;
}

interface Props {
  rows: GRNApprovalRow[];
  busyId: number | null;
  onDecide: (row: GRNApprovalRow, action: 'approve' | 'reject', comments: string) => void;
}

/** GRNs waiting for the logged-in approver. Stock is posted only on final approval. */
const GRNApprovalPanel: React.FC<Props> = ({ rows, busyId, onDecide }) => {
  const [comments, setComments] = useState<Record<number, string>>({});
  if (rows.length === 0) return null;

  return (
    <Card className="border-blue-300 bg-blue-50/40 dark:bg-blue-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck size={16} className="text-blue-600" />
          GRNs awaiting your approval
          <Badge variant="outline" className="text-xs">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(r => (
          <div key={r.grn_basic_sno} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{r.grn_no}</p>
                <p className="text-xs text-muted-foreground">
                  Received {formatDate(r.received_date)} · {r.item_count ?? 0} item(s) · qty {r.total_received_qty ?? 0}
                  {r.created_by ? ` · by ${r.created_by}` : ''}
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">Stock posts on final approval</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Remarks (required to reject)"
                value={comments[r.grn_basic_sno] ?? ''}
                onChange={e => setComments(p => ({ ...p, [r.grn_basic_sno]: e.target.value }))}
                className="h-8 text-xs max-w-xs"
              />
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                disabled={busyId === r.grn_basic_sno}
                onClick={() => onDecide(r, 'approve', comments[r.grn_basic_sno] ?? '')}
              >
                <Check size={13} className="mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={busyId === r.grn_basic_sno || !(comments[r.grn_basic_sno] ?? '').trim()}
                onClick={() => onDecide(r, 'reject', comments[r.grn_basic_sno] ?? '')}
              >
                <X size={13} className="mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default GRNApprovalPanel;
