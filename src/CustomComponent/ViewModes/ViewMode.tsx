import React from "react";
import { Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewModeType = "grid" | "list";

interface ViewModeProps {
  viewMode: ViewModeType;
  setViewMode: (mode: ViewModeType) => void;
}

const ViewMode: React.FC<ViewModeProps> = ({ viewMode, setViewMode }) => {
  return (
    <div className="flex items-center gap-1 bg-background/70 backdrop-blur-sm border border-border rounded-xl p-1 ml-1">
      <Button
        onClick={() => setViewMode("grid")}
        // use an allowed variant instead of "primary"
        variant={viewMode === "grid" ? "default" : "ghost"}
        size="sm"
        className={`p-2 h-auto rounded-lg transition-all ${
          viewMode === "grid" ? "shadow-md" : "hover:bg-muted"
        }`}
      >
        <Grid className="w-4 h-4" />
      </Button>

      <Button
        onClick={() => setViewMode("list")}
        variant={viewMode === "list" ? "default" : "ghost"}
        size="sm"
        className={`p-2 h-auto rounded-lg transition-all ${
          viewMode === "list" ? "shadow-md" : "hover:bg-muted"
        }`}
      >
        <List className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default ViewMode;
