import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Filter from "lucide-react/dist/esm/icons/filter";
import X from "lucide-react/dist/esm/icons/x";
import { useState } from 'react';

interface FilterState {
  category?: string;
  performance?: string;
  imageStatus?: string;
}

interface AdvancedAnalyticsFiltersProps {
  onFilterChange: (filters: FilterState) => void;
}

export const AdvancedAnalyticsFilters = ({ onFilterChange }: AdvancedAnalyticsFiltersProps) => {
  const [filters, setFilters] = useState<FilterState>({});
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value === 'all' ? undefined : value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/20">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) => handleFilterChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="appetizers">Appetizers</SelectItem>
                <SelectItem value="entrees">Entrees</SelectItem>
                <SelectItem value="desserts">Desserts</SelectItem>
                <SelectItem value="beverages">Beverages</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Performance</label>
            <Select
              value={filters.performance || 'all'}
              onValueChange={(value) => handleFilterChange('performance', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Performance</SelectItem>
                <SelectItem value="high">High Performers (Top 20%)</SelectItem>
                <SelectItem value="medium">Medium Performers</SelectItem>
                <SelectItem value="low">Low Performers (Bottom 20%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Image Status</label>
            <Select
              value={filters.imageStatus || 'all'}
              onValueChange={(value) => handleFilterChange('imageStatus', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="with-images">With Images</SelectItem>
                <SelectItem value="without-images">Without Images</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              Category: {filters.category}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('category', 'all')}
              />
            </Badge>
          )}
          {filters.performance && (
            <Badge variant="secondary" className="gap-1">
              Performance: {filters.performance}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('performance', 'all')}
              />
            </Badge>
          )}
          {filters.imageStatus && (
            <Badge variant="secondary" className="gap-1">
              Images: {filters.imageStatus}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('imageStatus', 'all')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
