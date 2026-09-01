import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ReceiptText, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, LoadingState } from '@/CustomComponent/PageComponents';
import {
  supplierAxios,
  supplierGetDebitNotes,
  supplierGetDebitNoteDetail,
  parseSupplierDebitNoteItems,
  type SupplierDebitNoteListItem,
  type SupplierDebitNoteItem,
} from '@/Services/SupplierService';
import { formatDate, formatINR } from './helpers';

const reasonColor: Record<string, string> = {
  Damage: 'bg-red-100 text-red-700 border-red-200',
  Shortage: 'bg-amber-100 text-amber-700 border-amber-200',
  Return: 'bg-blue-100 text-blue-700 border-blue-200',
};

const DebitNoteCard: React.FC<{ note: SupplierDebitNoteListItem }> = ({ note }) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [items, setItems] = useState<SupplierDebitNoteItem[] | null>(null);

  const toggle = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (items) return;
    setLoadingItems(true);
    try {
      const res = await supplierAxios.get(supplierGetDebitNoteDetail(note.debit_note_sno));
      setItems(parseSupplierDebitNoteItems(res.data?.data?.items ?? []));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load debit note items');
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold">{note.debit_note_no}</span>
              <Badge className="text-xs bg-red-100 text-red-700 border-red-200">{note.status}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div><span className="text-muted-foreground/70">PO: </span><span className="font-medium">{note.po_no}</span></div>
              <div><span className="text-muted-foreground/70">GRN: </span><span className="font-medium">{note.grn_no}</span></div>
              <div><span className="text-muted-foreground/70">Invoice: </span><span className="font-medium">{note.vendor_invoice_no || '—'}</span></div>
              <div><span className="text-muted-foreground/70">Date: </span>{formatDate(note.debit_note_date)}</div>
              <div><span className="text-muted-foreground/70">Amount: </span><span className="font-semibold text-red-700">{formatINR(note.total_amount)}</span></div>
            </div>
            {note.remarks && <p className="text-xs text-muted-foreground mt-1">Note: {note.remarks}</p>}
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={toggle}>
            {expanded ? <><ChevronUp size={13} className="mr-1" /> Hide</> : <><ChevronDown size={13} className="mr-1" /> Details</>}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 border rounded overflow-x-auto">
            {loadingItems ? (
              <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading items…</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                    <TableHead className="text-xs text-center">Qty</TableHead>
                    <TableHead className="text-xs text-right">Unit Price</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items ?? []).map((item) => (
                    <TableRow key={item.debit_note_item_sno}>
                      <TableCell>
                        <p className="text-sm font-medium">{item.prod_name}</p>
                        {item.specification && <p className="text-xs text-muted-foreground/70">{item.specification}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${reasonColor[item.reason_type] ?? 'bg-muted text-muted-foreground'}`}>
                          {item.reason_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center">{item.qty} {item.unit_name}</TableCell>
                      <TableCell className="text-xs text-right">{formatINR(item.unit_price)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{formatINR(item.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SupplierDebitNotesList: React.FC = () => {
  const [notes, setNotes] = useState<SupplierDebitNoteListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierAxios.get(supplierGetDebitNotes);
      setNotes(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load debit notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  return (
    <div className="p-3 sm:p-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ReceiptText size={16} className="text-red-600" />
              Debit Notes
              <Badge variant="outline" className="text-xs ml-1">{notes.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="outline" className="text-xs" onClick={fetchNotes} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin mr-1' : 'mr-1'} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && notes.length === 0 ? (
            <LoadingState message="Loading debit notes…" />
          ) : notes.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              message="No debit notes"
              description="Debit notes raised against damaged, short, or returned goods will appear here."
            />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => <DebitNoteCard key={note.debit_note_sno} note={note} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierDebitNotesList;
