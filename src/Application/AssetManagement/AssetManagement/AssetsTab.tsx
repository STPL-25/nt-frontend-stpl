import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, RotateCcw, Wrench, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { AssetRow } from '@/Services/GrnService/assetApi';
import { fmtDate } from './helpers';

interface Props {
  rows: AssetRow[];
  loading: boolean;
  canRaise: boolean;
  onReturn: (row: AssetRow) => void;
  onService: (row: AssetRow) => void;
}

interface ProductGroup {
  item_sno: number;
  item_name: string;
  item_code: string;
  uom: string;
  category: string | null;
  inUse: number;
  latest: string | null;
  depts: string[];
  lines: AssetRow[];
}

const ALL = '__all__';

const AssetsTab: React.FC<Props> = ({ rows, loading, canRaise, onReturn, onService }) => {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState(ALL);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const deptOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.dept_name ?? 'Unassigned'))).sort(),
    [rows],
  );

  const groups = useMemo<ProductGroup[]>(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<number, ProductGroup>();
    for (const r of rows) {
      const d = r.dept_name ?? 'Unassigned';
      if (dept !== ALL && d !== dept) continue;
      if (q && !`${r.item_name} ${r.item_code} ${r.issue_ref} ${d}`.toLowerCase().includes(q)) continue;
      let g = map.get(r.item_sno);
      if (!g) {
        g = {
          item_sno: r.item_sno, item_name: r.item_name, item_code: r.item_code, uom: r.uom,
          category: r.category, inUse: 0, latest: null, depts: [], lines: [],
        };
        map.set(r.item_sno, g);
      }
      g.inUse += r.in_use_qty;
      g.lines.push(r);
      if (!g.depts.includes(d)) g.depts.push(d);
      if (r.issue_date && (!g.latest || r.issue_date > g.latest)) g.latest = r.issue_date;
    }
    return Array.from(map.values()).sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [rows, search, dept]);

  const toggle = (id: number) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search product, code, issue no or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="All departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {deptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No assets in use. Non-Regular items appear here once they are issued to a department.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Departments</th>
                <th className="px-3 py-2 font-medium text-right">In use</th>
                <th className="px-3 py-2 font-medium">Last issued</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const isOpen = open.has(g.item_sno);
                return (
                  <React.Fragment key={g.item_sno}>
                    <tr className="cursor-pointer border-b hover:bg-muted/30" onClick={() => toggle(g.item_sno)}>
                      <td className="px-3 py-2">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {g.item_name} <span className="font-normal text-muted-foreground">{g.item_code}</span>
                      </td>
                      <td className="px-3 py-2">{g.category ?? '—'}</td>
                      <td className="px-3 py-2">{g.depts.join(', ')}</td>
                      <td className="px-3 py-2 text-right font-semibold">{g.inUse} {g.uom}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(g.latest)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b bg-muted/20">
                        <td />
                        <td colSpan={5} className="px-3 py-2">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-muted-foreground">
                                <th className="py-1 pr-3 font-medium">Department</th>
                                <th className="py-1 pr-3 font-medium">Issue date</th>
                                <th className="py-1 pr-3 font-medium">Issue no.</th>
                                <th className="py-1 pr-3 font-medium text-right">Issued</th>
                                <th className="py-1 pr-3 font-medium text-right">In use</th>
                                <th className="py-1 pr-3 font-medium">Returned / Service</th>
                                <th className="py-1 pr-3 font-medium">Received by</th>
                                <th className="py-1" />
                              </tr>
                            </thead>
                            <tbody>
                              {g.lines.map(l => (
                                <tr key={l.sr_item_sno} className="border-t">
                                  <td className="py-1.5 pr-3">{l.dept_name ?? 'Unassigned'}</td>
                                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(l.issue_date)}</td>
                                  <td className="py-1.5 pr-3 whitespace-nowrap">{l.issue_ref}</td>
                                  <td className="py-1.5 pr-3 text-right">{l.issued_qty}</td>
                                  <td className="py-1.5 pr-3 text-right font-medium">{l.in_use_qty}</td>
                                  <td className="py-1.5 pr-3 text-muted-foreground">
                                    {l.returned_qty > 0 && <>Return {l.returned_qty} </>}
                                    {l.service_qty > 0 && <>Service {l.service_qty}</>}
                                    {l.returned_qty === 0 && l.service_qty === 0 && '—'}
                                  </td>
                                  <td className="py-1.5 pr-3">{l.received_by_name ?? l.received_by_ecno ?? '—'}</td>
                                  <td className="py-1.5 text-right whitespace-nowrap">
                                    {canRaise && l.in_use_qty > 0 && (
                                      <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => onReturn(l)}>
                                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Return
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => onService(l)}>
                                          <Wrench className="mr-1 h-3.5 w-3.5" /> Service
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AssetsTab;
