/**
 * ProductAdvancedFilters
 * Advanced filtering UI for product list with filter persistence,
 * active filter count badge, and collapsible panel.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import Filter from 'lucide-react/dist/esm/icons/filter';
import X from 'lucide-react/dist/esm/icons/x';
import CalendarIcon from 'lucide-react/dist/esm/icons/calendar';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import { cn } from '@/lib/utils';

export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
export type ComplianceStatus = 'all' | 'compliant' | 'non_compliant' | 'pending';
export type MenuStatus = 'all' | 'listed' | 'unlisted';
export type ArchiveStatus = 'active' | 'archived' | 'all';

export interface ProductFilters {
  category: string;
  vendor: string;
  stockStatus: StockStatus;
  priceMin: number | null;
  priceMax: number | null;
  complianceStatus: ComplianceStatus;
  menuStatus: MenuStatus;
  archiveStatus: ArchiveStatus;
  createdAfter: Date | null;
  createdBefore: Date | null;
}

export const defaultProductFilters: ProductFilters = {
  category: 'all',
  vendor: 'all',
  stockStatus: 'all',
  priceMin: null,
  priceMax: null,
  complianceStatus: 'all',
  menuStatus: 'all',
  archiveStatus: 'active',
  createdAfter: null,
  createdBefore: null,
};

interface ProductAdvancedFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  categories: string[];
  vendors: string[];
  maxPrice?: number;
  className?: string;
}

export function ProductAdvancedFilters({
  filters,
  onFiltersChange,
  categories,
  vendors,
  maxPrice: _maxPrice = 1000,
  className,
}: ProductAdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category !== 'all') count++;
    if (filters.vendor !== 'all') count++;
    if (filters.stockStatus !== 'all') count++;
    if (filters.priceMin !== null || filters.priceMax !== null) count++;
    if (filters.complianceStatus !== 'all') count++;
    if (filters.menuStatus !== 'all') count++;
    if (filters.archiveStatus !== 'active') count++;
    if (filters.createdAfter || filters.createdBefore) count++;
    return count;
  }, [filters]);

  const handleFilterChange = useCallback(
    <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => {
      onFiltersChange({
        ...filters,
        [key]: value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleResetFilters = useCallback(() => {
    onFiltersChange(defaultProductFilters);
  }, [onFiltersChange]);

  const handleRemoveFilter = useCallback(
    (key: keyof ProductFilters) => {
      const resetValue = defaultProductFilters[key];
      handleFilterChange(key, resetValue);
    },
    [handleFilterChange]
  );

  // Get display label for active filters
  const getFilterLabel = (key: keyof ProductFilters): string => {
    switch (key) {
      case 'category':
        return filters.category !== 'all' ? `Category: ${filters.category}` : '';
      case 'vendor':
        return filters.vendor !== 'all' ? `Vendor: ${filters.vendor}` : '';
      case 'stockStatus':
        if (filters.stockStatus === 'in_stock') return 'In Stock';
        if (filters.stockStatus === 'low_stock') return 'Low Stock';
        if (filters.stockStatus === 'out_of_stock') return 'Out of Stock';
        return '';
      case 'priceMin':
      case 'priceMax':
        if (filters.priceMin !== null && filters.priceMax !== null) {
          return `$${filters.priceMin} - $${filters.priceMax}`;
        }
        if (filters.priceMin !== null) return `Min: $${filters.priceMin}`;
        if (filters.priceMax !== null) return `Max: $${filters.priceMax}`;
        return '';
      case 'complianceStatus':
        if (filters.complianceStatus === 'compliant') return 'Compliant';
        if (filters.complianceStatus === 'non_compliant') return 'Non-Compliant';
        if (filters.complianceStatus === 'pending') return 'Pending Review';
        return '';
      case 'menuStatus':
        if (filters.menuStatus === 'listed') return 'Listed on Menu';
        if (filters.menuStatus === 'unlisted') return 'Unlisted';
        return '';
      case 'archiveStatus':
        if (filters.archiveStatus === 'archived') return 'Archived';
        if (filters.archiveStatus === 'all') return 'All Products';
        return '';
      case 'createdAfter':
      case 'createdBefore': {
        const parts: string[] = [];
        if (filters.createdAfter) parts.push(`After ${format(filters.createdAfter, 'MMM d, yyyy')}`);
        if (filters.createdBefore) parts.push(`Before ${format(filters.createdBefore, 'MMM d, yyyy')}`);
        return parts.join(' - ');
      }
      default:
        return '';
    }
  };

  // Get active filter badges for display
  const activeFilterBadges = useMemo(() => {
    const badges: { key: keyof ProductFilters; label: string }[] = [];

    if (filters.category !== 'all') {
      badges.push({ key: 'category', label: getFilterLabel('category') });
    }
    if (filters.vendor !== 'all') {
      badges.push({ key: 'vendor', label: getFilterLabel('vendor') });
    }
    if (filters.stockStatus !== 'all') {
      badges.push({ key: 'stockStatus', label: getFilterLabel('stockStatus') });
    }
    if (filters.priceMin !== null || filters.priceMax !== null) {
      badges.push({ key: 'priceMin', label: getFilterLabel('priceMin') });
    }
    if (filters.complianceStatus !== 'all') {
      badges.push({ key: 'complianceStatus', label: getFilterLabel('complianceStatus') });
    }
    if (filters.menuStatus !== 'all') {
      badges.push({ key: 'menuStatus', label: getFilterLabel('menuStatus') });
    }
    if (filters.archiveStatus !== 'active') {
      badges.push({ key: 'archiveStatus', label: getFilterLabel('archiveStatus') });
    }
    if (filters.createdAfter || filters.createdBefore) {
      badges.push({ key: 'createdAfter', label: getFilterLabel('createdAfter') });
    }

    return badges;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getFilterLabel only depends on `filters` which is already in deps
  }, [filters]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Filter Toggle Button with Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </Button>

        {/* Active Filter Badges */}
        {activeFilterBadges.length > 0 && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {activeFilterBadges.map(({ key, label }) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="gap-1 pl-2 pr-1"
                >
                  {label}
                  <button
                    onClick={() => handleRemoveFilter(key)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                    aria-label={`Remove ${label} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Clear All
            </Button>
          </>
        )}
      </div>

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category}
                onValueChange={(value) => handleFilterChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendor Filter */}
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select
                value={filters.vendor}
                onValueChange={(value) => handleFilterChange('vendor', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor} value={vendor}>
                      {vendor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Status Filter */}
            <div className="space-y-2">
              <Label>Stock Status</Label>
              <Select
                value={filters.stockStatus}
                onValueChange={(value) =>
                  handleFilterChange('stockStatus', value as StockStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Status</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Compliance Status Filter */}
            <div className="space-y-2">
              <Label>Compliance Status</Label>
              <Select
                value={filters.complianceStatus}
                onValueChange={(value) =>
                  handleFilterChange('complianceStatus', value as ComplianceStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Status</SelectItem>
                  <SelectItem value="compliant">Compliant (COA Present)</SelectItem>
                  <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Menu Status Filter */}
            <div className="space-y-2">
              <Label>Menu Status</Label>
              <Select
                value={filters.menuStatus}
                onValueChange={(value) =>
                  handleFilterChange('menuStatus', value as MenuStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Status</SelectItem>
                  <SelectItem value="listed">Listed on Menu</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Archive Status Filter */}
            <div className="space-y-2">
              <Label>Archive Status</Label>
              <Select
                value={filters.archiveStatus}
                onValueChange={(value) =>
                  handleFilterChange('archiveStatus', value as ArchiveStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Active Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Products</SelectItem>
                  <SelectItem value="archived">Archived Only</SelectItem>
                  <SelectItem value="all">All Products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range Filter */}
            <div className="space-y-2">
              <Label>Price Range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  aria-label="Minimum price"
                  value={filters.priceMin ?? ''}
                  onChange={(e) =>
                    handleFilterChange(
                      'priceMin',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  className="w-24"
                  min={0}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  aria-label="Maximum price"
                  value={filters.priceMax ?? ''}
                  onChange={(e) =>
                    handleFilterChange(
                      'priceMax',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  className="w-24"
                  min={0}
                />
              </div>
            </div>

            {/* Created After Date Filter */}
            <div className="space-y-2">
              <Label>Created After</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !filters.createdAfter && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.createdAfter ? (
                      format(filters.createdAfter, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.createdAfter ?? undefined}
                    onSelect={(date) => handleFilterChange('createdAfter', date ?? null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Created Before Date Filter */}
            <div className="space-y-2">
              <Label>Created Before</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !filters.createdBefore && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.createdBefore ? (
                      format(filters.createdBefore, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.createdBefore ?? undefined}
                    onSelect={(date) => handleFilterChange('createdBefore', date ?? null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Reset All
            </Button>
            <Button size="sm" onClick={() => setIsExpanded(false)}>
              Apply Filters
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ProductAdvancedFilters;
