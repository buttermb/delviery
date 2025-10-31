import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X } from "lucide-react";
import { haptics } from "@/utils/haptics";
import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface MobileFilterDrawerProps {
  categories: FilterOption[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortOptions: FilterOption[];
  selectedSort: string;
  onSortChange: (sort: string) => void;
  onClear?: () => void;
  className?: string;
}

export function MobileFilterDrawer({
  categories,
  selectedCategory,
  onCategoryChange,
  sortOptions,
  selectedSort,
  onSortChange,
  onClear,
  className
}: MobileFilterDrawerProps) {
  const activeFiltersCount = (selectedCategory !== 'all' ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "relative min-h-[48px] gap-2 touch-manipulation",
            className
          )}
          onClick={() => haptics.light()}
        >
          <Filter className="h-5 w-5" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent 
        side="bottom" 
        className="h-[75vh] rounded-t-3xl p-0"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-2xl">Filters & Sort</SheetTitle>
              {activeFiltersCount > 0 && onClear && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    haptics.light();
                    onClear();
                  }}
                  className="text-primary"
                >
                  Clear all
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-6">
              {/* Categories */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Categories</h3>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category.value}
                      variant={selectedCategory === category.value ? "default" : "outline"}
                      className={cn(
                        "h-12 justify-start touch-manipulation",
                        selectedCategory === category.value && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => {
                        haptics.selection();
                        onCategoryChange(category.value);
                      }}
                    >
                      <span className="flex-1 text-left truncate">{category.label}</span>
                      {category.count !== undefined && (
                        <Badge variant="secondary" className="ml-2">
                          {category.count}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Sort By</h3>
                <div className="space-y-2">
                  {sortOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={selectedSort === option.value ? "default" : "outline"}
                      className={cn(
                        "w-full h-12 justify-start touch-manipulation",
                        selectedSort === option.value && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => {
                        haptics.selection();
                        onSortChange(option.value);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
