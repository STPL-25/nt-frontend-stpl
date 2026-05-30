import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Scissors, Package, CheckSquare, X, Info, PackageOpen,
} from 'lucide-react';
import type { POConfirmItem } from './types';
import { formatINR } from './helpers';

// ── Split group colour palette (mirrors POConfirmStep / QuotationsTab) ────────
const GROUP_COLORS = [
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  badge: 'bg-indigo-600'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-500'  },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  badge: 'bg-purple-600'  },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    badge: 'bg-pink-500'    },
];
const gc = (g: number) => GROUP_COLORS[(g - 1) % GROUP_COLORS.length];

const itemEst = (it: POConfirmItem) => (Number(it.est_cost ?? 0) * Number(it.qty ?? 0)) || 0;

interface SplitPRTabProps {
  prNo: string;
  /** Confirmed items (POConfirmStep output). Items with a split_group form separate POs. */
  items: POConfirmItem[];
  /** Replace the full item list (split_group flags updated) in the parent. */
  onItemsChange: (items: POConfirmItem[]) => void;
  /** Best-effort backend persistence each time a new split group is created. */
  onGroupPersist?: (groupNo: number, groupItems: POConfirmItem[]) => void;
}

const SplitPRTab: React.FC<SplitPRTabProps> = ({
  prNo, items, onItemsChange, onGroupPersist,
}) => {
  // Selection works on the IDs of currently-available (unsplit) items
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Items still available to split (no group yet) — split items disappear from here
  const availableItems = useMemo(
    () => items.filter(i => !i.split_group),
    [items],
  );

  // Split POs, grouped by split_group number, in creation order
  const splitGroups = useMemo(() => {
    const map = new Map<number, POConfirmItem[]>();
    items.forEach(i => {
      if (i.split_group) {
        if (!map.has(i.split_group)) map.set(i.split_group, []);
        map.get(i.split_group)!.push(i);
      }
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([groupNo, groupItems]) => ({ groupNo, items: groupItems }));
  }, [items]);

  const nextGroupNo = useMemo(
    () => splitGroups.reduce((max, g) => Math.max(max, g.groupNo), 0) + 1,
    [splitGroups],
  );

  // ── Selection helpers ───────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === availableItems.length
        ? new Set()
        : new Set(availableItems.map(i => i.id)),
    );
  };

  // ── Split / unsplit actions ─────────────────────────────────────────────────
  const handleSplit = () => {
    if (selectedIds.size === 0) return;
    const groupNo = nextGroupNo;
    const updated = items.map(i =>
      selectedIds.has(i.id) ? { ...i, split_group: groupNo } : i,
    );
    onItemsChange(updated);
    onGroupPersist?.(groupNo, updated.filter(i => i.split_group === groupNo));
    setSelectedIds(new Set());
  };

  const dissolveGroup = (groupNo: number) => {
    onItemsChange(items.map(i =>
      i.split_group === groupNo ? { ...i, split_group: undefined } : i,
    ));
  };

  const removeItemFromGroup = (id: string) => {
    onItemsChange(items.map(i =>
      i.id === id ? { ...i, split_group: undefined } : i,
    ));
  };

  const mainPOItems = availableItems; // unsplit remainder = the main PO
  const allSelected = availableItems.length > 0 && selectedIds.size === availableItems.length;

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-3">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p className="text-gray-600">
          Tick the items you want to break out, then click <strong>Split</strong>. Each split becomes a
          separate PO (<strong>{prNo}/Group&nbsp;1</strong>, <strong>{prNo}/Group&nbsp;2</strong>, …) and its
          items drop off the list below. Pick a supplier and add a quotation for every PO in the section underneath.
        </p>
      </div>

      {/* ── Live split-PO list ───────────────────────────────────────────────── */}
      {(splitGroups.length > 0 || mainPOItems.length > 0) && (
        <div className="space-y-2">
          {splitGroups.map(({ groupNo, items: gItems }) => {
            const col = gc(groupNo);
            const est = gItems.reduce((s, it) => s + itemEst(it), 0);
            return (
              <div
                key={groupNo}
                className={`rounded-lg border p-2.5 ${col.bg} ${col.border}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${col.badge} text-white border-none text-[10px] shrink-0`}>
                    {prNo}/Group {groupNo}
                  </Badge>
                  <span className="text-xs text-gray-500">{gItems.length} item(s) → separate PO</span>
                  {est > 0 && (
                    <span className="text-xs text-gray-500 ml-auto">Est: {formatINR(est)}</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => dissolveGroup(groupNo)}
                  >
                    <X size={12} className="mr-0.5" /> Dissolve
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {gItems.map(it => (
                    <span
                      key={it.id}
                      className={`inline-flex items-center gap-1 text-[11px] bg-white/70 border ${col.border} rounded px-1.5 py-0.5`}
                    >
                      <span className="font-medium text-gray-700">{it.prod_name}</span>
                      <span className="text-gray-400">{it.qty} {it.unit_name}</span>
                      <button
                        type="button"
                        title="Move back to main PO"
                        className="text-gray-300 hover:text-red-500"
                        onClick={() => removeItemFromGroup(it.id)}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Main PO — the unsplit remainder */}
          {splitGroups.length > 0 && mainPOItems.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-gray-500 text-white border-none text-[10px] shrink-0">Main PO</Badge>
                <span className="text-xs text-gray-500">{mainPOItems.length} item(s) kept together</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Available items to split ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 border-b bg-gray-50/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Package size={15} className="text-orange-600" />
              Items {splitGroups.length > 0 ? '(remaining)' : ''}
              <Badge variant="outline" className="text-xs">{availableItems.length}</Badge>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                <CheckSquare size={14} className="text-indigo-600 shrink-0" />
                <span className="text-xs font-medium text-indigo-700">{selectedIds.size} selected</span>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleSplit}
                >
                  <Scissors size={12} className="mr-1" />
                  Split into {prNo}/Group {nextGroupNo}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-gray-500"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {availableItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
              <PackageOpen size={26} />
              <p className="text-sm">All items have been split into separate POs.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10 pl-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all items"
                    />
                  </TableHead>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs min-w-[160px]">Item</TableHead>
                  <TableHead className="text-xs w-24 text-center">Qty</TableHead>
                  <TableHead className="text-xs w-16 text-center">UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableItems.map((item, idx) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer select-none ${isChecked ? 'bg-indigo-50/70' : ''}`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <TableCell className="pl-3 py-2" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.prod_name}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-400 pl-3">{idx + 1}</TableCell>
                      <TableCell className="py-2">
                        <div className="text-sm font-medium leading-tight">{item.prod_name || '—'}</div>
                        {item.specification && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[220px]">
                            {item.specification}
                          </div>
                        )}
                        {item.est_cost ? (
                          <div className="text-[11px] text-gray-400">Est: {formatINR(Number(item.est_cost))}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium py-2">{item.qty}</TableCell>
                      <TableCell className="text-center text-xs py-2">{item.unit_name || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SplitPRTab;
