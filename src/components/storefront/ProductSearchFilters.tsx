/**
 * Storefront Product Search Filters Component
 * Search and filter controls for product catalog
 */

import { useState } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export interface ProductFilters {
  search: string;
  categories: string[];
  strainTypes: string[];
  priceRange: [number, number];
  thcRange?: [number, number];
  inStockOnly: boolean;
}

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface ProductSearchFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  categories: FilterOption[];
  strainTypes?: FilterOption[];
  maxPrice?: number;
  showAdvancedFilters?: boolean;
  activeFilterCount?: number;
}

export default function ProductSearchFilters({
  filters,
  onFiltersChange,
  categories,
  strainTypes = [
    { label: 'Indica', value: 'Indica' },
    { label: 'Sativa', value: 'Sativa' },
    { label: 'Hybrid', value: 'Hybrid' },
  ],
  maxPrice = 1000,
  showAdvancedFilters = true,
  activeFilterCount = 0,
}: ProductSearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);
  const [isStrainOpen, setIsStrainOpen] = useState(true);
  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isThcOpen, setIsThcOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleStrainToggle = (strain: string) => {
    const newStrains = filters.strainTypes.includes(strain)
      ? filters.strainTypes.filter((s) => s !== strain)
      : [...filters.strainTypes, strain];
    onFiltersChange({ ...filters, strainTypes: newStrains });
  };

  const handlePriceRangeChange = (value: number[]) => {
    onFiltersChange({ ...filters, priceRange: [value[0], value[1]] });
  };

  const handleThcRangeChange = (value: number[]) => {
    onFiltersChange({ ...filters, thcRange: [value[0], value[1]] });
  };

  const handleInStockToggle = (checked: boolean) => {
    onFiltersChange({ ...filters, inStockOnly: checked });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      categories: [],
      strainTypes: [],
      priceRange: [0, maxPrice],
      thcRange: [0, 100],
      inStockOnly: false,
    });
  };

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.strainTypes.length > 0 ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < maxPrice ||
    filters.inStockOnly ||
    (filters.thcRange && (filters.thcRange[0] > 0 || filters.thcRange[1] < 100));

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <Collapsible open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="text-base font-semibold">Categories</Label>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isCategoryOpen && 'transform rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2">
          {categories.map((category) => (
            <div key={category.value} className="flex items-center space-x-2">
              <Checkbox
                id={`cat-${category.value}`}
                checked={filters.categories.includes(category.value)}
                onCheckedChange={() => handleCategoryToggle(category.value)}
              />
              <Label
                htmlFor={`cat-${category.value}`}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {category.label}
                {category.count !== undefined && (
                  <span className="text-muted-foreground ml-1">({category.count})</span>
                )}
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Strain Types */}
      <Collapsible open={isStrainOpen} onOpenChange={setIsStrainOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="text-base font-semibold">Strain Type</Label>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isStrainOpen && 'transform rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2">
          {strainTypes.map((strain) => (
            <div key={strain.value} className="flex items-center space-x-2">
              <Checkbox
                id={`strain-${strain.value}`}
                checked={filters.strainTypes.includes(strain.value)}
                onCheckedChange={() => handleStrainToggle(strain.value)}
              />
              <Label
                htmlFor={`strain-${strain.value}`}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {strain.label}
                {strain.count !== undefined && (
                  <span className="text-muted-foreground ml-1">({strain.count})</span>
                )}
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Price Range */}
      <Collapsible open={isPriceOpen} onOpenChange={setIsPriceOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="text-base font-semibold">Price Range</Label>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isPriceOpen && 'transform rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <Slider
            value={filters.priceRange}
            onValueChange={handlePriceRangeChange}
            min={0}
            max={maxPrice}
            step={5}
            className="w-full"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCurrency(filters.priceRange[0])}
            </span>
            <span className="text-muted-foreground">
              {formatCurrency(filters.priceRange[1])}
            </span>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <>
          <Separator />

          {/* THC Range */}
          <Collapsible open={isThcOpen} onOpenChange={setIsThcOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <Label className="text-base font-semibold">THC %</Label>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  isThcOpen && 'transform rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <Slider
                value={filters.thcRange || [0, 100]}
                onValueChange={handleThcRangeChange}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {filters.thcRange?.[0] || 0}%
                </span>
                <span className="text-muted-foreground">
                  {filters.thcRange?.[1] || 100}%
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* In Stock Only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="in-stock"
              checked={filters.inStockOnly}
              onCheckedChange={handleInStockToggle}
            />
            <Label htmlFor="in-stock" className="text-sm font-normal cursor-pointer">
              In Stock Only
            </Label>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search products..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => handleSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Desktop Filters */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filters</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear All
            </Button>
          )}
        </div>
        <FiltersContent />
      </div>

      {/* Mobile Filter Button */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full gap-2 relative">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-auto">{activeFilterCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                Refine your product search
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-12rem)] mt-6">
              <FiltersContent />
            </ScrollArea>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  className="w-full mb-2"
                  onClick={handleClearFilters}
                >
                  Clear All Filters
                </Button>
              )}
              <Button className="w-full" onClick={() => setIsOpen(false)}>
                Show Results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filter Pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="gap-1">
              {cat}
              <button
                onClick={() => handleCategoryToggle(cat)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.strainTypes.map((strain) => (
            <Badge key={strain} variant="secondary" className="gap-1">
              {strain}
              <button
                onClick={() => handleStrainToggle(strain)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.inStockOnly && (
            <Badge variant="secondary" className="gap-1">
              In Stock
              <button
                onClick={() => handleInStockToggle(false)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
