import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, FileDown, Search, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/utils/statusUtils';
import type { InventoryItem } from './types';
import { formatINR, getStockStatus } from './helpers';

type SortKey = 'item_name' | 'com_name' | 'div_name' | 'brn_name' | 'current_stock' | 'reorder_qty' | 'value';
type SortDir = 'asc' | 'desc';

const STOCK_STATUS_OPTIONS = ['In Stock', 'Low Stock', 'Out of Stock', 'Overstocked', 'Discontinued'];

export const displayStatus = (item: InventoryItem): string =>
  item.status === 'Discontinued' ? 'Discontinued' : getStockStatus(item).label;

const initials = (name: string): string =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

const sortValue = (item: InventoryItem, key: SortKey): string | number =>
  key === 'value' ? item.current_stock * item.cost_price : (item[key] ?? '');

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  onOpenItem: (item: InventoryItem) => void;
  canDelete: boolean;
  onBulkDelete: (items: InventoryItem[]) => void;
  onExportSelected: (items: InventoryItem[]) => void;
}

const InventoryTable: React.FC<InventoryTableProps> = ({
  items, loading, onOpenItem, canDelete, onBulkDelete, onExportSelected,
}) => {
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('item_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const uniq = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean) as string[])].sort();

  const companies = useMemo(() => uniq(items.map(i => i.com_name)), [items]);
  // Division / branch options cascade off the selections above them so the
  // dropdowns never offer a combination that yields zero rows.
  const divisions = useMemo(
    () => uniq(items.filter(i => filterCompany === 'All' || i.com_name === filterCompany).map(i => i.div_name)),
    [items, filterCompany],
  );
  const branches = useMemo(
    () => uniq(items
      .filter(i => (filterCompany === 'All' || i.com_name === filterCompany)
        && (filterDivision === 'All' || i.div_name === filterDivision))
      .map(i => i.brn_name)),
    [items, filterCompany, filterDivision],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dir = sortDir === 'asc' ? 1 : -1;
    return items
      .filter(it => {
        const matchesQ = !q || it.item_name.toLowerCase().includes(q) || it.item_code.toLowerCase().includes(q);
        const matchesCom = filterCompany === 'All' || it.com_name === filterCompany;
        const matchesDiv = filterDivision === 'All' || it.div_name === filterDivision;
        const matchesBrn = filterBranch === 'All' || it.brn_name === filterBranch;
        const matchesStatus = filterStatus === 'All' || displayStatus(it) === filterStatus;
        return matchesQ && matchesCom && matchesDiv && matchesBrn && matchesStatus;
      })
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
        return ((av as number) - (bv as number)) * dir;
      });
  }, [items, search, filterCompany, filterDivision, filterBranch, filterStatus, sortKey, sortDir]);

  // Selection entries for items no longer in the list are simply ignored here,
  // so bulk delete / refetch never leaves phantom selections behind.
  const selectedItems = useMemo(
    () => items.filter(i => i.item_sno != null && selected[i.item_sno]),
    [items, selected],
  );
  const allSelected = rows.length > 0 && rows.every(r => r.item_sno != null && selected[r.item_sno]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleSelectAll = () => {
    if (allSelected) { setSelected({}); return; }
    const next: Record<number, boolean> = {};
    rows.forEach(r => { if (r.item_sno != null) next[r.item_sno] = true; });
    setSelected(next);
  };

  const SortHead: React.FC<{ label: string; k: SortKey; right?: boolean }> = ({ label, k, right }) => (
    <TableHead
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k
          ? (sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
          : <ArrowUpDown size={13} className="opacity-40" />}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      {/* Filters + bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or item code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={filterCompany}
          onValueChange={v => { setFilterCompany(v); setFilterDivision('All'); setFilterBranch('All'); }}
        >
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDivision} onValueChange={v => { setFilterDivision(v); setFilterBranch('All'); }}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Divisions</SelectItem>
            {divisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Branches</SelectItem>
            {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            {STOCK_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {selectedItems.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
            <span className="text-xs font-semibold text-primary">{selectedItems.length} selected</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onExportSelected(selectedItems)}>
              <FileDown size={13} className="mr-1" /> Export
            </Button>
            {canDelete && (
              <Button
                variant="outline" size="sm"
                className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20"
                onClick={() => onBulkDelete(selectedItems)}
              >
                <Trash2 size={13} className="mr-1" /> Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground" onClick={() => setSelected({})}>
              <X size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-x-auto py-0">
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
              </TableHead>
              <SortHead label="Product" k="item_name" />
              <TableHead className="whitespace-nowrap">Bin</TableHead>
              <TableHead className="whitespace-nowrap">Stock location_name</TableHead>
              <SortHead label="On Hand" k="current_stock" right />
              <TableHead className="text-right whitespace-nowrap">Min Stock</TableHead>
              <SortHead label="Reorder Qty" k="reorder_qty" right />
              <SortHead label="Value" k="value" right />
              <TableHead className="whitespace-nowrap">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(item => {
              const isSelected = item.item_sno != null && !!selected[item.item_sno];
              return (
                <TableRow
                  key={item.item_sno ?? item.item_code}
                  onClick={() => onOpenItem(item)}
                  className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        if (item.item_sno == null) return;
                        setSelected(prev => ({ ...prev, [item.item_sno!]: !prev[item.item_sno!] }));
                      }}
                      aria-label={`Select ${item.item_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {initials(item.item_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.item_name}</div>
                        <div className="text-xs text-muted-foreground">{item.item_code}</div>
                      </div>
                    </div>
                  </TableCell>
                  {/* <TableCell className="text-muted-foreground">{item.com_name || '—'}</TableCell> */}
                  <TableCell className="text-muted-foreground">{item.location_code || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{item.location_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.current_stock.toLocaleString('en-IN')}
                    <span className="text-xs text-muted-foreground ml-1">{item.uom}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{item.min_stock.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{item.reorder_qty.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatINR(item.current_stock * item.cost_price)}</TableCell>
                  <TableCell><StatusBadge status={displayStatus(item)} withDot /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {loading ? 'Loading inventory…' : 'No items match your search or filters.'}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InventoryTable;
