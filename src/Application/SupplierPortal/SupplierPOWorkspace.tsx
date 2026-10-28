import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Package, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import { DetailEmptyState, FilterChips, SearchInput, SelectableCard, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { cn } from '@/lib/utils';
import { supplierAxios, supplierGetPOs, type SupplierPOListItem } from '@/Services/SupplierService';
import SupplierPODetail from './SupplierPODetail';
import { formatDate } from './helpers';

interface Props {
  initialSelected?: number;
  onDispatch: (po_basic_sno: number) => void;
}

type Filter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'DISPATCHED';

const isAccepted = (p: SupplierPOListItem) => p.supplier_ack_status === 'Accepted';

/**
 * The supplier's purchase orders, laid out like the staff screens (Payment, approvals): the list on the left (filter, search, one
 * card per order), the selected order on the right.
 */
const SupplierPOWorkspace: React.FC<Props> = ({ initialSelected, onDispatch }) => {
  const [pos, setPOs] = useState<SupplierPOListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | undefined>(initialSelected);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierAxios.get(supplierGetPOs);
      setPOs(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  const count = useMemo(() => ({
    ALL: pos.length,
    PENDING: pos.filter((p) => !isAccepted(p)).length,
    ACCEPTED: pos.filter(isAccepted).length,
    DISPATCHED: pos.filter((p) => p.dispatch_count > 0).length,
  }), [pos]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pos.filter((p) => {
      if (filter === 'PENDING' && isAccepted(p)) return false;
      if (filter === 'ACCEPTED' && !isAccepted(p)) return false;
      if (filter === 'DISPATCHED' && !(p.dispatch_count > 0)) return false;
      return !q || [p.po_no, p.com_name].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [pos, filter, search]);

  const current = pos.find((p) => p.po_basic_sno === selected);

  return (
    <SidebarDetailLayout
      sidebarTitle="Purchase Orders"
      sidebarCount={rows.length}
      sidebarCountLabel="order"
      sidebarCountQualifier="issued"
      mobileListLabel="Orders"
      mobileSelectionTitle={current?.po_no}
      hasSelection={selected != null}
      listItems={(closeSheet) => (
        <>
          <div className="sticky top-0 z-10 -mx-2 -mt-2 space-y-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All', count: count.ALL },
                { value: 'PENDING', label: 'To accept', count: count.PENDING },
                { value: 'ACCEPTED', label: 'Accepted', count: count.ACCEPTED },
                { value: 'DISPATCHED', label: 'Dispatched', count: count.DISPATCHED },
              ]}
            />
            <div className="flex items-center gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder="Search PO number or company…" className="min-w-0 flex-1" />
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={fetchPOs} disabled={loading} aria-label="Refresh list">
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
          {loading && pos.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {pos.length === 0 ? 'No purchase orders issued to you yet.' : 'No matches found'}
            </p>
          ) : rows.map((po) => {
            const active = po.po_basic_sno === selected;
            return (
              <SelectableCard key={po.po_basic_sno} selected={active} onClick={() => { setSelected(po.po_basic_sno); closeSheet(); }}>
                <span className="flex items-start justify-between gap-2">
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-semibold">{po.po_no}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{po.com_name ?? '—'}</span>
                  </span>
                  <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', active ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
                </span>
                <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {isAccepted(po) ? <StatusPill tone="success">Accepted</StatusPill> : <StatusPill tone="warning">Awaiting your acceptance</StatusPill>}
                  {po.dispatch_count > 0 && <StatusPill tone="info">{po.dispatch_count} dispatched</StatusPill>}
                </span>
                <span className="mt-3 block space-y-1 text-xs">
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">Ordered</span><span className="font-medium">{formatDate(po.po_date)}</span></span>
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">Required by</span><span className="font-medium">{formatDate(po.required_date)}</span></span>
                </span>
              </SelectableCard>
            );
          })}
        </>
      )}
      detailContent={selected != null ? <SupplierPODetail key={selected} po_basic_sno={selected} onDispatch={onDispatch} onChanged={fetchPOs} /> : null}
      emptyContent={(
        <DetailEmptyState
          icon={Package}
          title={pos.length === 0 && !loading ? 'No purchase orders yet' : 'Select a purchase order'}
          description="Choose an order from the list to see what was ordered, accept it and record its dispatches."
        />
      )}
    />
  );
};

export default SupplierPOWorkspace;
