import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SearchableFilterDropdownProps {
  /** Dropdown label */
  label: string;
  /** Available options */
  options: FilterOption[];
  /** Currently selected value(s) */
  value: string | string[];
  /** Called when selection changes */
  onChange: (value: string | string[]) => void;
  /** Allow multiple selections */
  multiple?: boolean;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Show search input only if options exceed this count */
  searchThreshold?: number;
  /** Show counts next to options */
  showCounts?: boolean;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary';
  /** Size */
  size?: 'sm' | 'default' | 'lg';
  /** Additional class names */
  className?: string;
  /** Align popover */
  align?: 'start' | 'center' | 'end';
}

export function SearchableFilterDropdown({
  label,
  options,
  value,
  onChange,
  multiple = false,
  searchPlaceholder = 'Search...',
  searchThreshold = 5,
  showCounts = true,
  variant = 'outline',
  size = 'default',
  className,
  align = 'start',
}: SearchableFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedValues = useMemo(() => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  const showSearch = options.length > searchThreshold;

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue === value ? '' : optionValue);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiple ? [] : '');
  };

  const getDisplayLabel = () => {
    if (selectedValues.length === 0) return label;
    if (selectedValues.length === 1) {
      const selected = options.find((o) => o.value === selectedValues[0]);
      return selected?.label || label;
    }
    return `${selectedValues.length} selected`;
  };

  // Focus search input when popover opens
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (open && showSearch && searchInputRef.current) {
      timer = setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    if (!open) {
      setSearch('');
    }
    return () => clearTimeout(timer);
  }, [open, showSearch]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn(
            'justify-between',
            selectedValues.length > 0 && 'border-primary/50 bg-primary/5',
            className
          )}
        >
          <span className="truncate">{getDisplayLabel()}</span>
          <div className="flex items-center gap-1 ml-2">
            {selectedValues.length > 0 && (
              <button
                onClick={handleClear}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-56 p-0 bg-popover"
      >
        {showSearch && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
        )}
        
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    disabled={option.disabled}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent/50',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className={cn(
                      'flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    {option.icon && (
                      <span className="flex-shrink-0">{option.icon}</span>
                    )}
                    <span className="flex-1 text-left truncate">{option.label}</span>
                    {showCounts && option.count !== undefined && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {option.count}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {multiple && selectedValues.length > 0 && (
          <div className="p-2 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {selectedValues.length} selected
            </span>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface QuickFilterChipsProps {
  options: FilterOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function QuickFilterChips({
  options,
  value,
  onChange,
  multiple = false,
  className,
}: QuickFilterChipsProps) {
  const selectedValues = useMemo(() => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }, [value]);

  const handleClick = (optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue === value ? '' : optionValue);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <Button
            key={option.value}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            disabled={option.disabled}
            onClick={() => handleClick(option.value)}
            className={cn(
              'rounded-full',
              !isSelected && 'hover:border-primary/50'
            )}
          >
            {option.icon && <span className="mr-1">{option.icon}</span>}
            {option.label}
            {option.count !== undefined && (
              <Badge
                variant={isSelected ? 'secondary' : 'outline'}
                className="ml-1.5 text-xs"
              >
                {option.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
