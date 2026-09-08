import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, RotateCw, Loader2 } from 'lucide-react';
import type { UnsyncedInventoryItem } from '@/Services/GrnService/grnApi';

interface InventorySyncIssuesProps {
  items: UnsyncedInventoryItem[];
  onResync: (grn_item_sno: number) => Promise<void>;
  canResync: boolean;
}

// Shown when a GRN's automatic "post to inventory" step failed after the GRN
// itself already succeeded (e.g. a transient DB hiccup) — see
// grn-service/sql/24_grn_inventory_sync_tracking.sql. These items were
// physically received but never reached stock; Resync retries the posting
// for that one line without recreating the GRN.
const InventorySyncIssues: React.FC<InventorySyncIssuesProps> = ({ items, onResync, canResync }) => {
  const [resyncingId, setResyncingId] = useState<number | null>(null);

  if (items.length === 0) return null;

  const handleResync = async (grn_item_sno: number) => {
    setResyncingId(grn_item_sno);
    try {
      await onResync(grn_item_sno);
    } finally {
      setResyncingId(null);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
          <AlertTriangle size={16} />
          Inventory Sync Issues
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">{items.length}</Badge>
        </CardTitle>
        <p className="text-xs text-amber-700">
          These items were received on a GRN but never posted to inventory due to a system error.
          {canResync ? ' Click Resync to retry.' : ' Ask an admin to resync them.'}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN No</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Error</TableHead>
                {canResync && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.grn_item_sno}>
                  <TableCell className="font-medium">{it.grn_no}</TableCell>
                  <TableCell>{it.prod_name}</TableCell>
                  <TableCell className="text-right">{it.net_qty}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={it.inventory_sync_error ?? ''}>
                    {it.inventory_sync_error ?? '—'}
                  </TableCell>
                  {canResync && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resyncingId === it.grn_item_sno}
                        onClick={() => handleResync(it.grn_item_sno)}
                      >
                        {resyncingId === it.grn_item_sno ? (
                          <Loader2 size={14} className="animate-spin mr-1" />
                        ) : (
                          <RotateCw size={14} className="mr-1" />
                        )}
                        Resync
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default InventorySyncIssues;
