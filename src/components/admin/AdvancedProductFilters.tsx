import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter, X, Save, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterConfig {
  category: string[];
  strainType: string[];
  priceRange: [number, number];
  stockRange: [number, number];
  inStock: boolean | null;
}

interface AdvancedProductFiltersProps {
  onFilterChange: (filters: FilterConfig) => void;
  activeFilters: FilterConfig;
}

export function AdvancedProductFilters({
  onFilterChange,
  activeFilters,
}: AdvancedProductFiltersProps) {
  const [filters, setFilters] = useState<FilterConfig>(activeFilters);
  const [savedFilters, setSavedFilters] = useState<{ name: string; config: FilterConfig }[]>([]);

  const updateFilter = (key: keyof FilterConfig, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.category.includes(category)
      ? filters.category.filter((c) => c !== category)
      : [...filters.category, category];
    updateFilter("category", newCategories);
  };

  const toggleStrainType = (strain: string) => {
    const newStrains = filters.strainType.includes(strain)
      ? filters.strainType.filter((s) => s !== strain)
      : [...filters.strainType, strain];
    updateFilter("strainType", newStrains);
  };

  const clearFilters = () => {
    const defaultFilters: FilterConfig = {
      category: [],
      strainType: [],
      priceRange: [0, 1000],
      stockRange: [0, 1000],
      inStock: null,
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const saveCurrentFilter = () => {
    const name = prompt("Enter filter name:");
    if (name) {
      setSavedFilters([...savedFilters, { name, config: filters }]);
    }
  };

  const loadSavedFilter = (config: FilterConfig) => {
    setFilters(config);
    onFilterChange(config);
  };

  const activeFilterCount =
    filters.category.length +
    filters.strainType.length +
    (filters.inStock !== null ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Advanced Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Advanced Filters</SheetTitle>
          <SheetDescription>
            Refine your product search with detailed filters
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div>
              <Label>Saved Filters</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {savedFilters.map((saved, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => loadSavedFilter(saved.config)}
                  >
                    {saved.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div>
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["flower", "pre-rolls", "edibles", "vapes", "concentrates"].map((cat) => (
                <Button
                  key={cat}
                  variant={filters.category.includes(cat) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleCategory(cat)}
                >
                  {(cat || 'unknown')}
                </Button>
              ))}
            </div>
          </div>

          {/* Strain Types */}
          <div>
            <Label>Strain Type</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["indica", "sativa", "hybrid", "cbd"].map((strain) => (
                <Button
                  key={strain}
                  variant={filters.strainType.includes(strain) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStrainType(strain)}
                >
                  {(strain || 'unknown')}
                </Button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <Label>Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}</Label>
            <Slider
              value={filters.priceRange}
              onValueChange={(value) => updateFilter("priceRange", value)}
              max={1000}
              step={10}
              className="mt-2"
            />
          </div>

          {/* Stock Range */}
          <div>
            <Label>Stock Range: {filters.stockRange[0]} - {filters.stockRange[1]} units</Label>
            <Slider
              value={filters.stockRange}
              onValueChange={(value) => updateFilter("stockRange", value)}
              max={1000}
              step={5}
              className="mt-2"
            />
          </div>

          {/* Stock Status */}
          <div className="flex items-center justify-between">
            <Label>Only In Stock</Label>
            <Switch
              checked={filters.inStock === true}
              onCheckedChange={(checked) =>
                updateFilter("inStock", checked ? true : null)
              }
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={clearFilters} className="flex-1">
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button variant="outline" onClick={saveCurrentFilter} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
