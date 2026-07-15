import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, PackageSearch, FileText, Truck, CalendarDays, DoorOpen } from 'lucide-react';
import type { PORecord } from './types';
import { getPODisplayNo, formatDate as formatGRNDate, getPOItems } from '@/Application/GRN/GRN/helpers';

interface GateEntryPOSearchProps {
  poList: PORecord[];
  onStartGateEntry: (po: PORecord) => void;
}

const GateEntryPOSearch: React.FC<GateEntryPOSearchProps> = ({ poList, onStartGateEntry }) => {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const match = useMemo(() => {
    if (!searched) return null;
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return poList.find(po => (po.po_no ?? '').toLowerCase() === q) ?? null;
  }, [poList, query, searched]);

  const notFound = searched && query.trim() !== '' && !match;

  const handleSearch = () => setSearched(true);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PackageSearch size={16} className="text-primary" />
            Find Purchase Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">PO Number</Label>
              <Input
                list="gate-po-suggestions"
                placeholder="e.g. PO-2026-002"
                value={query}
                onChange={e => { setQuery(e.target.value); setSearched(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                className="h-9 text-sm"
              />
              <datalist id="gate-po-suggestions">
                {poList.map(po => <option key={po.po_basic_sno} value={po.po_no} />)}
              </datalist>
            </div>
            <Button size="sm" onClick={handleSearch} disabled={!query.trim()}>
              <Search size={14} className="mr-1" /> Search
            </Button>
          </div>
          {notFound && (
            <p className="text-xs text-red-600 mt-2">
              No purchase order found for "{query.trim()}". Check the PO number and try again.
            </p>
          )}
        </CardContent>
      </Card>

      {match && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              Purchase Order — {getPODisplayNo(match)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Vendor</p>
                <p className="text-sm font-medium text-foreground">{match.vendor_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Truck size={11} /> Company
                </p>
                <p className="text-sm font-medium text-foreground">{match.com_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarDays size={11} /> PO Date
                </p>
                <p className="text-sm font-medium text-foreground">{formatGRNDate(match.po_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarDays size={11} /> Required By
                </p>
                <p className="text-sm font-medium text-foreground">{formatGRNDate(match.required_date)}</p>
              </div>
            </div>

            {getPOItems(match).length > 0 && (
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Item</th>
                      <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Ordered Qty</th>
                      <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPOItems(match).map((item, idx) => (
                      <tr key={item.po_item_sno ?? idx} className="border-t">
                        <td className="px-2.5 py-1.5 text-foreground">{item.prod_name}</td>
                        <td className="px-2.5 py-1.5 text-foreground">{item.ordered_qty ?? item.qty ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-foreground">{item.unit_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={() => onStartGateEntry(match)}>
                <DoorOpen size={14} className="mr-1" /> Gate Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GateEntryPOSearch;
