import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Package, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InventoryItem } from './types';
import { getStockStatus } from './helpers';

interface InventoryListSidebarProps {
  items: InventoryItem[];
  loading: boolean;
  selectedItem: InventoryItem | null;
  onSelectItem: (item: InventoryItem) => void;
  onAddNew?: () => void;
}

const statusBadge: Record<string, string> = {
  green: 'bg-green-100 text-green-700 border-green-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  red:   'bg-red-100   text-red-700   border-red-200',
};

const InventoryListSidebar: React.FC<InventoryListSidebarProps> = ({
  items, loading, selectedItem, onSelectItem, onAddNew,
}) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(i => i.category)));
    return ['All', ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(item => {
      const matchSearch = !q ||
        item.item_code.toLowerCase().includes(q) ||
        item.item_name.toLowerCase().includes(q) ||
        (item.sub_category ?? '').toLowerCase().includes(q);
      const matchCategory = filterCategory === 'All' || item.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [items, search, filterCategory]);

  const lowStockCount = items.filter(i => i.current_stock <= i.min_stock).length;
  const outOfStockCount = items.filter(i => i.current_stock <= 0).length;

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items ({items.length})</span>
        {onAddNew && (
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={onAddNew}>
            <Plus size={13} className="mr-1" /> Add Item
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b bg-gray-50 flex gap-3 text-xs font-medium flex-wrap">
        {outOfStockCount > 0 && <span className="text-red-600">{outOfStockCount} out of stock</span>}
        {lowStockCount > 0 && <span className="text-amber-600">{lowStockCount} low stock</span>}
        {outOfStockCount === 0 && lowStockCount === 0 && (
          <span className="text-green-600">All items healthy</span>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search item code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="px-3 py-2 border-b flex gap-1.5 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              filterCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Loading items...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <Package size={22} />
            <span className="text-sm">No items found</span>
          </div>
        ) : (
          filtered.map((item) => {
            const isActive = selectedItem?.item_sno === item.item_sno;
            const { label, color } = getStockStatus(item);

            return (
              <button
                key={item.item_sno ?? item.item_code}
                onClick={() => onSelectItem(item)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-indigo-50 transition-colors border-l-4 ${
                  isActive ? 'bg-indigo-50 border-l-indigo-600' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-mono text-indigo-600 font-semibold">{item.item_code}</span>
                  <Badge className={`text-xs shrink-0 ml-1 py-0 ${statusBadge[color]}`}>{label}</Badge>
                </div>
                <div className="text-sm font-medium text-gray-800 truncate">{item.item_name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{item.category}</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {item.current_stock} {item.uom}
                    <ChevronRight size={12} className="inline ml-0.5 text-gray-400" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InventoryListSidebar;
