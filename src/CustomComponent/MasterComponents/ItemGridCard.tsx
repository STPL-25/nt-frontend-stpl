import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReactNode } from "react";

export interface BaseItem {
  id?: string;
  name?: string;
  icon?: ReactNode;
  color?: string;
  category?: string;
}

/**
 * Generic props so ItemGridCard can be used with MasterItem or any other item type.
 * T extends BaseItem ensures we can access name/icon/color safely (with fallbacks).
 */
interface ItemGridCardProps<T extends BaseItem> {
  viewMode: "grid" | "list";
  filteredItems: T[];
  handleItemClick: (item: T) => void;
}

function ItemGridCard<T extends BaseItem>({
  viewMode,
  handleItemClick,
  filteredItems,
}: ItemGridCardProps<T>) {
  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-10 gap-4"
          : "flex flex-col gap-3"
      }
    >
      {filteredItems.map((item, index) => {
        const colorClass = item.color || "bg-slate-400";
        const iconNode = item.icon ?? <div className="w-5 h-5 rounded-sm" />;
        const itemName = item.name ?? "Untitled";

        return (
          <Card
            key={item.id ?? index}
            onClick={() => handleItemClick(item)}
            className={`group relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer overflow-hidden border-muted ${
              viewMode === "list" ? "flex items-center" : "aspect-square"
            }`}
          >
            <CardContent
              className={
                viewMode === "grid"
                  ? "flex flex-col items-center justify-center h-full p-4"
                  : "flex items-center justify-between w-full p-4"
              }
            >
              {viewMode === "grid" ? (
                <>
                  <div
                    className={`${colorClass} p-3 rounded-xl mb-3 group-hover:scale-110 transition-all duration-300 shadow-sm`}
                  >
                    <div className="text-white">{iconNode}</div>
                  </div>

                  <span className="text-foreground font-medium text-center text-sm group-hover:text-primary transition-colors">
                    {itemName}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className={`${colorClass} p-3 rounded-xl shadow-sm`}>
                      <div className="text-white">{iconNode}</div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-foreground font-medium">{itemName}</span>

                      {item.category && (
                        <Badge variant="secondary" className="w-fit text-xs capitalize">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default ItemGridCard;
