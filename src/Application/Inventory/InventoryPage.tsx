import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Boxes, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

import type { InventoryItem, StockMovement, InventoryFormState } from './Inventory/types';
import {
  invSvcGetItems,
  invSvcCreateItem,
  invSvcUpdateItem,
  invSvcDeleteItem,
  invSvcGetMovements,
} from '@/Services/GrnService/inventoryApi';

import InventoryListSidebar from './Inventory/InventoryListSidebar';
import InventorySummaryCard from './Inventory/InventorySummaryCard';
import InventoryForm from './Inventory/InventoryForm';
import InventoryStockView from './Inventory/InventoryStockView';

// ── Main Component ────────────────────────────────────────────────────────────

const InventoryPage: React.FC = () => {
  useAppState(); // keep for auth context
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [saving, setSaving] = useState(false);

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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setIsAddingNew(true);
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    // keep selectedItem so view goes back to detail
  };

  const handleSave = async (form: InventoryFormState) => {
    // Validation
    if (!form.item_code.trim()) { toast.error('Item code is required'); return; }
    if (!form.item_name.trim()) { toast.error('Item name is required'); return; }
    if (!form.category)         { toast.error('Category is required'); return; }
    if (!form.uom)              { toast.error('Unit of measure is required'); return; }
    if (!form.warehouse)        { toast.error('Warehouse is required'); return; }
    if (form.min_stock > form.max_stock) { toast.error('Min stock cannot exceed max stock'); return; }

    setSaving(true);
    try {
      if (isAddingNew) {
        const res = await axios.post(invSvcCreateItem, form);
        const created = res.data?.data?.[0];
        const newItem: InventoryItem = {
          ...form,
          item_sno: created?.item_sno,
          item_code: created?.item_code ?? form.item_code,
          category: form.category as InventoryItem['category'],
          status: form.status as InventoryItem['status'],
          created_at: new Date().toISOString(),
        };
        setItems(prev => [newItem, ...prev]);
        setSelectedItem(newItem);
        setIsAddingNew(false);
        toast.success(`Item "${form.item_name}" created successfully`);
      } else if (selectedItem?.item_sno) {
        await axios.put(invSvcUpdateItem(selectedItem.item_sno), form);
        const updated: InventoryItem = {
          ...selectedItem,
          ...form,
          category: form.category as InventoryItem['category'],
          status: form.status as InventoryItem['status'],
          updated_at: new Date().toISOString(),
        };
        setItems(prev => prev.map(i => i.item_sno === updated.item_sno ? updated : i));
        setSelectedItem(updated);
        toast.success(`Item "${form.item_name}" updated successfully`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!item.item_sno) return;
    if (!window.confirm(`Delete item "${item.item_name}"? It will be marked as Discontinued.`)) return;
    try {
      await axios.delete(invSvcDeleteItem(item.item_sno));
      setItems(prev => prev.filter(i => i.item_sno !== item.item_sno));
      setSelectedItem(null);
      toast.success(`Item "${item.item_name}" deleted`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete item');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const showDetail = selectedItem || isAddingNew;

  return (
    <TwoPaneLayout
      icon={Boxes}
      title="Inventory Management"
      description="Manage stock items, levels, locations and movements"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      sidebar={
        <InventoryListSidebar
          items={items}
          loading={loadingItems}
          selectedItem={selectedItem}
          onSelectItem={(item) => { handleSelectItem(item); setSidebarOpen(false); }}
          onAddNew={canCreate("InventoryPage") ? handleAddNew : undefined}
        />
      }
      headerChildren={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} className="mr-1" /> Items
          </Button>
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
        </div>
      }
    >
      <div className="px-4 sm:px-6 py-5 space-y-4">
        <InventorySummaryCard items={items} />

        {!showDetail ? (
          <EmptyState
            message="Select an Item"
            description="Choose an item from the left panel to view details or add stock movements"
            icon={Boxes}
          />
        ) : (
          <>
            <InventoryForm
              selectedItem={selectedItem}
              isAddingNew={isAddingNew}
              onSave={(canCreate("InventoryPage") || canEdit("InventoryPage")) ? handleSave : undefined}
              onDelete={canDelete("InventoryPage") ? handleDelete : undefined}
              onCancel={handleCancel}
              saving={saving}
            />

            {selectedItem && !isAddingNew && (
              <InventoryStockView
                movements={movements}
                loading={loadingMovements}
              />
            )}
          </>
        )}
      </div>
    </TwoPaneLayout>
  );
};

export default InventoryPage;
