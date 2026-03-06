import React from "react";
import DynamicTable from "@/LayoutComponent/DynamicTable";
import ViewMode from "@/CustomComponent/ViewModes/ViewMode";
import CategoryCard from "@/CustomComponent/MasterComponents/CatagoryCard";
import ItemGridCard from "@/CustomComponent/MasterComponents/ItemGridCard";
import { useAppState } from "@/globalState/hooks/useAppState";
import { useMasterDataFields } from "@/FieldDatas/useMasterDataFields";
import useFetch from "@/hooks/useFetchHook";
import { apiFetchCommonMaster } from "@/Services/Api";
import { masterItems } from "@/FieldDatas/Data";

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
  const { selectedMaster, setCurrentScreen,setSelectedMaster } = useAppState() as any;
console.log(selectedMaster)
  const masterDataResult = useMasterDataFields() as any;
  const fields: Record<string, any[]> = masterDataResult?.fields || {};
  const headerData = selectedMaster ? (fields[selectedMaster] || []) : [];

  const { data: datas, loading, error } = useFetch(
    selectedMaster ? `${apiFetchCommonMaster}${selectedMaster}` : ''
  ) as { data?: any; loading: boolean; error: Error | null };

  if (!selectedMaster) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Please select a master to view</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    const handleBackToMain = () => {
      setCurrentScreen("main");
      setSelectedMaster(null);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center border-2 border-red-200">
    <div className="flex flex-col items-center space-y-4">
      <svg
        className="w-12 h-12 text-red-600"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
      </svg>
      <div className="text-xl font-semibold text-red-600">Error Occurred</div>
      <div className="text-gray-700">{error.message}</div>
      <button
        onClick={handleBackToMain}
        className="mt-4 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        Back to Main
      </button>
    </div>
  </div>
</div>

    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
