import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import { useQuotationCompareFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Quotation } from './types';
import { formatDate, formatINR, getPRItems, getQuotationTotal } from './helpers';

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotations: Quotation[];
  selectedPR: PRRecord | null;
}

const CompareDialog: React.FC<CompareDialogProps> = ({
  open, onOpenChange, quotations, selectedPR,
}) => {
  const compareFields = useQuotationCompareFields();
  const viewFields = compareFields.filter(f => f.view);

  const getFieldValue = (q: Quotation, field: string) => {
    if (field === 'total_amount') return getQuotationTotal(q.items);
    if (field === 'valid_upto' || field === 'quotation_date') return formatDate((q as any)[field]);
    return (q as any)[field] ?? '—';
  };

  const allTotals = quotations.map(q => getQuotationTotal(q.items));
  const minTotal = Math.min(...allTotals);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye size={18} />
            Compare Quotations
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold w-40">Parameter</TableHead>
                {quotations.map(q => (
                  <TableHead key={q.sq_basic_sno} className="text-xs font-semibold text-center">
                    {q.vendor_name || q.company_name}
                    {q.is_selected === 'Y' && (
                      <Badge className="ml-1 text-[10px] bg-green-100 text-green-700">Selected</Badge>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Dynamic parameter rows */}
              {viewFields.map(field => (
                <TableRow key={field.field}>
                  <TableCell className="text-xs font-medium text-gray-600">{field.label}</TableCell>
                  {quotations.map((q, qIdx) => {
                    const val = getFieldValue(q, field.field);
                    const isTotal = field.field === 'total_amount';
                    const isLowest = isTotal && allTotals[qIdx] === minTotal;
                    return (
                      <TableCell
                        key={q.sq_basic_sno}
                        className={`text-xs text-center ${isTotal ? 'font-bold' : ''} ${isLowest ? 'text-green-700 bg-green-50' : ''}`}
                      >
                        {isTotal ? formatINR(val as number) : val}
                        {isLowest && <span className="block text-[10px] font-normal text-green-600">Lowest</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}

              {/* Per-item price comparison */}
              {getPRItems(selectedPR).map((prItem, prIdx) => (
                <TableRow key={prIdx} className="bg-gray-50/50">
                  <TableCell className="text-xs text-gray-500">
                    {prItem.prod_name ?? prItem.item_name} (Unit Price)
                  </TableCell>
                  {quotations.map(q => {
                    const matchItem = q.items.find(it =>
                      it.prod_sno === prItem.prod_sno || it.prod_name === prItem.prod_name
                    );
                    const prices = quotations.map(qq => {
                      const m = qq.items.find(it => it.prod_sno === prItem.prod_sno || it.prod_name === prItem.prod_name);
                      return m?.unit_price ?? Infinity;
                    });
                    const isLowest = matchItem && matchItem.unit_price === Math.min(...prices);
                    return (
                      <TableCell
                        key={q.sq_basic_sno}
                        className={`text-xs text-center ${isLowest ? 'text-green-700 font-semibold' : ''}`}
                      >
                        {matchItem ? formatINR(matchItem.unit_price) : '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompareDialog;
