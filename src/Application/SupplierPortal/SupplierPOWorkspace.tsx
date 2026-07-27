import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Package, ChevronRight, Clock, CheckCircle2, Truck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/utils/statusUtils';
import { TwoPaneLayout, EmptyState, LoadingState } from '@/CustomComponent/PageComponents';
import { supplierAxios, supplierGetPOs, type SupplierPOListItem } from '@/Services/SupplierService';
import SupplierPODetail from './SupplierPODetail';
import { formatDate } from './helpers';

interface Props {
  initialSelected?: number;
  onDispatch: (po_basic_sno: number) => void;
}

function POListCard({ po, isSelected, onClick }: { po: SupplierPOListItem; isSelected: boolean; onClick: () => void }) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border ${
        isSelected
          ? 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10 border-primary/30'
          : 'border-border hover:border-primary/20 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-sm">{po.po_no}</span>
            <StatusBadge status={po.supplier_ack_status ?? 'Pending'} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{po.com_name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">
            Order {formatDate(po.po_date)} · Due {formatDate(po.required_date)}
          </p>
        </div>
        <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} />
      </CardContent>
    </Card>
  );
}

const SupplierPOWorkspace: React.FC<Props> = ({ initialSelected, onDispatch }) => {
  const [pos, setPOs] = useState<SupplierPOListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | undefined>(initialSelected);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const stats = useMemo(
    () => [
      { label: 'Total', value: pos.length, icon: Package },
      { label: 'Pending', value: pos.filter((p) => p.supplier_ack_status !== 'Accepted').length, icon: Clock },
      { label: 'Accepted', value: pos.filter((p) => p.supplier_ack_status === 'Accepted').length, icon: CheckCircle2 },
      { label: 'Dispatched', value: pos.filter((p) => p.dispatch_count > 0).length, icon: Truck },
    ],
    [pos]
  );

  const handleSelect = (po_basic_sno: number) => {
    setSelected(po_basic_sno);
    setSidebarOpen(false);
  };

  return (
    <TwoPaneLayout
      icon={Package}
      title="Purchase Orders"
      description="Review purchase orders issued to you, accept them, and record dispatches."
      stats={stats}
      sidebar={
        <div className="flex h-full flex-col">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3 sm:p-4">
            <div>
              <h2 className="text-sm font-bold sm:text-base">Purchase Orders</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pos.length} order{pos.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchPOs} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {pos.length === 0 && !loading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No purchase orders issued to you yet.</p>
              ) : (
                <div className="space-y-2 p-2 sm:p-3">
                  {pos.map((po) => (
                    <POListCard
                      key={po.po_basic_sno}
                      po={po}
                      isSelected={selected === po.po_basic_sno}
                      onClick={() => handleSelect(po.po_basic_sno)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      }
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
    >
      <div className="p-3 sm:p-6">
        {loading && pos.length === 0 ? (
          <LoadingState message="Loading purchase orders…" />
        ) : selected ? (
          <SupplierPODetail key={selected} po_basic_sno={selected} onDispatch={onDispatch} />
        ) : (
          <EmptyState
            icon={Package}
            message="Select a purchase order"
            description="Choose a PO from the list to view its details."
          />
        )}
      </div>
    </TwoPaneLayout>
  );
};

export default SupplierPOWorkspace;
