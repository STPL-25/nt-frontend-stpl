import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { AmendmentRecord } from './types';
import { formatDate, formatINR, isLineChanged } from './helpers';

interface AmendmentHistoryViewProps {
  amendments: AmendmentRecord[];
  loading: boolean;
}

const statusBadge: Record<string, string> = {
  'Draft':            'bg-muted text-muted-foreground border-border',
  'Pending Approval': 'bg-amber-100 text-amber-700 border-amber-200',
  'Approved':         'bg-green-100 text-green-700 border-green-200',
  'Rejected':         'bg-red-100   text-red-700   border-red-200',
};

const AmendmentCard: React.FC<{ amend: AmendmentRecord }> = ({ amend }) => {
  const [expanded, setExpanded] = useState(false);
  const diff = (amend.new_total ?? 0) - (amend.old_total ?? 0);

  return (
    <Card className="border-border">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{amend.amend_no ?? `Rev ${amend.rev_no}`}</span>
              <Badge className={`text-xs ${statusBadge[amend.status]}`}>{amend.status}</Badge>
              <Badge variant="outline" className="text-xs">{amend.amend_type}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div><span className="text-muted-foreground/70">Date: </span><span className="font-medium">{formatDate(amend.amend_date)}</span></div>
              <div>
                <span className="text-muted-foreground/70">Value: </span>
                <span className="line-through">{formatINR(amend.old_total)}</span> →{' '}
                <span className="font-medium text-foreground">{formatINR(amend.new_total)}</span>{' '}
                <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : ''}>
                  ({diff >= 0 ? '+' : ''}{formatINR(diff)})
                </span>
              </div>
              <div><span className="text-muted-foreground/70">By: </span><span>{amend.created_by_name ?? '—'}</span></div>
            </div>
            {amend.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {amend.reason}</p>}
          </div>
          {amend.lines.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={() => setExpanded(v => !v)}>
              {expanded
                ? <><ChevronUp size={13} className="mr-1" /> Hide</>
                : <><ChevronDown size={13} className="mr-1" /> Lines</>}
            </Button>
          )}
        </div>

        {expanded && amend.lines.length > 0 && (
          <div className="mt-3 border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs text-center">Old Qty</TableHead>
                  <TableHead className="text-xs text-center">New Qty</TableHead>
                  <TableHead className="text-xs text-center">Old Price</TableHead>
                  <TableHead className="text-xs text-center">New Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {amend.lines.map((l, idx) => (
                  <TableRow key={l.po_item_sno ?? idx} className={isLineChanged(l) ? 'bg-amber-50/60' : ''}>
                    <TableCell className="text-sm font-medium">{l.prod_name}</TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground">{l.old_qty}</TableCell>
                    <TableCell className="text-xs text-center font-medium">{l.new_qty}</TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground">{formatINR(l.old_price)}</TableCell>
                    <TableCell className="text-xs text-center font-medium">{formatINR(l.new_price)}</TableCell>
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

const AmendmentHistoryView: React.FC<AmendmentHistoryViewProps> = ({ amendments, loading }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold flex items-center gap-2">
        <History size={16} className="text-purple-600" />
        Amendment History
        <Badge variant="outline" className="text-xs ml-1">{amendments.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground/70 py-6 justify-center">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading history...</span>
        </div>
      ) : amendments.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-muted-foreground/70 gap-2">
          <History size={28} />
          <p className="text-sm">No amendments for this PO yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {amendments.map(a => <AmendmentCard key={a.amend_sno ?? a.amend_no} amend={a} />)}
        </div>
      )}
    </CardContent>
  </Card>
);

export default AmendmentHistoryView;
