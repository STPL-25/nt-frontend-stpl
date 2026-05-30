import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Boxes, Menu } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { TwoPaneLayout, EmptyState } from '@/CustomComponent/PageComponents';

import type { InventoryItem, StockMovement, InventoryFormState } from './Inventory/types';
import { TEMP_INVENTORY } from './Inventory/helpers';

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

  // ── Fetchers (temporary – using local mock data) ─────────────────────────────

  const fetchItems = useCallback(() => {
    setLoadingItems(true);
    setTimeout(() => {
      setItems(TEMP_INVENTORY);
      setLoadingItems(false);
    }, 300);
  }, []);

  const fetchMovements = useCallback((_item_sno: number) => {
    setLoadingMovements(true);
    setTimeout(() => {
      // Mock: movements are returned per item in real API
      setMovements([]);
      setLoadingMovements(false);
    }, 200);
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

  const handleSave = (form: InventoryFormState) => {
    // Validation
    if (!form.item_code.trim()) { toast.error('Item code is required'); return; }
    if (!form.item_name.trim()) { toast.error('Item name is required'); return; }
    if (!form.category)         { toast.error('Category is required'); return; }
    if (!form.uom)              { toast.error('Unit of measure is required'); return; }
    if (!form.warehouse)        { toast.error('Warehouse is required'); return; }
    if (form.min_stock > form.max_stock) { toast.error('Min stock cannot exceed max stock'); return; }

    setSaving(true);
    setTimeout(() => {
      if (isAddingNew) {
        const newItem: InventoryItem = {
          ...form,
          item_sno: Date.now(),
          category: form.category as InventoryItem['category'],
          status: form.status as InventoryItem['status'],
          created_at: new Date().toISOString(),
        };
        setItems(prev => [newItem, ...prev]);
        setSelectedItem(newItem);
        setIsAddingNew(false);
        toast.success(`Item "${form.item_name}" created successfully`);
      } else if (selectedItem) {
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
      setSaving(false);
    }, 400);
  };

  const handleDelete = (item: InventoryItem) => {
    if (!window.confirm(`Delete item "${item.item_name}"? This cannot be undone.`)) return;
    setItems(prev => prev.filter(i => i.item_sno !== item.item_sno));
    setSelectedItem(null);
    toast.success(`Item "${item.item_name}" deleted`);
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
