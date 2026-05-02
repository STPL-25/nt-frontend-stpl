import React, { useState, useEffect, useMemo } from "react";
import DynamicTable from "@/LayoutComponent/DynamicTable";
import ViewMode from "@/CustomComponent/ViewModes/ViewMode";
import CategoryCard from "@/CustomComponent/MasterComponents/CatagoryCard";
import ItemGridCard from "@/CustomComponent/MasterComponents/ItemGridCard";
import { useAppState } from "@/globalState/hooks/useAppState";
import { useMasterDataFields } from "@/FieldDatas/useMasterDataFields";
import useFetch from "@/hooks/useFetchHook";
import { apiFetchCommonMaster } from "@/Services/Api";
import { masterItems, type MasterItemType } from "@/FieldDatas/Data";
import { socket, SOCKET_MASTER_UPDATED } from "@/Services/Socket";
import { LoadingState, ErrorState } from "@/CustomComponent/PageComponents";
import { usePermissions } from "@/globalState/hooks/usePermissions";

interface Category {
  id: string;
  name: string;
  count: number;
}

const MasterScreen: React.FC = () => {
  const { selectedMaster, setCurrentScreen, setSelectedMaster } = useAppState() as any;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [refreshKey, setRefreshKey] = useState(0);

  const masterDataResult = useMasterDataFields() as any;
  const fields: Record<string, any[]> = masterDataResult?.fields || {};
  const headerData = selectedMaster ? (fields[selectedMaster] || []) : [];

  const masterTitle = useMemo(
    () =>
      masterItems.find((item) => item.id === selectedMaster)?.name ??
      (selectedMaster?.replace(/([a-z])([A-Z])/g, "$1 $2") || ""),
    [selectedMaster]
  );

  useEffect(() => {
    const handleMasterUpdated = ({ masterField }: { masterField: string }) => {
      if (masterField === selectedMaster) {
        setRefreshKey((k) => k + 1);
      }
    };
    socket.on(SOCKET_MASTER_UPDATED, handleMasterUpdated);
    return () => { socket.off(SOCKET_MASTER_UPDATED, handleMasterUpdated); };
  }, [selectedMaster]);

  const { data: datas, loading, error } = useFetch(
    selectedMaster ? `${apiFetchCommonMaster}${selectedMaster}` : '',
    "",
    null,
    refreshKey
  ) as { data?: any; loading: boolean; error: Error | null };

  if (!selectedMaster) {
    return <ErrorState message="Please select a master to view" fullPage />;
  }

  if (loading) {
    return <LoadingState message="Loading master data..." fullPage />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load master data"}
        onRetry={() => { setCurrentScreen("main"); setSelectedMaster(null); }}
        fullPage
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <DynamicTable
        headers={headerData}
        data={datas?.data || []}
        title={masterTitle}
        master={selectedMaster}
        searchable={true}
        sortable={true}
        className="mb-8"
        setCurrentScreen={setCurrentScreen}
        canCreate={canCreate("masters")}
        canEdit={canEdit("masters")}
        canDelete={canDelete("masters")}
      />
    </div>
  );
};

const MasterItemsGrid: React.FC = () => {
  const {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    viewMode,
    setViewMode,
    currentScreen,
    setCurrentScreen,
    selectedMaster,
    setSelectedMaster,
  } = useAppState() as any;

  const categories = useMemo<Category[]>(() => {
    const counts = new Map<string, number>();
    masterItems.forEach((item: MasterItemType) => {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    });
    const categoryOrder = ["organization", "finance", "inventory", "administration", "approvals", "compliance", "customer", "logistics"];
    const sorted = categoryOrder
      .filter((id) => counts.has(id))
      .map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        count: counts.get(id)!,
      }));
    const extra = Array.from(counts.keys())
      .filter((id) => !categoryOrder.includes(id))
      .map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), count: counts.get(id)! }));
    return [{ id: "all", name: "All Items", count: masterItems.length }, ...sorted, ...extra];
  }, []);

  const filteredItems = useMemo(
    () =>
      masterItems.filter((item: MasterItemType) => {
        const matchesSearch = item.name.toLowerCase().includes((searchTerm ?? "").toLowerCase());
        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [searchTerm, selectedCategory]
  );

  const handleItemClick = (item: MasterItemType) => {
    setSelectedMaster(item.id);
    setCurrentScreen("master");
  };

  const MainGrid: React.FC = () => (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto px-2 py-3">
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
              />
            ))}
            <ViewMode setViewMode={setViewMode} viewMode={viewMode} />
          </div>
        </div>
        <ItemGridCard
          viewMode={viewMode}
          handleItemClick={handleItemClick}
          filteredItems={filteredItems}
        />
      </div>
    </div>
  );

 

  if (currentScreen === "master" && selectedMaster) {
    return <MasterScreen />;
  }

  return <MainGrid />;
};

export default MasterItemsGrid;
