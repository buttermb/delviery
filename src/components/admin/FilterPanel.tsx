/**
 * Filter Panel Component
 * Advanced filtering interface for data tables
 */

import { useState, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import X from "lucide-react/dist/esm/icons/x";
import Filter from "lucide-react/dist/esm/icons/filter";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface FilterOption {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'range';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface FilterValue {
  [key: string]: string | number | { min?: number; max?: number } | null;
}

interface FilterPanelProps {
  filters: FilterOption[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  onReset: () => void;
  className?: string;
  defaultOpen?: boolean;
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onReset,
  className,
  defaultOpen = false,
}: FilterPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [localValues, setLocalValues] = useState<FilterValue>(values);

  const activeFilterCount = Object.values(localValues).filter(
    (v) => v !== null && v !== undefined && v !== ''
  ).length;

  const handleFilterChange = (filterId: string, value: string | number | null) => {
    const newValues = { ...localValues, [filterId]: value };
    setLocalValues(newValues);
    onChange(newValues);
  };

  const handleRangeChange = (filterId: string, field: 'min' | 'max', value: string) => {
    const currentRange = (localValues[filterId] as { min?: number; max?: number }) || {};
    const newRange = { ...currentRange, [field]: value ? parseFloat(value) : undefined };
    const newValues = { ...localValues, [filterId]: newRange };
    setLocalValues(newValues);
    onChange(newValues);
  };

  const handleReset = () => {
    const resetValues: FilterValue = {};
    filters.forEach((filter) => {
      resetValues[filter.id] = null;
    });
    setLocalValues(resetValues);
    onReset();
  };

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <Card className={cn('mb-4', className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filters</CardTitle>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  {open ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filters.map((filter) => {
                const value = localValues[filter.id];

                if (filter.type === 'select') {
                  return (
                    <div key={filter.id} className="space-y-2">
                      <Label htmlFor={filter.id} className="text-sm font-medium">
                        {filter.label}
                      </Label>
                      <Select
                        value={(value as string) || ''}
                        onValueChange={(val) => handleFilterChange(filter.id, val || null)}
                      >
                        <SelectTrigger id={filter.id}>
                          <SelectValue placeholder={filter.placeholder || `Select ${filter.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All</SelectItem>
                          {filter.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (filter.type === 'range') {
                  const rangeValue = (value as { min?: number; max?: number }) || {};
                  return (
                    <div key={filter.id} className="space-y-2">
                      <Label htmlFor={filter.id} className="text-sm font-medium">
                        {filter.label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`${filter.id}-min`}
                          type="number"
                          placeholder="Min"
                          value={rangeValue.min || ''}
                          onChange={(e) => handleRangeChange(filter.id, 'min', e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          id={`${filter.id}-max`}
                          type="number"
                          placeholder="Max"
                          value={rangeValue.max || ''}
                          onChange={(e) => handleRangeChange(filter.id, 'max', e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  );
                }

                if (filter.type === 'date') {
                  return (
                    <div key={filter.id} className="space-y-2">
                      <Label htmlFor={filter.id} className="text-sm font-medium">
                        {filter.label}
                      </Label>
                      <Input
                        id={filter.id}
                        type="date"
                        value={(value as string) || ''}
                        onChange={(e) => handleFilterChange(filter.id, e.target.value || null)}
                      />
                    </div>
                  );
                }

                if (filter.type === 'number') {
                  return (
                    <div key={filter.id} className="space-y-2">
                      <Label htmlFor={filter.id} className="text-sm font-medium">
                        {filter.label}
                      </Label>
                      <Input
                        id={filter.id}
                        type="number"
                        placeholder={filter.placeholder}
                        value={(value as number) || ''}
                        onChange={(e) =>
                          handleFilterChange(
                            filter.id,
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                      />
                    </div>
                  );
                }

                // Default: text input
                return (
                  <div key={filter.id} className="space-y-2">
                    <Label htmlFor={filter.id} className="text-sm font-medium">
                      {filter.label}
                    </Label>
                    <Input
                      id={filter.id}
                      type="text"
                      placeholder={filter.placeholder || `Filter by ${filter.label}`}
                      value={(value as string) || ''}
                      onChange={(e) => handleFilterChange(filter.id, e.target.value || null)}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

