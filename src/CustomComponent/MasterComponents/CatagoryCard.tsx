import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string | number;
  name: string;
  count: number;
}

interface CategoryCardProps {
  category: Category;
  selectedCategory: string | number;
  setSelectedCategory: (id: string | number) => void;
}

function CategoryCard({
  category,
  selectedCategory,
  setSelectedCategory,
}: CategoryCardProps) {
  const isSelected = selectedCategory === category.id;

  return (
    <Button
      key={category.id}
      onClick={() => setSelectedCategory(category.id)}
      variant={isSelected ? "default" : "outline"}
      className={`px-4 py-2 h-auto font-medium transition-all duration-200 ${
        isSelected
          ? "shadow-lg transform scale-105"
          : "bg-background/70 backdrop-blur-sm hover:bg-background hover:shadow-md"
      }`}
    >
      {category.name}

      <Badge
        variant={isSelected ? "secondary" : "outline"}
        className={`ml-2 text-xs ${
          isSelected
            ? "bg-primary-foreground/20 text-primary-foreground border-0"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {category.count}
      </Badge>
    </Button>
  );
}

export default CategoryCard;
