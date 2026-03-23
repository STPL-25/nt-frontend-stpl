import React, { useState, useEffect } from "react";
import DynamicTable from "@/LayoutComponent/DynamicTable";
import ViewMode from "@/CustomComponent/ViewModes/ViewMode";
import CategoryCard from "@/CustomComponent/MasterComponents/CatagoryCard";
import ItemGridCard from "@/CustomComponent/MasterComponents/ItemGridCard";
import { useAppState } from "@/globalState/hooks/useAppState";
import { useMasterDataFields } from "@/FieldDatas/useMasterDataFields";
import useFetch from "@/hooks/useFetchHook";
import { apiFetchCommonMaster } from "@/Services/Api";
import { masterItems } from "@/FieldDatas/Data";
import { socket, SOCKET_MASTER_UPDATED } from "@/Services/Socket";
import { LoadingState, ErrorState } from "@/CustomComponent/PageComponents";

interface MasterItem {
  id: string;
  name?: string;
  category?: string;
  [key: string]: any;
}

interface Category {
  id: string;
  name: string;
  count: number;
}

const MasterScreen: React.FC = () => {
  const { selectedMaster, setCurrentScreen, setSelectedMaster } = useAppState() as any;
  const [refreshKey, setRefreshKey] = useState(0);

  const masterDataResult = useMasterDataFields() as any;
  const fields: Record<string, any[]> = masterDataResult?.fields || {};
  const headerData = selectedMaster ? (fields[selectedMaster] || []) : [];

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
        title={selectedMaster?.replace(/([a-z])([A-Z])/g, "$1 $2")}
        master={selectedMaster}
        searchable={true}
        sortable={true}
        className="mb-8"
        setCurrentScreen={setCurrentScreen}
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

  const categories: Category[] = [
    { id: "all", name: "All Items", count: masterItems.length },
    {
      id: "organization",
      name: "Organization",
      count: masterItems.filter((item: MasterItem) => item.category === "organization").length,
    },
    {
      id: "finance",
      name: "Finance",
      count: masterItems.filter((item: MasterItem) => item.category === "finance").length,
    },
    {
      id: "inventory",
      name: "Inventory",
      count: masterItems.filter((item: MasterItem) => item.category === "inventory").length,
    },
    {
      id: "administration",
      name: "Administration",
      count: masterItems.filter((item: MasterItem) => item.category === "administration").length,
    },
    {
      id: "approvals",
      name: "Approvals",
      count: masterItems.filter((item: MasterItem) => item.category === "approvals").length,
    },
    {
      id: "compliance",
      name: "Compliance",
      count: masterItems.filter((item: MasterItem) => item.category === "compliance").length,
    },
    {
      id: "customer",
      name: "Customer",
      count: masterItems.filter((item: MasterItem) => item.category === "customer").length,
    },
    {
      id: "logistics",
      name: "Logistics",
      count: masterItems.filter((item: MasterItem) => item.category === "logistics").length,
    },
  ];

  const filteredItems = (masterItems as MasterItem[]).filter((item) => {
    const matchesSearch = String(item.name || "")
      .toLowerCase()
      .includes(String(searchTerm || "").toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleItemClick = (item: MasterItem) => {
    setSelectedMaster(item.id);
    setCurrentScreen("master");
  };

  const handleBackToMain = () => {
    setCurrentScreen("main");
    setSelectedMaster(null);
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
