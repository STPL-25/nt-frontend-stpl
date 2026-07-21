import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Boxes, Plus, FileDown } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { PageHeader } from '@/CustomComponent/PageComponents';

import type { InventoryItem, StockMovement, InventoryFormState } from './Inventory/types';
import {
  invSvcGetItems,
  invSvcCreateItem,
  invSvcUpdateItem,
  invSvcDeleteItem,
  invSvcGetMovements,
  invSvcAdjustStock,
} from '@/Services/GrnService/inventoryApi';
import { socket, SOCKET_JOIN_INVENTORY, SOCKET_LEAVE_INVENTORY, SOCKET_INVENTORY_UPDATED } from '@/Services/Socket';

import InventorySummaryCard from './Inventory/InventorySummaryCard';
import InventoryTable, { displayStatus } from './Inventory/InventoryTable';
import InventoryDetailDrawer from './Inventory/InventoryDetailDrawer';
import InventoryItemDialog from './Inventory/InventoryItemDialog';

// ── CSV export ────────────────────────────────────────────────────────────────

const exportCsv = (rows: InventoryItem[], filename: string) => {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Item Code', 'Name', 'Company', 'Division', 'Branch', 'UoM', 'On Hand', 'Min Stock', 'Max Stock', 'Reorder Qty', 'Stock Value', 'Status'];
  const body = rows.map(r => [
    r.item_code, r.item_name, r.com_name ?? '', r.div_name ?? '', r.brn_name ?? '', r.uom,
    r.current_stock, r.min_stock, r.max_stock, r.reorder_qty,
    (r.current_stock * r.cost_price).toFixed(2), displayStatus(r),
  ].map(esc).join(','));
  const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Main Component ────────────────────────────────────────────────────────────

const InventoryPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await axios.get(invSvcGetItems);
      setItems(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load inventory items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const fetchMovements = useCallback(async (item_sno: number) => {
    setLoadingMovements(true);
    try {
      const res = await axios.get(invSvcGetMovements(item_sno));
      setMovements(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load stock movements');
    } finally {
      setLoadingMovements(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (selectedItem?.item_sno) fetchMovements(selectedItem.item_sno);
    else setMovements([]);
  }, [selectedItem?.item_sno, fetchMovements]);

  // ── Real-time: live stock updates (adjustments, GRN receipts, item CRUD) ─────

  const selectedItemRef = useRef<InventoryItem | null>(null);
  useEffect(() => { selectedItemRef.current = selectedItem; }, [selectedItem]);

  useEffect(() => {
    if (!socket) return;
    socket.emit(SOCKET_JOIN_INVENTORY);

    const onInventoryUpdated = (payload: { item?: any; movement?: any; action?: string }) => {
      const { item, movement, action } = payload ?? {};

      if (action === 'created' || action === 'updated') {
        // Broadcast payload is intentionally minimal for these — refetch for full fidelity.
        fetchItems();
        return;
      }

      if (action === 'deleted' && item?.item_sno) {
        setItems(prev => prev.map(i => i.item_sno === item.item_sno ? { ...i, status: 'Discontinued' } : i));
        return;
      }

      if ((action === 'adjusted' || action === 'grn_receipt') && movement?.item_sno) {
        setItems(prev => {
          const exists = prev.some(i => i.item_sno === movement.item_sno);
          if (exists) {
            return prev.map(i => i.item_sno === movement.item_sno
              ? { ...i, current_stock: movement.balance_after, warehouse: movement.warehouse ?? i.warehouse }
              : i);
          }
          // New item auto-created by a GRN receipt (sp_nt_UpsertInventoryItemByProduct
          // defaults) — insert it so it shows up without a manual refresh.
          if (item?.item_sno) {
            const synthesized: InventoryItem = {
              item_sno: item.item_sno,
              item_code: item.item_code,
              item_name: item.item_name,
              category: 'Raw Material',
              uom: item.uom ?? '',
              current_stock: movement.balance_after,
              min_stock: 0,
              max_stock: 0,
              reorder_qty: 0,
              warehouse: item.warehouse ?? movement.warehouse ?? '',
              cost_price: 0,
              selling_price: 0,
              status: 'Active',
            };
            return [synthesized, ...prev];
          }
          return prev;
        });

        if (selectedItemRef.current?.item_sno === movement.item_sno) {
          // The adjust handler may have already applied this movement from the
          // HTTP response — dedupe by movement_sno so it isn't listed twice.
          setMovements(prev =>
            movement.movement_sno != null && prev.some(m => m.movement_sno === movement.movement_sno)
              ? prev
              : [movement, ...prev]);
          setSelectedItem(prev => prev ? { ...prev, current_stock: movement.balance_after, warehouse: movement.warehouse ?? prev.warehouse } : prev);
        }
      }
    };

    socket.on(SOCKET_INVENTORY_UPDATED, onInventoryUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_INVENTORY);
      socket.off(SOCKET_INVENTORY_UPDATED, onInventoryUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchItems]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openAdd = () => { setEditingItem(null); setDialogOpen(true); };
  const openEdit = (item: InventoryItem) => { setEditingItem(item); setDialogOpen(true); };

  const handleSave = async (form: InventoryFormState) => {
    // Validation
    if (!form.item_code.trim()) { toast.error('Item code is required'); return; }
    if (!form.item_name.trim()) { toast.error('Item name is required'); return; }
    if (!form.category)         { toast.error('Category is required'); return; }
    if (!form.uom)              { toast.error('Unit of measure is required'); return; }
    if (!form.warehouse)        { toast.error('Warehouse is required'); return; }
    if (!form.com_sno)          { toast.error('Company is required'); return; }
    if (!form.div_sno)          { toast.error('Division is required'); return; }
    if (!form.brn_sno)          { toast.error('Branch is required'); return; }
    if (!form.dept_sno)         { toast.error('Department is required'); return; }
    if (form.min_stock > form.max_stock) { toast.error('Min stock cannot exceed max stock'); return; }

    setSaving(true);
    try {
      if (!editingItem) {
        const res = await axios.post(invSvcCreateItem, form);
        const created = res.data?.data?.[0];
        const newItem: InventoryItem = {
          ...form,
          item_sno: created?.item_sno,
          item_code: created?.item_code ?? form.item_code,
          category: form.category as InventoryItem['category'],
          status: form.status as InventoryItem['status'],
          com_sno: form.com_sno,
          div_sno: form.div_sno,
          brn_sno: form.brn_sno,
          dept_sno: form.dept_sno,
          created_at: new Date().toISOString(),
        };
        setItems(prev => [newItem, ...prev]);
        setDialogOpen(false);
        toast.success(`Item "${form.item_name}" created successfully`);
      } else if (editingItem.item_sno) {
        await axios.put(invSvcUpdateItem(editingItem.item_sno), form);
        const updated: InventoryItem = {
          ...editingItem,
          ...form,
          category: form.category as InventoryItem['category'],
          status: form.status as InventoryItem['status'],
          com_sno: form.com_sno,
          div_sno: form.div_sno,
          brn_sno: form.brn_sno,
          dept_sno: form.dept_sno,
          updated_at: new Date().toISOString(),
        };
        setItems(prev => prev.map(i => i.item_sno === updated.item_sno ? updated : i));
        setSelectedItem(prev => prev?.item_sno === updated.item_sno ? updated : prev);
        setDialogOpen(false);
        toast.success(`Item "${form.item_name}" updated successfully`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (item: InventoryItem, delta: number) => {
    if (!item.item_sno) return;
    setAdjusting(true);
    try {
      const res = await axios.post(invSvcAdjustStock, {
        item_sno: item.item_sno,
        movement_type: delta > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(delta),
        reason: 'Manual adjustment',
      });
      const movement: StockMovement | undefined = res.data?.data?.[0];
      if (movement?.balance_after != null) {
        setItems(prev => prev.map(i => i.item_sno === item.item_sno ? { ...i, current_stock: movement.balance_after } : i));
        setSelectedItem(prev => prev && prev.item_sno === item.item_sno ? { ...prev, current_stock: movement.balance_after } : prev);
        setMovements(prev =>
          movement.movement_sno != null && prev.some(m => m.movement_sno === movement.movement_sno)
            ? prev
            : [movement, ...prev]);
      } else {
        // Response shape unknown — fall back to refetching.
        fetchItems();
        fetchMovements(item.item_sno);
      }
      toast.success(`Stock ${delta > 0 ? 'received' : 'issued'}: ${Math.abs(delta)} ${item.uom}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!item.item_sno) return;
    if (!window.confirm(`Delete item "${item.item_name}"? It will be marked as Discontinued.`)) return;
    try {
      await axios.delete(invSvcDeleteItem(item.item_sno));
      setItems(prev => prev.filter(i => i.item_sno !== item.item_sno));
      setSelectedItem(prev => prev?.item_sno === item.item_sno ? null : prev);
      toast.success(`Item "${item.item_name}" deleted`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete item');
    }
  };

  const handleBulkDelete = async (toDelete: InventoryItem[]) => {
    const deletable = toDelete.filter(i => i.item_sno != null);
    if (deletable.length === 0) return;
    if (!window.confirm(`Delete ${deletable.length} item(s)? They will be marked as Discontinued.`)) return;
    const results = await Promise.allSettled(deletable.map(i => axios.delete(invSvcDeleteItem(i.item_sno!))));
    const okIds = new Set(deletable.filter((_, idx) => results[idx].status === 'fulfilled').map(i => i.item_sno));
    const failed = deletable.length - okIds.size;
    if (okIds.size > 0) {
      setItems(prev => prev.filter(i => !okIds.has(i.item_sno)));
      setSelectedItem(prev => prev && okIds.has(prev.item_sno) ? null : prev);
      toast.success(`${okIds.size} item(s) deleted`);
    }
    if (failed > 0) toast.error(`Failed to delete ${failed} item(s)`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={Boxes}
        title="Inventory"
        description="Track stock levels, values and reorder needs across all warehouses"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={fetchItems}
            disabled={loadingItems}
          >
            <RefreshCw size={15} className={loadingItems ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => exportCsv(items, 'inventory-export.csv')}
            disabled={items.length === 0}
          >
            <FileDown size={15} className="mr-1" /> Export CSV
          </Button>
          {canCreate('InventoryPage') && (
            <Button
              size="sm"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              onClick={openAdd}
            >
              <Plus size={15} className="mr-1" /> Add Item
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
        <InventorySummaryCard items={items} />
        <InventoryTable
          items={items}
          loading={loadingItems}
          onOpenItem={setSelectedItem}
          canDelete={canDelete('InventoryPage')}
          onBulkDelete={handleBulkDelete}
          onExportSelected={rows => exportCsv(rows, 'inventory-selected.csv')}
        />
      </div>

      <InventoryDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        movements={movements}
        loadingMovements={loadingMovements}
        canAdjust={canEdit('InventoryPage')}
        adjusting={adjusting}
        onAdjust={handleAdjust}
        canEdit={canEdit('InventoryPage')}
        onEdit={openEdit}
        canDelete={canDelete('InventoryPage')}
        onDelete={handleDelete}
      />

      <InventoryItemDialog
        open={dialogOpen}
        item={editingItem}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSave}
      />
    </div>
  );
};

export default InventoryPage;
