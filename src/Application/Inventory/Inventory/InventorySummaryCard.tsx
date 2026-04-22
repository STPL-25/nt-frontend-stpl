import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package, TrendingDown, AlertTriangle, Boxes } from 'lucide-react';
import type { InventoryItem } from './types';
import { formatINR } from './helpers';

interface InventorySummaryCardProps {
  items: InventoryItem[];
}

const InventorySummaryCard: React.FC<InventorySummaryCardProps> = ({ items }) => {
  const totalItems = items.length;
  const totalValue = items.reduce((s, i) => s + i.current_stock * i.cost_price, 0);
  const outOfStock = items.filter(i => i.current_stock <= 0).length;
  const lowStock = items.filter(i => i.current_stock > 0 && i.current_stock <= i.min_stock).length;

  const stats = [
    {
      icon: Boxes,
      label: 'Total Items',
      value: totalItems,
      sub: 'Active inventory items',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      icon: Package,
      label: 'Total Stock Value',
      value: formatINR(totalValue),
      sub: 'At cost price',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      icon: AlertTriangle,
      label: 'Low Stock',
      value: lowStock,
      sub: 'Below minimum level',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      icon: TrendingDown,
      label: 'Out of Stock',
      value: outOfStock,
      sub: 'Zero quantity',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(stat => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
                </div>
                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <Icon size={18} className={stat.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default InventorySummaryCard;
