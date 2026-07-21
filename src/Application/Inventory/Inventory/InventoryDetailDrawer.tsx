import React, { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/utils/statusUtils';
import type { InventoryItem, StockMovement } from './types';
import { formatINR, formatDate } from './helpers';
import { displayStatus } from './InventoryTable';

interface InventoryDetailDrawerProps {
  item: InventoryItem | null;
  onClose: () => void;
  movements: StockMovement[];
  loadingMovements: boolean;
  canAdjust: boolean;
  adjusting: boolean;
  onAdjust: (item: InventoryItem, delta: number) => void;
  canEdit: boolean;
  onEdit: (item: InventoryItem) => void;
  canDelete: boolean;
  onDelete: (item: InventoryItem) => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode; strong?: boolean }> = ({ label, children, strong }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-sm mt-0.5 ${strong ? 'font-semibold' : ''}`}>{children}</div>
  </div>
);

const movementSign = (m: StockMovement): { sign: string; cls: string } => {
  if (m.movement_type === 'IN') return { sign: '+', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (m.movement_type === 'OUT') return { sign: '−', cls: 'text-red-600 dark:text-red-400' };
  return { sign: '±', cls: 'text-muted-foreground' };
};

const InventoryDetailDrawer: React.FC<InventoryDetailDrawerProps> = ({
  item, onClose, movements, loadingMovements,
  canAdjust, adjusting, onAdjust,
  canEdit, onEdit, canDelete, onDelete,
}) => {
  const [adjustQty, setAdjustQty] = useState('');

  const applyAdjust = () => {
    if (!item) return;
    const delta = parseInt(adjustQty, 10);
    if (!delta) return;
    onAdjust(item, delta);
    setAdjustQty('');
  };

  return (
    <Sheet open={!!item} onOpenChange={open => { if (!open) { setAdjustQty(''); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {item && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle>{item.item_name}</SheetTitle>
              <SheetDescription>{item.item_code}</SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-4 space-y-4">
              <StatusBadge status={displayStatus(item)} withDot />

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/40 p-4">
                <Field label="Category">{item.category}</Field>
                <Field label="Warehouse">{item.warehouse || '—'}</Field>
                <Field label="On Hand" strong>{item.current_stock.toLocaleString('en-IN')} {item.uom}</Field>
                <Field label="Min / Max">{item.min_stock.toLocaleString('en-IN')} / {item.max_stock.toLocaleString('en-IN')}</Field>
                <Field label="Reorder Qty">{item.reorder_qty.toLocaleString('en-IN')}</Field>
                <Field label="Location">{item.location || '—'}</Field>
                <Field label="Unit Cost">{formatINR(item.cost_price)}</Field>
                <Field label="Stock Value" strong>{formatINR(item.current_stock * item.cost_price)}</Field>
                <Field label="Selling Price">{formatINR(item.selling_price)}</Field>
                <Field label="Last Updated">{formatDate(item.updated_at ?? item.created_at)}</Field>
              </div>

              {canAdjust && item.status !== 'Discontinued' && (
                <div>
                  <div className="text-sm font-semibold mb-2">Adjust Stock</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Quantity ±"
                      value={adjustQty}
                      onChange={e => setAdjustQty(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') applyAdjust(); }}
                      className="h-9"
                    />
                    <Button size="sm" className="h-9" onClick={applyAdjust} disabled={adjusting || !parseInt(adjustQty, 10)}>
                      {adjusting && <Loader2 size={14} className="mr-1 animate-spin" />}
                      Apply
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Positive to receive stock (IN), negative to issue stock (OUT). Every change is recorded as a movement.
                  </p>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-2">Recent Movements</div>
                {loadingMovements ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <Loader2 size={14} className="animate-spin" /> Loading movements…
                  </div>
                ) : movements.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3">No stock movements yet.</div>
                ) : (
                  <div className="space-y-2">
                    {movements.slice(0, 10).map((m, idx) => {
                      const { sign, cls } = movementSign(m);
                      return (
                        <div key={m.movement_sno ?? idx} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{m.reason || m.movement_type}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatDate(m.created_at)}{m.reference_no ? ` · ${m.reference_no}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-xs font-semibold tabular-nums ${cls}`}>{sign}{Math.abs(m.quantity).toLocaleString('en-IN')}</div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">Bal: {m.balance_after.toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {(canEdit || canDelete) && item.status !== 'Discontinued' && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(item)}>
                        <Pencil size={14} className="mr-1.5" /> Edit Item
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline" size="sm"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 size={14} className="mr-1.5" /> Delete
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default InventoryDetailDrawer;
