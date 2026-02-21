/**
 * ActivityFeedFilters
 * Filter controls for the unified activity feed.
 * Provides category, severity, date range, and search filtering.
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, RefreshCw } from 'lucide-react';
import type { ActivityFeedFilters as FilterState, ActivityCategory, ActivitySeverity } from '@/hooks/useActivityFeed';

interface ActivityFeedFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  totalCount: number;
}

const CATEGORY_OPTIONS: Array<{ value: ActivityCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All Categories' },
  { value: 'order', label: 'Orders' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'user', label: 'Users' },
  { value: 'system', label: 'System' },
  { value: 'payment', label: 'Payments' },
  { value: 'settings', label: 'Settings' },
  { value: 'crm', label: 'CRM' },
  { value: 'delivery', label: 'Delivery' },
];

const SEVERITY_OPTIONS: Array<{ value: ActivitySeverity | 'all'; label: string }> = [
  { value: 'all', label: 'All Severities' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

export function ActivityFeedFilters({
  filters,
  onFilterChange,
  onRefresh,
  isLoading,
  totalCount,
}: ActivityFeedFiltersProps) {
  const hasActiveFilters =
    (filters.category && filters.category !== 'all') ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.searchTerm && filters.searchTerm.length > 0) ||
    filters.startDate ||
    filters.endDate;

  const clearFilters = () => {
    onFilterChange({
      category: 'all',
      severity: 'all',
      searchTerm: '',
      startDate: undefined,
      endDate: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity..."
            aria-label="Search activity"
            value={filters.searchTerm || ''}
            onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => onFilterChange({ category: value as ActivityCategory | 'all' })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity Filter */}
        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => onFilterChange({ severity: value as ActivitySeverity | 'all' })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => onFilterChange({ startDate: e.target.value || undefined })}
          className="w-[140px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => onFilterChange({ endDate: e.target.value || undefined })}
          className="w-[140px]"
          placeholder="To"
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Result count */}
      <div className="text-xs text-muted-foreground">
        {totalCount === 0 ? 'No entries' : `${totalCount} ${totalCount === 1 ? 'entry' : 'entries'} found`}
        {hasActiveFilters && ' (filtered)'}
      </div>
    </div>
  );
}
