import { useCallback } from 'react';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export type StockStatusFilter = 'in_stock' | 'out_of_stock';
export type PriceRangeFilter = 'under_25' | '25_to_50' | 'over_50';

export interface ProductFilterState {
  categories: string[];
  stockStatuses: StockStatusFilter[];
  priceRanges: PriceRangeFilter[];
}

export const defaultProductFilterState: ProductFilterState = {
  categories: [],
  stockStatuses: [],
  priceRanges: [],
};

const CATEGORIES = ['Flower', 'Pre-Rolls', 'Edibles', 'Vapes', 'Concentrates'] as const;

const STOCK_OPTIONS: ReadonlyArray<{ id: StockStatusFilter; label: string }> = [
  { id: 'in_stock', label: 'In Stock' },
  { id: 'out_of_stock', label: 'Out of Stock' },
];

const PRICE_RANGE_OPTIONS: ReadonlyArray<{ id: PriceRangeFilter; label: string }> = [
  { id: 'under_25', label: 'Under $25' },
  { id: '25_to_50', label: '$25 - $50' },
  { id: 'over_50', label: 'Over $50' },
];

interface ProductFiltersProps {
  filters: ProductFilterState;
  onFilterChange: (filters: ProductFilterState) => void;
}

export function ProductFilters({ filters, onFilterChange }: ProductFiltersProps) {
  const toggleCategory = useCallback(
    (category: string, checked: boolean) => {
      const categories = checked
        ? [...filters.categories, category]
        : filters.categories.filter((c) => c !== category);
      onFilterChange({ ...filters, categories });
    },
    [filters, onFilterChange],
  );

  const toggleStockStatus = useCallback(
    (status: StockStatusFilter, checked: boolean) => {
      const stockStatuses = checked
        ? [...filters.stockStatuses, status]
        : filters.stockStatuses.filter((s) => s !== status);
      onFilterChange({ ...filters, stockStatuses });
    },
    [filters, onFilterChange],
  );

  const togglePriceRange = useCallback(
    (range: PriceRangeFilter, checked: boolean) => {
      const priceRanges = checked
        ? [...filters.priceRanges, range]
        : filters.priceRanges.filter((r) => r !== range);
      onFilterChange({ ...filters, priceRanges });
    },
    [filters, onFilterChange],
  );

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="space-y-2">
          {CATEGORIES.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category}`}
                checked={filters.categories.includes(category)}
                onCheckedChange={(checked) => toggleCategory(category, checked === true)}
              />
              <Label htmlFor={`category-${category}`}>{category}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Stock Status</h3>
        <div className="space-y-2">
          {STOCK_OPTIONS.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={`stock-${option.id}`}
                checked={filters.stockStatuses.includes(option.id)}
                onCheckedChange={(checked) => toggleStockStatus(option.id, checked === true)}
              />
              <Label htmlFor={`stock-${option.id}`}>{option.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Price Range</h3>
        <div className="space-y-2">
          {PRICE_RANGE_OPTIONS.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={`price-${option.id}`}
                checked={filters.priceRanges.includes(option.id)}
                onCheckedChange={(checked) => togglePriceRange(option.id, checked === true)}
              />
              <Label htmlFor={`price-${option.id}`}>{option.label}</Label>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
