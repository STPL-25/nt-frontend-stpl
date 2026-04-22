import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, SlidersHorizontal, ArrowLeftRight, Loader2, Activity } from 'lucide-react';
import type { StockMovement } from './types';
import { formatDate, formatINR } from './helpers';

interface InventoryStockViewProps {
  movements: StockMovement[];
  loading: boolean;
}

const movementIcon: Record<string, React.ReactNode> = {
  IN:         <TrendingUp  size={13} className="text-green-600" />,
  OUT:        <TrendingDown size={13} className="text-red-600" />,
  ADJUSTMENT: <SlidersHorizontal size={13} className="text-amber-600" />,
  TRANSFER:   <ArrowLeftRight size={13} className="text-indigo-600" />,
};

const movementBadge: Record<string, string> = {
  IN:         'bg-green-100 text-green-700 border-green-200',
  OUT:        'bg-red-100   text-red-700   border-red-200',
  ADJUSTMENT: 'bg-amber-100 text-amber-700 border-amber-200',
  TRANSFER:   'bg-indigo-100 text-indigo-700 border-indigo-200',
};

// Mock movements for selected item
const MOCK_MOVEMENTS: StockMovement[] = [
  {
    movement_sno: 1, item_sno: 1, item_code: 'ITM-0001', item_name: 'Steel Rod 10mm',
    movement_type: 'IN', quantity: 500, balance_after: 850, uom: 'Kg',
    reference_no: 'GRN-2025-001', warehouse: 'Main Warehouse',
    reason: 'Purchase Receipt', created_by: 'EMP001', created_at: '2025-03-10T10:30:00Z',
  },
  {
    movement_sno: 2, item_sno: 1, item_code: 'ITM-0001', item_name: 'Steel Rod 10mm',
    movement_type: 'OUT', quantity: 150, balance_after: 700, uom: 'Kg',
    reference_no: 'ISSUE-2025-042', warehouse: 'Main Warehouse',
    reason: 'Production Issue', created_by: 'EMP002', created_at: '2025-03-12T14:00:00Z',
  },
  {
    movement_sno: 3, item_sno: 1, item_code: 'ITM-0001', item_name: 'Steel Rod 10mm',
    movement_type: 'ADJUSTMENT', quantity: 300, balance_after: 1000, uom: 'Kg',
    reference_no: 'ADJ-2025-005', warehouse: 'Main Warehouse',
    reason: 'Physical Count Adjustment', created_by: 'EMP001', created_at: '2025-03-20T09:15:00Z',
  },
  {
    movement_sno: 4, item_sno: 1, item_code: 'ITM-0001', item_name: 'Steel Rod 10mm',
    movement_type: 'OUT', quantity: 150, balance_after: 850, uom: 'Kg',
    reference_no: 'ISSUE-2025-055', warehouse: 'Main Warehouse',
    reason: 'Store Requisition', created_by: 'EMP003', created_at: '2025-04-02T11:00:00Z',
  },
];

const InventoryStockView: React.FC<InventoryStockViewProps> = ({ movements, loading }) => {
  const displayMovements = movements.length > 0 ? movements : MOCK_MOVEMENTS;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity size={15} className="text-indigo-600" />
          Stock Movement History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading movements...</span>
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs text-right">Qty</TableHead>
                  <TableHead className="text-xs text-right">Balance After</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                  <TableHead className="text-xs">By</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayMovements.map((mv, idx) => (
                  <TableRow key={mv.movement_sno ?? idx}>
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs flex items-center gap-1 w-fit ${movementBadge[mv.movement_type]}`}>
                        {movementIcon[mv.movement_type]}
                        {mv.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-indigo-700">{mv.reference_no ?? '—'}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">
                      <span className={mv.movement_type === 'OUT' ? 'text-red-600' : 'text-green-600'}>
                        {mv.movement_type === 'OUT' ? '-' : '+'}{mv.quantity} {mv.uom}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium text-gray-800">
                      {mv.balance_after} {mv.uom}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-[140px] truncate">{mv.reason ?? '—'}</TableCell>
                    <TableCell className="text-xs text-gray-500">{mv.created_by ?? '—'}</TableCell>
                    <TableCell className="text-xs text-gray-400 whitespace-nowrap">{formatDate(mv.created_at)}</TableCell>
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

export default InventoryStockView;
