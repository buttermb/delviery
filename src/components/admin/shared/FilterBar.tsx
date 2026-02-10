/**
 * Shared Admin Filter Bar Component
 *
 * A reusable filter bar with date range picker, status dropdown, search input,
 * and custom filter slots. Persists active filters to localStorage.
 *
 * Features:
 * - Date range picker with calendar
 * - Status dropdown filters
 * - Search input with debounce
 * - Custom filter slots for extensibility
 * - localStorage persistence
 * - Active filter count badge
 * - Clear all filters functionality
 *
 * Usage:
 * ```tsx
 * <FilterBar
 *   storageKey="orders-filters"
 *   filters={[
 *     { key: 'status', type: 'select', label: 'Status', options: [{ value: 'pending', label: 'Pending' }] },
 *     { key: 'dateRange', type: 'dateRange', label: 'Date Range' },
 *   ]}
 *   activeFilters={filters}
 *   onFilterChange={setFilters}
 *   onClear={() => setFilters({})}
 *   searchPlaceholder="Search orders..."
 * />
 * ```
 */

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Search, X, Filter } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Filter option for select filters
 */
export interface FilterSelectOption {
  value: string;
  label: string;
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Unique key for the filter */
  key: string;
  /** Display label */
  label: string;
  /** Filter type */
  type: 'text' | 'select' | 'dateRange' | 'date';
  /** Options for select filters */
  options?: FilterSelectOption[];
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Date range value
 */
export interface DateRangeValue {
  from: string | null;
  to: string | null;
}

/**
 * Active filters object
 */
export type ActiveFilters = Record<string, string | DateRangeValue | null>;

interface FilterBarProps {
  /** Configuration for available filters */
  filters: FilterConfig[];
  /** Current active filter values */
  activeFilters: ActiveFilters;
  /** Callback when filter values change */
  onFilterChange: (filters: ActiveFilters) => void;
  /** Callback to clear all filters */
  onClear: () => void;
  /** LocalStorage key for persistence */
  storageKey?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Search value (controlled externally) */
  searchValue?: string;
  /** Search change handler (controlled externally) */
  onSearchChange?: (value: string) => void;
  /** Show search input */
  showSearch?: boolean;
  /** Custom filter slots rendered at the end */
  customFilters?: ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * Calculate the number of active filters
 */
function countActiveFilters(filters: ActiveFilters): number {
  return Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    if (typeof value === 'object') {
      const dateRange = value as DateRangeValue;
      return dateRange.from || dateRange.to;
    }
    return true;
  }).length;
}

/**
 * Load filters from localStorage
 */
function loadFiltersFromStorage(key: string): ActiveFilters | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as ActiveFilters;
    }
  } catch (error) {
    logger.warn('Failed to load filters from localStorage', { key, error });
  }
  return null;
}

/**
 * Save filters to localStorage
 */
function saveFiltersToStorage(key: string, filters: ActiveFilters): void {
  try {
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    logger.warn('Failed to save filters to localStorage', { key, error });
  }
}

/**
 * Shared Admin Filter Bar Component
 */
