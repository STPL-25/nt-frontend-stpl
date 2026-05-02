import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Boxes } from 'lucide-react';
import { useAppState } from '@/globalState/hooks/useAppState';
import { usePermissions } from '@/globalState/hooks/usePermissions';

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
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Boxes className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-sm text-gray-500">Manage stock items, levels, locations and movements</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchItems} disabled={loadingItems}>
          <RefreshCw size={15} className={loadingItems ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT: Item List Sidebar */}
        <InventoryListSidebar
          items={items}
          loading={loadingItems}
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          onAddNew={canCreate("InventoryPage") ? handleAddNew : undefined}
        />

        {/* RIGHT: Main content */}
        <div className="flex-1 overflow-y-auto">
          {!showDetail ? (
            /* Dashboard overview when nothing selected */
            <div className="px-6 py-5 space-y-4">
              <InventorySummaryCard items={items} />

              <div className="flex flex-col items-center justify-center h-48 gap-4 text-gray-400">
                <div className="bg-gray-100 p-5 rounded-full">
                  <Boxes size={36} />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-gray-500">Select an Item</p>
                  <p className="text-sm mt-1">Choose an item from the left panel to view details or add stock movements</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {/* Summary stats always visible */}
              <InventorySummaryCard items={items} />

              {/* Item Form (add/edit/view) */}
              <InventoryForm
                selectedItem={selectedItem}
                isAddingNew={isAddingNew}
                onSave={(canCreate("InventoryPage") || canEdit("InventoryPage")) ? handleSave : undefined}
                onDelete={canDelete("InventoryPage") ? handleDelete : undefined}
                onCancel={handleCancel}
                saving={saving}
              />

              {/* Stock Movement History — only when viewing existing item */}
              {selectedItem && !isAddingNew && (
                <InventoryStockView
                  movements={movements}
                  loading={loadingMovements}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
