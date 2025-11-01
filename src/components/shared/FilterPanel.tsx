/**
 * Filter Panel Component
 * Advanced filtering UI for data tables
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  options?: { value: string; label: string }[];
}

interface FilterPanelProps {
  filters: FilterOption[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onReset: () => void;
  className?: string;
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  const activeFilters = Object.keys(values).filter(key => values[key] !== '' && values[key] !== null);

  const handleFilterChange = (key: string, value: any) => {
    onChange({
      ...values,
      [key]: value,
    });
  };

  const removeFilter = (key: string) => {
    const newValues = { ...values };
    delete newValues[key];
    onChange(newValues);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilters.length}
            </Badge>
          )}
        </Button>

        {activeFilters.length > 0 && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {activeFilters.map((key) => {
                const filter = filters.find(f => f.key === key);
                if (!filter) return null;

                return (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="gap-1"
                  >
                    {filter.label}: {values[key]}
                    <button
                      onClick={() => removeFilter(key)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
            >
              Clear All
            </Button>
          </>
        )}
      </div>

      {open && (
        <Card className="p-4 mt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filters.map((filter) => (
              <div key={filter.key}>
                <Label className="mb-2">{filter.label}</Label>
                {filter.type === 'text' && (
                  <Input
                    value={values[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    placeholder={`Filter by ${filter.label.toLowerCase()}...`}
                  />
                )}
                {filter.type === 'select' && filter.options && (
                  <Select
                    value={values[filter.key] || ''}
                    onValueChange={(value) => handleFilterChange(filter.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`All ${filter.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All {filter.label}</SelectItem>
                      {filter.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filter.type === 'date' && (
                  <Input
                    type="date"
                    value={values[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  />
                )}
                {filter.type === 'number' && (
                  <Input
                    type="number"
                    value={values[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    placeholder={`Filter by ${filter.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              Reset
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

