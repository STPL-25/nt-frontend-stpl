import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SplitSquareHorizontal, Loader2 } from 'lucide-react';
import type { Invoice, PoItemForAllocation, AllocationRow } from './types';
import { formatINR } from './helpers';

interface InvoiceAllocationFormProps {
  invoice: Invoice;
  poItems: PoItemForAllocation[];
  loadingItems: boolean;
  saving: boolean;
  onSubmit: (allocations: { po_item_sno: number; allocated_amount: number }[]) => void;
}

const InvoiceAllocationForm: React.FC<InvoiceAllocationFormProps> = ({ invoice, poItems, loadingItems, saving, onSubmit }) => {
  const [rows, setRows] = useState<AllocationRow[]>([]);

  useEffect(() => {
    setRows(poItems.map(item => ({
      po_item_sno: item.po_item_sno,
      label: item.po_section === 'SERVICE' ? (item.service_name ?? `Service line #${item.po_item_sno}`) : (item.prod_name ?? `Material line #${item.po_item_sno}`),
      bucket_type: item.po_section,
      line_value: item.line_value,
      amount: '',
    })));
  }, [poItems]);

  const setAmount = (po_item_sno: number, value: string) =>
    setRows(prev => prev.map(r => r.po_item_sno === po_item_sno ? { ...r, amount: value } : r));

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const diff = invoice.invoice_amount - total;
  const balanced = Math.abs(diff) <= 1;

  const materialTotal = rows.filter(r => r.bucket_type === 'MATERIAL').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const serviceTotal = rows.filter(r => r.bucket_type === 'SERVICE').reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const handleSubmit = () => {
    const allocations = rows
      .filter(r => Number(r.amount) > 0)
      .map(r => ({ po_item_sno: r.po_item_sno, allocated_amount: Number(r.amount) }));
    onSubmit(allocations);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <SplitSquareHorizontal size={16} className="text-primary" />
          Allocate Invoice — {invoice.invoice_no}
          <Badge variant="outline" className="text-xs ml-1">
            Material: {formatINR(materialTotal)} · Service: {formatINR(serviceTotal)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingItems ? (
          <div className="flex items-center gap-2 text-muted-foreground/70 py-6 justify-center">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading PO lines…</span>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 py-2">
            No PO lines found. Link this invoice to a PO first.
          </p>
        ) : (
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Line</TableHead>
                  <TableHead className="text-xs">Bucket</TableHead>
                  <TableHead className="text-xs text-right">Line Value</TableHead>
                  <TableHead className="text-xs text-right">Allocate Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.po_item_sno}>
                    <TableCell className="text-xs">{r.label}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${r.bucket_type === 'MATERIAL' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                        {r.bucket_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">{formatINR(r.line_value)}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" min={0}
                        value={r.amount}
                        onChange={e => setAmount(r.po_item_sno, e.target.value)}
                        className="h-8 text-sm text-right w-32 inline-block"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 text-xs">
          <div className={balanced ? 'text-green-700' : 'text-red-600'}>
            Allocated {formatINR(total)} of {formatINR(invoice.invoice_amount)}
            {!balanced && ` — ${diff > 0 ? 'short by' : 'over by'} ${formatINR(Math.abs(diff))}`}
          </div>
          <Button size="sm" className="text-xs" disabled={!balanced || saving || rows.length === 0} onClick={handleSubmit}>
            {saving ? 'Saving…' : 'Save Allocation'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceAllocationForm;
