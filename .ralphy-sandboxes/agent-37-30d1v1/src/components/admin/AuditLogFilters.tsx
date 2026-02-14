/**
 * AuditLogFilters
 * Filter controls for the audit trail viewer.
 * Provides action, resource type, date range, and search filtering.
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
import type { AuditTrailFilters, AuditAction } from '@/types/auditTrail';

interface AuditLogFiltersProps {
  filters: AuditTrailFilters;
  onFilterChange: (filters: Partial<AuditTrailFilters>) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  totalCount: number;
}

const ACTION_OPTIONS: Array<{ value: AuditAction | 'all'; label: string }> = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
];

const RESOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Resources' },
  { value: 'products', label: 'Products' },
  { value: 'orders', label: 'Orders' },
  { value: 'wholesale_orders', label: 'Wholesale Orders' },
  { value: 'tenants', label: 'Tenants' },
  { value: 'tenant_users', label: 'Team Members' },
];

export function AuditLogFilters({
  filters,
  onFilterChange,
  onRefresh,
  isLoading,
  totalCount,
}: AuditLogFiltersProps) {
  const hasActiveFilters =
    (filters.action && filters.action !== 'all') ||
    (filters.resourceType && filters.resourceType !== 'all') ||
    (filters.searchTerm && filters.searchTerm.length > 0) ||
    filters.startDate ||
    filters.endDate;

  const clearFilters = () => {
    onFilterChange({
      action: 'all',
      resourceType: 'all',
      searchTerm: '',
      startDate: undefined,
      endDate: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={filters.searchTerm || ''}
            onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.action || 'all'}
          onValueChange={(value) => onFilterChange({ action: value as AuditAction | 'all' })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.resourceType || 'all'}
          onValueChange={(value) => onFilterChange({ resourceType: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      <div className="text-xs text-muted-foreground">
        {totalCount === 0 ? 'No entries' : `${totalCount} ${totalCount === 1 ? 'entry' : 'entries'} found`}
        {hasActiveFilters && ' (filtered)'}
      </div>
    </div>
  );
}