export function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  onClear,
  storageKey,
  searchPlaceholder = 'Search...',
  searchValue: controlledSearchValue,
  onSearchChange,
  showSearch = true,
  customFilters,
  className,
}: FilterBarProps) {
  const [internalSearchValue, setInternalSearchValue] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Controlled vs uncontrolled search
  const searchValue = controlledSearchValue ?? internalSearchValue;
  const handleSearchChange = onSearchChange ?? setInternalSearchValue;

  // Load persisted filters on mount
  useEffect(() => {
    if (storageKey && !isInitialized) {
      const stored = loadFiltersFromStorage(storageKey);
      if (stored) {
        onFilterChange(stored);
        logger.debug('Loaded filters from localStorage', { key: storageKey, filters: stored });
      }
      setIsInitialized(true);
    }
  }, [storageKey, isInitialized, onFilterChange]);

  // Persist filters to localStorage when they change
  useEffect(() => {
    if (storageKey && isInitialized) {
      saveFiltersToStorage(storageKey, activeFilters);
    }
  }, [storageKey, activeFilters, isInitialized]);

  // Handle filter value change
  const handleFilterValueChange = useCallback(
    (key: string, value: string | DateRangeValue | null) => {
      const newFilters = {
        ...activeFilters,
        [key]: value,
      };
      onFilterChange(newFilters);
    },
    [activeFilters, onFilterChange]
  );

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (key: string, range: DateRange | undefined) => {
      const value: DateRangeValue = {
        from: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
        to: range?.to ? format(range.to, 'yyyy-MM-dd') : null,
      };
      handleFilterValueChange(key, value);
    },
    [handleFilterValueChange]
  );

  // Parse date range from active filters
  const getDateRange = (key: string): DateRange | undefined => {
    const value = activeFilters[key] as DateRangeValue | undefined;
    if (!value) return undefined;

    return {
      from: value.from ? new Date(value.from) : undefined,
      to: value.to ? new Date(value.to) : undefined,
    };
  };

  // Format date range for display
  const formatDateRangeDisplay = (key: string): string => {
    const range = getDateRange(key);
    if (!range?.from && !range?.to) return 'Select dates';

    if (range.from && range.to) {
      return `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d, yyyy')}`;
    }

    if (range.from) {
      return `From ${format(range.from, 'MMM d, yyyy')}`;
    }

    if (range.to) {
      return `Until ${format(range.to, 'MMM d, yyyy')}`;
    }

    return 'Select dates';
  };

  // Remove a specific filter
  const removeFilter = useCallback(
    (key: string) => {
      const newFilters = { ...activeFilters };
      delete newFilters[key];
      onFilterChange(newFilters);
    },
    [activeFilters, onFilterChange]
  );

  // Clear all filters and search
  const handleClearAll = useCallback(() => {
    onClear();
    handleSearchChange('');
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [onClear, handleSearchChange, storageKey]);

  const activeFilterCount = countActiveFilters(activeFilters);
  const hasActiveFilters = activeFilterCount > 0 || searchValue.length > 0;

  // Render a single filter based on type
  const renderFilter = (config: FilterConfig) => {
    switch (config.type) {
      case 'select':
        return (
          <Select
            value={(activeFilters[config.key] as string) ?? ''}
            onValueChange={(value) =>
              handleFilterValueChange(config.key, value || null)
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={config.placeholder ?? `All ${config.label}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All {config.label}</SelectItem>
              {config.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'dateRange':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[240px] justify-start text-left font-normal',
                  !getDateRange(config.key) && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRangeDisplay(config.key)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={getDateRange(config.key)?.from}
                selected={getDateRange(config.key)}
                onSelect={(range) => handleDateRangeChange(config.key, range)}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !activeFilters[config.key] && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {activeFilters[config.key]
                  ? format(new Date(activeFilters[config.key] as string), 'MMM d, yyyy')
                  : config.placeholder ?? 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={
                  activeFilters[config.key]
                    ? new Date(activeFilters[config.key] as string)
                    : undefined
                }
                onSelect={(date) =>
                  handleFilterValueChange(
                    config.key,
                    date ? format(date, 'yyyy-MM-dd') : null
                  )
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'text':
        return (
          <Input
            placeholder={config.placeholder ?? `Filter by ${config.label.toLowerCase()}...`}
            value={(activeFilters[config.key] as string) ?? ''}
            onChange={(e) => handleFilterValueChange(config.key, e.target.value || null)}
            className="w-[180px]"
          />
        );

      default:
        return null;
    }
  };

  // Get display value for active filter badge
  const getFilterDisplayValue = (config: FilterConfig): string | null => {
    const value = activeFilters[config.key];
    if (!value) return null;

    if (config.type === 'dateRange') {
      return formatDateRangeDisplay(config.key);
    }

    if (config.type === 'select' && config.options) {
      const option = config.options.find((opt) => opt.value === value);
      return option?.label ?? String(value);
    }

    if (config.type === 'date') {
      return format(new Date(value as string), 'MMM d, yyyy');
    }

    return String(value);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Filter controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter icon with badge */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-[220px]"
            />
          </div>
        )}

        {/* Filter controls */}
        {filters.map((config) => (
          <div key={config.key}>{renderFilter(config)}</div>
        ))}

        {/* Custom filter slots */}
        {customFilters}

        {/* Clear all button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((config) => {
            const displayValue = getFilterDisplayValue(config);
            if (!displayValue) return null;

            return (
              <Badge
                key={config.key}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <span className="font-medium">{config.label}:</span>
                <span>{displayValue}</span>
                <button
                  onClick={() => removeFilter(config.key)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                  aria-label={`Remove ${config.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage filter state with localStorage persistence
 */
export function useFilterBar(
  storageKey: string,
  defaultFilters: ActiveFilters = {}
): {
  filters: ActiveFilters;
  setFilters: React.Dispatch<React.SetStateAction<ActiveFilters>>;
  clearFilters: () => void;
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
} {
  const [filters, setFilters] = useState<ActiveFilters>(() => {
    const stored = loadFiltersFromStorage(storageKey);
    return stored ?? defaultFilters;
  });

  const [searchValue, setSearchValue] = useState('');

  // Persist filters when they change
  useEffect(() => {
    saveFiltersToStorage(storageKey, filters);
  }, [storageKey, filters]);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchValue('');
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    filters,
    setFilters,
    clearFilters,
    searchValue,
    setSearchValue,
  };
}
